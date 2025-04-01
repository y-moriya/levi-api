import { assertEquals } from "https://deno.land/std@0.210.0/assert/mod.ts";
import { apiRequest, consumeResponse, waitForActionInitialization } from "../helpers/api.ts";
import * as gameModel from "../../models/game.ts";
import * as gameLogic from "../../services/game-logic.ts";
import { cleanupScenarioTest, setupScenarioTest, TestUsers } from "./game-scenario-common.ts";
import { GameResponse } from "../helpers/types.ts";

let gameId: string;
let users: TestUsers;

// 完全なゲームシナリオテスト - 村人陣営の勝利
Deno.test({
  name: "完全なゲームシナリオ - 村人陣営の勝利",
  sanitizeOps: false,
  sanitizeResources: false,
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

    // Day 1: 投票フェーズへ移行
    gameLogic.advancePhase(gameInstance);
    assertEquals(gameInstance.currentPhase, "DAY_VOTE");

    // アクション状態の初期化を待機
    await waitForActionInitialization(gameId);

    // 投票の実行（全員がwerewolfに投票）
    for (const player of [ownerAuth, werewolfAuth, seerAuth, bodyguardAuth, villagerAuth]) {
      const voteResponse = await apiRequest("POST", `/games/${gameId}/vote`, {
        targetPlayerId: werewolfAuth.user.id,
      }, player.token);
      await consumeResponse(voteResponse);
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
