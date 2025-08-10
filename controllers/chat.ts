import { Context } from "https://deno.land/x/hono@v3.11.7/context.ts";
import { ChatChannel, SendMessageRequest } from "../types/chat.ts";
import * as chatService from "../services/chat.ts";
import * as gameModel from "../models/game.ts";
import { logger } from "../utils/logger.ts";
import { ErrorCode, GameError } from "../types/error.ts";
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
        ErrorCode.INVALID_MESSAGE,
        "メッセージは空にできません",
        "WARN",
        { gameId, userId }
      );
    }

    // ゲームの存在確認
    const game = await gameModel.getGameById(gameId);
    if (!game) {
      throw new GameError(
        ErrorCode.GAME_NOT_FOUND,
        getMessage("GAME_NOT_FOUND", lang),
        "WARN",
        { gameId },
      );
    }

    // プレイヤーの参加確認（未参加は 403 想定のため PERMISSION_DENIED を使用）
    const player = game.players.find((p: { playerId: string }) => p.playerId === userId);
    if (!player) {
      throw new GameError(
        ErrorCode.PERMISSION_DENIED,
        getMessage("UNAUTHORIZED", lang),
        "WARN",
        { gameId, userId },
      );
    }

    // 役職別チャンネルへのアクセス制限チェック
    if (data.channel === "WEREWOLF" && player.role !== "WEREWOLF") {
      logger.warn("チャンネルアクセス拒否", { gameId, userId, channel: data.channel });
      throw new GameError(
        ErrorCode.CHANNEL_ACCESS_DENIED,
        getMessage("CHANNEL_ACCESS_DENIED", lang),
        "WARN",
        { gameId, userId, channel: data.channel },
      );
    }

    // その他の役職別チャンネル制限
    if (data.channel === "SEER" && player.role !== "SEER") {
      logger.warn("占い師チャンネルアクセス拒否", { gameId, userId, channel: data.channel });
      throw new GameError(
        ErrorCode.CHANNEL_ACCESS_DENIED,
        "占い師チャンネルには占い師のみがアクセスできます",
        "WARN",
        { gameId, userId, channel: data.channel },
      );
    }

    if (data.channel === "BODYGUARD" && player.role !== "BODYGUARD") {
      logger.warn("守護者チャンネルアクセス拒否", { gameId, userId, channel: data.channel });
      throw new GameError(
        ErrorCode.CHANNEL_ACCESS_DENIED,
        "守護者チャンネルには守護者のみがアクセスできます",
        "WARN",
        { gameId, userId, channel: data.channel },
      );
    }

    if (data.channel === "MEDIUM" && player.role !== "MEDIUM") {
      logger.warn("霊能者チャンネルアクセス拒否", { gameId, userId, channel: data.channel });
      throw new GameError(
        ErrorCode.CHANNEL_ACCESS_DENIED,
        "霊能者チャンネルには霊能者のみがアクセスできます",
        "WARN",
        { gameId, userId, channel: data.channel },
      );
    }
    
    // 死亡者チャンネルへの投稿は死亡したプレイヤーのみ許可
    if (data.channel === "DEAD" && player.isAlive) {
      logger.warn("死亡者チャンネルアクセス拒否", { gameId, userId, channel: data.channel });
      throw new GameError(
        ErrorCode.CHANNEL_ACCESS_DENIED,
        "死亡者チャンネルには死亡したプレイヤーのみがアクセスできます",
        "WARN",
        { gameId, userId, channel: data.channel },
      );
    }

    // 死亡プレイヤーはDEAD以外のチャンネルに投稿できない（PRIVATE/役職/公開含む）
    if (player.isAlive === false && data.channel !== "DEAD") {
      logger.warn("死亡プレイヤーの非DEADチャンネル投稿拒否", { gameId, userId, channel: data.channel });
      throw new GameError(
        ErrorCode.CHANNEL_ACCESS_DENIED,
        "死亡したプレイヤーは霊界以外のチャンネルにメッセージを送信できません",
        "WARN",
        { gameId, userId, channel: data.channel },
      );
    }

    // 死亡したプレイヤーは公開チャットに投稿できない
    if (data.channel === "PUBLIC" && !player.isAlive) {
      logger.warn("死亡プレイヤーの公開チャット投稿拒否", { gameId, userId, channel: data.channel });
      throw new GameError(
        ErrorCode.CHANNEL_ACCESS_DENIED,
        "死亡したプレイヤーは公開チャットにメッセージを送信できません",
        "WARN",
        { gameId, userId, channel: data.channel },
      );
    }

    // プライベートメッセージのチェック
    if (data.channel === "PRIVATE") {
      if (!data.recipientId) {
        throw new GameError(
          ErrorCode.INVALID_MESSAGE,
          "プライベートメッセージの受信者IDが指定されていません",
          "WARN",
          { gameId, userId }
        );
      }

      // 受信者が存在するかチェック
    const recipient = game.players.find((p) => p.playerId === data.recipientId);
      if (!recipient) {
        throw new GameError(
      ErrorCode.INVALID_REQUEST,
          "指定された受信者は存在しません",
          "WARN",
      { gameId, userId }
        );
      }

      // 死亡プレイヤーからのプライベートメッセージは禁止
      if (!player.isAlive) {
        throw new GameError(
          ErrorCode.CHANNEL_ACCESS_DENIED,
          "死亡したプレイヤーはプライベートメッセージを送信できません",
          "WARN",
          { gameId, userId }
        );
      }
    }

    // 夜間は公開チャットに投稿できない（人狼以外）
    if (game.currentPhase === "NIGHT" && data.channel === "PUBLIC" && player.role !== "WEREWOLF") {
      logger.warn("夜間の公開チャット投稿拒否", { gameId, userId, channel: data.channel, phase: game.currentPhase });
      throw new GameError(
        ErrorCode.PHASE_CHAT_RESTRICTED,
        "夜間は公開チャットに参加できません",
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
      recipientId: data.recipientId,
      createdAt: new Date().toISOString(),
    };

    const savedMessage = await chatService.addMessage(message);
    logger.info("チャットメッセージ送信", { gameId, channel: data.channel, userId });
    // レスポンスをテスト期待の形にマッピング
    const responseBody = {
      id: savedMessage.id,
      gameId: savedMessage.gameId,
      content: savedMessage.content,
      channel: savedMessage.channel,
      sender: {
        id: savedMessage.senderId,
        username: savedMessage.senderUsername,
      },
      recipientId: savedMessage.recipientId,
      createdAt: savedMessage.createdAt,
    };
    return c.json(responseBody, 201);
  } catch (error) {
    // GameErrorはそのまま再スロー
    if (error instanceof GameError) {
      throw error;
    }
    // その他のエラーは内部サーバーエラーとして処理
    logger.error("メッセージの送信に失敗", error instanceof Error ? error : new Error(String(error)), {
      gameId,
      userId,
    });
    throw new GameError(
      ErrorCode.INTERNAL_SERVER_ERROR,
      getMessage("INTERNAL_SERVER_ERROR", lang),
      "ERROR",
      { originalError: error instanceof Error ? error.message : String(error) },
    );
  }
};

