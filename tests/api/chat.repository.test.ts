import { assertEquals } from "https://deno.land/std@0.210.0/assert/mod.ts";
import { apiRequest, consumeResponse, createAuthenticatedUser } from "../helpers/api.ts";
import { ChatMessageResponse, GameResponse } from "../helpers/types.ts";
import { repositoryContainer } from "../../repositories/repository-container.ts";
import { cleanupTests, setupTests } from "./chat.test-helpers.ts";

Deno.test({
  name: "チャット - すべてのゲームから全チャットメッセージを削除できるか",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    await setupTests();
    const auth = await createAuthenticatedUser();
    const token = auth.token;

    const games = [] as GameResponse[];
    for (let i = 0; i < 3; i++) {
      const gameResponse = await apiRequest("POST", "/games", { name: `Test Game ${i}`, maxPlayers: 5 }, token);
      assertEquals(gameResponse.status, 201);
      games.push(await consumeResponse<GameResponse>(gameResponse));
    }

    for (const game of games) {
      const messageResponse = await apiRequest("POST", `/games/${game.id}/chat`, {
        content: `Message for game ${game.id}`,
        channel: "PUBLIC",
      }, token);
      assertEquals(messageResponse.status, 201);
    }

    const chatRepo = repositoryContainer.getChatMessageRepository();
    await chatRepo.clear();

    for (const game of games) {
      const messagesResponse = await apiRequest("GET", `/games/${game.id}/chat?channel=PUBLIC`, undefined, token);
      assertEquals(messagesResponse.status, 200);
      const messagesData = await consumeResponse<ChatMessageResponse[]>(messagesResponse);
      assertEquals(messagesData.length, 0);
    }

    await cleanupTests();
  },
});

Deno.test({
  name: "チャット - ゲーム内のすべてのチャットメッセージを削除できるか",
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

    for (let i = 0; i < 5; i++) {
      const messageResponse = await apiRequest("POST", `/games/${gameId}/chat`, {
        content: `Message ${i}`,
        channel: "PUBLIC",
      }, token);
      assertEquals(messageResponse.status, 201);
    }

    let messagesResponse = await apiRequest("GET", `/games/${gameId}/chat?channel=PUBLIC`, undefined, token);
    assertEquals(messagesResponse.status, 200);
    let messagesData = await consumeResponse<ChatMessageResponse[]>(messagesResponse);
    assertEquals(messagesData.length, 5);

    const chatRepo = repositoryContainer.getChatMessageRepository();
    await chatRepo.deleteByGame(gameId);

    messagesResponse = await apiRequest("GET", `/games/${gameId}/chat?channel=PUBLIC`, undefined, token);
    assertEquals(messagesResponse.status, 200);
    messagesData = await consumeResponse<ChatMessageResponse[]>(messagesResponse);
    assertEquals(messagesData.length, 0);

    await cleanupTests();
  },
});
