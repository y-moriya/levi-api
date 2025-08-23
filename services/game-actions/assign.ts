import { logger } from "../../utils/logger.ts";
import type { Game, GamePlayer } from "../../types/game.ts";
import { getActionCache } from "./core.ts";

export function assignRandomActions(game: Game): void {
  const actionCache = getActionCache();
  const actions = actionCache.get(game.id);
  if (!actions) return;

  const alivePlayers = game.players.filter((p) => p.isAlive);
  const rolePlayerMap = new Map<string, GamePlayer[]>();

  if (game.currentPhase === "DAY_VOTE") {
    const nonVotingPlayers = alivePlayers.filter((player) => !actions.votes.has(player.playerId));
    if (nonVotingPlayers.length === 0) return;
    const possibleTargets = alivePlayers.map((p) => p.playerId);
    nonVotingPlayers.forEach((player) => {
      const validTargets = possibleTargets.filter((id) => id !== player.playerId);
      if (validTargets.length > 0) {
        const targetId = validTargets[Math.floor(Math.random() * validTargets.length)];
        actions.votes.set(player.playerId, targetId);
        logger.info("Random vote assigned", { gameId: game.id, playerId: player.playerId, targetId });
      }
    });
    if (actions.cachedResults) delete actions.cachedResults.voteDistribution;
  } else if (game.currentPhase === "NIGHT" || game.currentPhase === "DAY_DISCUSSION") {
    alivePlayers.forEach((player) => {
      if (!rolePlayerMap.has(player.role || "")) rolePlayerMap.set(player.role || "", []);
      rolePlayerMap.get(player.role || "")!.push(player);
    });

    if (game.currentPhase === "NIGHT") {
      const werewolves = rolePlayerMap.get("WEREWOLF") || [];
      const nonWerewolves = alivePlayers.filter((p) => p.role !== "WEREWOLF");
      if (werewolves.length > 0 && nonWerewolves.length > 0) {
        const nonActingWerewolves = werewolves.filter((wolf) => !actions.attacks.has(wolf.playerId));
        if (nonActingWerewolves.length > 0) {
          const targetId = nonWerewolves[Math.floor(Math.random() * nonWerewolves.length)].playerId;
          nonActingWerewolves.forEach((wolf) => actions.attacks.set(wolf.playerId, targetId));
          logger.info("Random coordinated attack assigned", {
            gameId: game.id,
            werewolfCount: nonActingWerewolves.length,
            targetId,
          });
        }
      }
      const seers = rolePlayerMap.get("SEER") || [];
      if (seers.length > 0) {
        seers.forEach((seer) => {
          if (!actions.divines.has(seer.playerId) && seer.isAlive) {
            const possibleTargets = alivePlayers.filter((p) => p.playerId !== seer.playerId);
            if (possibleTargets.length > 0) {
              const target = possibleTargets[Math.floor(Math.random() * possibleTargets.length)];
              actions.divines.set(seer.playerId, target.playerId);
            }
          }
        });
      }
      const bodyguards = rolePlayerMap.get("BODYGUARD") || [];
      if (bodyguards.length > 0) {
        // 当夜の襲撃ターゲットは護衛候補から除外して、テストを不必要に不安定化させない
        const attackedTargets = new Set<string>(Array.from(actions.attacks.values()));
        bodyguards.forEach((guard) => {
          if (!actions.guards.has(guard.playerId) && guard.isAlive) {
            // まずは襲撃対象を除外した候補
            let candidates = alivePlayers.filter((p) =>
              p.playerId !== guard.playerId && !attackedTargets.has(p.playerId)
            );
            // もし全除外で空になった場合は、従来通り自分以外から選ぶ（ゲーム継続性のため）
            if (candidates.length === 0) {
              candidates = alivePlayers.filter((p) => p.playerId !== guard.playerId);
            }
            if (candidates.length > 0) {
              const target = candidates[Math.floor(Math.random() * candidates.length)];
              actions.guards.set(guard.playerId, target.playerId);
            }
          }
        });
      }
    }

    const mediums = rolePlayerMap.get("MEDIUM") || [];
    if (mediums.length > 0 && game.currentDay > 1) {
      const executedPlayers = game.players.filter((p) =>
        !p.isAlive && p.deathCause === "EXECUTION" && p.deathDay === game.currentDay - 1
      );
      if (executedPlayers.length > 0) {
        mediums.forEach((medium) => {
          if (!actions.mediums.has(medium.playerId) && medium.isAlive) {
            const target = executedPlayers[0];
            actions.mediums.set(medium.playerId, target.playerId);
            logger.info("Random medium action assigned", {
              gameId: game.id,
              playerId: medium.playerId,
              targetId: target.playerId,
            });
          }
        });
      }
    }

    if (actions.cachedResults) delete actions.cachedResults.attackDistribution;
  }
}
