import { Context } from "https://deno.land/x/hono@v3.11.7/context.ts";
import { SendMessageRequest } from "../types/chat.ts";
import * as chatService from "../services/chat.ts";
import * as gameModel from "../models/game.ts";
import { logger } from "../utils/logger.ts";

export const sendMessage = async (c: Context) => {
  const gameId = c.req.param("gameId");
  const userId = c.get("userId");
  const data = await c.req.json() as SendMessageRequest;

  try {
    // ゲームの存在確認
    const game = gameModel.getGameById(gameId);
    if (!game) {
      logger.warn("Game not found for chat message", { gameId });
      return c.json({ code: "GAME_NOT_FOUND", message: "Game not found" }, 404);
    }

    // プレイヤーの参加確認
    const player = game.players.find((p) => p.playerId === userId);
    if (!player) {
      logger.warn("Player not in game", { gameId, userId });
      return c.json({ code: "PLAYER_NOT_IN_GAME", message: "Player not in game" }, 403);
    }

    // 人狼チャンネルへの投稿は人狼のみ許可
    if (data.channel === "WEREWOLF" && player.role !== "WEREWOLF") {
      logger.warn("Non-werewolf tried to send message to werewolf channel", {
        gameId,
        userId,
      });
      return c.json({
        code: "CHANNEL_ACCESS_DENIED",
        message: "Access to werewolf channel denied",
      }, 403);
    }

    // メッセージの保存
    const message = {
      id: crypto.randomUUID(),
      gameId,
      channel: data.channel,
      senderId: userId,
      senderUsername: player.username,
      senderRole: player.role,
      content: data.content,
      timestamp: new Date().toISOString(),
    };

    chatService.addMessage(message);
    logger.info("Message sent", { gameId, channel: data.channel, userId });
    return c.json({ success: true });
  } catch (error) {
    logger.error("Failed to send message", error as Error, { gameId, userId });
    throw error;
  }
};

export const getMessages = (c: Context) => {
  const gameId = c.req.param("gameId");
  const channel = c.req.param("channel");
  const userId = c.get("userId");

  try {
    // ゲームの存在確認
    const game = gameModel.getGameById(gameId);
    if (!game) {
      logger.warn("Game not found for chat messages", { gameId });
      return c.json({ code: "GAME_NOT_FOUND", message: "Game not found" }, 404);
    }

    // プレイヤーの参加確認
    const player = game.players.find((p) => p.playerId === userId);
    if (!player) {
      logger.warn("Player not in game", { gameId, userId });
      return c.json({ code: "PLAYER_NOT_IN_GAME", message: "Player not in game" }, 403);
    }

    // メッセージの取得
    const messages = chatService.getGameMessages(gameId, channel as "GLOBAL" | "WEREWOLF", userId, game);
    logger.info("Messages retrieved", { gameId, channel, count: messages.length });
    return c.json({ messages });
  } catch (error) {
    logger.error("Failed to get messages", error as Error, { gameId, userId });
    throw error;
  }
};
