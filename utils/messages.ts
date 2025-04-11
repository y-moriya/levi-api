import { Game, GamePhase, GamePlayer, Role } from "../types/game.ts";

// サポートする言語
export type SupportedLanguage = "ja" | "en";

// メッセージリソース
const messages: Record<SupportedLanguage, Record<string, string>> = {
  ja: {
    // 認証関連
    INVALID_CREDENTIALS: "無効なメールアドレスまたはパスワードです",
    EMAIL_EXISTS: "このメールアドレスは既に登録されています",
    TOKEN_EXPIRED: "認証トークンの有効期限が切れています",
    TOKEN_INVALID: "無効な認証トークンです",
    UNAUTHORIZED: "認証が必要です",

    // バリデーション関連
    VALIDATION_ERROR: "リクエストデータが無効です",
    INVALID_REQUEST: "不正なリクエストです",

    // ゲーム関連
    GAME_NOT_FOUND: "指定されたゲームが見つかりません",
    GAME_FULL: "ゲームの参加人数が上限に達しています",
    GAME_ALREADY_STARTED: "ゲームは既に開始されています",
    INVALID_PHASE: "現在のフェーズではその操作は実行できません",
    NOT_WEREWOLF: "人狼以外は襲撃できません",
    NOT_SEER: "占い師以外は占いができません",
    NOT_BODYGUARD: "狩人以外は護衛できません",
    NOT_GAME_OWNER: "ゲームのオーナーではありません",

    // チャット関連
    CHANNEL_ACCESS_DENIED: "このチャンネルにアクセスする権限がありません",
    INVALID_CHANNEL: "無効なチャンネルです",

    // アクション関連
    VOTE_ERROR: "投票中にエラーが発生しました",
    ATTACK_ERROR: "襲撃中にエラーが発生しました",
    DIVINE_ERROR: "占い中にエラーが発生しました",
    GUARD_ERROR: "護衛中にエラーが発生しました",

    // システムエラー
    INTERNAL_SERVER_ERROR: "内部サーバーエラーが発生しました",
  },
  en: {
    // Authentication
    INVALID_CREDENTIALS: "Invalid email or password",
    EMAIL_EXISTS: "This email address is already registered",
    TOKEN_EXPIRED: "Authentication token has expired",
    TOKEN_INVALID: "Invalid authentication token",
    UNAUTHORIZED: "Authentication required",

    // Validation
    VALIDATION_ERROR: "Invalid request data",
    INVALID_REQUEST: "Invalid request",

    // Game
    GAME_NOT_FOUND: "Specified game not found",
    GAME_FULL: "Game has reached maximum number of players",
    GAME_ALREADY_STARTED: "Game has already started",
    INVALID_PHASE: "Action not allowed in current phase",
    NOT_WEREWOLF: "Only werewolves can attack",
    NOT_SEER: "Only seers can divine",
    NOT_BODYGUARD: "Only bodyguards can guard",
    NOT_GAME_OWNER: "Not the game owner",

    // Chat
    CHANNEL_ACCESS_DENIED: "Access to this channel denied",
    INVALID_CHANNEL: "Invalid channel",

    // Actions
    VOTE_ERROR: "Error occurred during voting",
    ATTACK_ERROR: "Error occurred during attack",
    DIVINE_ERROR: "Error occurred during divination",
    GUARD_ERROR: "Error occurred during guard action",

    // System Errors
    INTERNAL_SERVER_ERROR: "Internal server error occurred",
  },
};

export function getMessage(code: string, lang: SupportedLanguage = "ja"): string {
  return messages[lang][code] || messages[lang]["INTERNAL_SERVER_ERROR"];
}

// ゲームフェーズ終了時のメッセージを生成
export function generatePhaseEndMessage(
  game: Game,
  phase: GamePhase,
  day: number,
  executedPlayer?: GamePlayer,
  attackedPlayer?: GamePlayer,
): string {
  switch (phase) {
    case "DAY_DISCUSSION":
      return `${day}日目の議論が終了しました。投票に移ります。`;
    case "DAY_VOTE":
      if (executedPlayer) {
        return `${day}日目の投票の結果、${executedPlayer.username}さんが処刑されました。${executedPlayer.username}さんは${getRoleNameJa(executedPlayer.role || "VILLAGER")}でした。`;
      }
      return `${day}日目の投票の結果、誰も処刑されませんでした。`;
    case "NIGHT":
      if (attackedPlayer) {
        return `${day}日目の夜が明けました。${attackedPlayer.username}さんが人狼に襲撃されました。`;
      }
      return `${day}日目の夜が明けました。人狼の襲撃はありませんでした。`;
    case "GAME_OVER":
      if (game.winner === "VILLAGERS") {
        return "村人陣営が勝利しました！すべての人狼が排除されました。";
      } else if (game.winner === "WEREWOLVES") {
        return "人狼陣営が勝利しました！村人の数が人狼以下になりました。";
      }
      return "ゲームが終了しました。";
    default:
      return "フェーズが終了しました。";
  }
}

// プレイヤーの役職に関するメッセージを生成
export function generatePlayerRoleMessages(players: GamePlayer[]): Map<string, string> {
  const messages = new Map<string, string>();
  
  for (const player of players) {
    if (!player.role) continue;
    
    let message = `あなたは${getRoleNameJa(player.role)}です。`;
    
    switch (player.role) {
      case "VILLAGER":
        message += "村人の勝利条件は「すべての人狼を処刑すること」です。昼間の会議で怪しいプレイヤーを見つけ出し、投票で処刑しましょう。";
        break;
      case "WEREWOLF":
        message += "人狼の勝利条件は「村人の人数を人狼以下にすること」です。夜間に村人を襲撃して数を減らしましょう。昼間は村人のふりをして、疑いをかわしましょう。";
        break;
      case "SEER":
        message += "占い師は夜間に一人のプレイヤーが人狼かどうかを占うことができます。この情報を効果的に活用して村人陣営の勝利に貢献しましょう。";
        break;
      case "BODYGUARD":
        message += "狩人は夜間に一人のプレイヤーを人狼の襲撃から守ることができます。重要な役職を護衛して村人陣営の勝利に貢献しましょう。";
        break;
      case "MEDIUM":
        message += "霊能者は処刑されたプレイヤーが人狼かどうかを知ることができます。この情報を効果的に活用して村人陣営の勝利に貢献しましょう。";
        break;
    }
    
    messages.set(player.playerId, message);
  }
  
  return messages;
}

// 役職名の日本語表示
function getRoleNameJa(role: Role): string {
  switch (role) {
    case "VILLAGER": return "村人";
    case "WEREWOLF": return "人狼";
    case "SEER": return "占い師";
    case "BODYGUARD": return "狩人";
    case "MEDIUM": return "霊能者";
    default: return "不明な役職";
  }
}
