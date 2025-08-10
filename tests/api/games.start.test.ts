import { assertEquals, assertNotEquals } from "https://deno.land/std@0.210.0/assert/mod.ts";
import { apiRequest, consumeResponse, createAuthenticatedUser } from "../helpers/api.ts";
import { GameResponse } from "../helpers/types.ts";
import { setupTests, cleanupTests } from "./games.test-helpers.ts";

Deno.test({
  name: "ゲーム開始 - ゲームを正常に開始できるか",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const { ownerAuth } = await setupTests();
    const createResponse = await apiRequest("POST", "/games", { name: "Test Game", maxPlayers: 6 }, ownerAuth.token);
    const game = await consumeResponse<GameResponse>(createResponse);
    const gameId = game.id;

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
    assertEquals(startedGame.players.every((p) => p.role !== undefined), true);

    await cleanupTests();
  },
});
