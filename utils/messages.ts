// サポートする言語
export type SupportedLanguage = 'ja' | 'en';

// メッセージリソース
const messages: Record<SupportedLanguage, Record<string, string>> = {
  ja: {
    // 認証関連
    INVALID_CREDENTIALS: '無効なメールアドレスまたはパスワードです',
    EMAIL_EXISTS: 'このメールアドレスは既に登録されています',
    TOKEN_EXPIRED: '認証トークンの有効期限が切れています',
    TOKEN_INVALID: '無効な認証トークンです',
    UNAUTHORIZED: '認証が必要です',

    // バリデーション関連
    VALIDATION_ERROR: 'リクエストデータが無効です',
    INVALID_REQUEST: '不正なリクエストです',

    // ゲーム関連
    GAME_NOT_FOUND: '指定されたゲームが見つかりません',
    GAME_FULL: 'ゲームの参加人数が上限に達しています',
    GAME_ALREADY_STARTED: 'ゲームは既に開始されています',
    INVALID_PHASE: '現在のフェーズではその操作は実行できません',
    NOT_WEREWOLF: '人狼以外は襲撃できません',
    NOT_SEER: '占い師以外は占いができません',
    NOT_BODYGUARD: '狩人以外は護衛できません',
    NOT_GAME_OWNER: 'ゲームのオーナーではありません',

    // チャット関連
    CHANNEL_ACCESS_DENIED: 'このチャンネルにアクセスする権限がありません',
    INVALID_CHANNEL: '無効なチャンネルです',

    // アクション関連
    VOTE_ERROR: '投票中にエラーが発生しました',
    ATTACK_ERROR: '襲撃中にエラーが発生しました',
    DIVINE_ERROR: '占い中にエラーが発生しました',
    GUARD_ERROR: '護衛中にエラーが発生しました',

    // システムエラー
    INTERNAL_SERVER_ERROR: '内部サーバーエラーが発生しました',
  },
  en: {
    // Authentication
    INVALID_CREDENTIALS: 'Invalid email or password',
    EMAIL_EXISTS: 'This email address is already registered',
    TOKEN_EXPIRED: 'Authentication token has expired',
    TOKEN_INVALID: 'Invalid authentication token',
    UNAUTHORIZED: 'Authentication required',

    // Validation
    VALIDATION_ERROR: 'Invalid request data',
    INVALID_REQUEST: 'Invalid request',

    // Game
    GAME_NOT_FOUND: 'Specified game not found',
    GAME_FULL: 'Game has reached maximum number of players',
    GAME_ALREADY_STARTED: 'Game has already started',
    INVALID_PHASE: 'Action not allowed in current phase',
    NOT_WEREWOLF: 'Only werewolves can attack',
    NOT_SEER: 'Only seers can divine',
    NOT_BODYGUARD: 'Only bodyguards can guard',
    NOT_GAME_OWNER: 'Not the game owner',

    // Chat
    CHANNEL_ACCESS_DENIED: 'Access to this channel denied',
    INVALID_CHANNEL: 'Invalid channel',

    // Actions
    VOTE_ERROR: 'Error occurred during voting',
    ATTACK_ERROR: 'Error occurred during attack',
    DIVINE_ERROR: 'Error occurred during divination',
    GUARD_ERROR: 'Error occurred during guard action',

    // System Errors
    INTERNAL_SERVER_ERROR: 'Internal server error occurred',
  },
};

export function getMessage(code: string, lang: SupportedLanguage = 'ja'): string {
  return messages[lang][code] || messages[lang]['INTERNAL_SERVER_ERROR'];
}