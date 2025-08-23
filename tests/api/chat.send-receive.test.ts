import { assertEquals, assertNotEquals } from "https://deno.land/std@0.210.0/assert/mod.ts";
import { apiRequest, consumeResponse, createAuthenticatedUser } from "../helpers/api.ts";
import { ChatMessageResponse, GameResponse } from "../helpers/types.ts";
import { cleanupTests, setupTests } from "./chat.test-helpers.ts";

Deno.test({
  name: "チャット - チャットメッセージを正常に送信できるか",
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
      token,
    );
    const messageData = await consumeResponse<ChatMessageResponse>(messageResponse);
    assertEquals(messageResponse.status, 201);
    assertNotEquals(messageData.id, undefined);
    assertEquals(messageData.content, "Hello, world!");
    assertEquals(messageData.sender.username, auth.user.username);
    assertEquals(messageData.channel, "PUBLIC");

    const messagesResponse = await apiRequest(
      "GET",
      `/games/${gameId}/chat?channel=PUBLIC`,
      undefined,
      token,
    );
    const messagesData = await consumeResponse<ChatMessageResponse[]>(messagesResponse);
    assertEquals(messagesResponse.status, 200);
    assertEquals(messagesData.length, 1);
    assertEquals(messagesData[0].content, "Hello, world!");

    await cleanupTests();
  },
});
