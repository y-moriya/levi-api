import { Context } from "https://deno.land/x/hono@v3.11.7/mod.ts";
import * as gameActions from "../services/game-actions.ts";
import * as gameModel from "../models/game.ts";
import { logger } from "../utils/logger.ts";

export const vote = async (c: Context) => {
  const gameId = c.req.param("gameId");
  const userId = c.get("userId");
  
  try {
    const data = await c.req.json();
    logger.info('Vote request body', { 
      gameId, 
      playerId: userId, 
      body: data 
    });

    if (!data.targetPlayerId) {
      logger.warn('Missing targetPlayerId in request', { gameId, playerId: userId });
      return c.json({ code: "INVALID_REQUEST", message: "targetPlayerId is required" }, 400);
    }

    const targetPlayerId = data.targetPlayerId;

    const game = gameModel.getGameById(gameId);
    if (!game) {
      logger.error('Game not found', undefined, { gameId });
      return c.json({ code: "GAME_NOT_FOUND", message: "Game not found" }, 404);
    }

    logger.info('Vote request received', { 
      gameId, 
      playerId: userId, 
      targetId: targetPlayerId,
      currentPhase: game.currentPhase,
      currentDay: game.currentDay
    });

    const result = gameActions.handleVoteAction(game, userId, targetPlayerId);
    logger.info('Vote action result', { 
      gameId, 
      playerId: userId, 
      result,
      gameActions: JSON.stringify(gameActions.getGameActions(gameId))
    });

    if (!result.success) {
      if (result.message.includes('投票フェーズではありません')) {
        logger.warn('Invalid phase for voting', { 
          gameId,
          currentPhase: game.currentPhase,
          requestedBy: userId
        });
        return c.json({ code: "INVALID_PHASE", message: result.message }, 400);
      }
      return c.json({ code: "VOTE_ERROR", message: result.message }, 400);
    }
    return c.json(result, 200);
  } catch (error: unknown) {
    const err = error as Error;
    logger.error("Vote failed", err, { 
      gameId, 
      playerId: userId
    });
    return c.json({ code: "VOTE_ERROR", message: err.message }, 400);
  }
};

export const attack = async (c: Context) => {
  const gameId = c.req.param("gameId");
  const userId = c.get("userId");
  const data = await c.req.json();
  const targetPlayerId = data.targetPlayerId;

  try {
    const game = gameModel.getGameById(gameId);
    if (!game) {
      return c.json({ code: "GAME_NOT_FOUND", message: "Game not found" }, 404);
    }
    const result = await gameActions.handleAttackAction(game, userId, targetPlayerId);
    if (!result.success) {
      if (result.message.includes('人狼以外は襲撃できません')) {
        return c.json({ code: "NOT_WEREWOLF", message: result.message }, 403);
      }
      if (result.message.includes('夜フェーズではありません')) {
        return c.json({ code: "INVALID_PHASE", message: result.message }, 400);
      }
      return c.json({ code: "ATTACK_ERROR", message: result.message }, 400);
    }
    return c.json(result, 200);
  } catch (error: unknown) {
    const err = error as Error;
    logger.warn("Attack failed", { gameId, playerId: userId, error: err.message });
    return c.json({ code: "ATTACK_ERROR", message: err.message }, 400);
  }
};

export const divine = async (c: Context) => {
  const gameId = c.req.param("gameId");
  const userId = c.get("userId");
  
  try {
    const data = await c.req.json();
    logger.info('Divine request body', { 
      gameId, 
      playerId: userId, 
      body: data 
    });

    if (!data.targetPlayerId) {
      logger.warn('Missing targetPlayerId in divine request', { gameId, playerId: userId });
      return c.json({ code: "INVALID_REQUEST", message: "targetPlayerId is required" }, 400);
    }

    const targetPlayerId = data.targetPlayerId;

    const game = gameModel.getGameById(gameId);
    if (!game) {
      logger.error('Game not found for divine action', undefined, { gameId });
      return c.json({ code: "GAME_NOT_FOUND", message: "Game not found" }, 404);
    }

    logger.info('Divine request received', { 
      gameId, 
      playerId: userId, 
      targetId: targetPlayerId,
      currentPhase: game.currentPhase,
      currentDay: game.currentDay,
      gameActions: JSON.stringify(gameActions.getGameActions(gameId))
    });

    const result = gameActions.handleDivineAction(game, userId, targetPlayerId);
    logger.info('Divine action result', { 
      gameId, 
      playerId: userId, 
      result 
    });

    if (!result.success) {
      if (result.message.includes('夜フェーズではありません')) {
        logger.warn('Invalid phase for divine', { 
          gameId,
          currentPhase: game.currentPhase,
          requestedBy: userId
        });
        return c.json({ code: "INVALID_PHASE", message: result.message }, 400);
      }
      return c.json({ code: "DIVINE_ERROR", message: result.message }, 400);
    }
    return c.json(result, 200);
  } catch (error: unknown) {
    const err = error as Error;
    logger.error("Divine action failed", err, { 
      gameId, 
      playerId: userId
    });
    return c.json({ code: "DIVINE_ERROR", message: err.message }, 400);
  }
};

export const guard = async (c: Context) => {
  const gameId = c.req.param("gameId");
  const userId = c.get("userId");
  const data = await c.req.json();
  const targetPlayerId = data.targetPlayerId;

  try {
    const game = gameModel.getGameById(gameId);
    if (!game) {
      return c.json({ code: "GAME_NOT_FOUND", message: "Game not found" }, 404);
    }
    const result = await gameActions.handleGuardAction(game, userId, targetPlayerId);
    if (!result.success) {
      if (result.message.includes('狩人以外は護衛できません')) {
        return c.json({ code: "NOT_BODYGUARD", message: result.message }, 403);
      }
      if (result.message.includes('夜フェーズではありません')) {
        return c.json({ code: "INVALID_PHASE", message: result.message }, 400);
      }
      return c.json({ code: "GUARD_ERROR", message: result.message }, 400);
    }
    return c.json(result, 200);
  } catch (error: unknown) {
    const err = error as Error;
    logger.warn("Guard failed", { gameId, playerId: userId, error: err.message });
    return c.json({ code: "GUARD_ERROR", message: err.message }, 400);
  }
};