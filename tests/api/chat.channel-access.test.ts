import { assertEquals } from "https://deno.land/std@0.210.0/assert/mod.ts";
import { apiRequest, consumeResponse, createAuthenticatedUser } from "../helpers/api.ts";
import { GameResponse } from "../helpers/types.ts";
import { getGameById } from "../../models/game.ts";
import * as gameModel from "../../models/game.ts";
import { setupTests, cleanupTests } from "./chat.test-helpers.ts";

Deno.test({
  name: "チャット - 各役割チャットのアクセス制御が正しく機能するか",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    await setupTests();
    const ownerAuth = await createAuthenticatedUser("owner");
    const werewolfAuth = await createAuthenticatedUser("werewolf");
    const seerAuth = await createAuthenticatedUser("seer");
    const bodyguardAuth = await createAuthenticatedUser("bodyguard");
    const villagerAuth = await createAuthenticatedUser("villager");

    const gameResponse = await apiRequest("POST", "/games", { name: "Role Access Test", maxPlayers: 5 }, ownerAuth.token);
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
        if (p.playerId === bodyguardAuth.user.id) return { ...p, role: "BODYGUARD", isAlive: false, deathCause: "EXECUTION" };
        if (p.playerId === villagerAuth.user.id) return { ...p, role: "VILLAGER" };
        if (p.playerId === ownerAuth.user.id) return { ...p, role: "VILLAGER" };
        return p;
      })
    };
    await gameModel.gameStore.update(gameInstance);

    const channelAccessMap = [
      { channel: "PUBLIC", canAccess: [ownerAuth, werewolfAuth, villagerAuth], cannotAccess: [] },
      { channel: "WEREWOLF", canAccess: [werewolfAuth], cannotAccess: [ownerAuth, villagerAuth] },
      { channel: "SEER", canAccess: [seerAuth], cannotAccess: [ownerAuth, werewolfAuth, villagerAuth] },
      { channel: "BODYGUARD", canAccess: [bodyguardAuth], cannotAccess: [ownerAuth, werewolfAuth, villagerAuth, seerAuth] },
      { channel: "DEAD", canAccess: [seerAuth, bodyguardAuth], cannotAccess: [ownerAuth, werewolfAuth, villagerAuth] },
    ] as const;

    for (const testCase of channelAccessMap) {
      const { channel, canAccess, cannotAccess } = testCase;

      for (const auth of canAccess) {
        const isDeadPlayer = auth === seerAuth || auth === bodyguardAuth;
        const isNotDeadChannel = channel !== "DEAD";

        if (isDeadPlayer && isNotDeadChannel) {
          const messageResponse = await apiRequest("POST", `/games/${gameId}/chat`, { content: `${auth.user.username} in ${channel}`, channel }, auth.token);
          assertEquals(messageResponse.status, 403);
          continue;
        }

        const messageResponse = await apiRequest("POST", `/games/${gameId}/chat`, { content: `${auth.user.username} in ${channel}`, channel }, auth.token);
        assertEquals(messageResponse.status, 201);

        const chatResponse = await apiRequest("GET", `/games/${gameId}/chat?channel=${channel}` , undefined, auth.token);
        assertEquals(chatResponse.status, 200);
      }

      for (const auth of cannotAccess) {
        const messageResponse = await apiRequest("POST", `/games/${gameId}/chat`, { content: `${auth.user.username} trying ${channel}`, channel }, auth.token);
        assertEquals(messageResponse.status, 403);

        const chatResponse = await apiRequest("GET", `/games/${gameId}/chat?channel=${channel}`, undefined, auth.token);
        assertEquals(chatResponse.status, 403);
      }
    }

    await cleanupTests();
  },
});
