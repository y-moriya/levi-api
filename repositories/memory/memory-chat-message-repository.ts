import { ChatChannel, ChatMessage } from "../../types/chat.ts";
import { ChatMessageRepository } from "../interfaces/chat-message-repository.ts";
import { logger } from "../../utils/logger.ts";

/**
 * チャットメッセージリポジトリのインメモリ実装
 */
export class MemoryChatMessageRepository implements ChatMessageRepository {
  private messages: Map<string, ChatMessage> = new Map();
  private gameChannelIndex: Map<string, Map<string, Set<string>>> = new Map(); // gameId -> (channel -> messageIds)

  async add(message: ChatMessage): Promise<ChatMessage> {
    this.messages.set(message.id, message);

    // ゲームとチャンネルのインデックスを更新
    if (!this.gameChannelIndex.has(message.gameId)) {
      this.gameChannelIndex.set(message.gameId, new Map());
    }

    const gameChannels = this.gameChannelIndex.get(message.gameId)!;
    if (!gameChannels.has(message.channel)) {
      gameChannels.set(message.channel, new Set());
    }

    gameChannels.get(message.channel)!.add(message.id);

    logger.info("Chat message added to repository", {
      messageId: message.id,
      gameId: message.gameId,
      channel: message.channel,
    });

    return message;
  }

  async update(id: string, message: ChatMessage): Promise<ChatMessage | null> {
    const existingMessage = this.messages.get(id);
    if (!existingMessage) {
      return null;
    }

    // ゲームIDまたはチャンネルが変更された場合、インデックスを更新
    if (existingMessage.gameId !== message.gameId || existingMessage.channel !== message.channel) {
      // 古いインデックスから削除
      const oldGameChannels = this.gameChannelIndex.get(existingMessage.gameId);
      if (oldGameChannels) {
        const oldChannelMessages = oldGameChannels.get(existingMessage.channel);
        if (oldChannelMessages) {
          oldChannelMessages.delete(id);
          // 空になったセットを削除
          if (oldChannelMessages.size === 0) {
            oldGameChannels.delete(existingMessage.channel);
          }
        }
        // 空になったマップを削除
        if (oldGameChannels.size === 0) {
          this.gameChannelIndex.delete(existingMessage.gameId);
        }
      }

      // 新しいインデックスに追加
      if (!this.gameChannelIndex.has(message.gameId)) {
        this.gameChannelIndex.set(message.gameId, new Map());
      }
      const newGameChannels = this.gameChannelIndex.get(message.gameId)!;
      if (!newGameChannels.has(message.channel)) {
        newGameChannels.set(message.channel, new Set());
      }
      newGameChannels.get(message.channel)!.add(id);
    }

    this.messages.set(id, message);
    return message;
  }

  async findById(id: string): Promise<ChatMessage | null> {
    return this.messages.get(id) || null;
  }

  async delete(id: string): Promise<boolean> {
    const message = this.messages.get(id);
    if (!message) return false;

    // インデックスから削除
    const gameChannels = this.gameChannelIndex.get(message.gameId);
    if (gameChannels) {
      const channelMessages = gameChannels.get(message.channel);
      if (channelMessages) {
        channelMessages.delete(id);
        // 空になったセットを削除
        if (channelMessages.size === 0) {
          gameChannels.delete(message.channel);
        }
      }
      // 空になったマップを削除
      if (gameChannels.size === 0) {
        this.gameChannelIndex.delete(message.gameId);
      }
    }

    this.messages.delete(id);
    logger.info("Chat message deleted from repository", { messageId: id });
    return true;
  }

  async findAll(): Promise<ChatMessage[]> {
    return Array.from(this.messages.values());
  }

  async findByGameAndChannel(gameId: string, channel: ChatChannel): Promise<ChatMessage[]> {
    const gameChannels = this.gameChannelIndex.get(gameId);
    if (!gameChannels) return [];

    const messageIds = gameChannels.get(channel);
    if (!messageIds) return [];

    return Array.from(messageIds)
      .map((id) => this.messages.get(id))
      .filter((message): message is ChatMessage => message !== undefined);
  }

  async findByGame(gameId: string): Promise<ChatMessage[]> {
    const gameChannels = this.gameChannelIndex.get(gameId);
    if (!gameChannels) return [];

    // すべてのチャンネルのメッセージを取得
    const allMessageIds = new Set<string>();
    gameChannels.forEach((messageIds) => {
      messageIds.forEach((id) => allMessageIds.add(id));
    });

    return Array.from(allMessageIds)
      .map((id) => this.messages.get(id))
      .filter((message): message is ChatMessage => message !== undefined);
  }

  async deleteByGame(gameId: string): Promise<boolean> {
    const gameChannels = this.gameChannelIndex.get(gameId);
    if (!gameChannels) return false;

    // すべてのメッセージIDを収集
    const allMessageIds = new Set<string>();
    gameChannels.forEach((messageIds) => {
      messageIds.forEach((id) => allMessageIds.add(id));
    });

    // メッセージを削除
    allMessageIds.forEach((id) => this.messages.delete(id));

    // インデックスを削除
    this.gameChannelIndex.delete(gameId);

    logger.info("All chat messages for game deleted from repository", { gameId });
    return true;
  }

  async clear(): Promise<void> {
    this.messages.clear();
    this.gameChannelIndex.clear();
    logger.info("Chat message repository cleared");
  }
}
