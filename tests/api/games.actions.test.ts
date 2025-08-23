import { assertEquals } from "https://deno.land/std@0.210.0/assert/mod.ts";
import { apiRequest, consumeResponse, createAuthenticatedUser } from "../helpers/api.ts";
import { GameResponse } from "../helpers/types.ts";
import * as gameModel from "../../models/game.ts";
import { setupTests, cleanupTests } from "./games.test-helpers.ts";

Deno.test({
  name: "ゲームアクション - 投票機能",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const { ownerAuth } = await setupTests();
    const createResponse = await apiRequest("POST", "/games", { name: "Test Game", maxPlayers: 6 }, ownerAuth.token);
    const game = await consumeResponse<GameResponse>(createResponse);
    const gameId = game.id;

    const werewolfAuth = await createAuthenticatedUser({ username: "werewolf", email: `werewolf${Date.now()}@example.com`, password: "password123" });
    await consumeResponse<GameResponse>(await apiRequest("POST", `/games/${gameId}/join`, undefined, werewolfAuth.token));
    const seerAuth = await createAuthenticatedUser({ username: "seer", email: `seer${Date.now()}@example.com`, password: "password123" });
    await consumeResponse<GameResponse>(await apiRequest("POST", `/games/${gameId}/join`, undefined, seerAuth.token));
    const bodyguardAuth = await createAuthenticatedUser({ username: "bodyguard", email: `bodyguard${Date.now()}@example.com`, password: "password123" });
    await consumeResponse<GameResponse>(await apiRequest("POST", `/games/${gameId}/join`, undefined, bodyguardAuth.token));
    const villagerAuth = await createAuthenticatedUser({ username: "villager", email: `villager${Date.now()}@example.com`, password: "password123" });
    await consumeResponse<GameResponse>(await apiRequest("POST", `/games/${gameId}/join`, undefined, villagerAuth.token));

    await consumeResponse<GameResponse>(await apiRequest("POST", `/games/${gameId}/start`, undefined, ownerAuth.token));

    const gameInstance = await gameModel.getGameById(gameId);
    if (!gameInstance) throw new Error("Game not found");
    gameInstance.currentPhase = "DAY_VOTE";
    gameInstance.players.find((p) => p.playerId === werewolfAuth.user.id)!.role = "WEREWOLF";
    gameInstance.players.find((p) => p.playerId === seerAuth.user.id)!.role = "SEER";
    gameInstance.players.find((p) => p.playerId === bodyguardAuth.user.id)!.role = "BODYGUARD";
    gameInstance.players.find((p) => p.playerId === villagerAuth.user.id)!.role = "VILLAGER";
    await gameModel.gameStore.update(gameInstance);

    const voteResponse = await apiRequest("POST", `/games/${gameId}/vote`, { targetPlayerId: werewolfAuth.user.id }, villagerAuth.token);
    const voteResult = await consumeResponse<{ success: boolean }>(voteResponse);
    assertEquals(voteResponse.status, 200);
    assertEquals(voteResult.success, true);

    await cleanupTests();
  },
});

Deno.test({
  name: "ゲームアクション - 襲撃機能",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const { ownerAuth } = await setupTests();
    const createResponse = await apiRequest("POST", "/games", { name: "Test Game", maxPlayers: 6 }, ownerAuth.token);
    const game = await consumeResponse<GameResponse>(createResponse);
    const gameId = game.id;

    const werewolfAuth = await createAuthenticatedUser({ username: "werewolf", email: `werewolf${Date.now()}@example.com`, password: "password123" });
    await consumeResponse<GameResponse>(await apiRequest("POST", `/games/${gameId}/join`, undefined, werewolfAuth.token));
    const villagerAuth = await createAuthenticatedUser({ username: "villager", email: `villager${Date.now()}@example.com`, password: "password123" });
    await consumeResponse<GameResponse>(await apiRequest("POST", `/games/${gameId}/join`, undefined, villagerAuth.token));
    const player3Auth = await createAuthenticatedUser({ username: "player3", email: `player3_${Date.now()}@example.com`, password: "password123" });
    await consumeResponse<GameResponse>(await apiRequest("POST", `/games/${gameId}/join`, undefined, player3Auth.token));
    const player4Auth = await createAuthenticatedUser({ username: "player4", email: `player4_${Date.now()}@example.com`, password: "password123" });
    await consumeResponse<GameResponse>(await apiRequest("POST", `/games/${gameId}/join`, undefined, player4Auth.token));
    const player5Auth = await createAuthenticatedUser({ username: "player5", email: `player5_${Date.now()}@example.com`, password: "password123" });
    await consumeResponse<GameResponse>(await apiRequest("POST", `/games/${gameId}/join`, undefined, player5Auth.token));

    await consumeResponse<GameResponse>(await apiRequest("POST", `/games/${gameId}/start`, undefined, ownerAuth.token));

    const gameInstance = await gameModel.getGameById(gameId);
    if (!gameInstance) throw new Error("Game not found");
    gameInstance.players.find((p) => p.playerId === werewolfAuth.user.id)!.role = "WEREWOLF";
    gameInstance.players.find((p) => p.playerId === villagerAuth.user.id)!.role = "VILLAGER";

    gameInstance.currentPhase = "NIGHT";
    await gameModel.gameStore.update(gameInstance);
    const attackResponse = await apiRequest("POST", `/games/${gameId}/attack`, { targetPlayerId: villagerAuth.user.id }, werewolfAuth.token);
    const attackResult = await consumeResponse<{ success: boolean }>(attackResponse);
    assertEquals(attackResponse.status, 200);
    assertEquals(attackResult.success, true);

    await cleanupTests();
  },
});
