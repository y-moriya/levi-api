import { Game, GamePhase, Role } from '../types/game.ts';
import { uuid } from "https://deno.land/x/uuid@v0.1.2/mod.ts";
import { logger } from '../utils/logger.ts';
import { scheduleNextPhase } from './game-phase.ts';
import * as gameActions from "./game-actions.ts";

// 役職をランダムに割り当てる
export const assignRoles = (game: Game): void => {
  const players = [...game.players];
  const roles: Role[] = [];
  const settings = game.settings;
  
  // 役職リストを作成
  for (let i = 0; i < settings.roles.werewolfCount; i++) {
    roles.push('WEREWOLF');
  }
  
  for (let i = 0; i < settings.roles.seerCount; i++) {
    roles.push('SEER');
  }
  
  for (let i = 0; i < settings.roles.bodyguardCount; i++) {
    roles.push('BODYGUARD');
  }
  
  for (let i = 0; i < settings.roles.mediumCount; i++) {
    roles.push('MEDIUM');
  }
  
  // 残りは村人
  const villagerCount = players.length - roles.length;
  for (let i = 0; i < villagerCount; i++) {
    roles.push('VILLAGER');
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
  logger.info('Roles assigned to players', { gameId: game.id, roleDistribution: countRoles(roles) });
};

// ゲームの勝敗判定
export const checkGameEnd = (game: Game): { isEnded: boolean, winner: 'VILLAGERS' | 'WEREWOLVES' | 'NONE' } => {
  const alivePlayers = game.players.filter(p => p.isAlive);
  const aliveWerewolves = alivePlayers.filter(p => p.role === 'WEREWOLF');
  
  // 人狼が全滅した場合、村人の勝利
  if (aliveWerewolves.length === 0) {
    return { isEnded: true, winner: 'VILLAGERS' };
  }
  
  // 人狼の数が村人陣営の数以上になった場合、人狼の勝利
  const aliveVillagers = alivePlayers.filter(p => p.role !== 'WEREWOLF');
  if (aliveWerewolves.length >= aliveVillagers.length) {
    return { isEnded: true, winner: 'WEREWOLVES' };
  }
  
  return { isEnded: false, winner: 'NONE' };
};

// フェーズを進める
export const advancePhase = (game: Game): void => {
  // 現在のフェーズのアクション確認
  if (game.currentPhase === "DAY_VOTE") {
    gameActions.processPhaseActions(game);
    _processVoteResults(game);
  } else if (game.currentPhase === "NIGHT") {
    gameActions.processPhaseActions(game);
    _processNightActions(game);
  }

  // 勝敗判定
  const { isEnded, winner } = checkGameEnd(game);
  if (isEnded) {
    game.status = "FINISHED";
    game.winner = winner;
    game.gameEvents.push({
      id: uuid(),
      day: game.currentDay,
      phase: game.currentPhase || 'GAME_OVER',
      type: "GAME_END",
      description: `ゲームが終了しました。${winner === "VILLAGERS" ? "村人" : "人狼"}陣営の勝利です。`,
      timestamp: new Date().toISOString()
    });
    return;
  }

  // フェーズ進行
  switch (game.currentPhase) {
    case "DAY_DISCUSSION":
      game.currentPhase = "DAY_VOTE";
      game.phaseEndTime = new Date(Date.now() + game.settings.voteTimeSeconds * 1000).toISOString();
      break;
    case "DAY_VOTE":
      game.currentPhase = "NIGHT";
      game.phaseEndTime = new Date(Date.now() + game.settings.nightTimeSeconds * 1000).toISOString();
      break;
    case "NIGHT":
      game.currentDay += 1;
      game.currentPhase = 'DAY_DISCUSSION';
      game.phaseEndTime = new Date(Date.now() + game.settings.dayTimeSeconds * 1000).toISOString();
      break;
  }

  // ゲームイベントを記録
  game.gameEvents.push({
    id: uuid(),
    day: game.currentDay,
    phase: game.currentPhase || 'GAME_OVER',
    type: "PHASE_CHANGE",
    description: `フェーズが${game.currentPhase}に変更されました`,
    timestamp: new Date().toISOString()
  });
};

// ゲーム開始時の初期化
export const initializeGame = (game: Game): void => {
  if (game.status !== 'WAITING') {
    throw new Error('Game is not in waiting state');
  }
  
  // プレイヤー数チェック
  const minPlayers = calculateMinPlayers(game.settings);
  if (game.players.length < minPlayers) {
    throw new Error(`At least ${minPlayers} players are required`);
  }
  
  // 役職数の妥当性チェック
  validateRoleSettings(game);
  
  // ゲーム状態の初期化
  game.status = 'IN_PROGRESS';
  game.currentDay = 1;
  game.currentPhase = 'DAY_DISCUSSION';
  game.phaseEndTime = new Date(Date.now() + game.settings.dayTimeSeconds * 1000).toISOString();
  game.winner = 'NONE';
  
  // 役職の割り当て
  assignRoles(game);

  // アクション状態の初期化
  import('../services/game-actions.ts').then(gameActions => {
    gameActions.initializeGameActions(game.id);
  });
  
  // 開始イベントの記録
  game.gameEvents.push({
    id: uuid(),
    day: game.currentDay,
    phase: game.currentPhase,
    type: 'PHASE_CHANGE',
    description: 'ゲームが開始されました',
    timestamp: new Date().toISOString()
  });

  // 初期フェーズのタイマーを設定
  scheduleNextPhase(game);
  
  logger.info('Game initialized', { gameId: game.id, playerCount: game.players.length });
};

// ヘルパー関数
function _getNextPhase(currentPhase: GamePhase): GamePhase {
  switch (currentPhase) {
    case 'DAY_DISCUSSION':
      return 'DAY_VOTE';
    case 'DAY_VOTE':
      return 'NIGHT';
    case 'NIGHT':
      return 'DAY_DISCUSSION';
    default:
      return 'DAY_DISCUSSION';
  }
}

function _getPhaseTime(phase: GamePhase, game: Game): number {
  switch (phase) {
    case 'DAY_DISCUSSION':
      return game.settings.dayTimeSeconds;
    case 'DAY_VOTE':
      return game.settings.voteTimeSeconds;
    case 'NIGHT':
      return game.settings.nightTimeSeconds;
    default:
      return game.settings.dayTimeSeconds;
  }
}

function calculateMinPlayers(settings: Game['settings']): number {
  return settings.roles.werewolfCount + 
         settings.roles.seerCount + 
         settings.roles.bodyguardCount + 
         settings.roles.mediumCount + 1; // 最低1人の村人が必要
}

function validateRoleSettings(game: Game): void {
  const totalSpecialRoles = 
    game.settings.roles.werewolfCount +
    game.settings.roles.seerCount +
    game.settings.roles.bodyguardCount +
    game.settings.roles.mediumCount;
    
  if (totalSpecialRoles >= game.players.length) {
    throw new Error('Too many special roles for the number of players');
  }
  
  if (game.settings.roles.werewolfCount < 1) {
    throw new Error('At least 1 werewolf is required');
  }
}

function countRoles(roles: Role[]): Record<Role, number> {
  return roles.reduce((acc, role) => {
    acc[role] = (acc[role] || 0) + 1;
    return acc;
  }, {} as Record<Role, number>);
}

// 型安全なアクセスのためのユーティリティ関数
function getActionMap(game: Game, key: `vote_${number}` | `attack_${number}` | `divine_${number}` | `guard_${number}`): Map<string, string> {
  game[key] = game[key] || new Map<string, string>();
  return game[key];
}

// 投票結果の処理と処刑の実行
const _processVoteResults = (game: Game): void => {
  const voteKey = `vote_${game.currentDay}` as const;
  const votes = getActionMap(game, voteKey);
  
  if (!votes || votes.size === 0) {
    return;
  }

  // 投票集計
  const voteCount = _getVoteDistribution(votes);
  const executedPlayerId = _getMostVotedPlayer(voteCount);

  if (executedPlayerId) {
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
    totalGuards: 0
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
function _killPlayer(game: Game, playerId: string, cause: 'WEREWOLF_ATTACK' | 'EXECUTION'): void {
  const player = game.players.find(p => p.playerId === playerId);
  if (player && player.isAlive) {
    player.isAlive = false;
    player.deathDay = game.currentDay;
    player.deathCause = cause;

    const causeText = cause === 'WEREWOLF_ATTACK' ? '人狼に襲撃' : '処刑';
    
    logger.info(`Player ${causeText}ed`, {
      gameId: game.id,
      playerId: player.playerId,
      username: player.username,
      role: player.role,
      cause
    });

    game.gameEvents.push({
      id: uuid(),
      day: game.currentDay,
      phase: game.currentPhase || 'NIGHT',
      type: 'PHASE_CHANGE',
      description: `${player.username}が${causeText}されました`,
      timestamp: new Date().toISOString()
    });
  }
}

export function handlePhaseEnd(game: Game): void {
  if (!game) return;

  // フェーズ終了時の処理
  gameActions.processPhaseActions(game);

  // フェーズを更新
  advancePhase(game);
}