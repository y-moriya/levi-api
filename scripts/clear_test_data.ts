#!/usr/bin/env -S deno run --allow-net --allow-env
// scripts/clear_test_data.ts
// テストデータを削除するユーティリティスクリプト
// 使い方:
//  deno run --allow-net --allow-env scripts/clear_test_data.ts
// オプション:
//  --yes|-y    確認プロンプトをスキップして実行
//  --force     本番っぽい DB ホストでも実行を許可

import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";
import { logger } from "../utils/logger.ts";

const DEFAULT_POSTGRES_URL = "postgres://postgres:postgres@localhost:5443/levi_api";
const POSTGRES_URL = Deno.env.get("POSTGRES_URL") || DEFAULT_POSTGRES_URL;

function looksLikeProduction(url: string) {
  // 簡易判定: localhost / 127.0.0.1 を含まない場合は要注意
  const lower = url.toLowerCase();
  return !(lower.includes("localhost") || lower.includes("127.0.0.1"));
}

async function confirm(prompt: string) {
  const buf = new Uint8Array(1024);
  await Deno.stdout.write(new TextEncoder().encode(prompt));
  const n = <number>await Deno.stdin.read(buf);
  if (!n) return false;
  const input = new TextDecoder().decode(buf.subarray(0, n)).trim().toLowerCase();
  return input === "y" || input === "yes";
}

async function main() {
  const args = new Set(Deno.args);
  const skipConfirm = args.has("--yes") || args.has("-y");
  const force = args.has("--force");

  logger.info(`POSTGRES_URL: ${POSTGRES_URL}`);

  if (looksLikeProduction(POSTGRES_URL) && !force) {
  logger.error("ERROR: POSTGRES_URL がローカルに見えません。誤操作を防ぐため --force を付けて実行してください。");
    Deno.exit(2);
  }

  if (!skipConfirm) {
    const ok = await confirm("この操作は指定DBのテストデータを完全に削除します。続行しますか? (y/N): ");
    if (!ok) {
  logger.info("キャンセルしました。");
      Deno.exit(0);
    }
  }

  const client = new Client(POSTGRES_URL);
  try {
    await client.connect();
  logger.info("DB に接続しました。トランザクションを開始します...");
    await client.queryArray("BEGIN");

    // 削除順序は外部キー制約を考慮
    const tables = [
      "chat_messages",
      "game_actions",
      "game_events",
      "players",
      "games",
      "users",
    ];

    for (const table of tables) {
      // 一部テーブルに id カラムが存在しないため、特定カラムを返すのではなく
      // 常に 1 を返す RETURNING 1 を使って削除件数を取得する
      const res = await client.queryObject(`DELETE FROM ${table} RETURNING 1;`);
      const rows: unknown[] = (res as unknown as { rows?: unknown[] }).rows || [];
  logger.info(`Deleted from ${table}: ${rows.length}`);
    }

    await client.queryArray("COMMIT");
  logger.info("テストデータの削除が完了しました。");
  } catch (err) {
    if (err instanceof Error) {
      logger.error("エラー発生、ロールバックします:", err);
    } else {
      logger.error("エラー発生、ロールバックします:", { error: String(err) });
    }
    try {
      await client.queryArray("ROLLBACK");
    } catch (_) {
      // ignore
    }
    Deno.exit(1);
  } finally {
    await client.end();
  }
}

if (import.meta.main) {
  main();
}
