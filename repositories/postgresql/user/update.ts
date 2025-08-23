import { User } from "../../../types/user.ts";
import { getClient } from "../pg-client.ts";
import { logger } from "../../../utils/logger.ts";

export async function updateUser(id: string, user: User): Promise<User | null> {
  const client = await getClient();
  try {
    const { rows: existingUser } = await client.queryObject<{ id: string }>(
      "SELECT id FROM users WHERE id = $1",
      [id],
    );

    if (existingUser.length === 0) return null;

    const { rows: emailCheck } = await client.queryObject<{ count: number }>(
      "SELECT COUNT(*) as count FROM users WHERE email = $1 AND id != $2",
      [user.email, id],
    );
    if (emailCheck[0].count > 0) {
      throw new Error(`メールアドレス ${user.email} は既に登録されています`);
    }

    const { rows: usernameCheck } = await client.queryObject<{ count: number }>(
      "SELECT COUNT(*) as count FROM users WHERE username = $1 AND id != $2",
      [user.username, id],
    );
    if (usernameCheck[0].count > 0) {
      throw new Error(`ユーザー名 ${user.username} は既に使用されています`);
    }

    await client.queryObject(
      `
      UPDATE users SET
        username = $1,
        email = $2,
        password = $3,
        games_played = $4,
        games_won = $5,
        win_ratio = $6,
        villager_wins = $7,
        werewolf_wins = $8
      WHERE id = $9
    `,
      [
        user.username,
        user.email,
        user.password,
        user.stats.gamesPlayed,
        user.stats.gamesWon,
        user.stats.winRatio,
        user.stats.villagerWins,
        user.stats.werewolfWins,
        id,
      ],
    );

    logger.info("User updated in PostgreSQL repository", { userId: id });
    return user;
  } catch (error) {
    const err = error as Error;
    logger.error("Error updating user in PostgreSQL repository", { error: err.message, userId: id });
    throw error;
  } finally {
    client.release();
  }
}
