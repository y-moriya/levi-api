import { testServer } from "../helpers/api.ts";
import app from "../../main.ts";
import * as authService from "../../services/auth.ts";
import * as gameModel from "../../models/game.ts";
import * as gamePhase from "../../services/game-phase.ts";
import { repositoryContainer } from "../../repositories/repository-container.ts";
import { logger } from "../../utils/logger.ts";

let isServerRunning = false;

export async function setupTests() {
  // まずメモリ状態のリセット
  await authService.resetStore();
  await gameModel.resetGames();
  await gamePhase.clearAllTimers();

  // 毎テストでDBも必ず初期化・クリア
  await repositoryContainer.initialize();
  await repositoryContainer.clearAllRepositories();

  try {
    if (!isServerRunning) {
      await testServer.start(app);
      isServerRunning = true;
    }
  } catch (error) {
    logger.error("テストサーバーの起動に失敗しました:", error instanceof Error ? error : { error: String(error) });
    throw error;
  }
}

export async function cleanupTests() {
  try {
    // サーバーは停止せず、再利用する
    await authService.resetStore();
    await gameModel.resetGames();
    await gamePhase.clearAllTimers();

    // チャットリポジトリをクリア
    const chatRepo = repositoryContainer.getChatMessageRepository();
    await chatRepo.clear();
  } catch (error) {
    logger.error("テストのクリーンアップ中にエラーが発生しました:", error instanceof Error ? error : { error: String(error) });
    throw error;
  }
}
