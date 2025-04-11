import { assertEquals, assertNotEquals, assertRejects } from "https://deno.land/std@0.210.0/assert/mod.ts";
import { api, consumeResponse, createAuthenticatedUser, createTestGame } from "../helpers/api.ts";
import { generateTestUserData, setupTestGame } from "../helpers/test-helpers.ts";
import { repositoryContainer } from "../../repositories/repository-container.ts";
import { Game } from "../../types/game.ts";
import { getGameById } from "../../models/game.ts";

const repositories = repositoryContainer;

Deno.test({
  name: "チャット - チャットメッセージを正常に送信できるか",
  async fn() {
    const auth = await createAuthenticatedUser(api);
    const token = auth.token;

    // ゲームを作成
    const gameResponse = await api.post("/api/games", {
      name: "Test Game",
      maxPlayers: 5,
    }, token);

    assertEquals(gameResponse.status, 200);
    const gameId = gameResponse.data.id;

    // チャットメッセージを送信
    const messageResponse = await api.post(
      `/api/games/${gameId}/chat`,
      {
        content: "Hello, world!",
        channel: "PUBLIC",
      },
      token,
    );

    assertEquals(messageResponse.status, 200);
    assertNotEquals(messageResponse.data.id, undefined);
    assertEquals(messageResponse.data.content, "Hello, world!");
    assertEquals(messageResponse.data.sender.username, auth.user.username);
    assertEquals(messageResponse.data.channel, "PUBLIC");

    // チャットメッセージを取得
    const messagesResponse = await api.get(
      `/api/games/${gameId}/chat?channel=PUBLIC`,
      token,
    );

    assertEquals(messagesResponse.status, 200);
    assertEquals(messagesResponse.data.length, 1);
    assertEquals(messagesResponse.data[0].content, "Hello, world!");

    // 後処理：ゲームの削除
    await api.delete(`/api/games/${gameId}`, token);
  },
});

Deno.test({
  name: "チャット - 認証なしでチャットにアクセスできないか",
  async fn() {
    const auth = await createAuthenticatedUser(api);
    const token = auth.token;

    // ゲームを作成
    const gameResponse = await api.post("/api/games", {
      name: "Test Game",
      maxPlayers: 5,
    }, token);

    assertEquals(gameResponse.status, 200);
    const gameId = gameResponse.data.id;

    // 認証なしでチャットメッセージを送信
    const messageResponse = await api.post(
      `/api/games/${gameId}/chat`,
      {
        content: "Hello, world!",
        channel: "PUBLIC",
      },
    );

    assertEquals(messageResponse.status, 401);

    // 認証なしでチャットメッセージを取得
    const messagesResponse = await api.get(
      `/api/games/${gameId}/chat?channel=PUBLIC`,
    );

    assertEquals(messagesResponse.status, 401);

    // 後処理：ゲームの削除
    await api.delete(`/api/games/${gameId}`, token);
  },
});

Deno.test({
  name: "チャット - ゲームに参加していないユーザーがチャットにアクセスできないか",
  async fn() {
    const gameOwner = await createAuthenticatedUser(api, "owner");
    const outsider = await createAuthenticatedUser(api, "outsider");

    // ゲームを作成（オーナーのみが参加）
    const gameResponse = await api.post("/api/games", {
      name: "Test Game",
      maxPlayers: 5,
    }, gameOwner.token);

    assertEquals(gameResponse.status, 200);
    const gameId = gameResponse.data.id;

    // ゲームに参加していないユーザーがチャットメッセージを送信
    const messageResponse = await api.post(
      `/api/games/${gameId}/chat`,
      {
        content: "Hello, world!",
        channel: "PUBLIC",
      },
      outsider.token,
    );

    assertEquals(messageResponse.status, 403);

    // 後処理：ゲームの削除
    await api.delete(`/api/games/${gameId}`, gameOwner.token);
  },
});

Deno.test({
  name: "チャット - すべてのゲームから全チャットメッセージを削除できるか",
  async fn() {
    const auth = await createAuthenticatedUser(api);
    const token = auth.token;

    // 複数のゲームを作成
    const games = [];
    for (let i = 0; i < 3; i++) {
      const gameResponse = await api.post("/api/games", {
        name: `Test Game ${i}`,
        maxPlayers: 5,
      }, token);
      assertEquals(gameResponse.status, 200);
      games.push(gameResponse.data);
    }

    // 各ゲームにチャットメッセージを送信
    for (const game of games) {
      const messageResponse = await api.post(
        `/api/games/${game.id}/chat`,
        {
          content: `Message for game ${game.id}`,
          channel: "PUBLIC",
        },
        token,
      );
      assertEquals(messageResponse.status, 200);
    }

    // チャットリポジトリをクリア
    const chatRepo = repositories.getChatRepository();
    await chatRepo.clear();

    // メッセージが削除されたことを確認
    for (const game of games) {
      const messagesResponse = await api.get(
        `/api/games/${game.id}/chat?channel=PUBLIC`,
        token,
      );
      assertEquals(messagesResponse.status, 200);
      assertEquals(messagesResponse.data.length, 0);
    }

    // 後処理：ゲームの削除
    for (const game of games) {
      await api.delete(`/api/games/${game.id}`, token);
    }
  },
});

