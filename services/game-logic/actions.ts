import { nanoid } from "https://deno.land/x/nanoid@v3.0.0/mod.ts";
import { Game, GameAction, GameActionType, GamePlayer, VoteType } from "../../types/game.ts";
import { updateGame } from "./update.ts";

export function validateActionPermission(
  game: Game,
  player: GamePlayer,
  actionType: GameActionType,
  targetId?: string,
): void {
  switch (game.currentPhase) {
    case "DAY_DISCUSSION":
      if (actionType !== "CHAT") throw new Error("Only chat actions are allowed during day discussion");
      break;
    case "DAY_VOTE":
    case "VOTING":
      if (actionType !== "VOTE") throw new Error("Only voting is allowed during voting phase");
      break;
    case "NIGHT":
      validateNightActionByRole(player, actionType);
      break;
  }

  if (["VOTE", "WEREWOLF_ATTACK", "DIVINATION", "PROTECT"].includes(actionType) && !targetId) {
    throw new Error("Target is required for this action");
  }

  if (["VOTE", "WEREWOLF_ATTACK", "DIVINATION"].includes(actionType) && targetId === player.playerId) {
    throw new Error("Cannot target yourself with this action");
  }

  if (targetId) {
    const target = game.players.find((p) => p.playerId === targetId);
    if (!target) throw new Error("Target player not found");
    if (!target.isAlive) throw new Error("Cannot target a dead player");
  }
}

function validateNightActionByRole(player: GamePlayer, actionType: GameActionType): void {
  if (!player.role) throw new Error("Player has no assigned role");
  switch (actionType) {
    case "WEREWOLF_ATTACK":
      if (player.role !== "WEREWOLF") throw new Error("Only werewolves can attack");
      break;
    case "DIVINATION":
      if (player.role !== "SEER") throw new Error("Only seers can perform divination");
      break;
    case "PROTECT":
      if (player.role !== "BODYGUARD") throw new Error("Only bodyguards can protect");
      break;
    case "CHAT":
      break;
    default:
      throw new Error(`Invalid action type for night phase: ${actionType}`);
  }
}

export async function upsertAction(
  game: Game,
  playerId: string,
  actionType: GameActionType,
  targetId?: string,
  voteType?: VoteType,
): Promise<GameAction> {
  const player = game.players.find((p) => p.playerId === playerId);
  if (!player) throw new Error("Player not found in this game");
  if (!player.isAlive) throw new Error("Dead players cannot perform actions");

  validateActionPermission(game, player, actionType, targetId);

  const existingActionIndex = game.actions.findIndex((a) => a.playerId === playerId && a.type === actionType);

  const newAction: GameAction = {
    id: nanoid(),
    gameId: game.id,
    playerId,
    type: actionType,
    targetId: targetId || "",
    voteType,
    createdAt: new Date(),
  };

  const actionsArray = [...game.actions];
  if (existingActionIndex >= 0) actionsArray[existingActionIndex] = newAction;
  else actionsArray.push(newAction);

  // 合成型: GameAction[] と拡張マップ
  const updatedActions = actionsArray as unknown as GameAction[] & { [key: string]: Map<string, string> };
  updatedActions.votes = game.actions.votes ? new Map(game.actions.votes) : new Map<string, string>();
  updatedActions.attacks = game.actions.attacks ? new Map(game.actions.attacks) : new Map<string, string>();
  updatedActions.divinations = game.actions.divinations ? new Map(game.actions.divinations) : new Map<string, string>();
  updatedActions.guards = game.actions.guards ? new Map(game.actions.guards) : new Map<string, string>();
  updatedActions.mediums = game.actions.mediums ? new Map(game.actions.mediums) : new Map<string, string>();

  await updateGame({ ...game, actions: updatedActions });
  return newAction;
}
