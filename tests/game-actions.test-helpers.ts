import * as gameActions from "../services/game-actions.ts";
import * as gameModel from "../models/game.ts";
import * as authService from "../services/auth.ts";
import { Game, GamePlayer } from "../types/game.ts";

export type BaseSetup = {
  game: Game;
  villager: GamePlayer;
  werewolf: GamePlayer;
  seer: GamePlayer;
  bodyguard: GamePlayer;
};

export type MediumSetup = BaseSetup & {
  medium: GamePlayer;
};

export async function setupGameActionsTest(): Promise<BaseSetup> {
  await gameModel.resetGames();
  await authService.resetStore();

  const testUsers = [
    { username: "villager", email: "villager@test.com", password: "password" },
    { username: "werewolf", email: "werewolf@test.com", password: "password" },
    { username: "seer", email: "seer@test.com", password: "password" },
    { username: "bodyguard", email: "bodyguard@test.com", password: "password" },
  ];

  const users = await Promise.all(testUsers.map((user) => authService.register(user)));

  const created = await gameModel.createGame({ name: "Test Game", maxPlayers: 4 }, users[0].id);

  for (let i = 1; i < users.length; i++) {
    await gameModel.joinGame(created.id, users[i].id);
  }

  const gameData = await gameModel.getGameById(created.id);
  if (!gameData) throw new Error("Game not found");

  const game = gameData;
  game.status = "IN_PROGRESS";
  game.currentDay = 1;

  game.players[0].role = "VILLAGER";
  game.players[1].role = "WEREWOLF";
  game.players[2].role = "SEER";
  game.players[3].role = "BODYGUARD";

  const villager = game.players[0];
  const werewolf = game.players[1];
  const seer = game.players[2];
  const bodyguard = game.players[3];

  await gameActions.initializeGameActions(game.id);

  return { game, villager, werewolf, seer, bodyguard };
}

export async function setupMediumTest(): Promise<MediumSetup> {
  const base = await setupGameActionsTest();

  const mediumUser = await authService.register({
    username: "medium",
    email: "medium@test.com",
    password: "password",
  });

  base.game.players.push({
    playerId: mediumUser.id,
    username: "medium",
    role: "MEDIUM",
    isAlive: true,
    deathCause: "NONE",
  });

  const medium = base.game.players[4];
  base.game.currentDay = 2;

  // 前日処刑設定
  base.werewolf.isAlive = false;
  base.werewolf.deathCause = "EXECUTION";
  base.werewolf.deathDay = 1;

  return { ...base, medium };
}
