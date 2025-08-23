import { Game } from "../../../types/game.ts";
import { getClient } from "../pg-client.ts";
import { findGameById } from "./find-by-id.ts";
import { logger } from "../../../utils/logger.ts";

export async function findGamesByPlayerId(playerId: string): Promise<Game[]> {
  const client = await getClient();
  try {
    const { rows: gameIds } = await client.queryObject<{ game_id: string }>(
      "SELECT DISTINCT game_id FROM players WHERE player_id = $1",
      [playerId],
    );

    const games: Game[] = [];
    for (const { game_id } of gameIds) {
      const game = await findGameById(game_id);
      if (game) games.push(game);
    }
    return games;
  } catch (error) {
    const err = error as Error;
    logger.error("Error finding games by player ID in PostgreSQL repository", { error: err.message, playerId });
    throw error;
  } finally {
    client.release();
  }
}
