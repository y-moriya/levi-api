import { Client, Pool } from "https://deno.land/x/postgres@v0.17.0/mod.ts";
import { logger } from "../../utils/logger.ts";

// Clientに足りないメソッドを追加する拡張インターフェース
export interface PostgresClient extends Client {
  release(): void;
}

// テストモードの検出（IT_USE_POSTGRES=true の場合は実DBを使うため無効化）
const isTestMode = (() => {
  const itUsePg = Deno.env.get("IT_USE_POSTGRES");
  if (itUsePg && itUsePg.toLowerCase() === "true") return false;
  return (
    Deno.env.get("TEST_MODE") === "true" ||
    ("Deno" in globalThis && typeof Deno.test === "function")
  );
})();

// 設定
const POSTGRES_URL = Deno.env.get("POSTGRES_URL") || "postgres://postgres:postgres@localhost:5443/levi_api";

// プール接続を作成（テストモード時は作成しない）
export const pool = isTestMode
  ? null
  : new Pool(POSTGRES_URL, 10);

/**
 * PostgreSQLクライアントを取得し、エラーハンドリングを追加するヘルパー関数
 * @returns Promise<PostgresClient> - PostgreSQLクライアントインスタンス
 */
export async function getClient(): Promise<PostgresClient> {
  // テストモードの場合はエラーをスローせず、ダミークライアントを返す
  if (isTestMode) {
    logger.warn("テストモードのためPostgreSQLクライアントの代わりにダミーを使用");
    return createDummyClient();
  }

  try {
    if (!pool) {
      throw new Error("PostgreSQLプールが初期化されていません");
    }
    const client = await pool.connect();
    return client as PostgresClient;
  } catch (error: unknown) {
    const err = error as Error;
    logger.error(`PostgreSQLクライアント接続エラー: ${err.message}`);
    throw new Error(`データベース接続に失敗しました: ${err.message}`);
  }
}

/**
 * テスト用のダミークライアント作成関数
 */
function createDummyClient(): PostgresClient {
  return {
    queryArray: () => Promise.resolve({ rows: [] } as unknown),
    queryObject: () => Promise.resolve({ rows: [] } as unknown),
    release: () => {},
  } as unknown as PostgresClient;
}

/**
 * トランザクションを実行するためのヘルパー関数
 * @param callback トランザクション内で実行するコールバック関数
 * @returns Promise<T> - コールバック関数の戻り値
 */
