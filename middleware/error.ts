import { Context, Next } from "https://deno.land/x/hono@v3.11.7/mod.ts";
import { GameError, APIError, ErrorSeverity, ErrorCode } from "../types/error.ts";
import { logger } from "../utils/logger.ts";
import { config } from "../config.ts";
import { setRequestId } from "../utils/context.ts";

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
  const requestId = generateRequestId();
  setRequestId(c, requestId);

  try {
    await next();
  } catch (error: unknown) {
    // ログ出力のためにエラーを記録
    logger.error("Error caught by error handler middleware", error instanceof Error ? error : undefined);

    let apiError: APIError;
    let status = 500; // デフォルトは500 Internal Server Error
    let code: ErrorCode = "INTERNAL_SERVER_ERROR";
    let severity: ErrorSeverity = "ERROR";
    let details: Record<string, unknown> | undefined;

    // GameErrorの場合はそのコードとシビリティを使用
    if (error instanceof GameError) {
      // コードに基づいてステータスコードを決定
      status = errorStatusMap[error.code] || 500;
      code = error.code;
      severity = error.severity;
      details = config.env === "production" ? undefined : {
        stack: error.stack,
        ...(error.details || {})
      };
    } else {
      // GameErrorでない場合の処理
      const message = error instanceof Error ? error.message : String(error);
      
      // エラーメッセージに基づくステータスコード判定
      if (message.includes("このメールアドレスは既に登録") || message.includes("Email already exists")) {
        status = 400;
        code = "EMAIL_EXISTS";
        severity = "WARN";
      } 
      // バリデーションエラー
      else if (message.includes("リクエストデータが無効") || message.includes("validation") || message.includes("Invalid")) {
        status = 400;
        code = "VALIDATION_ERROR";
        severity = "WARN";
      }
      // 認証エラー
      else if (message.includes("無効なメール") || message.includes("パスワード") || message.includes("credentials")) {
        status = 401;
        code = "INVALID_CREDENTIALS";
        severity = "WARN";
      }
      // リソース不存在エラー
      else if (message.includes("見つかりません") || message.includes("not found")) {
        status = 404;
        code = "NOT_FOUND";
        severity = "WARN";
      }

      details = config.env === "production" ? undefined : {
        stack: error instanceof Error ? error.stack : undefined
      };
    }

    // APIエラーレスポンスを構築
    apiError = {
      code,
      message: error instanceof Error ? error.message : String(error),
      severity,
      timestamp: new Date().toISOString(),
      requestId,
      details
    };

    // ロギング
    logger.error(`HTTP ${status} error: ${code}`, error instanceof Error ? error : undefined, {
      errorCode: code,
      errorMessage: error instanceof Error ? error.message : String(error),
      statusCode: status,
      requestIdentifier: requestId
    });

    // エラーレスポンスを返却
    return c.json(apiError, status);
  }
};