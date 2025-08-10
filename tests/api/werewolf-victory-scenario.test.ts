import { assertEquals } from "https://deno.land/std@0.210.0/assert/mod.ts";
import { apiRequest, consumeResponse, waitForActionInitialization } from "../helpers/api.ts";
import * as gameModel from "../../models/game.ts";
import * as gameLogic from "../../services/game-logic.ts";
import { cleanupScenarioTest, setupScenarioTest, TestUsers } from "./game-scenario-common.ts";
import { GameResponse } from "../helpers/types.ts";

let gameId: string;
let users: TestUsers;

// 完全なゲームシナリオテスト - 人狼陣営の勝利
Deno.test({
  name: "完全なゲームシナリオ - 人狼陣営の勝利",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    users = await setupScenarioTest();
    const { ownerAuth, werewolfAuth, seerAuth, bodyguardAuth, villagerAuth } = users;

    // 1. ゲームの作成
    const createResponse = await apiRequest("POST", "/games", {
      name: "Werewolf Victory Scenario",
      maxPlayers: 5,
    }, ownerAuth.token);
    const game = await consumeResponse<GameResponse>(createResponse);
    gameId = game.id;
    assertEquals(createResponse.status, 201);

    // 2. プレイヤーの参加
    const players = [werewolfAuth, seerAuth, bodyguardAuth, villagerAuth];
    for (const player of players) {
      const joinResponse = await apiRequest("POST", `/games/${gameId}/join`, undefined, player.token);
      await consumeResponse<GameResponse>(joinResponse);
      assertEquals(joinResponse.status, 200);
    }

    // 3. ゲーム開始
    const startResponse = await apiRequest("POST", `/games/${gameId}/start`, undefined, ownerAuth.token);
    const startedGame = await consumeResponse<GameResponse>(startResponse);
    assertEquals(startResponse.status, 200);
    assertEquals(startedGame.status, "IN_PROGRESS");

    // ゲームインスタンスを取得
    let gameInstance = await gameModel.getGameById(gameId);
    if (!gameInstance) {
      throw new Error("Game not found");
    }

    // テストの安定性のために明示的に役職を割り当て
    gameInstance = {
      ...gameInstance,
      players: gameInstance.players.map(p => {
        if (p.playerId === werewolfAuth.user.id) {
          return { ...p, role: "WEREWOLF" };
        } else if (p.playerId === seerAuth.user.id) {
          return { ...p, role: "SEER" };
        } else if (p.playerId === bodyguardAuth.user.id) {
          return { ...p, role: "BODYGUARD" };
        } else if (p.playerId === villagerAuth.user.id) {
          return { ...p, role: "VILLAGER" };
        } else if (p.playerId === ownerAuth.user.id) {
          return { ...p, role: "VILLAGER" };
        }
        return p;
      })
    };
    
    // 更新されたゲームを保存
    await gameModel.gameStore.update(gameInstance);

    // Day 1: 昼フェーズから開始
    assertEquals(gameInstance.currentPhase, "DAY_DISCUSSION");

    // Day 1: 投票フェーズへ移行
    await gameLogic.advancePhase(gameId);
    
    // 更新されたゲームインスタンスを再取得
    gameInstance = await gameModel.getGameById(gameId);
    if (!gameInstance) {
      throw new Error("Game not found after advancing phase");
    }
    
    // フェーズが変更されたことを確認
    assertEquals(gameInstance.currentPhase, "DAY_VOTE");

    // アクション状態の初期化を待機
    await waitForActionInitialization(gameId);

    // 投票の実行（全員がseerに投票）
    for (const player of [ownerAuth, werewolfAuth, bodyguardAuth, villagerAuth]) {
      const voteResponse = await apiRequest("POST", `/games/${gameId}/vote`, {
        targetPlayerId: seerAuth.user.id,
      }, player.token);
      await consumeResponse(voteResponse);
    }

    // 夜のフェーズへ進行
    await gameLogic.advancePhase(gameId);
    
    // 更新されたゲームインスタンスを再取得
    gameInstance = await gameModel.getGameById(gameId);
    if (!gameInstance) {
      throw new Error("Game not found after advancing to night");
    }
    
    // seerが処刑されたことを確認
    const seerPlayer = gameInstance.players.find((p) => p.playerId === seerAuth.user.id)!;
    assertEquals(seerPlayer.isAlive, false);
    assertEquals(seerPlayer.deathCause, "EXECUTION");
    
    // フェーズが夜になったことを確認
    assertEquals(gameInstance.currentPhase, "NIGHT");

    // 襲撃アクション（人狼がbodyguardを襲撃）
    const attackResponse = await apiRequest("POST", `/games/${gameId}/attack`, {
      targetPlayerId: bodyguardAuth.user.id,
    }, werewolfAuth.token);
    await consumeResponse(attackResponse);

    // 2日目の昼フェーズへ進行
    await gameLogic.advancePhase(gameId);
    
    // 更新されたゲームインスタンスを再取得
    gameInstance = await gameModel.getGameById(gameId);
    if (!gameInstance) {
      throw new Error("Game not found after night phase");
    }
    
    // bodyguardが襲撃されたことを確認
    const bodyguardPlayer = gameInstance.players.find((p) => p.playerId === bodyguardAuth.user.id)!;
    assertEquals(bodyguardPlayer.isAlive, false);
    assertEquals(bodyguardPlayer.deathCause, "WEREWOLF_ATTACK");

    // 2日目: 投票フェーズへ移行
    await gameLogic.advancePhase(gameId);
    
    // 更新されたゲームインスタンスを再取得
    gameInstance = await gameModel.getGameById(gameId);
    if (!gameInstance) {
      throw new Error("Game not found after advancing to day 2 vote");
    }
    
    // フェーズが変更されたことを確認
    assertEquals(gameInstance.currentPhase, "DAY_VOTE");

    // 全員がvillagerに投票
    for (const player of [ownerAuth, werewolfAuth]) {
      const voteResponse = await apiRequest("POST", `/games/${gameId}/vote`, {
        targetPlayerId: villagerAuth.user.id,
      }, player.token);
      await consumeResponse(voteResponse);
    }

    // 夜のフェーズへ進行
    await gameLogic.advancePhase(gameId);
    
    // 更新されたゲームインスタンスを再取得
    gameInstance = await gameModel.getGameById(gameId);
    if (!gameInstance) {
      throw new Error("Game not found after day 2 vote");
    }
    
    // villagerが処刑されたことを確認
    const villagerPlayer = gameInstance.players.find((p) => p.playerId === villagerAuth.user.id)!;
    assertEquals(villagerPlayer.isAlive, false);
    
    // フェーズが夜になったことを確認
    assertEquals(gameInstance.currentPhase, "NIGHT");

    // 襲撃アクション（人狼がオーナーを襲撃）
    const finalAttackResponse = await apiRequest("POST", `/games/${gameId}/attack`, {
      targetPlayerId: ownerAuth.user.id,
    }, werewolfAuth.token);
    await consumeResponse(finalAttackResponse);

    // 3日目の昼フェーズへ進行
    await gameLogic.advancePhase(gameId);
    
    // 更新されたゲームインスタンスを再取得
    gameInstance = await gameModel.getGameById(gameId);
    if (!gameInstance) {
      throw new Error("Game not found after final night");
    }
    
    // オーナーが襲撃され、ゲームが終了していることを確認
    const ownerPlayer = gameInstance.players.find((p) => p.playerId === ownerAuth.user.id)!;
    assertEquals(ownerPlayer.isAlive, false);
    assertEquals(ownerPlayer.deathCause, "WEREWOLF_ATTACK");

    // 勝利条件の確認（人狼陣営の勝利）
    assertEquals(gameInstance.status, "FINISHED");
    assertEquals(gameInstance.winner, "WEREWOLVES");

    await cleanupScenarioTest();
  },
});
