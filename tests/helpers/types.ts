import { Game } from "../../types/game.ts";
import { User } from "../../types/user.ts";

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
