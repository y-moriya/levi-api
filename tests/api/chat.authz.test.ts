import { assertEquals } from "https://deno.land/std@0.210.0/assert/mod.ts";
import { apiRequest, consumeResponse, createAuthenticatedUser } from "../helpers/api.ts";
import { GameResponse } from "../helpers/types.ts";
import { setupTests, cleanupTests } from "./chat.test-helpers.ts";

Deno.test({
  name: "チャット - 認証なしでチャットにアクセスできないか",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    await setupTests();
    const auth = await createAuthenticatedUser();
    const token = auth.token;

    const gameResponse = await apiRequest("POST", "/games", { name: "Test Game", maxPlayers: 5 }, token);
    const game = await consumeResponse<GameResponse>(gameResponse);
    assertEquals(gameResponse.status, 201);
    const gameId = game.id;

    const messageResponse = await apiRequest(
      "POST",
      `/games/${gameId}/chat`,
      { content: "Hello, world!", channel: "PUBLIC" },
    );
    assertEquals(messageResponse.status, 401);

    const messagesResponse = await apiRequest(
      "GET",
      `/games/${gameId}/chat?channel=PUBLIC`
    );
    assertEquals(messagesResponse.status, 401);

    await cleanupTests();
  },
});

Deno.test({
  name: "チャット - ゲームに参加していないユーザーがチャットにアクセスできないか",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    await setupTests();
    const gameOwner = await createAuthenticatedUser("owner");
    const outsider = await createAuthenticatedUser("outsider");

    const gameResponse = await apiRequest("POST", "/games", { name: "Test Game", maxPlayers: 5 }, gameOwner.token);
    const game = await consumeResponse<GameResponse>(gameResponse);
    assertEquals(gameResponse.status, 201);
    const gameId = game.id;

    const messageResponse = await apiRequest(
      "POST",
      `/games/${gameId}/chat`,
      { content: "Hello, world!", channel: "PUBLIC" },
      outsider.token,
    );
    assertEquals(messageResponse.status, 403);

    await cleanupTests();
  },
});
