import { assertEquals } from "https://deno.land/std@0.210.0/assert/mod.ts";
import { apiRequest, consumeResponse, createAuthenticatedUser } from "../helpers/api.ts";
import { GameResponse, ChatMessageResponse } from "../helpers/types.ts";
import { getGameById } from "../../models/game.ts";
import * as gameModel from "../../models/game.ts";
import { setupTests, cleanupTests } from "./chat.test-helpers.ts";

Deno.test({
  name: "チャット - プライベートメッセージが正しく機能するか",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    await setupTests();
    const ownerAuth = await createAuthenticatedUser("owner");
    const werewolfAuth = await createAuthenticatedUser("werewolf");
    const seerAuth = await createAuthenticatedUser("seer");
    const bodyguardAuth = await createAuthenticatedUser("bodyguard");
    const villagerAuth = await createAuthenticatedUser("villager");

    const gameResponse = await apiRequest("POST", "/games", { name: "Private Message Test", maxPlayers: 5 }, ownerAuth.token);
    const game = await consumeResponse<GameResponse>(gameResponse);
    assertEquals(gameResponse.status, 201);
    const gameId = game.id;

    await apiRequest("POST", `/games/${gameId}/join`, {}, werewolfAuth.token);
    await apiRequest("POST", `/games/${gameId}/join`, {}, seerAuth.token);
    await apiRequest("POST", `/games/${gameId}/join`, {}, bodyguardAuth.token);
    await apiRequest("POST", `/games/${gameId}/join`, {}, villagerAuth.token);

    await apiRequest("POST", `/games/${gameId}/start`, {}, ownerAuth.token);

    let gameInstance = await getGameById(gameId);
    if (!gameInstance) throw new Error("Game not found");

    gameInstance = {
      ...gameInstance,
      players: gameInstance.players.map(p => {
        if (p.playerId === werewolfAuth.user.id) return { ...p, role: "WEREWOLF" };
        if (p.playerId === seerAuth.user.id) return { ...p, role: "SEER", isAlive: false, deathCause: "WEREWOLF_ATTACK" };
        if (p.playerId === bodyguardAuth.user.id) return { ...p, role: "BODYGUARD" };
        if (p.playerId === villagerAuth.user.id) return { ...p, role: "VILLAGER" };
        if (p.playerId === ownerAuth.user.id) return { ...p, role: "VILLAGER" };
        return p;
      })
    };
    await gameModel.gameStore.update(gameInstance);

    const privateMessageResponse = await apiRequest("POST", `/games/${gameId}/chat`, { content: "Private message", channel: "PRIVATE", recipientId: villagerAuth.user.id }, ownerAuth.token);
    assertEquals(privateMessageResponse.status, 201);

    const deadPrivateMessageResponse = await apiRequest("POST", `/games/${gameId}/chat`, { content: "Private message from dead", channel: "PRIVATE", recipientId: villagerAuth.user.id }, seerAuth.token);
    assertEquals(deadPrivateMessageResponse.status, 403);

    const senderPrivateResponse = await apiRequest("GET", `/games/${gameId}/chat?channel=PRIVATE`, undefined, ownerAuth.token);
    assertEquals(senderPrivateResponse.status, 200);
    const senderPrivateData = await consumeResponse<ChatMessageResponse[]>(senderPrivateResponse);
    assertEquals(senderPrivateData.length, 1);
    assertEquals(senderPrivateData[0].content, "Private message");

    const recipientPrivateResponse = await apiRequest("GET", `/games/${gameId}/chat?channel=PRIVATE`, undefined, villagerAuth.token);
    assertEquals(recipientPrivateResponse.status, 200);
    const recipientPrivateData = await consumeResponse<ChatMessageResponse[]>(recipientPrivateResponse);
    assertEquals(recipientPrivateData.length, 1);
    assertEquals(recipientPrivateData[0].content, "Private message");

    const thirdPartyPrivateResponse = await apiRequest("GET", `/games/${gameId}/chat?channel=PRIVATE`, undefined, werewolfAuth.token);
    assertEquals(thirdPartyPrivateResponse.status, 200);
    const thirdPartyPrivateData = await consumeResponse<ChatMessageResponse[]>(thirdPartyPrivateResponse);
    assertEquals(thirdPartyPrivateData.length, 0);

    await cleanupTests();
  },
});
