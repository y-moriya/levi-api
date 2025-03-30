import { assertEquals } from "https://deno.land/std@0.210.0/assert/mod.ts";
import { apiRequest, consumeResponse } from "../helpers/api.ts";
import { AuthenticatedUser, setupScenarioTest, cleanupScenarioTest } from "./game-scenario-common.ts";
import { ChatMessage, ChatError } from "../../types/chat.ts";
import * as gameModel from "../../models/game.ts";
import * as chatService from "../../services/chat.ts";

let users: {
  ownerAuth: AuthenticatedUser;
  werewolfAuth: AuthenticatedUser;
  seerAuth: AuthenticatedUser;
  bodyguardAuth: AuthenticatedUser;
  villagerAuth: AuthenticatedUser;
};
let gameId: string;

// チャット機能のテスト
Deno.test({
  name: "Chat - Send and receive messages in global channel",
  async fn() {
    users = await setupScenarioTest();
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

    await cleanupScenarioTest();
  },
});

Deno.test({
  name: "Chat - Werewolf channel access control",
  async fn() {
    users = await setupScenarioTest();
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
    assertEquals(villagerSendResponse.status, 403);

    let villagerSendError;
    try {
      await consumeResponse(villagerSendResponse);
    } catch (error) {
      villagerSendError = error;
    }
    assertEquals((villagerSendError as Error & { response: ChatError }).response.code, "CHANNEL_ACCESS_DENIED");

    // 村人のメッセージ取得（空配列が返るはず）
    const villagerGetResponse = await apiRequest("GET", `/chat/${gameId}/messages/WEREWOLF`, undefined, villagerAuth.token);
    const villagerGetResult = await consumeResponse<{ messages: ChatMessage[] }>(villagerGetResponse);
    assertEquals(villagerGetResult.messages.length, 0);

    // 人狼のメッセージ取得（メッセージが見えるはず）
    const werewolfGetResponse = await apiRequest("GET", `/chat/${gameId}/messages/WEREWOLF`, undefined, werewolfAuth.token);
    const werewolfGetResult = await consumeResponse<{ messages: ChatMessage[] }>(werewolfGetResponse);
    assertEquals(werewolfGetResult.messages.length, 1);
    assertEquals(werewolfGetResult.messages[0].content, "Secret message");

    await cleanupScenarioTest();
  },
});