import { Context } from "https://deno.land/x/hono@v3.11.7/context.ts";
import * as gameModel from "../models/game.ts";
import { logger } from "../utils/logger.ts";
import { GameCreation } from "../types/game.ts";
import { GameError } from "../types/error.ts";
import { getMessage } from "../utils/messages.ts";
import { getLang } from "../utils/context.ts";

export const getAllGames = async (c: Context) => {
  const lang = getLang(c);
  try {
    logger.info("Fetching all games");
    const games = await gameModel.getAllGames();
    return c.json(games);
  } catch (error) {
    logger.error("Failed to fetch games", error instanceof Error ? error : new Error(String(error)));
    if (!(error instanceof GameError)) {
      throw new GameError(
        "INTERNAL_SERVER_ERROR",
        getMessage("INTERNAL_SERVER_ERROR", lang),
        "ERROR",
        { originalError: error instanceof Error ? error.message : String(error) },
      );
    }
    throw error;
  }
};

export const getGame = async (c: Context) => {
  const gameId = c.req.param("gameId");
  const lang = getLang(c);

  try {
    logger.info("Fetching game", { gameId });
    const game = await gameModel.getGameById(gameId);

    if (!game) {
      throw new GameError(
        "GAME_NOT_FOUND",
        getMessage("GAME_NOT_FOUND", lang),
        "WARN",
        { gameId },
      );
    }

    return c.json(game);
  } catch (error) {
    if (!(error instanceof GameError)) {
      logger.error("Failed to fetch game", error instanceof Error ? error : new Error(String(error)), { gameId });
      throw new GameError(
        "INTERNAL_SERVER_ERROR",
        getMessage("INTERNAL_SERVER_ERROR", lang),
        "ERROR",
        { gameId, originalError: error instanceof Error ? error.message : String(error) },
      );
    }
    throw error;
  }
};

export const createGame = async (c: Context) => {
  const userId = c.get("userId");
  const lang = getLang(c);

  try {
    let data: GameCreation;

    try {
      data = await c.req.json() as GameCreation;

      // バリデーション
      if (!data.name || typeof data.name !== "string") {
        throw new GameError(
          "VALIDATION_ERROR",
          getMessage("VALIDATION_ERROR", lang),
          "WARN",
          { error: "Game name is required" },
        );
      }
    } catch (jsonError) {
      throw new GameError(
        "VALIDATION_ERROR",
        getMessage("VALIDATION_ERROR", lang),
        "WARN",
        { error: jsonError instanceof Error ? jsonError.message : "Invalid request body" },
      );
    }

    logger.info("Creating new game", { userId, gameName: data.name });

    try {
      const game = await gameModel.createGame(data, userId);
      return c.json(game, 201);
    } catch (modelError: unknown) {
      if (modelError instanceof Error) {
        if (modelError.message === "Owner not found") {
          throw new GameError(
            "OWNER_NOT_FOUND",
            getMessage("UNAUTHORIZED", lang),
            "WARN",
            { userId },
          );
        }
      }
      throw modelError;
    }
  } catch (error) {
    if (!(error instanceof GameError)) {
      logger.error("Failed to create game", error instanceof Error ? error : new Error(String(error)), { userId });
      throw new GameError(
        "INTERNAL_SERVER_ERROR",
        getMessage("INTERNAL_SERVER_ERROR", lang),
        "ERROR",
        { userId, originalError: error instanceof Error ? error.message : String(error) },
      );
    }
    throw error;
  }
};

export const joinGame = async (c: Context) => {
  const gameId = c.req.param("gameId");
  const userId = c.get("userId");
  const lang = getLang(c);

  try {
    logger.info("Joining game", { gameId, userId });
    try {
      const game = await gameModel.joinGame(gameId, userId);
      return c.json(game);
    } catch (modelError: unknown) {
      if (modelError instanceof Error) {
        if (modelError.message === "Game not found") {
          throw new GameError(
            "GAME_NOT_FOUND",
            getMessage("GAME_NOT_FOUND", lang),
            "WARN",
            { gameId },
          );
        }
        if (modelError.message === "Game is full") {
          throw new GameError(
            "GAME_FULL",
            getMessage("GAME_FULL", lang),
            "WARN",
            { gameId },
          );
        }
        if (modelError.message === "Player already in game") {
          throw new GameError(
            "JOIN_ERROR",
            modelError.message,
            "WARN",
            { gameId, userId },
          );
        }
      }
      throw modelError;
    }
  } catch (error) {
    if (!(error instanceof GameError)) {
      logger.error("Failed to join game", error instanceof Error ? error : new Error(String(error)), {
        gameId,
        userId,
      });
      throw new GameError(
        "INTERNAL_SERVER_ERROR",
        getMessage("INTERNAL_SERVER_ERROR", lang),
        "ERROR",
        { gameId, userId, originalError: error instanceof Error ? error.message : String(error) },
      );
    }
    throw error;
  }
};

