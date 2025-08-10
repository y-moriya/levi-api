import { getActionCache } from "./core.ts";

export function getGameActions(gameId: string) {
  return getActionCache().get(gameId);
}
