import { UserResponse } from "../helpers/types.ts";
import { createAuthenticatedUser, testServer } from "../helpers/api.ts";
import * as gameModel from "../../models/game.ts";
import * as authService from "../../services/auth.ts";
import * as gamePhase from "../../services/game-phase.ts";
import * as gameActions from "../../services/game-actions.ts";
import app from "../../main.ts";

// サーバー状態を追跡
let isServerRunning = false;

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
  mediumAuth: AuthenticatedUser; // 霊能者を追加
}

export async function setupScenarioTest(): Promise<TestUsers> {
  try {
    // Reset stores
    gameModel.resetGames();
    authService.resetStore();
    gameActions.resetGameActions();

    // サーバーが実行中でない場合のみ起動
    if (!isServerRunning) {
      await testServer.start(app);
      isServerRunning = true;
    }

    // Create authenticated users with specific roles
    const [ownerAuth, werewolfAuth, seerAuth, bodyguardAuth, villagerAuth, mediumAuth] = await Promise.all([
      createAuthenticatedUser({
        username: "owner",
        email: `owner${Date.now()}@example.com`,
        password: "password123",
      }),
      createAuthenticatedUser({
        username: "werewolf",
        email: `werewolf${Date.now()}@example.com`,
        password: "password123",
      }),
      createAuthenticatedUser({
        username: "seer",
        email: `seer${Date.now()}@example.com`,
        password: "password123",
      }),
      createAuthenticatedUser({
        username: "bodyguard",
        email: `bodyguard${Date.now()}@example.com`,
        password: "password123",
      }),
      createAuthenticatedUser({
        username: "villager",
        email: `villager${Date.now()}@example.com`,
        password: "password123",
      }),
      createAuthenticatedUser({
        username: "medium",
        email: `medium${Date.now()}@example.com`,
        password: "password123",
      }),
    ]);

    return { ownerAuth, werewolfAuth, seerAuth, bodyguardAuth, villagerAuth, mediumAuth };
  } catch (error) {
    console.error("Failed to setup scenario test:", error);
    throw error;
  }
}

export function cleanupScenarioTest() {
  try {
    // すべてのフェーズタイマーをクリア
    gamePhase.clearAllTimers();

    // Clean up games and game actions
    gameActions.resetGameActions();

    // ゲームとユーザーストアをリセット
    gameModel.resetGames();
    authService.resetStore();

    // サーバーは停止せず、再利用
  } catch (error) {
    console.error("Error during test cleanup:", error);
    throw error;
  }
}
