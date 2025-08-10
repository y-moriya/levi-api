import { assertEquals, assertNotEquals } from "https://deno.land/std@0.210.0/assert/mod.ts";
import { apiRequest, consumeResponse, testServer, createAuthenticatedUser } from "../helpers/api.ts";
import { repositoryContainer } from "../../repositories/repository-container.ts";
import { getGameById } from "../../models/game.ts";
import app from "../../main.ts";
import * as authService from "../../services/auth.ts";
import * as gameModel from "../../models/game.ts";
import { GameResponse, ChatMessageResponse } from "../helpers/types.ts";

// サーバー状態を追跡
let isServerRunning = false;

// テストサーバーのセットアップとクリーンアップ
async function setupTests() {
  authService.resetStore();
  gameModel.resetGames();
  try {
    if (!isServerRunning) {
      await testServer.start(app);
      isServerRunning = true;
    }
  } catch (error) {
    console.error("テストサーバーの起動に失敗しました:", error);
    throw error;
  }
}

async function cleanupTests() {
  try {
    // サーバーは停止せず、再利用する
    authService.resetStore();
    gameModel.resetGames();
    
    // チャットリポジトリをクリア
    const chatRepo = repositoryContainer.getChatMessageRepository();
    await chatRepo.clear();
  } catch (_error) {
    console.error("テストのクリーンアップ中にエラーが発生しました:");
    throw _error;
  }
}

Deno.test({
  name: "チャット - チャットメッセージを正常に送信できるか",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    await setupTests();
    const auth = await createAuthenticatedUser();
    const token = auth.token;

    // ゲームを作成
    const gameResponse = await apiRequest("POST", "/games", {
      name: "Test Game",
      maxPlayers: 5,
    }, token);

    const game = await consumeResponse<GameResponse>(gameResponse);
    assertEquals(gameResponse.status, 201);
    const gameId = game.id;

    // チャットメッセージを送信
    const messageResponse = await apiRequest(
      "POST",
      `/games/${gameId}/chat`,
      {
        content: "Hello, world!",
        channel: "PUBLIC",
      },
      token,
    );

    const messageData = await consumeResponse<ChatMessageResponse>(messageResponse);
    assertEquals(messageResponse.status, 201);
    assertNotEquals(messageData.id, undefined);
    assertEquals(messageData.content, "Hello, world!");
    assertEquals(messageData.sender.username, auth.user.username);
    assertEquals(messageData.channel, "PUBLIC");

    // チャットメッセージを取得
    const messagesResponse = await apiRequest(
      "GET",
      `/games/${gameId}/chat?channel=PUBLIC`,
      undefined,
      token,
    );

    const messagesData = await consumeResponse<ChatMessageResponse[]>(messagesResponse);
    assertEquals(messagesResponse.status, 200);
    assertEquals(messagesData.length, 1);
    assertEquals(messagesData[0].content, "Hello, world!");

    await cleanupTests();
  },
});

Deno.test({
  name: "チャット - 認証なしでチャットにアクセスできないか",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    await setupTests();
    const auth = await createAuthenticatedUser();
    const token = auth.token;

    // ゲームを作成
    const gameResponse = await apiRequest("POST", "/games", {
      name: "Test Game",
      maxPlayers: 5,
    }, token);

    const game = await consumeResponse<GameResponse>(gameResponse);
    assertEquals(gameResponse.status, 201);
    const gameId = game.id;

    // 認証なしでチャットメッセージを送信
    const messageResponse = await apiRequest(
      "POST",
      `/games/${gameId}/chat`,
      {
        content: "Hello, world!",
        channel: "PUBLIC",
      }
    );

    assertEquals(messageResponse.status, 401);

    // 認証なしでチャットメッセージを取得
    const messagesResponse = await apiRequest(
      "GET",
      `/games/${gameId}/chat?channel=PUBLIC`
    );

    assertEquals(messagesResponse.status, 401);

    await cleanupTests();
  },
});

