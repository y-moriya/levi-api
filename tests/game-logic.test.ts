import { assertEquals } from "https://deno.land/std@0.210.0/assert/mod.ts";
import * as gameLogic from "../services/game-logic.ts";
import * as gameModel from "../models/game.ts";
import * as authService from "../services/auth.ts";
import { Game, Role } from "../types/game.ts";
import { User } from "../types/user.ts";
import { 
  setupTest, 
  cleanupTest, 
  assignTestRoles, 
  setPlayerAliveStatus, 
  withQuietLogs,
  assertions
} from "./helpers/test-helpers.ts";
import { gameFixtures } from "./helpers/fixtures.ts";
import { createMockGame } from "./helpers/mocks.ts";

let testGame: Game;
let testUsers: User[];

/**
 * テスト用のゲーム環境をセットアップする
 */
async function setupGameLogicTest() {
  await setupTest();
  
  // テストユーザーの作成
  testUsers = await Promise.all([
    authService.register({
      username: "owner",
      email: "owner@test.com",
      password: "password123",
    }),
    authService.register({
      username: "player2",
      email: "player2@test.com",
      password: "password123",
    }),
    authService.register({
      username: "player3",
      email: "player3@test.com",
      password: "password123",
    }),
    authService.register({
      username: "player4",
      email: "player4@test.com",
      password: "password123",
    }),
    authService.register({
      username: "player5",
      email: "player5@test.com",
      password: "password123",
    }),
  ]);

  // テストゲームの作成
  testGame = await gameModel.createGame({
    name: "テストゲーム",
    maxPlayers: 5,
  }, testUsers[0].id);

  // プレイヤーをゲームに追加
  for (let i = 1; i < testUsers.length; i++) {
    await gameModel.joinGame(testGame.id, testUsers[i].id);
  }

  // タイマーのスケジュールなしでゲームを初期化
  testGame.status = "IN_PROGRESS";
  testGame.currentDay = 1;
  testGame.currentPhase = "DAY_DISCUSSION";
}

// ゲーム終了条件のテスト
Deno.test({
  name: "checkGameEnd - すべての人狼が死亡した場合、村人の勝利を検出する",
  fn: withQuietLogs(async () => {
    await setupGameLogicTest();
    
    // 役職の設定 - フィクスチャーを使用
    assignTestRoles(testGame, gameFixtures.fivePlayerRoles.standard);
    
    // 人狼を死亡させる
    setPlayerAliveStatus(testGame, { 1: false });

    const result = gameLogic.checkGameEnd(testGame);
    assertEquals(result.isEnded, true);
    assertions.assertGameWinner(result, "VILLAGERS");

    cleanupTest();
  }),
});

Deno.test({
  name: "checkGameEnd - 人狼が村人陣営と同数または上回った場合、人狼の勝利を検出する",
  fn: withQuietLogs(async () => {
    await setupGameLogicTest();
    
    // 役職の設定 - フィクスチャーを使用
    assignTestRoles(testGame, gameFixtures.fivePlayerRoles.werewolfHeavy);
    
    // 村人と占い師と狩人を死亡させる
    setPlayerAliveStatus(testGame, { 2: false, 3: false, 4: false });

    const result = gameLogic.checkGameEnd(testGame);
    assertEquals(result.isEnded, true);
    assertions.assertGameWinner(result, "WEREWOLVES");

    cleanupTest();
  }),
});

// フェーズ移行のテスト
Deno.test({
  name: "handlePhaseEnd - フェーズ間の移行が正しく行われるか",
  fn: withQuietLogs(async () => {
    await setupGameLogicTest();
    
    // 役職の設定 - フィクスチャーを使用
    assignTestRoles(testGame, gameFixtures.fivePlayerRoles.standard);
    
    // DAY_DISCUSSIONからDAY_VOTEへのテスト
    testGame.currentPhase = "DAY_DISCUSSION";
    
    // 最初の移行テスト: DAY_DISCUSSIONからDAY_VOTEへ
    const nextPhase = gameLogic._getNextPhase(testGame.currentPhase);
    assertEquals(nextPhase, "DAY_VOTE");
    
    // 2番目の移行テスト: DAY_VOTEからNIGHTへ
    const nightPhase = gameLogic._getNextPhase("DAY_VOTE");
    assertEquals(nightPhase, "NIGHT");
    
    // 3番目の移行テスト: NIGHTからDAY_DISCUSSIONへ
    const dayPhase = gameLogic._getNextPhase("NIGHT");
    assertEquals(dayPhase, "DAY_DISCUSSION");
    
    cleanupTest();
  }),
});

