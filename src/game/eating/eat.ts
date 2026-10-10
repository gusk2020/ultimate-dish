import type { TastingRecord, TastingResult } from "../../types/eating";
import type { Rank } from "../../types";
import { codexKeyOf, setOwnReport } from "../codex/codex";
import { gainEaterXp, isEater, recordEaten, reportFee, type EatGain } from "../eater/progression";
import { addSkillXp } from "../eater/skills";
import { maxStamina } from "../chef/stats";
import { eatPortion } from "../commerce/simpleCook";
import type { World } from "../world";
import { buildPlayerProfile, type FoodStoryAnswers } from "./profile";
import { blendLiking, learnFromMeal, tasteDish, type TastableDish } from "./tasting";

// The player eating their own food: portion → stamina (Phase 3), tasting (Phase 4),
// then a short report that becomes a record and nudges the palate.

export function setFoodStory(w: World, story: FoodStoryAnswers): World {
  return { ...w, palate: buildPlayerProfile(w.chef.name, story) };
}

/** The player's condition right now: fatigue follows stamina, hunger/nutrition live on the palate. */
export function playerCondition(w: World) {
  const p = w.palate!;
  return { ...p.condition, fatigue: Math.max(0, Math.min(1, 1 - w.chef.stamina / maxStamina(w.chef))) };
}

export function eatAndTaste(
  w: World,
  stockId: string,
  dish: TastableDish & { recipeId?: string | null; rank?: Rank },
): { world: World; result: TastingResult; gain: EatGain } | string {
  if (!w.palate) return "先に食遍歴を作ろう";
  const result = tasteDish(dish, w.palate, playerCondition(w));
  const ate = eatPortion(w, stockId);
  if (typeof ate === "string") return ate;
  // Phase 9: eating grows the eater and records the dish in 私の図鑑 — never its recipe.
  const stock = w.dishStock.find((s) => s.id === stockId);
  const eaten = recordEaten(ate, { ...dish, recipeId: dish.recipeId ?? stock?.recipeId ?? null }, stock?.cookedBy && stock.cookedBy[0] !== "player" ? "仲間の料理" : "自分の料理");
  // A real meal fills you up too (日常の空腹もリセット).
  const world = eaten.world.daily ? { ...eaten.world, daily: { ...eaten.world.daily, hunger: 0 } } : eaten.world;
  return { world, result, gain: eaten.gain };
}

let recordCounter = 0;

export function recordTasting(
  w: World,
  dish: TastableDish,
  result: TastingResult,
  answers: Record<string, string>,
  answerLiking: number,
  freeText: string,
): { world: World; record: TastingRecord } {
  const liking = blendLiking(answerLiking, result.score);
  recordCounter += 1;
  const record: TastingRecord = {
    id: `taste-${Date.now().toString(36)}-${recordCounter}`,
    day: Math.floor(w.day) + 1,
    dishId: dish.id,
    dishName: dish.name,
    score: result.score,
    answers,
    freeText: freeText.trim().slice(0, 200),
    liking: Math.round(liking * 100) / 100,
  };
  let world: World = { ...w, palate: w.palate ? learnFromMeal(w.palate, dish, liking) : w.palate, tastingLog: [record, ...w.tastingLog] };
  // Phase 9: the report becomes the codex entry's own report; an eater is paid a small writing fee.
  const key = codexKeyOf({ name: dish.name, recipeId: (dish as { recipeId?: string | null }).recipeId ?? null });
  world = setOwnReport(world, key, result.score, record.freeText || `${Math.round(result.score)}点の一皿`);
  world = gainEaterXp(world, isEater(w) ? 3 : 0, 0, reportFee(w));
  if (isEater(w)) world = { ...world, progression: addSkillXp(world.progression, { report: 4 }) };
  return { world, record };
}
