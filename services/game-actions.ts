import { ActionResult, DivineResult, Game, GamePlayer, MediumResult } from "../types/game.ts";
import { logger } from "../utils/logger.ts";
import { LRUCache } from "../utils/cache.ts";

// ゲームごとのアクション状態を管理
interface GameActionsState {
  votes: Map<string, string>;
  attacks: Map<string, string>;
  divines: Map<string, string>;
  guards: Map<string, string>;
  mediums: Map<string, string>; // 霊能者のアクション
  // 最近の計算結果をキャッシュ
  cachedResults?: {
    voteDistribution?: Map<string, number>;
    attackDistribution?: Map<string, number>;
    timestamp: number;
  };
}

// ゲームアクションのキャッシュ (最大100ゲーム、10分有効)
const actionCache = new LRUCache<string, GameActionsState>(100, 10 * 60 * 1000);

/**
 * Reset all game actions (for testing)
 */
export function resetGameActions(): void {
  actionCache.clear();
  logger.info("Game actions reset");
}

/**
 * ゲームのアクション状態を初期化
 */
export function initializeGameActions(gameId: string): void {
  // 新しいアクション状態を設定
  const newActions: GameActionsState = {
    votes: new Map<string, string>(),
    attacks: new Map<string, string>(),
    divines: new Map<string, string>(),
    guards: new Map<string, string>(),
    mediums: new Map<string, string>(),
  };

  actionCache.set(gameId, newActions);
  logger.info("Game actions initialized", { gameId });
}

/**
 * 投票アクションを処理
 */
export async function handleVoteAction(game: Game, playerId: string, targetId: string): Promise<ActionResult> {
  logger.info("Handling vote action", {
    gameId: game.id,
    currentPhase: game.currentPhase,
    currentDay: game.currentDay,
    playerId,
    targetId,
  });

  if (game.currentPhase !== "DAY_VOTE") {
    logger.warn("Invalid phase for voting", {
      gameId: game.id,
      expectedPhase: "DAY_VOTE",
      actualPhase: game.currentPhase,
    });
    return { success: false, message: "投票フェーズではありません" };
  }

  const player = game.players.find((p) => p.playerId === playerId);
  const target = game.players.find((p) => p.playerId === targetId);

  if (!player?.isAlive || !target?.isAlive) {
    logger.warn("Dead player involved in vote", {
      gameId: game.id,
      playerAlive: player?.isAlive,
      targetAlive: target?.isAlive,
    });
    return { success: false, message: "死亡したプレイヤーは投票できません/投票対象にできません" };
  }

  let actions = actionCache.get(game.id);
  if (!actions) {
    logger.error("Game actions not initialized");
    initializeGameActions(game.id);
    const newActions = actionCache.get(game.id);
    if (!newActions) {
      return { success: false, message: "ゲームのアクション状態が初期化できませんでした" };
    }
    actions = newActions;
  }

  // アクション状態に投票を記録
  actions.votes.set(playerId, targetId);

  // キャッシュされた結果をリセット（新しい投票があったため）
  if (actions.cachedResults) {
    delete actions.cachedResults.voteDistribution;
  }

  logger.info("Vote recorded", {
    gameId: game.id,
    playerId,
    targetId,
    currentVotes: Array.from(actions.votes.entries()),
  });

  return { success: true, message: "投票が受け付けられました" };
}

/**
 * 襲撃アクションを処理
 */
