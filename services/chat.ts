import { ChatMessage, ChatChannel } from "../types/chat.ts";
import { Game } from "../types/game.ts";
import { logger } from "../utils/logger.ts";

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

// テスト用のリセット関数
export function resetMessages(): void {
  gameMessages.clear();
  logger.info("Chat messages reset");
}