// 役職割り当てのテスト
Deno.test({
  name: "assignRoles - ゲーム設定に従って役職が割り当てられるか",
  fn: withQuietLogs(async () => {
    await setupGameLogicTest();

    // すべての役職をリセット
    testGame.players.forEach((player) => {
      player.role = undefined;
    });

    gameLogic.assignRoles(testGame);

    const roleCount = {
      WEREWOLF: 0,
      SEER: 0,
      BODYGUARD: 0,
      VILLAGER: 0,
      MEDIUM: 0,
    } as Record<Role, number>;

    testGame.players.forEach((player) => {
      if (player.role) {
        roleCount[player.role]++;
      }
    });

    assertEquals(roleCount.WEREWOLF, testGame.settings.roles.werewolfCount);
    assertEquals(roleCount.SEER, testGame.settings.roles.seerCount);
    assertEquals(roleCount.BODYGUARD, testGame.settings.roles.bodyguardCount);
    assertEquals(roleCount.MEDIUM, testGame.settings.roles.mediumCount);
    assertEquals(
      roleCount.VILLAGER,
      testGame.players.length - (
        testGame.settings.roles.werewolfCount +
        testGame.settings.roles.seerCount +
        testGame.settings.roles.bodyguardCount +
        testGame.settings.roles.mediumCount
      ),
    );

    cleanupTest();
  }),
});

// モックを使った高速なテスト
Deno.test({
  name: "ゲーム終了条件 - 村人が全滅した場合の人狼勝利",
  fn: () => {
    // モックゲームを使用して、セットアップ処理を省略
    const mockGame = createMockGame({
      status: "IN_PROGRESS",
      currentDay: 2,
      currentPhase: "NIGHT",
      players: [
        { playerId: "p1", username: "wolf1", role: "WEREWOLF", isAlive: true, deathCause: "NONE" },
        { playerId: "p2", username: "wolf2", role: "WEREWOLF", isAlive: true, deathCause: "NONE" },
        { playerId: "p3", username: "villager1", role: "VILLAGER", isAlive: false, deathCause: "WEREWOLF_ATTACK" },
        { playerId: "p4", username: "seer", role: "SEER", isAlive: false, deathCause: "WEREWOLF_ATTACK" },
        { playerId: "p5", username: "bodyguard", role: "BODYGUARD", isAlive: false, deathCause: "EXECUTION" },
      ],
    });

    // テスト実行
    const result = gameLogic.checkGameEnd(mockGame);
    
    // アサーション
    assertEquals(result.isEnded, true);
    assertions.assertGameWinner(result, "WEREWOLVES");
  },
});

Deno.test({
  name: "ゲーム終了条件 - まだ両陣営が生存している場合はゲーム継続",
  fn: () => {
    // モックゲームを使用して、セットアップ処理を省略
    const mockGame = createMockGame({
      status: "IN_PROGRESS",
      currentDay: 2,
      currentPhase: "DAY_DISCUSSION",
      players: [
        { playerId: "p1", username: "wolf1", role: "WEREWOLF", isAlive: true, deathCause: "NONE" },
        { playerId: "p2", username: "villager1", role: "VILLAGER", isAlive: true, deathCause: "NONE" },
        { playerId: "p3", username: "villager2", role: "VILLAGER", isAlive: true, deathCause: "NONE" },
        { playerId: "p4", username: "seer", role: "SEER", isAlive: false, deathCause: "WEREWOLF_ATTACK" },
        { playerId: "p5", username: "bodyguard", role: "BODYGUARD", isAlive: false, deathCause: "EXECUTION" },
      ],
    });

    // テスト実行
    const result = gameLogic.checkGameEnd(mockGame);
    
    // アサーション
    assertEquals(result.isEnded, false);
    assertions.assertGameWinner(result, null);
  },
});
