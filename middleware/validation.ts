import { Context, MiddlewareHandler, Next } from "https://deno.land/x/hono@v3.11.7/mod.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { ErrorCode, GameError } from "../types/error.ts";
import { getMessage, SupportedLanguage } from "../utils/messages.ts";
import { logger } from "../utils/logger.ts";

// バリデーション用のzodスキーマ定義
const userRegistrationSchema = z.object({
  username: z.string()
    .min(3, { message: "Username must be between 3 and 20 characters" })
    .max(20, { message: "Username must be between 3 and 20 characters" }),
  email: z.string()
    .email({ message: "Invalid email format" }),
  password: z.string()
    .min(8, { message: "Password must be at least 8 characters" }),
});

const loginSchema = z.object({
  email: z.string()
    .email({ message: "Invalid email format" }),
  password: z.string()
    .min(1, { message: "Password is required" }),
});

const gameSettingsSchema = z.object({
  dayTimeSeconds: z.number()
    .min(60, { message: "Day time must be at least 60 seconds" })
    .optional()
    .default(300),
  nightTimeSeconds: z.number()
    .min(30, { message: "Night time must be at least 30 seconds" })
    .optional()
    .default(180),
  voteTimeSeconds: z.number()
    .min(30, { message: "Vote time must be at least 30 seconds" })
    .optional()
    .default(60),
  roles: z.object({
    werewolfCount: z.number()
      .min(1, { message: "At least 1 werewolf is required" })
      .optional()
      .default(2),
    seerCount: z.number()
      .min(0, { message: "Seer count cannot be negative" })
      .optional()
      .default(1),
    bodyguardCount: z.number()
      .min(0, { message: "Bodyguard count cannot be negative" })
      .optional()
      .default(1),
    mediumCount: z.number()
      .min(0, { message: "Medium count cannot be negative" })
      .optional()
      .default(0),
  }).optional().default({}),
}).optional().default({});

const gameCreationSchema = z.object({
  name: z.string()
    .min(3, { message: "Game name must be between 3 and 30 characters" })
    .max(30, { message: "Game name must be between 3 and 30 characters" }),
  maxPlayers: z.number()
    .min(3, { message: "Maximum players must be between 3 and 20" })
    .max(20, { message: "Maximum players must be between 3 and 20" }),
  password: z.string().optional(),
  settings: gameSettingsSchema,
});

export const createValidationMiddleware = (schema: z.ZodType): MiddlewareHandler => {
  return async (c: Context, next: Next) => {
    try {
      const body = await c.req.json();
      const validatedData = await schema.parseAsync(body);
      c.set("validatedBody", validatedData);
      await next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const lang = c.get("lang") as SupportedLanguage;

        // バリデーションエラーをログに記録
        logger.warn("Validation error", {
          errors: error.errors.map((err) => ({
            path: err.path.join("."),
            message: err.message,
          })),
          requestPath: c.req.path,
        });

        // 明示的に VALIDATION_ERROR コードを設定する
        const gameError = new GameError(
          ErrorCode.VALIDATION_ERROR, // この行が重要: エラーコードを明示的に設定
          getMessage("VALIDATION_ERROR", lang),
          "WARN",
          {
            validationErrors: error.errors.map((err) => ({
              path: err.path.join("."),
              message: err.message,
            })),
          },
        );

        logger.info("Throwing validation error", { code: gameError.code, message: gameError.message });
        throw gameError;
      }
      throw error;
    }
  };
};

export const validateUserRegistration = createValidationMiddleware(userRegistrationSchema);
export const validateLogin = createValidationMiddleware(loginSchema);
export const validateGameCreation = createValidationMiddleware(gameCreationSchema);
