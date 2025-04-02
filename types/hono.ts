import { SupportedLanguage } from "../utils/messages.ts";
import { Context as _Context } from "https://deno.land/x/hono@v3.11.7/context.ts";

// コンテキスト変数のインターフェース拡張
declare global {
  interface ContextVariableMap {
    userId: string;
    validatedBody: unknown;
    lang: SupportedLanguage;
    requestId: string;
  }
}
