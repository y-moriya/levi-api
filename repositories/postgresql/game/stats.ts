import { getClient } from "../pg-client.ts";
import { logger } from "../../../utils/logger.ts";

export async function getGameStats(): Promise<Record<string, number>> {
  const client = await getClient();
  try {
    const { rows: totalGames } = await client.queryObject<{ count: number }>(
      "SELECT COUNT(*) as count FROM games",
    );

    const { rows: waitingGames } = await client.queryObject<{ count: number }>(
      "SELECT COUNT(*) as count FROM games WHERE status = 'WAITING'",
    );

    const { rows: inProgressGames } = await client.queryObject<{ count: number }>(
      "SELECT COUNT(*) as count FROM games WHERE status = 'IN_PROGRESS'",
    );

    const { rows: finishedGames } = await client.queryObject<{ count: number }>(
      "SELECT COUNT(*) as count FROM games WHERE status = 'FINISHED'",
    );

    const { rows: activePlayers } = await client.queryObject<{ count: number }>(
      "SELECT COUNT(DISTINCT player_id) as count FROM players",
    );

    return {
      totalGames: totalGames[0].count,
      waitingGames: waitingGames[0].count,
      inProgressGames: inProgressGames[0].count,
      finishedGames: finishedGames[0].count,
      activePlayers: activePlayers[0].count,
    };
  } catch (error) {
    const err = error as Error;
    logger.error("Error getting stats from PostgreSQL game repository", { error: err.message });
    throw error;
  } finally {
    client.release();
  }
}
