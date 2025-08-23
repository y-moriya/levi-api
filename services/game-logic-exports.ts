// このファイルは循環参照を回避するためのエクスポート用ファイルです
// models/game.tsとservices/game-logic.tsの間の循環依存関係を解消します

import { Game, GameAction, GameActionType, GamePlayer, VoteType, Winner } from "../types/game.ts";

// game-logic.tsから関数をインポート
import * as gameLogicImpl from "./game-logic.ts";

// 名前空間オブジェクトとしても使える形で関数をエクスポート
// これにより import * as gameLogic でインポートした場合に
// gameLogic.startGame() のように使えるようになる
// 注意: 関数の実装はここで再定義して名前空間内に追加する
export function startGame(gameId: string): Promise<Game> {
  return gameLogicImpl.startGame(gameId);
}

export function advancePhase(gameId: string): Promise<Game> {
  return gameLogicImpl.advancePhase(gameId);
}

export function handlePhaseEnd(gameId: string): Promise<Game> {
  return gameLogicImpl.handlePhaseEnd(gameId);
}

export function checkGameEnd(game: Game): { ended: boolean; winner: Winner | null } {
  return gameLogicImpl.checkGameEnd(game);
}

export function assignRoles(game: Game): GamePlayer[] {
  return gameLogicImpl.assignRoles(game);
}

export function processAction(
  gameId: string,
  playerId: string,
  actionType: GameActionType,
  targetId?: string,
  voteType?: VoteType,
): Promise<GameAction> {
  return gameLogicImpl.processAction(gameId, playerId, actionType, targetId, voteType);
}
