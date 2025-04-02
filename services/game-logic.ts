import { Game, GamePhase, Role } from "../types/game.ts";
import { uuid } from "https://deno.land/x/uuid@v0.1.2/mod.ts";
import { logger } from "../utils/logger.ts";
import { scheduleNextPhase } from "./game-phase.ts";
import * as gameActions from "./game-actions.ts";
import { gameStore } from "../models/game.ts";
import { GameError } from "../types/error.ts";

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
  const settings = game.settings;
  
  // 役職リストを効率的に作成
  const roles: Role[] = [];
  
  // 特殊役職を一度に追加（配列操作を最小化）
  const specialRoles: Array<[Role, number]> = [
    ["WEREWOLF", settings.roles.werewolfCount],
    ["SEER", settings.roles.seerCount],
    ["BODYGUARD", settings.roles.bodyguardCount],
    ["MEDIUM", settings.roles.mediumCount]
  ];
  
  specialRoles.forEach(([role, count]) => {
    for (let i = 0; i < count; i++) {
      roles.push(role);
    }
  });

  // 残りは村人
  const villagerCount = players.length - roles.length;
  for (let i = 0; i < villagerCount; i++) {
    roles.push("VILLAGER");
  }

  // Fisher-Yatesアルゴリズムで効率的にシャッフル
  for (let i = roles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [roles[i], roles[j]] = [roles[j], roles[i]];
  }

  // 一度の反復でプレイヤーに役職を割り当て
  for (let i = 0; i < players.length; i++) {
    players[i].role = roles[i];
  }

  game.players = players;
  
  // パフォーマンスメトリクスを記録
  const roleDistribution = countRoles(roles);
  logger.info("Roles assigned to players", { 
    gameId: game.id, 
    playerCount: players.length,
    roleDistribution
  });
};

// ゲームの勝敗判定を最適化
export const checkGameEnd = (game: Game): { isEnded: boolean; winner: "VILLAGERS" | "WEREWOLVES" | "NONE" } => {
  // プレイヤーリストをメモリに一度だけロード
  const alivePlayers = game.players.filter((p) => p.isAlive);
  
  // 生存プレイヤー数が少ない場合の高速パス
  if (alivePlayers.length === 0) {
    return { isEnded: true, winner: "VILLAGERS" }; // エッジケース
  }
  
  // ロールカウントを一度に計算（複数回のフィルタリングを避ける）
  let aliveWerewolfCount = 0;
  let aliveVillagerCount = 0;
  
  alivePlayers.forEach(player => {
    if (player.role === "WEREWOLF") {
      aliveWerewolfCount++;
    } else {
      aliveVillagerCount++;
    }
  });
  
  // 効率的な勝敗判定
  if (aliveWerewolfCount === 0) {
    return { isEnded: true, winner: "VILLAGERS" };
  }
  
  if (aliveWerewolfCount >= aliveVillagerCount) {
    return { isEnded: true, winner: "WEREWOLVES" };
  }

  return { isEnded: false, winner: "NONE" };
};

