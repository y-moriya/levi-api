import { assertEquals } from "https://deno.land/std@0.210.0/assert/mod.ts";
import { apiRequest, consumeResponse } from "../helpers/api.ts";
import { GameListResponse, GameResponse } from "../helpers/types.ts";
import { setupTests, cleanupTests } from "./games.test-helpers.ts";

Deno.test({
  name: "ゲーム一覧 - ゲームが存在しない場合、空の配列を返す",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const { ownerAuth } = await setupTests();
    const response = await apiRequest("GET", "/games", undefined, ownerAuth.token);
    const games = await consumeResponse<GameListResponse>(response);
    assertEquals(response.status, 200);
    assertEquals(games.length, 0);
    await cleanupTests();
  },
});

Deno.test({
  name: "ゲーム一覧 - すべてのゲームのリストを返す",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const { ownerAuth } = await setupTests();
    const game1Response = await apiRequest("POST", "/games", { name: "Game 1", maxPlayers: 5 }, ownerAuth.token);
    await consumeResponse<GameResponse>(game1Response);
    const game2Response = await apiRequest("POST", "/games", { name: "Game 2", maxPlayers: 5 }, ownerAuth.token);
    await consumeResponse<GameResponse>(game2Response);
    const response = await apiRequest("GET", "/games", undefined, ownerAuth.token);
    const games = await consumeResponse<GameListResponse>(response);
    assertEquals(response.status, 200);
    assertEquals(games.length, 2);
    assertEquals(games[0].name, "Game 1");
    assertEquals(games[1].name, "Game 2");
    await cleanupTests();
  },
});
