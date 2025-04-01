import { Game, GameCreation, GamePlayer, GameSettings } from "../types/game.ts";
import { getUserById } from "../services/auth.ts";
import { initializeGame } from "../services/game-logic.ts";
import { logger } from "../utils/logger.ts";

// デフォルトのゲーム設定
const DEFAULT_GAME_SETTINGS: GameSettings = {
  dayTimeSeconds: 300,
  nightTimeSeconds: 180,
  voteTimeSeconds: 60,
  roles: {
    werewolfCount: 2,
    seerCount: 1,
    bodyguardCount: 1,
    mediumCount: 0,
  },
};

// ゲームデータストレージの最適化
class GameStore {
  private games: Map<string, Game> = new Map();
  private gamesByStatus: Map<string, Set<string>> = new Map();
  private playerGameMap: Map<string, Set<string>> = new Map();
  
  constructor() {
    // ゲームステータスの種類ごとにセットを初期化
    this.gamesByStatus.set("WAITING", new Set());
    this.gamesByStatus.set("IN_PROGRESS", new Set());
    this.gamesByStatus.set("FINISHED", new Set());
  }
  
  // ゲームを追加
  add(game: Game): void {
    this.games.set(game.id, game);
    
    // ステータスごとのインデックスを更新
    const statusSet = this.gamesByStatus.get(game.status);
    if (statusSet) {
      statusSet.add(game.id);
    }
    
    // プレイヤーとゲームの関連を追跡
    game.players.forEach(player => {
      if (!this.playerGameMap.has(player.playerId)) {
        this.playerGameMap.set(player.playerId, new Set());
      }
      this.playerGameMap.get(player.playerId)?.add(game.id);
    });
    
    logger.info("Game added to store", { 
      gameId: game.id, 
      status: game.status, 
      playerCount: game.players.length 
    });
  }
  