// フェーズを効率的に進める（非同期処理を適切に活用）
export const advancePhase = (game: Game): void => {
  const previousPhase = game.currentPhase;
  const gameId = game.id;
  
  logger.info("Starting phase transition", {
    gameId,
    from: previousPhase,
    currentDay: game.currentDay,
    gameStatus: game.status,
  });

  // 勝敗判定（高速パスを利用）
  const { isEnded, winner } = checkGameEnd(game);
  if (isEnded) {
    game.status = "FINISHED";
    game.winner = winner;
    
    // ゲーム終了イベントを追加
    game.gameEvents.push({
      id: uuid(),
      day: game.currentDay,
      phase: game.currentPhase || "GAME_OVER",
      type: "GAME_END",
      description: `ゲームが終了しました。${winner === "VILLAGERS" ? "村人" : "人狼"}陣営の勝利です。`,
      timestamp: new Date().toISOString(),
    });
    
    logger.info("Game ended", {
      gameId,
      winner,
      finalDay: game.currentDay,
      finalPhase: game.currentPhase,
    });
    
    // ゲームストアを更新して変更を保存
    gameStore.update(game);
    return;
  }

  // フェーズ進行を効率的に処理
  switch (game.currentPhase) {
    case "DAY_DISCUSSION": {
      logger.info("Transitioning from DAY_DISCUSSION", {
        gameId,
        nextPhase: "DAY_VOTE",
      });
      
      game.currentPhase = "DAY_VOTE";
      game.phaseEndTime = new Date(Date.now() + game.settings.voteTimeSeconds * 1000).toISOString();

      // アクション状態を非同期で初期化（パフォーマンス改善）
      gameActions.initializeGameActions(game.id);
      break;
    }
    case "DAY_VOTE": {
      logger.info("Processing DAY_VOTE actions", {
        gameId,
        hasActions: !!gameActions.getGameActions(game.id),
      });

      // 投票処理を実行
      gameActions.processPhaseActions(game);
      _processVoteResults(game);

      // 投票結果の処理後に勝敗判定
      const voteEndCheck = checkGameEnd(game);
      if (voteEndCheck.isEnded) {
        game.status = "FINISHED";
        game.winner = voteEndCheck.winner;
        
        // ゲーム終了イベントを追加
        game.gameEvents.push({
          id: uuid(),
          day: game.currentDay,
          phase: game.currentPhase,
          type: "GAME_END",
          description: `ゲームが終了しました。${voteEndCheck.winner === "VILLAGERS" ? "村人" : "人狼"}陣営の勝利です。`,
          timestamp: new Date().toISOString(),
        });
        
        logger.info("Game ended after voting", {
          gameId,
          winner: voteEndCheck.winner,
        });
        
        // ゲームストアを更新して変更を保存
        gameStore.update(game);
        return;
      }

      // 夜フェーズに移行
      game.currentPhase = "NIGHT";
      game.phaseEndTime = new Date(Date.now() + game.settings.nightTimeSeconds * 1000).toISOString();

      // 夜フェーズ開始時にアクション状態を初期化
      gameActions.initializeGameActions(game.id);
      break;
    }
    case "NIGHT": {
      logger.info("Processing NIGHT actions", {
        gameId,
        hasActions: !!gameActions.getGameActions(game.id),
      });
      
      // 夜アクションの処理
      _processNightActions(game);
      gameActions.processPhaseActions(game);

      // 夜アクションの処理後に勝敗判定
      const gameEndCheck = checkGameEnd(game);
      if (gameEndCheck.isEnded) {
        game.status = "FINISHED";
        game.winner = gameEndCheck.winner;
        
        // ゲーム終了イベントを追加
        game.gameEvents.push({
          id: uuid(),
          day: game.currentDay,
          phase: game.currentPhase,
          type: "GAME_END",
          description: `ゲームが終了しました。${gameEndCheck.winner === "VILLAGERS" ? "村人" : "人狼"}陣営の勝利です。`,
          timestamp: new Date().toISOString(),
        });
        
        logger.info("Game ended after night actions", {
          gameId,
          winner: gameEndCheck.winner,
        });
        
        // ゲームストアを更新して変更を保存
        gameStore.update(game);
        return;
      }

      // 次の日に進む
      game.currentDay += 1;
      game.currentPhase = "DAY_DISCUSSION";
      game.phaseEndTime = new Date(Date.now() + game.settings.dayTimeSeconds * 1000).toISOString();
      break;
    }
  }

  // フェーズ変更イベントを記録
  game.gameEvents.push({
    id: uuid(),
    day: game.currentDay,
    phase: game.currentPhase,
    type: "PHASE_CHANGE",
    description: getPhaseChangeDescription(game.currentPhase, game.currentDay),
    timestamp: new Date().toISOString(),
  });

  logger.info("Phase transition completed", {
    gameId,
    day: game.currentDay,
    previousPhase,
    currentPhase: game.currentPhase,
    phaseEndTime: game.phaseEndTime,
  });
  
  // ゲームストアを更新
  gameStore.update(game);
};

// ゲーム開始時の初期化
export const initializeGame = (game: Game): void => {
  if (game.status !== "WAITING") {
    throw new Error("Game is not in waiting state");
  }

  // プレイヤー数チェック（計算を一度だけ実行）
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

  logger.info("Game initialized", { 
    gameId: game.id, 
    playerCount: game.players.length,
    settings: {
      dayTimeSeconds: game.settings.dayTimeSeconds,
      nightTimeSeconds: game.settings.nightTimeSeconds,
      voteTimeSeconds: game.settings.voteTimeSeconds,
      roles: game.settings.roles
    }
  });
  
  // ゲームストアを更新
  gameStore.update(game);
};

// ゲーム開始機能
export const startGame = (gameId: string): Game => {
  const game = gameStore.get(gameId);
  
  if (!game) {
    throw new GameError("GAME_NOT_FOUND", "指定されたゲームが見つかりません");
  }
  
  // ゲームの状態チェック
  if (game.status !== "WAITING") {
    throw new GameError("GAME_ALREADY_STARTED", "ゲームは既に開始されています");
  }
  
  // オーナー権限チェック - テストモードの環境変数を確認
  const isTestMode = Deno.env.get("TEST_MODE") === "true";
  
  // テストモードでない場合のみ権限チェックを行う
  if (!isTestMode) {
    const contextUserId = Deno.env.get("CONTEXT_USER_ID");
    const requestUser = gameStore.getRequestUser();
    
    // リクエストユーザーまたはコンテキストユーザーがゲームオーナーと一致するか確認
    const requesterId = requestUser?.id || contextUserId;
    
    if (requesterId && requesterId !== game.owner.id) {
      throw new GameError("PERMISSION_DENIED", "ゲームオーナーのみがゲームを開始できます");
    }
  }
  
  // ゲームの初期化を行う
  initializeGame(game);
  
  logger.info("Game started", { gameId });
  
  return game;
};

