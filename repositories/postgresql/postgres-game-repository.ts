import { Game, GamePlayer, ActionType } from "../../types/game.ts";
import { GameRepository } from "../interfaces/game-repository.ts";
import { getClient } from "./pg-client.ts";
import { logger } from "../../utils/logger.ts";

/**
 * ゲームリポジトリのPostgreSQL実装
 */
export class PostgresGameRepository implements GameRepository {
  async add(game: Game): Promise<Game> {
    const client = await getClient();
    try {
      await client.queryObject("BEGIN");

      // ゲームテーブルに追加
      await client.queryObject(`
        INSERT INTO games (
          id, name, status, created_at, updated_at, creator_id,
          current_day, current_phase, phase_end_time, winner, max_players, settings
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
        )
      `, [
        game.id,
        game.name,
        game.status,
        game.createdAt,
        game.updatedAt,
        game.creatorId,
        game.currentDay,
        game.currentPhase,
        game.phaseEndTime,
        game.winner,
        game.maxPlayers,
        JSON.stringify(game.settings)
      ]);

      // プレイヤーを追加
      for (const player of game.players) {
        await client.queryObject(`
          INSERT INTO players (
            game_id, player_id, username, role, is_alive, joined_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6
          )
        `, [
          game.id,
          player.playerId,
          player.username,
          player.role,
          player.isAlive,
          player.joinedAt
        ]);
      }

      // ゲームイベントを追加
      for (const event of game.gameEvents) {
        await client.queryObject(`
          INSERT INTO game_events (
            id, game_id, day, phase, type, description, timestamp, 
            actor_id, target_id, result
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
          )
        `, [
          event.id,
          game.id,
          event.day,
          event.phase,
          event.type,
          event.description,
          event.timestamp,
          event.actorId,
          event.targetId,
          event.result ? JSON.stringify(event.result) : null
        ]);
      }

      // ゲームアクションを追加
      if (game.gameActions) {
        for (const action of game.gameActions) {
          await client.queryObject(`
            INSERT INTO game_actions (
              id, game_id, day, phase, type, actor_id, target_id, timestamp, is_completed
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9
            )
          `, [
            action.id,
            game.id,
            action.day,
            action.phase,
            action.type,
            action.playerId, // actorIdとしてplayerIdを使用
            action.targetId,
            action.timestamp || new Date().toISOString(),
            false // GameAction型にisCompletedがないためデフォルト値を設定
          ]);
        }
      }

      await client.queryObject("COMMIT");
      logger.info("Game added to PostgreSQL repository", { gameId: game.id });
      return game;
    } catch (error: unknown) {
      await client.queryObject("ROLLBACK");
      const err = error as Error;
      logger.error("Error adding game to PostgreSQL repository", { error: err.message, gameId: game.id });
      throw error;
    } finally {
      client.release();
    }
  }

  async update(id: string, game: Game): Promise<Game | null> {
    const client = await getClient();
    try {
      await client.queryObject("BEGIN");

      // ゲームが存在するか確認
      const { rows: existingGame } = await client.queryObject<{ id: string }>(
        "SELECT id FROM games WHERE id = $1", [id]
      );
      
      if (existingGame.length === 0) {
        await client.queryObject("ROLLBACK");
        return null;
      }

      // ゲームテーブル更新
      await client.queryObject(`
        UPDATE games SET
          name = $1,
          status = $2,
          updated_at = $3,
          current_day = $4,
          current_phase = $5,
          phase_end_time = $6,
          winner = $7,
          max_players = $8,
          settings = $9
        WHERE id = $10
      `, [
        game.name,
        game.status,
        new Date().toISOString(),
        game.currentDay,
        game.currentPhase,
        game.phaseEndTime,
        game.winner,
        game.maxPlayers,
        JSON.stringify(game.settings),
        id
      ]);

      // プレイヤーを全て削除して再挿入
      await client.queryObject("DELETE FROM players WHERE game_id = $1", [id]);
      
      for (const player of game.players) {
        await client.queryObject(`
          INSERT INTO players (
            game_id, player_id, username, role, is_alive, joined_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6
          )
        `, [
          game.id,
          player.playerId,
          player.username,
          player.role,
          player.isAlive,
          player.joinedAt
        ]);
      }

      // ゲームイベントを追加 (既存のイベントはそのまま)
      const { rows: existingEventIds } = await client.queryObject<{ id: string }>(
        "SELECT id FROM game_events WHERE game_id = $1", [id]
      );
      
      const existingIds = new Set(existingEventIds.map(row => row.id));
      
      for (const event of game.gameEvents) {
        if (!existingIds.has(event.id)) {
          await client.queryObject(`
            INSERT INTO game_events (
              id, game_id, day, phase, type, description, timestamp, 
              actor_id, target_id, result
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
            )
          `, [
            event.id,
            game.id,
            event.day,
            event.phase,
            event.type,
            event.description,
            event.timestamp,
            event.actorId,
            event.targetId,
            event.result ? JSON.stringify(event.result) : null
          ]);
        }
      }

      // ゲームアクションを全て削除して再挿入
      await client.queryObject("DELETE FROM game_actions WHERE game_id = $1", [id]);
      
      if (game.gameActions) {
        for (const action of game.gameActions) {
          await client.queryObject(`
            INSERT INTO game_actions (
              id, game_id, day, phase, type, actor_id, target_id, timestamp, is_completed
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9
            )
          `, [
            action.id,
            game.id,
            action.day,
            action.phase,
            action.type,
            action.playerId, // actorIdとしてplayerIdを使用
            action.targetId,
            action.timestamp || new Date().toISOString(),
            false // GameAction型にisCompletedがないためデフォルト値を設定
          ]);
        }
      }

      await client.queryObject("COMMIT");
      logger.info("Game updated in PostgreSQL repository", { gameId: id });
      return game;
    } catch (error: unknown) {
      await client.queryObject("ROLLBACK");
      const err = error as Error;
      logger.error("Error updating game in PostgreSQL repository", { error: err.message, gameId: id });
      throw error;
    } finally {
      client.release();
    }
  }

