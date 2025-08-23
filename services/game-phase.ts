import { Game, GamePhase, Winner } from "../types/game.ts";
import { logger } from "../utils/logger.ts";
import { checkGameEnd, getActionMap, getNextPhase, getPhaseChangeDescription, getPhaseTime } from "./game-core.ts";
import { repositoryContainer } from "../repositories/repository-container.ts";

// 他のファイルから利用できるようにgetActionMapを再エクスポート
export { getActionMap };

// フェーズタイマーの管理用マップ
const phaseTimers: Map<string, number> = new Map();

// 全てのタイマーをクリア
export const clearAllTimers = (): void => {
  for (const [gameId] of phaseTimers) {
    clearPhaseTimer(gameId);
  }
  phaseTimers.clear();
};

/**
 * フェーズタイマーの設定
 */
export const scheduleNextPhase = (game: Game): void => {
  // 既存のタイマーがあれば削除
  clearPhaseTimer(game.id);

  if (game.status !== "IN_PROGRESS" || !game.phaseEndTime) {
    return;
  }

  // フェーズ終了時刻からタイマー時間を計算
  const phaseEndTime = new Date(game.phaseEndTime).getTime();
  const currentTime = Date.now();
  const timeoutMs = Math.max(0, phaseEndTime - currentTime);

  if (timeoutMs === 0) {
    // タイムアウトが0以下の場合は直ちにフェーズを進める
    advanceGamePhase(game);
    if (game.status === "IN_PROGRESS") {
      scheduleNextPhase(game);
    }
    return;
  }

  // タイマーを設定
  try {
    const timerId = setTimeout(() => {
      // タイマー実行時にゲームが終了していないことを確認
      if (game.status !== "IN_PROGRESS") {
        return;
      }

      // フェーズを進める
      advanceGamePhase(game);

      // 次のフェーズのタイマーを設定
      if (game.status === "IN_PROGRESS") {
        scheduleNextPhase(game);
      }
    }, timeoutMs);

    // タイマーIDを保存
    phaseTimers.set(game.id, timerId);

    logger.info("Phase timer scheduled", {
      gameId: game.id,
      phase: game.currentPhase,
      endTime: game.phaseEndTime,
      timeoutMs,
    });
  } catch (error) {
    logger.error("Failed to schedule phase timer", {
      error: (error as Error).message,
      gameId: game.id,
      phase: game.currentPhase,
    });
  }
};

/**
 * フェーズタイマーの設定（シンプルなバージョン）
 * ゲームIDと時間を指定して、次のフェーズ進行をスケジュール
 */
export const setPhaseTimer = async (gameId: string, durationSeconds: number): Promise<void> => {
  // ゲーム情報を取得
  const gameRepo = repositoryContainer.getGameRepository();
  const game = await gameRepo.findById(gameId);

  if (!game || game.status !== "IN_PROGRESS") {
    return;
  }

  // 既存のタイマーがあれば削除
  clearPhaseTimer(gameId);

  try {
    // 新しいタイマーを設定
    const timerId = setTimeout(async () => {
      try {
        // フェーズ進行時にゲーム情報を再取得
        const currentGame = await gameRepo.findById(gameId);
        if (currentGame && currentGame.status === "IN_PROGRESS") {
          advanceGamePhase(currentGame);
          // ゲーム情報を更新
          await gameRepo.update(gameId, currentGame);
        }
      } catch (error) {
        logger.error("Error in phase timer callback", {
          error: (error as Error).message,
          gameId,
        });
      }
    }, durationSeconds * 1000);

    // タイマーIDを保存
    phaseTimers.set(gameId, timerId);

    logger.info("Phase timer set", {
      gameId,
      durationSeconds,
    });
  } catch (error) {
    logger.error("Failed to set phase timer", {
      error: (error as Error).message,
      gameId,
    });
  }
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
      logger.error("Failed to clear phase timer", {
        error: (error as Error).message,
        gameId,
      });
    }
  }
};

// 型安全なフェーズ取得
function getCurrentPhase(game: Game): GamePhase {
  return game.currentPhase || "DAY_DISCUSSION";
}

/**
 * フェーズの進行処理
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

  // 次のフェーズのタイマーを設定
  scheduleNextPhase(game);

  logger.info("Game phase advanced", {
    gameId: game.id,
    day: game.currentDay,
    phase: game.currentPhase,
    endTime: game.phaseEndTime,
  });
}

/**
 * 各フェーズ終了時の未実行アクションの処理
 */
function handlePendingActions(game: Game): void {
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
function handlePendingVotes(game: Game): void {
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
function handlePendingNightActions(game: Game): void {
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
function endGame(game: Game, winner: Winner): void {
  game.status = "FINISHED";
  game.currentPhase = "GAME_OVER";
  game.winner = winner;
  game.phaseEndTime = null;

  // 結果を記録
  const now = new Date();
  game.gameEvents.push({
    id: crypto.randomUUID(),
    day: game.currentDay,
    phase: game.currentPhase,
    type: "GAME_END",
    description: winner === "VILLAGERS" ? "村人陣営が勝利しました！" : "人狼陣営が勝利しました！",
    timestamp: now.toISOString(),
  });

  logger.info("Game ended", {
    gameId: game.id,
    winner,
    players: game.players.map((p) => ({
      id: p.playerId,
      role: p.role,
      isAlive: p.isAlive,
    })),
  });

  // タイマーをクリア
  clearPhaseTimer(game.id);
}
