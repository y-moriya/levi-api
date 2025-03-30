import {
  assertEquals,
} from "https://deno.land/std@0.210.0/assert/mod.ts";
import { apiRequest, consumeResponse } from "../helpers/api.ts";
import { GameResponse, ActionResponse, DivineActionResponse } from "../helpers/types.ts";
import * as gameModel from "../../models/game.ts";
import * as gameLogic from "../../services/game-logic.ts";
import { setupScenarioTest, cleanupScenarioTest, TestUsers, AuthenticatedUser } from "./game-scenario-common.ts";

let gameId: string;
let users: TestUsers;

// Complete game scenario test - Werewolf Victory
Deno.test({
  name: "Complete Game Scenario - Werewolf Victory",
  async fn() {
    users = await setupScenarioTest();
    const { ownerAuth, werewolfAuth, seerAuth, bodyguardAuth, villagerAuth } = users;

    // 1. ゲームの作成
    const createResponse = await apiRequest("POST", "/games", {
      name: "Werewolf Victory Scenario",
      maxPlayers: 5
    }, ownerAuth.token);
    const game = await consumeResponse<GameResponse>(createResponse);
    gameId = game.id;

    // 2. プレイヤーの参加
    const players = [werewolfAuth, seerAuth, bodyguardAuth, villagerAuth];
    for (const player of players) {
      const joinResponse = await apiRequest("POST", `/games/${gameId}/join`, undefined, player.token);
      await consumeResponse<GameResponse>(joinResponse);
    }

    // 3. ゲーム開始
    const startResponse = await apiRequest("POST", `/games/${gameId}/start`, undefined, ownerAuth.token);
    const startedGame = await consumeResponse<GameResponse>(startResponse);
    assertEquals(startResponse.status, 200);
    assertEquals(startedGame.status, "IN_PROGRESS");

    // 役職の割り当て（テスト用に固定）
    const gameInstance = gameModel.getGameById(gameId)!;
    gameInstance.players.find(p => p.playerId === werewolfAuth.user.id)!.role = "WEREWOLF";
    gameInstance.players.find(p => p.playerId === seerAuth.user.id)!.role = "SEER";
    gameInstance.players.find(p => p.playerId === bodyguardAuth.user.id)!.role = "BODYGUARD";
    gameInstance.players.find(p => p.playerId === villagerAuth.user.id)!.role = "VILLAGER";
    gameInstance.players.find(p => p.playerId === ownerAuth.user.id)!.role = "VILLAGER";

    // Day 1: 昼フェーズから開始
    assertEquals(gameInstance.currentPhase, "DAY_DISCUSSION");

    // Day 1: 投票フェーズへ移行
    gameLogic.advancePhase(gameInstance);
    assertEquals(gameInstance.currentPhase, "DAY_VOTE");

    // アクション状態の初期化を待機
    await new Promise(resolve => setTimeout(resolve, 200));

    // 投票の実行（全員がbodyguardに投票）
    for (const player of [ownerAuth, werewolfAuth, seerAuth, bodyguardAuth, villagerAuth]) {
      const voteResponse = await apiRequest("POST", `/games/${gameId}/vote`, {
        targetPlayerId: bodyguardAuth.user.id
      }, player.token);
      const voteResult = await consumeResponse<ActionResponse>(voteResponse);
      assertEquals(voteResult.success, true);
    }

    // ゲームフェーズの進行（投票の処理を含む）
    gameLogic.handlePhaseEnd(gameInstance);
    assertEquals(gameInstance.currentPhase, "NIGHT");

    // アクション状態の初期化を待機
    await new Promise(resolve => setTimeout(resolve, 200));

    // 占い師のアクション
    const divineResponse = await apiRequest("POST", `/games/${gameId}/divine`, {
      targetPlayerId: villagerAuth.user.id
    }, seerAuth.token);
    const divineResult = await consumeResponse<DivineActionResponse>(divineResponse);
    assertEquals(divineResult.success, true);
    assertEquals(divineResult.isWerewolf, false);

    // 人狼の襲撃
    const attackResponse = await apiRequest("POST", `/games/${gameId}/attack`, {
      targetPlayerId: seerAuth.user.id
    }, werewolfAuth.token);
    const attackResult = await consumeResponse<ActionResponse>(attackResponse);
    assertEquals(attackResult.success, true);

    // 護衛は別のプレイヤーを護衛
    // bodyguardは処刑済みなので、護衛アクションは無効
    // const guardResponse = await apiRequest("POST", `/games/${gameId}/guard`, {
    //   targetPlayerId: villagerAuth.user.id
    // }, bodyguardAuth.token);
    // const guardResult = await consumeResponse<ActionResponse>(guardResponse);
    // assertEquals(guardResult.success, true);

    // ゲームフェーズの進行（夜アクションの処理を含む）
    gameLogic.handlePhaseEnd(gameInstance);
    assertEquals(gameInstance.currentPhase, "DAY_DISCUSSION");

    const seerPlayer = gameInstance.players.find(p => p.playerId === seerAuth.user.id)!;
    assertEquals(seerPlayer.isAlive, false);
    assertEquals(seerPlayer.deathCause, "WEREWOLF_ATTACK");

    // Day 2: 投票フェーズへ
    gameLogic.handlePhaseEnd(gameInstance);
    assertEquals(gameInstance.currentPhase, "DAY_VOTE");

    // 生存者のみを対象に投票を実行
    const livingPlayers = gameInstance.players.filter(p => p.isAlive);
    for (const player of livingPlayers) {
      let voterAuth: AuthenticatedUser | undefined;
      
      // 投票者のAuthenticatedUserを取得
      if (player.playerId === ownerAuth.user.id) voterAuth = ownerAuth;
      else if (player.playerId === werewolfAuth.user.id) voterAuth = werewolfAuth;
      else if (player.playerId === bodyguardAuth.user.id) voterAuth = bodyguardAuth;
      else if (player.playerId === villagerAuth.user.id) voterAuth = villagerAuth;
      
      if (voterAuth) {
        // 全員が村人に投票
        const voteResponse = await apiRequest("POST", `/games/${gameId}/vote`, {
          targetPlayerId: villagerAuth.user.id
        }, voterAuth.token);
        const voteResult = await consumeResponse<ActionResponse>(voteResponse);
        assertEquals(voteResult.success, true);
      }
    }

    // // ゲームフェーズの進行（投票の処理を含む）
    gameLogic.handlePhaseEnd(gameInstance);
    // 投票でゲームは終了
    // assertEquals(gameInstance.currentPhase, "NIGHT");

    // // 人狼の襲撃
    // const attack2Response = await apiRequest("POST", `/games/${gameId}/attack`, {
    //   targetPlayerId: bodyguardAuth.user.id
    // }, werewolfAuth.token);
    // const attack2Result = await consumeResponse<ActionResponse>(attack2Response);
    // assertEquals(attack2Result.success, true);

    // // ゲームフェーズの進行（夜アクションの処理を含む）
    // gameLogic.handlePhaseEnd(gameInstance);

    // const bodyguardPlayer = gameInstance.players.find(p => p.playerId === bodyguardAuth.user.id)!;
    // assertEquals(bodyguardPlayer.isAlive, false);
    // assertEquals(bodyguardPlayer.deathCause, "WEREWOLF_ATTACK");

    // 勝利条件の確認（人狼の勝利）
    assertEquals(gameInstance.status, "FINISHED");
    assertEquals(gameInstance.winner, "WEREWOLVES");

    await cleanupScenarioTest();
  }
});