Deno.test({
  name: "チャット - ゲームに参加していないユーザーがチャットにアクセスできないか",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    await setupTests();
    const gameOwner = await createAuthenticatedUser("owner");
    const outsider = await createAuthenticatedUser("outsider");

    // ゲームを作成（オーナーのみが参加）
    const gameResponse = await apiRequest("POST", "/games", {
      name: "Test Game",
      maxPlayers: 5,
    }, gameOwner.token);

    const game = await consumeResponse<GameResponse>(gameResponse);
    assertEquals(gameResponse.status, 201);
    const gameId = game.id;

    // ゲームに参加していないユーザーがチャットメッセージを送信
    const messageResponse = await apiRequest(
      "POST",
      `/games/${gameId}/chat`,
      {
        content: "Hello, world!",
        channel: "PUBLIC",
      },
      outsider.token,
    );

    assertEquals(messageResponse.status, 403);

    await cleanupTests();
  },
});

Deno.test({
  name: "チャット - すべてのゲームから全チャットメッセージを削除できるか",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    await setupTests();
    const auth = await createAuthenticatedUser();
    const token = auth.token;

    // 複数のゲームを作成
    const games = [];
    for (let i = 0; i < 3; i++) {
      const gameResponse = await apiRequest("POST", "/games", {
        name: `Test Game ${i}`,
        maxPlayers: 5,
      }, token);
      assertEquals(gameResponse.status, 201);
      games.push(await consumeResponse<GameResponse>(gameResponse));
    }

    // 各ゲームにチャットメッセージを送信
    for (const game of games) {
      const messageResponse = await apiRequest(
        "POST",
        `/games/${game.id}/chat`,
        {
          content: `Message for game ${game.id}`,
          channel: "PUBLIC",
        },
        token,
      );
      assertEquals(messageResponse.status, 201);
    }

    // チャットリポジトリをクリア
    const chatRepo = repositoryContainer.getChatMessageRepository();
    await chatRepo.clear();

    // メッセージが削除されたことを確認
    for (const game of games) {
      const messagesResponse = await apiRequest(
        "GET",
        `/games/${game.id}/chat?channel=PUBLIC`,
        undefined,
        token,
      );
      assertEquals(messagesResponse.status, 200);
      const messagesData = await consumeResponse<ChatMessageResponse[]>(messagesResponse);
      assertEquals(messagesData.length, 0);
    }

    await cleanupTests();
  },
});

Deno.test({
  name: "チャット - ゲーム内のすべてのチャットメッセージを削除できるか",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    await setupTests();
    const auth = await createAuthenticatedUser();
    const token = auth.token;

    // ゲームを作成
    const gameResponse = await apiRequest("POST", "/games", {
      name: "Test Game",
      maxPlayers: 5,
    }, token);

    const game = await consumeResponse<GameResponse>(gameResponse);
    assertEquals(gameResponse.status, 201);
    const gameId = game.id;

    // 複数のチャットメッセージを送信
    for (let i = 0; i < 5; i++) {
      const messageResponse = await apiRequest(
        "POST",
        `/games/${gameId}/chat`,
        {
          content: `Message ${i}`,
          channel: "PUBLIC",
        },
        token,
      );
      assertEquals(messageResponse.status, 201);
    }

    // メッセージが送信されたことを確認
    let messagesResponse = await apiRequest(
      "GET",
      `/games/${gameId}/chat?channel=PUBLIC`,
      undefined,
      token,
    );
    assertEquals(messagesResponse.status, 200);
    let messagesData = await consumeResponse<ChatMessageResponse[]>(messagesResponse);
    assertEquals(messagesData.length, 5);

    // ゲーム内のすべてのチャットメッセージを削除
    const chatRepo = repositoryContainer.getChatMessageRepository();
    await chatRepo.deleteByGame(gameId);

    // メッセージが削除されたことを確認
    messagesResponse = await apiRequest(
      "GET",
      `/games/${gameId}/chat?channel=PUBLIC`,
      undefined,
      token,
    );
    assertEquals(messagesResponse.status, 200);
    messagesData = await consumeResponse<ChatMessageResponse[]>(messagesResponse);
    assertEquals(messagesData.length, 0);

    await cleanupTests();
  },
});

