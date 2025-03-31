import { Game, GamePhase, Role } from "../types/game.ts";
import { uuid } from "https://deno.land/x/uuid@v0.1.2/mod.ts";
import { logger } from "../utils/logger.ts";
import { scheduleNextPhase } from "./game-phase.ts";
import * as gameActions from "./game-actions.ts";

// フェーズ変更時の説明文を生成
function getPhaseChangeDescription(phase: GamePhase, day: number): string {
  switch (phase) {
    case "DAY_DISCUSSION":
      return `${day}日目の昼になりました。自由に議論を行ってください。`;
    case "DAY_VOTE":
      return `投票の時間になりました。処刑する人を決めてください。`;
    case "NIGHT":
      return `夜になりました。各役職は行動を選択してください。`;
    default:
      return `フェーズが${phase}に変更されました。`;
  }
}

// 役職をランダムに割り当てる
export const assignRoles = (game: Game): void => {
  const players = [...game.players];
  const roles: Role[] = [];
  const settings = game.settings;

  // 役職リストを作成
  for (let i = 0; i < settings.roles.werewolfCount; i++) {
    roles.push("WEREWOLF");
  }

  for (let i = 0; i < settings.roles.seerCount; i++) {
    roles.push("SEER");
  }

  for (let i = 0; i < settings.roles.bodyguardCount; i++) {
    roles.push("BODYGUARD");
  }

  for (let i = 0; i < settings.roles.mediumCount; i++) {
    roles.push("MEDIUM");
  }

  // 残りは村人
  const villagerCount = players.length - roles.length;
  for (let i = 0; i < villagerCount; i++) {
    roles.push("VILLAGER");
  }

  // 役職をシャッフル
  for (let i = roles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [roles[i], roles[j]] = [roles[j], roles[i]];
  }

  // プレイヤーに役職を割り当て
  for (let i = 0; i < players.length; i++) {
    players[i].role = roles[i];
  }

  game.players = players;
  logger.info("Roles assigned to players", { gameId: game.id, roleDistribution: countRoles(roles) });
};

// ゲームの勝敗判定
export const checkGameEnd = (game: Game): { isEnded: boolean; winner: "VILLAGERS" | "WEREWOLVES" | "NONE" } => {
  const alivePlayers = game.players.filter((p) => p.isAlive);
  const aliveWerewolves = alivePlayers.filter((p) => p.role === "WEREWOLF");

  // 人狼が全滅した場合、村人の勝利
  if (aliveWerewolves.length === 0) {
    return { isEnded: true, winner: "VILLAGERS" };
  }

  // 人狼の数が村人陣営の数以上になった場合、人狼の勝利
  const aliveVillagers = alivePlayers.filter((p) => p.role !== "WEREWOLF");
  if (aliveWerewolves.length >= aliveVillagers.length) {
    return { isEnded: true, winner: "WEREWOLVES" };
  }

  return { isEnded: false, winner: "NONE" };
};

