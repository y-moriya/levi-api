import { assertEquals } from "https://deno.land/std@0.210.0/assert/mod.ts";
import * as gameActions from "../services/game-actions.ts";
import { setupMediumTest } from "./game-actions.test-helpers.ts";
import * as authService from "../services/auth.ts";

Deno.test({
  name: "霊能アクション - 霊能者は前日に処刑された人狼を正しく識別できるべき",
  async fn() {
    const { game, medium, werewolf } = await setupMediumTest();
    game.currentPhase = "NIGHT";
    const result = await gameActions.handleMediumAction(game, medium.playerId, werewolf.playerId);
    assertEquals((await result).success, true);
    assertEquals((await result).isWerewolf, true);
  },
});

Deno.test({
  name: "霊能アクション - 霊能者以外は霊能ができないべき",
  async fn() {
    const { game, villager, werewolf } = await setupMediumTest();
    game.currentPhase = "NIGHT";
    const result = await gameActions.handleMediumAction(game, villager.playerId, werewolf.playerId);
    assertEquals((await result).success, false);
  },
});

Deno.test({
  name: "霊能アクション - 前日に処刑されていないプレイヤーは対象にできないべき",
  async fn() {
    const { game, medium, villager } = await setupMediumTest();
    game.currentPhase = "NIGHT";
    const result = await gameActions.handleMediumAction(game, medium.playerId, villager.playerId);
    assertEquals((await result).success, false);
  },
});

Deno.test({
  name: "霊能アクション - 処刑以外の死因のプレイヤーは対象にできないべき",
  async fn() {
    const { game, medium, werewolf } = await setupMediumTest();
    game.currentPhase = "NIGHT";
    werewolf.deathCause = "WEREWOLF_ATTACK";
    const result = await gameActions.handleMediumAction(game, medium.playerId, werewolf.playerId);
    assertEquals((await result).success, false);
  },
});

Deno.test({
  name: "霊能アクション - 昼のディスカッションフェーズでも使用できるべき",
  async fn() {
    const { game, medium, werewolf } = await setupMediumTest();
    game.currentPhase = "DAY_DISCUSSION";
    const result = await gameActions.handleMediumAction(game, medium.playerId, werewolf.playerId);
    assertEquals((await result).success, true);
    assertEquals((await result).isWerewolf, true);
  },
});

Deno.test({
  name: "霊能アクション - 投票フェーズでは使用できないべき",
  async fn() {
    const { game, medium, werewolf } = await setupMediumTest();
    game.currentPhase = "DAY_VOTE";
    const result = await gameActions.handleMediumAction(game, medium.playerId, werewolf.playerId);
    assertEquals((await result).success, false);
  },
});

Deno.test({
  name: "霊能アクション - 非人狼プレイヤーを正しく識別するべき",
  async fn() {
    const { game, medium, werewolf, villager } = await setupMediumTest();
    game.currentPhase = "NIGHT";
    werewolf.isAlive = true;
    werewolf.deathCause = "NONE";
    werewolf.deathDay = undefined;

    villager.isAlive = false;
    villager.deathCause = "EXECUTION";
    villager.deathDay = 1;

    const result = await gameActions.handleMediumAction(game, medium.playerId, villager.playerId);
    assertEquals((await result).success, true);
    assertEquals((await result).isWerewolf, false);
  },
});

Deno.test({
  name: "霊能アクション - 死亡した霊能者は霊能ができないべき",
  async fn() {
    const { game, medium, werewolf } = await setupMediumTest();
    game.currentPhase = "NIGHT";
    medium.isAlive = false;
    medium.deathCause = "WEREWOLF_ATTACK";
    medium.deathDay = 1;

    const result = await gameActions.handleMediumAction(game, medium.playerId, werewolf.playerId);
    assertEquals((await result).success, false);
  },
});

Deno.test({
  name: "霊能アクション - 2日以上前に処刑されたプレイヤーは対象にできないべき",
  async fn() {
    const { game, medium, werewolf } = await setupMediumTest();
    game.currentPhase = "NIGHT";
    werewolf.deathDay = game.currentDay - 2;

    const result = await gameActions.handleMediumAction(game, medium.playerId, werewolf.playerId);
    assertEquals((await result).success, false);
  },
});

Deno.test({
  name: "霊能アクション - 同じ処刑者に対して複数の霊能者が霊能できるべき",
  async fn() {
    const { game, medium, werewolf } = await setupMediumTest();
    game.currentPhase = "NIGHT";

    const secondMediumUser = await authService.register({
      username: "medium2",
      email: "medium2@test.com",
      password: "password",
    });

    game.players.push({
      playerId: secondMediumUser.id,
      username: "medium2",
      role: "MEDIUM",
      isAlive: true,
      deathCause: "NONE",
    });

    const medium2 = game.players[5];

    const result1 = await gameActions.handleMediumAction(game, medium.playerId, werewolf.playerId);
    const result2 = await gameActions.handleMediumAction(game, medium2.playerId, werewolf.playerId);

    assertEquals((await result1).success, true);
    assertEquals((await result1).isWerewolf, true);
    assertEquals((await result2).success, true);
    assertEquals((await result2).isWerewolf, true);
  },
});

Deno.test({
  name: "霊能アクション - 処刑された霊能者は自分自身を霊能対象にできないべき",
  async fn() {
    const { game, medium } = await setupMediumTest();
    game.currentPhase = "NIGHT";

    medium.isAlive = false;
    medium.deathCause = "EXECUTION";
    medium.deathDay = 1;

    const secondMediumUser = await authService.register({
      username: "medium2",
      email: "medium2@test.com",
      password: "password",
    });

    game.players.push({
      playerId: secondMediumUser.id,
      username: "medium2",
      role: "MEDIUM",
      isAlive: true,
      deathCause: "NONE",
    });

    const medium2 = game.players[5];

    const result = await gameActions.handleMediumAction(game, medium2.playerId, medium.playerId);

    assertEquals((await result).success, true);
    assertEquals((await result).isWerewolf, false);
  },
});

Deno.test({
  name: "霊能アクション - 実行後にアクションマップに正しく記録されるべき",
  async fn() {
    const { game, medium, werewolf } = await setupMediumTest();
    game.currentPhase = "NIGHT";

    const result = await gameActions.handleMediumAction(game, medium.playerId, werewolf.playerId);
    assertEquals((await result).success, true);

    const actions = await gameActions.getGameActions(game.id);

    assertEquals(actions?.mediums.has(medium.playerId), true);
    assertEquals(actions?.mediums.get(medium.playerId), werewolf.playerId);
  },
});
