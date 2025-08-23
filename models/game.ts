import { Game, GameCreation, GamePlayer, GameSettings, Winner } from "../types/game.ts";
import { repositoryContainer } from "../repositories/repository-container.ts";
import { getUserById } from "../services/auth.ts";
import { startGame as initializeGameLogic } from "../services/game-logic.ts";
import { logger } from "../utils/logger.ts";
import { User } from "../types/user.ts";

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

// リクエストコンテキスト用のクラス
// 主にテスト目的で使用
class RequestContext {
  private requestUser: User | null = null;

  // リクエストユーザーを設定するメソッド（テスト用）
  setRequestUser(user: User | null): void {
    this.requestUser = user;
  }

  // 現在のリクエストユーザーを取得するメソッド
  getRequestUser(): User | null {
    return this.requestUser;
  }
}

// シングルトンインスタンスを作成
export const requestContext = new RequestContext();

// 以前のAPIとの互換性を維持するラッパー関数
export const createGame = async (data: GameCreation, ownerId: string): Promise<Game> => {
  const owner = await getUserById(ownerId);
  if (!owner) {
    throw new Error("Owner not found");
  }

  const gameId = crypto.randomUUID();
  const game: Game = {
    id: gameId,
    name: data.name,
    owner: {
      id: owner.id,
      username: owner.username,
      email: owner.email,
      createdAt: owner.createdAt,
      stats: owner.stats,
    },
    creatorId: ownerId,
    maxPlayers: data.maxPlayers,
    hasPassword: !!data.password,
    currentPlayers: 1,
    status: "WAITING",
    players: [{
      playerId: ownerId,
      username: owner.username,
      isAlive: true,
      joinedAt: new Date().toISOString(),
      deathCause: "NONE",
    }],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    settings: data.settings || DEFAULT_GAME_SETTINGS,
    currentPhase: "WAITING",
    currentDay: 0,
    phaseEndTime: null,
    winner: "NONE" as Winner,
    gameEvents: [],
    gameActions: [],
    actions: [] as any, // 型アサーションを使用して互換性を確保
    revealedRoles: [],
  };

  const gameRepo = repositoryContainer.getGameRepository();
  await gameRepo.add(game);

  return game;
};

export const getAllGames = async (): Promise<Game[]> => {
  const gameRepo = repositoryContainer.getGameRepository();
  return await gameRepo.findAll();
};

export const getGameById = async (gameId: string): Promise<Game | null | undefined> => {
  const gameRepo = repositoryContainer.getGameRepository();
  return await gameRepo.findById(gameId);
};

export const joinGame = async (gameId: string, playerId: string): Promise<Game> => {
  const gameRepo = repositoryContainer.getGameRepository();
  const game = await gameRepo.findById(gameId);

  if (!game) {
    throw new Error("Game not found");
  }

  if (game.status !== "WAITING") {
    throw new Error("Game is not in waiting state");
  }

  if (game.players.length >= game.maxPlayers) {
    throw new Error("Game is full");
  }

  const userRepo = repositoryContainer.getUserRepository();
  const player = await userRepo.findById(playerId);

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
    joinedAt: new Date().toISOString(),
    deathCause: "NONE",
  };

  game.players.push(newPlayer);
  game.currentPlayers = game.players.length;
  game.updatedAt = new Date().toISOString();

  // リポジトリを更新
  await gameRepo.update(game.id, game);

  return game;
};

export const leaveGame = async (gameId: string, playerId: string): Promise<Game> => {
  const gameRepo = repositoryContainer.getGameRepository();
  const game = await gameRepo.findById(gameId);

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
  if (game.creatorId === playerId) {
    await gameRepo.delete(gameId);
    logger.info("Game deleted from repository", { gameId });
    throw new Error("Game deleted as owner left");
  }

  // プレイヤーを削除
  game.players.splice(playerIndex, 1);
  game.currentPlayers = game.players.length;
  game.updatedAt = new Date().toISOString();

  // リポジトリを更新
  await gameRepo.update(game.id, game);

  return game;
};

export const startGame = async (gameId: string, playerId: string): Promise<Game> => {
  const gameRepo = repositoryContainer.getGameRepository();
  const game = await gameRepo.findById(gameId);

  if (!game) {
    throw new Error("Game not found");
  }

  if (game.creatorId !== playerId) {
    throw new Error("Only the game owner can start the game");
  }

  if (game.status !== "WAITING") {
    throw new Error("Game is not in waiting state");
  }

  // ゲーム開始のロジックを呼び出し
  const updatedGame = await initializeGameLogic(game.id);

  // 更新されたゲームのステータスを確認し、必要に応じて修正
  if (updatedGame.status !== "IN_PROGRESS") {
    logger.warn(`ゲームステータスが正しく更新されていません: ${updatedGame.status}`);
    updatedGame.status = "IN_PROGRESS";
    await gameRepo.update(updatedGame.id, updatedGame);
  }

  // 更新されたゲームオブジェクトを返す
  return updatedGame;
};

// テスト用のリセット関数
export const resetGames = async (): Promise<void> => {
  const gameRepo = repositoryContainer.getGameRepository();
  await gameRepo.clear();
  logger.info("Games reset");
};

// テスト用にリクエストユーザーを設定する
export const setRequestUser = (user: User | null): void => {
  requestContext.setRequestUser(user);
};

// ゲームストアとの互換性のために残しておく変数
// 注: 新しいコードではrepositoryContainerを使用することを推奨
export const gameStore = {
  get: async (gameId: string) => await getGameById(gameId),
  getAll: async () => await getAllGames(),
  getByStatus: async (status: string) => {
    const gameRepo = repositoryContainer.getGameRepository();
    return await gameRepo.findByStatus(status);
  },
  getByPlayer: async (playerId: string) => {
    const gameRepo = repositoryContainer.getGameRepository();
    return await gameRepo.findByPlayerId(playerId);
  },
  add: async (game: Game) => {
    const gameRepo = repositoryContainer.getGameRepository();
    await gameRepo.add(game);
  },
  update: async (game: Game) => {
    const gameRepo = repositoryContainer.getGameRepository();
    await gameRepo.update(game.id, game);
  },
  delete: async (gameId: string) => {
    const gameRepo = repositoryContainer.getGameRepository();
    await gameRepo.delete(gameId);
  },
  clear: async () => {
    await resetGames();
  },
  getRequestUser: () => requestContext.getRequestUser(),
  setRequestUser: (user: User | null) => requestContext.setRequestUser(user),
  getStats: async () => {
    const gameRepo = repositoryContainer.getGameRepository();
    return await gameRepo.getStats();
  },
};
