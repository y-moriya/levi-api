import { Context } from "https://deno.land/x/hono@v3.11.7/mod.ts";
import * as gameActions from "../../services/game-actions.ts";
import * as gameModel from "../../models/game.ts";
import { ErrorCode, GameError } from "../../types/error.ts";
import { getMessage, SupportedLanguage } from "../../utils/messages.ts";

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