Deno.test({
  name: "チャット - ゲーム内のすべてのチャットメッセージを削除できるか",
  async fn() {
    const auth = await createAuthenticatedUser(api);
    const token = auth.token;

    // ゲームを作成
    const gameResponse = await api.post("/api/games", {
      name: "Test Game",
      maxPlayers: 5,
    }, token);

    assertEquals(gameResponse.status, 200);
    const gameId = gameResponse.data.id;

    // 複数のチャットメッセージを送信
    for (let i = 0; i < 5; i++) {
      const messageResponse = await api.post(
        `/api/games/${gameId}/chat`,
        {
          content: `Message ${i}`,
          channel: "PUBLIC",
        },
        token,
      );
      assertEquals(messageResponse.status, 200);
    }

    // メッセージが送信されたことを確認
    let messagesResponse = await api.get(
      `/api/games/${gameId}/chat?channel=PUBLIC`,
      token,
    );
    assertEquals(messagesResponse.status, 200);
    assertEquals(messagesResponse.data.length, 5);

    // ゲーム内のすべてのチャットメッセージを削除
    await repositories.deleteGameChatMessages(gameId);

    // メッセージが削除されたことを確認
    messagesResponse = await api.get(
      `/api/games/${gameId}/chat?channel=PUBLIC`,
      token,
    );
    assertEquals(messagesResponse.status, 200);
    assertEquals(messagesResponse.data.length, 0);

    // 後処理：ゲームの削除
    await api.delete(`/api/games/${gameId}`, token);
  },
});

// 役割別チャットのテスト
Deno.test({
  name: "チャット - 役割別チャットが適切に機能するか",
  async fn() {
    // 5人のユーザーを作成
    const ownerAuth = await createAuthenticatedUser(api, "owner");
    const werewolfAuth = await createAuthenticatedUser(api, "werewolf");
    const seerAuth = await createAuthenticatedUser(api, "seer");
    const bodyguardAuth = await createAuthenticatedUser(api, "bodyguard");
    const villagerAuth = await createAuthenticatedUser(api, "villager");

    // ゲームを作成
    const gameResponse = await api.post("/api/games", {
      name: "Role Chat Test",
      maxPlayers: 5,
    }, ownerAuth.token);

    assertEquals(gameResponse.status, 200);
    const gameId = gameResponse.data.id;

    // 全プレイヤーをゲームに参加させる
    await api.post(`/api/games/${gameId}/join`, {}, werewolfAuth.token);
    await api.post(`/api/games/${gameId}/join`, {}, seerAuth.token);
    await api.post(`/api/games/${gameId}/join`, {}, bodyguardAuth.token);
    await api.post(`/api/games/${gameId}/join`, {}, villagerAuth.token);

    // ゲームを開始
    await api.post(`/api/games/${gameId}/start`, {}, ownerAuth.token);

    // ゲームインスタンスを取得して役職を割り当て
    let gameInstance = await getGameById(gameId);
    if (!gameInstance) {
      throw new Error("Game not found");
    }
    gameInstance.players.find((p) => p.playerId === werewolfAuth.user.id)!.role = "WEREWOLF";
    gameInstance.players.find((p) => p.playerId === villagerAuth.user.id)!.role = "VILLAGER";
    gameInstance.players.find((p) => p.playerId === seerAuth.user.id)!.role = "SEER";
    gameInstance.players.find((p) => p.playerId === bodyguardAuth.user.id)!.role = "BODYGUARD";
    gameInstance.players.find((p) => p.playerId === ownerAuth.user.id)!.role = "VILLAGER";

    // 人狼チャットのテスト
    // 人狼がWEREWOLFチャンネルにメッセージを送信
    const werewolfMessageResponse = await api.post(
      `/api/games/${gameId}/chat`,
      {
        content: "Wolf message",
        channel: "WEREWOLF",
      },
      werewolfAuth.token,
    );
    assertEquals(werewolfMessageResponse.status, 200);

    // 村人が人狼チャンネルにメッセージを送信しようとする（失敗するはず）
    const villagerToWerewolfResponse = await api.post(
      `/api/games/${gameId}/chat`,
      {
        content: "Villager trying to message wolves",
        channel: "WEREWOLF",
      },
      villagerAuth.token,
    );
    assertEquals(villagerToWerewolfResponse.status, 403);

    // 人狼が人狼チャンネルのメッセージを取得
    const werewolfChatResponse = await api.get(
      `/api/games/${gameId}/chat?channel=WEREWOLF`,
      werewolfAuth.token,
    );
    assertEquals(werewolfChatResponse.status, 200);
    assertEquals(werewolfChatResponse.data.length, 1);
    assertEquals(werewolfChatResponse.data[0].content, "Wolf message");

    // 村人が人狼チャンネルのメッセージを取得しようとする（失敗するはず）
    const villagerWerewolfChatResponse = await api.get(
      `/api/games/${gameId}/chat?channel=WEREWOLF`,
      villagerAuth.token,
    );
    assertEquals(villagerWerewolfChatResponse.status, 403);

    // 後処理：ゲームの削除
    await api.delete(`/api/games/${gameId}`, ownerAuth.token);
  },
});

