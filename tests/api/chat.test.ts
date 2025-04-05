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

function cleanupTests() {
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
  name: "チャットAPI - サーバーセットアップ",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    await setupTests();
    await cleanupTests();
  },
});

Deno.test({
  name: "チャット - グローバルチャンネルでメッセージの送受信",
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
  name: "チャット - 人狼チャンネルのアクセス制御",
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

Deno.test({
  name: "チャット - 霊界チャンネルのアクセス制御",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    await setupTests();
    const { ownerAuth, werewolfAuth, seerAuth, bodyguardAuth, villagerAuth } = users;

    // ゲームの作成
    const createResponse = await apiRequest("POST", "/games", {
      name: "Spirit Chat Test Game",
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

    // ゲーム開始
    const startResponse = await apiRequest("POST", `/games/${gameId}/start`, undefined, ownerAuth.token);
    await consumeResponse(startResponse);

    // 一部のプレイヤーを死亡状態に設定
    const gameInstance = gameModel.getGameById(gameId)!;
    const deadPlayer = gameInstance.players.find((p) => p.playerId === seerAuth.user.id)!;
    const alivePlayer = gameInstance.players.find((p) => p.playerId === villagerAuth.user.id)!;
    
    deadPlayer.isAlive = false;
    deadPlayer.deathCause = "WEREWOLF_ATTACK";
    
    // 死亡プレイヤーからの霊界メッセージ送信（成功するはず）
    const deadPlayerSendResponse = await apiRequest("POST", `/chat/${gameId}/messages`, {
      channel: "SPIRIT",
      content: "Message from the afterlife",
    }, seerAuth.token);
    const deadPlayerSendResult = await consumeResponse<{ success: boolean }>(deadPlayerSendResponse);
    assertEquals(deadPlayerSendResult.success, true);

    // 生存プレイヤーからの霊界メッセージ送信（失敗するはず）
    const alivePlayerSendResponse = await apiRequest("POST", `/chat/${gameId}/messages`, {
      channel: "SPIRIT",
      content: "Try to send to spirit realm",
    }, villagerAuth.token);

    // エラー応答のステータスコードを検証（403 Forbiddenが返されることを期待）
    assertEquals(alivePlayerSendResponse.status, 403, "Expected error response with status 403");

    // 死亡プレイヤーのメッセージ取得（メッセージが見えるはず）
    const deadPlayerGetResponse = await apiRequest(
      "GET",
      `/chat/${gameId}/messages/SPIRIT`,
      undefined,
      seerAuth.token,
    );
    const deadPlayerGetResult = await consumeResponse<{ messages: ChatMessage[] }>(deadPlayerGetResponse);
    assertEquals(deadPlayerGetResult.messages.length, 1);
    assertEquals(deadPlayerGetResult.messages[0].content, "Message from the afterlife");

    // 生存プレイヤーのメッセージ取得（空配列が返るはず）
    const alivePlayerGetResponse = await apiRequest(
      "GET",
      `/chat/${gameId}/messages/SPIRIT`,
      undefined,
      villagerAuth.token,
    );
    const alivePlayerGetResult = await consumeResponse<{ messages: ChatMessage[] }>(alivePlayerGetResponse);
    assertEquals(alivePlayerGetResult.messages.length, 0);

    await cleanupTests();
  },
});

Deno.test({
  name: "チャット - 複数の死亡プレイヤーの霊界チャットでの会話",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    await setupTests();
    const { ownerAuth, werewolfAuth, seerAuth, bodyguardAuth, villagerAuth } = users;

    // ゲームの作成 - リクエストボディを明示的に変数に格納
    const gameData = {
      name: "Multiple Dead Test Game", // 短くシンプルな名前に変更
      maxPlayers: 5,
    };
    console.log("ゲーム作成リクエスト:", gameData); // デバッグ用ログ追加

    const createResponse = await apiRequest("POST", "/games", gameData, ownerAuth.token);
    const game = await consumeResponse<{ id: string }>(createResponse);
    gameId = game.id;

    // 全プレイヤーの参加
    const players = [werewolfAuth, seerAuth, bodyguardAuth, villagerAuth];
    for (const player of players) {
      const joinResponse = await apiRequest("POST", `/games/${gameId}/join`, undefined, player.token);
      await consumeResponse(joinResponse);
    }

    // ゲーム開始
    const startResponse = await apiRequest("POST", `/games/${gameId}/start`, undefined, ownerAuth.token);
    await consumeResponse(startResponse);

    // 複数のプレイヤーを死亡状態に設定
    const gameInstance = gameModel.getGameById(gameId)!;
    const deadPlayer1 = gameInstance.players.find((p) => p.playerId === seerAuth.user.id)!;
    const deadPlayer2 = gameInstance.players.find((p) => p.playerId === bodyguardAuth.user.id)!;
    
    deadPlayer1.isAlive = false;
    deadPlayer1.deathCause = "WEREWOLF_ATTACK";
    
    deadPlayer2.isAlive = false;
    deadPlayer2.deathCause = "EXECUTION";
    
    // 1人目の死亡プレイヤーが霊界チャットにメッセージを送信
    const deadPlayer1SendResponse = await apiRequest("POST", `/chat/${gameId}/messages`, {
      channel: "SPIRIT",
      content: "Hello from the other side",
    }, seerAuth.token);
    await consumeResponse<{ success: boolean }>(deadPlayer1SendResponse);

    // 2人目の死亡プレイヤーが霊界チャットにメッセージを送信
    const deadPlayer2SendResponse = await apiRequest("POST", `/chat/${gameId}/messages`, {
      channel: "SPIRIT",
      content: "I can hear you!",
    }, bodyguardAuth.token);
    await consumeResponse<{ success: boolean }>(deadPlayer2SendResponse);

    // 1人目の死亡プレイヤーがメッセージを取得（両方のメッセージが見えるはず）
    const deadPlayer1GetResponse = await apiRequest(
      "GET",
      `/chat/${gameId}/messages/SPIRIT`,
      undefined,
      seerAuth.token,
    );
    const deadPlayer1GetResult = await consumeResponse<{ messages: ChatMessage[] }>(deadPlayer1GetResponse);
    assertEquals(deadPlayer1GetResult.messages.length, 2);
    assertEquals(deadPlayer1GetResult.messages[0].content, "Hello from the other side");
    assertEquals(deadPlayer1GetResult.messages[1].content, "I can hear you!");

    // 2人目の死亡プレイヤーがメッセージを取得（両方のメッセージが見えるはず）
    const deadPlayer2GetResponse = await apiRequest(
      "GET",
      `/chat/${gameId}/messages/SPIRIT`,
      undefined,
      bodyguardAuth.token,
    );
    const deadPlayer2GetResult = await consumeResponse<{ messages: ChatMessage[] }>(deadPlayer2GetResponse);
    assertEquals(deadPlayer2GetResult.messages.length, 2);
    assertEquals(deadPlayer2GetResult.messages[0].content, "Hello from the other side");
    assertEquals(deadPlayer2GetResult.messages[1].content, "I can hear you!");

    await cleanupTests();
  },
});

Deno.test({
  name: "チャット - 死亡プレイヤーの霊界チャットと全体チャットへのアクセス",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    await setupTests();
    const { ownerAuth, werewolfAuth, seerAuth, bodyguardAuth, villagerAuth } = users;

    // ゲームの作成
    const createResponse = await apiRequest("POST", "/games", {
      name: "Dead Player Access Test",
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

    // ゲーム開始
    const startResponse = await apiRequest("POST", `/games/${gameId}/start`, undefined, ownerAuth.token);
    await consumeResponse(startResponse);

    // プレイヤーが生きている間に全体チャットにメッセージを送信
    const aliveGlobalSendResponse = await apiRequest("POST", `/chat/${gameId}/messages`, {
      channel: "GLOBAL",
      content: "I'm still alive",
    }, seerAuth.token);
    await consumeResponse<{ success: boolean }>(aliveGlobalSendResponse);

    // プレイヤーを死亡状態に設定
    const gameInstance = gameModel.getGameById(gameId)!;
    const deadPlayer = gameInstance.players.find((p) => p.playerId === seerAuth.user.id)!;
    deadPlayer.isAlive = false;
    deadPlayer.deathCause = "WEREWOLF_ATTACK";
    
    // 死亡プレイヤーが全体チャットにメッセージを送信しようとする（失敗するはず）
    const deadGlobalSendResponse = await apiRequest("POST", `/chat/${gameId}/messages`, {
      channel: "GLOBAL",
      content: "Can you hear me?",
    }, seerAuth.token);
    
    // エラー応答のステータスコードを検証
    assertEquals(deadGlobalSendResponse.status, 403, "Expected error response with status 403");

    // 死亡プレイヤーが霊界チャットにメッセージを送信（成功するはず）
    const deadSpiritSendResponse = await apiRequest("POST", `/chat/${gameId}/messages`, {
      channel: "SPIRIT",
      content: "Hello from spirit realm",
    }, seerAuth.token);
    const deadSpiritSendResult = await consumeResponse<{ success: boolean }>(deadSpiritSendResponse);
    assertEquals(deadSpiritSendResult.success, true);

    // 死亡プレイヤーは全体チャットのメッセージを読むことができる（過去のメッセージが見えるはず）
    const deadGlobalGetResponse = await apiRequest(
      "GET",
      `/chat/${gameId}/messages/GLOBAL`,
      undefined,
      seerAuth.token,
    );
    const deadGlobalGetResult = await consumeResponse<{ messages: ChatMessage[] }>(deadGlobalGetResponse);
    assertEquals(deadGlobalGetResult.messages.length, 1);
    assertEquals(deadGlobalGetResult.messages[0].content, "I'm still alive");

    await cleanupTests();
  },
});
