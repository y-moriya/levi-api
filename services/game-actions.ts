import { Game, ActionResult, DivineResult } from '../types/game.ts';
import { logger } from '../utils/logger.ts';

// ゲームごとのアクション状態を管理
const gameActions = new Map<string, {
  votes: Map<string, string>;
  attacks: Map<string, string>;
  divines: Map<string, string>;
  guards: Map<string, string>;
}>();

/**
 * Reset all game actions (for testing)
 */
export function resetGameActions(): void {
  gameActions.clear();
  logger.info('Game actions reset');
}

/**
 * ゲームのアクション状態を初期化
 */
export function initializeGameActions(gameId: string): void {
  // 既存のアクション状態をクリア
  if (gameActions.has(gameId)) {
    gameActions.delete(gameId);
  }

  // 新しいアクション状態を設定
  const newActions = {
    votes: new Map<string, string>(),
    attacks: new Map<string, string>(),
    divines: new Map<string, string>(),
    guards: new Map<string, string>(),
  };
  gameActions.set(gameId, newActions);

  // アクション状態が正しく初期化されたことを確認
  const actions = gameActions.get(gameId);
  if (!actions) {
    throw new Error(`Failed to initialize game actions for game ${gameId}`);
  }

  logger.info('Game actions initialized', { gameId });
}

/**
 * 投票アクションを処理
 */
export function handleVoteAction(game: Game, playerId: string, targetId: string): ActionResult {
  logger.info('Handling vote action', {
    gameId: game.id,
    currentPhase: game.currentPhase,
    currentDay: game.currentDay,
    playerId,
    targetId
  });

  if (game.currentPhase !== 'DAY_VOTE') {
    logger.warn('Invalid phase for voting', {
      gameId: game.id,
      expectedPhase: 'DAY_VOTE',
      actualPhase: game.currentPhase
    });
    return { success: false, message: '投票フェーズではありません' };
  }

  const player = game.players.find(p => p.playerId === playerId);
  const target = game.players.find(p => p.playerId === targetId);

  if (!player?.isAlive || !target?.isAlive) {
    logger.warn('Dead player involved in vote', {
      gameId: game.id,
      playerAlive: player?.isAlive,
      targetAlive: target?.isAlive
    });
    return { success: false, message: '死亡したプレイヤーは投票できません/投票対象にできません' };
  }

  const actions = gameActions.get(game.id);
  if (!actions) {
    logger.error('Game actions not initialized', undefined, { gameId: game.id });
    return { success: false, message: 'ゲームのアクション状態が初期化されていません' };
  }

  // アクション状態とゲーム状態の両方に投票を記録
  const voteKey = `vote_${game.currentDay}` as const;
  game[voteKey] = game[voteKey] || new Map<string, string>();
  actions.votes.set(playerId, targetId);
  game[voteKey].set(playerId, targetId);

  logger.info('Vote recorded', {
    gameId: game.id,
    playerId,
    targetId,
    currentVotes: Array.from(actions.votes.entries())
  });

  return { success: true, message: '投票が受け付けられました' };
}

/**
 * 襲撃アクションを処理
 */
export function handleAttackAction(game: Game, playerId: string, targetId: string): ActionResult {
  if (game.currentPhase !== 'NIGHT') {
    return { success: false, message: '夜フェーズではありません' };
  }

  const player = game.players.find(p => p.playerId === playerId);
  const target = game.players.find(p => p.playerId === targetId);

  if (!player?.isAlive || !target?.isAlive) {
    return { success: false, message: '死亡したプレイヤーは襲撃できません/襲撃対象にできません' };
  }

  if (player.role !== 'WEREWOLF') {
    return { success: false, message: '人狼以外は襲撃できません' };
  }

  if (target.role === 'WEREWOLF') {
    return { success: false, message: '人狼を襲撃することはできません' };
  }

  const actions = gameActions.get(game.id);
  if (!actions) {
    return { success: false, message: 'ゲームのアクション状態が初期化されていません' };
  }

  // アクション状態とゲーム状態の両方に記録
  const attackKey = `attack_${game.currentDay}` as const;
  game[attackKey] = game[attackKey] || new Map<string, string>();
  actions.attacks.set(playerId, targetId);
  game[attackKey].set(playerId, targetId);

  return { success: true, message: '襲撃が受け付けられました' };
}