// デッドチャットのテスト
Deno.test({
  name: "チャット - 死亡プレイヤーのみがデッドチャットにアクセスできるか",
  async fn() {
    // 5人のユーザーを作成
    const ownerAuth = await createAuthenticatedUser(api, "owner");
    const werewolfAuth = await createAuthenticatedUser(api, "werewolf");
    const seerAuth = await createAuthenticatedUser(api, "seer");
    const bodyguardAuth = await createAuthenticatedUser(api, "bodyguard");
    const villagerAuth = await createAuthenticatedUser(api, "villager");

    // ゲームを作成
    const gameResponse = await api.post("/api/games", {
      name: "Dead Chat Test",
      maxPlayers: 5,
    }, ownerAuth.token);

    assertEquals(gameResponse.status, 200);
    const gameId = gameResponse.data.id;

    // 全プレイヤーをゲームに参加させる
    await api.post(`/api/games/${gameId}/join`, {}, werewolfAuth.token);
    await api.post(`/api/games/${gameId}/join`, {}, seerAuth.token);
    await api.post(`/api/games/${gameId}/join`, {}, bodyguardAuth.token);
    await api.post(`/api/games/${gameId}/join`, {}, villagerAuth.token);

    // ゲームを開始
    await api.post(`/api/games/${gameId}/start`, {}, ownerAuth.token);

    // ゲームインスタンスを取得して役職を割り当て
    let gameInstance = await getGameById(gameId);
    if (!gameInstance) {
      throw new Error("Game not found");
    }
    gameInstance.players.find((p) => p.playerId === werewolfAuth.user.id)!.role = "WEREWOLF";
    gameInstance.players.find((p) => p.playerId === villagerAuth.user.id)!.role = "VILLAGER";
    gameInstance.players.find((p) => p.playerId === seerAuth.user.id)!.role = "SEER";
    gameInstance.players.find((p) => p.playerId === bodyguardAuth.user.id)!.role = "BODYGUARD";
    gameInstance.players.find((p) => p.playerId === ownerAuth.user.id)!.role = "VILLAGER";

    // 一人のプレイヤーを死亡状態にする
    const deadPlayer = gameInstance.players.find((p) => p.playerId === seerAuth.user.id)!;
    const alivePlayer = gameInstance.players.find((p) => p.playerId === villagerAuth.user.id)!;
    deadPlayer.isAlive = false;
    deadPlayer.deathCause = "WEREWOLF_ATTACK";

    // 死亡プレイヤーがDEADチャンネルにメッセージを送信
    const deadMessageResponse = await api.post(
      `/api/games/${gameId}/chat`,
      {
        content: "Message from the dead",
        channel: "DEAD",
      },
      seerAuth.token,
    );
    assertEquals(deadMessageResponse.status, 200);

    // 生存プレイヤーがDEADチャンネルにメッセージを送信しようとする（失敗するはず）
    const aliveToDeadResponse = await api.post(
      `/api/games/${gameId}/chat`,
      {
        content: "Alive trying to message dead",
        channel: "DEAD",
      },
      villagerAuth.token,
    );
    assertEquals(aliveToDeadResponse.status, 403);

    // 死亡プレイヤーがDEADチャンネルのメッセージを取得
    const deadChatResponse = await api.get(
      `/api/games/${gameId}/chat?channel=DEAD`,
      seerAuth.token,
    );
    assertEquals(deadChatResponse.status, 200);
    assertEquals(deadChatResponse.data.length, 1);
    assertEquals(deadChatResponse.data[0].content, "Message from the dead");

    // 生存プレイヤーがDEADチャンネルのメッセージを取得しようとする（失敗するはず）
    const aliveDeadChatResponse = await api.get(
      `/api/games/${gameId}/chat?channel=DEAD`,
      villagerAuth.token,
    );
    assertEquals(aliveDeadChatResponse.status, 403);

    // 後処理：ゲームの削除
    await api.delete(`/api/games/${gameId}`, ownerAuth.token);
  },
});

