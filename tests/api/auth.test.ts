import {
  assertEquals,
  assertNotEquals,
} from "https://deno.land/std@0.210.0/assert/mod.ts";
import { describe, it, beforeAll, afterAll, beforeEach } from "https://deno.land/std@0.210.0/testing/bdd.ts";
import { apiRequest, consumeResponse, testServer } from "../helpers/api.ts";
import { ApiError, UserResponse, AuthResponse } from "../helpers/types.ts";
import app from "../../main.ts";
import * as authService from "../../services/auth.ts";

describe("Auth API", () => {
  beforeAll(async () => {
    await testServer.start(app);
  });

  afterAll(() => {
    testServer.stop();
  });

  beforeEach(() => {
    authService.resetStore();
  });

  describe("POST /auth/register", () => {
    const validUser = {
      username: "testuser",
      email: "test@example.com",
      password: "password123",
    };

    it("should register a new user successfully", async () => {
      const response = await apiRequest("POST", "/auth/register", validUser);
      const user = await consumeResponse<UserResponse>(response);

      assertEquals(response.status, 201);
      assertEquals(user.username, validUser.username);
      assertEquals(user.email, validUser.email);
      assertNotEquals(user.id, undefined);
    });

    it("should not allow duplicate email registration", async () => {
      // First registration
      const response1 = await apiRequest("POST", "/auth/register", validUser);
      await consumeResponse<UserResponse>(response1);

      // Attempt duplicate registration
      const response2 = await apiRequest("POST", "/auth/register", validUser);
      const error = await consumeResponse<ApiError>(response2);

      assertEquals(response2.status, 400);
      assertEquals(error.code, "EMAIL_EXISTS");
    });

    it("should validate user registration input", async () => {
      const invalidUser = {
        username: "a",
        email: "invalid-email",
        password: "short",
      };

      const response = await apiRequest("POST", "/auth/register", invalidUser);
      const error = await consumeResponse<ApiError>(response);

      assertEquals(response.status, 400);
      assertEquals(error.code, "VALIDATION_ERROR");
    });
  });

  describe("POST /auth/login", () => {
    const user = {
      username: "testuser",
      email: "test@example.com",
      password: "password123",
    };

    beforeEach(async () => {
      // Register a user before each login test
      const response = await apiRequest("POST", "/auth/register", user);
      await consumeResponse<UserResponse>(response);
    });

    it("should login successfully with correct credentials", async () => {
      const response = await apiRequest("POST", "/auth/login", {
        email: user.email,
        password: user.password,
      });
      const auth = await consumeResponse<AuthResponse>(response);

      assertEquals(response.status, 200);
      assertEquals(auth.user.email, user.email);
      assertNotEquals(auth.token, undefined);
    });

    it("should fail with incorrect password", async () => {
      const response = await apiRequest("POST", "/auth/login", {
        email: user.email,
        password: "wrongpassword",
      });
      const error = await consumeResponse<ApiError>(response);

      assertEquals(response.status, 401);
      assertEquals(error.code, "INVALID_CREDENTIALS");
    });

    it("should fail with non-existent email", async () => {
      const response = await apiRequest("POST", "/auth/login", {
        email: "nonexistent@example.com",
        password: user.password,
      });
      const error = await consumeResponse<ApiError>(response);

      assertEquals(response.status, 401);
      assertEquals(error.code, "INVALID_CREDENTIALS");
    });

    it("should validate login input", async () => {
      const response = await apiRequest("POST", "/auth/login", {
        email: "invalid-email",
        password: "",
      });
      const error = await consumeResponse<ApiError>(response);

      assertEquals(response.status, 400);
      assertEquals(error.code, "VALIDATION_ERROR");
    });
  });
});