/**
 * 占いアクションを処理
 */
export function handleDivineAction(game: Game, playerId: string, targetId: string): DivineResult {
  if (game.currentPhase !== 'NIGHT') {
    return { 
      success: false, 
      message: '夜フェーズではありません',
      targetPlayerId: targetId,
      targetUsername: '',
      isWerewolf: false
    };
  }

  const player = game.players.find(p => p.playerId === playerId);
  const target = game.players.find(p => p.playerId === targetId);

  if (!player?.isAlive || !target?.isAlive) {
    return { 
      success: false, 
      message: '死亡したプレイヤーは占えません/占い対象にできません',
      targetPlayerId: targetId,
      targetUsername: target?.username || '',
      isWerewolf: false
    };
  }

  if (player.role !== 'SEER') {
    return { 
      success: false, 
      message: '占い師以外は占うことができません',
      targetPlayerId: targetId,
      targetUsername: target.username,
      isWerewolf: false
    };
  }

  const actions = gameActions.get(game.id);
  if (!actions) {
    return { 
      success: false, 
      message: 'ゲームのアクション状態が初期化されていません',
      targetPlayerId: targetId,
      targetUsername: target.username,
      isWerewolf: false
    };
  }

  // アクション状態とゲーム状態の両方に記録
  const divineKey = `divine_${game.currentDay}` as const;
  game[divineKey] = game[divineKey] || new Map<string, string>();
  actions.divines.set(playerId, targetId);
  game[divineKey].set(playerId, targetId);

  return { 
    success: true, 
    message: '占いが受け付けられました',
    targetPlayerId: targetId,
    targetUsername: target.username,
    isWerewolf: target.role === 'WEREWOLF'
  };
}

/**
 * 護衛アクションを処理
 */
export function handleGuardAction(game: Game, playerId: string, targetId: string): ActionResult {
  if (game.currentPhase !== 'NIGHT') {
    return { success: false, message: '夜フェーズではありません' };
  }

  const player = game.players.find(p => p.playerId === playerId);
  const target = game.players.find(p => p.playerId === targetId);

  if (!player?.isAlive || !target?.isAlive) {
    return { success: false, message: '死亡したプレイヤーは護衛できません/護衛対象にできません' };
  }

  if (player.role !== 'BODYGUARD') {
    return { success: false, message: '狩人以外は護衛できません' };
  }

  const actions = gameActions.get(game.id);
  if (!actions) {
    return { success: false, message: 'ゲームのアクション状態が初期化されていません' };
  }

  // アクション状態とゲーム状態の両方に記録
  const guardKey = `guard_${game.currentDay}` as const;
  game[guardKey] = game[guardKey] || new Map<string, string>();
  actions.guards.set(playerId, targetId);
  game[guardKey].set(playerId, targetId);

  return { success: true, message: '護衛が受け付けられました' };
}

/**
 * アクション未実行のプレイヤーにランダムアクションを割り当て
 */