// すべての役割チャットのアクセス制御のテスト
Deno.test({
  name: "チャット - 各役割チャットのアクセス制御が正しく機能するか",
  async fn() {
    // 5人のユーザーを作成
    const ownerAuth = await createAuthenticatedUser(api, "owner");
    const werewolfAuth = await createAuthenticatedUser(api, "werewolf");
    const seerAuth = await createAuthenticatedUser(api, "seer");
    const bodyguardAuth = await createAuthenticatedUser(api, "bodyguard");
    const villagerAuth = await createAuthenticatedUser(api, "villager");

    // ゲームを作成
    const gameResponse = await api.post("/api/games", {
      name: "Role Access Test",
      maxPlayers: 5,
    }, ownerAuth.token);

    assertEquals(gameResponse.status, 200);
    const gameId = gameResponse.data.id;

    // 全プレイヤーをゲームに参加させる
    await api.post(`/api/games/${gameId}/join`, {}, werewolfAuth.token);
    await api.post(`/api/games/${gameId}/join`, {}, seerAuth.token);
    await api.post(`/api/games/${gameId}/join`, {}, bodyguardAuth.token);
    await api.post(`/api/games/${gameId}/join`, {}, villagerAuth.token);

    // ゲームを開始
    await api.post(`/api/games/${gameId}/start`, {}, ownerAuth.token);

    // ゲームインスタンスを取得して役職を割り当て
    let gameInstance = await getGameById(gameId);
    if (!gameInstance) {
      throw new Error("Game not found");
    }
    gameInstance.players.find((p) => p.playerId === werewolfAuth.user.id)!.role = "WEREWOLF";
    gameInstance.players.find((p) => p.playerId === villagerAuth.user.id)!.role = "VILLAGER";
    gameInstance.players.find((p) => p.playerId === seerAuth.user.id)!.role = "SEER";
    gameInstance.players.find((p) => p.playerId === bodyguardAuth.user.id)!.role = "BODYGUARD";
    gameInstance.players.find((p) => p.playerId === ownerAuth.user.id)!.role = "VILLAGER";

    // 2人のプレイヤーを死亡状態にする
    const deadPlayer1 = gameInstance.players.find((p) => p.playerId === seerAuth.user.id)!;
    const deadPlayer2 = gameInstance.players.find((p) => p.playerId === bodyguardAuth.user.id)!;
    deadPlayer1.isAlive = false;
    deadPlayer1.deathCause = "WEREWOLF_ATTACK";
    deadPlayer2.isAlive = false;
    deadPlayer2.deathCause = "EXECUTION";

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
        const messageResponse = await api.post(
          `/api/games/${gameId}/chat`,
          {
            content: `${auth.user.username} in ${channel}`,
            channel,
          },
          auth.token,
        );

        if (
          // 死亡プレイヤーはDEAD以外のチャンネルに送信できない
          (channel !== "DEAD" && auth === seerAuth || auth === bodyguardAuth)
        ) {
          assertEquals(messageResponse.status, 403);
        } else {
          assertEquals(messageResponse.status, 200, `${auth.user.username} should be able to send to ${channel}`);
        }

        const chatResponse = await api.get(
          `/api/games/${gameId}/chat?channel=${channel}`,
          auth.token,
        );
        assertEquals(chatResponse.status, 200, `${auth.user.username} should be able to read ${channel}`);
      }

      // アクセス不可のユーザーのテスト
      for (const auth of cannotAccess) {
        const messageResponse = await api.post(
          `/api/games/${gameId}/chat`,
          {
            content: `${auth.user.username} trying ${channel}`,
            channel,
          },
          auth.token,
        );
        assertEquals(messageResponse.status, 403, `${auth.user.username} should not be able to send to ${channel}`);

        const chatResponse = await api.get(
          `/api/games/${gameId}/chat?channel=${channel}`,
          auth.token,
        );
        assertEquals(chatResponse.status, 403, `${auth.user.username} should not be able to read ${channel}`);
      }
    }

    // 後処理：ゲームの削除
    await api.delete(`/api/games/${gameId}`, ownerAuth.token);
  },
});

