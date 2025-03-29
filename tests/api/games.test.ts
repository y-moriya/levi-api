import {
  assertEquals,
  assertNotEquals,
} from "https://deno.land/std@0.210.0/assert/mod.ts";
import { apiRequest, consumeResponse, testServer, createAuthenticatedUser } from "../helpers/api.ts";
import { ApiError, UserResponse, GameResponse, GameListResponse } from "../helpers/types.ts";
import app from "../../main.ts";
import * as gameModel from "../../models/game.ts";
import * as authService from "../../services/auth.ts";
import * as gamePhase from "../../services/game-phase.ts";

let ownerAuth: { token: string; user: UserResponse };
let playerAuth: { token: string; user: UserResponse };

// セットアップとクリーンアップ
async function setupTests() {
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
}

async function cleanupTests() {
  // Clean up games
  const games = gameModel.getAllGames();
  for (const game of games) {
    gamePhase.clearPhaseTimer(game.id);
  }
  await testServer.stop();
}

// サーバーセットアップのテスト
Deno.test({
  name: "Games API Server Setup",
  async fn() {
    await setupTests();
    await cleanupTests();
  }
});

// Game Listing Tests
Deno.test({
  name: "Games Listing - should return empty array when no games exist",
  async fn() {
    await setupTests();
    const response = await apiRequest("GET", "/games", undefined, ownerAuth.token);
    const games = await consumeResponse<GameListResponse>(response);

    assertEquals(response.status, 200);
    assertEquals(games.length, 0);

    await cleanupTests();
  }
});

Deno.test({
  name: "Games Listing - should return list of all games",
  async fn() {
    await setupTests();
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

    await cleanupTests();
  }
});

// Game Creation Tests
Deno.test({
  name: "Game Creation - should create a new game successfully",
  async fn() {
    await setupTests();
    const gameData = {
      name: "Test Game",
      maxPlayers: 5,
    };

    const response = await apiRequest("POST", "/games", gameData, ownerAuth.token);
    const game = await consumeResponse<GameResponse>(response);

    assertEquals(response.status, 201);
    assertEquals(game.name, gameData.name);
    assertEquals(game.maxPlayers, gameData.maxPlayers);
    assertEquals(game.owner.id, ownerAuth.user.id);
    assertEquals(game.status, "WAITING");
    assertEquals(game.currentPlayers, 1);

    await cleanupTests();
  }
});

Deno.test({
  name: "Game Creation - should validate game creation input",
  async fn() {
    await setupTests();
    const invalidGame = {
      name: "a",
      maxPlayers: 2,
    };

    const response = await apiRequest("POST", "/games", invalidGame, ownerAuth.token);
    const data = await consumeResponse<ApiError>(response);

    assertEquals(response.status, 400);
    assertEquals(data.code, "VALIDATION_ERROR");

    await cleanupTests();
  }
});

Deno.test({
  name: "Game Creation - should require authentication",
  async fn() {
    await setupTests();
    const gameData = {
      name: "Test Game",
      maxPlayers: 5,
    };

    const response = await apiRequest("POST", "/games", gameData);
    const data = await consumeResponse<ApiError>(response);

    assertEquals(response.status, 401);
    assertEquals(data.code, "UNAUTHORIZED");

    await cleanupTests();
  }
});

// Game Joining Tests
Deno.test({
  name: "Game Joining - should allow a player to join a game",
  async fn() {
    await setupTests();
    const createResponse = await apiRequest("POST", "/games", {
      name: "Test Game",
      maxPlayers: 5
    }, ownerAuth.token);
    const newGame = await consumeResponse<GameResponse>(createResponse);
    const gameId = newGame.id;

    const response = await apiRequest("POST", `/games/${gameId}/join`, undefined, playerAuth.token);
    const game = await consumeResponse<GameResponse>(response);

    assertEquals(response.status, 200);
    assertEquals(game.currentPlayers, 2);
    assertEquals(game.players.length, 2);
    assertEquals(game.players[1].playerId, playerAuth.user.id);

    await cleanupTests();
  }
});

