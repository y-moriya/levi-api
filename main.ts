import { Hono } from "https://deno.land/x/hono@v3.11.7/mod.ts";
import { cors } from "https://deno.land/x/hono@v3.11.7/middleware.ts";
import { Context } from "https://deno.land/x/hono@v3.11.7/context.ts";
import auth from "./routes/auth.ts";
import games from "./routes/games.ts";
import chat from "./routes/chat.ts";
import actions from "./routes/actions.ts";
import { logger } from "./utils/logger.ts";
import { errorHandler } from "./middleware/error.ts";
import { SupportedLanguage, getMessage } from "./utils/messages.ts";
import { config } from "./config.ts";
import { getLang, getRequestId, setLang } from "./utils/context.ts";
import { GameError } from "./types/error.ts";

const app = new Hono();

// エラーコードとHTTPステータスコードのマッピング
const errorStatusMap: Record<string, number> = {
  INVALID_CREDENTIALS: 401,
  EMAIL_EXISTS: 400,
  TOKEN_EXPIRED: 401,
  TOKEN_INVALID: 401,
  UNAUTHORIZED: 401,
  VALIDATION_ERROR: 400,
  INVALID_REQUEST: 400,
  GAME_NOT_FOUND: 404,
  GAME_FULL: 400,
  GAME_ALREADY_STARTED: 400,
  INVALID_PHASE: 400,
  NOT_WEREWOLF: 403,
  NOT_SEER: 403,
  NOT_BODYGUARD: 403,
  NOT_GAME_OWNER: 403,
  CHANNEL_ACCESS_DENIED: 403,
  INVALID_CHANNEL: 400,
  VOTE_ERROR: 400,
  ATTACK_ERROR: 400,
  DIVINE_ERROR: 400,
  GUARD_ERROR: 400,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500,
};

// グローバルミドルウェア
app.use("*", cors());

// 言語設定ミドルウェア
app.use("*", async (c, next) => {
  // Accept-Languageヘッダーからユーザーの言語設定を取得
  const acceptLanguage = c.req.header("Accept-Language") || "ja";
  const lang = acceptLanguage.startsWith("en") ? "en" : "ja";
  setLang(c, lang);
  await next();
});

// エラーハンドリングミドルウェア
app.use("*", errorHandler);

// ルート
app.route("/v1/auth", auth);
app.route("/v1/games", games);
app.route("/v1/chat", chat);
app.route("/v1/actions", actions);

// 404ハンドラ
app.notFound((c: Context) => {
  const lang = getLang(c);
  return c.json({
    code: "NOT_FOUND",
    message: "Not Found",
    severity: "INFO",
    timestamp: new Date().toISOString(),
    requestId: getRequestId(c)
  }, 404);
});

// ヘルスチェック
app.get("/v1/health", (c: Context) => {
  c.status(200);
  return c.json({
    status: "OK",
    version: config.version,
    timestamp: new Date().toISOString()
  });
});

// グローバルエラーハンドラ
app.onError((err, c) => {
  const requestId = getRequestId(c);
  const lang = getLang(c);
  let status = 500; // デフォルトは内部サーバーエラー
  let code = "INTERNAL_SERVER_ERROR";
  let severity = "ERROR";
  let details;
  
  // GameErrorの場合は詳細情報を取得
  if (err instanceof GameError) {
    code = err.code;
    severity = err.severity;
    details = config.env === "production" ? undefined : {
      stack: err.stack,
      ...(err.details || {})
    };
    // エラーコードに基づいてステータスコードを設定
    status = errorStatusMap[err.code] || 500;
  } else {
    details = config.env === "production" ? undefined : {
      stack: err.stack
    };
  }
  
  logger.error(`HTTP ${status} error: ${code}`, err, { 
    requestId, 
    errorCode: code,
    errorMessage: err.message 
  });
  
  return c.json({
    code,
    message: err.message,
    severity,
    timestamp: new Date().toISOString(),
    requestId,
    details
  }, status);
});

// サーバーの起動
if (import.meta.main) {
  const port = Number(Deno.env.get("PORT")) || 8080;
  Deno.serve({ port }, app.fetch);
  logger.info(`Server is running on port ${port}`);
}

export default app;
