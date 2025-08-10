import type { ActionResult, DivineResult, Game, MediumResult } from "../../types/game.ts";
import { logger } from "../../utils/logger.ts";
import { handleAttackAction, handleDivineAction, handleGuardAction, handleMediumAction, handleVoteAction } from "./handlers.ts";

export async function submitAction(
  game: Game,
  playerId: string,
  targetId: string,
  actionType: "vote" | "attack" | "divine" | "guard" | "medium",
): Promise<ActionResult | DivineResult | MediumResult> {
  logger.info("Action submitted", { gameId: game.id, playerId, targetId, actionType });
  switch (actionType) {
    case "vote":
      return handleVoteAction(game, playerId, targetId);
    case "attack":
      return handleAttackAction(game, playerId, targetId);
    case "divine":
      return handleDivineAction(game, playerId, targetId);
    case "guard":
      return handleGuardAction(game, playerId, targetId);
    case "medium":
      return handleMediumAction(game, playerId, targetId);
    default:
      return { success: false, message: `不明なアクションタイプ: ${actionType}` };
  }
}
