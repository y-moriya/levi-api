import { Game, GamePlayer, GameAction } from "../../types/game.ts";
import { User } from "../../types/user.ts";
import { ChatMessage } from "../../types/chat.ts";

/**
 * モックユーザーを作成する
 * @param overrides オーバーライドするプロパティ
 */
export function createMockUser(overrides: Partial<User> = {}): User {
  return {
    id: `user_${Date.now()}`,
    username: "mockUser",
    email: "mock@example.com",
    password: "hashedPassword123",
    createdAt: new Date().toISOString(),
    stats: {
      gamesPlayed: 0,
      gamesWon: 0,
      winRatio: 0,
      villagerWins: 0,
      werewolfWins: 0,
    },
    ...overrides,
  };
}

/**
 * モックプレイヤーを作成する
 * @param overrides オーバーライドするプロパティ
 */
export function createMockGamePlayer(overrides: Partial<GamePlayer> = {}): GamePlayer {
  return {
    playerId: `player_${Date.now()}`,
    username: "mockPlayer",
    isAlive: true,
    role: "VILLAGER",
    deathCause: "NONE",
    ...overrides,
  };
}

/**
 * 複数のモックプレイヤーを作成する
 * @param count 作成するプレイヤー数
 * @param baseOverrides 全プレイヤーに適用するオーバーライド
 */
export function createMockGamePlayers(
  count: number,
  baseOverrides: Partial<GamePlayer> = {},
): GamePlayer[] {
  return Array.from({ length: count }, (_, i) =>
    createMockGamePlayer({
      playerId: `player_${i}`,
      username: `mockPlayer${i}`,
      ...baseOverrides,
    }));
}

/**
 * モックゲームを作成する
 * @param overrides オーバーライドするプロパティ
 */
