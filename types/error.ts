// エラーの重要度を定義
export type ErrorSeverity = "INFO" | "WARN" | "ERROR" | "FATAL";

// エラーカテゴリを定義
export enum ErrorCategory {
  AUTH = "AUTH", // 認証関連
  VALIDATION = "VAL", // バリデーション関連
  RESOURCE = "RES", // リソース関連
  GAME = "GAME", // ゲームロジック関連
  CHAT = "CHAT", // チャット関連
  ACTION = "ACT", // アクション関連
  SYSTEM = "SYS", // システム関連
}

// エラーコードを列挙型として定義
export enum ErrorCode {
  // 認証関連
  INVALID_CREDENTIALS = "INVALID_CREDENTIALS",
  EMAIL_EXISTS = "EMAIL_EXISTS",
  TOKEN_EXPIRED = "TOKEN_EXPIRED",
  TOKEN_INVALID = "TOKEN_INVALID",
  UNAUTHORIZED = "UNAUTHORIZED",
  PERMISSION_DENIED = "PERMISSION_DENIED",
  // バリデーション関連
  VALIDATION_ERROR = "VALIDATION_ERROR",
  INVALID_REQUEST = "INVALID_REQUEST",
  // ゲーム関連
  GAME_NOT_FOUND = "GAME_NOT_FOUND",
  GAME_FULL = "GAME_FULL",
  GAME_ALREADY_STARTED = "GAME_ALREADY_STARTED",
  INVALID_PHASE = "INVALID_PHASE",
  NOT_WEREWOLF = "NOT_WEREWOLF",
  NOT_SEER = "NOT_SEER",
  NOT_BODYGUARD = "NOT_BODYGUARD",
  NOT_MEDIUM = "NOT_MEDIUM",
  NOT_GAME_OWNER = "NOT_GAME_OWNER",
  OWNER_NOT_FOUND = "OWNER_NOT_FOUND",
  JOIN_ERROR = "JOIN_ERROR",
  LEAVE_ERROR = "LEAVE_ERROR",
  START_ERROR = "START_ERROR",
  GAME_DELETED = "GAME_DELETED",
  GAME_NOT_IN_PROGRESS = "GAME_NOT_IN_PROGRESS",
  INVALID_GAME_PHASE = "INVALID_GAME_PHASE",
  NOT_ENOUGH_PLAYERS = "NOT_ENOUGH_PLAYERS",
  PLAYER_NOT_FOUND = "PLAYER_NOT_FOUND",
  PLAYER_DEAD = "PLAYER_DEAD",
  TARGET_REQUIRED = "TARGET_REQUIRED",
  INVALID_TARGET = "INVALID_TARGET",
  TARGET_NOT_FOUND = "TARGET_NOT_FOUND",
  TARGET_DEAD = "TARGET_DEAD",
  NO_ROLE_ASSIGNED = "NO_ROLE_ASSIGNED",
  INVALID_ROLE = "INVALID_ROLE",
  INVALID_ACTION = "INVALID_ACTION",
  INVALID_ACTION_TYPE = "INVALID_ACTION_TYPE",
  // チャット関連
  CHANNEL_ACCESS_DENIED = "CHANNEL_ACCESS_DENIED",
  INVALID_CHANNEL = "INVALID_CHANNEL",
  INVALID_MESSAGE = "INVALID_MESSAGE",
  PLAYER_NOT_IN_GAME = "PLAYER_NOT_IN_GAME",
  DEAD_PLAYER_CHAT = "DEAD_PLAYER_CHAT",
  PHASE_CHAT_RESTRICTED = "PHASE_CHAT_RESTRICTED",
  // アクション関連
  VOTE_ERROR = "VOTE_ERROR",
  ATTACK_ERROR = "ATTACK_ERROR",
  DIVINE_ERROR = "DIVINE_ERROR",
  GUARD_ERROR = "GUARD_ERROR",
  MEDIUM_ERROR = "MEDIUM_ERROR",
  // システムエラー
  INTERNAL_SERVER_ERROR = "INTERNAL_SERVER_ERROR",
  NOT_FOUND = "NOT_FOUND",
}

