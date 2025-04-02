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
async function cleanupTest() {
  const games = gameModel.getAllGames();
  for (const game of games) {
    await gamePhase.clearPhaseTimer(game.id);
  }
}

Deno.test({
  name: "ゲーム作成 - 新しいゲームを正常に作成できるか",
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
  name: "ゲーム作成 - オーナーが存在しない場合は失敗するか",
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
  name: "ゲーム作成 - デフォルト設定でゲームを作成できるか",
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

// ゲーム参加のテスト
Deno.test({
  name: "ゲーム参加 - プレイヤーがゲームに参加できるか",
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
  name: "ゲーム参加 - 存在しないゲームには参加できないか",
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
  name: "ゲーム参加 - 満員のゲームには参加できないか",
  async fn() {
    await setupTest();
    const game = await gameModel.createGame(testGameData, user1.id);

    // 一意のユーザーでゲームを満員にする
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

    // もう一人プレイヤーを追加しようとする
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
  name: "ゲーム参加 - 同じプレイヤーが二回参加できないか",
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

// ゲーム退出のテスト
Deno.test({
  name: "ゲーム退出 - プレイヤーがゲームから退出できるか",
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
  name: "ゲーム退出 - オーナーが退出した場合、ゲームが削除されるか",
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

// ゲーム一覧のテスト
Deno.test({
  name: "ゲーム一覧 - 作成されたすべてのゲームを返すか",
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
  name: "ゲーム一覧 - ゲームが存在しない場合は空の配列を返すか",
  async fn() {
    await setupTest();
    const games = gameModel.getAllGames();
    assertEquals(games.length, 0);
    cleanupTest();
  },
});

// ゲーム取得のテスト
Deno.test({
  name: "ゲーム取得 - IDによってゲームを取得できるか",
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
  name: "ゲーム取得 - 存在しないゲームの場合はundefinedを返すか",
  async fn() {
    await setupTest();
    const game = gameModel.getGameById("non-existent-id");
    assertEquals(game, undefined);
    cleanupTest();
  },
});

// ゲーム開始のテスト
Deno.test({
  name: "ゲーム開始 - ゲームを正常に開始できるか",
  async fn() {
    await setupTest();
    const game = await gameModel.createGame({
      ...testGameData,
      maxPlayers: 6,
    }, user1.id);

    // 最小要件を満たすのに十分なプレイヤーを追加
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
  name: "ゲーム開始 - オーナー以外がゲームを開始できないか",
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
  name: "ゲーム開始 - 進行中のゲームを開始できないか",
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
  name: "ゲーム開始 - 役職が正しく割り当てられるか",
  async fn() {
    await setupTest();
    const game = await gameModel.createGame({
      ...testGameData,
      maxPlayers: 6,
    }, user1.id);

    // 十分なプレイヤーを追加
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
