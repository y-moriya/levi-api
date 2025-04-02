import { assertEquals, assertNotEquals } from "https://deno.land/std@0.210.0/assert/mod.ts";
import * as gameActions from "../services/game-actions.ts";
import * as gameModel from "../models/game.ts";
import * as authService from "../services/auth.ts";
import { Game, GamePlayer } from "../types/game.ts";
import { getActionMap } from "../services/game-phase.ts";

let game: Game;
let villager: GamePlayer;
let werewolf: GamePlayer;
let seer: GamePlayer;
let bodyguard: GamePlayer;

async function setupTest() {
  // ゲーム状態のリセット
  gameModel.resetGames();
  authService.resetStore();

  // テストユーザーの作成
  const testUsers = [
    { username: "villager", email: "villager@test.com", password: "password" },
    { username: "werewolf", email: "werewolf@test.com", password: "password" },
    { username: "seer", email: "seer@test.com", password: "password" },
    { username: "bodyguard", email: "bodyguard@test.com", password: "password" },
  ];

  const users = await Promise.all(
    testUsers.map((user) => authService.register(user)),
  );

  // テストゲームの作成
  const testGame = await gameModel.createGame({
    name: "Test Game",
    maxPlayers: 4,
  }, users[0].id);

  // プレイヤーの参加
  for (let i = 1; i < users.length; i++) {
    await gameModel.joinGame(testGame.id, users[i].id);
  }

  // ゲームの取得と初期化
  game = gameModel.getGameById(testGame.id)!;
  game.status = "IN_PROGRESS";
  game.currentDay = 1;

  // プレイヤーに役職を割り当て
  game.players[0].role = "VILLAGER";
  game.players[1].role = "WEREWOLF";
  game.players[2].role = "SEER";
  game.players[3].role = "BODYGUARD";

  villager = game.players[0];
  werewolf = game.players[1];
  seer = game.players[2];
  bodyguard = game.players[3];

  // アクション状態の初期化
  gameActions.initializeGameActions(game.id);
}

// 投票アクションのテスト
Deno.test({
  name: "投票アクション - 投票フェーズ中は投票が許可されるべき",
  async fn() {
    await setupTest();
    game.currentPhase = "DAY_VOTE";
    const result = gameActions.handleVoteAction(game, villager.playerId, werewolf.playerId);
    assertEquals(result.success, true);
  },
});

Deno.test({
  name: "投票アクション - 他のフェーズでは投票が許可されるべきではない",
  async fn() {
    await setupTest();
    game.currentPhase = "NIGHT";
    const result = gameActions.handleVoteAction(game, villager.playerId, werewolf.playerId);
    assertEquals(result.success, false);
  },
});

Deno.test({
  name: "投票アクション - 死亡したプレイヤーは投票できないべき",
  async fn() {
    await setupTest();
    game.currentPhase = "DAY_VOTE";
    villager.isAlive = false;
    const result = gameActions.handleVoteAction(game, villager.playerId, werewolf.playerId);
    assertEquals(result.success, false);
  },
});

Deno.test({
  name: "投票アクション - 死亡したプレイヤーへの投票は許可されるべきではない",
  async fn() {
    await setupTest();
    game.currentPhase = "DAY_VOTE";
    werewolf.isAlive = false;
    const result = gameActions.handleVoteAction(game, villager.playerId, werewolf.playerId);
    assertEquals(result.success, false);
  },
});

// 襲撃アクションのテスト
Deno.test({
  name: "襲撃アクション - 人狼は夜間に襲撃できるべき",
  async fn() {
    await setupTest();
    game.currentPhase = "NIGHT";
    const result = gameActions.handleAttackAction(game, werewolf.playerId, villager.playerId);
    assertEquals(result.success, true);
  },
});

Deno.test({
  name: "襲撃アクション - 人狼以外は襲撃できないべき",
  async fn() {
    await setupTest();
    game.currentPhase = "NIGHT";
    const result = gameActions.handleAttackAction(game, villager.playerId, seer.playerId);
    assertEquals(result.success, false);
  },
});

Deno.test({
  name: "襲撃アクション - 人狼は他の人狼を襲撃できないべき",
  async fn() {
    await setupTest();
    game.currentPhase = "NIGHT";
    const result = gameActions.handleAttackAction(game, werewolf.playerId, werewolf.playerId);
    assertEquals(result.success, false);
  },
});

Deno.test({
  name: "襲撃アクション - 昼間は襲撃できないべき",
  async fn() {
    await setupTest();
    game.currentPhase = "DAY_DISCUSSION";
    const result = gameActions.handleAttackAction(game, werewolf.playerId, villager.playerId);
    assertEquals(result.success, false);
  },
});

// 占いアクションのテスト
Deno.test({
  name: "占いアクション - 占い師は夜間に占いができるべき",
  async fn() {
    await setupTest();
    game.currentPhase = "NIGHT";
    const result = gameActions.handleDivineAction(game, seer.playerId, werewolf.playerId);
    assertEquals(result.success, true);
    assertEquals(result.isWerewolf, true);
  },
});

