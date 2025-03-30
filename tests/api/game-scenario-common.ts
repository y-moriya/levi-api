import { UserResponse } from "../helpers/types.ts";
import { testServer, createAuthenticatedUser } from "../helpers/api.ts";
import * as gameModel from "../../models/game.ts";
import * as authService from "../../services/auth.ts";
import * as gamePhase from "../../services/game-phase.ts";
import * as gameActions from "../../services/game-actions.ts";
import app from "../../main.ts";

export interface AuthenticatedUser {
  token: string;
  user: UserResponse;
}

export interface TestUsers {
  ownerAuth: AuthenticatedUser;
  werewolfAuth: AuthenticatedUser;
  seerAuth: AuthenticatedUser;
  bodyguardAuth: AuthenticatedUser;
  villagerAuth: AuthenticatedUser;
}

export async function setupScenarioTest(): Promise<TestUsers> {
  // Reset stores
  gameModel.resetGames();
  authService.resetStore();
  // Reset game actions
  gameActions.resetGameActions();

  // Start test server
  await testServer.start(app);

  // Create authenticated users with specific roles
  const ownerAuth = await createAuthenticatedUser({
    username: "owner",
    email: `owner${Date.now()}@example.com`,
    password: "password123",
  });

  const werewolfAuth = await createAuthenticatedUser({
    username: "werewolf",
    email: `werewolf${Date.now()}@example.com`,
    password: "password123",
  });

  const seerAuth = await createAuthenticatedUser({
    username: "seer",
    email: `seer${Date.now()}@example.com`,
    password: "password123",
  });

  const bodyguardAuth = await createAuthenticatedUser({
    username: "bodyguard",
    email: `bodyguard${Date.now()}@example.com`,
    password: "password123",
  });

  const villagerAuth = await createAuthenticatedUser({
    username: "villager",
    email: `villager${Date.now()}@example.com`,
    password: "password123",
  });

  return {
    ownerAuth,
    werewolfAuth,
    seerAuth,
    bodyguardAuth,
    villagerAuth
  };
}

export async function cleanupScenarioTest() {
  try {
    // すべてのフェーズタイマーをクリア
    gamePhase.clearAllTimers();

    // Clean up games and game actions
    const games = gameModel.getAllGames();
    for (const _game of games) {
      gameActions.resetGameActions();
    }
    
    // ゲームとユーザーストアをリセット
    gameModel.resetGames();
    authService.resetStore();

    // サーバーを停止し、すべての接続が閉じられるのを待つ
    await testServer.stop();
    
    // 少し待機してリソースが完全に解放されるのを確実にする
    await new Promise(resolve => setTimeout(resolve, 200));
  } catch (error) {
    console.error('Error during test cleanup:', error);
    throw error;
  }
}