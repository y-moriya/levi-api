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
  channel: z.enum(["PUBLIC", "WEREWOLF", "SEER", "BODYGUARD", "MEDIUM", "DEAD", "PRIVATE"]),
  content: z.string().min(1).max(500),
  recipientId: z.string().optional(), // プライベートメッセージの場合に使用
});

const messageValidation = createValidationMiddleware(messageSchema);

// メッセージ送信
chat.post("/:gameId/chat", messageValidation, chatController.sendMessage);

// メッセージ取得
chat.get("/:gameId/chat", chatController.getMessages);

export default chat;
