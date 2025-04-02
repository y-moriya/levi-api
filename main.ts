import { Hono } from "https://deno.land/x/hono@v3.11.7/mod.ts";
import { cors } from "https://deno.land/x/hono@v3.11.7/middleware.ts";
import { Context } from "https://deno.land/x/hono@v3.11.7/context.ts";
import auth from "./routes/auth.ts";
import games from "./routes/games.ts";
import chat from "./routes/chat.ts";
import actions from "./routes/actions.ts";
import { logger } from "./utils/logger.ts";
import { errorHandler } from "./middleware/error.ts";
import { getMessage, SupportedLanguage } from "./utils/messages.ts";
import { config } from "./config.ts";
import { getLang, getRequestId, setLang } from "./utils/context.ts";
import { ErrorContext, GameError } from "./types/error.ts";

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
  const _lang = getLang(c);
  const requestId = getRequestId(c);

  // リクエストID生成（存在しない場合）
  const actualRequestId = requestId || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // 404エラーをログに記録
  logger.warn(`HTTP 404 エラー: リソースが見つかりません - ${c.req.path}`, {
    path: c.req.path,
    method: c.req.method,
    requestId: actualRequestId,
    errorCode: "NOT_FOUND",
    errorCategory: "RES", // ResourceカテゴリのNOT_FOUND
  });

  return c.json({
    code: "NOT_FOUND",
    message: getMessage("NOT_FOUND", _lang as SupportedLanguage),
    severity: "INFO",
    category: "RES", // ResourceカテゴリのNOT_FOUND
    timestamp: new Date().toISOString(),
    requestId: actualRequestId,
  }, 404);
});

// ヘルスチェック
app.get("/v1/health", (c: Context) => {
  c.status(200);
  return c.json({
    status: "OK",
    version: config.version,
    timestamp: new Date().toISOString(),
  });
});

// グローバルエラーハンドラ
app.onError((err, c) => {
  const requestId = getRequestId(c);
  const _lang = getLang(c);

  // エラーコンテキスト情報の生成
  const errorContext: ErrorContext = {
    requestPath: c.req.path,
    requestMethod: c.req.method,
    operationName: `${c.req.method} ${c.req.path}`,
  };

  // GameErrorに変換
  const gameError = GameError.fromError(err, "INTERNAL_SERVER_ERROR", errorContext);

  // ステータスコードの決定
  const status = errorStatusMap[gameError.code] || 500;

  // エラーログ出力
  logger.logWithSeverity(
    `グローバルエラーハンドラ: HTTP ${status} エラー: ${gameError.code} - ${gameError.message}`,
    gameError.severity,
    gameError,
    {
      requestId,
      errorCode: gameError.code,
      errorCategory: gameError.category,
      statusCode: status,
      path: c.req.path,
      method: c.req.method,
    },
  );

  // 詳細情報（本番環境では含めない）
  const details = config.env === "production" ? undefined : {
    stack: gameError.stack,
    context: gameError.context,
    ...(gameError.details || {}),
  };

  // APIエラーレスポンスを返却
  return c.json({
    code: gameError.code,
    message: gameError.message,
    severity: gameError.severity,
    category: gameError.category,
    timestamp: new Date().toISOString(),
    requestId,
    details,
  }, status);
});

// サーバーの起動
if (import.meta.main) {
  const port = Number(Deno.env.get("PORT")) || 8080;
  Deno.serve({ port }, app.fetch);
  logger.info(`Server is running on port ${port}`);
}

export default app;
