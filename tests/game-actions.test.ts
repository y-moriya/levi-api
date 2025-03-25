import {
  assertEquals,
  assertNotEquals,
} from "https://deno.land/std@0.210.0/assert/mod.ts";
import { describe, it, beforeEach } from "https://deno.land/std@0.210.0/testing/bdd.ts";
import * as gameActions from "../services/game-actions.ts";
import * as gameModel from "../models/game.ts";
import * as authService from "../services/auth.ts";
import { Game, GamePlayer } from "../types/game.ts";

describe("Game Actions", () => {
  let game: Game;
  let villager: GamePlayer;
  let werewolf: GamePlayer;
  let seer: GamePlayer;
  let bodyguard: GamePlayer;

  beforeEach(async () => {
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
  });

  describe("Vote Actions", () => {
    beforeEach(() => {
      game.currentPhase = "DAY_VOTE";
    });

    it("should allow voting during vote phase", () => {
      const result = gameActions.handleVoteAction(game, villager.playerId, werewolf.playerId);
      assertEquals(result.success, true);
    });

    it("should not allow voting during other phases", () => {
      game.currentPhase = "NIGHT";
      const result = gameActions.handleVoteAction(game, villager.playerId, werewolf.playerId);
      assertEquals(result.success, false);
    });

    it("should not allow dead players to vote", () => {
      villager.isAlive = false;
      const result = gameActions.handleVoteAction(game, villager.playerId, werewolf.playerId);
      assertEquals(result.success, false);
    });

    it("should not allow voting for dead players", () => {
      werewolf.isAlive = false;
      const result = gameActions.handleVoteAction(game, villager.playerId, werewolf.playerId);
      assertEquals(result.success, false);
    });
  });

  describe("Attack Actions", () => {
    beforeEach(() => {
      game.currentPhase = "NIGHT";
    });

    it("should allow werewolf to attack during night", () => {
      const result = gameActions.handleAttackAction(game, werewolf.playerId, villager.playerId);
      assertEquals(result.success, true);
    });

    it("should not allow non-werewolf to attack", () => {
      const result = gameActions.handleAttackAction(game, villager.playerId, seer.playerId);
      assertEquals(result.success, false);
    });

    it("should not allow attacking werewolf", () => {
      const result = gameActions.handleAttackAction(game, werewolf.playerId, werewolf.playerId);
      assertEquals(result.success, false);
    });

    it("should not allow attacking during day", () => {
      game.currentPhase = "DAY_DISCUSSION";
      const result = gameActions.handleAttackAction(game, werewolf.playerId, villager.playerId);
      assertEquals(result.success, false);
    });
  });

  describe("Divine Actions", () => {
    beforeEach(() => {
      game.currentPhase = "NIGHT";
    });

    it("should allow seer to divine during night", () => {
      const result = gameActions.handleDivineAction(game, seer.playerId, werewolf.playerId);
      assertEquals(result.success, true);
      assertEquals(result.isWerewolf, true);
    });

    it("should not allow non-seer to divine", () => {
      const result = gameActions.handleDivineAction(game, villager.playerId, werewolf.playerId);
      assertEquals(result.success, false);
    });

    it("should correctly identify non-werewolf", () => {
      const result = gameActions.handleDivineAction(game, seer.playerId, villager.playerId);
      assertEquals(result.success, true);
      assertEquals(result.isWerewolf, false);
    });

    it("should not allow divination during day", () => {
      game.currentPhase = "DAY_DISCUSSION";
      const result = gameActions.handleDivineAction(game, seer.playerId, werewolf.playerId);
      assertEquals(result.success, false);
    });
  });

  describe("Guard Actions", () => {
    beforeEach(() => {
      game.currentPhase = "NIGHT";
    });

    it("should allow bodyguard to guard during night", () => {
      const result = gameActions.handleGuardAction(game, bodyguard.playerId, villager.playerId);
      assertEquals(result.success, true);
    });

    it("should not allow non-bodyguard to guard", () => {
      const result = gameActions.handleGuardAction(game, villager.playerId, seer.playerId);
      assertEquals(result.success, false);
    });

    it("should not allow guarding dead players", () => {
      villager.isAlive = false;
      const result = gameActions.handleGuardAction(game, bodyguard.playerId, villager.playerId);
      assertEquals(result.success, false);
    });

    it("should not allow guarding during day", () => {
      game.currentPhase = "DAY_DISCUSSION";
      const result = gameActions.handleGuardAction(game, bodyguard.playerId, villager.playerId);
      assertEquals(result.success, false);
    });
  });

  describe("Phase Actions Processing", () => {
    it("should process vote results correctly", () => {
      game.currentPhase = "DAY_VOTE";
      // 全員がwerewolfに投票
      gameActions.handleVoteAction(game, villager.playerId, werewolf.playerId);
      gameActions.handleVoteAction(game, seer.playerId, werewolf.playerId);
      gameActions.handleVoteAction(game, bodyguard.playerId, werewolf.playerId);
      
      gameActions.processPhaseActions(game);
      
      assertEquals(werewolf.isAlive, false);
      assertEquals(werewolf.deathCause, "EXECUTION");
    });

    it("should process night actions correctly", () => {
      game.currentPhase = "NIGHT";
      
      // 狩人が村人を護衛
      gameActions.handleGuardAction(game, bodyguard.playerId, villager.playerId);
      // 人狼が村人を襲撃
      gameActions.handleAttackAction(game, werewolf.playerId, villager.playerId);
      // 占い師が人狼を占う
      gameActions.handleDivineAction(game, seer.playerId, werewolf.playerId);
      
      gameActions.processPhaseActions(game);
      
      // 護衛されているので村人は生存しているはず
      assertEquals(villager.isAlive, true);
      assertEquals(villager.deathCause, "NONE");
    });

    it("should handle random actions for inactive players", () => {
      game.currentPhase = "NIGHT";
      gameActions.processPhaseActions(game);
      
      const actions = gameActions.getGameActions(game.id);
      assertNotEquals(actions, undefined);
    });
  });
});