export async function handleAttackAction(game: Game, playerId: string, targetId: string): Promise<ActionResult> {
  if (game.currentPhase !== "NIGHT") {
    return { success: false, message: "夜フェーズではありません" };
  }

  const player = game.players.find((p) => p.playerId === playerId);
  const target = game.players.find((p) => p.playerId === targetId);

  if (!player?.isAlive || !target?.isAlive) {
    return { success: false, message: "死亡したプレイヤーは襲撃できません/襲撃対象にできません" };
  }

  if (player.role !== "WEREWOLF") {
    return { success: false, message: "人狼以外は襲撃できません" };
  }

  if (target.role === "WEREWOLF") {
    return { success: false, message: "人狼を襲撃することはできません" };
  }

  let actions = actionCache.get(game.id);
  if (!actions) {
    logger.error("Game actions not initialized");
    initializeGameActions(game.id);
    const newActions = actionCache.get(game.id);
    if (!newActions) {
      return { success: false, message: "ゲームのアクション状態が初期化できませんでした" };
    }
    actions = newActions;
  }

  // アクション状態に記録
  actions.attacks.set(playerId, targetId);

  // キャッシュされた結果をリセット
  if (actions.cachedResults) {
    delete actions.cachedResults.attackDistribution;
  }

  return { success: true, message: "襲撃が受け付けられました" };
}

/**
 * 占いアクションを処理
 */
export async function handleDivineAction(game: Game, playerId: string, targetId: string): Promise<DivineResult> {
  if (game.currentPhase !== "NIGHT") {
    return {
      success: false,
      message: "夜フェーズではありません",
      targetPlayerId: targetId,
      targetUsername: "",
      isWerewolf: false,
    };
  }

  const player = game.players.find((p) => p.playerId === playerId);
  const target = game.players.find((p) => p.playerId === targetId);

  if (!player?.isAlive || !target?.isAlive) {
    return {
      success: false,
      message: "死亡したプレイヤーは占えません/占い対象にできません",
      targetPlayerId: targetId,
      targetUsername: target?.username || "",
      isWerewolf: false,
    };
  }

  if (player.role !== "SEER") {
    return {
      success: false,
      message: "占い師以外は占うことができません",
      targetPlayerId: targetId,
      targetUsername: target.username,
      isWerewolf: false,
    };
  }

  let actions = actionCache.get(game.id);
  if (!actions) {
    logger.error("Game actions not initialized");
    initializeGameActions(game.id);
    const newActions = actionCache.get(game.id);
    if (!newActions) {
      return {
        success: false,
        message: "ゲームのアクション状態が初期化できませんでした",
        targetPlayerId: targetId,
        targetUsername: target.username,
        isWerewolf: false,
      };
    }
    actions = newActions;
  }

  // アクション状態に記録
  actions.divines.set(playerId, targetId);

  return {
    success: true,
    message: "占いが受け付けられました",
    targetPlayerId: targetId,
    targetUsername: target.username,
    isWerewolf: target.role === "WEREWOLF",
  };
}

/**
 * 護衛アクションを処理
 */
export async function handleGuardAction(game: Game, playerId: string, targetId: string): Promise<ActionResult> {
  if (game.currentPhase !== "NIGHT") {
    return { success: false, message: "夜フェーズではありません" };
  }

  const player = game.players.find((p) => p.playerId === playerId);
  const target = game.players.find((p) => p.playerId === targetId);

  if (!player?.isAlive || !target?.isAlive) {
    return { success: false, message: "死亡したプレイヤーは護衛できません/護衛対象にできません" };
  }

  if (player.role !== "BODYGUARD") {
    return { success: false, message: "狩人以外は護衛できません" };
  }

  let actions = actionCache.get(game.id);
  if (!actions) {
    logger.error("Game actions not initialized");
    initializeGameActions(game.id);
    const newActions = actionCache.get(game.id);
    if (!newActions) {
      return { success: false, message: "ゲームのアクション状態が初期化できませんでした" };
    }
    actions = newActions;
  }

  // アクション状態に記録
  actions.guards.set(playerId, targetId);

  return { success: true, message: "護衛が受け付けられました" };
}

/**
 * 霊能アクションを処理
 */