export const leaveGame = async (c: Context) => {
  const gameId = c.req.param("gameId");
  const userId = c.get("userId");
  const lang = getLang(c);

  try {
    logger.info("Leaving game", { gameId, userId });
    try {
      const game = await gameModel.leaveGame(gameId, userId);
      return c.json(game);
    } catch (modelError: unknown) {
      if (modelError instanceof Error) {
        if (modelError.message === "Game not found") {
          throw new GameError(
            "GAME_NOT_FOUND",
            getMessage("GAME_NOT_FOUND", lang),
            "WARN",
            { gameId },
          );
        }
        if (modelError.message === "Game deleted as owner left") {
          logger.info("Game deleted as owner left", { gameId, userId });
          return c.json({
            code: "GAME_DELETED",
            message: "Game has been deleted as the owner left",
            timestamp: new Date().toISOString(),
          });
        }
        if (modelError.message === "Cannot leave game in progress" || modelError.message === "Player not in game") {
          throw new GameError(
            "LEAVE_ERROR",
            modelError.message,
            "WARN",
            { gameId, userId },
          );
        }
      }
      throw modelError;
    }
  } catch (error) {
    if (!(error instanceof GameError)) {
      logger.error("Failed to leave game", error instanceof Error ? error : new Error(String(error)), {
        gameId,
        userId,
      });
      throw new GameError(
        "INTERNAL_SERVER_ERROR",
        getMessage("INTERNAL_SERVER_ERROR", lang),
        "ERROR",
        { gameId, userId, originalError: error instanceof Error ? error.message : String(error) },
      );
    }
    throw error;
  }
};

export const startGame = async (c: Context) => {
  const gameId = c.req.param("gameId");
  const userId = c.get("userId");
  const lang = getLang(c);

  try {
    logger.info("Starting game", { gameId, userId });
    try {
      const game = await gameModel.startGame(gameId, userId);
      return c.json(game);
    } catch (modelError: unknown) {
      if (modelError instanceof Error) {
        if (modelError.message === "Game not found") {
          throw new GameError(
            "GAME_NOT_FOUND",
            getMessage("GAME_NOT_FOUND", lang),
            "WARN",
            { gameId },
          );
        }
        if (modelError.message === "Only the game owner can start the game") {
          throw new GameError(
            "NOT_GAME_OWNER",
            getMessage("NOT_GAME_OWNER", lang),
            "WARN",
            { gameId, userId },
          );
        }
        if (modelError.message === "Game is already in progress") {
          throw new GameError(
            "GAME_ALREADY_STARTED",
            getMessage("GAME_ALREADY_STARTED", lang),
            "WARN",
            { gameId, userId },
          );
        }
        if (
          modelError.message.includes("players are required") ||
          modelError.message === "Game is not in waiting state" ||
          modelError.message === "Too many special roles for the number of players" ||
          modelError.message === "At least 1 werewolf is required"
        ) {
          throw new GameError(
            "START_ERROR",
            modelError.message,
            "WARN",
            { gameId, userId },
          );
        }
      }
      throw modelError;
    }
  } catch (error) {
    if (!(error instanceof GameError)) {
      logger.error("Failed to start game", error instanceof Error ? error : new Error(String(error)), {
        gameId,
        userId,
      });
      throw new GameError(
        "INTERNAL_SERVER_ERROR",
        getMessage("INTERNAL_SERVER_ERROR", lang),
        "ERROR",
        { gameId, userId, originalError: error instanceof Error ? error.message : String(error) },
      );
    }
    throw error;
  }
};
