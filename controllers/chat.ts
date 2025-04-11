import { Context } from "https://deno.land/x/hono@v3.11.7/context.ts";
import { SendMessageRequest } from "../types/chat.ts";
import * as chatService from "../services/chat.ts";
import * as gameModel from "../models/game.ts";
import { logger } from "../utils/logger.ts";
import { GameError } from "../types/error.ts";
import { getMessage } from "../utils/messages.ts";
import { getLang } from "../utils/context.ts";

export const sendMessage = async (c: Context) => {
  const gameId = c.req.param("gameId");
  const userId = c.get("userId");
  const lang = getLang(c);

  try {
    const data = await c.req.json() as SendMessageRequest;

    // メッセージの内容チェック
    if (!data.content || data.content.trim() === "") {
      throw new GameError(
        "INVALID_MESSAGE",
        "メッセージは空にできません",
        "WARN",
        { gameId, userId }
      );
    }

    // ゲームの存在確認
    const game = await gameModel.getGameById(gameId);
    if (!game) {
      throw new GameError(
        "GAME_NOT_FOUND",
        getMessage("GAME_NOT_FOUND", lang),
        "WARN",
        { gameId },
      );
    }

    // プレイヤーの参加確認
    const player = game.players.find((p: { playerId: string }) => p.playerId === userId);
    if (!player) {
      throw new GameError(
        "UNAUTHORIZED",
        getMessage("UNAUTHORIZED", lang),
        "WARN",
        { gameId, userId },
      );
    }

    // 人狼チャンネルへの投稿は人狼のみ許可
    if (data.channel === "WEREWOLF" && player.role !== "WEREWOLF") {
      logger.warn("Channel access denied", { gameId, userId, channel: data.channel });
      throw new GameError(
        "CHANNEL_ACCESS_DENIED",
        getMessage("CHANNEL_ACCESS_DENIED", lang),
        "WARN",
        { gameId, userId, channel: data.channel },
      );
    }
    
    // 霊界チャンネルへの投稿は死亡したプレイヤーのみ許可
    if (data.channel === "SPIRIT" && player.isAlive) {
      logger.warn("Spirit channel access denied to living player", { gameId, userId, channel: data.channel });
      throw new GameError(
        "CHANNEL_ACCESS_DENIED",
        "霊界チャンネルには死亡したプレイヤーのみがアクセスできます",
        "WARN",
        { gameId, userId, channel: data.channel },
      );
    }

    // 死亡したプレイヤーは全体チャットに投稿できない
    if (data.channel === "GLOBAL" && !player.isAlive) {
      logger.warn("Global channel access denied to dead player", { gameId, userId, channel: data.channel });
      throw new GameError(
        "CHANNEL_ACCESS_DENIED",
        "死亡したプレイヤーは全体チャットにメッセージを送信できません",
        "WARN",
        { gameId, userId, channel: data.channel },
      );
    }

    // 夜間は全体チャットに投稿できない（人狼以外）
    if (game.currentPhase === "NIGHT" && data.channel === "GLOBAL" && player.role !== "WEREWOLF") {
      logger.warn("Night phase global chat denied", { gameId, userId, channel: data.channel, phase: game.currentPhase });
      throw new GameError(
        "PHASE_CHAT_RESTRICTED",
        "夜間は全体チャットに参加できません",
        "WARN",
        { gameId, userId, channel: data.channel, phase: game.currentPhase },
      );
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
    logger.info("Chat message sent", { gameId, channel: data.channel, userId });
    return c.json({ success: true });
  } catch (error) {
    // GameErrorはそのまま再スロー
    if (error instanceof GameError) {
      throw error;
    }
    // その他のエラーは内部サーバーエラーとして処理
    logger.error("Failed to send message", error instanceof Error ? error : new Error(String(error)), {
      gameId,
      userId,
    });
    throw new GameError(
      "INTERNAL_SERVER_ERROR",
      getMessage("INTERNAL_SERVER_ERROR", lang),
      "ERROR",
      { originalError: error instanceof Error ? error.message : String(error) },
    );
  }
};

export const getMessages = async (c: Context) => {
  const gameId = c.req.param("gameId");
  const channel = c.req.param("channel");
  const userId = c.get("userId");
  const lang = getLang(c);

  try {
    // ゲームの存在確認
    const game = await gameModel.getGameById(gameId);
    if (!game) {
      throw new GameError(
        "GAME_NOT_FOUND",
        getMessage("GAME_NOT_FOUND", lang),
        "WARN",
        { gameId },
      );
    }

    // プレイヤーの参加確認
    const player = game.players.find((p: { playerId: string }) => p.playerId === userId);
    if (!player) {
      throw new GameError(
        "UNAUTHORIZED",
        getMessage("UNAUTHORIZED", lang),
        "WARN",
        { gameId, userId },
      );
    }

    // チャンネルのアクセス権確認
    if (channel === "WEREWOLF" && player.role !== "WEREWOLF") {
      logger.warn("Channel access denied", { gameId, userId, channel });
      // エラーをスローせず、空の配列を返す
      return c.json({ messages: [] });
    }
    
    // 霊界チャンネルのアクセス権確認
    if (channel === "SPIRIT" && player.isAlive) {
      logger.warn("Spirit channel access denied to living player", { gameId, userId, channel });
      // エラーをスローせず、空の配列を返す
      return c.json({ messages: [] });
    }

    // メッセージの取得
    const messages = await chatService.getGameMessages(gameId, channel as "GLOBAL" | "WEREWOLF" | "GENERAL" | "SPIRIT", userId, game);
    logger.info("Messages retrieved", { gameId, channel, count: messages.length });
    return c.json({ messages });
  } catch (error) {
    // GameErrorはそのまま再スロー
    if (error instanceof GameError) {
      throw error;
    }
    // その他のエラーは内部サーバーエラーとして処理
    logger.error("Failed to get messages", error instanceof Error ? error : new Error(String(error)), {
      gameId,
      userId,
    });
    throw new GameError(
      "INTERNAL_SERVER_ERROR",
      getMessage("INTERNAL_SERVER_ERROR", lang),
      "ERROR",
      { originalError: error instanceof Error ? error.message : String(error) },
    );
  }
};