export async function handleMediumAction(game: Game, playerId: string, targetId: string): Promise<MediumResult> {
  // 霊能はいつでも使えるべきだが、死亡者が出る前の昼フェーズでは結果がない
  if (game.currentPhase !== "NIGHT" && game.currentPhase !== "DAY_DISCUSSION") {
    return {
      success: false,
      message: "昼または夜のフェーズでしか霊能は使えません",
      targetPlayerId: targetId,
      targetUsername: "",
      isWerewolf: false,
    };
  }

  const player = game.players.find((p) => p.playerId === playerId);
  const target = game.players.find((p) => p.playerId === targetId);

  // 霊能者自身は生きている必要がある
  if (!player?.isAlive) {
    return {
      success: false,
      message: "死亡したプレイヤーは霊能を使えません",
      targetPlayerId: targetId,
      targetUsername: target?.username || "",
      isWerewolf: false,
    };
  }

  // 霊能者の役職チェック
  if (player.role !== "MEDIUM") {
    return {
      success: false,
      message: "霊能者以外は霊能を使えません",
      targetPlayerId: targetId,
      targetUsername: target?.username || "",
      isWerewolf: false,
    };
  }

  // ターゲットが死亡済みかつ前日に処刑されたプレイヤーか確認
  if (!target || target.isAlive || target.deathCause !== "EXECUTION" || 
      !target.deathDay || target.deathDay !== game.currentDay - 1) {
    return {
      success: false,
      message: "前日に処刑されたプレイヤーのみ霊能の対象になります",
      targetPlayerId: targetId,
      targetUsername: target?.username || "",
      isWerewolf: false,
    };
  }

  let actions = actionCache.get(game.id);
  if (!actions) {
    logger.error("Game actions not initialized");
    initializeGameActions(game.id);
    const newActions = actionCache.get(game.id);
    if (!newActions) {
      return {
        success: false,
        message: "ゲームのアクション状態が初期化できませんでした",
        targetPlayerId: targetId,
        targetUsername: target.username,
        isWerewolf: false,
      };
    }
    actions = newActions;
  }

  // アクション状態に記録
  actions.mediums.set(playerId, targetId);

  return {
    success: true,
    message: "霊能が受け付けられました",
    targetPlayerId: targetId,
    targetUsername: target.username,
    isWerewolf: target.role === "WEREWOLF",
  };
}

/**
 * アクション未実行のプレイヤーにランダムアクションを効率的に割り当て
 */
