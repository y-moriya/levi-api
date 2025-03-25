import {
  assertEquals,
  assertNotEquals,
} from "https://deno.land/std@0.210.0/assert/mod.ts";
import { describe, it, beforeAll, afterAll, beforeEach, afterEach } from "https://deno.land/std@0.210.0/testing/bdd.ts";
import { apiRequest, consumeResponse, testServer, createAuthenticatedUser } from "../helpers/api.ts";
import { ApiError, UserResponse, GameResponse, GameListResponse } from "../helpers/types.ts";
import app from "../../main.ts";
import * as gameModel from "../../models/game.ts";
import * as authService from "../../services/auth.ts";
import * as gamePhase from "../../services/game-phase.ts";

describe("Games API", () => {
  let ownerAuth: { token: string; user: UserResponse };
  let playerAuth: { token: string; user: UserResponse };

  beforeAll(async () => {
    // Reset stores
    gameModel.resetGames();
    authService.resetStore();

    // Start test server
    await testServer.start(app);

    // Create authenticated users
    ownerAuth = await createAuthenticatedUser({
      username: "gameowner",
      email: `owner${Date.now()}@example.com`,
      password: "password123",
    });

    playerAuth = await createAuthenticatedUser({
      username: "gameplayer",
      email: `player${Date.now()}@example.com`,
      password: "password123",
    });
  });

  afterAll(() => {
    testServer.stop();
  });

  beforeEach(() => {
    gameModel.resetGames();
  });

  afterEach(() => {
    // 各テスト後にすべてのゲームのタイマーをクリア
    const games = gameModel.getAllGames();
    for (const game of games) {
      gamePhase.clearPhaseTimer(game.id);
    }
  });

  describe("GET /games", () => {
    it("should return empty array when no games exist", async () => {
      const response = await apiRequest("GET", "/games", undefined, ownerAuth.token);
      const games = await consumeResponse<GameListResponse>(response);

      assertEquals(response.status, 200);
      assertEquals(games.length, 0);
    });

    it("should return list of all games", async () => {
      // Create two games
      const game1Response = await apiRequest("POST", "/games", {
        name: "Game 1",
        maxPlayers: 5
      }, ownerAuth.token);
      await consumeResponse<GameResponse>(game1Response);

      const game2Response = await apiRequest("POST", "/games", {
        name: "Game 2",
        maxPlayers: 5
      }, ownerAuth.token);
      await consumeResponse<GameResponse>(game2Response);

      const response = await apiRequest("GET", "/games", undefined, ownerAuth.token);
      const games = await consumeResponse<GameListResponse>(response);

      assertEquals(response.status, 200);
      assertEquals(games.length, 2);
      assertEquals(games[0].name, "Game 1");
      assertEquals(games[1].name, "Game 2");
    });
  });

  describe("POST /games", () => {
    const gameData = {
      name: "Test Game",
      maxPlayers: 5,
    };

    it("should create a new game successfully", async () => {
      const response = await apiRequest("POST", "/games", gameData, ownerAuth.token);
      const game = await consumeResponse<GameResponse>(response);

      assertEquals(response.status, 201);
      assertEquals(game.name, gameData.name);
      assertEquals(game.maxPlayers, gameData.maxPlayers);
      assertEquals(game.owner.id, ownerAuth.user.id);
      assertEquals(game.status, "WAITING");
      assertEquals(game.currentPlayers, 1);
    });

    it("should validate game creation input", async () => {
      const invalidGame = {
        name: "a",
        maxPlayers: 2,
      };

      const response = await apiRequest("POST", "/games", invalidGame, ownerAuth.token);
      const data = await consumeResponse<ApiError>(response);

      assertEquals(response.status, 400);
      assertEquals(data.code, "VALIDATION_ERROR");
    });

    it("should require authentication", async () => {
      const response = await apiRequest("POST", "/games", gameData);
      const data = await consumeResponse<ApiError>(response);

      assertEquals(response.status, 401);
      assertEquals(data.code, "UNAUTHORIZED");
    });
  });

  describe("POST /games/:gameId/join", () => {
    let gameId: string;

    beforeEach(async () => {
      const createResponse = await apiRequest("POST", "/games", {
        name: "Test Game",
        maxPlayers: 5
      }, ownerAuth.token);
      const game = await consumeResponse<GameResponse>(createResponse);
      gameId = game.id;
    });

    it("should allow a player to join a game", async () => {
      const response = await apiRequest("POST", `/games/${gameId}/join`, undefined, playerAuth.token);
      const game = await consumeResponse<GameResponse>(response);

      assertEquals(response.status, 200);
      assertEquals(game.currentPlayers, 2);
      assertEquals(game.players.length, 2);
      assertEquals(game.players[1].playerId, playerAuth.user.id);
    });

    it("should not allow joining a non-existent game", async () => {
      const response = await apiRequest(
        "POST",
        "/games/non-existent-id/join",
        undefined,
        playerAuth.token
      );
      const data = await consumeResponse<ApiError>(response);

      assertEquals(response.status, 404);
      assertEquals(data.code, "GAME_NOT_FOUND");
    });

    it("should not allow joining twice", async () => {
      // First join
      const response1 = await apiRequest("POST", `/games/${gameId}/join`, undefined, playerAuth.token);
      await consumeResponse<GameResponse>(response1);

      // Second join attempt
      const response2 = await apiRequest("POST", `/games/${gameId}/join`, undefined, playerAuth.token);
      const data = await consumeResponse<ApiError>(response2);

      assertEquals(response2.status, 400);
      assertEquals(data.code, "JOIN_ERROR");
    });

    it("should require authentication", async () => {
      const response = await apiRequest("POST", `/games/${gameId}/join`);
      const data = await consumeResponse<ApiError>(response);

      assertEquals(response.status, 401);
      assertEquals(data.code, "UNAUTHORIZED");
    });
  });

  describe("POST /games/:gameId/leave", () => {
    let gameId: string;

    beforeEach(async () => {
      const createResponse = await apiRequest("POST", "/games", {
        name: "Test Game",
        maxPlayers: 5
      }, ownerAuth.token);
      const game = await consumeResponse<GameResponse>(createResponse);
      gameId = game.id;

      // Have player join the game
      const joinResponse = await apiRequest("POST", `/games/${gameId}/join`, undefined, playerAuth.token);
      await consumeResponse<GameResponse>(joinResponse);
    });

    it("should allow a player to leave a game", async () => {
      const response = await apiRequest("POST", `/games/${gameId}/leave`, undefined, playerAuth.token);
      const game = await consumeResponse<GameResponse>(response);

      assertEquals(response.status, 200);
      assertEquals(game.currentPlayers, 1);
      assertEquals(game.players.length, 1);
      assertEquals(game.players[0].playerId, ownerAuth.user.id);
    });

    it("should delete the game when owner leaves", async () => {
      const leaveResponse = await apiRequest("POST", `/games/${gameId}/leave`, undefined, ownerAuth.token);
      await consumeResponse<GameResponse>(leaveResponse);

      const checkResponse = await apiRequest("GET", `/games/${gameId}`, undefined, ownerAuth.token);
      const data = await consumeResponse<ApiError>(checkResponse);

      assertEquals(checkResponse.status, 404);
      assertEquals(data.code, "GAME_NOT_FOUND");
    });

    it("should not allow leaving a non-existent game", async () => {
      const response = await apiRequest(
        "POST",
        "/games/non-existent-id/leave",
        undefined,
        playerAuth.token
      );
      const data = await consumeResponse<ApiError>(response);

      assertEquals(response.status, 404);
      assertEquals(data.code, "GAME_NOT_FOUND");
    });

    it("should require authentication", async () => {
      const response = await apiRequest("POST", `/games/${gameId}/leave`);
      const data = await consumeResponse<ApiError>(response);

      assertEquals(response.status, 401);
      assertEquals(data.code, "UNAUTHORIZED");
    });
  });

  describe("POST /games/:gameId/start", () => {
    let gameId: string;

    beforeEach(async () => {
      const createResponse = await apiRequest("POST", "/games", {
        name: "Test Game",
        maxPlayers: 6
      }, ownerAuth.token);
      const game = await consumeResponse<GameResponse>(createResponse);
      gameId = game.id;

      // Add enough players for minimum requirements
      for (let i = 0; i < 4; i++) {
        const player = await createAuthenticatedUser({
          username: `player${i + 3}`,
          email: `player${i + 3}_${Date.now()}@example.com`,
          password: "password123",
        });
        const joinResponse = await apiRequest("POST", `/games/${gameId}/join`, undefined, player.token);
        await consumeResponse<GameResponse>(joinResponse);
      }
    });

    it("should start game successfully", async () => {
      const response = await apiRequest("POST", `/games/${gameId}/start`, undefined, ownerAuth.token);
      const game = await consumeResponse<GameResponse>(response);

      assertEquals(response.status, 200);
      assertEquals(game.status, "IN_PROGRESS");
      assertEquals(game.currentDay, 1);
      assertEquals(game.currentPhase, "DAY_DISCUSSION");
      assertNotEquals(game.phaseEndTime, null);
      assertEquals(game.players.every(p => p.role !== undefined), true);
    });

    it("should not allow non-owner to start game", async () => {
      const response = await apiRequest("POST", `/games/${gameId}/start`, undefined, playerAuth.token);
      const data = await consumeResponse<ApiError>(response);

      assertEquals(response.status, 403);
      assertEquals(data.code, "NOT_OWNER");
    });

    it("should require authentication", async () => {
      const response = await apiRequest("POST", `/games/${gameId}/start`);
      const data = await consumeResponse<ApiError>(response);

      assertEquals(response.status, 401);
      assertEquals(data.code, "UNAUTHORIZED");
    });

    it("should validate minimum player requirements", async () => {
      // Create a new game with just the owner
      const newGameResponse = await apiRequest("POST", "/games", {
        name: "Small Game",
        maxPlayers: 6
      }, ownerAuth.token);
      const newGame = await consumeResponse<GameResponse>(newGameResponse);

      const startResponse = await apiRequest("POST", `/games/${newGame.id}/start`, undefined, ownerAuth.token);
      const data = await consumeResponse<ApiError>(startResponse);

      assertEquals(startResponse.status, 400);
      assertEquals(data.code, "START_ERROR");
    });
  });

  describe("GET /games/:gameId", () => {
    let gameId: string;

    beforeEach(async () => {
      const createResponse = await apiRequest("POST", "/games", {
        name: "Test Game",
        maxPlayers: 5
      }, ownerAuth.token);
      const game = await consumeResponse<GameResponse>(createResponse);
      gameId = game.id;
    });

    it("should return game by id", async () => {
      const response = await apiRequest("GET", `/games/${gameId}`, undefined, ownerAuth.token);
      const game = await consumeResponse<GameResponse>(response);

      assertEquals(response.status, 200);
      assertEquals(game.id, gameId);
      assertEquals(game.name, "Test Game");
    });

    it("should return not found for non-existent game", async () => {
      const response = await apiRequest("GET", `/games/non-existent-id`, undefined, ownerAuth.token);
      const error = await consumeResponse<ApiError>(response);

      assertEquals(response.status, 404);
      assertEquals(error.code, "GAME_NOT_FOUND");
    });

    it("should require authentication", async () => {
      const response = await apiRequest("GET", `/games/${gameId}`);
      const error = await consumeResponse<ApiError>(response);

      assertEquals(response.status, 401);
      assertEquals(error.code, "UNAUTHORIZED");
    });
  });

  describe("Game Actions", () => {
    let gameId: string;
    let game: GameResponse;
    let werewolfAuth: { token: string; user: UserResponse };
    let seerAuth: { token: string; user: UserResponse };
    let bodyguardAuth: { token: string; user: UserResponse };
    let villagerAuth: { token: string; user: UserResponse };

    beforeEach(async () => {
      // ゲーム作成
      const response = await apiRequest("POST", "/games", {
        name: "Test Game",
        maxPlayers: 6,
      }, ownerAuth.token);
      game = await consumeResponse<GameResponse>(response);
      gameId = game.id;

      // 追加のプレイヤーを作成して参加させる
      werewolfAuth = await createAuthenticatedUser({
        username: "werewolf",
        email: `werewolf${Date.now()}@example.com`,
        password: "password123",
      });
      const joinWerewolfResponse = await apiRequest("POST", `/games/${gameId}/join`, undefined, werewolfAuth.token);
      await consumeResponse<GameResponse>(joinWerewolfResponse);

      seerAuth = await createAuthenticatedUser({
        username: "seer",
        email: `seer${Date.now()}@example.com`,
        password: "password123",
      });
      const joinSeerResponse = await apiRequest("POST", `/games/${gameId}/join`, undefined, seerAuth.token);
      await consumeResponse<GameResponse>(joinSeerResponse);

      bodyguardAuth = await createAuthenticatedUser({
        username: "bodyguard",
        email: `bodyguard${Date.now()}@example.com`,
        password: "password123",
      });
      const joinBodyguardResponse = await apiRequest("POST", `/games/${gameId}/join`, undefined, bodyguardAuth.token);
      await consumeResponse<GameResponse>(joinBodyguardResponse);

      villagerAuth = await createAuthenticatedUser({
        username: "villager",
        email: `villager${Date.now()}@example.com`,
        password: "password123",
      });
      const joinVillagerResponse = await apiRequest("POST", `/games/${gameId}/join`, undefined, villagerAuth.token);
      await consumeResponse<GameResponse>(joinVillagerResponse);

      // ゲーム開始
      const startResponse = await apiRequest("POST", `/games/${gameId}/start`, undefined, ownerAuth.token);
      await consumeResponse<GameResponse>(startResponse);
      
      // Initialize game with roles for testing
      const gameInstance = gameModel.getGameById(gameId)!;
      gameInstance.players.find(p => p.playerId === werewolfAuth.user.id)!.role = "WEREWOLF";
      gameInstance.players.find(p => p.playerId === seerAuth.user.id)!.role = "SEER";
      gameInstance.players.find(p => p.playerId === bodyguardAuth.user.id)!.role = "BODYGUARD";
      gameInstance.players.find(p => p.playerId === villagerAuth.user.id)!.role = "VILLAGER";
    });

    describe("Vote Action", () => {
      it("should allow voting during vote phase", async () => {
        const gameInstance = gameModel.getGameById(gameId)!;
        gamePhase.advanceGamePhase(gameInstance); // Advance to DAY_VOTE phase

        const response = await apiRequest("POST", `/games/${gameId}/vote`, {
          targetPlayerId: werewolfAuth.user.id,
        }, ownerAuth.token);

        assertEquals(response.status, 200);
        const result = await consumeResponse<{ success: boolean }>(response);
        assertEquals(result.success, true);
      });

      it("should not allow voting during other phases", async () => {
        const gameInstance = gameModel.getGameById(gameId)!;
        while (gameInstance.currentPhase !== "NIGHT") {
          gamePhase.advanceGamePhase(gameInstance);
        }

        const response = await apiRequest("POST", `/games/${gameId}/vote`, {
          targetPlayerId: werewolfAuth.user.id,
        }, ownerAuth.token);

        assertEquals(response.status, 400);
        const error = await consumeResponse<ApiError>(response);
        assertEquals(error.code, "INVALID_PHASE");
      });
    });

    describe("Attack Action", () => {
      it("should allow werewolf to attack during night", async () => {
        const gameInstance = gameModel.getGameById(gameId)!;
        while (gameInstance.currentPhase !== "NIGHT") {
          gamePhase.advanceGamePhase(gameInstance);
        }

        const response = await apiRequest("POST", `/games/${gameId}/attack`, {
          targetPlayerId: villagerAuth.user.id,
        }, werewolfAuth.token);

        assertEquals(response.status, 200);
        const result = await consumeResponse<{ success: boolean }>(response);
        assertEquals(result.success, true);
      });

      it("should not allow non-werewolf to attack", async () => {
        const gameInstance = gameModel.getGameById(gameId)!;
        while (gameInstance.currentPhase !== "NIGHT") {
          gamePhase.advanceGamePhase(gameInstance);
        }

        const response = await apiRequest("POST", `/games/${gameId}/attack`, {
          targetPlayerId: seerAuth.user.id,
        }, villagerAuth.token);

        assertEquals(response.status, 403);
        const error = await consumeResponse<ApiError>(response);
        assertEquals(error.code, "NOT_WEREWOLF");
      });
    });

    describe("Divine Action", () => {
      it("should allow seer to divine during night", async () => {
        const gameInstance = gameModel.getGameById(gameId)!;
        while (gameInstance.currentPhase !== "NIGHT") {
          gamePhase.advanceGamePhase(gameInstance);
        }

        const response = await apiRequest("POST", `/games/${gameId}/divine`, {
          targetPlayerId: werewolfAuth.user.id,
        }, seerAuth.token);

        assertEquals(response.status, 200);
        const result = await consumeResponse<{ success: boolean }>(response);
        assertEquals(result.success, true);
      });

      it("should not allow non-seer to divine", async () => {
        const gameInstance = gameModel.getGameById(gameId)!;
        while (gameInstance.currentPhase !== "NIGHT") {
          gamePhase.advanceGamePhase(gameInstance);
        }

        const response = await apiRequest("POST", `/games/${gameId}/divine`, {
          targetPlayerId: werewolfAuth.user.id,
        }, villagerAuth.token);

        assertEquals(response.status, 403);
        const error = await consumeResponse<ApiError>(response);
        assertEquals(error.code, "NOT_SEER");
      });
    });

    describe("Guard Action", () => {
      it("should allow bodyguard to guard during night", async () => {
        const gameInstance = gameModel.getGameById(gameId)!;
        while (gameInstance.currentPhase !== "NIGHT") {
          gamePhase.advanceGamePhase(gameInstance);
        }

        const response = await apiRequest("POST", `/games/${gameId}/guard`, {
          targetPlayerId: villagerAuth.user.id,
        }, bodyguardAuth.token);

        assertEquals(response.status, 200);
        const result = await consumeResponse<{ success: boolean }>(response);
        assertEquals(result.success, true);
      });

      it("should not allow non-bodyguard to guard", async () => {
        const gameInstance = gameModel.getGameById(gameId)!;
        while (gameInstance.currentPhase !== "NIGHT") {
          gamePhase.advanceGamePhase(gameInstance);
        }

        const response = await apiRequest("POST", `/games/${gameId}/guard`, {
          targetPlayerId: seerAuth.user.id,
        }, villagerAuth.token);

        assertEquals(response.status, 403);
        const error = await consumeResponse<ApiError>(response);
        assertEquals(error.code, "NOT_BODYGUARD");
      });
    });
  });
});