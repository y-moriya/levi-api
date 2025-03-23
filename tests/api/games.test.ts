import {
  assertEquals,
} from "https://deno.land/std@0.210.0/assert/mod.ts";
import { describe, it, beforeAll, afterAll, beforeEach } from "https://deno.land/std@0.210.0/testing/bdd.ts";
import { apiRequest, consumeResponse, testServer, createAuthenticatedUser } from "../helpers/api.ts";
import { ApiError, UserResponse, GameResponse, GameListResponse } from "../helpers/types.ts";
import app from "../../main.ts";
import * as gameModel from "../../models/game.ts";
import * as authService from "../../services/auth.ts";

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
});