// 分割モジュールのファサード。従来のパスを保ちつつエクスポートのみ委譲する。
export { initializeGameActions, resetGameActions } from "./game-actions/core.ts";

export {
  handleAttackAction,
  handleDivineAction,
  handleGuardAction,
  handleMediumAction,
  handleVoteAction,
} from "./game-actions/handlers.ts";

export { processPhaseActions } from "./game-actions/reflect.ts";
export { getAttackDistribution, getVoteDistribution } from "./game-actions/analytics.ts";
export { getActionCache } from "./game-actions/core.ts";
export { submitAction } from "./game-actions/submit.ts";
export { getGameActions } from "./game-actions/state.ts";
