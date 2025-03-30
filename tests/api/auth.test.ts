import { assertEquals, assertNotEquals } from "https://deno.land/std@0.210.0/assert/mod.ts";
import { apiRequest, consumeResponse, testServer } from "../helpers/api.ts";
import { AuthResponse, UserResponse } from "../helpers/types.ts";
import app from "../../main.ts";
import * as authService from "../../services/auth.ts";

const validUser = {
  username: "testuser",
  email: "test@example.com",
  password: "password123",
};

// テストサーバーのセットアップとクリーンアップ
async function setupTests() {
  authService.resetStore();
  try {
    await testServer.start(app);
  } catch (error) {
    console.error("Failed to start test server:", error);
    throw error;
  }
}

async function cleanupTests() {
  try {
    await testServer.stop();
  } catch (error) {
    console.error("Failed to stop test server:", error);
    throw error;
  }
}

// サーバーセットアップのテスト
Deno.test({
  name: "API Server Setup",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    await setupTests();
    await cleanupTests();
  },
});

// Registration Tests
Deno.test({
  name: "Registration - should register a new user successfully",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    await setupTests();
    const response = await apiRequest("POST", "/auth/register", validUser);
    const user = await consumeResponse<UserResponse>(response);

    assertEquals(response.status, 201);
    assertEquals(user.username, validUser.username);
    assertEquals(user.email, validUser.email);
    assertNotEquals(user.id, undefined);

    await cleanupTests();
  },
});

Deno.test({
  name: "Registration - should not allow duplicate email registration",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    await setupTests();
    // First registration
    const response1 = await apiRequest("POST", "/auth/register", validUser);
    await consumeResponse<UserResponse>(response1);

    // Attempt duplicate registration
    const response2 = await apiRequest("POST", "/auth/register", validUser);
    try {
      await consumeResponse<UserResponse>(response2);
      throw new Error("Expected an error but got success");
    } catch (error) {
      assertEquals(response2.status, 400);
      assertEquals((error as Error & { response: { code: string } }).response.code, "EMAIL_EXISTS");
    }

    await cleanupTests();
  },
});

Deno.test({
  name: "Registration - should validate user registration input",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    await setupTests();
    const invalidUser = {
      username: "a",
      email: "invalid-email",
      password: "short",
    };

    const response = await apiRequest("POST", "/auth/register", invalidUser);
    try {
      await consumeResponse<UserResponse>(response);
      throw new Error("Expected an error but got success");
    } catch (error) {
      assertEquals(response.status, 400);
      assertEquals((error as Error & { response: { code: string } }).response.code, "VALIDATION_ERROR");
    }

    await cleanupTests();
  },
});

// Login Tests
Deno.test({
  name: "Login - should login successfully with correct credentials",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    await setupTests();
    // Register a user first
    const registerResponse = await apiRequest("POST", "/auth/register", validUser);
    await consumeResponse<UserResponse>(registerResponse);

    const response = await apiRequest("POST", "/auth/login", {
      email: validUser.email,
      password: validUser.password,
    });
    const auth = await consumeResponse<AuthResponse>(response);

    assertEquals(response.status, 200);
    assertEquals(auth.user.email, validUser.email);
    assertNotEquals(auth.token, undefined);

    await cleanupTests();
  },
});

Deno.test({
  name: "Login - should fail with incorrect password",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    await setupTests();
    // Register a user first
    const registerResponse = await apiRequest("POST", "/auth/register", validUser);
    await consumeResponse<UserResponse>(registerResponse);

    const response = await apiRequest("POST", "/auth/login", {
      email: validUser.email,
      password: "wrongpassword",
    });
    try {
      await consumeResponse<AuthResponse>(response);
      throw new Error("Expected an error but got success");
    } catch (error) {
      assertEquals(response.status, 401);
      assertEquals((error as Error & { response: { code: string } }).response.code, "INVALID_CREDENTIALS");
    }

    await cleanupTests();
  },
});

Deno.test({
  name: "Login - should fail with non-existent email",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    await setupTests();
    const response = await apiRequest("POST", "/auth/login", {
      email: "nonexistent@example.com",
      password: validUser.password,
    });
    try {
      await consumeResponse<AuthResponse>(response);
      throw new Error("Expected an error but got success");
    } catch (error) {
      assertEquals(response.status, 401);
      assertEquals((error as Error & { response: { code: string } }).response.code, "INVALID_CREDENTIALS");
    }

    await cleanupTests();
  },
});

Deno.test({
  name: "Login - should validate login input",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    await setupTests();
    const response = await apiRequest("POST", "/auth/login", {
      email: "invalid-email",
      password: "",
    });
    try {
      await consumeResponse<AuthResponse>(response);
      throw new Error("Expected an error but got success");
    } catch (error) {
      assertEquals(response.status, 400);
      assertEquals((error as Error & { response: { code: string } }).response.code, "VALIDATION_ERROR");
    }

    await cleanupTests();
  },
});
