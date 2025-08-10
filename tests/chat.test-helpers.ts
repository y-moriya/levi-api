import * as chatService from "../services/chat.ts";
import * as gameModel from "../models/game.ts";
import * as authService from "../services/auth.ts";
import { Game } from "../types/game.ts";
import { User } from "../types/user.ts";
import { setupTest } from "./helpers/test-helpers.ts";

export type ChatTestContext = {
  game: Game;
  users: User[];
};

// サービス層チャットテストの共通セットアップ
export async function setupChatTest(): Promise<ChatTestContext> {
  await setupTest();

  const users = await Promise.all([
    authService.register({ username: "owner", email: `owner${Date.now()}@test.com`, password: "password123" }),
    authService.register({ username: "player2", email: `player2_${Date.now()}@test.com`, password: "password123" }),
    authService.register({ username: "player3", email: `player3_${Date.now()}@test.com`, password: "password123" }),
    authService.register({ username: "player4", email: `player4_${Date.now()}@test.com`, password: "password123" }),
    authService.register({ username: "player5", email: `player5_${Date.now()}@test.com`, password: "password123" }),
  ]);

  // チャットメッセージをリセット
  chatService.resetMessages();

  // ゲーム作成と参加
  const game = await gameModel.createGame({ name: "チャット単体テスト", maxPlayers: 5 }, users[0].id);
  for (let i = 1; i < users.length; i++) {
    await gameModel.joinGame(game.id, users[i].id);
  }

  // ゲーム状態と役職の初期化
  game.status = "IN_PROGRESS";
  game.currentDay = 1;
  game.currentPhase = "DAY_DISCUSSION";
  game.players[0].role = "VILLAGER";   // owner
  game.players[1].role = "WEREWOLF";   // player2
  game.players[2].role = "SEER";       // player3
  game.players[3].role = "BODYGUARD";  // player4
  game.players[4].role = "VILLAGER";   // player5

  return { game, users };
}
