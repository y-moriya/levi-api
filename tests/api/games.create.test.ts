import { assertEquals } from "https://deno.land/std@0.210.0/assert/mod.ts";
import { apiRequest, consumeResponse, createAuthenticatedUser } from "../helpers/api.ts";
import { GameResponse } from "../helpers/types.ts";
import { cleanupTests, setupTests } from "./games.test-helpers.ts";

Deno.test({
  name: "ゲーム作成 - 新しいゲームを正常に作成できるか",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const { ownerAuth } = await setupTests();
    const gameData = { name: "Test Game", maxPlayers: 5 };
    const response = await apiRequest("POST", "/games", gameData, ownerAuth.token);
    const game = await consumeResponse<GameResponse>(response);
    assertEquals(response.status, 201);
    assertEquals(game.name, gameData.name);
    assertEquals(game.maxPlayers, gameData.maxPlayers);
    assertEquals(game.owner.id, ownerAuth.user.id);
    assertEquals(game.status, "WAITING");
    assertEquals(game.currentPlayers, 1);
    await cleanupTests();
  },
});

Deno.test({
  name: "ゲーム作成 - 入力データのバリデーションが行われるか",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    await setupTests();
    const { token } = await createAuthenticatedUser();
    const invalidGameData = { name: "", maxPlayers: 2 };
    const response = await apiRequest("POST", "/games", invalidGameData, token);
    try {
      await consumeResponse(response);
      throw new Error("予想されるエラーが発生しませんでした");
    } catch (error) {
      assertEquals(response.status, 400);
      const errorObj = error as { response?: { code?: string } };
      assertEquals(errorObj.response?.code, "VALIDATION_ERROR");
    }
    await cleanupTests();
  },
});

Deno.test({
  name: "ゲーム作成 - 認証が必要であることを確認する",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    await setupTests();
    const gameData = { name: "Test Game", maxPlayers: 5 };
    const response = await apiRequest("POST", "/games", gameData);
    try {
      await consumeResponse(response);
      throw new Error("予想されるエラーが発生しませんでした");
    } catch (error) {
      assertEquals(response.status, 401);
      const errorObj = error as { response?: { code?: string } };
      assertEquals(errorObj.response?.code, "UNAUTHORIZED");
    }
    await cleanupTests();
  },
});