  async findById(id: string): Promise<Game | null> {
    const client = await getClient();
    try {
      // ゲーム基本情報を取得
      const { rows: games } = await client.queryObject<{
        id: string;
        name: string;
        status: string;
        created_at: string;
        updated_at: string;
        creator_id: string;
        current_day: number;
        current_phase: string;
        phase_end_time: string | null;
        winner: string | null;
        max_players: number;
        settings: string;
      }>(`
        SELECT * FROM games WHERE id = $1
      `, [id]);
      
      if (games.length === 0) {
        return null;
      }

      const gameData = games[0];

      // プレイヤー情報を取得
      const { rows: players } = await client.queryObject<{
        player_id: string;
        username: string;
        role: string | null;
        is_alive: boolean;
        joined_at: string;
      }>(`
        SELECT player_id, username, role, is_alive, joined_at
        FROM players WHERE game_id = $1
      `, [id]);

      // ゲームイベントを取得
      const { rows: events } = await client.queryObject<{
        id: string;
        day: number;
        phase: string;
        type: string;
        description: string;
        timestamp: string;
        actor_id: string | null;
        target_id: string | null;
        result: string | null;
      }>(`
        SELECT id, day, phase, type, description, timestamp, actor_id, target_id, result
        FROM game_events WHERE game_id = $1
        ORDER BY timestamp ASC
      `, [id]);

      // ゲームアクションを取得
      const { rows: actions } = await client.queryObject<{
        id: string;
        day: number;
        phase: string;
        type: string;
        actor_id: string;
        target_id: string | null;
        timestamp: string;
        is_completed: boolean;
      }>(`
        SELECT id, day, phase, type, actor_id, target_id, timestamp, is_completed
        FROM game_actions WHERE game_id = $1
        ORDER BY timestamp ASC
      `, [id]);

      // Gameオブジェクトを構築
      const game: Game = {
        id: gameData.id,
        name: gameData.name,
        owner: { id: gameData.creator_id, username: "", email: "", createdAt: "", stats: { gamesPlayed: 0, gamesWon: 0, winRatio: 0, villagerWins: 0, werewolfWins: 0 } },
        hasPassword: false,
        maxPlayers: gameData.max_players,
        currentPlayers: players.length,
        status: gameData.status as Game["status"],
        createdAt: gameData.created_at,
        updatedAt: gameData.updated_at,
        creatorId: gameData.creator_id,
        currentDay: gameData.current_day,
        currentPhase: gameData.current_phase as Game["currentPhase"],
        phaseEndTime: gameData.phase_end_time,
        winner: gameData.winner as Game["winner"] || null,
        settings: JSON.parse(gameData.settings),
        players: players.map(p => ({
          playerId: p.player_id,
          username: p.username,
          role: p.role as GamePlayer["role"] || undefined,
          isAlive: p.is_alive,
          joinedAt: p.joined_at
        })),
        gameEvents: events.map(e => ({
          id: e.id,
          day: e.day,
          phase: e.phase as Game["currentPhase"],
          type: e.type as any, // 型を適切に変換
          description: e.description,
          timestamp: e.timestamp,
          actorId: e.actor_id || undefined,
          targetId: e.target_id || undefined,
          result: e.result ? JSON.parse(e.result) : undefined
        })),
        gameActions: actions.map(a => ({
          id: a.id,
          gameId: id,
          day: a.day,
          phase: a.phase as Game["currentPhase"],
          type: a.type as ActionType, // より明確な型指定
          playerId: a.actor_id, // actorIdからplayerIdへ変換
          targetId: a.target_id || "",
          timestamp: a.timestamp
        })),
        actions: {} as Game["actions"] // actionsプロパティを初期化
      };

      return game;
    } catch (error: unknown) {
      const err = error as Error;
      logger.error("Error finding game by ID in PostgreSQL repository", { error: err.message, gameId: id });
      throw error;
    } finally {
      client.release();
    }
  }

