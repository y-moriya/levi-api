import { Game } from "../../../types/game.ts";
import { getClient } from "../pg-client.ts";
import { logger } from "../../../utils/logger.ts";

export async function updateGame(id: string, game: Game): Promise<Game | null> {
  const client = await getClient();
  try {
    await client.queryObject("BEGIN");

    const { rows: existingGame } = await client.queryObject<{ id: string }>(
      "SELECT id FROM games WHERE id = $1",
      [id],
    );

    if (existingGame.length === 0) {
      await client.queryObject("ROLLBACK");
      return null;
    }

    await client.queryObject(
      `
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
    `,
      [
        game.name,
        game.status,
        new Date().toISOString(),
        game.currentDay,
        game.currentPhase,
        game.phaseEndTime,
        game.winner,
        game.maxPlayers,
        JSON.stringify(game.settings),
        id,
      ],
    );

    await client.queryObject("DELETE FROM players WHERE game_id = $1", [id]);

    for (const player of game.players) {
      await client.queryObject(
        `
        INSERT INTO players (
          game_id, player_id, username, role, is_alive, joined_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6
        )
      `,
        [
          game.id,
          player.playerId,
          player.username,
          player.role,
          player.isAlive,
          player.joinedAt,
        ],
      );
    }

    const { rows: existingEventIds } = await client.queryObject<{ id: string }>(
      "SELECT id FROM game_events WHERE game_id = $1",
      [id],
    );

    const existingIds = new Set(existingEventIds.map((row) => row.id));

    for (const event of game.gameEvents) {
      if (!existingIds.has(event.id)) {
        await client.queryObject(
          `
          INSERT INTO game_events (
            id, game_id, day, phase, type, description, timestamp, 
            actor_id, target_id, result
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
          )
        `,
          [
            event.id,
            game.id,
            event.day,
            event.phase,
            event.type,
            event.description,
            event.timestamp,
            event.actorId,
            event.targetId,
            event.result ? JSON.stringify(event.result) : null,
          ],
        );
      }
    }

    await client.queryObject("DELETE FROM game_actions WHERE game_id = $1", [id]);

    if (game.gameActions) {
      for (const action of game.gameActions) {
        await client.queryObject(
          `
          INSERT INTO game_actions (
            id, game_id, day, phase, type, actor_id, target_id, timestamp, is_completed
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9
          )
        `,
          [
            action.id,
            game.id,
            action.day,
            action.phase,
            action.type,
            action.playerId,
            action.targetId,
            action.timestamp || new Date().toISOString(),
            false,
          ],
        );
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
