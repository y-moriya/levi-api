import { User } from "../../types/user.ts";
import { UserRepository } from "../interfaces/user-repository.ts";
import { addUser } from "./user/add.ts";
import { updateUser } from "./user/update.ts";
import { findUserById } from "./user/find-by-id.ts";
import { deleteUserById } from "./user/delete.ts";
import { findAllUsers } from "./user/find-all.ts";
import { findUserByEmail } from "./user/find-by-email.ts";
import { findUserByUsername } from "./user/find-by-username.ts";
import { updateUserStats } from "./user/update-stats.ts";
import { clearUsers } from "./user/clear.ts";

/**
 * ユーザーリポジトリのPostgreSQL実装（委譲）
 */
export class PostgresUserRepository implements UserRepository {
  add(user: User): Promise<User> {
    return addUser(user);
  }
  update(id: string, user: User): Promise<User | null> {
    return updateUser(id, user);
  }
  findById(id: string): Promise<User | null> {
    return findUserById(id);
  }
  delete(id: string): Promise<boolean> {
    return deleteUserById(id);
  }
  findAll(): Promise<User[]> {
    return findAllUsers();
  }
  findByEmail(email: string): Promise<User | null> {
    return findUserByEmail(email);
  }
  findByUsername(username: string): Promise<User | null> {
    return findUserByUsername(username);
  }
  updateStats(userId: string, stats: Partial<User["stats"]>): Promise<User | null> {
    return updateUserStats(userId, stats);
  }
  clear(): Promise<void> {
    return clearUsers();
  }
}
