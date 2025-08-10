import { assertEquals } from "https://deno.land/std@0.210.0/assert/mod.ts";
import * as gameActions from "../services/game-actions.ts";
import { setupGameActionsTest } from "./game-actions.test-helpers.ts";
import * as gameModel from "../models/game.ts";

Deno.test({
  name: "襲撃アクション - 人狼は夜間に襲撃できるべき",
  async fn() {
    const { game, werewolf, villager } = await setupGameActionsTest();
    game.currentPhase = "NIGHT";
    const result = await gameActions.handleAttackAction(game, werewolf.playerId, villager.playerId);
    assertEquals((await result).success, true);
  },
});

Deno.test({
  name: "襲撃アクション - 人狼以外は襲撃できないべき",
  async fn() {
    try {
      const { game, villager, seer } = await setupGameActionsTest();
      game.currentPhase = "NIGHT";
      const result = await gameActions.handleAttackAction(game, villager.playerId, seer.playerId);
      assertEquals((await result).success, false);
    } finally {
      const gameRepo = gameModel.gameStore;
      await gameRepo.clear();
    }
  },
});

Deno.test({
  name: "襲撃アクション - 人狼は他の人狼を襲撃できないべき",
  async fn() {
    const { game, werewolf } = await setupGameActionsTest();
    game.currentPhase = "NIGHT";
    const result = await gameActions.handleAttackAction(game, werewolf.playerId, werewolf.playerId);
    assertEquals((await result).success, false);
  },
});

Deno.test({
  name: "襲撃アクション - 昼間は襲撃できないべき",
  async fn() {
    const { game, werewolf, villager } = await setupGameActionsTest();
    game.currentPhase = "DAY_DISCUSSION";
    const result = await gameActions.handleAttackAction(game, werewolf.playerId, villager.playerId);
    assertEquals((await result).success, false);
  },
});
