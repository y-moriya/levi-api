import { User } from "../../../types/user.ts";
import { getClient } from "../pg-client.ts";
import { findUserById } from "./find-by-id.ts";
import { logger } from "../../../utils/logger.ts";

export async function updateUserStats(userId: string, stats: Partial<User["stats"]>): Promise<User | null> {
  const client = await getClient();
  try {
    const currentUser = await findUserById(userId);
    if (!currentUser) return null;

    const updateFields: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (stats.gamesPlayed !== undefined) {
      updateFields.push(`games_played = $${paramIndex++}`);
      params.push(stats.gamesPlayed);
    }
    if (stats.gamesWon !== undefined) {
      updateFields.push(`games_won = $${paramIndex++}`);
      params.push(stats.gamesWon);
    }
    if (stats.winRatio !== undefined) {
      updateFields.push(`win_ratio = $${paramIndex++}`);
      params.push(stats.winRatio);
    }
    if (stats.villagerWins !== undefined) {
      updateFields.push(`villager_wins = $${paramIndex++}`);
      params.push(stats.villagerWins);
    }
    if (stats.werewolfWins !== undefined) {
      updateFields.push(`werewolf_wins = $${paramIndex++}`);
      params.push(stats.werewolfWins);
    }

    if (updateFields.length === 0) return currentUser;

    params.push(userId);
    await client.queryObject(`UPDATE users SET ${updateFields.join(", ")} WHERE id = $${paramIndex}`, params);

    return findUserById(userId);
  } catch (error) {
    const err = error as Error;
    logger.error("Error updating user stats in PostgreSQL repository", { error: err.message, userId });
    throw error;
  } finally {
    client.release();
  }
}
