import { assertEquals } from "https://deno.land/std@0.210.0/assert/mod.ts";
import * as gameActions from "../services/game-actions.ts";
import { setupGameActionsTest } from "./game-actions.test-helpers.ts";

Deno.test({
  name: "投票アクション - 投票フェーズ中は投票が許可されるべき",
  async fn() {
    const { game, villager, werewolf } = await setupGameActionsTest();
    game.currentPhase = "DAY_VOTE";
    const result = await gameActions.handleVoteAction(game, villager.playerId, werewolf.playerId);
    assertEquals((await result).success, true);
  },
});

Deno.test({
  name: "投票アクション - 他のフェーズでは投票が許可されるべきではない",
  async fn() {
    const { game, villager, werewolf } = await setupGameActionsTest();
    game.currentPhase = "NIGHT";
    const result = await gameActions.handleVoteAction(game, villager.playerId, werewolf.playerId);
    assertEquals((await result).success, false);
  },
});

Deno.test({
  name: "投票アクション - 死亡したプレイヤーは投票できないべき",
  async fn() {
    const { game, villager, werewolf } = await setupGameActionsTest();
    game.currentPhase = "DAY_VOTE";
    villager.isAlive = false;
    const result = await gameActions.handleVoteAction(game, villager.playerId, werewolf.playerId);
    assertEquals((await result).success, false);
  },
});

Deno.test({
  name: "投票アクション - 死亡したプレイヤーへの投票は許可されるべきではない",
  async fn() {
    const { game, villager, werewolf } = await setupGameActionsTest();
    game.currentPhase = "DAY_VOTE";
    werewolf.isAlive = false;
    const result = await gameActions.handleVoteAction(game, villager.playerId, werewolf.playerId);
    assertEquals((await result).success, false);
  },
});
