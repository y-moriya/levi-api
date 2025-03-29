import {
  assertEquals,
  assertNotEquals,
  assertRejects,
} from "https://deno.land/std@0.210.0/assert/mod.ts";
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

// Registration Tests
Deno.test({
  name: "Registration - should register a new user successfully",
  async fn() {
    setupTest();
    const user = await authService.register(testUser);
    assertEquals(user.username, testUser.username);
    assertEquals(user.email, testUser.email);
    assertNotEquals(user.id, undefined);
  }
});

Deno.test({
  name: "Registration - should not allow duplicate email registration",
  async fn() {
    setupTest();
    await authService.register(testUser);
    
    await assertRejects(
      async () => {
        await authService.register(testUser);
      },
      Error,
      "Email already exists"
    );
  }
});

// Login Tests
Deno.test({
  name: "Login - should login successfully with correct credentials",
  async fn() {
    setupTest();
    await authService.register(testUser);

    const result = await authService.login({
      email: testUser.email,
      password: testUser.password,
    });

    assertEquals(result.user.email, testUser.email);
    assertNotEquals(result.token, undefined);
    
    // Verify JWT token
    const payload = await verifyJwt(result.token);
    assertNotEquals(payload.sub, undefined);
  }
});

Deno.test({
  name: "Login - should fail with incorrect password",
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
      "Invalid credentials"
    );
  }
});

Deno.test({
  name: "Login - should fail with non-existent email",
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
      "Invalid credentials"
    );
  }
});