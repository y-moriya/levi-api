import { Context } from "https://deno.land/x/hono@v3.11.7/context.ts";
import * as authService from "../services/auth.ts";
import { Login, UserRegistration } from "../types/user.ts";
import { logger } from "../utils/logger.ts";
import { GameError } from "../types/error.ts";
import { getMessage } from "../utils/messages.ts";
import { getLang, getValidatedBody } from "../utils/context.ts";

// シンプルなバリデーション関数
const validateRegistration = (data: unknown): UserRegistration => {
  // ここでより詳細なバリデーションが必要な場合は実装する
  if (!data || typeof data !== "object") {
    throw new GameError("VALIDATION_ERROR", "Invalid request body", "WARN");
  }
  
  const { username, email, password } = data as Record<string, unknown>;
  
  if (!username || typeof username !== "string" || 
      !email || typeof email !== "string" || 
      !password || typeof password !== "string") {
    throw new GameError("VALIDATION_ERROR", "Missing required fields", "WARN");
  }
  
  return { username, email, password } as UserRegistration;
};

const validateLogin = (data: unknown): Login => {
  if (!data || typeof data !== "object") {
    throw new GameError("VALIDATION_ERROR", "Invalid request body", "WARN");
  }
  
  const { email, password } = data as Record<string, unknown>;
  
  if (!email || typeof email !== "string" || 
      !password || typeof password !== "string") {
    throw new GameError("VALIDATION_ERROR", "Missing required fields", "WARN");
  }
  
  return { email, password } as Login;
};

export const register = async (c: Context) => {
  try {
    const lang = getLang(c);
    let data: UserRegistration;

    try {
      data = await getValidatedBody<UserRegistration>(c, validateRegistration);
    } catch (validationError) {
      if (validationError instanceof GameError) {
        console.log("Validation error caught with code:", validationError.code);
        throw validationError;
      }
      const error = new GameError(
        "VALIDATION_ERROR",
        getMessage("VALIDATION_ERROR", lang),
        "WARN",
        { error: validationError instanceof Error ? validationError.message : "Unknown validation error" }
      );
      console.log("Created new validation GameError with code:", error.code);
      throw error;
    }
    
    logger.info("Registering new user", { username: data.username, email: data.email });

    try {
      const user = await authService.register(data);
      logger.info("User registered successfully", { userId: user.id });
      return c.json(user, 201);
    } catch (error: unknown) {
      if (error instanceof Error) {
        if (error.message === "Email already exists") {
          const emailError = new GameError(
            "EMAIL_EXISTS",
            getMessage("EMAIL_EXISTS", lang),
            "WARN",
            { email: data.email }
          );
          console.log("Created EMAIL_EXISTS GameError with code:", emailError.code);
          throw emailError;
        }
      }
      throw error;
    }
  } catch (error) {
    // GameErrorはそのままスロー、それ以外はGameErrorに変換
    if (error instanceof GameError) {
      console.log("Rethrowing GameError with code:", error.code);
      throw error;
    }
    const lang = getLang(c);
    const serverError = new GameError(
      "INTERNAL_SERVER_ERROR",
      getMessage("INTERNAL_SERVER_ERROR", lang),
      "ERROR",
      { originalError: error instanceof Error ? error.message : String(error) }
    );
    console.log("Created server GameError with code:", serverError.code);
    throw serverError;
  }
};

export const login = async (c: Context) => {
  try {
    const lang = getLang(c);
    let data: Login;
    
    try {
      data = await getValidatedBody<Login>(c, validateLogin);
    } catch (validationError) {
      if (validationError instanceof GameError) {
        console.log("Login validation error caught with code:", validationError.code);
        throw validationError;
      }
      const error = new GameError(
        "VALIDATION_ERROR",
        getMessage("VALIDATION_ERROR", lang),
        "WARN",
        { error: validationError instanceof Error ? validationError.message : "Unknown validation error" }
      );
      console.log("Created login validation GameError with code:", error.code);
      throw error;
    }
    
    logger.info("User login attempt", { email: data.email });

    try {
      const authToken = await authService.login(data);
      logger.info("User logged in successfully", { userId: authToken.user.id });
      return c.json(authToken, 200);
    } catch (error: unknown) {
      if (error instanceof Error) {
        if (error.message === "Invalid credentials") {
          const credError = new GameError(
            "INVALID_CREDENTIALS",
            getMessage("INVALID_CREDENTIALS", lang),
            "WARN",
            { email: data.email }
          );
          console.log("Created INVALID_CREDENTIALS GameError with code:", credError.code);
          throw credError;
        }
      }
      throw error;
    }
  } catch (error) {
    // GameErrorはそのままスロー、それ以外はGameErrorに変換
    if (error instanceof GameError) {
      console.log("Rethrowing login GameError with code:", error.code);
      throw error;
    }
    const lang = getLang(c);
    const serverError = new GameError(
      "INTERNAL_SERVER_ERROR",
      getMessage("INTERNAL_SERVER_ERROR", lang),
      "ERROR",
      { originalError: error instanceof Error ? error.message : String(error) }
    );
    console.log("Created login server GameError with code:", serverError.code);
    throw serverError;
  }
};
