import { assertEquals } from "https://deno.land/std@0.210.0/assert/mod.ts";
import * as gameLogic from "../services/game-logic.ts";
import * as gameModel from "../models/game.ts";
import * as authService from "../services/auth.ts";
import * as gamePhase from "../services/game-phase.ts";
import { Game, Role } from "../types/game.ts";

let testGame: Game;

async function setupTest() {
  // ゲーム状態のリセット
  gameModel.resetGames();
  authService.resetStore();
  gamePhase.clearAllTimers();

  // テストユーザーの作成
  const users = await Promise.all([
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
    name: "Test Game",
    maxPlayers: 5,
  }, users[0].id);

  // プレイヤーをゲームに追加
  for (let i = 1; i < users.length; i++) {
    await gameModel.joinGame(testGame.id, users[i].id);
  }

  // タイマーのスケジュールなしでゲームを初期化
  testGame.status = "IN_PROGRESS";
  testGame.currentDay = 1;
  testGame.currentPhase = "DAY_DISCUSSION";
  gameLogic.assignRoles(testGame);
}

function cleanupTest() {
  gamePhase.clearAllTimers();
}

// ゲーム終了条件のテスト
Deno.test({
  name: "checkGameEnd - すべての人狼が死亡した場合、村人の勝利を検出する",
  async fn() {
    await setupTest();
    // 役職の設定
    testGame.players[0].role = "VILLAGER";
    testGame.players[1].role = "WEREWOLF";
    testGame.players[2].role = "SEER";
    testGame.players[3].role = "BODYGUARD";
    testGame.players[4].role = "VILLAGER";

    // 人狼を死亡させる
    testGame.players[1].isAlive = false;

    const result = gameLogic.checkGameEnd(testGame);
    assertEquals(result.isEnded, true);
    assertEquals(result.winner, "VILLAGERS");

    cleanupTest();
  },
});

Deno.test({
  name: "checkGameEnd - 人狼が村人陣営と同数または上回った場合、人狼の勝利を検出する",
  async fn() {
    await setupTest();
    // 役職の設定
    testGame.players[0].role = "WEREWOLF";
    testGame.players[1].role = "WEREWOLF";
    testGame.players[2].role = "VILLAGER";
    testGame.players[3].role = "VILLAGER";
    testGame.players[4].role = "SEER";

    // 村人と占い師を死亡させる
    testGame.players[2].isAlive = false;
    testGame.players[3].isAlive = false;
    testGame.players[4].isAlive = false;

    const result = gameLogic.checkGameEnd(testGame);
    assertEquals(result.isEnded, true);
    assertEquals(result.winner, "WEREWOLVES");

    cleanupTest();
  },
});

// フェーズ移行のテスト
Deno.test({
  name: "handlePhaseEnd - フェーズ間の移行が正しく行われるか",
  async fn() {
    await setupTest();
    
    // ゲーム終了を避けるために各陣営に十分なプレイヤーを確保
    testGame.players[0].role = "VILLAGER";
    testGame.players[1].role = "WEREWOLF";
    testGame.players[2].role = "SEER"; 
    testGame.players[3].role = "BODYGUARD";
    testGame.players[4].role = "VILLAGER";
    
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
  },
});

// 役職割り当てのテスト
Deno.test({
  name: "assignRoles - ゲーム設定に従って役職が割り当てられるか",
  async fn() {
    await setupTest();

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
  },
});