// 役割別チャットのテスト
Deno.test({
  name: "チャット - 役割別チャットが適切に機能するか",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    await setupTests();
    // 5人のユーザーを作成
    const ownerAuth = await createAuthenticatedUser("owner");
    const werewolfAuth = await createAuthenticatedUser("werewolf");
    const seerAuth = await createAuthenticatedUser("seer");
    const bodyguardAuth = await createAuthenticatedUser("bodyguard");
    const villagerAuth = await createAuthenticatedUser("villager");

    // ゲームを作成
    const gameResponse = await apiRequest("POST", "/games", {
      name: "Role Chat Test",
      maxPlayers: 5,
    }, ownerAuth.token);

    const game = await consumeResponse<GameResponse>(gameResponse);
    assertEquals(gameResponse.status, 201);
    const gameId = game.id;

    // 全プレイヤーをゲームに参加させる
    await apiRequest("POST", `/games/${gameId}/join`, {}, werewolfAuth.token);
    await apiRequest("POST", `/games/${gameId}/join`, {}, seerAuth.token);
    await apiRequest("POST", `/games/${gameId}/join`, {}, bodyguardAuth.token);
    await apiRequest("POST", `/games/${gameId}/join`, {}, villagerAuth.token);

    // ゲームを開始
    await apiRequest("POST", `/games/${gameId}/start`, {}, ownerAuth.token);

    // ゲームインスタンスを取得して役職を割り当て
    let gameInstance = await getGameById(gameId);
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

    // 人狼チャットのテスト
    // 人狼がWEREWOLFチャンネルにメッセージを送信
    const werewolfMessageResponse = await apiRequest(
      "POST",
      `/games/${gameId}/chat`,
      {
        content: "Wolf message",
        channel: "WEREWOLF",
      },
      werewolfAuth.token,
    );
    assertEquals(werewolfMessageResponse.status, 201);

    // 村人が人狼チャンネルにメッセージを送信しようとする（失敗するはず）
    const villagerToWerewolfResponse = await apiRequest(
      "POST",
      `/games/${gameId}/chat`,
      {
        content: "Villager trying to message wolves",
        channel: "WEREWOLF",
      },
      villagerAuth.token,
    );
    assertEquals(villagerToWerewolfResponse.status, 403);

    // 人狼が人狼チャンネルのメッセージを取得
    const werewolfChatResponse = await apiRequest(
      "GET",
      `/games/${gameId}/chat?channel=WEREWOLF`,
      undefined,
      werewolfAuth.token,
    );
    assertEquals(werewolfChatResponse.status, 200);
    const werewolfChatData = await consumeResponse<ChatMessageResponse[]>(werewolfChatResponse);
    assertEquals(werewolfChatData.length, 1);
    assertEquals(werewolfChatData[0].content, "Wolf message");

    // 村人が人狼チャンネルのメッセージを取得しようとする（失敗するはず）
    const villagerWerewolfChatResponse = await apiRequest(
      "GET",
      `/games/${gameId}/chat?channel=WEREWOLF`,
      undefined,
      villagerAuth.token,
    );
    assertEquals(villagerWerewolfChatResponse.status, 403);

    await cleanupTests();
  },
});

