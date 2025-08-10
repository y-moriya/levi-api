import { Context } from "https://deno.land/x/hono@v3.11.7/mod.ts";
import * as gameActions from "../../services/game-actions.ts";
import * as gameModel from "../../models/game.ts";
import { logger } from "../../utils/logger.ts";
import { ErrorCode, GameError } from "../../types/error.ts";
import { getMessage, SupportedLanguage } from "../../utils/messages.ts";

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
