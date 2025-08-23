import type { Game } from "../../types/game.ts";
import { getActionCache } from "./core.ts";
import { assignRandomActions } from "./assign.ts";

export function processPhaseActions(game: Game): void {
  const actionCache = getActionCache();
  const actions = actionCache.get(game.id);
  if (!actions) return;

  assignRandomActions(game);

  if (game.currentPhase === "DAY_VOTE") {
    const voteKey = `vote_${game.currentDay}` as const;
    game.actions[voteKey] = game.actions[voteKey] || new Map<string, string>();
    const votes = game.actions[voteKey];
    votes.clear();
    actions.votes.forEach((targetId, playerId) => votes.set(playerId, targetId));
    // 投票はこの時点ではキャッシュを残す（テストが参照するため）。
    // 次フェーズ移行時に必要であれば別箇所でクリアする。
  } else if (game.currentPhase === "NIGHT" || game.currentPhase === "DAY_DISCUSSION") {
    const attackKey = `attack_${game.currentDay}` as const;
    const divineKey = `divine_${game.currentDay}` as const;
    const guardKey = `guard_${game.currentDay}` as const;
    const mediumKey = `medium_${game.currentDay}` as const;

    game.actions[attackKey] = game.actions[attackKey] || new Map<string, string>();
    game.actions[divineKey] = game.actions[divineKey] || new Map<string, string>();
    game.actions[guardKey] = game.actions[guardKey] || new Map<string, string>();
    game.actions[mediumKey] = game.actions[mediumKey] || new Map<string, string>();

    const attacks = game.actions[attackKey];
    const divines = game.actions[divineKey];
    const guards = game.actions[guardKey];
    const mediums = game.actions[mediumKey];

    attacks.clear();
    divines.clear();
    guards.clear();
    mediums.clear();

    if (game.currentPhase === "NIGHT") {
      actions.attacks.forEach((targetId, playerId) => attacks.set(playerId, targetId));
      actions.divines.forEach((targetId, playerId) => divines.set(playerId, targetId));
      actions.guards.forEach((targetId, playerId) => guards.set(playerId, targetId));
      // 反映後はキャッシュをクリア
      actions.attacks.clear();
      actions.divines.clear();
      actions.guards.clear();
    }
    actions.mediums.forEach((targetId, playerId) => mediums.set(playerId, targetId));
    // 霊能も反映後にキャッシュをクリア
    actions.mediums.clear();
  }
}
