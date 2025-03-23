import {
  assertEquals,
  assertNotEquals,
  assertRejects,
} from "https://deno.land/std@0.210.0/assert/mod.ts";
import { describe, it, beforeEach } from "https://deno.land/std@0.210.0/testing/bdd.ts";
import * as authService from "../services/auth.ts";
import { verifyJwt } from "../utils/jwt.ts";

interface APIError {
  message: string;
}

describe("Authentication Service", () => {
  const testUser = {
    username: "testuser",
    email: "test@example.com",
    password: "password123",
  };

  beforeEach(() => {
    authService.resetStore();
  });

  describe("register", () => {
    it("should register a new user successfully", async () => {
      const user = await authService.register(testUser);
      assertEquals(user.username, testUser.username);
      assertEquals(user.email, testUser.email);
      assertNotEquals(user.id, undefined);
    });

    it("should not allow duplicate email registration", async () => {
      await authService.register(testUser);
      
      await assertRejects(
        async () => {
          await authService.register(testUser);
        },
        Error,
        "Email already exists"
      );
    });
  });

  describe("login", () => {
    beforeEach(async () => {
      await authService.register(testUser);
    });

    it("should login successfully with correct credentials", async () => {
      const result = await authService.login({
        email: testUser.email,
        password: testUser.password,
      });

      assertEquals(result.user.email, testUser.email);
      assertNotEquals(result.token, undefined);
      
      // Verify JWT token
      const payload = await verifyJwt(result.token);
      assertNotEquals(payload.sub, undefined);
    });

    it("should fail with incorrect password", async () => {
      await assertRejects(
        async () => {
          await authService.login({
            email: testUser.email,
            password: "wrongpassword",
          });
        },
        Error,
        "Invalid credentials"
      );
    });

    it("should fail with non-existent email", async () => {
      await assertRejects(
        async () => {
          await authService.login({
            email: "nonexistent@example.com",
            password: "password123",
          });
        },
        Error,
        "Invalid credentials"
      );
    });
  });
});