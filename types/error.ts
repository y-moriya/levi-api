// エラーの重要度を定義
export type ErrorSeverity = 'INFO' | 'WARN' | 'ERROR' | 'FATAL';

// 基本的なエラーコードの定義
export type ErrorCode =
  // 認証関連
  | 'INVALID_CREDENTIALS'
  | 'EMAIL_EXISTS'
  | 'TOKEN_EXPIRED'
  | 'TOKEN_INVALID'
  | 'UNAUTHORIZED'
  
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
  
  // アクション関連
  | 'VOTE_ERROR'
  | 'ATTACK_ERROR'
  | 'DIVINE_ERROR'
  | 'GUARD_ERROR'
  
  // システムエラー
  | 'INTERNAL_SERVER_ERROR'
  | 'NOT_FOUND';

// APIエラーレスポンスの基本構造
export interface APIError {
  code: ErrorCode;
  message: string;
  severity: ErrorSeverity;
  details?: Record<string, unknown>;
  timestamp: string;
  requestId?: string;
}

// カスタムエラークラス
export class GameError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public severity: ErrorSeverity = 'ERROR',
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'GameError';
  }

  // APIエラーレスポンスに変換
  toAPIError(requestId?: string): APIError {
    return {
      code: this.code,
      message: this.message,
      severity: this.severity,
      details: this.details,
      timestamp: new Date().toISOString(),
      requestId
    };
  }
}