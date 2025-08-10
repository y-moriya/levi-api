import { ApiClient } from "./client.ts";
import { consumeResponse } from "./response.ts";
import { AuthResponse, UserResponse } from "./types.ts";

export async function createTestUser(api: ApiClient, userData = {
  username: "testuser",
  email: `test${Date.now()}@example.com`,
  password: "password123",
}) {
  const response = await api.post("/auth/register", userData);
  const user = await consumeResponse<UserResponse>(response);
  return { user, response };
}

export async function loginTestUser(api: ApiClient, credentials = {
  email: "test@example.com",
  password: "password123",
}) {
  const response = await api.post("/auth/login", credentials);
  const data = await consumeResponse<AuthResponse>(response);
  return { token: data.token, user: data.user, response };
}

export async function createAuthenticatedUser(
  api: ApiClient,
  userNameOrData?: string | { username: string; email: string; password: string },
  role?: string,
): Promise<{ token: string; user: UserResponse }> {
  let userData: { username: string; email: string; password: string };

  if (typeof userNameOrData === "string") {
    const userName = userNameOrData || "testuser";
    userData = {
      username: `${userName}${role ? `-${role}` : ''}`,
      email: `${userName}${role ? `.${role}` : ''}${Date.now()}@example.com`,
      password: "password123",
    };
  } else if (userNameOrData && typeof userNameOrData === "object") {
    userData = userNameOrData;
  } else {
    userData = { username: "testuser", email: `test${Date.now()}@example.com`, password: "password123" };
  }

  const registerResponse = await api.post("/auth/register", userData);
  const user = await consumeResponse<UserResponse>(registerResponse);

  const loginResponse = await api.post("/auth/login", { email: userData.email, password: userData.password });
  const { token } = await consumeResponse<AuthResponse>(loginResponse);
  return { token, user };
}
