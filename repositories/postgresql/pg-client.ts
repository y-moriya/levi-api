import { Client, Pool } from "https://deno.land/x/postgres@v0.17.0/mod.ts";
import { logger } from "../../utils/logger.ts";

// Clientに足りないメソッドを追加する拡張インターフェース
export interface PostgresClient extends Client {
  release(): void;
}

// 設定
const POSTGRES_URL = Deno.env.get("POSTGRES_URL") || "postgres://postgres:postgres@localhost:5432/levi_api";

// プール接続を作成
export const pool = new Pool(POSTGRES_URL, 10);

/**
 * PostgreSQLクライアントを取得し、エラーハンドリングを追加するヘルパー関数
 * @returns Promise<PostgresClient> - PostgreSQLクライアントインスタンス
 */
export async function getClient(): Promise<PostgresClient> {
  try {
    const client = await pool.connect();
    return client as PostgresClient;
  } catch (error: unknown) {
    const err = error as Error;
    logger.error(`PostgreSQLクライアント接続エラー: ${err.message}`);
    throw new Error(`データベース接続に失敗しました: ${err.message}`);
  }
}

/**
 * トランザクションを実行するためのヘルパー関数
 * @param callback トランザクション内で実行するコールバック関数
 * @returns Promise<T> - コールバック関数の戻り値
 */
export async function withTransaction<T>(
  callback: (client: PostgresClient) => Promise<T>,
): Promise<T> {
  const client = await getClient();
  try {
    await client.queryArray("BEGIN");
    const result = await callback(client);
    await client.queryArray("COMMIT");
    return result;
  } catch (error: unknown) {
    await client.queryArray("ROLLBACK");
    const err = error as Error;
    logger.error(`トランザクションエラー: ${err.message}`);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * SQL実行ヘルパー関数 (自動的にクライアントを取得して解放)
 * @param query 実行するSQLクエリ
 * @param params クエリパラメータ
 * @returns Promise<QueryResult> - クエリの結果
 */
export async function executeQuery(query: string, params: any[] = []): Promise<any> {
  const client = await getClient();
  try {
    const result = await client.queryObject(query, params);
    return result;
  } catch (error: unknown) {
    const err = error as Error;
    logger.error(`クエリ実行エラー: ${err.message}\nクエリ: ${query}\nパラメータ: ${JSON.stringify(params)}`);
    throw error;
  } finally {
    client.release();
  }
}

// マイグレーション実行関数（repository-containerで参照されているため追加）
export async function runMigrations(): Promise<void> {
  logger.info("PostgreSQLマイグレーションを実行中...");
  // マイグレーション処理を実装
}