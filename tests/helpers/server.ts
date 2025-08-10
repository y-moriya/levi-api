import { Hono } from "https://deno.land/x/hono@v3.11.7/mod.ts";

// テスト用のサーバーポート
export const TEST_PORT = 8081;

// ベースURL
export const BASE_URL = `http://localhost:${TEST_PORT}/v1`;

// 条件が満たされるまで待機するヘルパー関数（軽量版。詳細版は waiters.ts にも定義）
async function waitForCondition(
  condition: () => boolean | Promise<boolean>,
  timeout = 5000,
  interval = 100,
): Promise<boolean> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    if (await condition()) return true;
    await new Promise((r) => setTimeout(r, interval));
  }
  return false;
}

// サーバーの起動と停止を管理するクラス
class TestServer {
  private controller: AbortController | null = null;
  private server: { shutdown: () => Promise<void>; finished: Promise<void> } | null = null;
  private shutdownPromise: Promise<void> | null = null;

  async start(honoApp: Hono) {
    if (this.server) {
      await this.stop();
    }

    try {
      this.controller = new AbortController();
      const handler = honoApp.fetch;
      const server = Deno.serve({
        port: TEST_PORT,
        handler,
        signal: this.controller.signal,
        onListen: undefined,
      });

      this.server = server;
      this.shutdownPromise = server.finished;

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

      if (!isReady) throw new Error("Server failed to start within timeout");
      return server;
    } catch (error) {
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
        if (this.shutdownPromise) await this.shutdownPromise;
      } finally {
        this.server = null;
        this.shutdownPromise = null;
        await waitForCondition(
          async () => {
            try {
              await fetch(`${BASE_URL}/health`);
              return false;
            } catch {
              return true;
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
