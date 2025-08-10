import { Game, GamePhase } from "../../types/game.ts";
import * as gameActions from "../../services/game-actions.ts";

export async function waitForCondition(
  condition: () => boolean | Promise<boolean>,
  timeout = 5000,
  interval = 100,
): Promise<boolean> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    if (await condition()) return true;
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
  return false;
}

export async function waitForGamePhase(
  game: Game,
  phase: GamePhase,
  timeout = 2000,
  interval = 50,
): Promise<boolean> {
  return await waitForCondition(() => game.currentPhase === phase, timeout, interval);
}

export async function waitForActionInitialization(
  gameId: string,
  timeout = 2000,
  interval = 50,
): Promise<boolean> {
  return await waitForCondition(() => {
    const actions = gameActions.getGameActions(gameId);
    return actions !== undefined;
  }, timeout, interval);
}
