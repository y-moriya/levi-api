import { testServer } from "../helpers/api.ts";
import app from "../../main.ts";
import * as authService from "../../services/auth.ts";
import * as gameModel from "../../models/game.ts";
import { repositoryContainer } from "../../repositories/repository-container.ts";

let isServerRunning = false;

export async function setupTests() {
  authService.resetStore();
  gameModel.resetGames();
  try {
    if (!isServerRunning) {
      await testServer.start(app);
      isServerRunning = true;
    }
  } catch (error) {
    console.error("テストサーバーの起動に失敗しました:", error);
    throw error;
  }
}

export async function cleanupTests() {
  try {
    // サーバーは停止せず、再利用する
    authService.resetStore();
    gameModel.resetGames();

    // チャットリポジトリをクリア
    const chatRepo = repositoryContainer.getChatMessageRepository();
    await chatRepo.clear();
  } catch (error) {
    console.error("テストのクリーンアップ中にエラーが発生しました:", error);
    throw error;
  }
}
