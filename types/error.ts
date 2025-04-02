// エラーの重要度を定義
export type ErrorSeverity = 'INFO' | 'WARN' | 'ERROR' | 'FATAL';

// エラーカテゴリを定義
export enum ErrorCategory {
  AUTH = 'AUTH',       // 認証関連
  VALIDATION = 'VAL',  // バリデーション関連
  RESOURCE = 'RES',    // リソース関連
  GAME = 'GAME',       // ゲームロジック関連
  CHAT = 'CHAT',       // チャット関連
  ACTION = 'ACT',      // アクション関連
  SYSTEM = 'SYS',      // システム関連
}

// 基本的なエラーコードの定義
export type ErrorCode =
  // 認証関連
  | 'INVALID_CREDENTIALS'
  | 'EMAIL_EXISTS'
  | 'TOKEN_EXPIRED'
  | 'TOKEN_INVALID'
  | 'UNAUTHORIZED'
  | 'PERMISSION_DENIED'
  
  // バリデーション関連
  | 'VALIDATION_ERROR'
  | 'INVALID_REQUEST'
  
  // ゲーム関連
  | 'GAME_NOT_FOUND'
  | 'GAME_FULL'
  | 'GAME_ALREADY_STARTED'
  | 'INVALID_PHASE'
  | 'NOT_WEREWOLF'
  | 'NOT_SEER'
  | 'NOT_BODYGUARD'
  | 'NOT_GAME_OWNER'
  | 'OWNER_NOT_FOUND'
  | 'JOIN_ERROR'
  | 'LEAVE_ERROR'
  | 'START_ERROR'
  | 'GAME_DELETED'
  
  // チャット関連
  | 'CHANNEL_ACCESS_DENIED'
  | 'INVALID_CHANNEL'
  | 'INVALID_MESSAGE'
  | 'PLAYER_NOT_IN_GAME'
  | 'DEAD_PLAYER_CHAT'
  | 'PHASE_CHAT_RESTRICTED'
  
  // アクション関連
  | 'VOTE_ERROR'
  | 'ATTACK_ERROR'
  | 'DIVINE_ERROR'
  | 'GUARD_ERROR'
  
  // システムエラー
  | 'INTERNAL_SERVER_ERROR'
  | 'NOT_FOUND';

// エラーコードのカテゴリマッピング
export const errorCategoryMap: Record<ErrorCode, ErrorCategory> = {
  // 認証関連
  INVALID_CREDENTIALS: ErrorCategory.AUTH,
  EMAIL_EXISTS: ErrorCategory.AUTH,
  TOKEN_EXPIRED: ErrorCategory.AUTH,
  TOKEN_INVALID: ErrorCategory.AUTH,
  UNAUTHORIZED: ErrorCategory.AUTH,
  PERMISSION_DENIED: ErrorCategory.AUTH,
  
  // バリデーション関連
  VALIDATION_ERROR: ErrorCategory.VALIDATION,
  INVALID_REQUEST: ErrorCategory.VALIDATION,
  
  // ゲーム関連
  GAME_NOT_FOUND: ErrorCategory.RESOURCE,
  GAME_FULL: ErrorCategory.GAME,
  GAME_ALREADY_STARTED: ErrorCategory.GAME,
  INVALID_PHASE: ErrorCategory.GAME,
  NOT_WEREWOLF: ErrorCategory.GAME,
  NOT_SEER: ErrorCategory.GAME,
  NOT_BODYGUARD: ErrorCategory.GAME,
  NOT_GAME_OWNER: ErrorCategory.GAME,
  OWNER_NOT_FOUND: ErrorCategory.GAME,
  JOIN_ERROR: ErrorCategory.GAME,
  LEAVE_ERROR: ErrorCategory.GAME,
  START_ERROR: ErrorCategory.GAME,
  GAME_DELETED: ErrorCategory.GAME,
  
  // チャット関連
  CHANNEL_ACCESS_DENIED: ErrorCategory.CHAT,
  INVALID_CHANNEL: ErrorCategory.CHAT,
  INVALID_MESSAGE: ErrorCategory.CHAT,
  PLAYER_NOT_IN_GAME: ErrorCategory.CHAT,
  DEAD_PLAYER_CHAT: ErrorCategory.CHAT,
  PHASE_CHAT_RESTRICTED: ErrorCategory.CHAT,
  
  // アクション関連
  VOTE_ERROR: ErrorCategory.ACTION,
  ATTACK_ERROR: ErrorCategory.ACTION,
  DIVINE_ERROR: ErrorCategory.ACTION,
  GUARD_ERROR: ErrorCategory.ACTION,
  
  // システムエラー
  INTERNAL_SERVER_ERROR: ErrorCategory.SYSTEM,
  NOT_FOUND: ErrorCategory.RESOURCE,
};

