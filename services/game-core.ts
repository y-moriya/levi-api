// filepath: c:\Users\wellk\project\levi-api\services\game-core.ts
import { Game, GameEvent, GamePhase, GamePlayer, GameStatus, Winner } from "../types/game.ts";
import { logger } from "../utils/logger.ts";

// ゲームの基本定数
export const MINIMUM_PLAYERS = 4;

// フェーズタイマーの管理用マップ
const phaseTimers: Map<string, number> = new Map();

// プレイヤー関連のユーティリティ関数
export function getAlivePlayerCount(game: Game): number {
  return game.players.filter((p) => p.isAlive).length;
}

export function findPlayerById(game: Game, playerId: string): GamePlayer | undefined {
  return game.players.find((p) => p.playerId === playerId);
}

export function findAlivePlayerById(game: Game, playerId: string): GamePlayer | undefined {
  return game.players.find((p) => p.playerId === playerId && p.isAlive);
}

// ゲーム状態チェック関数
export function isGameInProgress(game: Game): boolean {
  return game.status === "IN_PROGRESS";
}

export function isPlayerInGame(game: Game, playerId: string): boolean {
  return game.players.some((p) => p.playerId === playerId);
}

export function isPlayerAlive(game: Game, playerId: string): boolean {
  const player = findPlayerById(game, playerId);
  return player ? player.isAlive : false;
}

// エラーチェック関数
export function validateGameAction(game: Game, playerId: string): void {
  if (!isGameInProgress(game)) {
    throw new Error("ゲームが進行中ではありません");
  }

  if (!isPlayerInGame(game, playerId)) {
    throw new Error("あなたはこのゲームに参加していません");
  }

  if (!isPlayerAlive(game, playerId)) {
    throw new Error("あなたはすでに死亡しています");
  }
}

/**
 * ゲームの次のフェーズを取得する
 */
export function getNextPhase(currentPhase: GamePhase): GamePhase {
  switch (currentPhase) {
    case "DAY_DISCUSSION":
      return "DAY_VOTE";
    case "DAY_VOTE":
      return "NIGHT";
    case "NIGHT":
      return "DAY_DISCUSSION";
    default:
      return "DAY_DISCUSSION";
  }
}

/**
 * 各フェーズの持続時間（秒）を取得する
 */
export function getPhaseTime(phase: GamePhase, game: Game): number {
  // 設定値があればそれを使う
  if (game.settings?.phaseTimes?.[phase]) {
    return game.settings.phaseTimes[phase];
  }

  // デフォルト値
  switch (phase) {
    case "DAY_DISCUSSION":
      return 180; // 3分
    case "DAY_VOTE":
      return 60; // 1分
    case "NIGHT":
      return 60; // 1分
    default:
      return 60;
  }
}

/**
 * フェーズ変更時の説明文を取得する
 */
export function getPhaseChangeDescription(phase: GamePhase, day: number): string {
  switch (phase) {
    case "DAY_DISCUSSION":
      return `${day}日目の朝が来ました。村人たちは議論を始めます。`;
    case "DAY_VOTE":
      return `投票の時間です。処刑する村人を決めてください。`;
    case "NIGHT":
      return `夜になりました。それぞれの役職の能力を使ってください。`;
    default:
      return `フェーズが変わりました。`;
  }
}

/**
 * 勝敗判定を行う
 */
export function checkGameEnd(game: Game): { isEnded: boolean; winner: Winner } {
  const livingPlayers = game.players.filter((p) => p.isAlive);
  const livingWerewolves = livingPlayers.filter((p) => p.role === "WEREWOLF");
  const livingVillagers = livingPlayers.filter((p) => p.role !== "WEREWOLF");

  // 人狼がいなくなった場合、村人の勝利
  if (livingWerewolves.length === 0) {
    return { isEnded: true, winner: "VILLAGERS" };
  }

  // 人狼が村人と同数以上になった場合、人狼の勝利
  if (livingWerewolves.length >= livingVillagers.length) {
    return { isEnded: true, winner: "WEREWOLVES" };
  }

  // どちらも勝利条件を満たしていない場合、ゲーム継続
  return { isEnded: false, winner: "NONE" };
}

