import { Context } from "https://deno.land/x/hono@v3.11.7/context.ts";
import * as authService from "../services/auth.ts";
import { UserRegistration } from "../types/user.ts";
import { ErrorCode, GameError } from "../types/error.ts";
import { getLang, getValidatedBody } from "../utils/context.ts";
import { getMessage } from "../utils/messages.ts";

// POST /users - 新規ユーザー登録
export const createUser = async (c: Context) => {
  const lang = getLang(c);
  try {
    // 既存のバリデーションミドルウェアにより validatedBody が設定される想定
    const data = await getValidatedBody<UserRegistration>(c, (body) => {
      if (!body || typeof body !== "object") {
        throw new GameError(ErrorCode.VALIDATION_ERROR, getMessage("VALIDATION_ERROR", lang), "WARN");
      }
      const { username, email, password } = body as Record<string, unknown>;
      if (
        !username || typeof username !== "string" ||
        !email || typeof email !== "string" ||
        !password || typeof password !== "string"
      ) {
        throw new GameError(ErrorCode.VALIDATION_ERROR, getMessage("VALIDATION_ERROR", lang), "WARN");
      }
      return { username, email, password } as UserRegistration;
    });

    const user = await authService.register(data);
    return c.json(user, 201);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Email already exists") {
        throw new GameError(ErrorCode.EMAIL_EXISTS, getMessage("EMAIL_EXISTS", lang), "WARN");
      }
    }
    if (error instanceof GameError) throw error;
    throw new GameError(
      ErrorCode.INTERNAL_SERVER_ERROR,
      getMessage("INTERNAL_SERVER_ERROR", lang),
      "ERROR",
    );
  }
};

// GET /users/:userId - ユーザー情報取得
export const getUser = async (c: Context) => {
  const lang = getLang(c);
  try {
    const userId = c.req.param("userId");
    if (!userId) {
      throw new GameError(ErrorCode.VALIDATION_ERROR, getMessage("VALIDATION_ERROR", lang), "WARN");
    }

    const user = await authService.getUserById(userId);
    if (!user) {
      throw new GameError(ErrorCode.NOT_FOUND, getMessage("NOT_FOUND", lang), "INFO");
    }
    return c.json(user, 200);
  } catch (error) {
    if (error instanceof GameError) throw error;
    throw new GameError(
      ErrorCode.INTERNAL_SERVER_ERROR,
      getMessage("INTERNAL_SERVER_ERROR", lang),
      "ERROR",
    );
  }
};