// デッドチャットのテスト
Deno.test({
  name: "チャット - 死亡プレイヤーのみがデッドチャットにアクセスできるか",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    await setupTests();
    // 5人のユーザーを作成
    const ownerAuth = await createAuthenticatedUser("owner");
    const werewolfAuth = await createAuthenticatedUser("werewolf");
    const seerAuth = await createAuthenticatedUser("seer");
    const bodyguardAuth = await createAuthenticatedUser("bodyguard");
    const villagerAuth = await createAuthenticatedUser("villager");

    // ゲームを作成
    const gameResponse = await apiRequest("POST", "/games", {
      name: "Dead Chat Test",
      maxPlayers: 5,
    }, ownerAuth.token);

    const game = await consumeResponse<GameResponse>(gameResponse);
    assertEquals(gameResponse.status, 201);
    const gameId = game.id;

    // 全プレイヤーをゲームに参加させる
    await apiRequest("POST", `/games/${gameId}/join`, {}, werewolfAuth.token);
    await apiRequest("POST", `/games/${gameId}/join`, {}, seerAuth.token);
    await apiRequest("POST", `/games/${gameId}/join`, {}, bodyguardAuth.token);
    await apiRequest("POST", `/games/${gameId}/join`, {}, villagerAuth.token);

    // ゲームを開始
    await apiRequest("POST", `/games/${gameId}/start`, {}, ownerAuth.token);

    // ゲームインスタンスを取得して役職を割り当て
    let gameInstance = await getGameById(gameId);
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
          return { ...p, role: "SEER", isAlive: false, deathCause: "WEREWOLF_ATTACK" };
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

    // 死亡プレイヤーがDEADチャンネルにメッセージを送信
    const deadMessageResponse = await apiRequest(
      "POST",
      `/games/${gameId}/chat`,
      {
        content: "Message from the dead",
        channel: "DEAD",
      },
      seerAuth.token,
    );
    assertEquals(deadMessageResponse.status, 201);

    // 生存プレイヤーがDEADチャンネルにメッセージを送信しようとする（失敗するはず）
    const aliveToDeadResponse = await apiRequest(
      "POST",
      `/games/${gameId}/chat`,
      {
        content: "Alive trying to message dead",
        channel: "DEAD",
      },
      villagerAuth.token,
    );
    assertEquals(aliveToDeadResponse.status, 403);

    // 死亡プレイヤーがDEADチャンネルのメッセージを取得
    const deadChatResponse = await apiRequest(
      "GET",
      `/games/${gameId}/chat?channel=DEAD`,
      undefined,
      seerAuth.token,
    );
    assertEquals(deadChatResponse.status, 200);
    const deadChatData = await consumeResponse<ChatMessageResponse[]>(deadChatResponse);
    assertEquals(deadChatData.length, 1);
    assertEquals(deadChatData[0].content, "Message from the dead");

    // 生存プレイヤーがDEADチャンネルのメッセージを取得しようとする（失敗するはず）
    const aliveDeadChatResponse = await apiRequest(
      "GET",
      `/games/${gameId}/chat?channel=DEAD`,
      undefined,
      villagerAuth.token,
    );
    assertEquals(aliveDeadChatResponse.status, 403);

    await cleanupTests();
  },
});

