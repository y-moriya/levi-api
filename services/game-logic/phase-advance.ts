import { Game, GameAction, GamePhase, Winner } from "../../types/game.ts";
import { generatePhaseEndMessage } from "../../utils/messages.ts";
import { addSystemMessage } from "../chat.ts";
import { setPhaseTimer } from "../game-phase.ts";
import { updateGame } from "./update.ts";
import { checkGameEnd } from "./wincheck.ts";

// 次フェーズ決定と遷移
export async function advancePhaseCore(game: Game): Promise<Game> {
  // 勝敗チェック（昼の投票直後は村人勝利のみ即時終了、夜は常に即時終了）
  const endCheck = checkGameEnd(game);
  if (endCheck.ended) {
    const justFinishedVoting = game.currentPhase === "DAY_VOTE" || game.currentPhase === "VOTING";
    const isNight = game.currentPhase === "NIGHT";
    if (isNight || (justFinishedVoting && endCheck.winner === "VILLAGERS")) {
      const finished: Game = { ...game, status: "FINISHED", winner: endCheck.winner || "NONE" };
      await updateGame(finished);
      await setPhaseTimer(game.id, 0);
      return finished;
    }
    // それ以外（例: 昼の投票直後に人狼勝利条件を満たす）はフェーズ遷移を継続
  }

  let nextPhase: GamePhase;
  let phaseDuration: number;
  let nextDay = game.currentDay;

  switch (game.currentPhase) {
    case "DAY_DISCUSSION":
      nextPhase = "DAY_VOTE";
      phaseDuration = game.settings.voteTimeSeconds;
      break;
    case "DAY_VOTE":
    case "VOTING":
      nextPhase = "NIGHT";
      phaseDuration = game.settings.nightTimeSeconds;
      break;
    case "NIGHT":
      nextPhase = "DAY_DISCUSSION";
      phaseDuration = game.settings.dayTimeSeconds;
      nextDay += 1;
      break;
    default:
      throw new Error(`Invalid game phase: ${game.currentPhase}`);
  }

  const phaseEndTime = new Date(Date.now() + phaseDuration * 1000);

  // GameAction[] と拡張マップを初期化
  const emptyActions = [] as unknown as GameAction[] & { [key: string]: Map<string, string> };
  emptyActions.votes = new Map<string, string>();
  emptyActions.attacks = new Map<string, string>();
  emptyActions.divinations = new Map<string, string>();
  emptyActions.guards = new Map<string, string>();
  emptyActions.mediums = new Map<string, string>();

  const updated: Game = {
    ...game,
    currentPhase: nextPhase,
    currentDay: nextDay,
    phaseEndTime: phaseEndTime.toISOString(),
    actions: emptyActions,
  };

  const startMsg = startPhaseMessage(updated);
  if (startMsg) {
    await addSystemMessage(game.id, startMsg);
  }

  await updateGame(updated);
  await setPhaseTimer(game.id, phaseDuration);

  return updated;
}

function startPhaseMessage(game: Game): string | null {
  switch (game.currentPhase) {
    case "DAY_DISCUSSION":
      return `${game.currentDay}日目の朝になりました。議論を始めてください。`;
    case "DAY_VOTE":
      return `${game.currentDay}日目の投票を開始します。`;
    case "NIGHT":
      return `${game.currentDay}日目の夜になりました。`;
    default:
      return null;
  }
}

export async function postPhaseEndMessage(game: Game): Promise<void> {
  const msg = generatePhaseEndMessage(game, game.currentPhase, game.currentDay);
  await addSystemMessage(game.id, msg);
}