/**
 * Game オブジェクト内のアクションマップを取得する
 */
export function getActionMap(game: Game, key: string): Map<string, string> {
  if (!game.actions[key]) {
    game.actions[key] = new Map<string, string>();
  }
  return game.actions[key];
}

/**
 * ゲームの現在のフェーズを取得する（型安全）
 */
export function getCurrentPhase(game: Game): GamePhase {
  return game.currentPhase || "DAY_DISCUSSION";
}

// 全てのタイマーをクリア
export const clearAllTimers = (): void => {
  for (const [gameId] of phaseTimers) {
    clearPhaseTimer(gameId);
  }
  phaseTimers.clear();
};

/**
 * フェーズタイマーのクリア
 */
export const clearPhaseTimer = (gameId: string): void => {
  const timerId = phaseTimers.get(gameId);
  if (timerId) {
    try {
      clearTimeout(timerId);
      phaseTimers.delete(gameId);
      logger.info("Phase timer cleared", { gameId });
    } catch (error) {
      logger.error("Failed to clear phase timer", { error: (error as Error).message, gameId });
    }
  }
};

/**
 * 各フェーズ終了時の未実行アクションの処理
 */
export function handlePendingActions(game: Game): void {
  switch (game.currentPhase) {
    case "DAY_VOTE":
      handlePendingVotes(game);
      break;
    case "NIGHT":
      handlePendingNightActions(game);
      break;
    default:
      break;
  }
}

/**
 * 未投票のプレイヤーのランダム投票処理
 */
export function handlePendingVotes(game: Game): void {
  const voteKey = `vote_${game.currentDay}` as const;
  const votes = getActionMap(game, voteKey);
  const votedPlayers = new Set(votes.keys());

  // 生存しているプレイヤーでまだ投票していない人を抽出
  game.players
    .filter((p) => p.isAlive && !votedPlayers.has(p.playerId))
    .forEach((player) => {
      // 投票可能な対象（自分以外の生存者）を取得
      const possibleTargets = game.players.filter(
        (t) => t.isAlive && t.playerId !== player.playerId,
      );

      if (possibleTargets.length > 0) {
        // ランダムに投票先を選択
        const target = possibleTargets[Math.floor(Math.random() * possibleTargets.length)];
        votes.set(player.playerId, target.playerId);

        logger.info("Random vote assigned", {
          gameId: game.id,
          playerId: player.playerId,
          targetId: target.playerId,
        });
      }
    });
}

/**
 * 夜フェーズの未実行アクションの処理
 */
