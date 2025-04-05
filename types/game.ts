import { User } from "./user.ts";

export interface GameCreation {
  name: string;
  maxPlayers: number;
  password?: string;
  settings?: GameSettings;
}

export interface Game {
  id: string;
  name: string;
  owner: Omit<User, "password">;
  hasPassword: boolean;
  maxPlayers: number;
  currentPlayers: number;
  status: GameStatus;
  players: GamePlayer[];
  createdAt: string;
  settings: GameSettings;
  currentPhase: GamePhase;
  currentDay: number;
  phaseEndTime: string | null;
  winner: Winner;
  gameEvents: GameEvent[];
  [key: `vote_${number}`]: Map<string, string>;
  [key: `attack_${number}`]: Map<string, string>;
  [key: `divine_${number}`]: Map<string, string>;
  [key: `guard_${number}`]: Map<string, string>;
  [key: `medium_${number}`]: Map<string, string>;
}

export type GameStatus = "WAITING" | "IN_PROGRESS" | "FINISHED";
export type GamePhase = "DAY_DISCUSSION" | "DAY_VOTE" | "NIGHT" | "GAME_OVER";
export type Winner = "VILLAGERS" | "WEREWOLVES" | "NONE";
export type Role = "VILLAGER" | "WEREWOLF" | "SEER" | "BODYGUARD" | "MEDIUM";
export type DeathCause = "WEREWOLF_ATTACK" | "EXECUTION" | "NONE";

// アクションの種類
export type ActionType = "VOTE" | "ATTACK" | "DIVINE" | "GUARD" | "MEDIUM";

// ベースアクション
export interface GameAction {
  gameId: string;
  playerId: string;
  targetId: string;
  type: ActionType;
  day: number;
  phase: GamePhase;
  timestamp: string;
}

// 投票アクション
export interface VoteAction extends GameAction {
  type: "VOTE";
}

// 襲撃アクション
export interface AttackAction extends GameAction {
  type: "ATTACK";
}

// 占いアクション
export interface DivineAction extends GameAction {
  type: "DIVINE";
}

// 護衛アクション
export interface GuardAction extends GameAction {
  type: "GUARD";
}

// 霊能アクション
export interface MediumAction extends GameAction {
  type: "MEDIUM";
}

// アクション結果のベース
export interface ActionResult {
  success: boolean;
  message: string;
}

export interface DivineResult extends ActionResult {
  targetPlayerId: string;
  targetUsername: string;
  isWerewolf: boolean;
}

export interface MediumResult extends ActionResult {
  targetPlayerId: string;
  targetUsername: string;
  isWerewolf: boolean;
}

// フェーズごとのアクション状態
export interface PhaseActions {
  votes: Map<string, string>; // playerId -> targetId
  attacks: Map<string, string>;
  divinations: Map<string, string>;
  guards: Map<string, string>;
  mediums: Map<string, string>; // 霊能者のアクション
}

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
  type: "PHASE_CHANGE" | "GAME_END" | "PLAYER_DEATH";
  description: string;
  timestamp: string;
}