export function createMockGame(overrides: Partial<Game> = {}): Game {
  // デフォルトで5人のプレイヤーを持つゲームを作成
  const playerCount = overrides.players?.length ?? 5;
  const players = overrides.players ?? createMockGamePlayers(playerCount);
  const mockUser = createMockUser();

  // GameAction[]と{[key: string]: Map<string, string>}を満たす合成型を生成
  const emptyActions = [] as unknown as GameAction[] & { [key: string]: Map<string, string> };
  // 各アクションタイプに対応するMapを追加
  emptyActions.votes = new Map<string, string>();
  emptyActions.attacks = new Map<string, string>();
  emptyActions.divinations = new Map<string, string>();
  emptyActions.guards = new Map<string, string>();
  emptyActions.mediums = new Map<string, string>();

  return {
    id: `game_${Date.now()}`,
    name: "モックゲーム",
    owner: {
      id: mockUser.id,
      username: mockUser.username,
      email: mockUser.email,
      createdAt: mockUser.createdAt,
      stats: mockUser.stats,
    },
    hasPassword: false,
    players,
    maxPlayers: playerCount,
    currentPlayers: players.length,
    status: "WAITING",
    currentDay: 0,
    currentPhase: "DAY_DISCUSSION",
    phaseEndTime: null,
    winner: "NONE",
    gameEvents: [],
    settings: {
      roles: {
        werewolfCount: 1,
        seerCount: 1,
        bodyguardCount: 1,
        mediumCount: 0,
      },
      dayTimeSeconds: 60,
      nightTimeSeconds: 40,
      voteTimeSeconds: 30,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    creatorId: mockUser.id,
    actions: emptyActions,
    ...overrides,
  };
}

/**
 * 特定の役職分布を持つモックゲームを作成する
 * @param roleCounts 各役職の数
 */
export function createMockGameWithRoles(
  roleCounts: {
    werewolf: number;
    seer: number;
    bodyguard: number;
    medium: number;
    villager: number;
  },
): Game {
  const totalPlayers = Object.values(roleCounts).reduce((sum, count) => sum + count, 0);

  // プレイヤーの配列を作成
  const players: GamePlayer[] = [];
  let playerIndex = 0;

  // 人狼を追加
  for (let i = 0; i < roleCounts.werewolf; i++, playerIndex++) {
    players.push(createMockGamePlayer({
      playerId: `player_${playerIndex}`,
      username: `werewolf${i}`,
      role: "WEREWOLF",
    }));
  }

  // 占い師を追加
  for (let i = 0; i < roleCounts.seer; i++, playerIndex++) {
    players.push(createMockGamePlayer({
      playerId: `player_${playerIndex}`,
      username: `seer${i}`,
      role: "SEER",
    }));
  }

  // 狩人を追加
  for (let i = 0; i < roleCounts.bodyguard; i++, playerIndex++) {
    players.push(createMockGamePlayer({
      playerId: `player_${playerIndex}`,
      username: `bodyguard${i}`,
      role: "BODYGUARD",
    }));
  }

  // 霊媒師を追加
  for (let i = 0; i < roleCounts.medium; i++, playerIndex++) {
    players.push(createMockGamePlayer({
      playerId: `player_${playerIndex}`,
      username: `medium${i}`,
      role: "MEDIUM",
    }));
  }

  // 村人を追加
  for (let i = 0; i < roleCounts.villager; i++, playerIndex++) {
    players.push(createMockGamePlayer({
      playerId: `player_${playerIndex}`,
      username: `villager${i}`,
      role: "VILLAGER",
    }));
  }

  return createMockGame({
    players,
    maxPlayers: totalPlayers,
    settings: {
      roles: {
        werewolfCount: roleCounts.werewolf,
        seerCount: roleCounts.seer,
        bodyguardCount: roleCounts.bodyguard,
        mediumCount: roleCounts.medium,
      },
      dayTimeSeconds: 60,
      nightTimeSeconds: 40,
      voteTimeSeconds: 30,
    },
  });
}

/**
 * モックチャットメッセージを作成する
 * @param overrides オーバーライドするプロパティ
 */
export function createMockChatMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: `msg_${Date.now()}`,
    gameId: `game_${Date.now()}`,
    senderId: `user_${Date.now()}`,
    senderUsername: "モックユーザー",
    content: "テストメッセージ",
  channel: "PUBLIC",
  createdAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * モックタイマーを作成する
 * タイマー関数を実際に待機せずにすぐに実行するためのモック
 */
export class MockTimer {
  private callbacks: Map<number, { callback: () => void; timeout: number }> = new Map();
  private currentId = 1;
  private currentTime = 0;

  // setTimeout の代替
  setTimeout(callback: () => void, timeout: number): number {
    const id = this.currentId++;
    this.callbacks.set(id, { callback, timeout });
    return id;
  }

  // clearTimeout の代替
  clearTimeout(id: number): void {
    this.callbacks.delete(id);
  }

  // 指定した時間分、時間を進める
  advanceTime(ms: number): void {
    this.currentTime += ms;

    // タイムアウトが発生したコールバックを実行
    for (const [id, { callback, timeout }] of this.callbacks.entries()) {
      if (timeout <= this.currentTime) {
        callback();
        this.callbacks.delete(id);
      }
    }
  }

  // 全てのタイマーをクリア
  reset(): void {
    this.callbacks.clear();
    this.currentTime = 0;
    this.currentId = 1;
  }
}

/**
 * モックロガーを作成する
 * テスト中のログ出力を抑制または記録するためのモック
 */
export class MockLogger {
  logs: Array<{ level: string; message: string; data?: unknown }> = [];

  debug(message: string, data?: unknown): void {
    this.logs.push({ level: "debug", message, data });
  }

  info(message: string, data?: unknown): void {
    this.logs.push({ level: "info", message, data });
  }

  warn(message: string, data?: unknown): void {
    this.logs.push({ level: "warn", message, data });
  }

  error(message: string, error?: Error, data?: unknown): void {
    this.logs.push({ level: "error", message, data: { error, data } });
  }

  // すべてのログをクリア
  clear(): void {
    this.logs = [];
  }

  // 特定のレベルのログを取得
  getLogsByLevel(level: string): Array<{ level: string; message: string; data?: unknown }> {
    return this.logs.filter((log) => log.level === level);
  }
}
