import { Game, DeathCause } from "../../types/game.ts";
import { getActionMap } from "../game-phase.ts";
import { logger } from "../../utils/logger.ts";

// 昼の投票結果を確定
export function resolveVoting(game: Game): Game {
  const actions = game.actions as any as { votes?: Map<string, string> };
  let votes = actions.votes ?? new Map<string, string>();
  // フォールバック: 互換のため game[vote_<day>] からも参照
  if (votes.size === 0) {
    try {
      // 型安全に取得
      const voteKey = `vote_${game.currentDay}` as const;
      votes = getActionMap(game, voteKey);
    } catch (_) { /* noop */ }
  }

  if (votes.size === 0) return game;

  const aliveMap = new Map(game.players.map(p => [p.playerId, p.isAlive] as const));
  const voteCounts: Record<string, number> = {};
  votes.forEach((targetId, voterId) => {
    const voterAlive = aliveMap.get(voterId);
    const targetAlive = aliveMap.get(targetId);
    if (voterAlive && targetAlive && targetId) {
      voteCounts[targetId] = (voteCounts[targetId] || 0) + 1;
    }
  });

  let max = 0; let executed: string | null = null;
  for (const [pid, cnt] of Object.entries(voteCounts)) {
    if (cnt > max || (cnt === max && Math.random() > 0.5)) { max = cnt; executed = pid; }
  }

  if (!executed) return game;

  const updatedPlayers = game.players.map(p => p.playerId === executed ? ({
    ...p,
    isAlive: false,
    deathCause: "EXECUTION" as DeathCause,
    deathDay: game.currentDay,
    executionDay: game.currentDay,
  }) : p);

  const executedPlayer = game.players.find(p => p.playerId === executed);
  const revealedRoles = [...(game.revealedRoles || [])];
  if (executedPlayer?.role) {
    revealedRoles.push({ playerId: executed, role: executedPlayer.role, revealDay: game.currentDay, revealType: "EXECUTION" });
  }

  return { ...game, players: updatedPlayers, revealedRoles };
}

// 夜の結果を確定
export function resolveNight(game: Game): Game {
  const actions = game.actions as any as { attacks?: Map<string, string>, guards?: Map<string, string> };
  let attacks = actions.attacks ?? new Map<string, string>();
  let guards = actions.guards ?? new Map<string, string>();
  // フォールバック: 互換のため game[attack_<day>], game[guard_<day>] からも参照
  if (attacks.size === 0) {
    try {
      const attackKey = `attack_${game.currentDay}` as const;
      attacks = getActionMap(game, attackKey);
    } catch (_) { /* noop */ }
  }
  if (guards.size === 0) {
    try {
      const guardKey = `guard_${game.currentDay}` as const;
      guards = getActionMap(game, guardKey);
    } catch (_) { /* noop */ }
  }

  if (attacks.size === 0) return game;

  const attackCounts: Record<string, number> = {};
  attacks.forEach((targetId) => { if (targetId) attackCounts[targetId] = (attackCounts[targetId] || 0) + 1; });

  let max = 0; let attacked: string | null = null;
  for (const [pid, cnt] of Object.entries(attackCounts)) {
    if (cnt > max || (cnt === max && Math.random() > 0.5)) { max = cnt; attacked = pid; }
  }

  if (!attacked) return game;
  const isProtected = Array.from(guards.values()).includes(attacked);
  if (isProtected) {
    logger.info(`襲撃は護衛されました: ${attacked}`);
    return game;
  }

  const updatedPlayers = game.players.map(p => p.playerId === attacked ? ({
    ...p,
    isAlive: false,
    deathCause: "WEREWOLF_ATTACK" as DeathCause,
    deathDay: game.currentDay,
  }) : p);

  return { ...game, players: updatedPlayers };
}
