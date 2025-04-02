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
