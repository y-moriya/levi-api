import { Hono } from "https://deno.land/x/hono@v3.11.7/mod.ts";
import { AuthResponse, GameResponse, UserResponse } from "./types.ts";
import { logger } from "../../utils/logger.ts";
import { Game, GamePhase } from "../../types/game.ts";
import * as gameActions from "../../services/game-actions.ts";

// テスト用のサーバーポート
const TEST_PORT = 8081;

// ベースURL
export const BASE_URL = `http://localhost:${TEST_PORT}/v1`;

// サーバーの起動と停止を管理するクラス
class TestServer {
  private controller: AbortController | null = null;
  private server: { shutdown: () => Promise<void> } | null = null;
  private shutdownPromise: Promise<void> | null = null;

  async start(honoApp: Hono) {
    // 既存のサーバーを確実に停止
    if (this.server) {
      await this.stop();
    }

    try {
      this.controller = new AbortController();

      // テストサーバーを起動
      const handler = honoApp.fetch;
      const server = Deno.serve({
        port: TEST_PORT,
        handler,
        signal: this.controller.signal,
        onListen: undefined,
      });

      this.server = server;
      this.shutdownPromise = server.finished;

      // サーバーが起動するまで待機
      const isReady = await waitForCondition(
        async () => {
          try {
            const response = await fetch(`${BASE_URL}/health`);
            return response.ok;
          } catch {
            return false;
          }
        },
        1000,
        10,
      );

      if (!isReady) {
        throw new Error("Server failed to start within timeout");
      }

      return server;
    } catch (error) {
      // エラーが発生した場合は確実にクリーンアップ
      await this.stop();
      throw error;
    }
  }

  async stop() {
    if (this.controller) {
      this.controller.abort();
      this.controller = null;
    }

    if (this.server) {
      try {
        await this.server.shutdown();
        if (this.shutdownPromise) {
          await this.shutdownPromise;
        }
      } finally {
        this.server = null;
        this.shutdownPromise = null;

        // サーバーが完全に停止するのを確認
        await waitForCondition(
          async () => {
            try {
              await fetch(`${BASE_URL}/health`);
              return false; // サーバーがまだ応答する場合
            } catch {
              return true; // サーバーが停止している場合
            }
          },
          1000,
          10,
        );
      }
    }
  }
}

export const testServer = new TestServer();

// APIリクエスト用のヘルパー関数
export async function apiRequest(
  method: string,
  path: string,
  body?: unknown,
  token?: string,
): Promise<Response> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  return response;
}

// レスポンスボディを安全に消費するヘルパー関数
export async function consumeResponse<T>(response: Response): Promise<T> {
  try {
    const data = await response.json();

    if (!response.ok) {
      const err = new Error(`HTTP error! status: ${response.status}`);
      logger.error("HTTP error response", err, {
        status: response.status,
        data,
      });
      // エラーにレスポンスデータを追加
      Object.assign(err, { response: data });
      throw err;
    }

    // レスポンスの型に基づいて検証
    if (isActionResponse(data)) {
      if (typeof data.success !== "boolean") {
        const err = new Error("Invalid ActionResponse: success property must be boolean");
        logger.error("Invalid response", err, { data });
        throw err;
      }
      if (typeof data.message !== "string") {
        const err = new Error("Invalid ActionResponse: message property must be string");
        logger.error("Invalid response", err, { data });
        throw err;
      }
    }
    return data as T;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("Failed to consume response", err);
    throw error;
  }
}

// ActionResponseの型ガード
function isActionResponse(data: unknown): boolean {
  return (
    data !== null &&
    typeof data === "object" &&
    "success" in data &&
    "message" in data
  );
}

// テスト用のユーザーを作成
export async function createTestUser(
  userData = {
    username: "testuser",
    email: `test${Date.now()}@example.com`,
    password: "password123",
  },
) {
  const response = await apiRequest("POST", "/auth/register", userData);
  const user = await consumeResponse<UserResponse>(response);
  return { user, response };
}

// テストユーザーでログイン
export async function loginTestUser(
  credentials = {
    email: "test@example.com",
    password: "password123",
  },
) {
  const response = await apiRequest("POST", "/auth/login", credentials);
  const data = await consumeResponse<AuthResponse>(response);
  return { token: data.token, user: data.user, response };
}

// テストユーザーを作成して認証トークンを取得
export async function createAuthenticatedUser(
  userData = {
    username: "testuser",
    email: `test${Date.now()}@example.com`,
    password: "password123",
  },
): Promise<{ token: string; user: UserResponse }> {
  // Register the user
  const registerResponse = await apiRequest("POST", "/auth/register", userData);
  const user = await consumeResponse<UserResponse>(registerResponse);

  // Login to get the token
  const loginResponse = await apiRequest("POST", "/auth/login", {
    email: userData.email,
    password: userData.password,
  });
  const { token } = await consumeResponse<AuthResponse>(loginResponse);

  return { token, user };
}

// テスト用のゲームを作成
export async function createTestGame(
  token: string,
  gameData = {
    name: "Test Game",
    maxPlayers: 5,
  },
) {
  const response = await apiRequest("POST", "/games", gameData, token);
  const game = await consumeResponse<GameResponse>(response);
  return { game, response };
}

/**
 * 条件が満たされるまで待機するヘルパー関数
 * @param condition 待機する条件
 * @param timeout タイムアウト時間（ミリ秒）
 * @param interval チェック間隔（ミリ秒）
 */
export async function waitForCondition(
  condition: () => boolean | Promise<boolean>,
  timeout = 5000,
  interval = 100,
): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  return false;
}

/**
 * ゲームフェーズが変更されるまで待機する
 * @param gameId 対象のゲームID
 * @param phase 待機するフェーズ
 */
export async function waitForGamePhase(
  game: Game,
  phase: GamePhase,
  timeout = 2000,
  interval = 50,
): Promise<boolean> {
  return await waitForCondition(
    () => game.currentPhase === phase,
    timeout,
    interval
  );
}

/**
 * アクション状態が初期化されるまで待機する
 * @param gameId 対象のゲームID
 */
export async function waitForActionInitialization(
  gameId: string,
  timeout = 2000,
  interval = 50,
): Promise<boolean> {
  return await waitForCondition(
    () => {
      const actions = gameActions.getGameActions(gameId);
      return actions !== undefined;
    },
    timeout,
    interval
  );
}
