import { assert } from "https://deno.land/std@0.210.0/assert/mod.ts";

// テストタイムアウトを設定（10秒）
const TEST_TIMEOUT = 10000;

// テストのグローバル設定
Deno.test({
  name: "setup",
  fn: () => {
    // テストタイムアウトの設定
    assert(TEST_TIMEOUT > 0);
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

// グローバルなテストフラグを設定
Deno.env.set("TEST_MODE", "true");