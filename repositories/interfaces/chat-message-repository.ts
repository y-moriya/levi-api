import { BaseRepository } from "./base-repository.ts";
import { ChatChannel, ChatMessage } from "../../types/chat.ts";

/**
 * チャットメッセージリポジトリのインターフェース
 */
export interface ChatMessageRepository extends BaseRepository<ChatMessage, string> {
  /**
   * ゲームIDとチャンネルによるメッセージ検索
   * @param gameId ゲームID
   * @param channel チャットチャンネル
   * @returns 該当するメッセージの配列
   */
  findByGameAndChannel(gameId: string, channel: ChatChannel): Promise<ChatMessage[]>;

  /**
   * ゲームIDによるメッセージ検索
   * @param gameId ゲームID
   * @returns 該当するメッセージの配列
   */
  findByGame(gameId: string): Promise<ChatMessage[]>;

  /**
   * ゲームに関連するすべてのメッセージを削除
   * @param gameId ゲームID
   * @returns 削除に成功した場合はtrue
   */
  deleteByGame(gameId: string): Promise<boolean>;
}
