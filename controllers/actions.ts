import { Context } from "https://deno.land/x/hono@v3.11.7/mod.ts";
import * as gameActions from "../services/game-actions.ts";
import * as gameModel from "../models/game.ts";
import { logger } from "../utils/logger.ts";
import { ErrorCode, GameError } from "../types/error.ts";
import { getMessage, SupportedLanguage } from "../utils/messages.ts";

export const vote = async (c: Context) => {
  const gameId = c.req.param("gameId");
  const userId = c.get("userId");
  const lang = c.get("lang") as SupportedLanguage;

  try {
    const data = await c.req.json();
    logger.info("Vote request body", {
      gameId,
      playerId: userId,
      body: data,
    });

    if (!data.targetPlayerId) {
      throw new GameError(
        ErrorCode.INVALID_REQUEST,
        getMessage("INVALID_REQUEST", lang),
        "WARN",
        { gameId, playerId: userId },
      );
    }

    const targetPlayerId = data.targetPlayerId;

    const game = await gameModel.getGameById(gameId);
    if (!game) {
      throw new GameError(
        ErrorCode.GAME_NOT_FOUND,
        getMessage("GAME_NOT_FOUND", lang),
        "WARN",
        { gameId },
      );
    }

    logger.info("Vote request received", {
      gameId,
      playerId: userId,
      targetId: targetPlayerId,
      currentPhase: game.currentPhase,
      currentDay: game.currentDay,
    });

    const result = await gameActions.handleVoteAction(game, userId, targetPlayerId);
    logger.info("Vote action result", {
      gameId,
      playerId: userId,
      result,
      gameActions: JSON.stringify(gameActions.getGameActions(gameId)),
    });

    if (!result.success) {
      if (result.message.includes("投票フェーズではありません")) {
        throw new GameError(
          ErrorCode.INVALID_PHASE,
          getMessage("INVALID_PHASE", lang),
          "WARN",
          { gameId, currentPhase: game.currentPhase, playerId: userId },
        );
      }
      throw new GameError(
        ErrorCode.VOTE_ERROR,
        result.message,
        "WARN",
        { gameId, playerId: userId, targetPlayerId },
      );
    }
    return c.json(result, 200);
  } catch (error: unknown) {
    if (!(error instanceof GameError)) {
      logger.error("Vote failed", error as Error, {
        gameId,
        playerId: userId,
      });
      throw new GameError(
        ErrorCode.VOTE_ERROR,
        getMessage("VOTE_ERROR", lang),
        "ERROR",
        { gameId, playerId: userId },
      );
    }
    throw error;
  }
};

export const attack = async (c: Context) => {
  const gameId = c.req.param("gameId");
  const userId = c.get("userId");
  const lang = c.get("lang") as SupportedLanguage;

  try {
    const data = await c.req.json();
    if (!data.targetPlayerId) {
      throw new GameError(
        ErrorCode.INVALID_REQUEST,
        getMessage("INVALID_REQUEST", lang),
        "WARN",
        { gameId, playerId: userId },
      );
    }

    const targetPlayerId = data.targetPlayerId;

    const game = await gameModel.getGameById(gameId);
    if (!game) {
      throw new GameError(
        ErrorCode.GAME_NOT_FOUND,
        getMessage("GAME_NOT_FOUND", lang),
        "WARN",
        { gameId },
      );
    }

    const result = await gameActions.handleAttackAction(game, userId, targetPlayerId);
    if (!result.success) {
      if (result.message.includes("人狼以外は襲撃できません")) {
        throw new GameError(
          ErrorCode.NOT_WEREWOLF,
          getMessage("NOT_WEREWOLF", lang),
          "WARN",
          { gameId, playerId: userId },
        );
      }
      if (result.message.includes("夜フェーズではありません")) {
        throw new GameError(
          ErrorCode.INVALID_PHASE,
          getMessage("INVALID_PHASE", lang),
          "WARN",
          { gameId, currentPhase: game.currentPhase, playerId: userId },
        );
      }
      throw new GameError(
        ErrorCode.ATTACK_ERROR,
        result.message,
        "WARN",
        { gameId, playerId: userId, targetPlayerId },
      );
    }
    return c.json(result, 200);
  } catch (error: unknown) {
    if (!(error instanceof GameError)) {
      logger.error("Attack failed", error as Error, {
        gameId,
        playerId: userId,
      });
      throw new GameError(
        ErrorCode.ATTACK_ERROR,
        getMessage("ATTACK_ERROR", lang),
        "ERROR",
        { gameId, playerId: userId },
      );
    }
    throw error;
  }
};

