import { config } from "../config.ts";
import { ChatMessageRepository } from "./interfaces/chat-message-repository.ts";
import { GameRepository } from "./interfaces/game-repository.ts";
import { UserRepository } from "./interfaces/user-repository.ts";
import { MemoryChatMessageRepository } from "./memory/memory-chat-message-repository.ts";
import { MemoryGameRepository } from "./memory/memory-game-repository.ts";
import { MemoryUserRepository } from "./memory/memory-user-repository.ts";
import { runMigrations } from "./postgresql/pg-client.ts";
import { PostgresChatMessageRepository } from "./postgresql/postgres-chat-message-repository.ts";
import { PostgresGameRepository } from "./postgresql/postgres-game-repository.ts";
import { PostgresUserRepository } from "./postgresql/postgres-user-repository.ts";
import { logger } from "../utils/logger.ts";

/**
 * リポジトリコンテナ - 依存性注入（DI）パターンの実装
 * 設定に基づいて適切なリポジトリ実装を提供する
 */
class RepositoryContainer {
  private userRepository: UserRepository | null = null;
  private gameRepository: GameRepository | null = null;
  private chatMessageRepository: ChatMessageRepository | null = null;
  private initialized = false;

  /**
   * コンテナの初期化
   * アプリケーション起動時に一度だけ呼び出す
   */  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    logger.info(`リポジトリタイプ: ${config.database.type}`);
      // テスト実行時は常にメモリリポジトリを使用
    // テストモードの検出方法：
    // 1. 環境変数 TEST_MODE=true
    // 2. Deno.testが実行されている場合
    const isTestMode = 
      Deno.env.get("TEST_MODE") === "true" || 
      ("Deno" in globalThis && typeof Deno.test === "function") ||
      // テスト実行環境の追加検出
      globalThis.Deno?.permissions !== undefined;
      
    if (isTestMode) {
      logger.info("テストモードのためインメモリリポジトリを使用します");
      config.database.type = "memory";
    }
    else if (config.database.type === "postgresql") {
      try {
        logger.info("PostgreSQLマイグレーションを実行中...");
        await runMigrations();
        logger.info("PostgreSQLマイグレーションが完了しました");
      } catch (error) {
        logger.error("PostgreSQLマイグレーションに失敗しました", { error });
        // エラーが発生した場合はメモリリポジトリにフォールバック
        logger.warn("インメモリリポジトリにフォールバックします");
        config.database.type = "memory";
      }
    }

    this.initialized = true;
  }

  /**
   * ユーザーリポジトリの取得
   * @returns ユーザーリポジトリ
   */
  getUserRepository(): UserRepository {
    if (!this.userRepository) {
      this.userRepository = config.database.type === "postgresql"
        ? new PostgresUserRepository()
        : new MemoryUserRepository();
    }
    return this.userRepository;
  }

  /**
   * ゲームリポジトリの取得
   * @returns ゲームリポジトリ
   */
  getGameRepository(): GameRepository {
    if (!this.gameRepository) {
      this.gameRepository = config.database.type === "postgresql"
        ? new PostgresGameRepository()
        : new MemoryGameRepository();
    }
    return this.gameRepository;
  }

  /**
   * チャットメッセージリポジトリの取得
   * @returns チャットメッセージリポジトリ
   */
  getChatMessageRepository(): ChatMessageRepository {
    if (!this.chatMessageRepository) {
      this.chatMessageRepository = config.database.type === "postgresql"
        ? new PostgresChatMessageRepository()
        : new MemoryChatMessageRepository();
    }
    return this.chatMessageRepository;
  }

  /**
   * テスト用に全リポジトリをクリア
   */
  async clearAllRepositories(): Promise<void> {
    const userRepo = this.getUserRepository();
    const gameRepo = this.getGameRepository();
    const chatRepo = this.getChatMessageRepository();

    await userRepo.clear();
    await gameRepo.clear();
    await chatRepo.clear();
  }

  /**
   * すべてのリポジトリインスタンスをリセット
   * 主にテスト間での分離に使用
   */
  resetRepositories(): void {
    this.userRepository = null;
    this.gameRepository = null;
    this.chatMessageRepository = null;
  }

  /**
   * 特定のゲームのチャットメッセージを削除（テスト用）
   * @param gameId ゲームID
   */
  async deleteGameChatMessages(gameId: string): Promise<boolean> {
    const chatRepo = this.getChatMessageRepository();
    return await chatRepo.deleteByGame(gameId);
  }
  
  /**
   * テスト用のチャットメッセージリポジトリへの安全なアクセスメソッド
   */
  getChatRepository(): ChatMessageRepository {
    return this.getChatMessageRepository();
  }
}

// シングルトンインスタンスを作成
export const repositoryContainer = new RepositoryContainer();