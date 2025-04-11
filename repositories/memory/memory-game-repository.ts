import { Game } from "../../types/game.ts";
import { GameRepository } from "../interfaces/game-repository.ts";
import { logger } from "../../utils/logger.ts";

/**
 * ゲームリポジトリのインメモリ実装
 */
export class MemoryGameRepository implements GameRepository {
  private games: Map<string, Game> = new Map();
  private gamesByStatus: Map<string, Set<string>> = new Map();
  private playerGameMap: Map<string, Set<string>> = new Map();

  constructor() {
    // ゲームステータスの種類ごとにセットを初期化
    this.gamesByStatus.set("WAITING", new Set());
    this.gamesByStatus.set("IN_PROGRESS", new Set());
    this.gamesByStatus.set("FINISHED", new Set());
  }

  async add(game: Game): Promise<Game> {
    this.games.set(game.id, game);

    // ステータスごとのインデックスを更新
    const statusSet = this.gamesByStatus.get(game.status);
    if (statusSet) {
      statusSet.add(game.id);
    }

    // プレイヤーとゲームの関連を追跡
    game.players.forEach((player) => {
      if (!this.playerGameMap.has(player.playerId)) {
        this.playerGameMap.set(player.playerId, new Set());
      }
      this.playerGameMap.get(player.playerId)?.add(game.id);
    });

    logger.info("Game added to repository", {
      gameId: game.id,
      status: game.status,
      playerCount: game.players.length,
    });

    return game;
  }

  async update(id: string, game: Game): Promise<Game | null> {
    const oldGame = this.games.get(id);
    if (!oldGame) {
      return null;
    }

    // ステータスが変更された場合、インデックスを更新
    if (oldGame.status !== game.status) {
      const oldStatusSet = this.gamesByStatus.get(oldGame.status);
      const newStatusSet = this.gamesByStatus.get(game.status);

      if (oldStatusSet) {
        oldStatusSet.delete(game.id);
      }

      if (newStatusSet) {
        newStatusSet.add(game.id);
      }
    }

    // プレイヤーが変更された場合、関連を更新
    const oldPlayerIds = new Set(oldGame.players.map((p) => p.playerId));
    const newPlayerIds = new Set(game.players.map((p) => p.playerId));

    // 削除されたプレイヤーの関連を更新
    oldPlayerIds.forEach((playerId) => {
      if (!newPlayerIds.has(playerId)) {
        const playerGames = this.playerGameMap.get(playerId);
        if (playerGames) {
          playerGames.delete(game.id);
          if (playerGames.size === 0) {
            this.playerGameMap.delete(playerId);
          }
        }
      }
    });

    // 追加されたプレイヤーの関連を追加
    newPlayerIds.forEach((playerId) => {
      if (!oldPlayerIds.has(playerId)) {
        if (!this.playerGameMap.has(playerId)) {
          this.playerGameMap.set(playerId, new Set());
        }
        this.playerGameMap.get(playerId)?.add(game.id);
      }
    });

    // ゲームオブジェクトを更新
    this.games.set(game.id, game);
    return game;
  }
  async findById(id: string): Promise<Game | null | undefined> {
    return this.games.get(id);
  }

  async delete(id: string): Promise<boolean> {
    const game = this.games.get(id);
    if (!game) return false;

    // ステータスインデックスから削除
    const statusSet = this.gamesByStatus.get(game.status);
    if (statusSet) {
      statusSet.delete(id);
    }

    // プレイヤーとの関連を削除
    game.players.forEach((player) => {
      const playerGames = this.playerGameMap.get(player.playerId);
      if (playerGames) {
        playerGames.delete(id);
        if (playerGames.size === 0) {
          this.playerGameMap.delete(player.playerId);
        }
      }
    });

    // ゲームを削除
    this.games.delete(id);

    logger.info("Game deleted from repository", { gameId: id });
    return true;
  }

  async findAll(): Promise<Game[]> {
    return Array.from(this.games.values());
  }

  async findByStatus(status: string): Promise<Game[]> {
    const gameIds = this.gamesByStatus.get(status);
    if (!gameIds) return [];

    return Array.from(gameIds)
      .map((id) => this.games.get(id))
      .filter((game): game is Game => game !== undefined);
  }

  async findByPlayerId(playerId: string): Promise<Game[]> {
    const gameIds = this.playerGameMap.get(playerId);
    if (!gameIds) return [];

    return Array.from(gameIds)
      .map((id) => this.games.get(id))
      .filter((game): game is Game => game !== undefined);
  }

  async clear(): Promise<void> {
    this.games.clear();
    this.gamesByStatus.forEach((set) => set.clear());
    this.playerGameMap.clear();

    // ステータスセットを再初期化
    this.gamesByStatus.set("WAITING", new Set());
    this.gamesByStatus.set("IN_PROGRESS", new Set());
    this.gamesByStatus.set("FINISHED", new Set());

    logger.info("Game repository cleared");
  }

  async getStats(): Promise<Record<string, number>> {
    return {
      totalGames: this.games.size,
      waitingGames: this.gamesByStatus.get("WAITING")?.size || 0,
      inProgressGames: this.gamesByStatus.get("IN_PROGRESS")?.size || 0,
      finishedGames: this.gamesByStatus.get("FINISHED")?.size || 0,
      activePlayers: this.playerGameMap.size,
    };
  }
}