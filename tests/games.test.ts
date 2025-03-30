import { assertEquals, assertNotEquals, assertRejects } from "https://deno.land/std@0.210.0/assert/mod.ts";
import * as gameModel from "../models/game.ts";
import * as authService from "../services/auth.ts";
import * as gamePhase from "../services/game-phase.ts";
import { GameCreation } from "../types/game.ts";

const testUser1 = {
  username: "player1",
  email: "player1@example.com",
  password: "password123",
};

const testUser2 = {
  username: "player2",
  email: "player2@example.com",
  password: "password123",
};

const testGameData: GameCreation = {
  name: "Test Game",
  maxPlayers: 5,
};

let user1: { id: string };
let user2: { id: string };

// テストの前処理用の関数
async function setupTest() {
  gameModel.resetGames();
  authService.resetStore();
  user1 = await authService.register(testUser1);
  user2 = await authService.register(testUser2);
}

// テストの後処理用の関数
function cleanupTest() {
  const games = gameModel.getAllGames();
  for (const game of games) {
    gamePhase.clearPhaseTimer(game.id);
  }
}

Deno.test({
  name: "Game Creation - should create a new game successfully",
  async fn() {
    await setupTest();
    const game = await gameModel.createGame(testGameData, user1.id);

    assertEquals(game.name, testGameData.name);
    assertEquals(game.maxPlayers, testGameData.maxPlayers);
    assertEquals(game.owner.id, user1.id);
    assertEquals(game.status, "WAITING");
    assertEquals(game.currentPlayers, 1);
    assertEquals(game.players.length, 1);
    assertEquals(game.players[0].playerId, user1.id);

    cleanupTest();
  },
});

Deno.test({
  name: "Game Creation - should fail when owner does not exist",
  async fn() {
    await setupTest();
    await assertRejects(
      async () => {
        await gameModel.createGame(testGameData, "non-existent-id");
      },
      Error,
      "Owner not found",
    );
    cleanupTest();
  },
});

Deno.test({
  name: "Game Creation - should create game with default settings",
  async fn() {
    await setupTest();
    const game = await gameModel.createGame(testGameData, user1.id);

    assertEquals(game.settings.dayTimeSeconds, 300);
    assertEquals(game.settings.nightTimeSeconds, 180);
    assertEquals(game.settings.voteTimeSeconds, 60);
    assertEquals(game.settings.roles.werewolfCount, 2);
    assertEquals(game.settings.roles.seerCount, 1);
    assertEquals(game.settings.roles.bodyguardCount, 1);
    assertEquals(game.settings.roles.mediumCount, 0);

    cleanupTest();
  },
});

// Game Joining Tests
Deno.test({
  name: "Game Joining - should allow a player to join a game",
  async fn() {
    await setupTest();
    const game = await gameModel.createGame(testGameData, user1.id);
    const joinedGame = await gameModel.joinGame(game.id, user2.id);

    assertEquals(joinedGame.currentPlayers, 2);
    assertEquals(joinedGame.players.length, 2);
    assertEquals(joinedGame.players[1].playerId, user2.id);
    assertEquals(joinedGame.players[1].username, testUser2.username);

    cleanupTest();
  },
});

Deno.test({
  name: "Game Joining - should not allow joining a non-existent game",
  async fn() {
    await setupTest();
    await assertRejects(
      async () => {
        await gameModel.joinGame("non-existent-id", user2.id);
      },
      Error,
      "Game not found",
    );
    cleanupTest();
  },
});

Deno.test({
  name: "Game Joining - should not allow joining a full game",
  async fn() {
    await setupTest();
    const game = await gameModel.createGame(testGameData, user1.id);

    // Fill up the game with unique users
    const additionalUsers = [];
    for (let i = 2; i <= testGameData.maxPlayers; i++) {
      const testUser = {
        username: `player${i}`,
        email: `player${i}_${Date.now()}@example.com`,
        password: "password123",
      };
      const user = await authService.register(testUser);
      additionalUsers.push(user);
      await gameModel.joinGame(game.id, user.id);
    }

    // Try to add one more player
    const extraUser = await authService.register({
      username: "extra",
      email: `extra_${Date.now()}@example.com`,
      password: "password123",
    });

    await assertRejects(
      async () => {
        await gameModel.joinGame(game.id, extraUser.id);
      },
      Error,
      "Game is full",
    );
    cleanupTest();
  },
});

Deno.test({
  name: "Game Joining - should not allow joining twice",
  async fn() {
    await setupTest();
    const game = await gameModel.createGame(testGameData, user1.id);
    await gameModel.joinGame(game.id, user2.id);

    await assertRejects(
      async () => {
        await gameModel.joinGame(game.id, user2.id);
      },
      Error,
      "Player already in game",
    );
    cleanupTest();
  },
});

// Game Leaving Tests
Deno.test({
  name: "Game Leaving - should allow a player to leave a game",
  async fn() {
    await setupTest();
    const game = await gameModel.createGame(testGameData, user1.id);
    await gameModel.joinGame(game.id, user2.id);
    const updatedGame = await gameModel.leaveGame(game.id, user2.id);

    assertEquals(updatedGame.currentPlayers, 1);
    assertEquals(updatedGame.players.length, 1);
    assertEquals(updatedGame.players[0].playerId, user1.id);

    cleanupTest();
  },
});

Deno.test({
  name: "Game Leaving - should delete the game when owner leaves",
  async fn() {
    await setupTest();
    const game = await gameModel.createGame(testGameData, user1.id);
    await gameModel.joinGame(game.id, user2.id);

    await assertRejects(
      async () => {
        await gameModel.leaveGame(game.id, user1.id);
      },
      Error,
      "Game deleted as owner left",
    );

    const deletedGame = gameModel.getGameById(game.id);
    assertEquals(deletedGame, undefined);

    cleanupTest();
  },
});

