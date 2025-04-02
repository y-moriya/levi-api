// filepath: c:\Users\wellk\project\levi-api\tests\helpers\test-helpers.ts
import { assertEquals, assertNotEquals } from "https://deno.land/std@0.210.0/assert/mod.ts";
import * as gameModel from "../../models/game.ts";
import * as authService from "../../services/auth.ts";
import * as gamePhase from "../../services/game-phase.ts";
import { Game, GamePlayer, Role, Winner } from "../../types/game.ts";
import { User } from "../../types/user.ts";
import { logger } from "../../utils/logger.ts";

/**
 * 共通のテストユーザー情報を生成する
 * @param index ユーザーのインデックス
 * @returns ユーザー登録情報
 */
export function generateTestUserData(index: number = 0) {
  const timestamp = Date.now();
  return {
    username: `testuser${index}_${timestamp}`,
    email: `testuser${index}_${timestamp}@example.com`,
    password: `password123_${timestamp}`,
  };
}

/**
 * ゲームのテスト用フィクスチャーデータを生成する
 * @param ownerIndex オーナーのユーザーインデックス
 * @returns ゲーム作成パラメータ
 */
export function generateGameFixture(ownerIndex: number = 0) {
  const timestamp = Date.now();
  return {
    name: `テストゲーム_${ownerIndex}_${timestamp}`,
    maxPlayers: 5,
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
  };
}

/**
 * 複数のテストユーザーを作成する
 * @param count 作成するユーザー数
 * @returns 作成されたユーザーの配列
 */
export async function createTestUsers(count: number = 5): Promise<User[]> {
  const users: User[] = [];
  for (let i = 0; i < count; i++) {
    const userData = generateTestUserData(i);
    const user = await authService.register(userData);
    users.push(user);
  }
  return users;
}

/**
 * テストゲームをセットアップする（ユーザー作成、ゲーム作成、参加）
 * @param playerCount 参加プレイヤー数
 * @returns セットアップされたゲームとユーザー
 */
export async function setupTestGame(playerCount: number = 5): Promise<{
  game: Game;
  users: User[];
}> {
  logger.debug("テストゲームのセットアップを開始");
  // 1. ユーザーの作成
  const users = await createTestUsers(playerCount);

  // 2. ゲームの作成
  const gameData = generateGameFixture();
  const game = await gameModel.createGame(gameData, users[0].id);

  // 3. プレイヤーの参加
  for (let i = 1; i < users.length; i++) {
    await gameModel.joinGame(game.id, users[i].id);
  }

  logger.debug("テストゲームのセットアップ完了", { gameId: game.id, playerCount });
  return { game, users };
}

/**
 * テストゲームの役職を明示的に設定する
 * @param game 対象のゲーム
 * @param roleAssignments プレイヤーインデックスと役職のマッピング
 */
export function assignTestRoles(
  game: Game,
  roleAssignments: Record<number, Role>,
): void {
  Object.entries(roleAssignments).forEach(([playerIndex, role]) => {
    const index = parseInt(playerIndex, 10);
    if (index >= 0 && index < game.players.length) {
      game.players[index].role = role;
    }
  });
}

/**
 * プレイヤーの生死状態を設定する
 * @param game 対象のゲーム
 * @param aliveStatus プレイヤーインデックスと生死状態のマッピング
 */
export function setPlayerAliveStatus(
  game: Game,
  aliveStatus: Record<number, boolean>,
): void {
  Object.entries(aliveStatus).forEach(([playerIndex, isAlive]) => {
    const index = parseInt(playerIndex, 10);
    if (index >= 0 && index < game.players.length) {
      game.players[index].isAlive = isAlive;
    }
  });
}

/**
 * テスト前の状態をリセットする
 */
export function resetTestState() {
  gameModel.resetGames();
  authService.resetStore();
  gamePhase.clearAllTimers();
}

/**
 * 特定の役職を持つプレイヤーを見つける
 * @param game 対象のゲーム
 * @param role 検索する役職
 * @returns 役職を持つプレイヤーの配列
 */
export function findPlayersByRole(game: Game, role: Role): GamePlayer[] {
  return game.players.filter((player) => player.role === role);
}

/**
 * 特定の役職を持つ最初のプレイヤーを見つける
 * @param game 対象のゲーム
 * @param role 検索する役職
 * @returns 役職を持つプレイヤー（見つからない場合はundefined）
 */
export function findFirstPlayerByRole(game: Game, role: Role): GamePlayer | undefined {
  return game.players.find((player) => player.role === role);
}

/**
 * テスト関数を実行する際にログ出力を最小限にするためのラッパー
 * @param testFn テスト関数
 * @returns ラップされたテスト関数
 */
export function withQuietLogs(testFn: () => Promise<void> | void): () => Promise<void> {
  return async () => {
    try {
      // テスト中はエラーレベル以上のログのみ出力
      logger.debug("テスト実行中はログレベルを抑制します");
      await testFn();
    } finally {
      // テスト終了後にログレベルを戻す
      logger.debug("テスト終了、ログレベルを元に戻します");
    }
  };
}

/**
 * テストケース実行前の初期化処理を行う
 */
export function setupTest(): void {
  resetTestState();
}

/**
 * テストケース実行後のクリーンアップ処理を行う
 */
export async function cleanupTest(): Promise<void> {
  await gamePhase.clearAllTimers();
}

/**
 * 型安全なアサーション拡張
 */
export const assertions = {
  /**
   * ゲームの勝者を検証する
   */
  assertGameWinner(game: { winner: Winner | "NONE" }, expectedWinner: Winner | "NONE" | null): void {
    if (expectedWinner === null) {
      assertEquals(game.winner, "NONE", "ゲームは勝者が決定していないはずです");
      return;
    }

    assertNotEquals(game.winner, "NONE", "ゲームは勝者が決定しているはずです");
    assertEquals(game.winner, expectedWinner, `ゲームの勝者は${expectedWinner}のはずです`);
  },

  /**
   * ゲームのフェーズを検証する
   */
  assertGamePhase(game: Game, expectedPhase: Game["currentPhase"]): void {
    assertEquals(game.currentPhase, expectedPhase, `ゲームのフェーズは${expectedPhase}のはずです`);
  },

  /**
   * プレイヤーの役職を検証する
   */
  assertPlayerRole(player: GamePlayer, expectedRole: Role): void {
    assertEquals(player.role, expectedRole, `プレイヤーの役職は${expectedRole}のはずです`);
  },

  /**
   * プレイヤーの生死状態を検証する
   */
  assertPlayerAliveStatus(player: GamePlayer, expectedIsAlive: boolean): void {
    assertEquals(
      player.isAlive,
      expectedIsAlive,
      `プレイヤーの生死状態は${expectedIsAlive ? "生存" : "死亡"}のはずです`,
    );
  },
};
