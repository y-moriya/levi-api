import { User } from "../../types/user.ts";
import { UserRepository } from "../interfaces/user-repository.ts";
import { getClient } from "./pg-client.ts";
import { logger } from "../../utils/logger.ts";

/**
 * ユーザーリポジトリのPostgreSQL実装
 */
export class PostgresUserRepository implements UserRepository {
  async add(user: User): Promise<User> {
    const client = await getClient();
    try {
      // メールアドレスとユーザー名の一意性チェック
      const { rows: existingUsers } = await client.queryObject<{ count: number }>(
        "SELECT COUNT(*) as count FROM users WHERE email = $1 OR username = $2",
        [user.email, user.username]
      );
      
      if (existingUsers[0].count > 0) {
        // 重複チェック
        const { rows: emailCheck } = await client.queryObject<{ count: number }>(
          "SELECT COUNT(*) as count FROM users WHERE email = $1", [user.email]
        );
        
        if (emailCheck[0].count > 0) {
          throw new Error(`メールアドレス ${user.email} は既に登録されています`);
        } else {
          throw new Error(`ユーザー名 ${user.username} は既に使用されています`);
        }
      }
      
      await client.queryObject(`
        INSERT INTO users (
          id, username, email, password, created_at, 
          games_played, games_won, win_ratio, villager_wins, werewolf_wins
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
        )
      `, [
        user.id,
        user.username,
        user.email,
        user.password,
        user.createdAt,
        user.stats.gamesPlayed,
        user.stats.gamesWon,
        user.stats.winRatio,
        user.stats.villagerWins,
        user.stats.werewolfWins
      ]);
      
      logger.info("User added to PostgreSQL repository", {
        userId: user.id, 
        email: user.email
      });
      
      return user;
    } catch (error: unknown) {
      const err = error as Error;
      logger.error("Error adding user to PostgreSQL repository", { error: err.message, userId: user.id });
      throw error;
    } finally {
      client.release();
    }
  }

  async update(id: string, user: User): Promise<User | null> {
    const client = await getClient();
    try {
      // ユーザーが存在するか確認
      const { rows: existingUser } = await client.queryObject<{ id: string }>(
        "SELECT id FROM users WHERE id = $1", [id]
      );
      
      if (existingUser.length === 0) {
        return null;
      }
      
      // メールアドレスとユーザー名の一意性チェック (自分自身を除く)
      const { rows: emailCheck } = await client.queryObject<{ count: number }>(
        "SELECT COUNT(*) as count FROM users WHERE email = $1 AND id != $2",
        [user.email, id]
      );
      
      if (emailCheck[0].count > 0) {
        throw new Error(`メールアドレス ${user.email} は既に登録されています`);
      }
      
      const { rows: usernameCheck } = await client.queryObject<{ count: number }>(
        "SELECT COUNT(*) as count FROM users WHERE username = $1 AND id != $2",
        [user.username, id]
      );
      
      if (usernameCheck[0].count > 0) {
        throw new Error(`ユーザー名 ${user.username} は既に使用されています`);
      }
      
      await client.queryObject(`
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
      `, [
        user.username,
        user.email,
        user.password,
        user.stats.gamesPlayed,
        user.stats.gamesWon,
        user.stats.winRatio,
        user.stats.villagerWins,
        user.stats.werewolfWins,
        id
      ]);
      
      logger.info("User updated in PostgreSQL repository", { userId: id });
      return user;
    } catch (error: unknown) {
      const err = error as Error;
      logger.error("Error updating user in PostgreSQL repository", { error: err.message, userId: id });
      throw error;
    } finally {
      client.release();
    }
  }

  async findById(id: string): Promise<User | null> {
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
      }>(`
        SELECT * FROM users WHERE id = $1
      `, [id]);
      
      if (rows.length === 0) {
        return null;
      }
      
      const userData = rows[0];
      
      return {
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
          werewolfWins: userData.werewolf_wins
        }
      };
    } catch (error: unknown) {
      const err = error as Error;
      logger.error("Error finding user by ID in PostgreSQL repository", { error: err.message, userId: id });
      throw error;
    } finally {
      client.release();
    }
  }

  async delete(id: string): Promise<boolean> {
    const client = await getClient();
    try {
      const result = await client.queryObject(
        "DELETE FROM users WHERE id = $1", [id]
      );
      
      const deleted = result.rowCount && result.rowCount > 0;
      
      if (deleted) {
        logger.info("User deleted from PostgreSQL repository", { userId: id });
      }
      
      return deleted || false; // 必ずboolean型を返す
    } catch (error: unknown) {
      const err = error as Error;
      logger.error("Error deleting user from PostgreSQL repository", { error: err.message, userId: id });
      throw error;
    } finally {
      client.release();
    }
  }

  async findAll(): Promise<User[]> {
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
      
      return rows.map(userData => ({
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
          werewolfWins: userData.werewolf_wins
        }
      }));
    } catch (error: unknown) {
      const err = error as Error;
      logger.error("Error finding all users in PostgreSQL repository", { error: err.message });
      throw error;
    } finally {
      client.release();
    }
  }

  async findByEmail(email: string): Promise<User | null> {
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
      }>(`
        SELECT * FROM users WHERE email = $1
      `, [email]);
      
      if (rows.length === 0) {
        return null;
      }
      
      const userData = rows[0];
      
      return {
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
          werewolfWins: userData.werewolf_wins
        }
      };
    } catch (error: unknown) {
      const err = error as Error;
      logger.error("Error finding user by email in PostgreSQL repository", { error: err.message, email });
      throw error;
    } finally {
      client.release();
    }
  }

  async findByUsername(username: string): Promise<User | null> {
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
      }>(`
        SELECT * FROM users WHERE username = $1
      `, [username]);
      
      if (rows.length === 0) {
        return null;
      }
      
      const userData = rows[0];
      
      return {
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
          werewolfWins: userData.werewolf_wins
        }
      };
    } catch (error: unknown) {
      const err = error as Error;
      logger.error("Error finding user by username in PostgreSQL repository", { error: err.message, username });
      throw error;
    } finally {
      client.release();
    }
  }

  async updateStats(userId: string, stats: Partial<User["stats"]>): Promise<User | null> {
    const client = await getClient();
    try {
      // ユーザーが存在するか確認
      const currentUser = await this.findById(userId);
      if (!currentUser) {
        return null;
      }
      
      // 更新するフィールドを準備
      const updateFields = [];
      const params = [];
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
      
      if (updateFields.length === 0) {
        return currentUser; // 更新するフィールドがない場合
      }
      
      // IDを最後のパラメータとして追加
      params.push(userId);
      
      await client.queryObject(`
        UPDATE users SET ${updateFields.join(", ")} WHERE id = $${paramIndex}
      `, params);
      
      // 更新されたユーザーを返す
      return this.findById(userId);
    } catch (error: unknown) {
      const err = error as Error;
      logger.error("Error updating user stats in PostgreSQL repository", { error: err.message, userId });
      throw error;
    } finally {
      client.release();
    }
  }

  async clear(): Promise<void> {
    const client = await getClient();
    try {
      await client.queryObject("DELETE FROM users");
      logger.info("PostgreSQL user repository cleared");
    } catch (error: unknown) {
      const err = error as Error;
      logger.error("Error clearing PostgreSQL user repository", { error: err.message });
      throw error;
    } finally {
      client.release();
    }
  }
}