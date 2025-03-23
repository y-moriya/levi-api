import { Game, GameCreation, GameSettings, GamePlayer } from '../types/game.ts';
import { getUserById } from '../services/auth.ts';

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

// インメモリゲームストレージ
const games: Map<string, Game> = new Map();

// deno-lint-ignore require-await
export const createGame = async (data: GameCreation, ownerId: string): Promise<Game> => {
  const owner = getUserById(ownerId);
  if (!owner) {
    throw new Error('Owner not found');
  }

  const gameId = crypto.randomUUID();
  const game: Game = {
    id: gameId,
    name: data.name,
    owner,
    hasPassword: !!data.password,
    maxPlayers: data.maxPlayers,
    currentPlayers: 1,
    status: 'WAITING',
    players: [{
      playerId: ownerId,
      username: owner.username,
      isAlive: true,
      deathCause: 'NONE'
    }],
    createdAt: new Date().toISOString(),
    settings: data.settings || DEFAULT_GAME_SETTINGS,
    currentPhase: null,
    currentDay: 0,
    phaseEndTime: null,
    winner: 'NONE',
    gameEvents: []
  };

  games.set(gameId, game);
  return game;
};

export const getAllGames = (): Game[] => {
  return Array.from(games.values());
};

export const getGameById = (gameId: string): Game | undefined => {
  return games.get(gameId);
};

// deno-lint-ignore require-await
export const joinGame = async (gameId: string, playerId: string): Promise<Game> => {
  const game = games.get(gameId);
  if (!game) {
    throw new Error('Game not found');
  }

  if (game.status !== 'WAITING') {
    throw new Error('Game is not in waiting state');
  }

  if (game.currentPlayers >= game.maxPlayers) {
    throw new Error('Game is full');
  }

  const player = getUserById(playerId);
  if (!player) {
    throw new Error('Player not found');
  }

  if (game.players.some(p => p.playerId === playerId)) {
    throw new Error('Player already in game');
  }

  const newPlayer: GamePlayer = {
    playerId,
    username: player.username,
    isAlive: true,
    deathCause: 'NONE'
  };

  game.players.push(newPlayer);
  game.currentPlayers += 1;
  return game;
};

// deno-lint-ignore require-await
export const leaveGame = async (gameId: string, playerId: string): Promise<Game> => {
  const game = games.get(gameId);
  if (!game) {
    throw new Error('Game not found');
  }

  if (game.status !== 'WAITING') {
    throw new Error('Cannot leave game in progress');
  }

  const playerIndex = game.players.findIndex(p => p.playerId === playerId);
  if (playerIndex === -1) {
    throw new Error('Player not in game');
  }

  // オーナーが退出する場合、ゲームを削除
  if (game.owner.id === playerId) {
    games.delete(gameId);
    throw new Error('Game deleted as owner left');
  }

  game.players.splice(playerIndex, 1);
  game.currentPlayers -= 1;
  return game;
};

// テスト用のリセット関数
export const resetGames = (): void => {
  games.clear();
};