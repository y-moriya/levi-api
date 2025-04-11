// filepath: c:\Users\wellk\project\levi-api\tests\helpers\fixtures.ts
import { Game, Role } from "../../types/game.ts";
import { User } from "../../types/user.ts";

/**
 * テスト用のユーザーフィクスチャー
 */
export const userFixtures = {
  /**
   * 基本的なユーザーデータを作成する
   * @param suffix ユーザー名・メールアドレスのサフィックス
   */
  createBasicUser: (suffix: string = ""): Omit<User, "id" | "createdAt"> => ({
    username: `testuser${suffix}`,
    email: `testuser${suffix}@example.com`,
    password: `password123${suffix}`,
    stats: {
      gamesPlayed: 0,
      gamesWon: 0,
      winRatio: 0,
      villagerWins: 0,
      werewolfWins: 0,
    },
  }),

  /**
   * 管理者ユーザーデータを作成する
   */
  createAdminUser: (): Omit<User, "id" | "createdAt"> => ({
    username: "admin",
    email: "admin@example.com",
    password: "admin123",
    stats: {
      gamesPlayed: 0,
      gamesWon: 0,
      winRatio: 0,
      villagerWins: 0,
      werewolfWins: 0,
    },
  }),
};

/**
 * テスト用のゲームフィクスチャー
 */
export const gameFixtures = {
  /**
   * 基本的なゲーム作成パラメータを作成する
   */
  createBasicGame: (suffix: string = "") => ({
    name: `テストゲーム${suffix}`,
    maxPlayers: 5,
    settings: {
      roles: {
        werewolfCount: 2,
        seerCount: 1,
        bodyguardCount: 1,
        mediumCount: 0,
      },
      dayTimeSeconds: 60,
      nightTimeSeconds: 40,
      voteTimeSeconds: 30,
    },
  }),

  /**
   * 大規模ゲーム作成パラメータを作成する
   */
  createLargeGame: () => ({
    name: "大規模テストゲーム",
    maxPlayers: 15,
    settings: {
      roles: {
        werewolfCount: 3,
        seerCount: 1,
        bodyguardCount: 1,
        mediumCount: 1,
      },
      dayTimeSeconds: 120,
      nightTimeSeconds: 80,
      voteTimeSeconds: 60,
    },
  }),

  /**
   * 5人村のロールセット
   */
  fivePlayerRoles: {
    standard: {
      0: "VILLAGER" as Role,
      1: "WEREWOLF" as Role,
      2: "SEER" as Role,
      3: "BODYGUARD" as Role,
      4: "VILLAGER" as Role,
    },
    werewolfHeavy: {
      0: "WEREWOLF" as Role,
      1: "WEREWOLF" as Role,
      2: "VILLAGER" as Role,
      3: "SEER" as Role,
      4: "BODYGUARD" as Role,
    },
    villagerHeavy: {
      0: "VILLAGER" as Role,
      1: "VILLAGER" as Role,
      2: "VILLAGER" as Role,
      3: "WEREWOLF" as Role,
      4: "SEER" as Role,
    },
  },

  /**
   * ゲーム状態をプリセットする
   */
  presetGameState: {
    /**
     * 初日昼のディスカッションフェーズにセットする
     */
    dayOneDiscussion: (game: Game): Game => {
      game.status = "IN_PROGRESS";
      game.currentDay = 1;
      game.currentPhase = "DAY_DISCUSSION";
      game.winner = "NONE";
      return game;
    },

    /**
     * 初日投票フェーズにセットする
     */
    dayOneVote: (game: Game): Game => {
      game.status = "IN_PROGRESS";
      game.currentDay = 1;
      game.currentPhase = "DAY_VOTE";
      game.winner = "NONE";
      return game;
    },

    /**
     * 初日夜フェーズにセットする
     */
    dayOneNight: (game: Game): Game => {
      game.status = "IN_PROGRESS";
      game.currentDay = 1;
      game.currentPhase = "NIGHT";
      game.winner = "NONE";
      return game;
    },
  },
};

/**
 * テスト用のチャットメッセージフィクスチャー
 */
export const chatFixtures = {
  /**
   * 全体チャットメッセージを作成する
   */
  createGeneralMessage: (userId: string, content: string = "こんにちは") => ({
    channel: "GLOBAL",
    content,
    senderId: userId,
  }),

  /**
   * 人狼チャットメッセージを作成する
   */
  createWerewolfMessage: (userId: string, content: string = "作戦を立てよう") => ({
    channel: "WEREWOLF",
    content,
    senderId: userId,
  }),
};

/**
 * テスト用の投票アクションフィクスチャー
 */
export const voteFixtures = {
  /**
   * 投票アクションを作成する
   */
  createVoteAction: (voterId: string, targetId: string) => ({
    actionType: "VOTE",
    targetPlayerId: targetId,
    playerId: voterId,
  }),
};

/**
 * テスト用の人狼アクションフィクスチャー
 */
export const werewolfFixtures = {
  /**
   * 襲撃アクションを作成する
   */
  createAttackAction: (werewolfId: string, targetId: string) => ({
    actionType: "WEREWOLF_ATTACK",
    targetPlayerId: targetId,
    playerId: werewolfId,
  }),
};

/**
 * テスト用の占い師アクションフィクスチャー
 */
export const seerFixtures = {
  /**
   * 占いアクションを作成する
   */
  createDivinationAction: (seerId: string, targetId: string) => ({
    actionType: "DIVINATION",
    targetPlayerId: targetId,
    playerId: seerId,
  }),
};

/**
 * テスト用の守護者アクションフィクスチャー
 */
export const bodyguardFixtures = {
  /**
   * 護衛アクションを作成する
   */
  createProtectionAction: (bodyguardId: string, targetId: string) => ({
    actionType: "PROTECTION",
    targetPlayerId: targetId,
    playerId: bodyguardId,
  }),
};