// Game Listing Tests
Deno.test({
  name: "Game Listing - should return all created games",
  async fn() {
    await setupTest();
    const game1 = await gameModel.createGame({
      ...testGameData,
      name: "Game 1",
    }, user1.id);

    const game2 = await gameModel.createGame({
      ...testGameData,
      name: "Game 2",
    }, user2.id);

    const games = gameModel.getAllGames();

    assertEquals(games.length, 2);
    assertEquals(games[0].id, game1.id);
    assertEquals(games[1].id, game2.id);

    cleanupTest();
  },
});

Deno.test({
  name: "Game Listing - should return empty array when no games exist",
  async fn() {
    await setupTest();
    const games = gameModel.getAllGames();
    assertEquals(games.length, 0);
    cleanupTest();
  },
});

// Game Retrieval Tests
Deno.test({
  name: "Game Retrieval - should return game by id",
  async fn() {
    await setupTest();
    const game = await gameModel.createGame(testGameData, user1.id);
    const retrievedGame = gameModel.getGameById(game.id);

    assertNotEquals(retrievedGame, undefined);
    assertEquals(retrievedGame?.id, game.id);
    assertEquals(retrievedGame?.name, testGameData.name);

    cleanupTest();
  },
});

Deno.test({
  name: "Game Retrieval - should return undefined for non-existent game",
  async fn() {
    await setupTest();
    const game = gameModel.getGameById("non-existent-id");
    assertEquals(game, undefined);
    cleanupTest();
  },
});

// Game Starting Tests
Deno.test({
  name: "Game Starting - should start game successfully",
  async fn() {
    await setupTest();
    const game = await gameModel.createGame({
      ...testGameData,
      maxPlayers: 6,
    }, user1.id);

    // Add enough players for minimum requirements
    for (let i = 0; i < 4; i++) {
      const testUser = {
        username: `player${i + 3}`,
        email: `player${i + 3}_${Date.now()}@example.com`,
        password: "password123",
      };
      const user = await authService.register(testUser);
      await gameModel.joinGame(game.id, user.id);
    }

    const startedGame = await gameModel.startGame(game.id, user1.id);

    assertEquals(startedGame.status, "IN_PROGRESS");
    assertEquals(startedGame.currentDay, 1);
    assertEquals(startedGame.currentPhase, "DAY_DISCUSSION");
    assertNotEquals(startedGame.phaseEndTime, null);
    assertEquals(startedGame.players.every((p) => p.role !== undefined), true);

    cleanupTest();
  },
});

Deno.test({
  name: "Game Starting - should not allow non-owner to start game",
  async fn() {
    await setupTest();
    const game = await gameModel.createGame(testGameData, user1.id);

    await assertRejects(
      async () => {
        await gameModel.startGame(game.id, user2.id);
      },
      Error,
      "Only the game owner can start the game",
    );

    cleanupTest();
  },
});

Deno.test({
  name: "Game Starting - should not allow starting a game in progress",
  async fn() {
    await setupTest();
    // まず5人以上のプレイヤーでゲームを作成
    const game = await gameModel.createGame({
      ...testGameData,
      maxPlayers: 6,
    }, user1.id);

    // 5人のプレイヤーを追加
    for (let i = 0; i < 4; i++) {
      const testUser = {
        username: `player${i + 3}`,
        email: `player${i + 3}_${Date.now()}@example.com`,
        password: "password123",
      };
      const user = await authService.register(testUser);
      await gameModel.joinGame(game.id, user.id);
    }

    // 最初のゲーム開始
    await gameModel.startGame(game.id, user1.id);

    // 2回目の開始試行（失敗するはず）
    await assertRejects(
      async () => {
        await gameModel.startGame(game.id, user1.id);
      },
      Error,
      "Game is not in waiting state",
    );

    cleanupTest();
  },
});

Deno.test({
  name: "Game Starting - should assign roles correctly",
  async fn() {
    await setupTest();
    const game = await gameModel.createGame({
      ...testGameData,
      maxPlayers: 6,
    }, user1.id);

    // Add enough players
    for (let i = 0; i < 4; i++) {
      const testUser = {
        username: `player${i + 3}`,
        email: `player${i + 3}_${Date.now()}@example.com`,
        password: "password123",
      };
      const user = await authService.register(testUser);
      await gameModel.joinGame(game.id, user.id);
    }

    const startedGame = await gameModel.startGame(game.id, user1.id);

    const roleCount = {
      WEREWOLF: 0,
      SEER: 0,
      BODYGUARD: 0,
      MEDIUM: 0,
      VILLAGER: 0,
    };

    startedGame.players.forEach((player) => {
      if (player.role) {
        roleCount[player.role]++;
      }
    });

    assertEquals(roleCount.WEREWOLF, startedGame.settings.roles.werewolfCount);
    assertEquals(roleCount.SEER, startedGame.settings.roles.seerCount);
    assertEquals(roleCount.BODYGUARD, startedGame.settings.roles.bodyguardCount);
    assertEquals(roleCount.MEDIUM, startedGame.settings.roles.mediumCount);
    assertEquals(
      roleCount.VILLAGER,
      startedGame.players.length - (
        startedGame.settings.roles.werewolfCount +
        startedGame.settings.roles.seerCount +
        startedGame.settings.roles.bodyguardCount +
        startedGame.settings.roles.mediumCount
      ),
    );

    cleanupTest();
  },
});
