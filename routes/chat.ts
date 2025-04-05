import { Hono } from "https://deno.land/x/hono@v3.11.7/mod.ts";
import * as chatController from "../controllers/chat.ts";
import { authMiddleware } from "../middleware/auth.ts";
import { createValidationMiddleware } from "../middleware/validation.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const chat = new Hono();

// 認証ミドルウェアを適用
chat.use("/*", authMiddleware);

// チャットメッセージのバリデーションスキーマ
const messageSchema = z.object({
  channel: z.enum(["GLOBAL", "WEREWOLF", "GENERAL", "SPIRIT"]),
  content: z.string().min(1).max(500),
});

const messageValidation = createValidationMiddleware(messageSchema);

// メッセージ送信
chat.post("/:gameId/messages", messageValidation, chatController.sendMessage);

// メッセージ取得
chat.get("/:gameId/messages/:channel", chatController.getMessages);

export default chat;
