import { Game } from "../../../types/game.ts";
import { getClient } from "../pg-client.ts";
import { findGameById } from "./find-by-id.ts";
import { logger } from "../../../utils/logger.ts";

export async function findGamesByStatus(status: string): Promise<Game[]> {
  const client = await getClient();
  try {
    const { rows: gameIds } = await client.queryObject<{ id: string }>(
      "SELECT id FROM games WHERE status = $1",
      [status],
    );

    const games: Game[] = [];
    for (const { id } of gameIds) {
      const game = await findGameById(id);
      if (game) games.push(game);
    }
    return games;
  } catch (error) {
    const err = error as Error;
    logger.error("Error finding games by status in PostgreSQL repository", { error: err.message, status });
    throw error;
  } finally {
    client.release();
  }
}
