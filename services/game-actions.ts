// 分割モジュールのファサード。従来のパスを保ちつつエクスポートのみ委譲する。
export {
  resetGameActions,
  initializeGameActions,
} from "./game-actions/core.ts";

export {
  handleVoteAction,
  handleAttackAction,
  handleDivineAction,
  handleGuardAction,
  handleMediumAction,
} from "./game-actions/handlers.ts";

export { processPhaseActions } from "./game-actions/reflect.ts";
export { getVoteDistribution, getAttackDistribution } from "./game-actions/analytics.ts";
export { getActionCache } from "./game-actions/core.ts";
export { submitAction } from "./game-actions/submit.ts";
export { getGameActions } from "./game-actions/state.ts";
