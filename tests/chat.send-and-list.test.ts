import { assertEquals } from "https://deno.land/std@0.210.0/assert/mod.ts";
import * as chatService from "../services/chat.ts";
import { setupChatTest } from "./chat.test-helpers.ts";

Deno.test({
  name: "chat service - GLOBALに送信・取得できる",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const { game, users } = await setupChatTest();

    const msg = await chatService.sendMessage(
      game.id,
      users[0].id,
      "global message",
      "GLOBAL",
      users[0].username,
      game,
      true,
    );
    assertEquals(msg.channel, "GLOBAL");
    assertEquals(msg.content, "global message");

    const list = await chatService.getMessages(game.id, "GLOBAL", users[0].id, game, true);
    assertEquals(list.length, 1);
    assertEquals(list[0].content, "global message");
  },
});
