import { Context, Next } from "https://deno.land/x/hono@v3.11.7/mod.ts";
import { GameError, APIError, ErrorSeverity, ErrorCode, ErrorCategory, ErrorContext } from "../types/error.ts";
import { logger } from "../utils/logger.ts";
import { config } from "../config.ts";
import { setRequestId, getRequestId } from "../utils/context.ts";

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

// リクエストIDを生成
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// エラーハンドリングミドルウェア
export const errorHandler = async (c: Context, next: Next) => {
  // パフォーマンス測定開始
  logger.startTimer(`request-${c.req.path}`);
  
  const requestId = generateRequestId();
  setRequestId(c, requestId);

  try {
    await next();
    
    // 正常レスポンス時はパフォーマンス測定終了
    logger.endTimer(`request-${c.req.path}`, {
      path: c.req.path,
      method: c.req.method,
      statusCode: c.res.status,
      requestId
    });
  } catch (error: unknown) {
    // エラーコンテキスト情報の生成
    const errorContext: ErrorContext = {
      requestPath: c.req.path,
      requestMethod: c.req.method,
      operationName: `${c.req.method} ${c.req.path}`,
    };
    
    // エラーの変換（すでにGameErrorの場合もコンテキスト情報を追加）
    const gameError = GameError.fromError(error, "INTERNAL_SERVER_ERROR", errorContext);
    
    // ステータスコードの決定
    const status = errorStatusMap[gameError.code] || 500;

    // パフォーマンス測定終了（エラー時）
    logger.endTimer(`request-${c.req.path}`, {
      path: c.req.path,
      method: c.req.method,
      statusCode: status,
      errorCode: gameError.code,
      requestId
    });
    
    // エラーログ出力
    logger.logWithSeverity(
      `HTTP ${status} エラー: ${gameError.code} - ${gameError.message}`,
      gameError.severity,
      gameError,
      {
        requestId,
        errorCode: gameError.code,
        errorCategory: gameError.category,
        statusCode: status,
        path: c.req.path,
        method: c.req.method
      }
    );
    
    // 開発環境でのみ詳細情報を含める
    const details = config.env === "production" ? undefined : {
      stack: gameError.stack,
      context: gameError.context,
      ...(gameError.details || {})
    };
    
    // APIエラーレスポンスを返却
    return c.json({
      code: gameError.code,
      message: gameError.message,
      severity: gameError.severity,
      category: gameError.category,
      timestamp: new Date().toISOString(),
      requestId,
      details
    }, status);
  }
};