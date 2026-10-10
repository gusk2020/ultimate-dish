import type { PlayerProgression } from "../../types/codex";
import { RANK_ORDER, rankOf } from "../evaluation/rating";
import { codexKeyOf, progressionOf, recordEatenEntry, type CodexDish } from "../codex/codex";
import { locationOf } from "../travel/market";
import type { World } from "../world";

// 食べる側 (フードファイター) growth. Maker growth stays chef.level / chef.xp.
// Eating grows the eater: new dishes, high ranks, unknown ingredients and methods count most;
// eating the same dish again gives less each time (lightly diminishing).

export const eaterLevelFor = (xp: number) => 1 + Math.floor(Math.sqrt(Math.max(0, xp) / 20));
export const eaterXpForLevel = (level: number) => 20 * (level - 1) ** 2;

export function gainEaterXp(w: World, xp: number, reputation = 0, money = 0): World {
  const p = progressionOf(w);
  const eaterXp = p.eaterXp + Math.max(0, Math.round(xp));
  return {
    ...w,
    chef: money ? { ...w.chef, money: Math.round((w.chef.money + money) * 100) / 100 } : w.chef,
    progression: { ...p, eaterXp, eaterLevel: eaterLevelFor(eaterXp), reputation: Math.max(0, p.reputation + reputation) },
  };
}

/** Experience of ingredients / methods / regions met at the table (also grows on a lost judging). */
export function addExperience(p: PlayerProgression, dish: Pick<CodexDish, "recipe" | "profile">, region?: string): PlayerProgression {
  const ex = { ingredients: { ...p.experience.ingredients }, methods: { ...p.experience.methods }, regions: { ...p.experience.regions } };
  for (const id of dish.recipe.ingredientIds) ex.ingredients[id] = (ex.ingredients[id] ?? 0) + 1;
  for (const id of dish.profile.methodIds) ex.methods[id] = (ex.methods[id] ?? 0) + 1;
  if (region) ex.regions[region] = (ex.regions[region] ?? 0) + 1;
  return { ...p, experience: ex };
}

export interface EatGain {
  xp: number;
  reasons: string[];
  codexNew: boolean;
  codexKey: string;
}

/** XP for eating one dish, before it is recorded. */
export function eatXp(w: World, dish: CodexDish): { xp: number; reasons: string[] } {
  const p = progressionOf(w);
  const key = codexKeyOf(dish);
  const times = p.eatenCounts[key] ?? 0;
  const reasons: string[] = [];
  let xp = 4;
  if (times === 0) { xp += 10; reasons.push("初めて食べる料理"); }
  const rank = RANK_ORDER.indexOf(dish.rank ?? rankOf(dish.total));
  if (rank >= RANK_ORDER.indexOf("B")) { xp += (rank - 1) * 3; reasons.push(`${RANK_ORDER[rank]}ランクの一皿`); }
  const newIng = dish.recipe.ingredientIds.filter((id) => !p.experience.ingredients[id]).length;
  const newMeth = dish.profile.methodIds.filter((id) => !p.experience.methods[id]).length;
  if (newIng) { xp += 3 * newIng; reasons.push(`未知の食材${newIng}種`); }
  if (newMeth) { xp += 3 * newMeth; reasons.push(`未知の調理法${newMeth}種`); }
  // Lightly diminishing: ×1, ×0.67, ×0.5, … never below a quarter.
  const factor = Math.max(0.25, 1 / (1 + 0.5 * times));
  if (times > 0) reasons.push(`${times + 1}回目（経験値は少しずつ減る）`);
  return { xp: Math.max(1, Math.round(xp * factor)), reasons };
}

/** Eating a dish: eater xp, table experience, and a codex entry. No recipe knowledge is granted. */
export function recordEaten(w: World, dish: CodexDish, origin?: string): { world: World; gain: EatGain } {
  const { xp, reasons } = eatXp(w, dish);
  const key = codexKeyOf(dish);
  const region = locationOf(w).id;
  const p = addExperience(progressionOf(w), dish, region);
  const counted = { ...p, eatenCounts: { ...p.eatenCounts, [key]: (p.eatenCounts[key] ?? 0) + 1 } };
  const withP = gainEaterXp({ ...w, progression: counted }, xp);
  const rec = recordEatenEntry(withP, dish, origin ?? `${locationOf(w).shortName}で食べた`);
  return { world: rec.world, gain: { xp, reasons, codexNew: rec.isNew, codexKey: key } };
}

/** 食レポ執筆料: a written report pays the eater a little and grows them. */
export function reportFee(w: World): number {
  if (w.identity?.lean !== "eater") return 0;
  return 2 + progressionOf(w).eaterLevel;
}

export function roleLevelLabel(w: World): string {
  return w.identity?.lean === "eater" ? `フードファイターLv${progressionOf(w).eaterLevel}` : `料理人Lv${w.chef.level}`;
}
