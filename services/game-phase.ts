import { Game, GamePhase } from '../types/game.ts';
import { logger } from '../utils/logger.ts';
import { checkGameEnd } from './game-logic.ts';
import { advancePhase } from "./game-logic.ts";

// アクション用のユーティリティ関数
function getActionMap(game: Game, key: `vote_${number}` | `attack_${number}` | `divine_${number}` | `guard_${number}`): Map<string, string> {
  game[key] = game[key] || new Map<string, string>();
  return game[key];
}

// フェーズタイマーの管理用マップ
const phaseTimers: Map<string, number> = new Map();

/**
 * フェーズタイマーの設定
 */
export const scheduleNextPhase = (game: Game): void => {
  // 既存のタイマーがあれば削除
  clearPhaseTimer(game.id);

  // フェーズ終了時刻からタイマー時間を計算
  const phaseEndTime = new Date(game.phaseEndTime!).getTime();
  const currentTime = Date.now();
  const timeoutMs = phaseEndTime - currentTime;

  // タイマーを設定
  const timerId = setTimeout(() => {
    // タイマー実行時にゲームが終了していないことを確認
    if (game.status !== "IN_PROGRESS") {
      return;
    }

    // フェーズを進める
    advancePhase(game);

    // 次のフェーズのタイマーを設定
    if (game.status === "IN_PROGRESS") {
      scheduleNextPhase(game);
    }
  }, timeoutMs);

  // タイマーIDを保存
  phaseTimers.set(game.id, timerId);

  logger.info('Phase timer scheduled', {
    gameId: game.id,
    phase: game.currentPhase,
    endTime: game.phaseEndTime,
    timeoutMs
  });
}

/**
 * フェーズタイマーのクリア
 */
export const clearPhaseTimer = (gameId: string): void => {
  const timerId = phaseTimers.get(gameId);
  if (timerId) {
    clearTimeout(timerId);
    phaseTimers.delete(gameId);
    logger.info('Phase timer cleared', { gameId });
  }
}

// 型安全なフェーズ取得
function getCurrentPhase(game: Game): GamePhase {
  return game.currentPhase || 'DAY_DISCUSSION';
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
  
  if (nextPhase === 'DAY_DISCUSSION') {
    game.currentDay += 1;
  }

  // ゲームイベントを記録
  game.gameEvents.push({
    id: crypto.randomUUID(),
    day: game.currentDay,
    phase: game.currentPhase,
    type: 'PHASE_CHANGE',
    description: getPhaseChangeDescription(game.currentPhase, game.currentDay),
    timestamp: now.toISOString()
  });

  // 次のフェーズのタイマーを設定
  scheduleNextPhase(game);
  
  logger.info('Game phase advanced', { 
    gameId: game.id, 
    day: game.currentDay, 
    phase: game.currentPhase,
    endTime: game.phaseEndTime
  });
}

/**
 * 各フェーズ終了時の未実行アクションの処理
 */
function handlePendingActions(game: Game): void {
  switch (game.currentPhase) {
    case 'DAY_VOTE':
      handlePendingVotes(game);
      break;
    case 'NIGHT':
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
    .filter(p => p.isAlive && !votedPlayers.has(p.playerId))
    .forEach(player => {
      // 投票可能な対象（自分以外の生存者）を取得
      const possibleTargets = game.players.filter(
        t => t.isAlive && t.playerId !== player.playerId
      );
      
      if (possibleTargets.length > 0) {
        // ランダムに投票先を選択
        const target = possibleTargets[Math.floor(Math.random() * possibleTargets.length)];
        votes.set(player.playerId, target.playerId);
        
        logger.info('Random vote assigned', {
          gameId: game.id,
          playerId: player.playerId,
          targetId: target.playerId
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
  
  // アクション済みのプレイヤーを収集
  const actedPlayers = new Set([
    ...getActionMap(game, attackKey).keys(),
    ...getActionMap(game, divineKey).keys(),
    ...getActionMap(game, guardKey).keys()
  ]);
  
  // 生存していて特殊役職を持つプレイヤーを処理
  game.players
    .filter(p => p.isAlive && !actedPlayers.has(p.playerId))
    .forEach(player => {
      // 投票可能な対象（自分以外の生存者）を取得
      const possibleTargets = game.players.filter(
        t => t.isAlive && t.playerId !== player.playerId
      );
      
      if (possibleTargets.length > 0) {
        // ランダムに対象を選択
        const target = possibleTargets[Math.floor(Math.random() * possibleTargets.length)];
        
        switch (player.role) {
          case 'WEREWOLF':
            getActionMap(game, attackKey).set(player.playerId, target.playerId);
            logger.info('Random attack assigned', {
              gameId: game.id,
              playerId: player.playerId,
              targetId: target.playerId
            });
            break;
            
          case 'SEER':
            getActionMap(game, divineKey).set(player.playerId, target.playerId);
            logger.info('Random divine assigned', {
              gameId: game.id,
              playerId: player.playerId,
              targetId: target.playerId
            });
            break;
            
          case 'BODYGUARD':
            getActionMap(game, guardKey).set(player.playerId, target.playerId);
            logger.info('Random guard assigned', {
              gameId: game.id,
              playerId: player.playerId,
              targetId: target.playerId
            });
            break;
        }
      }
    });
}

/**
 * ゲーム終了処理
 */
function endGame(game: Game, winner: string): void {
  game.status = 'FINISHED';
  game.currentPhase = 'GAME_OVER';
  game.winner = winner as 'VILLAGERS' | 'WEREWOLVES';
  game.phaseEndTime = null;
  
  // タイマーをクリア
  clearPhaseTimer(game.id);

  // 終了イベントを記録
  game.gameEvents.push({
    id: crypto.randomUUID(),
    day: game.currentDay,
    phase: 'GAME_OVER',
    type: 'GAME_END',
    description: `ゲームが終了しました。${winner}の勝利です！`,
    timestamp: new Date().toISOString()
  });

  logger.info('Game ended', { 
    gameId: game.id, 
    winner,
    finalDay: game.currentDay
  });
}

/**
 * 次のフェーズを取得
 */
function getNextPhase(currentPhase: GamePhase): GamePhase {
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

/**
 * フェーズの制限時間を取得
 */
function getPhaseTime(phase: GamePhase, game: Game): number {
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

/**
 * フェーズ変更の説明文を生成
 */
function getPhaseChangeDescription(phase: GamePhase, day: number): string {
  switch (phase) {
    case 'DAY_DISCUSSION':
      return `${day}日目の昼になりました。自由に議論を行ってください。`;
    case 'DAY_VOTE':
      return `投票の時間になりました。処刑する人を決めてください。`;
    case 'NIGHT':
      return `夜になりました。各役職は行動を選択してください。`;
    default:
      return `フェーズが${phase}に変更されました。`;
  }
}