// すべての役割チャットのアクセス制御のテスト
Deno.test({
  name: "チャット - 各役割チャットのアクセス制御が正しく機能するか",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    await setupTests();
    // 5人のユーザーを作成
    const ownerAuth = await createAuthenticatedUser("owner");
    const werewolfAuth = await createAuthenticatedUser("werewolf");
    const seerAuth = await createAuthenticatedUser("seer");
    const bodyguardAuth = await createAuthenticatedUser("bodyguard");
    const villagerAuth = await createAuthenticatedUser("villager");

    // ゲームを作成
    const gameResponse = await apiRequest("POST", "/games", {
      name: "Role Access Test",
      maxPlayers: 5,
    }, ownerAuth.token);

    const game = await consumeResponse<GameResponse>(gameResponse);
    assertEquals(gameResponse.status, 201);
    const gameId = game.id;

    // 全プレイヤーをゲームに参加させる
    await apiRequest("POST", `/games/${gameId}/join`, {}, werewolfAuth.token);
    await apiRequest("POST", `/games/${gameId}/join`, {}, seerAuth.token);
    await apiRequest("POST", `/games/${gameId}/join`, {}, bodyguardAuth.token);
    await apiRequest("POST", `/games/${gameId}/join`, {}, villagerAuth.token);

    // ゲームを開始
    await apiRequest("POST", `/games/${gameId}/start`, {}, ownerAuth.token);

    // ゲームインスタンスを取得して役職を割り当て
    let gameInstance = await getGameById(gameId);
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
          return { ...p, role: "SEER", isAlive: false, deathCause: "WEREWOLF_ATTACK" };
        } else if (p.playerId === bodyguardAuth.user.id) {
          return { ...p, role: "BODYGUARD", isAlive: false, deathCause: "EXECUTION" };
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

    // チャンネルとアクセス権限のマップ
    const channelAccessMap = [
      {
        channel: "PUBLIC",
        canAccess: [ownerAuth, werewolfAuth, villagerAuth],
        cannotAccess: [], // 全員アクセス可能
      },
      {
        channel: "WEREWOLF",
        canAccess: [werewolfAuth],
        cannotAccess: [ownerAuth, villagerAuth], // 人狼以外はアクセス不可
      },
      {
        channel: "SEER",
        canAccess: [seerAuth],
        cannotAccess: [ownerAuth, werewolfAuth, villagerAuth], // 占い師以外はアクセス不可
      },
      {
        channel: "BODYGUARD",
        canAccess: [bodyguardAuth],
        cannotAccess: [ownerAuth, werewolfAuth, villagerAuth, seerAuth], // 守護者以外はアクセス不可
      },
      {
        channel: "DEAD",
        canAccess: [seerAuth, bodyguardAuth], // 死亡プレイヤー
        cannotAccess: [ownerAuth, werewolfAuth, villagerAuth], // 生存プレイヤーはアクセス不可
      },
    ];

    // 各チャンネルのアクセス制御をテスト
    for (const testCase of channelAccessMap) {
      const { channel, canAccess, cannotAccess } = testCase;

      // アクセス可能なユーザーのテスト
      for (const auth of canAccess) {
        // 特定の条件をチェック
        const isDeadPlayer = auth === seerAuth || auth === bodyguardAuth;
        const isNotDeadChannel = channel !== "DEAD";

        // 死亡プレイヤーはDEAD以外のチャンネルに送信できない
        if (isDeadPlayer && isNotDeadChannel) {
          const messageResponse = await apiRequest(
            "POST",
            `/games/${gameId}/chat`,
            {
              content: `${auth.user.username} in ${channel}`,
              channel,
            },
            auth.token,
          );
          assertEquals(messageResponse.status, 403, 
            `死亡プレイヤー ${auth.user.username} が ${channel} に投稿できてしまいました`);
          continue;
        }

        // それ以外の場合は送信可能
        const messageResponse = await apiRequest(
          "POST",
          `/games/${gameId}/chat`,
          {
            content: `${auth.user.username} in ${channel}`,
            channel,
          },
          auth.token,
        );
        assertEquals(messageResponse.status, 201, 
          `${auth.user.username} が ${channel} に投稿できません`);

        // チャットの取得も可能
        const chatResponse = await apiRequest(
          "GET",
          `/games/${gameId}/chat?channel=${channel}`,
          undefined,
          auth.token,
        );
        assertEquals(chatResponse.status, 200, 
          `${auth.user.username} が ${channel} のメッセージを取得できません`);
      }

      // アクセス不可のユーザーのテスト
      for (const auth of cannotAccess) {
        const messageResponse = await apiRequest(
          "POST",
          `/games/${gameId}/chat`,
          {
            content: `${auth.user.username} trying ${channel}`,
            channel,
          },
          auth.token,
        );
        assertEquals(messageResponse.status, 403, 
          `${auth.user.username} が ${channel} に投稿できてしまいます`);

        const chatResponse = await apiRequest(
          "GET",
          `/games/${gameId}/chat?channel=${channel}`,
          undefined,
          auth.token,
        );
        assertEquals(chatResponse.status, 403, 
          `${auth.user.username} が ${channel} のメッセージを取得できてしまいます`);
      }
    }

    await cleanupTests();
  },
});

