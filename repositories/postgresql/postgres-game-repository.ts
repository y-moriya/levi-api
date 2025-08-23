import { Game } from "../../types/game.ts";
import { GameRepository } from "../interfaces/game-repository.ts";
import { addGame } from "./game/add.ts";
import { updateGame } from "./game/update.ts";
import { findGameById } from "./game/find-by-id.ts";
import { deleteGameById } from "./game/delete.ts";
import { findAllGames } from "./game/find-all.ts";
import { findGamesByStatus } from "./game/find-by-status.ts";
import { findGamesByPlayerId } from "./game/find-by-player-id.ts";
import { clearGames } from "./game/clear.ts";
import { getGameStats } from "./game/stats.ts";

/**
 * ゲームリポジトリのPostgreSQL実装（委譲）
 */
export class PostgresGameRepository implements GameRepository {
  add(game: Game): Promise<Game> {
    return addGame(game);
  }

  update(id: string, game: Game): Promise<Game | null> {
    return updateGame(id, game);
  }

  findById(id: string): Promise<Game | null> {
    return findGameById(id);
  }

  delete(id: string): Promise<boolean> {
    return deleteGameById(id);
  }

  findAll(): Promise<Game[]> {
    return findAllGames();
  }

  findByStatus(status: string): Promise<Game[]> {
    return findGamesByStatus(status);
  }

  findByPlayerId(playerId: string): Promise<Game[]> {
    return findGamesByPlayerId(playerId);
  }

  clear(): Promise<void> {
    return clearGames();
  }

  getStats(): Promise<Record<string, number>> {
    return getGameStats();
  }
}
