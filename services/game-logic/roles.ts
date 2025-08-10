import { Game, GamePlayer, PlayerRole } from "../../types/game.ts";
import { logger } from "../../utils/logger.ts";

// 役職割り当て
export function assignRoles(game: Game): GamePlayer[] {
  const rolesToAssign: PlayerRole[] = [];

  logger.debug(`役職割り当て開始: 人狼=${game.settings.roles.werewolfCount}人, 占い師=${game.settings.roles.seerCount}人, 狩人=${game.settings.roles.bodyguardCount}人, 霊能者=${game.settings.roles.mediumCount}人`);

  for (let i = 0; i < game.settings.roles.werewolfCount; i++) rolesToAssign.push("WEREWOLF");
  for (let i = 0; i < game.settings.roles.seerCount; i++) rolesToAssign.push("SEER");
  for (let i = 0; i < game.settings.roles.bodyguardCount; i++) rolesToAssign.push("BODYGUARD");
  for (let i = 0; i < game.settings.roles.mediumCount; i++) rolesToAssign.push("MEDIUM");

  const villagersCount = game.players.length - (
    game.settings.roles.werewolfCount +
    game.settings.roles.seerCount +
    game.settings.roles.bodyguardCount +
    game.settings.roles.mediumCount
  );
  for (let i = 0; i < villagersCount; i++) rolesToAssign.push("VILLAGER");

  // Fisher-Yates シャッフル
  for (let i = rolesToAssign.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rolesToAssign[i], rolesToAssign[j]] = [rolesToAssign[j], rolesToAssign[i]];
  }

  const updated = game.players.map((p, idx) => ({
    ...p,
    role: rolesToAssign[idx],
    isAlive: true,
  }));

  // バリデーションと強制修正
  const count = (r: string) => updated.filter(p => p.role === r).length;
  const werewolvesCount = count("WEREWOLF");
  const seersCount = count("SEER");
  const bodyguardsCount = count("BODYGUARD");
  const mediumsCount = count("MEDIUM");
  const villagersCount2 = count("VILLAGER");

  logger.debug(`役職割り当て結果: 人狼=${werewolvesCount}人, 占い師=${seersCount}人, 狩人=${bodyguardsCount}人, 霊能者=${mediumsCount}人, 村人=${villagersCount2}人`);

  const expected = game.settings.roles;
  if (
    werewolvesCount !== expected.werewolfCount ||
    seersCount !== expected.seerCount ||
    bodyguardsCount !== expected.bodyguardCount ||
    mediumsCount !== expected.mediumCount
  ) {
    logger.warn("役職割り当てエラー: 強制的に修正します");
    return forceRoleAssignment(game.players, expected.werewolfCount, expected.seerCount, expected.bodyguardCount, expected.mediumCount);
  }

  return updated;
}

export function forceRoleAssignment(
  players: GamePlayer[],
  werewolfCount: number,
  seerCount: number,
  bodyguardCount: number,
  mediumCount: number
): GamePlayer[] {
  const updated = players.map(p => ({ ...p, role: "VILLAGER" as PlayerRole, isAlive: true }));

  // インデックスのシャッフル
  const idx = Array.from({ length: updated.length }, (_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }

  let cur = 0;
  for (let i = 0; i < werewolfCount && cur < idx.length; i++, cur++) updated[idx[cur]].role = "WEREWOLF";
  for (let i = 0; i < seerCount && cur < idx.length; i++, cur++) updated[idx[cur]].role = "SEER";
  for (let i = 0; i < bodyguardCount && cur < idx.length; i++, cur++) updated[idx[cur]].role = "BODYGUARD";
  for (let i = 0; i < mediumCount && cur < idx.length; i++, cur++) updated[idx[cur]].role = "MEDIUM";

  logger.debug(`強制役職割当: 狼=${werewolfCount}, 占=${seerCount}, 狩=${bodyguardCount}, 霊=${mediumCount}`);
  return updated;
}
