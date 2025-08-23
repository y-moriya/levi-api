import { BaseRepository } from "./base-repository.ts";
import { Game } from "../../types/game.ts";

/**
 * ゲームリポジトリのインターフェース
 */
export interface GameRepository extends BaseRepository<Game, string> {
  /**
   * ゲームのステータスによる検索
   * @param status ゲームステータス
   * @returns 指定されたステータスのゲーム配列
   */
  findByStatus(status: string): Promise<Game[]>;

  /**
   * プレイヤーIDによるゲーム検索
   * @param playerId プレイヤーID
   * @returns そのプレイヤーが参加しているゲーム配列
   */
  findByPlayerId(playerId: string): Promise<Game[]>;

  /**
   * リポジトリの統計情報を取得
   * @returns キーと数値のペアによる統計情報
   */
  getStats(): Promise<Record<string, number>>;
}
