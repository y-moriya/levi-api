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
 * ゲームのアクション状態を初期化
 */
export function initializeGameActions(gameId: string): void {
  gameActions.set(gameId, {
    votes: new Map(),
    attacks: new Map(),
    divines: new Map(),
    guards: new Map(),
  });
  logger.info('Game actions initialized', { gameId });
}

/**
 * 投票アクションを処理
 */
export function handleVoteAction(game: Game, playerId: string, targetId: string): ActionResult {
  if (game.currentPhase !== 'DAY_VOTE') {
    return { success: false, message: '投票フェーズではありません' };
  }

  const player = game.players.find(p => p.playerId === playerId);
  const target = game.players.find(p => p.playerId === targetId);

  if (!player?.isAlive || !target?.isAlive) {
    return { success: false, message: '死亡したプレイヤーは投票できません/投票対象にできません' };
  }

  const actions = gameActions.get(game.id);
  if (!actions) {
    return { success: false, message: 'ゲームのアクション状態が初期化されていません' };
  }

  actions.votes.set(playerId, targetId);
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

  actions.attacks.set(playerId, targetId);
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

  actions.divines.set(playerId, targetId);
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

  actions.guards.set(playerId, targetId);
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

  // ランダムアクションの割り当て
  assignRandomActions(game);

  if (game.currentPhase === 'DAY_VOTE') {
    // 投票結果の集計
    const voteCounts = new Map<string, number>();
    actions.votes.forEach((targetId) => {
      voteCounts.set(targetId, (voteCounts.get(targetId) || 0) + 1);
    });

    // 最多得票者を処刑
    let maxVotes = 0;
    let executedId: string | null = null;
    voteCounts.forEach((count, playerId) => {
      if (count > maxVotes) {
        maxVotes = count;
        executedId = playerId;
      }
    });

    if (executedId) {
      const executed = game.players.find(p => p.playerId === executedId);
      if (executed) {
        executed.isAlive = false;
        executed.deathCause = 'EXECUTION';
        executed.deathDay = game.currentDay;
        logger.info('Player executed', { 
          gameId: game.id, 
          playerId: executedId, 
          votes: maxVotes 
        });
      }
    }

    // 投票をリセット
    actions.votes.clear();

  } else if (game.currentPhase === 'NIGHT') {
    // 護衛対象を記録
    const guardedPlayers = new Set(actions.guards.values());
    
    // 襲撃の処理
    actions.attacks.forEach((targetId) => {
      if (!guardedPlayers.has(targetId)) {
        const target = game.players.find(p => p.playerId === targetId);
        if (target?.isAlive) {
          target.isAlive = false;
          target.deathCause = 'WEREWOLF_ATTACK';
          target.deathDay = game.currentDay;
          logger.info('Player killed', { 
            gameId: game.id, 
            playerId: targetId 
          });
        }
      } else {
        logger.info('Player protected from attack', { 
          gameId: game.id, 
          playerId: targetId 
        });
      }
    });

    // 夜アクションをリセット
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