function assignRandomActions(game: Game): void {
  const actions = gameActions.get(game.id);
  if (!actions) return;

  const alivePlayers = game.players.filter(p => p.isAlive);
  
  if (game.currentPhase === 'DAY_VOTE') {
    // 投票していないプレイヤーにランダム投票を割り当て
    alivePlayers.forEach(player => {
      if (!actions.votes.has(player.playerId)) {
        const possibleTargets = alivePlayers.filter(p => p.playerId !== player.playerId);
        if (possibleTargets.length > 0) {
          const target = possibleTargets[Math.floor(Math.random() * possibleTargets.length)];
          actions.votes.set(player.playerId, target.playerId);
          logger.info('Random vote assigned', { 
            gameId: game.id, 
            playerId: player.playerId, 
            targetId: target.playerId 
          });
        }
      }
    });
  } else if (game.currentPhase === 'NIGHT') {
    // 夜アクションを実行していない役職にランダムターゲットを割り当て
    alivePlayers.forEach(player => {
      const possibleTargets = alivePlayers.filter(p => p.playerId !== player.playerId);
      
      switch (player.role) {
        case 'WEREWOLF':
          if (!actions.attacks.has(player.playerId) && possibleTargets.length > 0) {
            const nonWerewolfTargets = possibleTargets.filter(p => p.role !== 'WEREWOLF');
            if (nonWerewolfTargets.length > 0) {
              const target = nonWerewolfTargets[Math.floor(Math.random() * nonWerewolfTargets.length)];
              actions.attacks.set(player.playerId, target.playerId);
              logger.info('Random attack assigned', { 
                gameId: game.id, 
                playerId: player.playerId, 
                targetId: target.playerId 
              });
            }
          }
          break;
          
        case 'SEER':
          if (!actions.divines.has(player.playerId) && possibleTargets.length > 0) {
            const target = possibleTargets[Math.floor(Math.random() * possibleTargets.length)];
            actions.divines.set(player.playerId, target.playerId);
            logger.info('Random divine assigned', { 
              gameId: game.id, 
              playerId: player.playerId, 
              targetId: target.playerId 
            });
          }
          break;
          
        case 'BODYGUARD':
          if (!actions.guards.has(player.playerId) && possibleTargets.length > 0) {
            const target = possibleTargets[Math.floor(Math.random() * possibleTargets.length)];
            actions.guards.set(player.playerId, target.playerId);
            logger.info('Random guard assigned', { 
              gameId: game.id, 
              playerId: player.playerId, 
              targetId: target.playerId 
            });
          }
          break;
      }
    });
  }
}

/**
 * フェーズのアクションを処理
 */
export function processPhaseActions(game: Game): void {
  const actions = gameActions.get(game.id);
  if (!actions) return;

  // アクション結果をゲーム状態に反映
  const voteKey = `vote_${game.currentDay}` as const;
  const votes = game[voteKey] = game[voteKey] || new Map<string, string>();

  if (game.currentPhase === 'DAY_VOTE') {
    // 全プレイヤーが投票済みかチェック
    const livingPlayers = game.players.filter(p => p.isAlive);
    const hasAllVoted = livingPlayers.every(p => actions.votes.has(p.playerId));

    // 未投票のプレイヤーがいる場合のみランダムアクションを割り当て
    if (!hasAllVoted) {
      assignRandomActions(game);
    }

    // アクション状態をゲームの状態に同期
    votes.clear();
    actions.votes.forEach((targetId, playerId) => {
      votes.set(playerId, targetId);
    });

    // アクション状態をリセット（同期後に実行）
    actions.votes.clear();
  } else if (game.currentPhase === 'NIGHT') {
    // 夜アクションをゲーム状態に同期
    const attackKey = `attack_${game.currentDay}` as const;
    const divineKey = `divine_${game.currentDay}` as const;
    const guardKey = `guard_${game.currentDay}` as const;

    const attacks = game[attackKey] = game[attackKey] || new Map<string, string>();
    const divines = game[divineKey] = game[divineKey] || new Map<string, string>();
    const guards = game[guardKey] = game[guardKey] || new Map<string, string>();

    // まずゲーム状態に同期
    attacks.clear();
    divines.clear();
    guards.clear();

    actions.attacks.forEach((targetId, playerId) => {
      attacks.set(playerId, targetId);
    });
    actions.divines.forEach((targetId, playerId) => {
      divines.set(playerId, targetId);
    });
    actions.guards.forEach((targetId, playerId) => {
      guards.set(playerId, targetId);
    });

    // アクション状態をリセット（同期後に実行）
    actions.attacks.clear();
    actions.divines.clear();
    actions.guards.clear();
  }
}

/**
 * ゲームのアクション状態を取得
 */
export function getGameActions(gameId: string) {
  return gameActions.get(gameId);
}