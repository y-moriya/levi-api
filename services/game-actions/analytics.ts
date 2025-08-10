import type { Game } from "../../types/game.ts";
import { getActionCache } from "./core.ts";

export function getVoteDistribution(game: Game): Map<string, number> {
  const actions = getActionCache().get(game.id);
  if (!actions) return new Map();
  if (actions.cachedResults?.voteDistribution && Date.now() - actions.cachedResults.timestamp < 5000) {
    return actions.cachedResults.voteDistribution;
  }
  const distribution = new Map<string, number>();
  actions.votes.forEach((targetId) => distribution.set(targetId, (distribution.get(targetId) || 0) + 1));
  actions.cachedResults = actions.cachedResults || { timestamp: Date.now() };
  actions.cachedResults.voteDistribution = distribution;
  actions.cachedResults.timestamp = Date.now();
  return distribution;
}

export function getAttackDistribution(game: Game): Map<string, number> {
  const actions = getActionCache().get(game.id);
  if (!actions) return new Map();
  if (actions.cachedResults?.attackDistribution && Date.now() - actions.cachedResults.timestamp < 5000) {
    return actions.cachedResults.attackDistribution;
  }
  const distribution = new Map<string, number>();
  actions.attacks.forEach((targetId) => distribution.set(targetId, (distribution.get(targetId) || 0) + 1));
  actions.cachedResults = actions.cachedResults || { timestamp: Date.now() };
  actions.cachedResults.attackDistribution = distribution;
  actions.cachedResults.timestamp = Date.now();
  return distribution;
}
