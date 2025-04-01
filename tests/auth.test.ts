import { assertEquals, assertNotEquals, assertRejects } from "https://deno.land/std@0.210.0/assert/mod.ts";
import * as authService from "../services/auth.ts";
import { verifyJwt } from "../utils/jwt.ts";

interface APIError {
  message: string;
}

const testUser = {
  username: "testuser",
  email: "test@example.com",
  password: "password123",
};

function setupTest() {
  authService.resetStore();
}

// 登録テスト
Deno.test({
  name: "登録 - 新規ユーザーの登録が正常に行われる",
  async fn() {
    setupTest();
    const user = await authService.register(testUser);
    assertEquals(user.username, testUser.username);
    assertEquals(user.email, testUser.email);
    assertNotEquals(user.id, undefined);
  },
});

Deno.test({
  name: "登録 - メールアドレスの重複登録を許可しない",
  async fn() {
    setupTest();
    await authService.register(testUser);

    await assertRejects(
      async () => {
        await authService.register(testUser);
      },
      Error,
      "Email already exists",
    );
  },
});

// ログインテスト
Deno.test({
  name: "ログイン - 正しい認証情報でログイン成功",
  async fn() {
    setupTest();
    await authService.register(testUser);

    const result = await authService.login({
      email: testUser.email,
      password: testUser.password,
    });

    assertEquals(result.user.email, testUser.email);
    assertNotEquals(result.token, undefined);

    // JWTトークンの検証
    const payload = await verifyJwt(result.token);
    assertNotEquals(payload.sub, undefined);
  },
});

Deno.test({
  name: "ログイン - 不正なパスワードでログイン失敗",
  async fn() {
    setupTest();
    await authService.register(testUser);

    await assertRejects(
      async () => {
        await authService.login({
          email: testUser.email,
          password: "wrongpassword",
        });
      },
      Error,
      "Invalid credentials",
    );
  },
});

Deno.test({
  name: "ログイン - 存在しないメールアドレスでログイン失敗",
  async fn() {
    setupTest();
    await assertRejects(
      async () => {
        await authService.login({
          email: "nonexistent@example.com",
          password: "password123",
        });
      },
      Error,
      "Invalid credentials",
    );
  },
});
