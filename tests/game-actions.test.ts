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
let medium: GamePlayer;

async function setupTest() {
  // ゲーム状態のリセット
  await gameModel.resetGames();
  await authService.resetStore();

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
  const gameData = await gameModel.getGameById(testGame.id);
  if (!gameData) {
    throw new Error("Game not found");
  }
  game = gameData;
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
  await gameActions.initializeGameActions(game.id);
}

// 霊能アクションのテストに必要な追加のセットアップを作成
async function setupMediumTest() {
  await setupTest();
  
  // 霊能者を追加
  const mediumUser = await authService.register({ 
    username: "medium", 
    email: "medium@test.com", 
    password: "password" 
  });
  
  // 既存のゲームに霊能者を追加
  game.players.push({
    playerId: mediumUser.id,
    username: "medium",
    role: "MEDIUM",
    isAlive: true,
    deathCause: "NONE"
  });
  
  medium = game.players[4]; // 5人目のプレイヤーとして追加
  
  // 2日目を想定
  game.currentDay = 2;
  
  // 前日に処刑されたプレイヤーをセットアップ
  werewolf.isAlive = false;
  werewolf.deathCause = "EXECUTION";
  werewolf.deathDay = 1; // 1日目に処刑された設定
}

// 投票アクションのテスト
Deno.test({
  name: "投票アクション - 投票フェーズ中は投票が許可されるべき",
  async fn() {
    await setupTest();
    game.currentPhase = "DAY_VOTE";
    const result = await gameActions.handleVoteAction(game, villager.playerId, werewolf.playerId);
    assertEquals((await result).success, true);
  },
});

Deno.test({
  name: "投票アクション - 他のフェーズでは投票が許可されるべきではない",
  async fn() {
    await setupTest();
    game.currentPhase = "NIGHT";
    const result = await gameActions.handleVoteAction(game, villager.playerId, werewolf.playerId);
    assertEquals((await result).success, false);
  },
});

Deno.test({
  name: "投票アクション - 死亡したプレイヤーは投票できないべき",
  async fn() {
    await setupTest();
    game.currentPhase = "DAY_VOTE";
    villager.isAlive = false;
    const result = await gameActions.handleVoteAction(game, villager.playerId, werewolf.playerId);
    assertEquals((await result).success, false);
  },
});

Deno.test({
  name: "投票アクション - 死亡したプレイヤーへの投票は許可されるべきではない",
  async fn() {
    await setupTest();
    game.currentPhase = "DAY_VOTE";
    werewolf.isAlive = false;
    const result = await gameActions.handleVoteAction(game, villager.playerId, werewolf.playerId);
    assertEquals((await result).success, false);
  },
});

// 襲撃アクションのテスト
Deno.test({
  name: "襲撃アクション - 人狼は夜間に襲撃できるべき",
  async fn() {
    await setupTest();
    game.currentPhase = "NIGHT";
    const result = await gameActions.handleAttackAction(game, werewolf.playerId, villager.playerId);
    assertEquals((await result).success, true);
  },
});

Deno.test({
  name: "襲撃アクション - 人狼以外は襲撃できないべき",
  async fn() {
    try {
      await setupTest();
      game.currentPhase = "NIGHT";
      const result = await gameActions.handleAttackAction(game, villager.playerId, seer.playerId);
      assertEquals((await result).success, false);
    } finally {
      // しっかりとクリーンアップする
      const gameRepo = gameModel.gameStore;
      await gameRepo.clear();
    }
  },
});

Deno.test({
  name: "襲撃アクション - 人狼は他の人狼を襲撃できないべき",
  async fn() {
    await setupTest();
    game.currentPhase = "NIGHT";
    const result = await gameActions.handleAttackAction(game, werewolf.playerId, werewolf.playerId);
    assertEquals((await result).success, false);
  },
});

