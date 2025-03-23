import { Context } from 'https://deno.land/x/hono@v3.11.7/context.ts';
import * as gameModel from '../models/game.ts';
import { logger } from '../utils/logger.ts';
import { GameCreation } from '../types/game.ts';

export const getAllGames = async (c: Context) => {
  try {
    logger.info('Fetching all games');
    const games = await gameModel.getAllGames();
    return c.json(games);
  } catch (error) {
    logger.error('Failed to fetch games', error as Error);
    throw error;
  }
};

export const getGame = async (c: Context) => {
  const gameId = c.req.param('gameId');
  
  try {
    logger.info('Fetching game', { gameId });
    const game = await gameModel.getGameById(gameId);
    
    if (!game) {
      logger.warn('Game not found', { gameId });
      return c.json({ code: 'GAME_NOT_FOUND', message: 'Game not found' }, 404);
    }
    
    return c.json(game);
  } catch (error) {
    logger.error('Failed to fetch game', error as Error, { gameId });
    throw error;
  }
};

export const createGame = async (c: Context) => {
  const userId = c.get('userId');
  const data = await c.req.json() as GameCreation;
  
  try {
    logger.info('Creating new game', { userId, gameName: data.name });
    const game = await gameModel.createGame(data, userId);
    return c.json(game, 201);
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message === 'Owner not found') {
      logger.warn('Game creation failed - Owner not found', { userId });
      return c.json({ code: 'OWNER_NOT_FOUND', message: err.message }, 400);
    }
    logger.error('Failed to create game', error as Error, { userId });
    throw error;
  }
};

export const joinGame = async (c: Context) => {
  const gameId = c.req.param('gameId');
  const userId = c.get('userId');
  
  try {
    logger.info('Joining game', { gameId, userId });
    const game = await gameModel.joinGame(gameId, userId);
    return c.json(game);
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message === 'Game not found') {
      logger.warn('Game join failed - Game not found', { gameId });
      return c.json({ code: 'GAME_NOT_FOUND', message: err.message }, 404);
    }
    if (err.message === 'Game is full' || err.message === 'Player already in game') {
      logger.warn('Game join failed', { gameId, userId, reason: err.message });
      return c.json({ code: 'JOIN_ERROR', message: err.message }, 400);
    }
    logger.error('Failed to join game', error as Error, { gameId, userId });
    throw error;
  }
};

export const leaveGame = async (c: Context) => {
  const gameId = c.req.param('gameId');
  const userId = c.get('userId');
  
  try {
    logger.info('Leaving game', { gameId, userId });
    const game = await gameModel.leaveGame(gameId, userId);
    return c.json(game);
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message === 'Game not found') {
      logger.warn('Game leave failed - Game not found', { gameId });
      return c.json({ code: 'GAME_NOT_FOUND', message: err.message }, 404);
    }
    if (err.message === 'Game deleted as owner left') {
      logger.info('Game deleted as owner left', { gameId, userId });
      return c.json({ code: 'GAME_DELETED', message: 'Game has been deleted as the owner left' });
    }
    if (err.message === 'Cannot leave game in progress' || err.message === 'Player not in game') {
      logger.warn('Game leave failed', { gameId, userId, reason: err.message });
      return c.json({ code: 'LEAVE_ERROR', message: err.message }, 400);
    }
    logger.error('Failed to leave game', error as Error, { gameId, userId });
    throw error;
  }
};