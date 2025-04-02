import { ChatChannel, ChatMessage } from "../types/chat.ts";
import { Game } from "../types/game.ts";
import { logger } from "../utils/logger.ts";
import { GameError } from "../types/error.ts";
import { gameStore } from "../models/game.ts";

// インメモリでメッセージを保存
const gameMessages: Map<string, ChatMessage[]> = new Map();

// メッセージの保存
export function addMessage(message: ChatMessage): void {
  const messages = gameMessages.get(message.gameId) || [];
  messages.push(message);
  gameMessages.set(message.gameId, messages);
  logger.info("Chat message added", {
    gameId: message.gameId,
    channel: message.channel,
    senderId: message.senderId,
  });
}

// 特定のゲームのメッセージを取得
export function getGameMessages(
  gameId: string,
  channel: ChatChannel,
  playerId: string,
  game: Game,
): ChatMessage[] {
  const messages = gameMessages.get(gameId) || [];

  // プレイヤーが人狼かどうかを確認
  const player = game.players.find((p) => p.playerId === playerId);
  const isWerewolf = player?.role === "WEREWOLF";

  // 人狼チャンネルのメッセージは人狼のみが見れる
  return messages.filter((msg) => {
    if (msg.channel === "WEREWOLF" && !isWerewolf) {
      return false;
    }
    return msg.channel === channel;
  });
}

// メッセージを送信する
export function sendMessage(
  gameId: string,
  senderId: string,
  content: string,
  channel: ChatChannel,
  senderUsername: string = "テストユーザー",
  game?: Game,
  isTestMode = false
): ChatMessage {
  // 入力検証
  if (!gameId) {
    throw new GameError("GAME_NOT_FOUND", "ゲームIDが指定されていません");
  }

  if (!content || content.trim() === "") {
    throw new GameError("INVALID_MESSAGE", "メッセージは空にできません");
  }
  
  // 有効なチャンネルかどうかをチェック
  const validChannels = ["GLOBAL", "WEREWOLF", "GENERAL"];
  if (!validChannels.includes(channel)) {
    throw new GameError("INVALID_CHANNEL", `無効なチャンネルです: ${channel}`);
  }

  // ゲームの取得（テストモードでなければ）
  if (!isTestMode && !game) {
    game = gameStore.get(gameId);
    if (!game) {
      throw new GameError("GAME_NOT_FOUND", "指定されたゲームが見つかりません");
    }
  }

  // テストモードか、または有効なゲームがあるかチェック
  if (!isTestMode && !game) {
    throw new GameError("GAME_NOT_FOUND", "指定されたゲームが見つかりません");
  }

  // プレイヤーのロールとゲームの状態をチェック（テストモード以外）
  if (!isTestMode && game) {
    const player = game.players.find(p => p.playerId === senderId);
    
    // プレイヤーがゲームに参加しているか確認
    if (!player) {
      throw new GameError("PLAYER_NOT_IN_GAME", "プレイヤーはこのゲームに参加していません");
    }
    
    // 人狼チャンネルへのアクセス権限チェック
    if (channel === "WEREWOLF" && player.role !== "WEREWOLF") {
      throw new GameError("CHANNEL_ACCESS_DENIED", "人狼チャンネルには人狼のみがアクセスできます");
    }
    
    // プレイヤーの生存状態チェック
    if (!player.isAlive && channel === "GLOBAL") {
      throw new GameError("DEAD_PLAYER_CHAT", "死亡したプレイヤーは昼間のチャットに参加できません");
    }
    
    // ゲームフェーズのチェック（夜間は全体チャット不可）
    if (game.currentPhase === "NIGHT" && channel === "GLOBAL" && player.role !== "WEREWOLF") {
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
  
  addMessage(message);
  logger.info("Chat message sent", {
    gameId,
    channel,
    senderId,
  });
  
  return message;
}

// メッセージを取得する
export function getMessages(
  gameId: string,
  channel: ChatChannel,
  playerId?: string,
  game?: Game,
  isTestMode = false
): ChatMessage[] {
  // 入力検証
  if (!gameId) {
    throw new GameError("GAME_NOT_FOUND", "ゲームIDが指定されていません");
  }

  // 有効なチャンネルかどうかをチェック
  const validChannels = ["GLOBAL", "WEREWOLF", "GENERAL"];
  if (!validChannels.includes(channel)) {
    throw new GameError("INVALID_CHANNEL", `無効なチャンネルです: ${channel}`);
  }

  // ゲームの取得（テストモードでなければ）
  if (!isTestMode && !game) {
    game = gameStore.get(gameId);
    if (!game) {
      throw new GameError("GAME_NOT_FOUND", "指定されたゲームが見つかりません");
    }
  }

  // メッセージがなくても空の配列を返す
  const messages = gameMessages.get(gameId) || [];
  
  // 権限チェック（テストモード以外）
  if (!isTestMode && game && playerId && channel === "WEREWOLF") {
    const player = game.players.find(p => p.playerId === playerId);
    if (!player || player.role !== "WEREWOLF") {
      throw new GameError("CHANNEL_ACCESS_DENIED", "人狼チャンネルには人狼のみがアクセスできます");
    }
  }
  
  return messages.filter(msg => msg.channel === channel);
}

// テスト用のリセット関数
export function resetMessages(): void {
  gameMessages.clear();
  logger.info("Chat messages reset");
}
