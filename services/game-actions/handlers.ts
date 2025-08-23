import type { ActionResult, DivineResult, Game, GamePlayer, MediumResult } from "../../types/game.ts";
import { logger } from "../../utils/logger.ts";
import { getActionCache, requireActions } from "./core.ts";

export async function handleVoteAction(game: Game, playerId: string, targetId: string): Promise<ActionResult> {
  logger.info("Handling vote action", {
    gameId: game.id,
    currentPhase: game.currentPhase,
    currentDay: game.currentDay,
    playerId,
    targetId,
  });

  if (game.currentPhase !== "DAY_VOTE") {
    logger.warn("Invalid phase for voting", {
      gameId: game.id,
      expectedPhase: "DAY_VOTE",
      actualPhase: game.currentPhase,
    });
    return { success: false, message: "投票フェーズではありません" };
  }

  const player = game.players.find((p) => p.playerId === playerId);
  const target = game.players.find((p) => p.playerId === targetId);

  if (!player?.isAlive || !target?.isAlive) {
    logger.warn("Dead player involved in vote", {
      gameId: game.id,
      playerAlive: player?.isAlive,
      targetAlive: target?.isAlive,
    });
    return { success: false, message: "死亡したプレイヤーは投票できません/投票対象にできません" };
  }

  const actions = requireActions(game);
  actions.votes.set(playerId, targetId);
  if (actions.cachedResults) delete actions.cachedResults.voteDistribution;

  logger.info("Vote recorded", {
    gameId: game.id,
    playerId,
    targetId,
    currentVotes: Array.from(actions.votes.entries()),
  });
  return { success: true, message: "投票が受け付けられました" };
}

export async function handleAttackAction(game: Game, playerId: string, targetId: string): Promise<ActionResult> {
  if (game.currentPhase !== "NIGHT") return { success: false, message: "夜フェーズではありません" };

  const player = game.players.find((p) => p.playerId === playerId);
  const target = game.players.find((p) => p.playerId === targetId);
  if (!player?.isAlive || !target?.isAlive) {
    return { success: false, message: "死亡したプレイヤーは襲撃できません/襲撃対象にできません" };
  }
  if (player.role !== "WEREWOLF") return { success: false, message: "人狼以外は襲撃できません" };
  if (target.role === "WEREWOLF") return { success: false, message: "人狼を襲撃することはできません" };

  const actions = requireActions(game);
  actions.attacks.set(playerId, targetId);
  if (actions.cachedResults) delete actions.cachedResults.attackDistribution;
  return { success: true, message: "襲撃が受け付けられました" };
}

export async function handleDivineAction(game: Game, playerId: string, targetId: string): Promise<DivineResult> {
  if (game.currentPhase !== "NIGHT") {
    return {
      success: false,
      message: "夜フェーズではありません",
      targetPlayerId: targetId,
      targetUsername: "",
      isWerewolf: false,
    };
  }
  const player = game.players.find((p) => p.playerId === playerId);
  const target = game.players.find((p) => p.playerId === targetId);
  if (!player?.isAlive || !target?.isAlive) {
    return {
      success: false,
      message: "死亡したプレイヤーは占えません/占い対象にできません",
      targetPlayerId: targetId,
      targetUsername: target?.username || "",
      isWerewolf: false,
    };
  }
  if (player.role !== "SEER") {
    return {
      success: false,
      message: "占い師以外は占うことができません",
      targetPlayerId: targetId,
      targetUsername: target.username,
      isWerewolf: false,
    };
  }
  const actions = requireActions(game);
  actions.divines.set(playerId, targetId);
  return {
    success: true,
    message: "占いが受け付けられました",
    targetPlayerId: targetId,
    targetUsername: target.username,
    isWerewolf: target.role === "WEREWOLF",
  };
}

export async function handleGuardAction(game: Game, playerId: string, targetId: string): Promise<ActionResult> {
  if (game.currentPhase !== "NIGHT") return { success: false, message: "夜フェーズではありません" };
  const player = game.players.find((p) => p.playerId === playerId);
  const target = game.players.find((p) => p.playerId === targetId);
  if (!player?.isAlive || !target?.isAlive) {
    return { success: false, message: "死亡したプレイヤーは護衛できません/護衛対象にできません" };
  }
  if (player.role !== "BODYGUARD") return { success: false, message: "狩人以外は護衛できません" };
  const actions = requireActions(game);
  actions.guards.set(playerId, targetId);
  return { success: true, message: "護衛が受け付けられました" };
}

export async function handleMediumAction(game: Game, playerId: string, targetId: string): Promise<MediumResult> {
  if (game.currentPhase !== "NIGHT" && game.currentPhase !== "DAY_DISCUSSION") {
    return {
      success: false,
      message: "昼または夜のフェーズでしか霊能は使えません",
      targetPlayerId: targetId,
      targetUsername: "",
      isWerewolf: false,
    };
  }
  const player = game.players.find((p) => p.playerId === playerId);
  const target = game.players.find((p) => p.playerId === targetId);
  if (!player?.isAlive) {
    return {
      success: false,
      message: "死亡したプレイヤーは霊能を使えません",
      targetPlayerId: targetId,
      targetUsername: target?.username || "",
      isWerewolf: false,
    };
  }
  if (player.role !== "MEDIUM") {
    return {
      success: false,
      message: "霊能者以外は霊能を使えません",
      targetPlayerId: targetId,
      targetUsername: target?.username || "",
      isWerewolf: false,
    };
  }
  if (
    !target || target.isAlive || target.deathCause !== "EXECUTION" || !target.deathDay ||
    target.deathDay !== game.currentDay - 1
  ) {
    return {
      success: false,
      message: "前日に処刑されたプレイヤーのみ霊能の対象になります",
      targetPlayerId: targetId,
      targetUsername: target?.username || "",
      isWerewolf: false,
    };
  }
  const actions = requireActions(game);
  actions.mediums.set(playerId, targetId);
  return {
    success: true,
    message: "霊能が受け付けられました",
    targetPlayerId: targetId,
    targetUsername: target.username,
    isWerewolf: target.role === "WEREWOLF",
  };
}