export async function withTransaction<T>(
  callback: (client: PostgresClient) => Promise<T>,
): Promise<T> {
  // テストモードの場合
  if (isTestMode) {
    logger.warn("テストモードのためトランザクションをスキップ");
    return await callback(createDummyClient());
  }

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
export async function executeQuery(query: string, params: unknown[] = []): Promise<unknown> {
  // テストモードの場合
  if (isTestMode) {
    logger.warn("テストモードのためSQLクエリをスキップ");
    return { rows: [] };
  }

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
  // テストモードの場合はマイグレーションをスキップ（IT_USE_POSTGRES=true なら実行）
  if (isTestMode) {
    logger.warn("テストモードのためPostgreSQLマイグレーションをスキップ");
    return;
  }

  const client = await getClient();
  try {
    await client.queryArray("BEGIN");

    // users
    await client.queryArray(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        games_played INTEGER NOT NULL DEFAULT 0,
        games_won INTEGER NOT NULL DEFAULT 0,
        win_ratio DOUBLE PRECISION NOT NULL DEFAULT 0,
        villager_wins INTEGER NOT NULL DEFAULT 0,
        werewolf_wins INTEGER NOT NULL DEFAULT 0
      );
    `);

    // games
    await client.queryArray(`
      CREATE TABLE IF NOT EXISTS games (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL,
        creator_id TEXT NOT NULL,
        current_day INTEGER NOT NULL,
        current_phase TEXT NOT NULL,
        phase_end_time TIMESTAMPTZ NULL,
        winner TEXT NULL,
        max_players INTEGER NOT NULL,
        settings JSONB NOT NULL,
        CONSTRAINT fk_games_creator_id FOREIGN KEY (creator_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT
      );
    `);

    await client.queryArray(`
      CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);
    `);

    // players
    await client.queryArray(`
      CREATE TABLE IF NOT EXISTS players (
        game_id TEXT NOT NULL,
        player_id TEXT NOT NULL,
        username TEXT NOT NULL,
        role TEXT NULL,
        is_alive BOOLEAN NOT NULL DEFAULT true,
        joined_at TIMESTAMPTZ NOT NULL,
        PRIMARY KEY (game_id, player_id),
        CONSTRAINT fk_players_game_id FOREIGN KEY (game_id) REFERENCES games(id) ON UPDATE CASCADE ON DELETE CASCADE
      );
    `);

    await client.queryArray(`
      CREATE INDEX IF NOT EXISTS idx_players_player_id ON players(player_id);
    `);

    // game_events
    await client.queryArray(`
      CREATE TABLE IF NOT EXISTS game_events (
        id TEXT PRIMARY KEY,
        game_id TEXT NOT NULL,
        day INTEGER NOT NULL,
        phase TEXT NOT NULL,
        type TEXT NOT NULL,
        description TEXT NOT NULL,
        timestamp TIMESTAMPTZ NOT NULL,
        actor_id TEXT NULL,
        target_id TEXT NULL,
        result JSONB NULL,
        CONSTRAINT fk_game_events_game_id FOREIGN KEY (game_id) REFERENCES games(id) ON UPDATE CASCADE ON DELETE CASCADE
      );
    `);

    await client.queryArray(`
      CREATE INDEX IF NOT EXISTS idx_game_events_game_id ON game_events(game_id);
      CREATE INDEX IF NOT EXISTS idx_game_events_timestamp ON game_events(timestamp);
    `);

    // game_actions
    await client.queryArray(`
      CREATE TABLE IF NOT EXISTS game_actions (
        id TEXT PRIMARY KEY,
        game_id TEXT NOT NULL,
        day INTEGER NOT NULL,
        phase TEXT NOT NULL,
        type TEXT NOT NULL,
        actor_id TEXT NOT NULL,
        target_id TEXT NULL,
        timestamp TIMESTAMPTZ NOT NULL,
        is_completed BOOLEAN NOT NULL DEFAULT false,
        CONSTRAINT fk_game_actions_game_id FOREIGN KEY (game_id) REFERENCES games(id) ON UPDATE CASCADE ON DELETE CASCADE
      );
    `);

    await client.queryArray(`
      CREATE INDEX IF NOT EXISTS idx_game_actions_game_id ON game_actions(game_id);
      CREATE INDEX IF NOT EXISTS idx_game_actions_timestamp ON game_actions(timestamp);
    `);

    // chat_messages
    await client.queryArray(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id TEXT PRIMARY KEY,
        game_id TEXT NOT NULL,
        channel TEXT NOT NULL,
        sender_id TEXT NOT NULL,
        sender_username TEXT NOT NULL,
        sender_role TEXT NULL,
        content TEXT NOT NULL,
        timestamp TIMESTAMPTZ NOT NULL,
        CONSTRAINT fk_chat_messages_game_id FOREIGN KEY (game_id) REFERENCES games(id) ON UPDATE CASCADE ON DELETE CASCADE
      );
    `);

    await client.queryArray(`
      CREATE INDEX IF NOT EXISTS idx_chat_messages_game_channel ON chat_messages(game_id, channel);
      CREATE INDEX IF NOT EXISTS idx_chat_messages_timestamp ON chat_messages(timestamp);
    `);

    await client.queryArray("COMMIT");
    logger.info("PostgreSQLマイグレーションが完了しました");
  } catch (error) {
    await client.queryArray("ROLLBACK");
    const err = error as Error;
    logger.error(`PostgreSQLマイグレーションに失敗しました: ${err.message}`);
    throw error;
  } finally {
    client.release();
  }
}