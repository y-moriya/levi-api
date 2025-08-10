export { TEST_PORT, BASE_URL, testServer } from "./server.ts";
export { ApiClient } from "./client.ts";
export { consumeResponse } from "./response.ts";
export { waitForCondition, waitForGamePhase, waitForActionInitialization } from "./waiters.ts";

// 後方互換のためのラッパーとグローバルクライアント
import { BASE_URL } from "./server.ts";
import { ApiClient, apiRequest as rawApiRequest } from "./client.ts";
import { createTestUser as _createTestUser, loginTestUser as _loginTestUser, createAuthenticatedUser as _createAuthenticatedUser } from "./users.ts";
import { createTestGame as _createTestGame } from "./games.ts";

export const api = new ApiClient(BASE_URL);

// 旧シグネチャ互換: path を受け取り BASE_URL を付与して呼び出す
export function apiRequest(
	method: string,
	path: string,
	body?: unknown,
	token?: string,
	customHeaders?: Record<string, string>,
): Promise<Response> {
	return rawApiRequest(method, `${BASE_URL}${path}`, body, token, customHeaders);
}

// 旧シグネチャ互換: api 引数不要のヘルパー
export function createTestUser(userData?: {
	username: string;
	email: string;
	password: string;
}) {
	return _createTestUser(api, userData);
}

export function loginTestUser(credentials?: { email: string; password: string; }) {
	return _loginTestUser(api, credentials);
}

export function createAuthenticatedUser(
	userNameOrData?: string | { username: string; email: string; password: string },
	role?: string,
) {
	return _createAuthenticatedUser(api, userNameOrData as any, role);
}

export function createTestGame(token: string, gameData?: { name: string; maxPlayers: number }) {
	return _createTestGame(api, token, gameData);
}
