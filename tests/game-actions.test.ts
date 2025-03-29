import {
  assertEquals,
  assertNotEquals,
} from "https://deno.land/std@0.210.0/assert/mod.ts";
import * as gameActions from "../services/game-actions.ts";
import * as gameModel from "../models/game.ts";
import * as authService from "../services/auth.ts";
import { Game, GamePlayer } from "../types/game.ts";

let game: Game;
let villager: GamePlayer;
let werewolf: GamePlayer;
let seer: GamePlayer;
let bodyguard: GamePlayer;

async function setupTest() {
  // ゲーム状態のリセット
  gameModel.resetGames();
  authService.resetStore();

  // テストユーザーの作成
  const testUsers = [
    { username: "villager", email: "villager@test.com", password: "password" },
    { username: "werewolf", email: "werewolf@test.com", password: "password" },
    { username: "seer", email: "seer@test.com", password: "password" },
    { username: "bodyguard", email: "bodyguard@test.com", password: "password" },
  ];

  const users = await Promise.all(
    testUsers.map(user => authService.register(user))
  );

  // テストゲームの作成
  const testGame = await gameModel.createGame({
    name: "Test Game",
    maxPlayers: 4,
  }, users[0].id);

  // プレイヤーの参加
  for (let i = 1; i < users.length; i++) {
    await gameModel.joinGame(testGame.id, users[i].id);
  }

  // ゲームの取得と初期化
  game = gameModel.getGameById(testGame.id)!;
  game.status = "IN_PROGRESS";
  game.currentDay = 1;

  // プレイヤーに役職を割り当て
  game.players[0].role = "VILLAGER";
  game.players[1].role = "WEREWOLF";
  game.players[2].role = "SEER";
  game.players[3].role = "BODYGUARD";

  villager = game.players[0];
  werewolf = game.players[1];
  seer = game.players[2];
  bodyguard = game.players[3];

  // アクション状態の初期化
  gameActions.initializeGameActions(game.id);
}

// Vote Action Tests
Deno.test({
  name: "Vote Actions - should allow voting during vote phase",
  async fn() {
    await setupTest();
    game.currentPhase = "DAY_VOTE";
    const result = gameActions.handleVoteAction(game, villager.playerId, werewolf.playerId);
    assertEquals(result.success, true);
  }
});

Deno.test({
  name: "Vote Actions - should not allow voting during other phases",
  async fn() {
    await setupTest();
    game.currentPhase = "NIGHT";
    const result = gameActions.handleVoteAction(game, villager.playerId, werewolf.playerId);
    assertEquals(result.success, false);
  }
});

Deno.test({
  name: "Vote Actions - should not allow dead players to vote",
  async fn() {
    await setupTest();
    game.currentPhase = "DAY_VOTE";
    villager.isAlive = false;
    const result = gameActions.handleVoteAction(game, villager.playerId, werewolf.playerId);
    assertEquals(result.success, false);
  }
});

Deno.test({
  name: "Vote Actions - should not allow voting for dead players",
  async fn() {
    await setupTest();
    game.currentPhase = "DAY_VOTE";
    werewolf.isAlive = false;
    const result = gameActions.handleVoteAction(game, villager.playerId, werewolf.playerId);
    assertEquals(result.success, false);
  }
});

// Attack Action Tests
Deno.test({
  name: "Attack Actions - should allow werewolf to attack during night",
  async fn() {
    await setupTest();
    game.currentPhase = "NIGHT";
    const result = gameActions.handleAttackAction(game, werewolf.playerId, villager.playerId);
    assertEquals(result.success, true);
  }
});

Deno.test({
  name: "Attack Actions - should not allow non-werewolf to attack",
  async fn() {
    await setupTest();
    game.currentPhase = "NIGHT";
    const result = gameActions.handleAttackAction(game, villager.playerId, seer.playerId);
    assertEquals(result.success, false);
  }
});

Deno.test({
  name: "Attack Actions - should not allow attacking werewolf",
  async fn() {
    await setupTest();
    game.currentPhase = "NIGHT";
    const result = gameActions.handleAttackAction(game, werewolf.playerId, werewolf.playerId);
    assertEquals(result.success, false);
  }
});