function assignRandomActions(game: Game): void {
  const actions = actionCache.get(game.id);
  if (!actions) return;

  const alivePlayers = game.players.filter((p) => p.isAlive);

  // 役職ごとのプレイヤーリストを一度だけ生成
  const rolePlayerMap = new Map<string, GamePlayer[]>();

  if (game.currentPhase === "DAY_VOTE") {
    // 投票していないプレイヤーを抽出
    const nonVotingPlayers = alivePlayers.filter(
      (player) => !actions.votes.has(player.playerId),
    );

    if (nonVotingPlayers.length === 0) return;

    // 投票可能なターゲットリストを一度だけ生成
    const possibleTargets = alivePlayers.map((p) => p.playerId);

    // バッチ処理で投票を割り当て
    nonVotingPlayers.forEach((player) => {
      const validTargets = possibleTargets.filter((id) => id !== player.playerId);
      if (validTargets.length > 0) {
        const targetId = validTargets[Math.floor(Math.random() * validTargets.length)];
        actions.votes.set(player.playerId, targetId);
        logger.info("Random vote assigned", {
          gameId: game.id,
          playerId: player.playerId,
          targetId,
        });
      }
    });

    // キャッシュされた結果をリセット
    if (actions.cachedResults) {
      delete actions.cachedResults.voteDistribution;
    }
  } else if (game.currentPhase === "NIGHT" || game.currentPhase === "DAY_DISCUSSION") {
    // 各役職のプレイヤーリストを作成
    alivePlayers.forEach((player) => {
      if (!rolePlayerMap.has(player.role || "")) {
        rolePlayerMap.set(player.role || "", []);
      }
      rolePlayerMap.get(player.role || "")?.push(player);
    });

    // 人狼の襲撃処理（夜フェーズのみ）
    if (game.currentPhase === "NIGHT") {
      const werewolves = rolePlayerMap.get("WEREWOLF") || [];
      const nonWerewolves = alivePlayers.filter((p) => p.role !== "WEREWOLF");

      if (werewolves.length > 0 && nonWerewolves.length > 0) {
        // アクションを実行していない人狼だけを対象に
        const nonActingWerewolves = werewolves.filter(
          (wolf) => !actions.attacks.has(wolf.playerId),
        );

        if (nonActingWerewolves.length > 0) {
          // 全員で同じターゲットを選ぶ（連携）
          const targetId = nonWerewolves[Math.floor(Math.random() * nonWerewolves.length)].playerId;

          nonActingWerewolves.forEach((wolf) => {
            actions.attacks.set(wolf.playerId, targetId);
          });

          logger.info("Random coordinated attack assigned", {
            gameId: game.id,
            werewolfCount: nonActingWerewolves.length,
            targetId,
          });
        }
      }

      // 占い師の処理（夜フェーズのみ）
      const seers = rolePlayerMap.get("SEER") || [];
      if (seers.length > 0) {
        seers.forEach((seer) => {
          if (!actions.divines.has(seer.playerId) && seer.isAlive) {
            const possibleTargets = alivePlayers.filter((p) => p.playerId !== seer.playerId);
            if (possibleTargets.length > 0) {
              const target = possibleTargets[Math.floor(Math.random() * possibleTargets.length)];
              actions.divines.set(seer.playerId, target.playerId);
            }
          }
        });
      }

      // 狩人の処理（夜フェーズのみ）
      const bodyguards = rolePlayerMap.get("BODYGUARD") || [];
      if (bodyguards.length > 0) {
        bodyguards.forEach((guard) => {
          if (!actions.guards.has(guard.playerId) && guard.isAlive) {
            const possibleTargets = alivePlayers.filter((p) => p.playerId !== guard.playerId);
            if (possibleTargets.length > 0) {
              const target = possibleTargets[Math.floor(Math.random() * possibleTargets.length)];
              actions.guards.set(guard.playerId, target.playerId);
            }
          }
        });
      }
    }

    // 霊能者の処理（昼または夜）
    const mediums = rolePlayerMap.get("MEDIUM") || [];
    if (mediums.length > 0 && game.currentDay > 1) {
      // 前日に処刑されたプレイヤーを探す
      const executedPlayers = game.players.filter(
        (p) => !p.isAlive && p.deathCause === "EXECUTION" && p.deathDay === game.currentDay - 1
      );

      if (executedPlayers.length > 0) {
        mediums.forEach((medium) => {
          if (!actions.mediums.has(medium.playerId) && medium.isAlive) {
            // 自動的に前日に処刑されたプレイヤーを対象にする
            const target = executedPlayers[0]; // 通常は1人だけ処刑される
            actions.mediums.set(medium.playerId, target.playerId);
            logger.info("Random medium action assigned", {
              gameId: game.id,
              playerId: medium.playerId,
              targetId: target.playerId,
            });
          }
        });
      }
    }

    // キャッシュされた結果をリセット
    if (actions.cachedResults) {
      delete actions.cachedResults.attackDistribution;
    }
  }
}

/**
 * フェーズのアクションを処理
 */
