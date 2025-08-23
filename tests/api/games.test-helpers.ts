import app from "../../main.ts";
import { repositoryContainer } from "../../repositories/repository-container.ts";
import * as gameModel from "../../models/game.ts";
import * as authService from "../../services/auth.ts";
import * as gamePhase from "../../services/game-phase.ts";
import { createAuthenticatedUser, testServer } from "../helpers/api.ts";
import { UserResponse } from "../helpers/types.ts";

let isServerRunning = false;

export interface AuthenticatedUser { token: string; user: UserResponse }

export async function setupTests(): Promise<{ ownerAuth: AuthenticatedUser; playerAuth: AuthenticatedUser }> {
  // まずテスト状態のリセット（メモリ側）
  gameModel.resetGames();
  authService.resetStore();
  gamePhase.clearAllTimers();

  // 毎テストでDBも必ず初期化・クリア（IT_USE_POSTGRES=true でも）
  await repositoryContainer.initialize();
  await repositoryContainer.clearAllRepositories();

  if (!isServerRunning) {
    // サーバ未起動なら起動（initialize は冪等）
    await testServer.start(app);
    isServerRunning = true;
  }

  const [ownerAuth, playerAuth] = await Promise.all([
    createAuthenticatedUser({
      username: "gameowner",
      email: `owner${Date.now()}@example.com`,
      password: "password123",
    }),
    createAuthenticatedUser({
      username: "gameplayer",
      email: `player${Date.now()}@example.com`,
      password: "password123",
    }),
  ]);

  return { ownerAuth, playerAuth };
}

export async function cleanupTests() {
  try {
    // Clear phase timers for all games
    const games = await gameModel.getAllGames();
    for (const game of await games) {
      await gamePhase.clearPhaseTimer(game.id);
    }
  } finally {
    // Reset stores for isolation between tests
    await gameModel.resetGames();
    await authService.resetStore();
  }
}