Deno.test({
  name: "Attack Actions - should not allow attacking during day",
  async fn() {
    await setupTest();
    game.currentPhase = "DAY_DISCUSSION";
    const result = gameActions.handleAttackAction(game, werewolf.playerId, villager.playerId);
    assertEquals(result.success, false);
  }
});

// Divine Action Tests
Deno.test({
  name: "Divine Actions - should allow seer to divine during night",
  async fn() {
    await setupTest();
    game.currentPhase = "NIGHT";
    const result = gameActions.handleDivineAction(game, seer.playerId, werewolf.playerId);
    assertEquals(result.success, true);
    assertEquals(result.isWerewolf, true);
  }
});

Deno.test({
  name: "Divine Actions - should not allow non-seer to divine",
  async fn() {
    await setupTest();
    game.currentPhase = "NIGHT";
    const result = gameActions.handleDivineAction(game, villager.playerId, werewolf.playerId);
    assertEquals(result.success, false);
  }
});

Deno.test({
  name: "Divine Actions - should correctly identify non-werewolf",
  async fn() {
    await setupTest();
    game.currentPhase = "NIGHT";
    const result = gameActions.handleDivineAction(game, seer.playerId, villager.playerId);
    assertEquals(result.success, true);
    assertEquals(result.isWerewolf, false);
  }
});

Deno.test({
  name: "Divine Actions - should not allow divination during day",
  async fn() {
    await setupTest();
    game.currentPhase = "DAY_DISCUSSION";
    const result = gameActions.handleDivineAction(game, seer.playerId, werewolf.playerId);
    assertEquals(result.success, false);
  }
});

// Guard Action Tests
Deno.test({
  name: "Guard Actions - should allow bodyguard to guard during night",
  async fn() {
    await setupTest();
    game.currentPhase = "NIGHT";
    const result = gameActions.handleGuardAction(game, bodyguard.playerId, villager.playerId);
    assertEquals(result.success, true);
  }
});

Deno.test({
  name: "Guard Actions - should not allow non-bodyguard to guard",
  async fn() {
    await setupTest();
    game.currentPhase = "NIGHT";
    const result = gameActions.handleGuardAction(game, villager.playerId, seer.playerId);
    assertEquals(result.success, false);
  }
});

Deno.test({
  name: "Guard Actions - should not allow guarding dead players",
  async fn() {
    await setupTest();
    game.currentPhase = "NIGHT";
    villager.isAlive = false;
    const result = gameActions.handleGuardAction(game, bodyguard.playerId, villager.playerId);
    assertEquals(result.success, false);
  }
});

Deno.test({
  name: "Guard Actions - should not allow guarding during day",
  async fn() {
    await setupTest();
    game.currentPhase = "DAY_DISCUSSION";
    const result = gameActions.handleGuardAction(game, bodyguard.playerId, villager.playerId);
    assertEquals(result.success, false);
  }
});

// Phase Actions Processing Tests
Deno.test({
  name: "Phase Actions Processing - should process vote results correctly",
  async fn() {
    await setupTest();
    game.currentPhase = "DAY_VOTE";
    // 全員がwerewolfに投票
    gameActions.handleVoteAction(game, villager.playerId, werewolf.playerId);
    gameActions.handleVoteAction(game, seer.playerId, werewolf.playerId);
    gameActions.handleVoteAction(game, bodyguard.playerId, werewolf.playerId);

    gameActions.processPhaseActions(game);
    assertEquals(werewolf.isAlive, false);
    assertEquals(werewolf.deathCause, "EXECUTION");
  }
});

Deno.test({
  name: "Phase Actions Processing - should handle guard protection",
  async fn() {
    await setupTest();
    game.currentPhase = "NIGHT";
    
    // 人狼が村人を攻撃
    gameActions.handleAttackAction(game, werewolf.playerId, villager.playerId);
    // 護衛が村人を守る
    gameActions.handleGuardAction(game, bodyguard.playerId, villager.playerId);

    gameActions.processPhaseActions(game);
    assertEquals(villager.isAlive, true);
    assertEquals(villager.deathCause, "NONE");
  }
});

Deno.test({
  name: "Phase Actions Processing - should handle random actions for inactive players",
  async fn() {
    await setupTest();
    game.currentPhase = "NIGHT";
    gameActions.processPhaseActions(game);
    
    const actions = gameActions.getGameActions(game.id);
    assertNotEquals(actions, undefined);
  }
});