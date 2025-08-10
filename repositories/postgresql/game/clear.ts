import { getClient } from "../pg-client.ts";
import { logger } from "../../../utils/logger.ts";

export async function clearGames(): Promise<void> {
  const client = await getClient();
  try {
    await client.queryObject("BEGIN");
    await client.queryObject("DELETE FROM games");
    await client.queryObject("COMMIT");
    logger.info("PostgreSQL game repository cleared");
  } catch (error) {
    await client.queryObject("ROLLBACK");
    const err = error as Error;
    logger.error("Error clearing PostgreSQL game repository", { error: err.message });
    throw error;
  } finally {
    client.release();
  }
}
