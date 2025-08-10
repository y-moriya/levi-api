import { Game } from "../../types/game.ts";
import { gameStore } from "../../models/game.ts";

// ゲーム更新の薄いラッパー（旧API互換）
export const updateGame = async (game: Game): Promise<Game> => {
  await gameStore.update(game);
  return game;
};