export const divine = async (c: Context) => {
  const gameId = c.req.param("gameId");
  const userId = c.get("userId");
  const lang = c.get("lang") as SupportedLanguage;

  try {
    const data = await c.req.json();
    logger.info("Divine request body", {
      gameId,
      playerId: userId,
      body: data,
    });

    if (!data.targetPlayerId) {
      throw new GameError(
        ErrorCode.INVALID_REQUEST,
        getMessage("INVALID_REQUEST", lang),
        "WARN",
        { gameId, playerId: userId },
      );
    }

    const targetPlayerId = data.targetPlayerId;

    const game = await gameModel.getGameById(gameId);
    if (!game) {
      throw new GameError(
        ErrorCode.GAME_NOT_FOUND,
        getMessage("GAME_NOT_FOUND", lang),
        "WARN",
        { gameId },
      );
    }

    logger.info("Divine request received", {
      gameId,
      playerId: userId,
      targetId: targetPlayerId,
      currentPhase: game.currentPhase,
      currentDay: game.currentDay,
      gameActions: JSON.stringify(gameActions.getGameActions(gameId)),
    });

    const result = await gameActions.handleDivineAction(game, userId, targetPlayerId);
    logger.info("Divine action result", {
      gameId,
      playerId: userId,
      result,
    });

    if (!result.success) {
      if (result.message.includes("占い師以外は占いできません")) {
        throw new GameError(
          ErrorCode.NOT_SEER,
          getMessage("NOT_SEER", lang),
          "WARN",
          { gameId, playerId: userId },
        );
      }
      if (result.message.includes("夜フェーズではありません")) {
        throw new GameError(
          ErrorCode.INVALID_PHASE,
          getMessage("INVALID_PHASE", lang),
          "WARN",
          { gameId, currentPhase: game.currentPhase, playerId: userId },
        );
      }
      throw new GameError(
        ErrorCode.DIVINE_ERROR,
        result.message,
        "WARN",
        { gameId, playerId: userId, targetPlayerId },
      );
    }
    return c.json(result, 200);
  } catch (error: unknown) {
    if (!(error instanceof GameError)) {
      logger.error("Divine action failed", error as Error, {
        gameId,
        playerId: userId,
      });
      throw new GameError(
        ErrorCode.DIVINE_ERROR,
        getMessage("DIVINE_ERROR", lang),
        "ERROR",
        { gameId, playerId: userId },
      );
    }
    throw error;
  }
};

export const guard = async (c: Context) => {
  const gameId = c.req.param("gameId");
  const userId = c.get("userId");
  const lang = c.get("lang") as SupportedLanguage;

  try {
    const data = await c.req.json();
    if (!data.targetPlayerId) {
      throw new GameError(
        ErrorCode.INVALID_REQUEST,
        getMessage("INVALID_REQUEST", lang),
        "WARN",
        { gameId, playerId: userId },
      );
    }

    const targetPlayerId = data.targetPlayerId;

    const game = await gameModel.getGameById(gameId);
    if (!game) {
      throw new GameError(
        ErrorCode.GAME_NOT_FOUND,
        getMessage("GAME_NOT_FOUND", lang),
        "WARN",
        { gameId },
      );
    }

    const result = await gameActions.handleGuardAction(game, userId, targetPlayerId);
    if (!result.success) {
      if (result.message.includes("狩人以外は護衛できません")) {
        throw new GameError(
          ErrorCode.NOT_BODYGUARD,
          getMessage("NOT_BODYGUARD", lang),
          "WARN",
          { gameId, playerId: userId },
        );
      }
      if (result.message.includes("夜フェーズではありません")) {
        throw new GameError(
          ErrorCode.INVALID_PHASE,
          getMessage("INVALID_PHASE", lang),
          "WARN",
          { gameId, currentPhase: game.currentPhase, playerId: userId },
        );
      }
      throw new GameError(
        ErrorCode.GUARD_ERROR,
        result.message,
        "WARN",
        { gameId, playerId: userId, targetPlayerId },
      );
    }
    return c.json(result, 200);
  } catch (error: unknown) {
    if (!(error instanceof GameError)) {
      logger.error("Guard action failed", error as Error, {
        gameId,
        playerId: userId,
      });
      throw new GameError(
        ErrorCode.GUARD_ERROR,
        getMessage("GUARD_ERROR", lang),
        "ERROR",
        { gameId, playerId: userId },
      );
    }
    throw error;
  }
};

export const medium = async (c: Context) => {
  const gameId = c.req.param("gameId");
  const userId = c.get("userId");
  const lang = c.get("lang") as SupportedLanguage;

  try {
    const data = await c.req.json();
    logger.info("Medium request body", {
      gameId,
      playerId: userId,
      body: data,
    });

    if (!data.targetPlayerId) {
      throw new GameError(
        ErrorCode.INVALID_REQUEST,
        getMessage("INVALID_REQUEST", lang),
        "WARN",
        { gameId, playerId: userId },
      );
    }

    const targetPlayerId = data.targetPlayerId;

    const game = await gameModel.getGameById(gameId);
    if (!game) {
      throw new GameError(
        ErrorCode.GAME_NOT_FOUND,
        getMessage("GAME_NOT_FOUND", lang),
        "WARN",
        { gameId },
      );
    }

    logger.info("Medium request received", {
      gameId,
      playerId: userId,
      targetId: targetPlayerId,
      currentPhase: game.currentPhase,
      currentDay: game.currentDay,
      gameActions: JSON.stringify(gameActions.getGameActions(gameId)),
    });

    const result = await gameActions.handleMediumAction(game, userId, targetPlayerId);
    logger.info("Medium action result", {
      gameId,
      playerId: userId,
      result,
    });

    if (!result.success) {
      if (result.message.includes("霊能者以外は霊能を使えません")) {
        throw new GameError(
          ErrorCode.NOT_MEDIUM,
          getMessage("NOT_MEDIUM", lang),
          "WARN",
          { gameId, playerId: userId },
        );
      }
      if (result.message.includes("昼または夜のフェーズでしか霊能は使えません")) {
        throw new GameError(
          ErrorCode.INVALID_PHASE,
          getMessage("INVALID_PHASE", lang),
          "WARN",
          { gameId, currentPhase: game.currentPhase, playerId: userId },
        );
      }
      throw new GameError(
        ErrorCode.MEDIUM_ERROR,
        result.message,
        "WARN",
        { gameId, playerId: userId, targetPlayerId },
      );
    }
    return c.json(result, 200);
  } catch (error: unknown) {
    if (!(error instanceof GameError)) {
      logger.error("Medium action failed", error as Error, {
        gameId,
        playerId: userId,
      });
      throw new GameError(
        ErrorCode.MEDIUM_ERROR,
        getMessage("MEDIUM_ERROR", lang),
        "ERROR",
        { gameId, playerId: userId },
      );
    }
    throw error;
  }
};
