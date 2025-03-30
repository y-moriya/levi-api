import { timingSafeEqual } from "https://deno.land/x/hono@v3.11.7/utils/buffer.ts";

/**
 * パスワードをハッシュ化する高速な実装
 * テスト環境用に最適化されています
 * 注: 本番環境ではより安全なbcryptなどを使用すべきです
 */
export const hashPassword = async (password: string): Promise<string> => {
  // SHA-256を使用（bcryptよりずっと高速）
  const encoder = new TextEncoder();
  const salt = crypto.randomUUID();
  const passwordData = encoder.encode(password + salt);
  const hashBuffer = await crypto.subtle.digest("SHA-256", passwordData);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

  // salt+hashの形式で保存
  return `${salt}:${hashHex}`;
};

/**
 * パスワードとハッシュを比較する高速な実装
 * テスト環境用に最適化されています
 */
export const comparePassword = async (password: string, hashWithSalt: string): Promise<boolean> => {
  const [salt, storedHash] = hashWithSalt.split(":");

  if (!salt || !storedHash) {
    return false;
  }

  const encoder = new TextEncoder();
  const passwordData = encoder.encode(password + salt);
  const hashBuffer = await crypto.subtle.digest("SHA-256", passwordData);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

  return timingSafeEqual(storedHash, hashHex);
};
