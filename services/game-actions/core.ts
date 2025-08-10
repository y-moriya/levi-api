import { LRUCache } from "../../utils/cache.ts";
import { logger } from "../../utils/logger.ts";
import type { Game } from "../../types/game.ts";
import type { GameActionsState } from "./types.ts";

// ゲームアクションのキャッシュ (最大100ゲーム、10分有効)
const actionCache = new LRUCache<string, GameActionsState>(100, 10 * 60 * 1000);

export function getActionCache() {
  return actionCache;
}

export function resetGameActions(): void {
  actionCache.clear();
  logger.info("Game actions reset");
}

export function initializeGameActions(gameId: string): void {
  const newActions: GameActionsState = {
    votes: new Map<string, string>(),
    attacks: new Map<string, string>(),
    divines: new Map<string, string>(),
    guards: new Map<string, string>(),
    mediums: new Map<string, string>(),
  };
  actionCache.set(gameId, newActions);
  logger.info("Game actions initialized", { gameId });
}

export function requireActions(game: Game): GameActionsState {
  let actions = actionCache.get(game.id);
  if (!actions) {
    logger.error("Game actions not initialized");
    initializeGameActions(game.id);
    actions = actionCache.get(game.id)!;
  }
  return actions;
}
