import { ActionType, Game, GamePlayer } from "../../../types/game.ts";
import { getClient } from "../pg-client.ts";
import { logger } from "../../../utils/logger.ts";

export async function findGameById(id: string): Promise<Game | null> {
  const client = await getClient();
  try {
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
    }>(`SELECT * FROM games WHERE id = $1`, [id]);

    if (games.length === 0) return null;

    const gameData = games[0];

    const { rows: players } = await client.queryObject<{
      player_id: string;
      username: string;
      role: string | null;
      is_alive: boolean;
      joined_at: string;
    }>(`SELECT player_id, username, role, is_alive, joined_at FROM players WHERE game_id = $1`, [id]);

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
    }>(
      `SELECT id, day, phase, type, description, timestamp, actor_id, target_id, result FROM game_events WHERE game_id = $1 ORDER BY timestamp ASC`,
      [id],
    );

    const { rows: actions } = await client.queryObject<{
      id: string;
      day: number;
      phase: string;
      type: string;
      actor_id: string;
      target_id: string | null;
      timestamp: string;
      is_completed: boolean;
    }>(
      `SELECT id, day, phase, type, actor_id, target_id, timestamp, is_completed FROM game_actions WHERE game_id = $1 ORDER BY timestamp ASC`,
      [id],
    );

    const parseMaybeJson = <T = unknown>(value: unknown): T | undefined => {
      if (value == null) return undefined;
      if (typeof value === "string") {
        try {
          return JSON.parse(value) as T;
        } catch {
          return undefined;
        }
      }
      // 既にオブジェクトの場合はそのまま
      return value as T;
    };

    const game: Game = {
      id: gameData.id,
      name: gameData.name,
      owner: {
        id: gameData.creator_id,
        username: "",
        email: "",
        createdAt: "",
        stats: { gamesPlayed: 0, gamesWon: 0, winRatio: 0, villagerWins: 0, werewolfWins: 0 },
      },
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
      settings: parseMaybeJson<Game["settings"]>(gameData.settings) as Game["settings"],
      players: players.map((p) => ({
        playerId: p.player_id,
        username: p.username,
        role: p.role as GamePlayer["role"] || undefined,
        isAlive: p.is_alive,
        joinedAt: p.joined_at,
      })),
      gameEvents: events.map((e) => ({
        id: e.id,
        day: e.day,
        phase: e.phase as Game["currentPhase"],
        type: e.type as any,
        description: e.description,
        timestamp: e.timestamp,
        actorId: e.actor_id || undefined,
        targetId: e.target_id || undefined,
        result: parseMaybeJson(e.result),
      })),
      gameActions: actions.map((a) => ({
        id: a.id,
        gameId: id,
        day: a.day,
        phase: a.phase as Game["currentPhase"],
        type: a.type as ActionType,
        playerId: a.actor_id,
        targetId: a.target_id || "",
        timestamp: a.timestamp,
      })),
      actions: {} as Game["actions"],
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
