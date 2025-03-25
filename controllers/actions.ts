import { Context } from "https://deno.land/x/hono@v3.11.7/mod.ts";
import * as gameActions from "../services/game-actions.ts";
import * as gameModel from "../models/game.ts";
import { logger } from "../utils/logger.ts";

export const vote = async (c: Context) => {
  const gameId = c.req.param("gameId");
  const userId = c.get("userId");
  const data = await c.req.json();
  const targetPlayerId = data.targetPlayerId;

  try {
    const game = gameModel.getGameById(gameId);
    if (!game) {
      return c.json({ code: "GAME_NOT_FOUND", message: "Game not found" }, 404);
    }
    const result = await gameActions.handleVoteAction(game, userId, targetPlayerId);
    if (!result.success) {
      if (result.message.includes('投票フェーズではありません')) {
        return c.json({ code: "INVALID_PHASE", message: result.message }, 400);
      }
      return c.json({ code: "VOTE_ERROR", message: result.message }, 400);
    }
    return c.json(result, 200);
  } catch (error: unknown) {
    const err = error as Error;
    logger.warn("Vote failed", { gameId, playerId: userId, error: err.message });
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
  const data = await c.req.json();
  const targetPlayerId = data.targetPlayerId;

  try {
    const game = gameModel.getGameById(gameId);
    if (!game) {
      return c.json({ code: "GAME_NOT_FOUND", message: "Game not found" }, 404);
    }
    const result = await gameActions.handleDivineAction(game, userId, targetPlayerId);
    if (!result.success) {
      if (result.message.includes('占い師以外は占うことができません')) {
        return c.json({ code: "NOT_SEER", message: result.message }, 403);
      }
      if (result.message.includes('夜フェーズではありません')) {
        return c.json({ code: "INVALID_PHASE", message: result.message }, 400);
      }
      return c.json({ code: "DIVINE_ERROR", message: result.message }, 400);
    }
    return c.json(result, 200);
  } catch (error: unknown) {
    const err = error as Error;
    logger.warn("Divination failed", { gameId, playerId: userId, error: err.message });
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