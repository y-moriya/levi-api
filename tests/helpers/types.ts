import { Game } from '../../types/game.ts';
import { User } from '../../types/user.ts';

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export type UserResponse = Omit<User, 'password'>;
export interface AuthResponse {
  token: string;
  expiresAt: string;
  user: UserResponse;
}

export type GameResponse = Game;
export type GameListResponse = Game[];