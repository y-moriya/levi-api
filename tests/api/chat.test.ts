import { assertEquals } from "https://deno.land/std@0.210.0/assert/mod.ts";
import { apiRequest, consumeResponse, createAuthenticatedUser, testServer } from "../helpers/api.ts";
import { UserResponse } from "../helpers/types.ts";
import app from "../../main.ts";
import * as gameModel from "../../models/game.ts";
import * as authService from "../../services/auth.ts";
import * as gamePhase from "../../services/game-phase.ts";
import { ChatMessage } from "../../types/chat.ts";

interface ChatError {
  code: string;
  message: string;
}

interface TestUsers {
  ownerAuth: { token: string; user: UserResponse };
  werewolfAuth: { token: string; user: UserResponse };
  seerAuth: { token: string; user: UserResponse };
  bodyguardAuth: { token: string; user: UserResponse };
  villagerAuth: { token: string; user: UserResponse };
}

let gameId: string;
let users: TestUsers;

// サーバー状態を追跡
let isServerRunning = false;

// セットアップとクリーンアップ
async function setupTests() {
  // Reset stores
  gameModel.resetGames();
  authService.resetStore();
  gamePhase.clearAllTimers();

  try {
    // サーバーが実行中でない場合のみ起動
    if (!isServerRunning) {
      await testServer.start(app);
      isServerRunning = true;
    }

    // Create test users in parallel
    const [ownerAuth, werewolfAuth, seerAuth, bodyguardAuth, villagerAuth] = await Promise.all([
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
    ]);

    users = { ownerAuth, werewolfAuth, seerAuth, bodyguardAuth, villagerAuth };
  } catch (error) {
    console.error("Failed to setup tests:", error);
    throw error;
  }
}

async function cleanupTests() {
  try {
    // Clean up games and timers
    const games = gameModel.getAllGames();
    for (const game of games) {
      gamePhase.clearPhaseTimer(game.id);
    }
    
    // リセットするだけで、サーバーは停止しない
    gameModel.resetGames();
    authService.resetStore();
  } catch (error) {
    console.error("Failed to cleanup tests:", error);
    throw error;
  }
}

// チャットAPIのテスト
Deno.test({
  name: "Chat API - Server Setup",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    await setupTests();
    await cleanupTests();
  },
});

Deno.test({
  name: "Chat - Send and receive messages in global channel",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    await setupTests();
    const { ownerAuth, werewolfAuth, seerAuth, bodyguardAuth, villagerAuth } = users;

    // ゲームの作成
    const createResponse = await apiRequest("POST", "/games", {
      name: "Chat Test Game",
      maxPlayers: 5,
    }, ownerAuth.token);
    const game = await consumeResponse<{ id: string }>(createResponse);
    gameId = game.id;

    // プレイヤーの参加（必要な人数を確保）
    const players = [werewolfAuth, seerAuth, bodyguardAuth, villagerAuth];
    for (const player of players) {
      const joinResponse = await apiRequest("POST", `/games/${gameId}/join`, undefined, player.token);
      await consumeResponse(joinResponse);
    }

    // ゲーム開始
    const startResponse = await apiRequest("POST", `/games/${gameId}/start`, undefined, ownerAuth.token);
    await consumeResponse(startResponse);

    // メッセージの送信
    const sendResponse = await apiRequest("POST", `/chat/${gameId}/messages`, {
      channel: "GLOBAL",
      content: "Hello, world!",
    }, ownerAuth.token);
    const sendResult = await consumeResponse<{ success: boolean }>(sendResponse);
    assertEquals(sendResult.success, true);

    // メッセージの取得
    const getResponse = await apiRequest("GET", `/chat/${gameId}/messages/GLOBAL`, undefined, ownerAuth.token);
    const getResult = await consumeResponse<{ messages: ChatMessage[] }>(getResponse);
    assertEquals(getResult.messages.length, 1);
    assertEquals(getResult.messages[0].content, "Hello, world!");
    assertEquals(getResult.messages[0].channel, "GLOBAL");

    await cleanupTests();
  },
});

Deno.test({
  name: "Chat - Werewolf channel access control",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    await setupTests();
    const { ownerAuth, werewolfAuth, seerAuth, bodyguardAuth, villagerAuth } = users;

    // ゲームの作成
    const createResponse = await apiRequest("POST", "/games", {
      name: "Chat Test Game",
      maxPlayers: 5,
    }, ownerAuth.token);
    const game = await consumeResponse<{ id: string }>(createResponse);
    gameId = game.id;

    // 全プレイヤーの参加
    const players = [werewolfAuth, seerAuth, bodyguardAuth, villagerAuth];
    for (const player of players) {
      const joinResponse = await apiRequest("POST", `/games/${gameId}/join`, undefined, player.token);
      await consumeResponse(joinResponse);
    }

    // ゲーム開始と役職の設定
    const startResponse = await apiRequest("POST", `/games/${gameId}/start`, undefined, ownerAuth.token);
    await consumeResponse(startResponse);

    const gameInstance = gameModel.getGameById(gameId)!;
    gameInstance.players.find((p) => p.playerId === werewolfAuth.user.id)!.role = "WEREWOLF";
    gameInstance.players.find((p) => p.playerId === villagerAuth.user.id)!.role = "VILLAGER";

    // 人狼からのメッセージ送信（成功するはず）
    const werewolfSendResponse = await apiRequest("POST", `/chat/${gameId}/messages`, {
      channel: "WEREWOLF",
      content: "Secret message",
    }, werewolfAuth.token);
    const werewolfSendResult = await consumeResponse<{ success: boolean }>(werewolfSendResponse);
    assertEquals(werewolfSendResult.success, true);

    // 村人からのメッセージ送信（失敗するはず）
    const villagerSendResponse = await apiRequest("POST", `/chat/${gameId}/messages`, {
      channel: "WEREWOLF",
      content: "Try to send secret",
    }, villagerAuth.token);
    
    // エラー応答のステータスコードを検証（403 Forbiddenが返されることを期待）
    assertEquals(villagerSendResponse.status, 403, "Expected error response with status 403");
    
    // テストコードではエラーの内容までは検証しない
    // エラーメッセージの内容が「アクセス権がない」旨を示していれば良い
    
    // 村人のメッセージ取得（空配列が返るはず）
    const villagerGetResponse = await apiRequest(
      "GET",
      `/chat/${gameId}/messages/WEREWOLF`,
      undefined,
      villagerAuth.token,
    );
    const villagerGetResult = await consumeResponse<{ messages: ChatMessage[] }>(villagerGetResponse);
    assertEquals(villagerGetResult.messages.length, 0);

    // 人狼のメッセージ取得（メッセージが見えるはず）
    const werewolfGetResponse = await apiRequest(
      "GET",
      `/chat/${gameId}/messages/WEREWOLF`,
      undefined,
      werewolfAuth.token,
    );
    const werewolfGetResult = await consumeResponse<{ messages: ChatMessage[] }>(werewolfGetResponse);
    assertEquals(werewolfGetResult.messages.length, 1);
    assertEquals(werewolfGetResult.messages[0].content, "Secret message");

    await cleanupTests();
  },
});