// デフォルトのエラー重要度マッピング
export const defaultErrorSeverityMap: Record<ErrorCode, ErrorSeverity> = {
  // 認証関連 - 基本的にWARN
  INVALID_CREDENTIALS: 'WARN',
  EMAIL_EXISTS: 'WARN',
  TOKEN_EXPIRED: 'WARN',
  TOKEN_INVALID: 'WARN',
  UNAUTHORIZED: 'WARN',
  PERMISSION_DENIED: 'WARN',
  
  // バリデーション関連 - 基本的にWARN
  VALIDATION_ERROR: 'WARN',
  INVALID_REQUEST: 'WARN',
  
  // ゲーム関連
  GAME_NOT_FOUND: 'WARN',
  GAME_FULL: 'WARN',
  GAME_ALREADY_STARTED: 'WARN',
  INVALID_PHASE: 'WARN',
  NOT_WEREWOLF: 'WARN',
  NOT_SEER: 'WARN',
  NOT_BODYGUARD: 'WARN',
  NOT_GAME_OWNER: 'WARN',
  OWNER_NOT_FOUND: 'WARN',
  JOIN_ERROR: 'WARN',
  LEAVE_ERROR: 'WARN',
  START_ERROR: 'WARN',
  GAME_DELETED: 'WARN',
  
  // チャット関連
  CHANNEL_ACCESS_DENIED: 'WARN',
  INVALID_CHANNEL: 'WARN',
  INVALID_MESSAGE: 'WARN',
  PLAYER_NOT_IN_GAME: 'WARN',
  DEAD_PLAYER_CHAT: 'WARN',
  PHASE_CHAT_RESTRICTED: 'WARN',
  
  // アクション関連
  VOTE_ERROR: 'WARN',
  ATTACK_ERROR: 'WARN',
  DIVINE_ERROR: 'WARN',
  GUARD_ERROR: 'WARN',
  
  // システムエラー
  INTERNAL_SERVER_ERROR: 'ERROR',
  NOT_FOUND: 'WARN',
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
  operationName?: string;  // 操作名（例: "ユーザー登録", "ゲーム開始"）
  userId?: string;         // 関連するユーザーID
  gameId?: string;         // 関連するゲームID
  requestPath?: string;    // リクエストパス
  requestMethod?: string;  // HTTPメソッド
  
  // ゲーム関連
  playerId?: string;       // プレイヤーID
  targetPlayerId?: string; // 対象プレイヤーID
  currentPhase?: string;   // 現在のゲームフェーズ
  
  // チャット関連
  channel?: string;        // チャットチャンネル
  
  // エラー情報
  error?: string;          // エラーメッセージ
  originalError?: string;  // 元のエラーメッセージ
  errorMessage?: string;   // エラーメッセージ（別形式）
  validationErrors?: Record<string, unknown>[]; // バリデーションエラーの詳細
  
  // その他
  email?: string;          // ユーザーメールアドレス
  additionalData?: Record<string, unknown>; // その他のコンテキスト情報
}

// カスタムエラークラス
export class GameError extends Error {
  public readonly category: ErrorCategory;
  public readonly statusCode: number;
  
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly severity: ErrorSeverity = defaultErrorSeverityMap[code] || 'ERROR',
    public readonly context?: ErrorContext,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'GameError';
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
      case 'INVALID_CREDENTIALS':
      case 'UNAUTHORIZED':
      case 'TOKEN_EXPIRED':
      case 'TOKEN_INVALID':
        return 401;
      
      // 権限関連
      case 'PERMISSION_DENIED':
        return 403;
      
      // バリデーション関連
      case 'VALIDATION_ERROR':
      case 'INVALID_REQUEST':
        return 400;
      
      // リソース関連
      case 'NOT_FOUND':
      case 'GAME_NOT_FOUND':
        return 404;
      
      // 競合関連
      case 'EMAIL_EXISTS':
      case 'GAME_FULL':
      case 'GAME_ALREADY_STARTED':
        return 409;
      
      // ゲーム関連
      case 'INVALID_PHASE':
      case 'NOT_WEREWOLF':
      case 'NOT_SEER':
      case 'NOT_BODYGUARD':
      case 'NOT_GAME_OWNER':
      case 'OWNER_NOT_FOUND':
      case 'JOIN_ERROR':
      case 'LEAVE_ERROR':
      case 'START_ERROR':
      case 'GAME_DELETED':
      case 'CHANNEL_ACCESS_DENIED':
      case 'INVALID_CHANNEL':
      case 'VOTE_ERROR':
      case 'ATTACK_ERROR':
      case 'DIVINE_ERROR':
      case 'GUARD_ERROR':
        return 400;
      
      // システムエラー
      case 'INTERNAL_SERVER_ERROR':
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
        context: this.context
      },
      timestamp: new Date().toISOString(),
      requestId
    };
  }

  // 既存のエラーからGameErrorを作成するファクトリメソッド
  static fromError(
    error: unknown,
    defaultCode: ErrorCode = 'INTERNAL_SERVER_ERROR',
    context?: ErrorContext
  ): GameError {
    if (error instanceof GameError) {
      // 既にGameErrorの場合は、コンテキスト情報を追加して返す
      return new GameError(
        error.code,
        error.message,
        error.severity,
        { ...error.context, ...context },
        error.details
      );
    }
    
    // エラーメッセージの取得
    const message = error instanceof Error ? error.message : String(error);
    
    // エラーメッセージに基づくコード判定
    let code = defaultCode;
    const severity: ErrorSeverity = defaultErrorSeverityMap[code] || 'ERROR';
    
    // エラーメッセージのパターンマッチングによるエラーコード推測
    if (message.includes("このメールアドレスは既に登録") || message.includes("Email already exists")) {
      code = "EMAIL_EXISTS";
    } 
    // バリデーションエラー
    else if (message.includes("リクエストデータが無効") || message.includes("validation") || message.includes("Invalid")) {
      code = "VALIDATION_ERROR";
    }
    // 認証エラー
    else if (message.includes("無効なメール") || message.includes("パスワード") || message.includes("credentials")) {
      code = "INVALID_CREDENTIALS";
    }
    // リソース不存在エラー
    else if (message.includes("見つかりません") || message.includes("not found")) {
      code = "NOT_FOUND";
    }
    
    // スタックトレース情報の取得
    const stack = error instanceof Error ? error.stack : undefined;
    
    return new GameError(
      code,
      message,
      severity,
      context,
      stack ? { originalStack: stack } : undefined
    );
  }
}