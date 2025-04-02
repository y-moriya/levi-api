// filepath: c:\Users\wellk\project\levi-api\tests\chat.test.ts
import { assertEquals } from "https://deno.land/std@0.210.0/assert/mod.ts";
import * as chatService from "../services/chat.ts";
import * as gameModel from "../models/game.ts";
import * as authService from "../services/auth.ts";
import { setupTest, cleanupTest, withQuietLogs } from "./helpers/test-helpers.ts";
import { ChatChannel } from "../types/chat.ts";
import { Game } from "../types/game.ts";
import { User } from "../types/user.ts";
import { GameError } from "../types/error.ts";

let testGame: Game;
let testUsers: User[];

/**
 * チャット機能のテスト用セットアップ
 */
async function setupChatTest() {
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

  // チャットメッセージをリセット
  chatService.resetMessages();

  // テストゲームの作成
  testGame = await gameModel.createGame({
    name: "テスト用チャットゲーム",
    maxPlayers: 5,
  }, testUsers[0].id);

  // プレイヤーをゲームに追加
  for (let i = 1; i < testUsers.length; i++) {
    await gameModel.joinGame(testGame.id, testUsers[i].id);
  }

  // ゲームを開始状態に設定
  testGame.status = "IN_PROGRESS";
  testGame.currentDay = 1;
  testGame.currentPhase = "DAY_DISCUSSION";
  
  // 役職の割り当て
  testGame.players[0].role = "VILLAGER";
  testGame.players[1].role = "WEREWOLF";
  testGame.players[2].role = "SEER";
  testGame.players[3].role = "BODYGUARD";
  testGame.players[4].role = "VILLAGER";
}

// チャットメッセージ送信のテスト
Deno.test({
  name: "sendMessage - 適切なチャンネルにメッセージを送信できる",
  fn: withQuietLogs(async () => {
    await setupChatTest();
    
    // 全体チャットへのメッセージ送信テスト
    const generalMessage = await chatService.sendMessage(
      testGame.id,
      testUsers[0].id,
      "全体チャットへのテストメッセージ",
      "GLOBAL",
      "テストユーザー",
      testGame,
      true  // テストモードフラグをtrueに設定
    );
    assertEquals(generalMessage.channel, "GLOBAL");
    assertEquals(generalMessage.content, "全体チャットへのテストメッセージ");
    assertEquals(generalMessage.senderId, testUsers[0].id);
    
    // チャットメッセージの取得テスト
    const generalMessages = await chatService.getMessages(
      testGame.id, 
      "GLOBAL",
      undefined, 
      testGame, 
      true  // テストモードフラグをtrueに設定
    );
    assertEquals(generalMessages.length, 1);
    assertEquals(generalMessages[0].content, "全体チャットへのテストメッセージ");
    
    cleanupTest();
  })
});

Deno.test({
  name: "sendMessage - 人狼は人狼チャンネルにメッセージを送信できる",
  fn: withQuietLogs(async () => {
    await setupChatTest();
    
    // 人狼チャットへのメッセージ送信テスト
    const werewolfMessage = await chatService.sendMessage(
      testGame.id,
      testUsers[1].id, // 人狼プレイヤー
      "人狼チャットへのテストメッセージ",
      "WEREWOLF",
      "テストユーザー",
      testGame,
      true  // テストモードフラグをtrueに設定
    );
    assertEquals(werewolfMessage.channel, "WEREWOLF");
    assertEquals(werewolfMessage.content, "人狼チャットへのテストメッセージ");
    assertEquals(werewolfMessage.senderId, testUsers[1].id);
    
    // 人狼チャットメッセージの取得テスト
    const werewolfMessages = await chatService.getMessages(
      testGame.id, 
      "WEREWOLF", 
      testUsers[1].id, 
      testGame, 
      true  // テストモードフラグをtrueに設定
    );
    assertEquals(werewolfMessages.length, 1);
    assertEquals(werewolfMessages[0].content, "人狼チャットへのテストメッセージ");
    
    cleanupTest();
  })
});

