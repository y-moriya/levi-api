import { Hono } from "https://deno.land/x/hono@v3.11.7/mod.ts";
import * as gamesController from "../controllers/games.ts";
import { authMiddleware } from "../middleware/auth.ts";
import { validateGameCreation } from "../middleware/validation.ts";
import { attack, divine, guard, vote } from "../controllers/actions.ts";
import { createValidationMiddleware } from "../middleware/validation.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const games = new Hono();

// 認証が必要なルートにミドルウェアを適用
games.use("/*", authMiddleware);

// アクション用のバリデーション
const actionSchema = z.object({
  targetPlayerId: z.string().uuid({ message: "Invalid target player ID format" }),
});

const actionValidation = createValidationMiddleware(actionSchema);

// ゲーム一覧の取得
games.get("/", gamesController.getAllGames);

// ゲームの作成 - バリデーションを追加
games.post("/", validateGameCreation, gamesController.createGame);

// 特定のゲームの取得
games.get("/:gameId", gamesController.getGame);

// ゲームへの参加
games.post("/:gameId/join", gamesController.joinGame);

// ゲームからの退出
games.post("/:gameId/leave", gamesController.leaveGame);

// ゲームの開始
games.post("/:gameId/start", gamesController.startGame);

// ゲームアクション
games.post("/:gameId/vote", actionValidation, vote);
games.post("/:gameId/attack", actionValidation, attack);
games.post("/:gameId/divine", actionValidation, divine);
games.post("/:gameId/guard", actionValidation, guard);

export default games;
