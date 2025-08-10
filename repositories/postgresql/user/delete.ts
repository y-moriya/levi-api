import { getClient } from "../pg-client.ts";
import { logger } from "../../../utils/logger.ts";

export async function deleteUserById(id: string): Promise<boolean> {
  const client = await getClient();
  try {
    const result = await client.queryObject("DELETE FROM users WHERE id = $1", [id]);
    const deleted = result.rowCount && result.rowCount > 0;
    if (deleted) {
      logger.info("User deleted from PostgreSQL repository", { userId: id });
    }
    return deleted || false;
  } catch (error) {
    const err = error as Error;
    logger.error("Error deleting user from PostgreSQL repository", { error: err.message, userId: id });
    throw error;
  } finally {
    client.release();
  }
}
