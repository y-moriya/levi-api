import type { Game } from "../../types/game.ts";

export interface GameActionsState {
  votes: Map<string, string>;
  attacks: Map<string, string>;
  divines: Map<string, string>;
  guards: Map<string, string>;
  mediums: Map<string, string>;
  cachedResults?: {
    voteDistribution?: Map<string, number>;
    attackDistribution?: Map<string, number>;
    timestamp: number;
  };
}

export type ActionKind = "vote" | "attack" | "divine" | "guard" | "medium";

export type WithGame<T = unknown> = T & { game: Game };
