import { ChatChannel, ChatMessage } from "../types/chat.ts";
import { Game } from "../types/game.ts";
import { logger } from "../utils/logger.ts";
import { GameError } from "../types/error.ts";
import { getGameById } from "../models/game.ts";
import { repositoryContainer } from "../repositories/repository-container.ts";

// メッセージの保存
export async function addMessage(message: ChatMessage): Promise<void> {
  const chatRepo = repositoryContainer.getChatMessageRepository();
  await chatRepo.add(message);
  
  logger.info("Chat message added", {
    gameId: message.gameId,
    channel: message.channel,
    senderId: message.senderId,
  });
}

// システムメッセージを追加する
export async function addSystemMessage(
  gameId: string,
  content: string,
  channel: ChatChannel = "GLOBAL"
): Promise<void> {
  const message: ChatMessage = {
    id: crypto.randomUUID(),
    gameId,
    senderId: "SYSTEM",
    senderUsername: "システム",
    content,
    channel,
    timestamp: new Date().toISOString(),
  };

  await addMessage(message);
  logger.info("System message added", {
    gameId,
    channel,
    content,
  });
}

// 特定のゲームのメッセージを取得
export async function getGameMessages(
  gameId: string,
  channel: ChatChannel,
  playerId: string,
  game: Game,
): Promise<ChatMessage[]> {
  const chatRepo = repositoryContainer.getChatMessageRepository();
  const messages = await chatRepo.findByGameAndChannel(gameId, channel);

  // プレイヤーの情報を取得
  const player = game.players.find((p) => p.playerId === playerId);
  const isWerewolf = player?.role === "WEREWOLF";
  const isAlive = player?.isAlive ?? true;

  // チャンネルによるメッセージのフィルタリング
  return messages.filter((msg) => {
    // 人狼チャンネルは人狼のみ閲覧可能
    if (msg.channel === "WEREWOLF" && !isWerewolf) {
      return false;
    }
    
    // 霊界チャンネルは死亡したプレイヤーのみ閲覧可能
    if (msg.channel === "SPIRIT" && isAlive) {
      return false;
    }
    
    return true;
  });
}

// メッセージを送信する
export async function sendMessage(
  gameId: string,
  senderId: string,
  content: string,
  channel: ChatChannel,
  senderUsername: string = "テストユーザー",
  existingGame?: Game,
  isTestMode = false,
): Promise<ChatMessage> {
  // 入力検証
  if (!gameId) {
    throw new GameError("GAME_NOT_FOUND", "ゲームIDが指定されていません");
  }

  if (!content || content.trim() === "") {
    throw new GameError("INVALID_MESSAGE", "メッセージは空にできません");
  }

  // 有効なチャンネルかどうかをチェック
  const validChannels = ["GLOBAL", "WEREWOLF", "GENERAL", "SPIRIT"];
  if (!validChannels.includes(channel)) {
    throw new GameError("INVALID_CHANNEL", `無効なチャンネルです: ${channel}`);
  }

  // ゲーム情報の取得
  let gameInstance: Game | undefined = existingGame;
  if (gameId && !gameInstance) {
    const foundGame = await getGameById(gameId);
    if (foundGame) {
      gameInstance = foundGame;
    }
  }

  // テストモードか、または有効なゲームがあるかチェック
  if (!isTestMode && !gameInstance) {
    throw new GameError("GAME_NOT_FOUND", "指定されたゲームが見つかりません");
  }

  // プレイヤーのロールとゲームの状態をチェック（テストモード以外）
  if (!isTestMode && gameInstance) {
    const player = gameInstance.players.find((p) => p.playerId === senderId);

    // プレイヤーがゲームに参加しているか確認
    if (!player) {
      throw new GameError("PLAYER_NOT_IN_GAME", "プレイヤーはこのゲームに参加していません");
    }

    // 人狼チャンネルへのアクセス権限チェック
    if (channel === "WEREWOLF" && player.role !== "WEREWOLF") {
      throw new GameError("CHANNEL_ACCESS_DENIED", "人狼チャンネルには人狼のみがアクセスできます");
    }
    
    // 霊界チャンネルへのアクセス権限チェック
    if (channel === "SPIRIT" && player.isAlive) {
      throw new GameError("CHANNEL_ACCESS_DENIED", "霊界チャンネルには死亡したプレイヤーのみがアクセスできます");
    }

    // プレイヤーの生存状態チェック
    if (!player.isAlive && channel === "GLOBAL") {
      throw new GameError("DEAD_PLAYER_CHAT", "死亡したプレイヤーは昼間のチャットに参加できません");
    }

    // ゲームフェーズのチェック（夜間は全体チャット不可）
    if (gameInstance.currentPhase === "NIGHT" && channel === "GLOBAL" && player.role !== "WEREWOLF") {
      throw new GameError("PHASE_CHAT_RESTRICTED", "夜間は全体チャットに参加できません");
    }
  }

  const message: ChatMessage = {
    id: crypto.randomUUID(),
    gameId,
    senderId,
    senderUsername,
    content,
    channel,
    timestamp: new Date().toISOString(),
  };

  await addMessage(message);
  logger.info("Chat message sent", {
    gameId,
    channel,
    senderId,
  });

  return message;
}

// メッセージを取得する
export async function getMessages(
  gameId: string,
  channel: ChatChannel,
  playerId?: string,
  existingGame?: Game,
  isTestMode = false,
): Promise<ChatMessage[]> {
  // 入力検証
  if (!gameId) {
    throw new GameError("GAME_NOT_FOUND", "ゲームIDが指定されていません");
  }

  // 有効なチャンネルかどうかをチェック
  const validChannels = ["GLOBAL", "WEREWOLF", "GENERAL", "SPIRIT"];
  if (!validChannels.includes(channel)) {
    throw new GameError("INVALID_CHANNEL", `無効なチャンネルです: ${channel}`);
  }

  // ゲームの取得（テストモードでなければ）
  let gameInstance: Game | undefined = existingGame;
  if (!isTestMode && !gameInstance) {
    const foundGame = await getGameById(gameId);
    if (foundGame) {
      gameInstance = foundGame;
    }
  }

  const chatRepo = repositoryContainer.getChatMessageRepository();

  // 権限チェック（テストモード以外）
  if (!isTestMode && gameInstance && playerId) {
    const player = gameInstance.players.find((p) => p.playerId === playerId);
    
    // 人狼チャンネルの権限チェック
    if (channel === "WEREWOLF" && (!player || player.role !== "WEREWOLF")) {
      throw new GameError("CHANNEL_ACCESS_DENIED", "人狼チャンネルには人狼のみがアクセスできます");
    }
    
    // 霊界チャンネルの権限チェック
    if (channel === "SPIRIT" && (!player || player.isAlive)) {
      throw new GameError("CHANNEL_ACCESS_DENIED", "霊界チャンネルには死亡したプレイヤーのみがアクセスできます");
    }
  }

  return await chatRepo.findByGameAndChannel(gameId, channel);
}

// テスト用のリセット関数
export async function resetMessages(): Promise<void> {
  const chatRepo = repositoryContainer.getChatMessageRepository();
  await chatRepo.clear();
  logger.info("Chat messages reset");
}

// ゲームに関連するすべてのメッセージを削除
export async function deleteGameMessages(gameId: string): Promise<void> {
  const chatRepo = repositoryContainer.getChatMessageRepository();
  await chatRepo.deleteByGame(gameId);
  logger.info("Game chat messages deleted", { gameId });
}
