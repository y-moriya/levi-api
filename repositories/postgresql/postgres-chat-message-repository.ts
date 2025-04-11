import { ChatChannel, ChatMessage } from "../../types/chat.ts";
import { ChatMessageRepository } from "../interfaces/chat-message-repository.ts";
import { getClient, PostgresClient } from "./pg-client.ts";
import { logger } from "../../utils/logger.ts";
import { ErrorContext, GameError } from "../../types/error.ts";

/**
 * チャットメッセージリポジトリのPostgreSQL実装
 */
export class PostgresChatMessageRepository implements ChatMessageRepository {
  async add(message: ChatMessage): Promise<ChatMessage> {
    const client = await getClient();
    try {
      await client.queryObject(`
        INSERT INTO chat_messages (
          id, game_id, channel, sender_id, sender_username, sender_role, content, timestamp
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8
        )
      `, [
        message.id,
        message.gameId,
        message.channel,
        message.senderId,
        message.senderUsername,
        message.senderRole,
        message.content,
        message.timestamp
      ]);
      
      logger.info("Chat message added to PostgreSQL repository", {
        messageId: message.id,
        gameId: message.gameId,
        channel: message.channel
      });
      
      return message;
    } catch (error: unknown) {
      const err = error as Error;
      const context: Record<string, unknown> = { 
        messageId: message.id,
        gameId: message.gameId,
        error: err.message
      };
      logger.error("Error adding chat message to PostgreSQL repository", context);
      throw GameError.fromError(error, "INTERNAL_SERVER_ERROR", context as ErrorContext);
    } finally {
      client.release();
    }
  }

  async update(id: string, message: ChatMessage): Promise<ChatMessage | null> {
    const client = await getClient();
    try {
      // メッセージが存在するか確認
      const { rows: existingMessage } = await client.queryObject<{ id: string }>(
        "SELECT id FROM chat_messages WHERE id = $1", [id]
      );
      
      if (existingMessage.length === 0) {
        return null;
      }
      
      await client.queryObject(`
        UPDATE chat_messages SET
          game_id = $1,
          channel = $2,
          sender_id = $3,
          sender_username = $4,
          sender_role = $5,
          content = $6,
          timestamp = $7
        WHERE id = $8
      `, [
        message.gameId,
        message.channel,
        message.senderId,
        message.senderUsername,
        message.senderRole,
        message.content,
        message.timestamp,
        id
      ]);
      
      logger.info("Chat message updated in PostgreSQL repository", { messageId: id });
      return message;
    } catch (error: unknown) {
      const err = error as Error;
      const context: Record<string, unknown> = { 
        messageId: id,
        error: err.message
      };
      logger.error("Error updating chat message in PostgreSQL repository", context);
      throw GameError.fromError(error, "INTERNAL_SERVER_ERROR", context as ErrorContext);
    } finally {
      client.release();
    }
  }

  async findById(id: string): Promise<ChatMessage | null> {
    const client = await getClient();
    try {
      const { rows } = await client.queryObject<{
        id: string;
        game_id: string;
        channel: string;
        sender_id: string;
        sender_username: string;
        sender_role: string | null;
        content: string;
        timestamp: string;
      }>(`
        SELECT * FROM chat_messages WHERE id = $1
      `, [id]);
      
      if (rows.length === 0) {
        return null;
      }
      
      const messageData = rows[0];
      
      return {
        id: messageData.id,
        gameId: messageData.game_id,
        channel: messageData.channel as ChatChannel,
        senderId: messageData.sender_id,
        senderUsername: messageData.sender_username,
        senderRole: messageData.sender_role as any || undefined,
        content: messageData.content,
        timestamp: messageData.timestamp
      };
    } catch (error: unknown) {
      const err = error as Error;
      const context: Record<string, unknown> = { 
        messageId: id,
        error: err.message
      };
      logger.error("Error finding chat message by ID in PostgreSQL repository", context);
      throw GameError.fromError(error, "INTERNAL_SERVER_ERROR", context as ErrorContext);
    } finally {
      client.release();
    }
  }

  async delete(id: string): Promise<boolean> {
    const client = await getClient();
    try {
      const result = await client.queryObject(
        "DELETE FROM chat_messages WHERE id = $1", [id]
      );
      
      const deleted = result.rowCount && result.rowCount > 0;
      
      if (deleted) {
        logger.info("Chat message deleted from PostgreSQL repository", { messageId: id });
      }
      
      return deleted ? true : false; // 明示的にbooleanを返す
    } catch (error: unknown) {
      const err = error as Error;
      const context: Record<string, unknown> = { 
        messageId: id,
        error: err.message
      };
      logger.error("Error deleting chat message from PostgreSQL repository", context);
      throw GameError.fromError(error, "INTERNAL_SERVER_ERROR", context as ErrorContext);
    } finally {
      client.release();
    }
  }

