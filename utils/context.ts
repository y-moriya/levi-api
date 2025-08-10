import { Context } from "https://deno.land/x/hono@v3.11.7/mod.ts";
import { SupportedLanguage } from "./messages.ts";
import { ErrorCode, GameError } from "../types/error.ts";

/**
 * 言語設定をコンテキストに保存
 */
export function setLang(c: Context, lang: string): void {
  c.set("lang", lang as SupportedLanguage);
}

/**
 * コンテキストから言語設定を取得
 */
export function getLang(c: Context): SupportedLanguage {
  return (c.get("lang") || "ja") as SupportedLanguage;
}

/**
 * リクエストIDをコンテキストに保存
 */
export function setRequestId(c: Context, requestId: string): void {
  c.set("requestId", requestId);
}

/**
 * コンテキストからリクエストIDを取得
 */
export function getRequestId(c: Context): string | undefined {
  return c.get("requestId");
}

/**
 * リクエストボディをバリデーションして取得
 * @param c Honoコンテキスト
 * @param validator バリデーション関数
 * @returns バリデーション済みのリクエストボディ
 */
export async function getValidatedBody<T>(
  c: Context,
  validator: (data: unknown) => Promise<T> | T,
): Promise<T> {
  try {
    const body = await c.req.json();
    return await Promise.resolve(validator(body));
  } catch (error) {
    const _lang = getLang(c);
    throw new GameError(
      ErrorCode.VALIDATION_ERROR,
      "リクエストデータが無効です",
      "ERROR", // ErrorSeverity型の明示的な値を指定
      {
        errorMessage: error instanceof Error ? error.message : String(error),
      },
    );
  }
}