Deno.test({
  name: "sendMessage - 非人狼プレイヤーは人狼チャンネルにメッセージを送信できない",
  fn: withQuietLogs(async () => {
    await setupChatTest();
    
    try {
      // 村人が人狼チャットにメッセージを送信しようとするとエラー
      await chatService.sendMessage(
        testGame.id,
        testUsers[0].id, // 村人プレイヤー
        "不正なメッセージ",
        "WEREWOLF",
        "テストユーザー",
        testGame,
        false  // 権限チェックを有効にするためfalseに設定
      );
      throw new Error("エラーが発生しませんでした");
    } catch (error) {
      if (error instanceof GameError) {
        assertEquals(error.message, "人狼チャンネルには人狼のみがアクセスできます");
      } else {
        throw error; // GameError以外のエラーは再スロー
      }
    }
    
    cleanupTest();
  })
});

// チャットメッセージ取得のテスト
Deno.test({
  name: "getMessages - 全体チャットのメッセージを取得できる",
  fn: withQuietLogs(async () => {
    await setupChatTest();
    
    // 複数のメッセージを送信
    await chatService.sendMessage(testGame.id, testUsers[0].id, "メッセージ1", "GLOBAL", "テストユーザー", testGame, true);
    await chatService.sendMessage(testGame.id, testUsers[1].id, "メッセージ2", "GLOBAL", "テストユーザー", testGame, true);
    await chatService.sendMessage(testGame.id, testUsers[2].id, "メッセージ3", "GLOBAL", "テストユーザー", testGame, true);
    
    // メッセージの取得
    const messages = await chatService.getMessages(testGame.id, "GLOBAL", undefined, testGame, true);
    
    assertEquals(messages.length, 3);
    assertEquals(messages[0].content, "メッセージ1");
    assertEquals(messages[1].content, "メッセージ2");
    assertEquals(messages[2].content, "メッセージ3");
    
    cleanupTest();
  })
});

Deno.test({
  name: "getMessages - 人狼プレイヤーのみが人狼チャットのメッセージを取得できる",
  fn: withQuietLogs(async () => {
    await setupChatTest();
    
    // 人狼チャットにメッセージを送信
    await chatService.sendMessage(testGame.id, testUsers[1].id, "人狼のメッセージ", "WEREWOLF", "テストユーザー", testGame, true);
    
    // 人狼プレイヤーは人狼チャットを取得できる
    const werewolfMessages = await chatService.getMessages(testGame.id, "WEREWOLF", testUsers[1].id, testGame, true);
    assertEquals(werewolfMessages.length, 1);
    assertEquals(werewolfMessages[0].content, "人狼のメッセージ");
    
    // 村人プレイヤーは人狼チャットを取得できない
    try {
      await chatService.getMessages(testGame.id, "WEREWOLF", testUsers[0].id, testGame, false);
      throw new Error("エラーが発生しませんでした");
    } catch (error) {
      if (error instanceof GameError) {
        assertEquals(error.message, "人狼チャンネルには人狼のみがアクセスできます");
      } else {
        throw error; // GameError以外のエラーは再スロー
      }
    }
    
    cleanupTest();
  })
});

// 境界ケーステスト
Deno.test({
  name: "sendMessage - 存在しないゲームIDでメッセージを送信するとエラー",
  fn: withQuietLogs(async () => {
    await setupTest();
    
    try {
      await chatService.sendMessage(
        "non_existent_game_id",
        "user_id",
        "テストメッセージ",
        "GLOBAL"
      );
      throw new Error("エラーが発生しませんでした");
    } catch (error) {
      if (error instanceof GameError) {
        assertEquals(error.message, "指定されたゲームが見つかりません");
      } else {
        throw error;
      }
    }
    
    cleanupTest();
  })
});

Deno.test({
  name: "sendMessage - 存在しないチャンネルにメッセージを送信するとエラー",
  fn: withQuietLogs(async () => {
    await setupChatTest();
    
    try {
      await chatService.sendMessage(
        testGame.id,
        testUsers[0].id,
        "テストメッセージ",
        "INVALID_CHANNEL" as ChatChannel,
        "テストユーザー",
        testGame,
        false // テストモードをオフにしてエラーチェックを有効にする
      );
      throw new Error("エラーが発生しませんでした");
    } catch (error) {
      if (error instanceof GameError) {
        // 「無効なチャンネル」という文字列が含まれているかをチェック
        if (!error.message.includes("無効なチャンネル")) {
          throw new Error(`予期しないエラーメッセージ: ${error.message}`);
        }
      } else {
        throw error;
      }
    }
    
    cleanupTest();
  })
});

