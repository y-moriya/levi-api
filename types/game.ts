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
  updatedAt: string; // 更新日時を追加
  creatorId: string; // 作成者IDを追加
  settings: GameSettings;
  currentPhase: GamePhase;
  currentDay: number;
  phaseEndTime: string | null;
  winner: Winner;
  gameEvents: GameEvent[];
  endTime?: string; // ゲーム終了時間を追加
  actions: GameAction[] & { [key: string]: Map<string, string> }; // 両方の形式をサポート
  revealedRoles?: RevealedRole[]; // 公開された役職情報を追加
  gameActions?: GameAction[]; // 互換性のために残す
  [key: string]: any; // インデックスシグネチャを追加して動的アクセスを可能にする
}

export type GameStatus = "WAITING" | "IN_PROGRESS" | "FINISHED";
// DAY_VOTEとVOTINGは同じフェーズを表す（テスト互換性のため両方をサポート）
export type GamePhase = "WAITING" | "DAY_DISCUSSION" | "DAY_VOTE" | "VOTING" | "NIGHT" | "GAME_OVER";
export type Winner = "VILLAGERS" | "WEREWOLVES" | "NONE";
export type Role = "VILLAGER" | "WEREWOLF" | "SEER" | "BODYGUARD" | "MEDIUM";
export type DeathCause = "WEREWOLF_ATTACK" | "EXECUTION" | "NONE";

// アクションの種類
export type ActionType =
  | "VOTE"
  | "ATTACK"
  | "DIVINE"
  | "GUARD"
  | "MEDIUM"
  | "CHAT"
  | "WEREWOLF_ATTACK"
  | "DIVINATION"
  | "PROTECT";

// ベースアクション
export interface GameAction {
  id: string;
  gameId: string;
  playerId: string;
  targetId: string;
  type: ActionType;
  day?: number;
  phase?: GamePhase;
  timestamp?: string;
  createdAt?: Date;
  voteType?: VoteType;
  // PostgreSQL用に追加
  actorId?: string;
  result?: any;
}

// 投票アクション
export interface VoteAction extends GameAction {
  type: "VOTE";
  voteType?: "EXECUTION"; // 投票タイプを追加
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
  deathCause?: DeathCause; // オプショナルに変更
  joinedAt?: string; // 参加日時を追加
  executionDay?: number; // 処刑日を追加
}

export interface GameSettings {
  dayTimeSeconds: number;
  nightTimeSeconds: number;
  voteTimeSeconds: number;
  roles: RoleSettings;
  phaseTimes?: { [phase: string]: number }; // フェーズごとの時間設定を追加
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
  actorId?: string; // 実行者IDを追加
  targetId?: string; // 対象IDを追加
  result?: any; // 結果を追加
}

// 公開された役職情報
export interface RevealedRole {
  playerId: string;
  role: Role;
  revealDay: number;
  revealType: "EXECUTION" | "NIGHT_ACTION" | "GAME_END";
}

// 型チェックでエラーとなっている参照用のエクスポート
export const Action = {};
export type GameActionType = ActionType;
export type PlayerRole = Role;
export type VoteType = "EXECUTION" | "NORMAL";
