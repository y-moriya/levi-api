import { Game } from "../../types/game.ts";
import { User } from "../../types/user.ts";
import { ChatChannel, ChatMessage } from "../../types/chat.ts";

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export type UserResponse = Omit<User, "password">;
export interface AuthResponse {
  token: string;
  expiresAt: string;
  user: UserResponse;
}

// アクションのレスポンス型
export interface ActionResponse {
  success: boolean;
  message: string;
}

export interface DivineActionResponse extends ActionResponse {
  isWerewolf: boolean;
  targetPlayerId: string;
  targetUsername: string;
}

export type GameResponse = Game;
export type GameListResponse = Game[];

// チャットメッセージのレスポンス型
export interface ChatMessageResponse {
  id: string;
  gameId: string;
  content: string;
  channel: ChatChannel;
  sender: {
    id: string;
    username: string;
  };
  recipientId?: string;
  createdAt: string;
}

// 拡張されたResponseインターフェース
export interface ExtendedResponse extends Response {
  data?: any;
}
