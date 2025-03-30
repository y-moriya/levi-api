import { assertEquals } from "https://deno.land/std@0.210.0/assert/mod.ts";
import { apiRequest, consumeResponse } from "../helpers/api.ts";
import * as gameModel from "../../models/game.ts";
import * as gameLogic from "../../services/game-logic.ts";
import * as gameActions from "../../services/game-actions.ts";
import { cleanupScenarioTest, setupScenarioTest, TestUsers } from "./game-scenario-common.ts";
import { GameResponse } from "../helpers/types.ts";

let gameId: string;
let users: TestUsers;

// Complete game scenario test - Village Victory
Deno.test({
  name: "Complete Game Scenario - Village Victory",
  async fn() {
    users = await setupScenarioTest();
    const { ownerAuth, werewolfAuth, seerAuth, bodyguardAuth, villagerAuth } = users;

    // 1. ゲームの作成
    const createResponse = await apiRequest("POST", "/games", {
      name: "Village Victory Scenario",
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

    // 役職の割り当て（テスト用に固定）
    const gameInstance = gameModel.getGameById(gameId)!;
    gameInstance.players.find((p) => p.playerId === werewolfAuth.user.id)!.role = "WEREWOLF";
    gameInstance.players.find((p) => p.playerId === seerAuth.user.id)!.role = "SEER";
    gameInstance.players.find((p) => p.playerId === bodyguardAuth.user.id)!.role = "BODYGUARD";
    gameInstance.players.find((p) => p.playerId === villagerAuth.user.id)!.role = "VILLAGER";
    gameInstance.players.find((p) => p.playerId === ownerAuth.user.id)!.role = "VILLAGER";

    // Day 1: 昼フェーズから開始
    assertEquals(gameInstance.currentPhase, "DAY_DISCUSSION");

    // Day 1: 投票フェーズ
    gameLogic.advancePhase(gameInstance);
    assertEquals(gameInstance.currentPhase, "DAY_VOTE");

    // アクション状態を初期化
    gameActions.initializeGameActions(gameId);

    // 全員が人狼に投票
    for (const player of [ownerAuth, seerAuth, bodyguardAuth, villagerAuth]) {
      const voteResponse = await apiRequest("POST", `/games/${gameId}/vote`, {
        targetPlayerId: werewolfAuth.user.id,
      }, player.token);
      const voteResult = await consumeResponse<{ success: boolean }>(voteResponse);
      assertEquals(voteResult.success, true);
    }

    // ゲームフェーズの進行（投票の処理を含む）
    gameLogic.handlePhaseEnd(gameInstance);

    const werewolfPlayer = gameInstance.players.find((p) => p.playerId === werewolfAuth.user.id)!;
    assertEquals(werewolfPlayer.isAlive, false);
    assertEquals(werewolfPlayer.deathCause, "EXECUTION");

    // 勝利条件の確認（村人陣営の勝利）
    assertEquals(gameInstance.status, "FINISHED");
    assertEquals(gameInstance.winner, "VILLAGERS");

    await cleanupScenarioTest();
  },
});
