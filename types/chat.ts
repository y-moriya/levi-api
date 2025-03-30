import { Role } from "./game.ts";

export type ChatChannel = "GLOBAL" | "WEREWOLF";

export interface ChatMessage {
  id: string;
  gameId: string;
  channel: ChatChannel;
  senderId: string;
  senderUsername: string;
  senderRole?: Role;
  content: string;
  timestamp: string;
}

export interface SendMessageRequest {
  channel: ChatChannel;
  content: string;
}

export interface GetMessagesResponse {
  messages: ChatMessage[];
}

export interface ChatError {
  code: string;
  message: string;
}