  async delete(id: string): Promise<boolean> {
    const client = await getClient();
    try {
      // カスケード削除設定によりゲームを削除すると関連データも削除される
      const result = await client.queryObject(
        "DELETE FROM games WHERE id = $1", [id]
      );
      
      const deleted = result.rowCount && result.rowCount > 0;
      
      if (deleted) {
        logger.info("Game deleted from PostgreSQL repository", { gameId: id });
      }
      
      return deleted || false; // 必ずboolean型を返す
    } catch (error: unknown) {
      const err = error as Error;
      logger.error("Error deleting game from PostgreSQL repository", { error: err.message, gameId: id });
      throw error;
    } finally {
      client.release();
    }
  }

  async findAll(): Promise<Game[]> {
    const client = await getClient();
    try {
      const { rows: gameIds } = await client.queryObject<{ id: string }>(
        "SELECT id FROM games"
      );
      
      const games: Game[] = [];
      
      for (const { id } of gameIds) {
        const game = await this.findById(id);
        if (game) {
          games.push(game);
        }
      }
      
      return games;
    } catch (error: unknown) {
      const err = error as Error;
      logger.error("Error finding all games in PostgreSQL repository", { error: err.message });
      throw error;
    } finally {
      client.release();
    }
  }

  async findByStatus(status: string): Promise<Game[]> {
    const client = await getClient();
    try {
      const { rows: gameIds } = await client.queryObject<{ id: string }>(
        "SELECT id FROM games WHERE status = $1", [status]
      );
      
      const games: Game[] = [];
      
      for (const { id } of gameIds) {
        const game = await this.findById(id);
        if (game) {
          games.push(game);
        }
      }
      
      return games;
    } catch (error: unknown) {
      const err = error as Error;
      logger.error("Error finding games by status in PostgreSQL repository", { error: err.message, status });
      throw error;
    } finally {
      client.release();
    }
  }

  async findByPlayerId(playerId: string): Promise<Game[]> {
    const client = await getClient();
    try {
      const { rows: gameIds } = await client.queryObject<{ game_id: string }>(
        "SELECT DISTINCT game_id FROM players WHERE player_id = $1", [playerId]
      );
      
      const games: Game[] = [];
      
      for (const { game_id } of gameIds) {
        const game = await this.findById(game_id);
        if (game) {
          games.push(game);
        }
      }
      
      return games;
    } catch (error: unknown) {
      const err = error as Error;
      logger.error("Error finding games by player ID in PostgreSQL repository", { error: err.message, playerId });
      throw error;
    } finally {
      client.release();
    }
  }

  async clear(): Promise<void> {
    const client = await getClient();
    try {
      await client.queryObject("BEGIN");
      
      // CASCADE制約によって関連データも削除される
      await client.queryObject("DELETE FROM games");
      
      await client.queryObject("COMMIT");
      logger.info("PostgreSQL game repository cleared");
    } catch (error: unknown) {
      await client.queryObject("ROLLBACK");
      const err = error as Error;
      logger.error("Error clearing PostgreSQL game repository", { error: err.message });
      throw error;
    } finally {
      client.release();
    }
  }

  async getStats(): Promise<Record<string, number>> {
    const client = await getClient();
    try {
      const { rows: totalGames } = await client.queryObject<{ count: number }>(
        "SELECT COUNT(*) as count FROM games"
      );
      
      const { rows: waitingGames } = await client.queryObject<{ count: number }>(
        "SELECT COUNT(*) as count FROM games WHERE status = 'WAITING'"
      );
      
      const { rows: inProgressGames } = await client.queryObject<{ count: number }>(
        "SELECT COUNT(*) as count FROM games WHERE status = 'IN_PROGRESS'"
      );
      
      const { rows: finishedGames } = await client.queryObject<{ count: number }>(
        "SELECT COUNT(*) as count FROM games WHERE status = 'FINISHED'"
      );
      
      const { rows: activePlayers } = await client.queryObject<{ count: number }>(
        "SELECT COUNT(DISTINCT player_id) as count FROM players"
      );
      
      return {
        totalGames: totalGames[0].count,
        waitingGames: waitingGames[0].count,
        inProgressGames: inProgressGames[0].count,
        finishedGames: finishedGames[0].count,
        activePlayers: activePlayers[0].count
      };
    } catch (error: unknown) {
      const err = error as Error;
      logger.error("Error getting stats from PostgreSQL game repository", { error: err.message });
      throw error;
    } finally {
      client.release();
    }
  }
}