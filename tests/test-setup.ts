import { assert } from "https://deno.land/std@0.210.0/assert/mod.ts";

// テストタイムアウトを設定（5秒）
const TEST_TIMEOUT = 5000; // 10秒から5秒に短縮

// テストのグローバル設定
Deno.test({
  name: "setup",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: () => {
    // テストタイムアウトの設定
    assert(TEST_TIMEOUT > 0);
  },
});

// グローバルなテストフラグを設定
Deno.env.set("TEST_MODE", "true");

// テストの並行実行を有効化
Deno.env.set("DENO_TEST_CONCURRENT", "1");

// テスト実行時は詳細な標準出力を抑制する（logger へルーティング）
import { logger } from "../utils/logger.ts";
const isDenoTest = typeof Deno !== "undefined" && typeof (Deno as { test?: unknown }).test === "function";
if (isDenoTest) {
  // preserve error/warn but route verbose logs through logger so log level filtering applies
  console.log = (...args: unknown[]) => logger.info(String(args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ')));
  console.info = (...args: unknown[]) => logger.info(String(args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ')));
  console.debug = (...args: unknown[]) => logger.debug(String(args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ')));
}
