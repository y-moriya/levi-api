import { assertEquals } from "https://deno.land/std@0.210.0/assert/mod.ts";
import * as gameActions from "../services/game-actions.ts";
import { setupGameActionsTest } from "./game-actions.test-helpers.ts";

Deno.test({
  name: "護衛アクション - 狩人は夜間に護衛ができるべき",
  async fn() {
    const { game, bodyguard, villager } = await setupGameActionsTest();
    game.currentPhase = "NIGHT";
    const result = await gameActions.handleGuardAction(game, bodyguard.playerId, villager.playerId);
    assertEquals((await result).success, true);
  },
});

Deno.test({
  name: "護衛アクション - 狩人以外は護衛ができないべき",
  async fn() {
    const { game, villager, seer } = await setupGameActionsTest();
    game.currentPhase = "NIGHT";
    const result = await gameActions.handleGuardAction(game, villager.playerId, seer.playerId);
    assertEquals((await result).success, false);
  },
});

Deno.test({
  name: "護衛アクション - 死亡したプレイヤーは護衛できないべき",
  async fn() {
    const { game, bodyguard, villager } = await setupGameActionsTest();
    game.currentPhase = "NIGHT";
    villager.isAlive = false;
    const result = await gameActions.handleGuardAction(game, bodyguard.playerId, villager.playerId);
    assertEquals((await result).success, false);
  },
});

Deno.test({
  name: "護衛アクション - 昼間は護衛ができないべき",
  async fn() {
    const { game, bodyguard, villager } = await setupGameActionsTest();
    game.currentPhase = "DAY_DISCUSSION";
    const result = await gameActions.handleGuardAction(game, bodyguard.playerId, villager.playerId);
    assertEquals((await result).success, false);
  },
});
