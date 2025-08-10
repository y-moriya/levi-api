import { getClient } from "../pg-client.ts";
import { logger } from "../../../utils/logger.ts";

export async function clearUsers(): Promise<void> {
  const client = await getClient();
  try {
    await client.queryObject("DELETE FROM users");
    logger.info("PostgreSQL user repository cleared");
  } catch (error) {
    const err = error as Error;
    logger.error("Error clearing PostgreSQL user repository", { error: err.message });
    throw error;
  } finally {
    client.release();
  }
}