// Game Leaving Tests
Deno.test({
  name: "Game Leaving - should allow a player to leave a game",
  async fn() {
    await setupTests();
    const createResponse = await apiRequest("POST", "/games", {
      name: "Test Game",
      maxPlayers: 5
    }, ownerAuth.token);
    const game = await consumeResponse<GameResponse>(createResponse);
    const gameId = game.id;

    // Have player join the game
    const joinResponse = await apiRequest("POST", `/games/${gameId}/join`, undefined, playerAuth.token);
    await consumeResponse<GameResponse>(joinResponse);

    // Test leaving game
    const leaveResponse = await apiRequest("POST", `/games/${gameId}/leave`, undefined, playerAuth.token);
    const updatedGame = await consumeResponse<GameResponse>(leaveResponse);

    assertEquals(leaveResponse.status, 200);
    assertEquals(updatedGame.currentPlayers, 1);
    assertEquals(updatedGame.players.length, 1);
    assertEquals(updatedGame.players[0].playerId, ownerAuth.user.id);

    await cleanupTests();
  }
});

// Game Starting Tests
Deno.test({
  name: "Game Starting - should start game successfully",
  async fn() {
    await setupTests();
    const createResponse = await apiRequest("POST", "/games", {
      name: "Test Game",
      maxPlayers: 6
    }, ownerAuth.token);
    const game = await consumeResponse<GameResponse>(createResponse);
    const gameId = game.id;

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

    const startResponse = await apiRequest("POST", `/games/${gameId}/start`, undefined, ownerAuth.token);
    const startedGame = await consumeResponse<GameResponse>(startResponse);

    assertEquals(startResponse.status, 200);
    assertEquals(startedGame.status, "IN_PROGRESS");
    assertEquals(startedGame.currentDay, 1);
    assertEquals(startedGame.currentPhase, "DAY_DISCUSSION");
    assertNotEquals(startedGame.phaseEndTime, null);
    assertEquals(startedGame.players.every(p => p.role !== undefined), true);

    await cleanupTests();
  }
});

// Game Actions Tests
Deno.test({
  name: "Game Actions - Voting",
  async fn() {
    await setupTests();
    const createResponse = await apiRequest("POST", "/games", {
      name: "Test Game",
      maxPlayers: 6
    }, ownerAuth.token);
    const game = await consumeResponse<GameResponse>(createResponse);
    const gameId = game.id;

    // Create and add players with specific roles
    const werewolfAuth = await createAuthenticatedUser({
      username: "werewolf",
      email: `werewolf${Date.now()}@example.com`,
      password: "password123",
    });
    const joinWerewolfResponse = await apiRequest("POST", `/games/${gameId}/join`, undefined, werewolfAuth.token);
    await consumeResponse<GameResponse>(joinWerewolfResponse);

    const seerAuth = await createAuthenticatedUser({
      username: "seer",
      email: `seer${Date.now()}@example.com`,
      password: "password123",
    });
    const joinSeerResponse = await apiRequest("POST", `/games/${gameId}/join`, undefined, seerAuth.token);
    await consumeResponse<GameResponse>(joinSeerResponse);

    const bodyguardAuth = await createAuthenticatedUser({
      username: "bodyguard",
      email: `bodyguard${Date.now()}@example.com`,
      password: "password123",
    });
    const joinBodyguardResponse = await apiRequest("POST", `/games/${gameId}/join`, undefined, bodyguardAuth.token);
    await consumeResponse<GameResponse>(joinBodyguardResponse);

    const villagerAuth = await createAuthenticatedUser({
      username: "villager",
      email: `villager${Date.now()}@example.com`,
      password: "password123",
    });
    const joinVillagerResponse = await apiRequest("POST", `/games/${gameId}/join`, undefined, villagerAuth.token);
    await consumeResponse<GameResponse>(joinVillagerResponse);

    // Start game
    const startResponse = await apiRequest("POST", `/games/${gameId}/start`, undefined, ownerAuth.token);
    await consumeResponse<GameResponse>(startResponse);
    
    // Initialize game with roles for testing
    const gameInstance = gameModel.getGameById(gameId)!;
    gameInstance.currentPhase = "DAY_VOTE";  // フェーズを投票フェーズに設定
    gameInstance.players.find(p => p.playerId === werewolfAuth.user.id)!.role = "WEREWOLF";
    gameInstance.players.find(p => p.playerId === seerAuth.user.id)!.role = "SEER";
    gameInstance.players.find(p => p.playerId === bodyguardAuth.user.id)!.role = "BODYGUARD";
    gameInstance.players.find(p => p.playerId === villagerAuth.user.id)!.role = "VILLAGER";

    // Test voting
    const voteResponse = await apiRequest("POST", `/games/${gameId}/vote`, {
      targetPlayerId: werewolfAuth.user.id,
    }, villagerAuth.token);

    const voteResult = await consumeResponse<{ success: boolean }>(voteResponse);
    assertEquals(voteResponse.status, 200);
    assertEquals(voteResult.success, true);

    await cleanupTests();
  }
});

