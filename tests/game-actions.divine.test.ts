import { assertEquals } from "https://deno.land/std@0.210.0/assert/mod.ts";
import * as gameActions from "../services/game-actions.ts";
import { setupGameActionsTest } from "./game-actions.test-helpers.ts";

Deno.test({
  name: "占いアクション - 占い師は夜間に占いができるべき",
  async fn() {
    const { game, seer, werewolf } = await setupGameActionsTest();
    game.currentPhase = "NIGHT";
    const result = await gameActions.handleDivineAction(game, seer.playerId, werewolf.playerId);
    assertEquals((await result).success, true);
    assertEquals((await result).isWerewolf, true);
  },
});

Deno.test({
  name: "占いアクション - 占い師以外は占いができないべき",
  async fn() {
    const { game, villager, werewolf } = await setupGameActionsTest();
    game.currentPhase = "NIGHT";
    const result = await gameActions.handleDivineAction(game, villager.playerId, werewolf.playerId);
    assertEquals((await result).success, false);
  },
});

Deno.test({
  name: "占いアクション - 人狼でないプレイヤーを正しく識別するべき",
  async fn() {
    const { game, seer, villager } = await setupGameActionsTest();
    game.currentPhase = "NIGHT";
    const result = await gameActions.handleDivineAction(game, seer.playerId, villager.playerId);
    assertEquals((await result).success, true);
    assertEquals((await result).isWerewolf, false);
  },
});

Deno.test({
  name: "占いアクション - 昼間は占いができないべき",
  async fn() {
    const { game, seer, werewolf } = await setupGameActionsTest();
    game.currentPhase = "DAY_DISCUSSION";
    const result = await gameActions.handleDivineAction(game, seer.playerId, werewolf.playerId);
    assertEquals((await result).success, false);
  },
});