// フェーズを進める
export const advancePhase = async (game: Game): Promise<void> => {
  const previousPhase = game.currentPhase;
  logger.info("Starting phase transition", {
    gameId: game.id,
    from: previousPhase,
    currentDay: game.currentDay,
    gameStatus: game.status,
  });

  // 勝敗判定
  const { isEnded, winner } = checkGameEnd(game);
  if (isEnded) {
    game.status = "FINISHED";
    game.winner = winner;
    logger.info("Game ended", {
      gameId: game.id,
      winner,
      finalDay: game.currentDay,
      finalPhase: game.currentPhase,
    });
    game.gameEvents.push({
      id: uuid(),
      day: game.currentDay,
      phase: game.currentPhase || "GAME_OVER",
      type: "GAME_END",
      description: `ゲームが終了しました。${winner === "VILLAGERS" ? "村人" : "人狼"}陣営の勝利です。`,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // フェーズ進行
  switch (game.currentPhase) {
    case "DAY_DISCUSSION": {
      logger.info("Transitioning from DAY_DISCUSSION", {
        gameId: game.id,
        nextPhase: "DAY_VOTE",
        hasActions: gameActions.getGameActions(game.id) !== undefined,
      });
      game.currentPhase = "DAY_VOTE";
      game.phaseEndTime = new Date(Date.now() + game.settings.voteTimeSeconds * 1000).toISOString();

      // アクション状態を初期化
      await Promise.resolve(gameActions.initializeGameActions(game.id));
      break;
    }
    case "DAY_VOTE": {
      logger.info("Processing DAY_VOTE actions", {
        gameId: game.id,
        hasActions: gameActions.getGameActions(game.id) !== undefined,
        currentVotes: JSON.stringify(gameActions.getGameActions(game.id)?.votes),
      });

      // 未投票者へのランダム投票割り当てを実行
      gameActions.processPhaseActions(game);

      // 投票結果の処理
      _processVoteResults(game);

      // 投票結果の処理後に勝敗判定
      const voteEndCheck = checkGameEnd(game);
      if (voteEndCheck.isEnded) {
        game.status = "FINISHED";
        game.winner = voteEndCheck.winner;
        logger.info("Game ended after voting", {
          gameId: game.id,
          winner: voteEndCheck.winner,
        });
        game.gameEvents.push({
          id: uuid(),
          day: game.currentDay,
          phase: game.currentPhase,
          type: "GAME_END",
          description: `ゲームが終了しました。${voteEndCheck.winner === "VILLAGERS" ? "村人" : "人狼"}陣営の勝利です。`,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // 夜フェーズに移行
      game.currentPhase = "NIGHT";
      game.phaseEndTime = new Date(Date.now() + game.settings.nightTimeSeconds * 1000).toISOString();

      // 夜フェーズ開始時にアクション状態を初期化
      await Promise.resolve(gameActions.initializeGameActions(game.id));

      logger.info("Transitioned to NIGHT phase", {
        gameId: game.id,
        hasActions: gameActions.getGameActions(game.id) !== undefined,
      });
      break;
    }
    case "NIGHT": {
      logger.info("Processing NIGHT actions", {
        gameId: game.id,
        hasActions: gameActions.getGameActions(game.id) !== undefined,
        currentActions: JSON.stringify(gameActions.getGameActions(game.id)),
      });
      // 夜アクションの処理（processPhaseActionsの前に_processNightActionsを実行）
      _processNightActions(game);
      gameActions.processPhaseActions(game);

      // 夜アクションの処理後に勝敗判定
      const gameEndCheck = checkGameEnd(game);
      if (gameEndCheck.isEnded) {
        game.status = "FINISHED";
        game.winner = gameEndCheck.winner;
        logger.info("Game ended after night actions", {
          gameId: game.id,
          winner: gameEndCheck.winner,
        });
        game.gameEvents.push({
          id: uuid(),
          day: game.currentDay,
          phase: game.currentPhase,
          type: "GAME_END",
          description: `ゲームが終了しました。${gameEndCheck.winner === "VILLAGERS" ? "村人" : "人狼"}陣営の勝利です。`,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      game.currentDay += 1;
      game.currentPhase = "DAY_DISCUSSION";
      game.phaseEndTime = new Date(Date.now() + game.settings.dayTimeSeconds * 1000).toISOString();
      logger.info("Transitioned to next day", {
        gameId: game.id,
        newDay: game.currentDay,
        hasActions: gameActions.getGameActions(game.id) !== undefined,
      });
      break;
    }
  }

  logger.info("Phase transition completed", {
    gameId: game.id,
    day: game.currentDay,
    previousPhase,
    currentPhase: game.currentPhase,
    phaseEndTime: game.phaseEndTime,
    hasActions: gameActions.getGameActions(game.id) !== undefined,
  });

  // ゲームイベントを記録
  game.gameEvents.push({
    id: uuid(),
    day: game.currentDay,
    phase: game.currentPhase || "GAME_OVER",
    type: "PHASE_CHANGE",
    description: getPhaseChangeDescription(game.currentPhase, game.currentDay),
    timestamp: new Date().toISOString(),
  });
};

// ゲーム開始時の初期化
export const initializeGame = (game: Game): void => {
  if (game.status !== "WAITING") {
    throw new Error("Game is not in waiting state");
  }

  // プレイヤー数チェック
  const minPlayers = calculateMinPlayers(game.settings);
  if (game.players.length < minPlayers) {
    throw new Error(`At least ${minPlayers} players are required`);
  }

  // 役職数の妥当性チェック
  validateRoleSettings(game);

  // ゲーム状態の初期化
  game.status = "IN_PROGRESS";
  game.currentDay = 1;
  game.currentPhase = "DAY_DISCUSSION";
  game.phaseEndTime = new Date(Date.now() + game.settings.dayTimeSeconds * 1000).toISOString();
  game.winner = "NONE";

  // 役職の割り当て
  assignRoles(game);

  // アクション状態の初期化
  gameActions.initializeGameActions(game.id);

  // 開始イベントの記録
  game.gameEvents.push({
    id: uuid(),
    day: game.currentDay,
    phase: game.currentPhase,
    type: "PHASE_CHANGE",
    description: "ゲームが開始されました",
    timestamp: new Date().toISOString(),
  });

  // 初期フェーズのタイマーを設定
  scheduleNextPhase(game);

  logger.info("Game initialized", { gameId: game.id, playerCount: game.players.length });
};

// ヘルパー関数
export function _getNextPhase(currentPhase: GamePhase): GamePhase {
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

function _getPhaseTime(phase: GamePhase, game: Game): number {
  switch (phase) {
    case "DAY_DISCUSSION":
      return game.settings.dayTimeSeconds;
    case "DAY_VOTE":
      return game.settings.voteTimeSeconds;
    case "NIGHT":
      return game.settings.nightTimeSeconds;
    default:
      return game.settings.dayTimeSeconds;
  }
}

function calculateMinPlayers(settings: Game["settings"]): number {
  return settings.roles.werewolfCount +
    settings.roles.seerCount +
    settings.roles.bodyguardCount +
    settings.roles.mediumCount + 1; // 最低1人の村人が必要
}

function validateRoleSettings(game: Game): void {
  const totalSpecialRoles = game.settings.roles.werewolfCount +
    game.settings.roles.seerCount +
    game.settings.roles.bodyguardCount +
    game.settings.roles.mediumCount;

  if (totalSpecialRoles >= game.players.length) {
    throw new Error("Too many special roles for the number of players");
  }

  if (game.settings.roles.werewolfCount < 1) {
    throw new Error("At least 1 werewolf is required");
  }
}

function countRoles(roles: Role[]): Record<Role, number> {
  return roles.reduce((acc, role) => {
    acc[role] = (acc[role] || 0) + 1;
    return acc;
  }, {} as Record<Role, number>);
}

// 型安全なアクセスのためのユーティリティ関数
export function getActionMap(
  game: Game,
  key: `vote_${number}` | `attack_${number}` | `divine_${number}` | `guard_${number}`,
): Map<string, string> {
  game[key] = game[key] || new Map<string, string>();
  return game[key];
}

// 投票結果の処理と処刑の実行
const _processVoteResults = (game: Game): void => {
  const voteKey = `vote_${game.currentDay}` as const;
  const votes = getActionMap(game, voteKey);

  logger.info("Processing vote results", {
    gameId: game.id,
    day: game.currentDay,
    votes: Array.from(votes.entries()),
  });

  if (!votes || votes.size === 0) {
    logger.warn("No votes to process", { gameId: game.id, day: game.currentDay });
    return;
  }

  // 投票集計
  const voteCount = _getVoteDistribution(votes);
  const executedPlayerId = _getMostVotedPlayer(voteCount);

  if (executedPlayerId) {
    logger.info("Executing player", {
      gameId: game.id,
      playerId: executedPlayerId,
      voteCount: voteCount.get(executedPlayerId),
    });
    _killPlayer(game, executedPlayerId, "EXECUTION");
  }
};

// 夜のアクション結果の処理
const _processNightActions = (game: Game): void => {
  const attackKey = `attack_${game.currentDay}` as const;
  const guardKey = `guard_${game.currentDay}` as const;

  const attacks = getActionMap(game, attackKey);
  const guards = getActionMap(game, guardKey);

  if (!attacks || attacks.size === 0) {
    return;
  }

  // 襲撃先を集計
  const attackCount = _getVoteDistribution(attacks);
  const attackedPlayerId = _getMostVotedPlayer(attackCount);

  if (attackedPlayerId) {
    // 護衛の確認
    const isGuarded = Array.from(guards?.values() || []).includes(attackedPlayerId);

    if (!isGuarded) {
      _killPlayer(game, attackedPlayerId, "WEREWOLF_ATTACK");
    }
  }
};

// アクション結果の集計
function _summarizeActions(game: Game) {
  const actionSummary = {
    totalVotes: 0,
    totalAttacks: 0,
    totalDivinations: 0,
    totalGuards: 0,
  };

  const voteKey = `vote_${game.currentDay}` as const;
  const attackKey = `attack_${game.currentDay}` as const;
  const divineKey = `divine_${game.currentDay}` as const;
  const guardKey = `guard_${game.currentDay}` as const;

  actionSummary.totalVotes = getActionMap(game, voteKey).size;
  actionSummary.totalAttacks = getActionMap(game, attackKey).size;
  actionSummary.totalDivinations = getActionMap(game, divineKey).size;
  actionSummary.totalGuards = getActionMap(game, guardKey).size;

  return actionSummary;
}

// 投票先の分布を取得
function _getVoteDistribution(votes: Map<string, string>): Map<string, number> {
  const distribution = new Map<string, number>();
  votes.forEach((targetId) => {
    distribution.set(targetId, (distribution.get(targetId) || 0) + 1);
  });
  return distribution;
}

// 最多得票者を取得（同数の場合はランダム）
function _getMostVotedPlayer(voteDistribution: Map<string, number>): string | null {
  let maxVotes = 0;
  const maxVotedPlayers: string[] = [];

  voteDistribution.forEach((votes, playerId) => {
    if (votes > maxVotes) {
      maxVotes = votes;
      maxVotedPlayers.length = 0;
      maxVotedPlayers.push(playerId);
    } else if (votes === maxVotes) {
      maxVotedPlayers.push(playerId);
    }
  });

  if (maxVotedPlayers.length === 0) {
    return null;
  }

  // 同数の場合はランダムに選択
  return maxVotedPlayers[Math.floor(Math.random() * maxVotedPlayers.length)];
}

// プレイヤーの死亡処理
function _killPlayer(game: Game, playerId: string, cause: "WEREWOLF_ATTACK" | "EXECUTION"): void {
  const player = game.players.find((p) => p.playerId === playerId);
  if (player && player.isAlive) {
    player.isAlive = false;
    player.deathDay = game.currentDay;
    player.deathCause = cause;

    const causeText = cause === "WEREWOLF_ATTACK" ? "人狼に襲撃" : "処刑";

    logger.info(`Player ${causeText}ed`, {
      gameId: game.id,
      playerId: player.playerId,
      username: player.username,
      role: player.role,
      cause,
    });

    game.gameEvents.push({
      id: uuid(),
      day: game.currentDay,
      phase: game.currentPhase || "NIGHT",
      type: "PHASE_CHANGE",
      description: `${player.username}が${causeText}されました`,
      timestamp: new Date().toISOString(),
    });
  }
}

export function handlePhaseEnd(game: Game): void {
  if (!game) return;

  logger.info("Handling phase end", {
    gameId: game.id,
    currentPhase: game.currentPhase,
    currentDay: game.currentDay,
  });

  // まず現在のフェーズのアクションを処理
  switch (game.currentPhase) {
    case "DAY_VOTE":
      // 投票の処理
      gameActions.processPhaseActions(game);
      _processVoteResults(game);
      break;
    case "NIGHT":
      // 夜アクションの処理
      _processNightActions(game);
      gameActions.processPhaseActions(game);
      break;
    default:
      // その他のフェーズではアクションの同期のみ
      gameActions.processPhaseActions(game);
      break;
  }

  // 勝敗判定（各フェーズの処理後）
  const { isEnded, winner } = checkGameEnd(game);
  if (isEnded) {
    game.status = "FINISHED";
    game.winner = winner;
    logger.info("Game ended during phase end", {
      gameId: game.id,
      winner,
      phase: game.currentPhase,
    });
    game.gameEvents.push({
      id: uuid(),
      day: game.currentDay,
      phase: game.currentPhase,
      type: "GAME_END",
      description: `ゲームが終了しました。${winner === "VILLAGERS" ? "村人" : "人狼"}陣営の勝利です。`,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // フェーズの更新
  const nextPhase = _getNextPhase(game.currentPhase);
  game.currentPhase = nextPhase;

  // 次のフェーズの準備
  switch (nextPhase) {
    case "DAY_VOTE":
    case "NIGHT":
      // アクション状態の初期化を同期的に実行
      gameActions.initializeGameActions(game.id);
      game.phaseEndTime = new Date(Date.now() + _getPhaseTime(nextPhase, game) * 1000).toISOString();

      logger.info("Phase actions initialized", {
        gameId: game.id,
        phase: nextPhase,
        hasActions: gameActions.getGameActions(game.id) !== undefined,
      });
      break;
    case "DAY_DISCUSSION":
      game.currentDay += 1;
      game.phaseEndTime = new Date(Date.now() + _getPhaseTime(nextPhase, game) * 1000).toISOString();
      break;
  }

  // フェーズ変更イベントの記録
  game.gameEvents.push({
    id: uuid(),
    day: game.currentDay,
    phase: game.currentPhase,
    type: "PHASE_CHANGE",
    description: getPhaseChangeDescription(game.currentPhase, game.currentDay),
    timestamp: new Date().toISOString(),
  });

  logger.info("Phase end completed", {
    gameId: game.id,
    newPhase: game.currentPhase,
    currentDay: game.currentDay,
  });
}