Deno.test({
  name: "Game Actions - Attack",
  async fn() {
    await setupTests();
    const createResponse = await apiRequest("POST", "/games", {
      name: "Test Game",
      maxPlayers: 6
    }, ownerAuth.token);
    const game = await consumeResponse<GameResponse>(createResponse);
    const gameId = game.id;

    // Create and add players with specific roles
    const werewolfAuth = await createAuthenticatedUser({
      username: "werewolf",
      email: `werewolf${Date.now()}@example.com`,
      password: "password123",
    });
    const joinWerewolfResponse = await apiRequest("POST", `/games/${gameId}/join`, undefined, werewolfAuth.token);
    await consumeResponse<GameResponse>(joinWerewolfResponse);

    const villagerAuth = await createAuthenticatedUser({
      username: "villager",
      email: `villager${Date.now()}@example.com`,
      password: "password123",
    });
    const joinVillagerResponse = await apiRequest("POST", `/games/${gameId}/join`, undefined, villagerAuth.token);
    await consumeResponse<GameResponse>(joinVillagerResponse);

    // Add more players to meet the minimum requirement
    const player3Auth = await createAuthenticatedUser({
      username: "player3",
      email: `player3_${Date.now()}@example.com`,
      password: "password123",
    });
    const joinPlayer3Response = await apiRequest("POST", `/games/${gameId}/join`, undefined, player3Auth.token);
    await consumeResponse<GameResponse>(joinPlayer3Response);

    const player4Auth = await createAuthenticatedUser({
      username: "player4",
      email: `player4_${Date.now()}@example.com`,
      password: "password123",
    });
    const joinPlayer4Response = await apiRequest("POST", `/games/${gameId}/join`, undefined, player4Auth.token);
    await consumeResponse<GameResponse>(joinPlayer4Response);

    const player5Auth = await createAuthenticatedUser({
      username: "player5",
      email: `player5_${Date.now()}@example.com`,
      password: "password123",
    });
    const joinPlayer5Response = await apiRequest("POST", `/games/${gameId}/join`, undefined, player5Auth.token);
    await consumeResponse<GameResponse>(joinPlayer5Response);

    // Start game and set up roles
    const startResponse = await apiRequest("POST", `/games/${gameId}/start`, undefined, ownerAuth.token);
    await consumeResponse<GameResponse>(startResponse);
    
    const gameInstance = gameModel.getGameById(gameId)!;
    gameInstance.players.find(p => p.playerId === werewolfAuth.user.id)!.role = "WEREWOLF";
    gameInstance.players.find(p => p.playerId === villagerAuth.user.id)!.role = "VILLAGER";

    // Test attack during night
    gameInstance.currentPhase = "NIGHT";
    const attackResponse = await apiRequest("POST", `/games/${gameId}/attack`, {
      targetPlayerId: villagerAuth.user.id,
    }, werewolfAuth.token);

    const attackResult = await consumeResponse<{ success: boolean }>(attackResponse);
    assertEquals(attackResponse.status, 200);
    assertEquals(attackResult.success, true);

    await cleanupTests();
  }
});