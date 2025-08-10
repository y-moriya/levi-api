import { getClient } from "../pg-client.ts";
import { logger } from "../../../utils/logger.ts";

export async function deleteGameById(id: string): Promise<boolean> {
  const client = await getClient();
  try {
    const result = await client.queryObject("DELETE FROM games WHERE id = $1", [id]);
    const deleted = result.rowCount && result.rowCount > 0;
    if (deleted) {
      logger.info("Game deleted from PostgreSQL repository", { gameId: id });
    }
    return deleted || false;
  } catch (error) {
    const err = error as Error;
    logger.error("Error deleting game from PostgreSQL repository", { error: err.message, gameId: id });
    throw error;
  } finally {
    client.release();
  }
}