  async findAll(): Promise<ChatMessage[]> {
    const client = await getClient();
    try {
      const { rows } = await client.queryObject<{
        id: string;
        game_id: string;
        channel: string;
        sender_id: string;
        sender_username: string;
        sender_role: string | null;
        content: string;
        timestamp: string;
      }>("SELECT * FROM chat_messages ORDER BY timestamp ASC");
      
      return rows.map(messageData => ({
        id: messageData.id,
        gameId: messageData.game_id,
        channel: messageData.channel as ChatChannel,
        senderId: messageData.sender_id,
        senderUsername: messageData.sender_username,
        senderRole: messageData.sender_role as any || undefined,
        content: messageData.content,
        timestamp: messageData.timestamp
      }));
    } catch (error: unknown) {
      const err = error as Error;
      const context: Record<string, unknown> = { 
        error: err.message
      };
      logger.error("Error finding all chat messages in PostgreSQL repository", context);
      throw GameError.fromError(error, "INTERNAL_SERVER_ERROR", context as ErrorContext);
    } finally {
      client.release();
    }
  }

  async findByGameAndChannel(gameId: string, channel: ChatChannel): Promise<ChatMessage[]> {
    const client = await getClient();
    try {
      const { rows } = await client.queryObject<{
        id: string;
        game_id: string;
        channel: string;
        sender_id: string;
        sender_username: string;
        sender_role: string | null;
        content: string;
        timestamp: string;
      }>(`
        SELECT * FROM chat_messages 
        WHERE game_id = $1 AND channel = $2
        ORDER BY timestamp ASC
      `, [gameId, channel]);
      
      return rows.map(messageData => ({
        id: messageData.id,
        gameId: messageData.game_id,
        channel: messageData.channel as ChatChannel,
        senderId: messageData.sender_id,
        senderUsername: messageData.sender_username,
        senderRole: messageData.sender_role as any || undefined,
        content: messageData.content,
        timestamp: messageData.timestamp
      }));
    } catch (error: unknown) {
      const err = error as Error;
      const context: Record<string, unknown> = { 
        gameId, 
        channel,
        error: err.message
      };
      logger.error("Error finding chat messages by game and channel in PostgreSQL repository", context);
      throw GameError.fromError(error, "INTERNAL_SERVER_ERROR", context as ErrorContext);
    } finally {
      client.release();
    }
  }

  async findByGame(gameId: string): Promise<ChatMessage[]> {
    const client = await getClient();
    try {
      const { rows } = await client.queryObject<{
        id: string;
        game_id: string;
        channel: string;
        sender_id: string;
        sender_username: string;
        sender_role: string | null;
        content: string;
        timestamp: string;
      }>(`
        SELECT * FROM chat_messages 
        WHERE game_id = $1
        ORDER BY timestamp ASC
      `, [gameId]);
      
      return rows.map(messageData => ({
        id: messageData.id,
        gameId: messageData.game_id,
        channel: messageData.channel as ChatChannel,
        senderId: messageData.sender_id,
        senderUsername: messageData.sender_username,
        senderRole: messageData.sender_role as any || undefined,
        content: messageData.content,
        timestamp: messageData.timestamp
      }));
    } catch (error: unknown) {
      const err = error as Error;
      const context: Record<string, unknown> = { 
        gameId,
        error: err.message
      };
      logger.error("Error finding chat messages by game in PostgreSQL repository", context);
      throw GameError.fromError(error, "INTERNAL_SERVER_ERROR", context as ErrorContext);
    } finally {
      client.release();
    }
  }

  async deleteByGame(gameId: string): Promise<boolean> {
    const client = await getClient();
    try {
      const result = await client.queryObject(
        "DELETE FROM chat_messages WHERE game_id = $1", [gameId]
      );
      
      const deleted = result.rowCount && result.rowCount > 0;
      
      if (deleted) {
        logger.info("All chat messages for game deleted from PostgreSQL repository", { gameId });
      }
      
      return deleted ? true : false; // 明示的にbooleanを返す
    } catch (error: unknown) {
      const err = error as Error;
      const context: Record<string, unknown> = { 
        gameId,
        error: err.message
      };
      logger.error("Error deleting chat messages by game from PostgreSQL repository", context);
      throw GameError.fromError(error, "INTERNAL_SERVER_ERROR", context as ErrorContext);
    } finally {
      client.release();
    }
  }

  async clear(): Promise<void> {
    const client = await getClient();
    try {
      await client.queryObject("DELETE FROM chat_messages");
      logger.info("PostgreSQL chat message repository cleared");
    } catch (error: unknown) {
      const err = error as Error;
      const context: Record<string, unknown> = { 
        error: err.message
      };
      logger.error("Error clearing PostgreSQL chat message repository", context);
      throw GameError.fromError(error, "INTERNAL_SERVER_ERROR", context as ErrorContext);
    } finally {
      client.release();
    }
  }
}