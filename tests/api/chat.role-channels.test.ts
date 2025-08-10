import { assertEquals } from "https://deno.land/std@0.210.0/assert/mod.ts";
import { apiRequest, consumeResponse, createAuthenticatedUser } from "../helpers/api.ts";
import { GameResponse, ChatMessageResponse } from "../helpers/types.ts";
import { getGameById } from "../../models/game.ts";
import * as gameModel from "../../models/game.ts";
import { setupTests, cleanupTests } from "./chat.test-helpers.ts";

Deno.test({
  name: "チャット - 役割別チャットが適切に機能するか",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    await setupTests();
    const ownerAuth = await createAuthenticatedUser("owner");
    const werewolfAuth = await createAuthenticatedUser("werewolf");
    const seerAuth = await createAuthenticatedUser("seer");
    const bodyguardAuth = await createAuthenticatedUser("bodyguard");
    const villagerAuth = await createAuthenticatedUser("villager");

    const gameResponse = await apiRequest("POST", "/games", { name: "Role Chat Test", maxPlayers: 5 }, ownerAuth.token);
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
        if (p.playerId === seerAuth.user.id) return { ...p, role: "SEER" };
        if (p.playerId === bodyguardAuth.user.id) return { ...p, role: "BODYGUARD" };
        if (p.playerId === villagerAuth.user.id) return { ...p, role: "VILLAGER" };
        if (p.playerId === ownerAuth.user.id) return { ...p, role: "VILLAGER" };
        return p;
      })
    };
    await gameModel.gameStore.update(gameInstance);

    const werewolfMessageResponse = await apiRequest("POST", `/games/${gameId}/chat`, { content: "Wolf message", channel: "WEREWOLF" }, werewolfAuth.token);
    assertEquals(werewolfMessageResponse.status, 201);

    const villagerToWerewolfResponse = await apiRequest("POST", `/games/${gameId}/chat`, { content: "Villager trying to message wolves", channel: "WEREWOLF" }, villagerAuth.token);
    assertEquals(villagerToWerewolfResponse.status, 403);

    const werewolfChatResponse = await apiRequest("GET", `/games/${gameId}/chat?channel=WEREWOLF`, undefined, werewolfAuth.token);
    assertEquals(werewolfChatResponse.status, 200);
    const werewolfChatData = await consumeResponse<ChatMessageResponse[]>(werewolfChatResponse);
    assertEquals(werewolfChatData.length, 1);
    assertEquals(werewolfChatData[0].content, "Wolf message");

    const villagerWerewolfChatResponse = await apiRequest("GET", `/games/${gameId}/chat?channel=WEREWOLF`, undefined, villagerAuth.token);
    assertEquals(villagerWerewolfChatResponse.status, 403);

    await cleanupTests();
  },
});
