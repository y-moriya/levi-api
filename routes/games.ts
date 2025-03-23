import { Hono } from 'https://deno.land/x/hono@v3.11.7/mod.ts';
import * as gamesController from '../controllers/games.ts';
import { authMiddleware } from '../middleware/auth.ts';
import { validateGameCreation } from '../middleware/validation.ts';

const games = new Hono();

// 認証が必要なルートにミドルウェアを適用
games.use('/*', authMiddleware);

// ゲーム一覧の取得
games.get('/', gamesController.getAllGames);

// ゲームの作成 - バリデーションを追加
games.post('/', validateGameCreation, gamesController.createGame);

// 特定のゲームの取得
games.get('/:gameId', gamesController.getGame);

// ゲームへの参加
games.post('/:gameId/join', gamesController.joinGame);

// ゲームからの退出
games.post('/:gameId/leave', gamesController.leaveGame);

export default games;