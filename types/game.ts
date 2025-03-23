import { User } from './user.ts';

export interface GameCreation {
  name: string;
  maxPlayers: number;
  password?: string;
  settings?: GameSettings;
}

export interface Game {
  id: string;
  name: string;
  owner: Omit<User, 'password'>;
  hasPassword: boolean;
  maxPlayers: number;
  currentPlayers: number;
  status: GameStatus;
  players: GamePlayer[];
  createdAt: string;
  settings: GameSettings;
  currentPhase: GamePhase | null;
  currentDay: number;
  phaseEndTime: string | null;
  winner: Winner;
  gameEvents: GameEvent[];
}

export type GameStatus = 'WAITING' | 'IN_PROGRESS' | 'FINISHED';
export type GamePhase = 'DAY_DISCUSSION' | 'DAY_VOTE' | 'NIGHT' | 'GAME_OVER';
export type Winner = 'VILLAGERS' | 'WEREWOLVES' | 'NONE';
export type Role = 'VILLAGER' | 'WEREWOLF' | 'SEER' | 'BODYGUARD' | 'MEDIUM';
export type DeathCause = 'WEREWOLF_ATTACK' | 'EXECUTION' | 'NONE';

export interface GamePlayer {
  playerId: string;
  username: string;
  role?: Role;
  isAlive: boolean;
  deathDay?: number;
  deathCause: DeathCause;
}

export interface GameSettings {
  dayTimeSeconds: number;
  nightTimeSeconds: number;
  voteTimeSeconds: number;
  roles: RoleSettings;
}

export interface RoleSettings {
  werewolfCount: number;
  seerCount: number;
  bodyguardCount: number;
  mediumCount: number;
}

export interface GameEvent {
  id: string;
  day: number;
  phase: GamePhase;
  type: 'PHASE_CHANGE' | 'GAME_END';
  description: string;
  timestamp: string;
}