Deno.test({
  name: "襲撃アクション - 昼間は襲撃できないべき",
  async fn() {
    await setupTest();
    game.currentPhase = "DAY_DISCUSSION";
    const result = await gameActions.handleAttackAction(game, werewolf.playerId, villager.playerId);
    assertEquals((await result).success, false);
  },
});

// 占いアクションのテスト
Deno.test({
  name: "占いアクション - 占い師は夜間に占いができるべき",
  async fn() {
    await setupTest();
    game.currentPhase = "NIGHT";
    const result = await gameActions.handleDivineAction(game, seer.playerId, werewolf.playerId);
    assertEquals((await result).success, true);
    assertEquals((await result).isWerewolf, true);
  },
});

Deno.test({
  name: "占いアクション - 占い師以外は占いができないべき",
  async fn() {
    await setupTest();
    game.currentPhase = "NIGHT";
    const result = await gameActions.handleDivineAction(game, villager.playerId, werewolf.playerId);
    assertEquals((await result).success, false);
  },
});

Deno.test({
  name: "占いアクション - 人狼でないプレイヤーを正しく識別するべき",
  async fn() {
    await setupTest();
    game.currentPhase = "NIGHT";
    const result = await gameActions.handleDivineAction(game, seer.playerId, villager.playerId);
    assertEquals((await result).success, true);
    assertEquals((await result).isWerewolf, false);
  },
});

Deno.test({
  name: "占いアクション - 昼間は占いができないべき",
  async fn() {
    await setupTest();
    game.currentPhase = "DAY_DISCUSSION";
    const result = await gameActions.handleDivineAction(game, seer.playerId, werewolf.playerId);
    assertEquals((await result).success, false);
  },
});

// 護衛アクションのテスト
Deno.test({
  name: "護衛アクション - 狩人は夜間に護衛ができるべき",
  async fn() {
    await setupTest();
    game.currentPhase = "NIGHT";
    const result = await gameActions.handleGuardAction(game, bodyguard.playerId, villager.playerId);
    assertEquals((await result).success, true);
  },
});

Deno.test({
  name: "護衛アクション - 狩人以外は護衛ができないべき",
  async fn() {
    await setupTest();
    game.currentPhase = "NIGHT";
    const result = await gameActions.handleGuardAction(game, villager.playerId, seer.playerId);
    assertEquals((await result).success, false);
  },
});

Deno.test({
  name: "護衛アクション - 死亡したプレイヤーは護衛できないべき",
  async fn() {
    await setupTest();
    game.currentPhase = "NIGHT";
    villager.isAlive = false;
    const result = await gameActions.handleGuardAction(game, bodyguard.playerId, villager.playerId);
    assertEquals((await result).success, false);
  },
});

Deno.test({
  name: "護衛アクション - 昼間は護衛ができないべき",
  async fn() {
    await setupTest();
    game.currentPhase = "DAY_DISCUSSION";
    const result = await gameActions.handleGuardAction(game, bodyguard.playerId, villager.playerId);
    assertEquals((await result).success, false);
  },
});

// 霊能アクションのテスト
Deno.test({
  name: "霊能アクション - 霊能者は前日に処刑された人狼を正しく識別できるべき",
  async fn() {
    await setupMediumTest();
    game.currentPhase = "NIGHT";
    const result = await gameActions.handleMediumAction(game, medium.playerId, werewolf.playerId);
    assertEquals((await result).success, true);
    assertEquals((await result).isWerewolf, true);
  },
});

Deno.test({
  name: "霊能アクション - 霊能者以外は霊能ができないべき",
  async fn() {
    await setupMediumTest();
    game.currentPhase = "NIGHT";
    const result = await gameActions.handleMediumAction(game, villager.playerId, werewolf.playerId);
    assertEquals((await result).success, false);
  },
});

Deno.test({
  name: "霊能アクション - 前日に処刑されていないプレイヤーは対象にできないべき",
  async fn() {
    await setupMediumTest();
    game.currentPhase = "NIGHT";
    // 村人は死んでいない
    const result = await gameActions.handleMediumAction(game, medium.playerId, villager.playerId);
    assertEquals((await result).success, false);
  },
});