// ゲーム内のプライベートメッセージのテスト
Deno.test({
  name: "チャット - プライベートメッセージが正しく機能するか",
  async fn() {
    // 5人のユーザーを作成
    const ownerAuth = await createAuthenticatedUser(api, "owner");
    const werewolfAuth = await createAuthenticatedUser(api, "werewolf");
    const seerAuth = await createAuthenticatedUser(api, "seer");
    const bodyguardAuth = await createAuthenticatedUser(api, "bodyguard");
    const villagerAuth = await createAuthenticatedUser(api, "villager");

    // ゲームを作成
    const gameResponse = await api.post("/api/games", {
      name: "Private Message Test",
      maxPlayers: 5,
    }, ownerAuth.token);

    assertEquals(gameResponse.status, 200);
    const gameId = gameResponse.data.id;

    // 全プレイヤーをゲームに参加させる
    await api.post(`/api/games/${gameId}/join`, {}, werewolfAuth.token);
    await api.post(`/api/games/${gameId}/join`, {}, seerAuth.token);
    await api.post(`/api/games/${gameId}/join`, {}, bodyguardAuth.token);
    await api.post(`/api/games/${gameId}/join`, {}, villagerAuth.token);

    // ゲームを開始
    await api.post(`/api/games/${gameId}/start`, {}, ownerAuth.token);

    // ゲームインスタンスを取得して役職を割り当て
    let gameInstance = await getGameById(gameId);
    if (!gameInstance) {
      throw new Error("Game not found");
    }
    gameInstance.players.find((p) => p.playerId === werewolfAuth.user.id)!.role = "WEREWOLF";
    gameInstance.players.find((p) => p.playerId === villagerAuth.user.id)!.role = "VILLAGER";
    gameInstance.players.find((p) => p.playerId === seerAuth.user.id)!.role = "SEER";
    gameInstance.players.find((p) => p.playerId === bodyguardAuth.user.id)!.role = "BODYGUARD";
    gameInstance.players.find((p) => p.playerId === ownerAuth.user.id)!.role = "VILLAGER";

    // 一人のプレイヤーを死亡状態にする
    const deadPlayer = gameInstance.players.find((p) => p.playerId === seerAuth.user.id)!;
    deadPlayer.isAlive = false;
    deadPlayer.deathCause = "WEREWOLF_ATTACK";

    // プライベートメッセージを送信
    const privateMessageResponse = await api.post(
      `/api/games/${gameId}/chat`,
      {
        content: "Private message",
        channel: "PRIVATE",
        recipientId: villagerAuth.user.id,
      },
      ownerAuth.token,
    );
    assertEquals(privateMessageResponse.status, 200);

    // 死亡プレイヤーからプライベートメッセージを送信（失敗するはず）
    const deadPrivateMessageResponse = await api.post(
      `/api/games/${gameId}/chat`,
      {
        content: "Private message from dead",
        channel: "PRIVATE",
        recipientId: villagerAuth.user.id,
      },
      seerAuth.token,
    );
    assertEquals(deadPrivateMessageResponse.status, 403);

    // 送信者がプライベートメッセージを取得
    const senderPrivateResponse = await api.get(
      `/api/games/${gameId}/chat?channel=PRIVATE`,
      ownerAuth.token,
    );
    assertEquals(senderPrivateResponse.status, 200);
    assertEquals(senderPrivateResponse.data.length, 1);
    assertEquals(senderPrivateResponse.data[0].content, "Private message");

    // 受信者がプライベートメッセージを取得
    const recipientPrivateResponse = await api.get(
      `/api/games/${gameId}/chat?channel=PRIVATE`,
      villagerAuth.token,
    );
    assertEquals(recipientPrivateResponse.status, 200);
    assertEquals(recipientPrivateResponse.data.length, 1);
    assertEquals(recipientPrivateResponse.data[0].content, "Private message");

    // 第三者がプライベートメッセージを取得（メッセージが表示されないはず）
    const thirdPartyPrivateResponse = await api.get(
      `/api/games/${gameId}/chat?channel=PRIVATE`,
      werewolfAuth.token,
    );
    assertEquals(thirdPartyPrivateResponse.status, 200);
    assertEquals(thirdPartyPrivateResponse.data.length, 0);

    // 後処理：ゲームの削除
    await api.delete(`/api/games/${gameId}`, ownerAuth.token);
  },
});
