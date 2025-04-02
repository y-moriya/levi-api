// エラーハンドリングのテスト
import * as gameLogic from "../services/game-logic.ts";
import * as gameActions from "../services/game-actions.ts";
import * as gameModel from "../models/game.ts";
import { gameStore } from "../models/game.ts";
import * as authService from "../services/auth.ts";
import { Game } from "../types/game.ts";
import { User } from "../types/user.ts";
import { GameError } from "../types/error.ts";
import { 
  setupTest, 
  cleanupTest, 
  assignTestRoles
} from "./helpers/test-helpers.ts";

let testGame: Game;
let testUsers: User[];

/**
 * エラーハンドリングテスト用のゲーム環境をセットアップする
 */
async function setupErrorHandlingTest() {
  await setupTest();
  
  // テストユーザーの作成
  testUsers = await Promise.all([
    authService.register({
      username: "owner",
      email: "owner@test.com",
      password: "password123",
    }),
    authService.register({
      username: "player2",
      email: "player2@test.com",
      password: "password123",
    }),
    authService.register({
      username: "player3",
      email: "player3@test.com",
      password: "password123",
    }),
    authService.register({
      username: "player4",
      email: "player4@test.com",
      password: "password123",
    }),
    authService.register({
      username: "player5",
      email: "player5@test.com",
      password: "password123",
    }),
  ]);

  // テストゲームの作成
  testGame = await gameModel.createGame({
    name: "テストゲーム",
    maxPlayers: 5,
    settings: {
      roles: {
        werewolfCount: 1,
        seerCount: 1,
        bodyguardCount: 1,
        mediumCount: 0,
      },
      dayTimeSeconds: 60,
      nightTimeSeconds: 40,
      voteTimeSeconds: 30
    },
  }, testUsers[0].id);

  // プレイヤーをゲームに追加
  for (let i = 1; i < testUsers.length; i++) {
    await gameModel.joinGame(testGame.id, testUsers[i].id);
  }
}

// テスト後のクリーンアップ
async function cleanupErrorHandlingTest() {
  await cleanupTest();
}

// ゲームオーナー権限のエラーテスト
Deno.test({
  name: "エラーハンドリング - ゲームオーナー権限のテスト",
  fn: async () => {
    try {
      await setupErrorHandlingTest();
      
      // 明示的にテストモードをオフにする
      const originalTestMode = Deno.env.get("TEST_MODE");
      Deno.env.set("TEST_MODE", "false");
      
      // オーナー以外がゲームを開始しようとする
      const originalOwnerId = testGame.owner.id;
      testGame.owner.id = testUsers[1].id;
      
      // リクエストユーザーを設定（オーナーではないユーザー）
      const requestUser = { ...testUsers[0] };
      gameStore.setRequestUser(requestUser);
      
      try {
        // エラーが発生することを期待
        await gameLogic.startGame(testGame.id);
        throw new Error("ゲームオーナー権限チェックが正しく機能していません");
      } catch (error) {
        if (!(error instanceof GameError)) {
          throw error;
        }
        if (error.message !== "ゲームオーナーのみがゲームを開始できます") {
          throw new Error(`予期しないエラーメッセージ: ${error.message}`);
        }
      }
      
      // 元の状態に戻す
      testGame.owner.id = originalOwnerId;
      gameStore.setRequestUser(null);
      
      // 環境変数を元に戻す
      if (originalTestMode) {
        Deno.env.set("TEST_MODE", originalTestMode);
      } else {
        Deno.env.delete("TEST_MODE");
      }
    } finally {
      await cleanupErrorHandlingTest();
    }
  },
});

// ゲーム状態に関するエラーテスト
Deno.test({
  name: "エラーハンドリング - 既に開始済みのゲームを再度開始しようとした場合のエラー",
  fn: async () => {
    try {
      await setupErrorHandlingTest();
      
      // 明示的にテストモードをオフにする
      const originalTestMode = Deno.env.get("TEST_MODE");
      Deno.env.set("TEST_MODE", "false");
      
      // ゲームを開始状態に設定
      testGame.status = "IN_PROGRESS";
      
      // リクエストユーザーを設定（ゲームオーナー）
      gameStore.setRequestUser(testUsers[0]);
      
      try {
        // 既に開始したゲームを再度開始しようとする
        await gameLogic.startGame(testGame.id);
        throw new Error("ゲーム状態チェックが正しく機能していません");
      } catch (error) {
        if (!(error instanceof GameError)) {
          throw error;
        }
        if (error.message !== "ゲームは既に開始されています") {
          throw new Error(`予期しないエラーメッセージ: ${error.message}`);
        }
      }
      
      // クリーンアップ
      gameStore.setRequestUser(null);
      
      // 環境変数を元に戻す
      if (originalTestMode) {
        Deno.env.set("TEST_MODE", originalTestMode);
      } else {
        Deno.env.delete("TEST_MODE");
      }
    } finally {
      await cleanupErrorHandlingTest();
    }
  },
});

