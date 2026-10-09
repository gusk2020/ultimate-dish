import type { TastingRecord, TastingResult } from "../../types/eating";
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

export function eatAndTaste(w: World, stockId: string, dish: TastableDish): { world: World; result: TastingResult } | string {
  if (!w.palate) return "先に食遍歴を作ろう";
  const result = tasteDish(dish, w.palate, playerCondition(w));
  const ate = eatPortion(w, stockId);
  if (typeof ate === "string") return ate;
  return { world: ate, result };
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
  return {
    world: { ...w, palate: w.palate ? learnFromMeal(w.palate, dish, liking) : w.palate, tastingLog: [record, ...w.tastingLog] },
    record,
  };
}
