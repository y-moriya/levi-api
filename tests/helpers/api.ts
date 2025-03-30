import { Hono } from "https://deno.land/x/hono@v3.11.7/mod.ts";
import {
  AuthResponse,
  UserResponse,
  GameResponse,
} from "./types.ts";
import { logger } from "../../utils/logger.ts";

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
    await this.stop();
    
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

    // サーバーが起動するまで少し待つ
    await new Promise(resolve => setTimeout(resolve, 100));
    return server;
  }

  async stop() {
    if (this.controller) {
      this.controller.abort();
      this.controller = null;
    }
    if (this.server) {
      await this.server.shutdown();
      if (this.shutdownPromise) {
        await this.shutdownPromise;
      }
      this.server = null;
      this.shutdownPromise = null;
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
      logger.error('HTTP error response', err, { 
        status: response.status,
        data 
      });
      // エラーにレスポンスデータを追加
      Object.assign(err, { response: data });
      throw err;
    }

    // レスポンスの型に基づいて検証
    if (isActionResponse(data)) {
      if (typeof data.success !== 'boolean') {
        const err = new Error('Invalid ActionResponse: success property must be boolean');
        logger.error('Invalid response', err, { data });
        throw err;
      }
      if (typeof data.message !== 'string') {
        const err = new Error('Invalid ActionResponse: message property must be string');
        logger.error('Invalid response', err, { data });
        throw err;
      }
    }
    return data as T;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to consume response', err);
    throw error;
  }
}

// ActionResponseの型ガード
function isActionResponse(data: unknown): boolean {
  return (
    data !== null &&
    typeof data === 'object' &&
    'success' in data &&
    'message' in data
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