import { assertEquals } from "https://deno.land/std@0.210.0/assert/mod.ts";
import { apiRequest, consumeResponse, createAuthenticatedUser } from "../helpers/api.ts";
import { ChatMessageResponse, GameResponse } from "../helpers/types.ts";
import { getGameById } from "../../models/game.ts";
import * as gameModel from "../../models/game.ts";
import { cleanupTests, setupTests } from "./chat.test-helpers.ts";

Deno.test({
  name: "チャット - 死亡プレイヤーのみがデッドチャットにアクセスできるか",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    await setupTests();
    const ownerAuth = await createAuthenticatedUser("owner");
    const werewolfAuth = await createAuthenticatedUser("werewolf");
    const seerAuth = await createAuthenticatedUser("seer");
    const bodyguardAuth = await createAuthenticatedUser("bodyguard");
    const villagerAuth = await createAuthenticatedUser("villager");

    const gameResponse = await apiRequest("POST", "/games", { name: "Dead Chat Test", maxPlayers: 5 }, ownerAuth.token);
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
      players: gameInstance.players.map((p) => {
        if (p.playerId === werewolfAuth.user.id) return { ...p, role: "WEREWOLF" };
        if (p.playerId === seerAuth.user.id) {
          return { ...p, role: "SEER", isAlive: false, deathCause: "WEREWOLF_ATTACK" };
        }
        if (p.playerId === bodyguardAuth.user.id) return { ...p, role: "BODYGUARD" };
        if (p.playerId === villagerAuth.user.id) return { ...p, role: "VILLAGER" };
        if (p.playerId === ownerAuth.user.id) return { ...p, role: "VILLAGER" };
        return p;
      }),
    };
    await gameModel.gameStore.update(gameInstance);

    const deadMessageResponse = await apiRequest("POST", `/games/${gameId}/chat`, {
      content: "Message from the dead",
      channel: "DEAD",
    }, seerAuth.token);
    assertEquals(deadMessageResponse.status, 201);

    const aliveToDeadResponse = await apiRequest("POST", `/games/${gameId}/chat`, {
      content: "Alive trying to message dead",
      channel: "DEAD",
    }, villagerAuth.token);
    assertEquals(aliveToDeadResponse.status, 403);

    const deadChatResponse = await apiRequest("GET", `/games/${gameId}/chat?channel=DEAD`, undefined, seerAuth.token);
    assertEquals(deadChatResponse.status, 200);
    const deadChatData = await consumeResponse<ChatMessageResponse[]>(deadChatResponse);
    assertEquals(deadChatData.length, 1);
    assertEquals(deadChatData[0].content, "Message from the dead");

    const aliveDeadChatResponse = await apiRequest(
      "GET",
      `/games/${gameId}/chat?channel=DEAD`,
      undefined,
      villagerAuth.token,
    );
    assertEquals(aliveDeadChatResponse.status, 403);

    await cleanupTests();
  },
});