export function processPhaseActions(game: Game): void {
  const actions = actionCache.get(game.id);
  if (!actions) return;

  // アクション未実行のプレイヤーへのランダム割り当て
  assignRandomActions(game);

  // アクション結果をゲーム状態に反映
  if (game.currentPhase === "DAY_VOTE") {
    const voteKey = `vote_${game.currentDay}` as const;
    game[voteKey] = game[voteKey] || new Map<string, string>();
    const votes = game[voteKey];

    // 一度クリアしてからMapを更新
    votes.clear();
    actions.votes.forEach((targetId, playerId) => {
      votes.set(playerId, targetId);
    });
  } else if (game.currentPhase === "NIGHT" || game.currentPhase === "DAY_DISCUSSION") {
    // 夜と昼のアクションをゲーム状態に反映
    const attackKey = `attack_${game.currentDay}` as const;
    const divineKey = `divine_${game.currentDay}` as const;
    const guardKey = `guard_${game.currentDay}` as const;
    const mediumKey = `medium_${game.currentDay}` as const;

    // 必要に応じてMapを初期化
    game[attackKey] = game[attackKey] || new Map<string, string>();
    game[divineKey] = game[divineKey] || new Map<string, string>();
    game[guardKey] = game[guardKey] || new Map<string, string>();
    game[mediumKey] = game[mediumKey] || new Map<string, string>();

    const attacks = game[attackKey];
    const divines = game[divineKey];
    const guards = game[guardKey];
    const mediums = game[mediumKey];

    // 一度クリアしてからMapを更新
    attacks.clear();
    divines.clear();
    guards.clear();
    mediums.clear();

    // 夜フェーズでのみ襲撃、占い、護衛を反映
    if (game.currentPhase === "NIGHT") {
      actions.attacks.forEach((targetId, playerId) => {
        attacks.set(playerId, targetId);
      });
      actions.divines.forEach((targetId, playerId) => {
        divines.set(playerId, targetId);
      });
      actions.guards.forEach((targetId, playerId) => {
        guards.set(playerId, targetId);
      });
    }

    // 霊能結果は昼・夜どちらでも反映
    actions.mediums.forEach((targetId, playerId) => {
      mediums.set(playerId, targetId);
    });
  }
}

/**
 * 最適化された投票分布の取得
 */
export function getVoteDistribution(game: Game): Map<string, number> {
  const actions = actionCache.get(game.id);
  if (!actions) return new Map();

  // キャッシュがあり、最近のものなら使用
  if (
    actions.cachedResults?.voteDistribution &&
    Date.now() - actions.cachedResults.timestamp < 5000
  ) {
    return actions.cachedResults.voteDistribution;
  }

  // 新しく計算
  const distribution = new Map<string, number>();
  actions.votes.forEach((targetId) => {
    distribution.set(targetId, (distribution.get(targetId) || 0) + 1);
  });

  // 結果をキャッシュ
  actions.cachedResults = actions.cachedResults || { timestamp: Date.now() };
  actions.cachedResults.voteDistribution = distribution;
  actions.cachedResults.timestamp = Date.now();

  return distribution;
}

/**
 * 最適化された襲撃分布の取得
 */
export function getAttackDistribution(game: Game): Map<string, number> {
  const actions = actionCache.get(game.id);
  if (!actions) return new Map();

  // キャッシュがあり、最近のものなら使用
  if (
    actions.cachedResults?.attackDistribution &&
    Date.now() - actions.cachedResults.timestamp < 5000
  ) {
    return actions.cachedResults.attackDistribution;
  }

  // 新しく計算
  const distribution = new Map<string, number>();
  actions.attacks.forEach((targetId) => {
    distribution.set(targetId, (distribution.get(targetId) || 0) + 1);
  });

  // 結果をキャッシュ
  actions.cachedResults = actions.cachedResults || { timestamp: Date.now() };
  actions.cachedResults.attackDistribution = distribution;
  actions.cachedResults.timestamp = Date.now();

  return distribution;
}

/**
 * ゲームのアクション状態を取得
 */
export function getGameActions(gameId: string) {
  return actionCache.get(gameId);
}

/**
 * アクションを提出する（テスト互換性のためのラッパー関数）
 */
export async function submitAction(
  game: Game,
  playerId: string,
  targetId: string,
  actionType: "vote" | "attack" | "divine" | "guard" | "medium",
): Promise<ActionResult | DivineResult | MediumResult> {
  logger.info("Action submitted", { gameId: game.id, playerId, targetId, actionType });

  switch (actionType) {
    case "vote":
      return handleVoteAction(game, playerId, targetId);
    case "attack":
      return handleAttackAction(game, playerId, targetId);
    case "divine":
      return handleDivineAction(game, playerId, targetId);
    case "guard":
      return handleGuardAction(game, playerId, targetId);
    case "medium":
      return handleMediumAction(game, playerId, targetId);
    default:
      return { success: false, message: `不明なアクションタイプ: ${actionType}` };
  }
}