// ゲーム内のプライベートメッセージのテスト
Deno.test({
  name: "チャット - プライベートメッセージが正しく機能するか",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    await setupTests();
    // 5人のユーザーを作成
    const ownerAuth = await createAuthenticatedUser("owner");
    const werewolfAuth = await createAuthenticatedUser("werewolf");
    const seerAuth = await createAuthenticatedUser("seer");
    const bodyguardAuth = await createAuthenticatedUser("bodyguard");
    const villagerAuth = await createAuthenticatedUser("villager");

    // ゲームを作成
    const gameResponse = await apiRequest("POST", "/games", {
      name: "Private Message Test",
      maxPlayers: 5,
    }, ownerAuth.token);

    const game = await consumeResponse<GameResponse>(gameResponse);
    assertEquals(gameResponse.status, 201);
    const gameId = game.id;

    // 全プレイヤーをゲームに参加させる
    await apiRequest("POST", `/games/${gameId}/join`, {}, werewolfAuth.token);
    await apiRequest("POST", `/games/${gameId}/join`, {}, seerAuth.token);
    await apiRequest("POST", `/games/${gameId}/join`, {}, bodyguardAuth.token);
    await apiRequest("POST", `/games/${gameId}/join`, {}, villagerAuth.token);

    // ゲームを開始
    await apiRequest("POST", `/games/${gameId}/start`, {}, ownerAuth.token);

    // ゲームインスタンスを取得して役職を割り当て
    let gameInstance = await getGameById(gameId);
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
          return { ...p, role: "SEER", isAlive: false, deathCause: "WEREWOLF_ATTACK" };
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

    // プライベートメッセージを送信
    const privateMessageResponse = await apiRequest(
      "POST",
      `/games/${gameId}/chat`,
      {
        content: "Private message",
        channel: "PRIVATE",
        recipientId: villagerAuth.user.id,
      },
      ownerAuth.token,
    );
    assertEquals(privateMessageResponse.status, 201);

    // 死亡プレイヤーからプライベートメッセージを送信（失敗するはず）
    const deadPrivateMessageResponse = await apiRequest(
      "POST",
      `/games/${gameId}/chat`,
      {
        content: "Private message from dead",
        channel: "PRIVATE",
        recipientId: villagerAuth.user.id,
      },
      seerAuth.token,
    );
    assertEquals(deadPrivateMessageResponse.status, 403);

    // 送信者がプライベートメッセージを取得
    const senderPrivateResponse = await apiRequest(
      "GET",
      `/games/${gameId}/chat?channel=PRIVATE`,
      undefined,
      ownerAuth.token,
    );
    assertEquals(senderPrivateResponse.status, 200);
    const senderPrivateData = await consumeResponse<ChatMessageResponse[]>(senderPrivateResponse);
    assertEquals(senderPrivateData.length, 1);
    assertEquals(senderPrivateData[0].content, "Private message");

    // 受信者がプライベートメッセージを取得
    const recipientPrivateResponse = await apiRequest(
      "GET",
      `/games/${gameId}/chat?channel=PRIVATE`,
      undefined,
      villagerAuth.token,
    );
    assertEquals(recipientPrivateResponse.status, 200);
    const recipientPrivateData = await consumeResponse<ChatMessageResponse[]>(recipientPrivateResponse);
    assertEquals(recipientPrivateData.length, 1);
    assertEquals(recipientPrivateData[0].content, "Private message");

    // 第三者がプライベートメッセージを取得（メッセージが表示されないはず）
    const thirdPartyPrivateResponse = await apiRequest(
      "GET",
      `/games/${gameId}/chat?channel=PRIVATE`,
      undefined,
      werewolfAuth.token,
    );
    assertEquals(thirdPartyPrivateResponse.status, 200);
    const thirdPartyPrivateData = await consumeResponse<ChatMessageResponse[]>(thirdPartyPrivateResponse);
    assertEquals(thirdPartyPrivateData.length, 0);

    await cleanupTests();
  },
});