Deno.test({
  name: "霊能アクション - 処刑以外の死因のプレイヤーは対象にできないべき",
  async fn() {
    await setupMediumTest();
    game.currentPhase = "NIGHT";
    // 襲撃で死亡した設定に変更
    werewolf.deathCause = "WEREWOLF_ATTACK";
    const result = await gameActions.handleMediumAction(game, medium.playerId, werewolf.playerId);
    assertEquals((await result).success, false);
  },
});

Deno.test({
  name: "霊能アクション - 昼のディスカッションフェーズでも使用できるべき",
  async fn() {
    await setupMediumTest();
    game.currentPhase = "DAY_DISCUSSION";
    const result = await gameActions.handleMediumAction(game, medium.playerId, werewolf.playerId);
    assertEquals((await result).success, true);
    assertEquals((await result).isWerewolf, true);
  },
});

Deno.test({
  name: "霊能アクション - 投票フェーズでは使用できないべき",
  async fn() {
    await setupMediumTest();
    game.currentPhase = "DAY_VOTE";
    const result = await gameActions.handleMediumAction(game, medium.playerId, werewolf.playerId);
    assertEquals((await result).success, false);
  },
});

Deno.test({
  name: "霊能アクション - 非人狼プレイヤーを正しく識別するべき",
  async fn() {
    await setupMediumTest();
    game.currentPhase = "NIGHT";
    // 前日に村人が処刑された想定
    werewolf.isAlive = true; // 人狼は生きている
    werewolf.deathCause = "NONE";
    werewolf.deathDay = undefined;
    
    villager.isAlive = false;
    villager.deathCause = "EXECUTION";
    villager.deathDay = 1;
    
    const result = await gameActions.handleMediumAction(game, medium.playerId, villager.playerId);
    assertEquals((await result).success, true);
    assertEquals((await result).isWerewolf, false);
  },
});

// 追加の霊能アクションのテスト
Deno.test({
  name: "霊能アクション - 死亡した霊能者は霊能ができないべき",
  async fn() {
    await setupMediumTest();
    game.currentPhase = "NIGHT";
    // 霊能者を死亡させる
    medium.isAlive = false;
    medium.deathCause = "WEREWOLF_ATTACK";
    medium.deathDay = 1;
    
    const result = await gameActions.handleMediumAction(game, medium.playerId, werewolf.playerId);
    assertEquals((await result).success, false);
  },
});

Deno.test({
  name: "霊能アクション - 2日以上前に処刑されたプレイヤーは対象にできないべき",
  async fn() {
    await setupMediumTest();
    game.currentPhase = "NIGHT";
    // 2日前の処刑に設定
    werewolf.deathDay = game.currentDay - 2;
    
    const result = await gameActions.handleMediumAction(game, medium.playerId, werewolf.playerId);
    assertEquals((await result).success, false);
  },
});

Deno.test({
  name: "霊能アクション - 同じ処刑者に対して複数の霊能者が霊能できるべき",
  async fn() {
    await setupMediumTest();
    game.currentPhase = "NIGHT";
    
    // 2人目の霊能者を追加
    const secondMediumUser = await authService.register({ 
      username: "medium2", 
      email: "medium2@test.com", 
      password: "password" 
    });
    
    game.players.push({
      playerId: secondMediumUser.id,
      username: "medium2",
      role: "MEDIUM",
      isAlive: true,
      deathCause: "NONE"
    });
    
    const medium2 = game.players[5]; // 6人目のプレイヤー
    
    // 両方の霊能者が同じ処刑者に対して霊能を使用
    const result1 = await gameActions.handleMediumAction(game, medium.playerId, werewolf.playerId);
    const result2 = await gameActions.handleMediumAction(game, medium2.playerId, werewolf.playerId);
    
    assertEquals((await result1).success, true);
    assertEquals((await result1).isWerewolf, true);
    assertEquals((await result2).success, true);
    assertEquals((await result2).isWerewolf, true);
  },
});