  // ゲームを更新
  update(game: Game): void {
    const oldGame = this.games.get(game.id);
    if (!oldGame) {
      return this.add(game);
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
    const oldPlayerIds = new Set(oldGame.players.map(p => p.playerId));
    const newPlayerIds = new Set(game.players.map(p => p.playerId));
    
    // 削除されたプレイヤーの関連を更新
    oldPlayerIds.forEach(playerId => {
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
    newPlayerIds.forEach(playerId => {
      if (!oldPlayerIds.has(playerId)) {
        if (!this.playerGameMap.has(playerId)) {
          this.playerGameMap.set(playerId, new Set());
        }
        this.playerGameMap.get(playerId)?.add(game.id);
      }
    });
    
    // ゲームオブジェクトを更新
    this.games.set(game.id, game);
  }
  
  // ゲームを削除
  delete(gameId: string): void {
    const game = this.games.get(gameId);
    if (!game) return;
    
    // ステータスインデックスから削除
    const statusSet = this.gamesByStatus.get(game.status);
    if (statusSet) {
      statusSet.delete(gameId);
    }
    
    // プレイヤーとの関連を削除
    game.players.forEach(player => {
      const playerGames = this.playerGameMap.get(player.playerId);
      if (playerGames) {
        playerGames.delete(gameId);
        if (playerGames.size === 0) {
          this.playerGameMap.delete(player.playerId);
        }
      }
    });
    
    // ゲームを削除
    this.games.delete(gameId);
    
    logger.info("Game deleted from store", { gameId });
  }
  
  // ゲームを取得
  get(gameId: string): Game | undefined {
    return this.games.get(gameId);
  }
  
  // すべてのゲームを取得
  getAll(): Game[] {
    return Array.from(this.games.values());
  }
  
  // ステータスでフィルタリングしたゲームを取得
  getByStatus(status: string): Game[] {
    const gameIds = this.gamesByStatus.get(status);
    if (!gameIds) return [];
    
    return Array.from(gameIds)
      .map(id => this.games.get(id))
      .filter((game): game is Game => game !== undefined);
  }
  
  // プレイヤーが参加しているゲームを取得
  getByPlayer(playerId: string): Game[] {
    const gameIds = this.playerGameMap.get(playerId);
    if (!gameIds) return [];
    
    return Array.from(gameIds)
      .map(id => this.games.get(id))
      .filter((game): game is Game => game !== undefined);
  }
  
  // すべてを削除（テスト用）
  clear(): void {
    this.games.clear();
    this.gamesByStatus.forEach(set => set.clear());
    this.playerGameMap.clear();
    
    // ステータスセットを再初期化
    this.gamesByStatus.set("WAITING", new Set());
    this.gamesByStatus.set("IN_PROGRESS", new Set());
    this.gamesByStatus.set("FINISHED", new Set());
    
    logger.info("Game store cleared");
  }
  
  // 統計情報を取得
  getStats(): Record<string, number> {
    return {
      totalGames: this.games.size,
      waitingGames: this.gamesByStatus.get("WAITING")?.size || 0,
      inProgressGames: this.gamesByStatus.get("IN_PROGRESS")?.size || 0,
      finishedGames: this.gamesByStatus.get("FINISHED")?.size || 0,
      activePlayers: this.playerGameMap.size
    };
  }
}

// シングルトンインスタンスを作成
export const gameStore = new GameStore();

// 以前のAPIとの互換性を維持するラッパー関数
// deno-lint-ignore require-await
export const createGame = async (data: GameCreation, ownerId: string): Promise<Game> => {
  const owner = getUserById(ownerId);
  if (!owner) {
    throw new Error("Owner not found");
  }

  const gameId = crypto.randomUUID();
  const game: Game = {
    id: gameId,
    name: data.name,
    owner,
    hasPassword: !!data.password,
    maxPlayers: data.maxPlayers,
    currentPlayers: 1,
    status: "WAITING",
    players: [{
      playerId: ownerId,
      username: owner.username,
      isAlive: true,
      deathCause: "NONE",
    }],
    createdAt: new Date().toISOString(),
    settings: data.settings || DEFAULT_GAME_SETTINGS,
    currentPhase: "DAY_DISCUSSION",
    currentDay: 0,
    phaseEndTime: null,
    winner: "NONE",
    gameEvents: [],
  };

  gameStore.add(game);
  return game;
};

export const getAllGames = (): Game[] => {
  return gameStore.getAll();
};

export const getGameById = (gameId: string): Game | undefined => {
  return gameStore.get(gameId);
};

// deno-lint-ignore require-await
export const joinGame = async (gameId: string, playerId: string): Promise<Game> => {
  const game = gameStore.get(gameId);
  if (!game) {
    throw new Error("Game not found");
  }

  if (game.status !== "WAITING") {
    throw new Error("Game is not in waiting state");
  }

  if (game.currentPlayers >= game.maxPlayers) {
    throw new Error("Game is full");
  }

  const player = getUserById(playerId);
  if (!player) {
    throw new Error("Player not found");
  }

  if (game.players.some((p) => p.playerId === playerId)) {
    throw new Error("Player already in game");
  }

  const newPlayer: GamePlayer = {
    playerId,
    username: player.username,
    isAlive: true,
    deathCause: "NONE",
  };

  game.players.push(newPlayer);
  game.currentPlayers += 1;
  
  // ゲームストアを更新
  gameStore.update(game);
  
  return game;
};

// deno-lint-ignore require-await
export const leaveGame = async (gameId: string, playerId: string): Promise<Game> => {
  const game = gameStore.get(gameId);
  if (!game) {
    throw new Error("Game not found");
  }

  if (game.status !== "WAITING") {
    throw new Error("Cannot leave game in progress");
  }

  const playerIndex = game.players.findIndex((p) => p.playerId === playerId);
  if (playerIndex === -1) {
    throw new Error("Player not in game");
  }

  // オーナーが退出する場合、ゲームを削除
  if (game.owner.id === playerId) {
    gameStore.delete(gameId);
    throw new Error("Game deleted as owner left");
  }

  game.players.splice(playerIndex, 1);
  game.currentPlayers -= 1;
  
  // ゲームストアを更新
  gameStore.update(game);
  
  return game;
};

// deno-lint-ignore require-await
export const startGame = async (gameId: string, playerId: string): Promise<Game> => {
  const game = gameStore.get(gameId);
  if (!game) {
    throw new Error("Game not found");
  }

  if (game.owner.id !== playerId) {
    throw new Error("Only the game owner can start the game");
  }

  if (game.status !== "WAITING") {
    throw new Error("Game is not in waiting state");
  }

  // ゲーム開始のロジックを呼び出し
  initializeGame(game);
  
  // ゲームストアを更新
  gameStore.update(game);

  return game;
};

// テスト用のリセット関数
export const resetGames = (): void => {
  gameStore.clear();
};