// エラーコードのカテゴリマッピング
export const errorCategoryMap: Record<ErrorCode, ErrorCategory> = {
  // 認証関連
  [ErrorCode.INVALID_CREDENTIALS]: ErrorCategory.AUTH,
  [ErrorCode.EMAIL_EXISTS]: ErrorCategory.AUTH,
  [ErrorCode.TOKEN_EXPIRED]: ErrorCategory.AUTH,
  [ErrorCode.TOKEN_INVALID]: ErrorCategory.AUTH,
  [ErrorCode.UNAUTHORIZED]: ErrorCategory.AUTH,
  [ErrorCode.PERMISSION_DENIED]: ErrorCategory.AUTH,

  // バリデーション関連
  [ErrorCode.VALIDATION_ERROR]: ErrorCategory.VALIDATION,
  [ErrorCode.INVALID_REQUEST]: ErrorCategory.VALIDATION,

  // ゲーム関連
  [ErrorCode.GAME_NOT_FOUND]: ErrorCategory.RESOURCE,
  [ErrorCode.GAME_FULL]: ErrorCategory.GAME,
  [ErrorCode.GAME_ALREADY_STARTED]: ErrorCategory.GAME,
  [ErrorCode.INVALID_PHASE]: ErrorCategory.GAME,
  [ErrorCode.NOT_WEREWOLF]: ErrorCategory.GAME,
  [ErrorCode.NOT_SEER]: ErrorCategory.GAME,
  [ErrorCode.NOT_BODYGUARD]: ErrorCategory.GAME,
  [ErrorCode.NOT_MEDIUM]: ErrorCategory.GAME,
  [ErrorCode.NOT_GAME_OWNER]: ErrorCategory.GAME,
  [ErrorCode.OWNER_NOT_FOUND]: ErrorCategory.GAME,
  [ErrorCode.JOIN_ERROR]: ErrorCategory.GAME,
  [ErrorCode.LEAVE_ERROR]: ErrorCategory.GAME,
  [ErrorCode.START_ERROR]: ErrorCategory.GAME,
  [ErrorCode.GAME_DELETED]: ErrorCategory.GAME,
  [ErrorCode.GAME_NOT_IN_PROGRESS]: ErrorCategory.GAME,
  [ErrorCode.INVALID_GAME_PHASE]: ErrorCategory.GAME,
  [ErrorCode.NOT_ENOUGH_PLAYERS]: ErrorCategory.GAME,
  [ErrorCode.PLAYER_NOT_FOUND]: ErrorCategory.GAME,
  [ErrorCode.PLAYER_DEAD]: ErrorCategory.GAME,
  [ErrorCode.TARGET_REQUIRED]: ErrorCategory.GAME,
  [ErrorCode.INVALID_TARGET]: ErrorCategory.GAME,
  [ErrorCode.TARGET_NOT_FOUND]: ErrorCategory.GAME,
  [ErrorCode.TARGET_DEAD]: ErrorCategory.GAME,
  [ErrorCode.NO_ROLE_ASSIGNED]: ErrorCategory.GAME,
  [ErrorCode.INVALID_ROLE]: ErrorCategory.GAME,
  [ErrorCode.INVALID_ACTION]: ErrorCategory.ACTION,
  [ErrorCode.INVALID_ACTION_TYPE]: ErrorCategory.ACTION,

  // チャット関連
  [ErrorCode.CHANNEL_ACCESS_DENIED]: ErrorCategory.CHAT,
  [ErrorCode.INVALID_CHANNEL]: ErrorCategory.CHAT,
  [ErrorCode.INVALID_MESSAGE]: ErrorCategory.CHAT,
  [ErrorCode.PLAYER_NOT_IN_GAME]: ErrorCategory.CHAT,
  [ErrorCode.DEAD_PLAYER_CHAT]: ErrorCategory.CHAT,
  [ErrorCode.PHASE_CHAT_RESTRICTED]: ErrorCategory.CHAT,

  // アクション関連
  [ErrorCode.VOTE_ERROR]: ErrorCategory.ACTION,
  [ErrorCode.ATTACK_ERROR]: ErrorCategory.ACTION,
  [ErrorCode.DIVINE_ERROR]: ErrorCategory.ACTION,
  [ErrorCode.GUARD_ERROR]: ErrorCategory.ACTION,
  [ErrorCode.MEDIUM_ERROR]: ErrorCategory.ACTION,

  // システムエラー
  [ErrorCode.INTERNAL_SERVER_ERROR]: ErrorCategory.SYSTEM,
  [ErrorCode.NOT_FOUND]: ErrorCategory.RESOURCE,
};

