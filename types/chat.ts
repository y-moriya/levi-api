import { Role } from "./game.ts";

// チャネル名の互換性確保のために旧名称も許容する
// PUBLIC ~ GLOBAL, DEAD ~ SPIRIT, GENERAL は PUBLIC の同義として扱う
export type ChatChannel =
  | "PUBLIC"
  | "WEREWOLF"
  | "SEER"
  | "BODYGUARD"
  | "MEDIUM"
  | "DEAD"
  | "PRIVATE"
  // 旧テスト互換用の別名（サービス層で正規化して保存）
  | "GLOBAL"
  | "GENERAL"
  | "SPIRIT";

export interface ChatMessage {
  id: string;
  gameId: string;
  channel: ChatChannel;
  senderId: string;
  senderUsername: string;
  senderRole?: Role;
  content: string;
  recipientId?: string; // プライベートメッセージの場合に使用
  createdAt: string; // 作成日時（DBではtimestamp列にマッピングされる場合あり）
}

export interface SendMessageRequest {
  channel: ChatChannel;
  content: string;
  recipientId?: string; // プライベートメッセージの場合に使用
}

export interface GetMessagesResponse {
  messages: ChatMessage[];
}

export interface ChatError {
  code: string;
  message: string;
}
