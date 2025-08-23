import { User } from "../../../types/user.ts";
import { getClient } from "../pg-client.ts";
import { logger } from "../../../utils/logger.ts";

export async function findAllUsers(): Promise<User[]> {
  const client = await getClient();
  try {
    const { rows } = await client.queryObject<{
      id: string;
      username: string;
      email: string;
      password: string;
      created_at: string;
      games_played: number;
      games_won: number;
      win_ratio: number;
      villager_wins: number;
      werewolf_wins: number;
    }>("SELECT * FROM users");

    return rows.map((userData) => ({
      id: userData.id,
      username: userData.username,
      email: userData.email,
      password: userData.password,
      createdAt: userData.created_at,
      stats: {
        gamesPlayed: userData.games_played,
        gamesWon: userData.games_won,
        winRatio: userData.win_ratio,
        villagerWins: userData.villager_wins,
        werewolfWins: userData.werewolf_wins,
      },
    }));
  } catch (error) {
    const err = error as Error;
    logger.error("Error finding all users in PostgreSQL repository", { error: err.message });
    throw error;
  } finally {
    client.release();
  }
}
