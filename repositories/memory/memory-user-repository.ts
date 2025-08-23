import { User } from "../../types/user.ts";
import { UserRepository } from "../interfaces/user-repository.ts";
import { logger } from "../../utils/logger.ts";

/**
 * ユーザーリポジトリのインメモリ実装
 */
export class MemoryUserRepository implements UserRepository {
  private users: Map<string, User> = new Map();
  private emailIndex: Map<string, string> = new Map(); // email -> id
  private usernameIndex: Map<string, string> = new Map(); // username -> id

  async add(user: User): Promise<User> {
    // メールアドレスの一意性チェック
    if (this.emailIndex.has(user.email)) {
      throw new Error(`メールアドレス ${user.email} は既に登録されています`);
    }

    // ユーザー名の一意性チェック
    if (this.usernameIndex.has(user.username)) {
      throw new Error(`ユーザー名 ${user.username} は既に使用されています`);
    }

    this.users.set(user.id, user);
    this.emailIndex.set(user.email, user.id);
    this.usernameIndex.set(user.username, user.id);

    logger.info("User added to repository", {
      userId: user.id,
      email: user.email,
      username: user.username,
    });

    return user;
  }

  async update(id: string, user: User): Promise<User | null> {
    const existingUser = this.users.get(id);
    if (!existingUser) {
      return null;
    }

    // メールアドレスが変更された場合のチェック
    if (existingUser.email !== user.email) {
      const existingId = this.emailIndex.get(user.email);
      if (existingId && existingId !== id) {
        throw new Error(`メールアドレス ${user.email} は既に登録されています`);
      }
      this.emailIndex.delete(existingUser.email);
      this.emailIndex.set(user.email, id);
    }

    // ユーザー名が変更された場合のチェック
    if (existingUser.username !== user.username) {
      const existingId = this.usernameIndex.get(user.username);
      if (existingId && existingId !== id) {
        throw new Error(`ユーザー名 ${user.username} は既に使用されています`);
      }
      this.usernameIndex.delete(existingUser.username);
      this.usernameIndex.set(user.username, id);
    }

    this.users.set(id, user);
    return user;
  }

  async findById(id: string): Promise<User | null> {
    return this.users.get(id) || null;
  }

  async delete(id: string): Promise<boolean> {
    const user = this.users.get(id);
    if (!user) return false;

    this.emailIndex.delete(user.email);
    this.usernameIndex.delete(user.username);
    this.users.delete(id);

    logger.info("User deleted from repository", { userId: id });
    return true;
  }

  async findAll(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async findByEmail(email: string): Promise<User | null> {
    const userId = this.emailIndex.get(email);
    if (!userId) return null;
    return this.users.get(userId) || null;
  }

  async findByUsername(username: string): Promise<User | null> {
    const userId = this.usernameIndex.get(username);
    if (!userId) return null;
    return this.users.get(userId) || null;
  }

  async updateStats(userId: string, stats: Partial<User["stats"]>): Promise<User | null> {
    const user = this.users.get(userId);
    if (!user) return null;

    const updatedUser = {
      ...user,
      stats: {
        ...user.stats,
        ...stats,
      },
    };

    this.users.set(userId, updatedUser);
    return updatedUser;
  }

  async clear(): Promise<void> {
    this.users.clear();
    this.emailIndex.clear();
    this.usernameIndex.clear();
    logger.info("User repository cleared");
  }
}