// 存在しないゲームに関するエラーテスト
Deno.test({
  name: "エラーハンドリング - 存在しないゲームIDを指定した場合のエラー",
  fn: async () => {
    try {
      await setupErrorHandlingTest();
      
      // 存在しないゲームIDを指定
      const nonExistentGameId = "non-existent-game-id";
      
      // リクエストユーザーを設定（オーナー）
      gameStore.setRequestUser(testUsers[0]);
      
      try {
        // 存在しないゲームを開始しようとする
        await gameLogic.startGame(nonExistentGameId);
        throw new Error("存在しないゲームIDのチェックが正しく機能していません");
      } catch (error) {
        if (!(error instanceof GameError)) {
          throw error;
        }
        if (error.message !== "指定されたゲームが見つかりません") {
          throw new Error(`予期しないエラーメッセージ: ${error.message}`);
        }
      } finally {
        // クリーンアップ
        gameStore.setRequestUser(null);
      }
    } finally {
      await cleanupErrorHandlingTest();
    }
  },
});

// 役職権限に関するエラーテスト
Deno.test({
  name: "エラーハンドリング - 役職権限の確認テスト",
  fn: async () => {
    try {
      await setupErrorHandlingTest();
      
      // ゲームを開始状態に設定
      testGame.status = "IN_PROGRESS";
      testGame.currentPhase = "NIGHT";
      
      // 役職を割り当て（人狼1人、村人4人）
      assignTestRoles(testGame, {
        0: "WEREWOLF",
        1: "VILLAGER",
        2: "VILLAGER", 
        3: "VILLAGER", 
        4: "VILLAGER"
      });
      
      // 人狼と村人のプレイヤーを見つける
      const werewolfPlayer = testGame.players.find((p) => p.role === "WEREWOLF");
      const villagerPlayer = testGame.players.find((p) => p.role === "VILLAGER");
      
      if (!werewolfPlayer || !villagerPlayer) {
        throw new Error("プレイヤーの役職が正しく設定されていません");
      }
      
      const werewolfId = werewolfPlayer.playerId;
      const villagerId = villagerPlayer.playerId;
      
      // 元の役職を保存
      const originalRole = werewolfPlayer.role;
      
      // テスト用に人狼のユーザーの役職を一時的に村人に変更
      werewolfPlayer.role = "VILLAGER";
      
      // 直接返り値をチェック
      const result = await gameActions.handleAttackAction(testGame, werewolfId, villagerId);
      if (result.success || result.message !== "人狼以外は襲撃できません") {
        throw new Error(`予期しない結果: ${result.success}, ${result.message}`);
      }
      
      // 元に戻す
      werewolfPlayer.role = originalRole;
    } finally {
      await cleanupErrorHandlingTest();
    }
  },
});

// フェーズに関するエラーテスト
Deno.test({
  name: "エラーハンドリング - 不正なフェーズでのアクション実行テスト",
  fn: async () => {
    try {
      await setupErrorHandlingTest();
      
      // ゲームを昼フェーズに設定
      testGame.status = "IN_PROGRESS";
      testGame.currentPhase = "DAY_VOTE";
      
      // 役職を割り当て
      assignTestRoles(testGame, {
        0: "WEREWOLF",
        1: "SEER",
        2: "BODYGUARD",
        3: "VILLAGER",
        4: "VILLAGER"
      });
      
      // 人狼と村人のプレイヤーを見つける
      const werewolfPlayer = testGame.players.find((p) => p.role === "WEREWOLF");
      const villagerPlayer = testGame.players.find((p) => p.role === "VILLAGER");
      
      if (!werewolfPlayer || !villagerPlayer) {
        throw new Error("プレイヤーの役職が正しく設定されていません");
      }
      
      const werewolfId = werewolfPlayer.playerId;
      const villagerId = villagerPlayer.playerId;
      
      // 直接返り値をチェック
      const result = await gameActions.handleAttackAction(testGame, werewolfId, villagerId);
      if (result.success || result.message !== "夜フェーズではありません") {
        throw new Error(`予期しない結果: ${result.success}, ${result.message}`);
      }
    } finally {
      await cleanupErrorHandlingTest();
    }
  },
});