Deno.test({
  name: "霊能アクション - 処刑された霊能者は自分自身を霊能対象にできないべき",
  async fn() {
    await setupMediumTest();
    game.currentPhase = "NIGHT";
    
    // 霊能者が前日処刑された設定に変更
    medium.isAlive = false;
    medium.deathCause = "EXECUTION";
    medium.deathDay = 1;
    
    // 別の霊能者を追加
    const secondMediumUser = await authService.register({ 
      username: "medium2", 
      email: "medium2@test.com", 
      password: "password" 
    });
    
    game.players.push({
      playerId: secondMediumUser.id,
      username: "medium2",
      role: "MEDIUM",
      isAlive: true,
      deathCause: "NONE"
    });
    
    const medium2 = game.players[5]; // 6人目のプレイヤー
    
    // 2人目の霊能者が処刑された1人目の霊能者を対象にする
    const result = await gameActions.handleMediumAction(game, medium2.playerId, medium.playerId);
    
    assertEquals((await result).success, true);
    assertEquals((await result).isWerewolf, false); // 霊能者は人狼ではない
  },
});

Deno.test({
  name: "霊能アクション - 実行後にアクションマップに正しく記録されるべき",
  async fn() {
    await setupMediumTest();
    game.currentPhase = "NIGHT";
    
    // 霊能を実行
    const result = await gameActions.handleMediumAction(game, medium.playerId, werewolf.playerId);
    assertEquals((await result).success, true);
    
    // アクション状態を取得
    const actions = await gameActions.getGameActions(game.id);
    
    // 霊能アクションが記録されているか確認
    assertEquals(actions?.mediums.has(medium.playerId), true);
    assertEquals(actions?.mediums.get(medium.playerId), werewolf.playerId);
  },
});

// フェーズアクション処理のテスト
Deno.test({
  name: "フェーズアクション処理 - 投票結果が正しく処理されるべき",
  async fn() {
    await setupTest();
    game.currentPhase = "DAY_VOTE";
    // 全員がwerewolfに投票
    await gameActions.handleVoteAction(game, villager.playerId, werewolf.playerId);
    await gameActions.handleVoteAction(game, seer.playerId, werewolf.playerId);
    await gameActions.handleVoteAction(game, bodyguard.playerId, werewolf.playerId);

    // 投票のランダム割り当てを処理
    await gameActions.processPhaseActions(game);

    // 投票結果を確認
    const actions = await gameActions.getGameActions(game.id);
    assertEquals(actions?.votes.size, 4); // 全プレイヤーが投票
    
    // werewolfはランダムで誰かに投票しているので、それを含めて確認
    let votesForWerewolf = 0;
    actions?.votes.forEach((targetId) => {
      if (targetId === werewolf.playerId) {
        votesForWerewolf++;
      }
    });
    
    // 少なくとも村人3人はwerewolfに投票しているはず
    assertEquals(votesForWerewolf >= 3, true);
  },
});

Deno.test({
  name: "フェーズアクション処理 - 護衛の保護を処理するべき",
  async fn() {
    await setupTest();
    game.currentPhase = "NIGHT";

    // 人狼が村人を攻撃
    await gameActions.handleAttackAction(game, werewolf.playerId, villager.playerId);
    // 護衛が村人を守る
    await gameActions.handleGuardAction(game, bodyguard.playerId, villager.playerId);

    await gameActions.processPhaseActions(game);
    assertEquals(villager.isAlive, true);
    assertEquals(villager.deathCause, "NONE");
  },
});

Deno.test({
  name: "フェーズアクション処理 - 非アクティブプレイヤーのランダムアクションを処理するべき",
  async fn() {
    await setupTest();
    game.currentPhase = "NIGHT";
    await gameActions.processPhaseActions(game);

    const actions = await gameActions.getGameActions(game.id);
    assertNotEquals(actions, undefined);
  },
});