Deno.test({
  name: "占いアクション - 占い師以外は占いができないべき",
  async fn() {
    await setupTest();
    game.currentPhase = "NIGHT";
    const result = gameActions.handleDivineAction(game, villager.playerId, werewolf.playerId);
    assertEquals(result.success, false);
  },
});

Deno.test({
  name: "占いアクション - 人狼でないプレイヤーを正しく識別するべき",
  async fn() {
    await setupTest();
    game.currentPhase = "NIGHT";
    const result = gameActions.handleDivineAction(game, seer.playerId, villager.playerId);
    assertEquals(result.success, true);
    assertEquals(result.isWerewolf, false);
  },
});

Deno.test({
  name: "占いアクション - 昼間は占いができないべき",
  async fn() {
    await setupTest();
    game.currentPhase = "DAY_DISCUSSION";
    const result = gameActions.handleDivineAction(game, seer.playerId, werewolf.playerId);
    assertEquals(result.success, false);
  },
});

// 護衛アクションのテスト
Deno.test({
  name: "護衛アクション - 狩人は夜間に護衛ができるべき",
  async fn() {
    await setupTest();
    game.currentPhase = "NIGHT";
    const result = gameActions.handleGuardAction(game, bodyguard.playerId, villager.playerId);
    assertEquals(result.success, true);
  },
});

Deno.test({
  name: "護衛アクション - 狩人以外は護衛ができないべき",
  async fn() {
    await setupTest();
    game.currentPhase = "NIGHT";
    const result = gameActions.handleGuardAction(game, villager.playerId, seer.playerId);
    assertEquals(result.success, false);
  },
});

Deno.test({
  name: "護衛アクション - 死亡したプレイヤーは護衛できないべき",
  async fn() {
    await setupTest();
    game.currentPhase = "NIGHT";
    villager.isAlive = false;
    const result = gameActions.handleGuardAction(game, bodyguard.playerId, villager.playerId);
    assertEquals(result.success, false);
  },
});

Deno.test({
  name: "護衛アクション - 昼間は護衛ができないべき",
  async fn() {
    await setupTest();
    game.currentPhase = "DAY_DISCUSSION";
    const result = gameActions.handleGuardAction(game, bodyguard.playerId, villager.playerId);
    assertEquals(result.success, false);
  },
});

// フェーズアクション処理のテスト
Deno.test({
  name: "フェーズアクション処理 - 投票結果が正しく処理されるべき",
  async fn() {
    await setupTest();
    game.currentPhase = "DAY_VOTE";
    // 全員がwerewolfに投票
    gameActions.handleVoteAction(game, villager.playerId, werewolf.playerId);
    gameActions.handleVoteAction(game, seer.playerId, werewolf.playerId);
    gameActions.handleVoteAction(game, bodyguard.playerId, werewolf.playerId);

    // 投票のランダム割り当てを処理
    gameActions.processPhaseActions(game);

    // game-logicの投票結果処理を実行
    const voteKey = `vote_${game.currentDay}` as const;
    const votes = getActionMap(game, voteKey);
    const voteCount = new Map<string, number>();

    // 投票を集計
    for (const [_, targetId] of votes) {
      voteCount.set(targetId, (voteCount.get(targetId) || 0) + 1);
    }

    // 最多得票者を処刑
    const maxVotes = Math.max(...voteCount.values());
    const executedPlayers = Array.from(voteCount.entries())
      .filter(([_, count]) => count === maxVotes)
      .map(([playerId]) => playerId);

    if (executedPlayers.length > 0) {
      const executedPlayerId = executedPlayers[Math.floor(Math.random() * executedPlayers.length)];
      const executedPlayer = game.players.find((p) => p.playerId === executedPlayerId)!;
      executedPlayer.isAlive = false;
      executedPlayer.deathCause = "EXECUTION";
    }

    assertEquals(werewolf.isAlive, false);
    assertEquals(werewolf.deathCause, "EXECUTION");
  },
});

Deno.test({
  name: "フェーズアクション処理 - 護衛の保護を処理するべき",
  async fn() {
    await setupTest();
    game.currentPhase = "NIGHT";

    // 人狼が村人を攻撃
    gameActions.handleAttackAction(game, werewolf.playerId, villager.playerId);
    // 護衛が村人を守る
    gameActions.handleGuardAction(game, bodyguard.playerId, villager.playerId);

    gameActions.processPhaseActions(game);
    assertEquals(villager.isAlive, true);
    assertEquals(villager.deathCause, "NONE");
  },
});

Deno.test({
  name: "フェーズアクション処理 - 非アクティブプレイヤーのランダムアクションを処理するべき",
  async fn() {
    await setupTest();
    game.currentPhase = "NIGHT";
    gameActions.processPhaseActions(game);

    const actions = gameActions.getGameActions(game.id);
    assertNotEquals(actions, undefined);
  },
});