export function handlePendingNightActions(game: Game): void {
  const attackKey = `attack_${game.currentDay}` as const;
  const divineKey = `divine_${game.currentDay}` as const;
  const guardKey = `guard_${game.currentDay}` as const;
  const mediumKey = `medium_${game.currentDay}` as const;

  // アクション済みのプレイヤーを収集
  const actedPlayers = new Set([
    ...getActionMap(game, attackKey).keys(),
    ...getActionMap(game, divineKey).keys(),
    ...getActionMap(game, guardKey).keys(),
    ...getActionMap(game, mediumKey).keys(),
  ]);

  // 前日に処刑されたプレイヤーを探す（霊能者用）
  const executedPlayers = game.players.filter(
    (p) => !p.isAlive && p.deathCause === "EXECUTION" && p.deathDay === game.currentDay - 1,
  );

  // 生存していて特殊役職を持つプレイヤーを処理
  game.players
    .filter((p) => p.isAlive && !actedPlayers.has(p.playerId))
    .forEach((player) => {
      // 役職に応じた処理
      switch (player.role) {
        case "WEREWOLF": {
          // 投票可能な対象（自分以外の生存者で人狼以外）を取得
          const possibleTargets = game.players.filter(
            (t) => t.isAlive && t.playerId !== player.playerId && t.role !== "WEREWOLF",
          );

          if (possibleTargets.length > 0) {
            // ランダムに対象を選択
            const target = possibleTargets[Math.floor(Math.random() * possibleTargets.length)];
            getActionMap(game, attackKey).set(player.playerId, target.playerId);
            logger.info("Random attack assigned", {
              gameId: game.id,
              playerId: player.playerId,
              targetId: target.playerId,
            });
          }
          break;
        }

        case "SEER": {
          // 投票可能な対象（自分以外の生存者）を取得
          const possibleTargets = game.players.filter(
            (t) => t.isAlive && t.playerId !== player.playerId,
          );

          if (possibleTargets.length > 0) {
            // ランダムに対象を選択
            const target = possibleTargets[Math.floor(Math.random() * possibleTargets.length)];
            getActionMap(game, divineKey).set(player.playerId, target.playerId);
            logger.info("Random divine assigned", {
              gameId: game.id,
              playerId: player.playerId,
              targetId: target.playerId,
            });
          }
          break;
        }

        case "BODYGUARD": {
          // 投票可能な対象（自分以外の生存者）を取得
          const possibleTargets = game.players.filter(
            (t) => t.isAlive && t.playerId !== player.playerId,
          );

          if (possibleTargets.length > 0) {
            // ランダムに対象を選択
            const target = possibleTargets[Math.floor(Math.random() * possibleTargets.length)];
            getActionMap(game, guardKey).set(player.playerId, target.playerId);
            logger.info("Random guard assigned", {
              gameId: game.id,
              playerId: player.playerId,
              targetId: target.playerId,
            });
          }
          break;
        }

        case "MEDIUM": {
          // 前日処刑者がいれば自動的に対象にする
          if (executedPlayers.length > 0) {
            const target = executedPlayers[0]; // 処刑者は通常1人
            getActionMap(game, mediumKey).set(player.playerId, target.playerId);
            logger.info("Random medium action assigned", {
              gameId: game.id,
              playerId: player.playerId,
              targetId: target.playerId,
            });
          }
          break;
        }
      }
    });
}

/**
 * ゲーム終了処理
 */
export function endGame(game: Game, winner: Winner): void {
  game.status = "FINISHED";
  game.winner = winner;
  game.endTime = new Date().toISOString();

  const winReason = winner === "VILLAGERS" ? "村人陣営が人狼を全て倒しました" : "人狼が村人と同数になりました";

  // ゲーム終了イベントを記録
  game.gameEvents.push({
    id: crypto.randomUUID(),
    day: game.currentDay,
    phase: game.currentPhase,
    type: "GAME_END",
    description: `ゲームが終了しました。${winner === "VILLAGERS" ? "村人陣営" : "人狼陣営"}の勝利です。${winReason}`,
    timestamp: new Date().toISOString(),
  });

  logger.info("Game ended", {
    gameId: game.id,
    winner,
    reason: winReason,
  });

  // タイマーをクリア
  clearPhaseTimer(game.id);
}

/**
 * フェーズの進行処理
 * この関数は元々game-phase.tsにあったが、循環参照を解消するためにここに移動
 */
export function advanceGamePhase(game: Game): void {
  // 現在のフェーズでの未実行アクションの処理
  handlePendingActions(game);

  // 勝敗判定
  const gameEnd = checkGameEnd(game);
  if (gameEnd.isEnded) {
    endGame(game, gameEnd.winner);
    return;
  }

  // 次のフェーズを設定
  const nextPhase = getNextPhase(getCurrentPhase(game));
  const now = new Date();

  game.currentPhase = nextPhase;
  game.phaseEndTime = new Date(now.getTime() + getPhaseTime(nextPhase, game) * 1000).toISOString();

  if (nextPhase === "DAY_DISCUSSION") {
    game.currentDay += 1;
  }

  // ゲームイベントを記録
  game.gameEvents.push({
    id: crypto.randomUUID(),
    day: game.currentDay,
    phase: game.currentPhase,
    type: "PHASE_CHANGE",
    description: getPhaseChangeDescription(game.currentPhase, game.currentDay),
    timestamp: now.toISOString(),
  });

  logger.info("Game phase advanced", {
    gameId: game.id,
    day: game.currentDay,
    phase: game.currentPhase,
    endTime: game.phaseEndTime,
  });
}