// デフォルトのエラー重要度マッピング
export const defaultErrorSeverityMap: Record<ErrorCode, ErrorSeverity> = {
  // 認証関連 - 基本的にWARN
  [ErrorCode.INVALID_CREDENTIALS]: "WARN",
  [ErrorCode.EMAIL_EXISTS]: "WARN",
  [ErrorCode.TOKEN_EXPIRED]: "WARN",
  [ErrorCode.TOKEN_INVALID]: "WARN",
  [ErrorCode.UNAUTHORIZED]: "WARN",
  [ErrorCode.PERMISSION_DENIED]: "WARN",

  // バリデーション関連 - 基本的にWARN
  [ErrorCode.VALIDATION_ERROR]: "WARN",
  [ErrorCode.INVALID_REQUEST]: "WARN",

  // ゲーム関連
  [ErrorCode.GAME_NOT_FOUND]: "WARN",
  [ErrorCode.GAME_FULL]: "WARN",
  [ErrorCode.GAME_ALREADY_STARTED]: "WARN",
  [ErrorCode.INVALID_PHASE]: "WARN",
  [ErrorCode.NOT_WEREWOLF]: "WARN",
  [ErrorCode.NOT_SEER]: "WARN",
  [ErrorCode.NOT_BODYGUARD]: "WARN",
  [ErrorCode.NOT_MEDIUM]: "WARN",
  [ErrorCode.NOT_GAME_OWNER]: "WARN",
  [ErrorCode.OWNER_NOT_FOUND]: "WARN",
  [ErrorCode.JOIN_ERROR]: "WARN",
  [ErrorCode.LEAVE_ERROR]: "WARN",
  [ErrorCode.START_ERROR]: "WARN",
  [ErrorCode.GAME_DELETED]: "WARN",
  [ErrorCode.GAME_NOT_IN_PROGRESS]: "WARN",
  [ErrorCode.INVALID_GAME_PHASE]: "WARN",
  [ErrorCode.NOT_ENOUGH_PLAYERS]: "WARN",
  [ErrorCode.PLAYER_NOT_FOUND]: "WARN",
  [ErrorCode.PLAYER_DEAD]: "WARN",
  [ErrorCode.TARGET_REQUIRED]: "WARN",
  [ErrorCode.INVALID_TARGET]: "WARN",
  [ErrorCode.TARGET_NOT_FOUND]: "WARN",
  [ErrorCode.TARGET_DEAD]: "WARN",
  [ErrorCode.NO_ROLE_ASSIGNED]: "WARN",
  [ErrorCode.INVALID_ROLE]: "WARN",
  [ErrorCode.INVALID_ACTION]: "WARN",
  [ErrorCode.INVALID_ACTION_TYPE]: "WARN",

  // チャット関連
  [ErrorCode.CHANNEL_ACCESS_DENIED]: "WARN",
  [ErrorCode.INVALID_CHANNEL]: "WARN",
  [ErrorCode.INVALID_MESSAGE]: "WARN",
  [ErrorCode.PLAYER_NOT_IN_GAME]: "WARN",
  [ErrorCode.DEAD_PLAYER_CHAT]: "WARN",
  [ErrorCode.PHASE_CHAT_RESTRICTED]: "WARN",

  // アクション関連
  [ErrorCode.VOTE_ERROR]: "WARN",
  [ErrorCode.ATTACK_ERROR]: "WARN",
  [ErrorCode.DIVINE_ERROR]: "WARN",
  [ErrorCode.GUARD_ERROR]: "WARN",
  [ErrorCode.MEDIUM_ERROR]: "WARN",

  // システムエラー
  [ErrorCode.INTERNAL_SERVER_ERROR]: "ERROR",
  [ErrorCode.NOT_FOUND]: "WARN",
};

// APIエラーレスポンスの基本構造
export interface APIError {
  code: ErrorCode;
  message: string;
  severity: ErrorSeverity;
  category: ErrorCategory;
  details?: Record<string, unknown>;
  timestamp: string;
  requestId?: string;
}

/**
 * 発生場所を特定しやすくするためのエラーコンテキスト情報
 */
export interface ErrorContext {
  operationName?: string; // 操作名（例: "ユーザー登録", "ゲーム開始"）
  userId?: string; // 関連するユーザーID
  gameId?: string; // 関連するゲームID
  requestPath?: string; // リクエストパス
  requestMethod?: string; // HTTPメソッド

  // ゲーム関連
  playerId?: string; // プレイヤーID
  targetPlayerId?: string; // 対象プレイヤーID
  currentPhase?: string; // 現在のゲームフェーズ
  phase?: string; // ゲームフェーズ (別名)

  // チャット関連
  channel?: string; // チャットチャンネル

  // エラー情報
  error?: string; // エラーメッセージ
  originalError?: string; // 元のエラーメッセージ
  errorMessage?: string; // エラーメッセージ（別形式）
  validationErrors?: Record<string, unknown>[]; // バリデーションエラーの詳細

  // その他
  email?: string; // ユーザーメールアドレス
  additionalData?: Record<string, unknown>; // その他のコンテキスト情報
}

// カスタムエラークラス
export class GameError extends Error {
  public readonly category: ErrorCategory;
  public readonly statusCode: number;

  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly severity: ErrorSeverity = defaultErrorSeverityMap[code] || "ERROR",
    public readonly context?: ErrorContext,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "GameError";
    this.category = errorCategoryMap[code] || ErrorCategory.SYSTEM;
    this.statusCode = this.getStatusCodeFromErrorCode(code);

