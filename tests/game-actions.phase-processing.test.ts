import { assertEquals, assertNotEquals } from "https://deno.land/std@0.210.0/assert/mod.ts";
import * as gameActions from "../services/game-actions.ts";
import { setupGameActionsTest } from "./game-actions.test-helpers.ts";

Deno.test({
  name: "フェーズアクション処理 - 投票結果が正しく処理されるべき",
  async fn() {
    const { game, villager, werewolf, seer, bodyguard } = await setupGameActionsTest();
    game.currentPhase = "DAY_VOTE";
    await gameActions.handleVoteAction(game, villager.playerId, werewolf.playerId);
    await gameActions.handleVoteAction(game, seer.playerId, werewolf.playerId);
    await gameActions.handleVoteAction(game, bodyguard.playerId, werewolf.playerId);

    await gameActions.processPhaseActions(game);

    const actions = await gameActions.getGameActions(game.id);
    assertEquals(actions?.votes.size, 4);

    let votesForWerewolf = 0;
    actions?.votes.forEach((targetId) => {
      if (targetId === werewolf.playerId) votesForWerewolf++;
    });
    assertEquals(votesForWerewolf >= 3, true);
  },
});

Deno.test({
  name: "フェーズアクション処理 - 護衛の保護を処理するべき",
  async fn() {
    const { game, werewolf, villager, bodyguard } = await setupGameActionsTest();
    game.currentPhase = "NIGHT";

    await gameActions.handleAttackAction(game, werewolf.playerId, villager.playerId);
    await gameActions.handleGuardAction(game, bodyguard.playerId, villager.playerId);

    await gameActions.processPhaseActions(game);
    assertEquals(villager.isAlive, true);
    assertEquals(villager.deathCause, "NONE");
  },
});

Deno.test({
  name: "フェーズアクション処理 - 非アクティブプレイヤーのランダムアクションを処理するべき",
  async fn() {
    const { game } = await setupGameActionsTest();
    game.currentPhase = "NIGHT";
    await gameActions.processPhaseActions(game);

    const actions = await gameActions.getGameActions(game.id);
    assertNotEquals(actions, undefined);
  },
});
