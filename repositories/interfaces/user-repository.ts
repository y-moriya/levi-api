import { BaseRepository } from "./base-repository.ts";
import { User } from "../../types/user.ts";

/**
 * ユーザーリポジトリのインターフェース
 */
export interface UserRepository extends BaseRepository<User, string> {
  /**
   * メールアドレスによるユーザー検索
   * @param email メールアドレス
   * @returns 見つかったユーザー、存在しない場合はnull
   */
  findByEmail(email: string): Promise<User | null>;

  /**
   * ユーザー名によるユーザー検索
   * @param username ユーザー名
   * @returns 見つかったユーザー、存在しない場合はnull
   */
  findByUsername(username: string): Promise<User | null>;

  /**
   * ユーザー統計情報の更新
   * @param userId ユーザーID
   * @param stats 更新する統計情報
   * @returns 更新されたユーザー、存在しない場合はnull
   */
  updateStats(userId: string, stats: Partial<User["stats"]>): Promise<User | null>;
}
