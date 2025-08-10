import { Game } from "../../../types/game.ts";
import { getClient } from "../pg-client.ts";
import { logger } from "../../../utils/logger.ts";

export async function addGame(game: Game): Promise<Game> {
  const client = await getClient();
  try {
    await client.queryObject("BEGIN");

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
          action.playerId,
          action.targetId,
          action.timestamp || new Date().toISOString(),
          false
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
