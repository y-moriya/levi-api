import { ApiClient } from "./client.ts";
import { consumeResponse } from "./response.ts";
import { GameResponse } from "./types.ts";

export async function createTestGame(api: ApiClient, token: string, gameData = {
  name: "Test Game",
  maxPlayers: 5,
}) {
  const response = await api.post("/games", gameData, token);
  const game = await consumeResponse<GameResponse>(response);
  return { game, response };
}