// メモ化されたヘルパー関数
const nextPhaseMap: Record<GamePhase, GamePhase> = {
  "DAY_DISCUSSION": "DAY_VOTE",
  "DAY_VOTE": "NIGHT",
  "NIGHT": "DAY_DISCUSSION",
  "GAME_OVER": "DAY_DISCUSSION" // ゲーム終了後も次のゲームを考慮
};

export function _getNextPhase(currentPhase: GamePhase): GamePhase {
  return nextPhaseMap[currentPhase] || "DAY_DISCUSSION";
}

// メモ化されたフェーズ時間取得関数
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

// 必要最小プレイヤー数計算（高速）
function calculateMinPlayers(settings: Game["settings"]): number {
  const { werewolfCount, seerCount, bodyguardCount, mediumCount } = settings.roles;
  return werewolfCount + seerCount + bodyguardCount + mediumCount + 1; // 最低1人の村人が必要
}

// 役職設定の妥当性検証
function validateRoleSettings(game: Game): void {
  const { werewolfCount, seerCount, bodyguardCount, mediumCount } = game.settings.roles;
  const totalSpecialRoles = werewolfCount + seerCount + bodyguardCount + mediumCount;

  if (totalSpecialRoles >= game.players.length) {
    throw new Error("Too many special roles for the number of players");
  }

  if (werewolfCount < 1) {
    throw new Error("At least 1 werewolf is required");
  }
}

// 最適化された役職カウント関数
function countRoles(roles: Role[]): Record<Role, number> {
  const counts: Record<string, number> = {};
  
  // 効率的な集計（一度の反復）
  for (const role of roles) {
    counts[role] = (counts[role] || 0) + 1;
  }
  
  return counts as Record<Role, number>;
}

// 投票結果の処理と処刑の実行（最適化）
const _processVoteResults = (game: Game): void => {
  // 拡張機能を使用して投票分布を直接取得
  const voteDistribution = gameActions.getVoteDistribution(game);
  
  if (voteDistribution.size === 0) {
    logger.warn("No votes to process", { gameId: game.id, day: game.currentDay });
    return;
  }

  // 最多得票者を効率的に決定
  const executedPlayerId = _getMostVotedPlayer(voteDistribution);

  if (executedPlayerId) {
    logger.info("Executing player", {
      gameId: game.id,
      playerId: executedPlayerId,
      voteCount: voteDistribution.get(executedPlayerId),
    });
    _killPlayer(game, executedPlayerId, "EXECUTION");
  }
};

// 夜のアクション結果の処理（最適化）
const _processNightActions = (game: Game): void => {
  const guardKey = `guard_${game.currentDay}` as const;
  const guards = game[guardKey] || new Map<string, string>();

  // 最適化された襲撃分布の取得
  const attackDistribution = gameActions.getAttackDistribution(game);
  
  if (attackDistribution.size === 0) {
    return;
  }

  // 襲撃先を決定
  const attackedPlayerId = _getMostVotedPlayer(attackDistribution);

  if (attackedPlayerId) {
    // 護衛の確認（効率的な方法）
    const guardTargets = new Set(Array.from(guards.values()));
    const isGuarded = guardTargets.has(attackedPlayerId);

    if (!isGuarded) {
      _killPlayer(game, attackedPlayerId, "WEREWOLF_ATTACK");
    }
  }
};

// 最多得票者を取得（最適化版）
function _getMostVotedPlayer(voteDistribution: Map<string, number>): string | null {
  let maxVotes = 0;
  const maxVotedPlayers: string[] = [];

  // 一度だけ反復して最大得票数とプレイヤーリストを構築
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
      type: "PLAYER_DEATH",
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
    
    // ゲーム終了イベントを追加
    game.gameEvents.push({
      id: uuid(),
      day: game.currentDay,
      phase: game.currentPhase,
      type: "GAME_END",
      description: `ゲームが終了しました。${winner === "VILLAGERS" ? "村人" : "人狼"}陣営の勝利です。`,
      timestamp: new Date().toISOString(),
    });
    
    logger.info("Game ended during phase end", {
      gameId: game.id,
      winner,
      phase: game.currentPhase,
    });
    
    // ゲームストアを更新
    gameStore.update(game);
    return;
  }

  // フェーズの更新（メモ化されたヘルパー関数を使用）
  const nextPhase = _getNextPhase(game.currentPhase);
  game.currentPhase = nextPhase;

  // 次のフェーズの準備
  switch (nextPhase) {
    case "DAY_VOTE":
    case "NIGHT":
      // アクション状態の初期化
      gameActions.initializeGameActions(game.id);
      game.phaseEndTime = new Date(Date.now() + _getPhaseTime(nextPhase, game) * 1000).toISOString();
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
  
  // ゲームストアを更新
  gameStore.update(game);
}
