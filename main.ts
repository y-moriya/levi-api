import { Hono } from "https://deno.land/x/hono@v3.11.7/mod.ts";
import { cors } from "https://deno.land/x/hono@v3.11.7/middleware.ts";
import { Context } from "https://deno.land/x/hono@v3.11.7/context.ts";
import auth from "./routes/auth.ts";
import games from "./routes/games.ts";
import chat from "./routes/chat.ts";
import { logger } from "./utils/logger.ts";

const app = new Hono();

// グローバルミドルウェア
app.use("*", cors());

// ルート
app.route("/v1/auth", auth);
app.route("/v1/games", games);
app.route("/v1/chat", chat);

// 404ハンドラ
app.notFound((c: Context) => {
  return c.json({
    code: "NOT_FOUND",
    message: "Not Found",
  }, 404);
});

// ヘルスチェック
app.get("/v1/health", (c: Context) => {
  c.status(200);
  return c.json({
    status: "OK",
  });
});

// エラーハンドリング
app.onError((err, c) => {
  logger.error("Unhandled error", err);
  return c.json({ error: "Internal Server Error" }, 500);
});

// サーバーの起動
if (import.meta.main) {
  const port = Number(Deno.env.get("PORT")) || 8080;
  Deno.serve({ port }, app.fetch);
  logger.info(`Server is running on port ${port}`);
}

export default app;
