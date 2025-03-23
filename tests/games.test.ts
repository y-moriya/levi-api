import {
  assertEquals,
  assertNotEquals,
  assertRejects,
} from "https://deno.land/std@0.210.0/assert/mod.ts";
import { describe, it, beforeEach, afterEach } from "https://deno.land/std@0.210.0/testing/bdd.ts";
import * as gameModel from "../models/game.ts";
import * as authService from "../services/auth.ts";
import { GameCreation } from "../types/game.ts";

describe("Game Management", () => {
  const testUser1 = {
    username: "player1",
    email: "player1@example.com",
    password: "password123",
  };

  const testUser2 = {
    username: "player2",
    email: "player2@example.com",
    password: "password123",
  };

  const testGameData: GameCreation = {
    name: "Test Game",
    maxPlayers: 5,
  };

  let user1: { id: string };
  let user2: { id: string };

  beforeEach(async () => {
    // Reset stores
    gameModel.resetGames();
    authService.resetStore();

    // Create test users
    user1 = await authService.register(testUser1);
    user2 = await authService.register(testUser2);
  });

  describe("createGame", () => {
    it("should create a new game successfully", async () => {
      const game = await gameModel.createGame(testGameData, user1.id);

      assertEquals(game.name, testGameData.name);
      assertEquals(game.maxPlayers, testGameData.maxPlayers);
      assertEquals(game.owner.id, user1.id);
      assertEquals(game.status, "WAITING");
      assertEquals(game.currentPlayers, 1);
      assertEquals(game.players.length, 1);
      assertEquals(game.players[0].playerId, user1.id);
    });

    it("should fail when owner does not exist", async () => {
      await assertRejects(
        async () => {
          await gameModel.createGame(testGameData, "non-existent-id");
        },
        Error,
        "Owner not found"
      );
    });

    it("should create game with default settings when not provided", async () => {
      const game = await gameModel.createGame(testGameData, user1.id);

      assertEquals(game.settings.dayTimeSeconds, 300);
      assertEquals(game.settings.nightTimeSeconds, 180);
      assertEquals(game.settings.voteTimeSeconds, 60);
      assertEquals(game.settings.roles.werewolfCount, 2);
      assertEquals(game.settings.roles.seerCount, 1);
      assertEquals(game.settings.roles.bodyguardCount, 1);
      assertEquals(game.settings.roles.mediumCount, 0);
    });
  });

  describe("joinGame", () => {
    let gameId: string;

    beforeEach(async () => {
      const game = await gameModel.createGame(testGameData, user1.id);
      gameId = game.id;
    });

    it("should allow a player to join a game", async () => {
      const game = await gameModel.joinGame(gameId, user2.id);

      assertEquals(game.currentPlayers, 2);
      assertEquals(game.players.length, 2);
      assertEquals(game.players[1].playerId, user2.id);
      assertEquals(game.players[1].username, testUser2.username);
    });

    it("should not allow joining a non-existent game", async () => {
      await assertRejects(
        async () => {
          await gameModel.joinGame("non-existent-id", user2.id);
        },
        Error,
        "Game not found"
      );
    });

    it("should not allow joining a full game", async () => {
      // Fill up the game with unique users
      const additionalUsers = [];
      for (let i = 2; i <= testGameData.maxPlayers; i++) {
        const testUser = {
          username: `player${i}`,
          email: `player${i}_${Date.now()}@example.com`,
          password: "password123",
        };
        const user = await authService.register(testUser);
        additionalUsers.push(user);
        await gameModel.joinGame(gameId, user.id);
      }

      // Try to add one more player
      const extraUser = await authService.register({
        username: "extra",
        email: `extra_${Date.now()}@example.com`,
        password: "password123",
      });

      await assertRejects(
        async () => {
          await gameModel.joinGame(gameId, extraUser.id);
        },
        Error,
        "Game is full"
      );
    });

    it("should not allow joining twice", async () => {
      await gameModel.joinGame(gameId, user2.id);

      await assertRejects(
        async () => {
          await gameModel.joinGame(gameId, user2.id);
        },
        Error,
        "Player already in game"
      );
    });
  });

  describe("leaveGame", () => {
    let gameId: string;

    beforeEach(async () => {
      const game = await gameModel.createGame(testGameData, user1.id);
      gameId = game.id;
      await gameModel.joinGame(gameId, user2.id);
    });

    it("should allow a player to leave a game", async () => {
      const game = await gameModel.leaveGame(gameId, user2.id);

      assertEquals(game.currentPlayers, 1);
      assertEquals(game.players.length, 1);
      assertEquals(game.players[0].playerId, user1.id);
    });

    it("should delete the game when owner leaves", async () => {
      await assertRejects(
        async () => {
          await gameModel.leaveGame(gameId, user1.id);
        },
        Error,
        "Game deleted as owner left"
      );

      // Verify game is deleted
      const game = gameModel.getGameById(gameId);
      assertEquals(game, undefined);
    });

    it("should not allow leaving a non-existent game", async () => {
      await assertRejects(
        async () => {
          await gameModel.leaveGame("non-existent-id", user2.id);
        },
        Error,
        "Game not found"
      );
    });

    it("should not allow leaving if player is not in game", async () => {
      const extraUser = await authService.register({
        username: "extra",
        email: "extra@example.com",
        password: "password123",
      });

      await assertRejects(
        async () => {
          await gameModel.leaveGame(gameId, extraUser.id);
        },
        Error,
        "Player not in game"
      );
    });
  });

  describe("getAllGames", () => {
    it("should return all created games", async () => {
      const game1 = await gameModel.createGame({
        ...testGameData,
        name: "Game 1"
      }, user1.id);

      const game2 = await gameModel.createGame({
        ...testGameData,
        name: "Game 2"
      }, user2.id);

      const games = gameModel.getAllGames();

      assertEquals(games.length, 2);
      assertEquals(games[0].id, game1.id);
      assertEquals(games[1].id, game2.id);
    });

    it("should return empty array when no games exist", () => {
      const games = gameModel.getAllGames();
      assertEquals(games.length, 0);
    });
  });

  describe("getGameById", () => {
    let gameId: string;

    beforeEach(async () => {
      const game = await gameModel.createGame(testGameData, user1.id);
      gameId = game.id;
    });

    it("should return game by id", () => {
      const game = gameModel.getGameById(gameId);
      assertNotEquals(game, undefined);
      assertEquals(game?.id, gameId);
      assertEquals(game?.name, testGameData.name);
    });

    it("should return undefined for non-existent game", () => {
      const game = gameModel.getGameById("non-existent-id");
      assertEquals(game, undefined);
    });
  });
});