    // スタックトレースの保持（Error.captureStackTrace の代わり）
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, GameError);
    }
  }

  // エラーコードからHTTPステータスコードを取得するメソッド
  private getStatusCodeFromErrorCode(code: ErrorCode): number {
    switch (code) {
      // 認証関連
      case ErrorCode.INVALID_CREDENTIALS:
      case ErrorCode.UNAUTHORIZED:
      case ErrorCode.TOKEN_EXPIRED:
      case ErrorCode.TOKEN_INVALID:
        return 401;

      // 権限関連
      case ErrorCode.PERMISSION_DENIED:
      case ErrorCode.CHANNEL_ACCESS_DENIED:
      case ErrorCode.DEAD_PLAYER_CHAT:
      case ErrorCode.PHASE_CHAT_RESTRICTED:
        return 403;

      // バリデーション関連
      case ErrorCode.VALIDATION_ERROR:
      case ErrorCode.INVALID_REQUEST:
      case ErrorCode.INVALID_CHANNEL:
      case ErrorCode.INVALID_MESSAGE:
        return 400;

      // リソース関連
      case ErrorCode.NOT_FOUND:
      case ErrorCode.GAME_NOT_FOUND:
        return 404;

      // 競合関連
      case ErrorCode.EMAIL_EXISTS:
      case ErrorCode.GAME_FULL:
      case ErrorCode.GAME_ALREADY_STARTED:
        return 409;

      // ゲーム関連
      case ErrorCode.INVALID_PHASE:
      case ErrorCode.NOT_WEREWOLF:
      case ErrorCode.NOT_SEER:
      case ErrorCode.NOT_BODYGUARD:
      case ErrorCode.NOT_MEDIUM:
      case ErrorCode.NOT_GAME_OWNER:
      case ErrorCode.OWNER_NOT_FOUND:
      case ErrorCode.JOIN_ERROR:
      case ErrorCode.LEAVE_ERROR:
      case ErrorCode.START_ERROR:
      case ErrorCode.GAME_DELETED:
      case ErrorCode.PLAYER_NOT_IN_GAME:
      case ErrorCode.VOTE_ERROR:
      case ErrorCode.ATTACK_ERROR:
      case ErrorCode.DIVINE_ERROR:
      case ErrorCode.GUARD_ERROR:
      case ErrorCode.MEDIUM_ERROR:
        return 400;

      // システムエラー
      case ErrorCode.INTERNAL_SERVER_ERROR:
      default:
        return 500;
    }
  }

  // APIエラーレスポンスに変換
  toAPIError(requestId?: string): APIError {
    return {
      code: this.code,
      message: this.message,
      severity: this.severity,
      category: this.category,
      details: {
        ...this.details,
        context: this.context,
      },
      timestamp: new Date().toISOString(),
      requestId,
    };
  }

  // 既存のエラーからGameErrorを作成するファクトリメソッド
  static fromError(
    error: unknown,
    defaultCode: ErrorCode = ErrorCode.INTERNAL_SERVER_ERROR,
    context?: ErrorContext,
  ): GameError {
    if (error instanceof GameError) {
      // 既にGameErrorの場合は、コンテキスト情報を追加して返す
      return new GameError(
        error.code,
        error.message,
        error.severity,
        { ...error.context, ...context },
        error.details,
      );
    }

    // エラーメッセージの取得
    const message = error instanceof Error ? error.message : String(error);

    // エラーメッセージに基づくコード判定
    let code = defaultCode;
    const severity: ErrorSeverity = defaultErrorSeverityMap[code] || "ERROR";

    // エラーメッセージのパターンマッチングによるエラーコード推測
    if (message.includes("このメールアドレスは既に登録") || message.includes("Email already exists")) {
      code = ErrorCode.EMAIL_EXISTS;
    } // バリデーションエラー
    else if (
      message.includes("リクエストデータが無効") || message.includes("validation") || message.includes("Invalid")
    ) {
      code = ErrorCode.VALIDATION_ERROR;
    } // 認証エラー
    else if (message.includes("無効なメール") || message.includes("パスワード") || message.includes("credentials")) {
      code = ErrorCode.INVALID_CREDENTIALS;
    } // リソース不存在エラー
    else if (message.includes("見つかりません") || message.includes("not found")) {
      code = ErrorCode.NOT_FOUND;
    }

    // スタックトレース情報の取得
    const stack = error instanceof Error ? error.stack : undefined;

    return new GameError(
      code,
      message,
      severity,
      context,
      stack ? { originalStack: stack } : undefined,
    );
  }
}
