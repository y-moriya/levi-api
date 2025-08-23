import { User } from "../../../types/user.ts";
import { getClient } from "../pg-client.ts";
import { logger } from "../../../utils/logger.ts";

export async function addUser(user: User): Promise<User> {
  const client = await getClient();
  try {
    const { rows: existingUsers } = await client.queryObject<{ count: number }>(
      "SELECT COUNT(*) as count FROM users WHERE email = $1 OR username = $2",
      [user.email, user.username],
    );

    if (existingUsers[0].count > 0) {
      const { rows: emailCheck } = await client.queryObject<{ count: number }>(
        "SELECT COUNT(*) as count FROM users WHERE email = $1",
        [user.email],
      );
      if (emailCheck[0].count > 0) {
        throw new Error(`メールアドレス ${user.email} は既に登録されています`);
      } else {
        throw new Error(`ユーザー名 ${user.username} は既に使用されています`);
      }
    }

    await client.queryObject(
      `
      INSERT INTO users (
        id, username, email, password, created_at, 
        games_played, games_won, win_ratio, villager_wins, werewolf_wins
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
      )
    `,
      [
        user.id,
        user.username,
        user.email,
        user.password,
        user.createdAt,
        user.stats.gamesPlayed,
        user.stats.gamesWon,
        user.stats.winRatio,
        user.stats.villagerWins,
        user.stats.werewolfWins,
      ],
    );

    logger.info("User added to PostgreSQL repository", { userId: user.id, email: user.email });
    return user;
  } catch (error) {
    const err = error as Error;
    logger.error("Error adding user to PostgreSQL repository", { error: err.message, userId: user.id });
    throw error;
  } finally {
    client.release();
  }
}
