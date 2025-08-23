import { cleanupTests, setupTests } from "./games.test-helpers.ts";

Deno.test({
  name: "ゲームAPI - サーバーセットアップ",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    await setupTests();
    await cleanupTests();
  },
});