export const getMessages = async (c: Context) => {
  const gameId = c.req.param("gameId");
  const channel = c.req.query("channel") as ChatChannel;
  const userId = c.get("userId");
  const lang = getLang(c);

  try {
    // ゲームの存在確認
    const game = await gameModel.getGameById(gameId);
    if (!game) {
      throw new GameError(
        ErrorCode.GAME_NOT_FOUND,
        getMessage("GAME_NOT_FOUND", lang),
        "WARN",
        { gameId },
      );
    }

    // プレイヤーの参加確認（未参加は403を返すため PERMISSION_DENIED）
    const player = game.players.find((p: { playerId: string }) => p.playerId === userId);
    if (!player) {
      throw new GameError(
        ErrorCode.PERMISSION_DENIED,
        getMessage("UNAUTHORIZED", lang),
        "WARN",
        { gameId, userId },
      );
    }

    // チャンネルのアクセス権確認
    if (channel === "WEREWOLF" && player.role !== "WEREWOLF") {
      logger.warn("人狼チャンネルアクセス拒否", { gameId, userId, channel });
      throw new GameError(
        ErrorCode.CHANNEL_ACCESS_DENIED,
        "人狼チャンネルへのアクセスが拒否されました",
        "WARN",
        { gameId, userId, channel },
      );
    }
    
    // その他の役職別チャンネル制限
    if (channel === "SEER" && player.role !== "SEER") {
      logger.warn("占い師チャンネルアクセス拒否", { gameId, userId, channel });
      throw new GameError(
        ErrorCode.CHANNEL_ACCESS_DENIED,
        "占い師チャンネルへのアクセスが拒否されました",
        "WARN",
        { gameId, userId, channel },
      );
    }

    if (channel === "BODYGUARD" && player.role !== "BODYGUARD") {
      logger.warn("守護者チャンネルアクセス拒否", { gameId, userId, channel });
      throw new GameError(
        ErrorCode.CHANNEL_ACCESS_DENIED,
        "守護者チャンネルへのアクセスが拒否されました",
        "WARN",
        { gameId, userId, channel },
      );
    }

    if (channel === "MEDIUM" && player.role !== "MEDIUM") {
      logger.warn("霊能者チャンネルアクセス拒否", { gameId, userId, channel });
      throw new GameError(
        ErrorCode.CHANNEL_ACCESS_DENIED,
        "霊能者チャンネルへのアクセスが拒否されました",
        "WARN",
        { gameId, userId, channel },
      );
    }
    
    // 死亡者チャンネルのアクセス権確認
    if (channel === "DEAD" && player.isAlive) {
      logger.warn("死亡者チャンネルアクセス拒否", { gameId, userId, channel });
      throw new GameError(
        ErrorCode.CHANNEL_ACCESS_DENIED,
        "死亡者チャンネルへのアクセスが拒否されました",
        "WARN",
        { gameId, userId, channel },
      );
    }

    // メッセージの取得
    const messages = await chatService.getGameMessages(gameId, channel, userId, game);
    logger.info("メッセージ取得", { gameId, channel, count: messages.length });
    // レスポンス整形
    const response = messages.map((m) => ({
      id: m.id,
      gameId: m.gameId,
      content: m.content,
      channel: m.channel,
      sender: {
        id: m.senderId,
        username: m.senderUsername,
      },
      recipientId: m.recipientId,
      createdAt: m.createdAt,
    }));
    return c.json(response, 200);
  } catch (error) {
    // GameErrorはそのまま再スロー
    if (error instanceof GameError) {
      throw error;
    }
    // その他のエラーは内部サーバーエラーとして処理
    logger.error("メッセージ取得失敗", error instanceof Error ? error : new Error(String(error)), {
      gameId,
      userId,
    });
    throw new GameError(
      ErrorCode.INTERNAL_SERVER_ERROR,
      getMessage("INTERNAL_SERVER_ERROR", lang),
      "ERROR",
      { originalError: error instanceof Error ? error.message : String(error) },
    );
  }
};
