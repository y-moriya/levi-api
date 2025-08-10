import { assertEquals } from "https://deno.land/std@0.210.0/assert/mod.ts";
import { apiRequest, consumeResponse } from "../helpers/api.ts";
import { GameResponse } from "../helpers/types.ts";
import { setupTests, cleanupTests } from "./games.test-helpers.ts";

Deno.test({
  name: "ゲーム参加 - プレイヤーがゲームに参加できるか",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const { ownerAuth, playerAuth } = await setupTests();
    const createResponse = await apiRequest("POST", "/games", { name: "Test Game", maxPlayers: 5 }, ownerAuth.token);
    const newGame = await consumeResponse<GameResponse>(createResponse);
    const gameId = newGame.id;

    const response = await apiRequest("POST", `/games/${gameId}/join`, undefined, playerAuth.token);
    const game = await consumeResponse<GameResponse>(response);
    assertEquals(response.status, 200);
    assertEquals(game.currentPlayers, 2);
    assertEquals(game.players.length, 2);
    assertEquals(game.players[1].playerId, playerAuth.user.id);
    await cleanupTests();
  },
});

Deno.test({
  name: "ゲーム退出 - プレイヤーがゲームから退出できるか",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const { ownerAuth, playerAuth } = await setupTests();
    const createResponse = await apiRequest("POST", "/games", { name: "Test Game", maxPlayers: 5 }, ownerAuth.token);
    const game = await consumeResponse<GameResponse>(createResponse);
    const gameId = game.id;

    const joinResponse = await apiRequest("POST", `/games/${gameId}/join`, undefined, playerAuth.token);
    await consumeResponse<GameResponse>(joinResponse);

    const leaveResponse = await apiRequest("POST", `/games/${gameId}/leave`, undefined, playerAuth.token);
    const updatedGame = await consumeResponse<GameResponse>(leaveResponse);
    assertEquals(leaveResponse.status, 200);
    assertEquals(updatedGame.currentPlayers, 1);
    assertEquals(updatedGame.players.length, 1);
    assertEquals(updatedGame.players[0].playerId, ownerAuth.user.id);
    await cleanupTests();
  },
});
