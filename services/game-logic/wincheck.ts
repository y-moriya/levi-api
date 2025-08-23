import { Game, Winner } from "../../types/game.ts";

export function checkGameEnd(game: Game): { ended: boolean; winner: Winner | null } {
  const alive = game.players.filter((p) => p.isAlive);
  const wolves = alive.filter((p) => p.role === "WEREWOLF").length;
  const villagers = alive.length - wolves;

  if (wolves === 0) return { ended: true, winner: "VILLAGERS" };
  if (wolves >= villagers) return { ended: true, winner: "WEREWOLVES" };
  if (alive.length === 0) return { ended: true, winner: "NONE" };
  return { ended: false, winner: null };
}