Deno.test({
  name: "sendMessage - 空のメッセージを送信するとエラー",
  fn: withQuietLogs(async () => {
    await setupChatTest();
    
    try {
      await chatService.sendMessage(
        testGame.id,
        testUsers[0].id,
        "",
        "GLOBAL"
      );
      throw new Error("エラーが発生しませんでした");
    } catch (error) {
      if (error instanceof GameError) {
        assertEquals(error.message, "メッセージは空にできません");
      } else {
        throw error;
      }
    }
    
    cleanupTest();
  })
});

Deno.test({
  name: "getMessages - 存在しないゲームIDでメッセージを取得するとエラー",
  fn: withQuietLogs(async () => {
    await setupTest();
    
    try {
      await chatService.getMessages("non_existent_game_id", "GLOBAL");
      throw new Error("エラーが発生しませんでした");
    } catch (error) {
      if (error instanceof GameError) {
        assertEquals(error.message, "指定されたゲームが見つかりません");
      } else {
        throw error;
      }
    }
    
    cleanupTest();
  })
});

// ゲーム進行状態に応じたチャット制限のテスト
Deno.test({
  name: "sendMessage - 死亡したプレイヤーは昼間のメッセージを送信できない",
  fn: withQuietLogs(async () => {
    await setupChatTest();
    
    // プレイヤーを死亡状態に設定
    testGame.players[2].isAlive = false;
    
    // 死亡したプレイヤーが昼間のメッセージを送信しようとするとエラー
    try {
      await chatService.sendMessage(
        testGame.id,
        testUsers[2].id,
        "死亡プレイヤーからのメッセージ",
        "GLOBAL",
        "テストユーザー",
        testGame,
        false // 権限チェックを有効にするためfalseに設定
      );
      throw new Error("エラーが発生しませんでした");
    } catch (error) {
      if (error instanceof GameError) {
        assertEquals(true, error.message.includes("死亡したプレイヤーは昼間"));
      } else {
        throw error;
      }
    }
    
    cleanupTest();
  })
});

Deno.test({
  name: "sendMessage - 夜フェーズ中は生存プレイヤーも全体チャットにメッセージを送信できない",
  fn: withQuietLogs(async () => {
    await setupChatTest();
    
    // ゲームを夜フェーズに設定
    testGame.currentPhase = "NIGHT";
    
    // 生存プレイヤーが夜間に全体チャットにメッセージを送信しようとするとエラー
    try {
      await chatService.sendMessage(
        testGame.id,
        testUsers[0].id,
        "夜間のメッセージ",
        "GLOBAL",
        "テストユーザー",
        testGame,
        false // 権限チェックを有効にするためfalseに設定
      );
      throw new Error("エラーが発生しませんでした");
    } catch (error) {
      if (error instanceof GameError) {
        assertEquals(true, error.message.includes("夜間は全体チャット"));
      } else {
        throw error;
      }
    }
    
    cleanupTest();
  })
});

Deno.test({
  name: "sendMessage - 人狼プレイヤーは夜フェーズ中も人狼チャットにメッセージを送信できる",
  fn: withQuietLogs(async () => {
    await setupChatTest();
    
    // ゲームを夜フェーズに設定
    testGame.currentPhase = "NIGHT";
    
    // 人狼プレイヤーが夜間に人狼チャットにメッセージを送信
    const message = await chatService.sendMessage(
      testGame.id,
      testUsers[1].id, // 人狼プレイヤー
      "夜間の人狼メッセージ",
      "WEREWOLF",
      "テストユーザー",
      testGame,
      true // テストモードをtrueに設定
    );
    
    assertEquals(message.channel, "WEREWOLF");
    assertEquals(message.content, "夜間の人狼メッセージ");
    
    cleanupTest();
  })
});