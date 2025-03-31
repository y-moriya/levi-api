import { assertEquals } from "https://deno.land/std@0.217.0/assert/assert_equals.ts";
import { assertObjectMatch } from "https://deno.land/std@0.217.0/assert/assert_object_match.ts";

import { apiRequest, createAuthenticatedUser, testServer } from "../helpers/api.ts";
import app from "../../main.ts";

// テスト開始前にサーバーを起動
async function startTestServer() {
  await testServer.start(app);
}

// テスト終了後にサーバーを停止
async function stopTestServer() {
  await testServer.stop();
}

// テスト実行前にサーバー起動
await startTestServer();

// バリデーションエラーのテスト
Deno.test("バリデーションエラーが適切に処理されることを検証", async () => {
  // 不正なリクエスト（バリデーションエラー）
  const invalidUserData = {
    username: "a", // 短すぎる（最小3文字）
    email: "invalid-email", // 不正なメールフォーマット
    password: "short", // 短すぎる（最小8文字）
  };

  const response = await apiRequest("POST", "/auth/register", invalidUserData);

  assertEquals(response.status, 400);
  const errorResponse = await response.json();
  
  assertObjectMatch(errorResponse, {
    code: "VALIDATION_ERROR",
    message: "リクエストデータが無効です", // 日本語メッセージがデフォルト
    severity: "WARN"
  });
  
  // バリデーションエラーの詳細が含まれていることを確認
  assertEquals(errorResponse.details.validationErrors.length > 0, true);
  
  // レスポンスボディの消費を確実にする
  if (response.bodyUsed === false && response.body) {
    try {
      await response.body.cancel();
    } catch (_) {
      // キャンセル中のエラーは無視
    }
  }
});

// 認証エラーのテスト
Deno.test("認証エラーが適切に処理されることを検証", async () => {
  // 不正な認証情報でのログイン試行
  const invalidCredentials = {
    email: "nonexistent@example.com",
    password: "wrongpassword",
  };

  const response = await apiRequest("POST", "/auth/login", invalidCredentials);

  assertEquals(response.status, 401);
  const errorResponse = await response.json();
  
  assertObjectMatch(errorResponse, {
    code: "INVALID_CREDENTIALS",
    message: "無効なメールアドレスまたはパスワードです",
    severity: "WARN"
  });
  
  // レスポンスボディの消費を確実にする
  if (response.bodyUsed === false && response.body) {
    try {
      await response.body.cancel();
    } catch (_) {
      // キャンセル中のエラーは無視
    }
  }
});

// 言語設定によるエラーメッセージのテスト
Deno.test("言語設定によって適切なエラーメッセージが返されることを検証", async () => {
  // 不正なリクエストを英語設定で送信
  const invalidUserData = {
    username: "a", 
    email: "invalid-email",
    password: "short",
  };

  // テスト用のヘルパーを使用し、リクエストヘッダーでAccept-Languageを設定
  const response = await apiRequest(
    "POST", 
    "/auth/register", 
    invalidUserData,
    undefined,
    { "Accept-Language": "en-US" }
  );

  assertEquals(response.status, 400);
  const errorResponse = await response.json();
  
  assertObjectMatch(errorResponse, {
    code: "VALIDATION_ERROR",
    message: "Invalid request data", // 英語メッセージ
    severity: "WARN"
  });
  
  // レスポンスボディの消費を確実にする
  if (response.bodyUsed === false && response.body) {
    try {
      await response.body.cancel();
    } catch (_) {
      // キャンセル中のエラーは無視
    }
  }
});

// リソースが見つからない場合のエラーのテスト
Deno.test("リソースが見つからない場合のエラーが適切に処理されることを検証", async () => {
  const { token } = await createAuthenticatedUser();
  
  // 存在しないゲームIDでリクエスト
  const nonExistentGameId = "nonexistent-game-id";
  const response = await apiRequest("GET", `/games/${nonExistentGameId}`, undefined, token);

  assertEquals(response.status, 404);
  const errorResponse = await response.json();
  
  assertObjectMatch(errorResponse, {
    code: "GAME_NOT_FOUND",
    message: "指定されたゲームが見つかりません",
    severity: "WARN"
  });
  
  // レスポンスボディの消費を確実にする
  if (response.bodyUsed === false && response.body) {
    try {
      await response.body.cancel();
    } catch (_) {
      // キャンセル中のエラーは無視
    }
  }
});

// テスト終了時にサーバーを停止
// Deno.addFinalizer は存在しないので、代わりにテスト終了時に自動的に実行される処理として
// unload イベントにリスナーを追加
addEventListener("unload", () => {
  stopTestServer().catch(console.error);
});