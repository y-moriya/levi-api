import { Game } from "../../../types/game.ts";
import { getClient } from "../pg-client.ts";
import { findGameById } from "./find-by-id.ts";
import { logger } from "../../../utils/logger.ts";

export async function findAllGames(): Promise<Game[]> {
  const client = await getClient();
  try {
    const { rows: gameIds } = await client.queryObject<{ id: string }>("SELECT id FROM games");
    const games: Game[] = [];

    for (const { id } of gameIds) {
      const game = await findGameById(id);
      if (game) games.push(game);
    }
    return games;
  } catch (error) {
    const err = error as Error;
    logger.error("Error finding all games in PostgreSQL repository", { error: err.message });
    throw error;
  } finally {
    client.release();
  }
}
