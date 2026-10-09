import { INGREDIENT_MAP } from "../../data/ingredients";
import type { Dish, TextureTag } from "../../types";
import type { BaseTaste, EaterCondition, EaterProfile, StageScore, TastingResult, TastingStage } from "../../types/eating";
import { TASTING_STAGES } from "../../types/eating";
import { tasteBalance, textureScore } from "../evaluation/deliciousness";
import { BASE_TASTES } from "./profile";

// 食べる: how one eater experiences one dish. Separate from the dish's absolute 8-axis
// evaluation (which never changes) — this layers preference, familiarity and condition on top.

export type TastableDish = Pick<Dish, "id" | "name" | "scores" | "profile" | "recipe" | "total"> & { process?: Dish["process"] };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const strength = (v: number) => (v - 4) / 6; // dish taste 0..10 → -0.67..1

const TASTE_JA: Record<BaseTaste, string> = { sweet: "甘味", salty: "塩気", sour: "酸味", bitter: "苦味", umami: "うま味" };
const TEXTURE_JA: Record<TextureTag, string> = { tender: "柔らかさ", chewy: "噛みごたえ", crisp: "歯ざわり", soft: "ふんわり感", firm: "しっかりした食感" };

export function preferenceMatch(dish: TastableDish, eater: EaterProfile) {
  const t = dish.profile.taste;
  let taste = 0;
  const likes: string[] = [];
  const dislikes: string[] = [];
  for (const k of BASE_TASTES) {
    const w = eater.taste[k];
    if (w === undefined) continue;
    const st = strength(t[k]);
    const d = w * st;
    taste += d;
    // Labels only for tastes that are actually present: "not bitter" is not "likes bitterness".
    if (st > 0 && d >= 0.15) likes.push(TASTE_JA[k]);
    if (st > 0 && d <= -0.15) dislikes.push(TASTE_JA[k]);
  }
  const aroma = eater.aroma * strength(t.aroma);
  if (strength(t.aroma) > 0 && aroma >= 0.15) likes.push("香り");
  if (strength(t.aroma) > 0 && aroma <= -0.15) dislikes.push("香りの強さ");
  const texture = eater.texture[dish.profile.textureTag] ?? 0;
  if (texture >= 0.2) likes.push(TEXTURE_JA[dish.profile.textureTag]);
  if (texture <= -0.2) dislikes.push(TEXTURE_JA[dish.profile.textureTag]);
  const compat = clamp(0.6 * clamp(taste, -1, 1) + 0.2 * aroma + 0.2 * texture, -1, 1);
  return { taste: clamp(taste, -1, 1), aroma, texture, compat, likes, dislikes };
}

/** 0..1: how familiar the dish's ingredients and style are to this eater. */
export function familiarityOf(dish: TastableDish, eater: EaterProfile): number {
  const ids = dish.recipe.ingredientIds;
  if (!ids.length) return 0.3;
  const cat = ids.reduce((a, id) => a + (eater.culture.familiar[INGREDIENT_MAP[id]?.category ?? ""] ?? 0.3), 0) / ids.length;
  const hist = ids.reduce((a, id) => a + Math.min(1, (eater.history[id] ?? 0) / 5), 0) / ids.length;
  const school = dish.process ? eater.culture.schools[dish.process.schoolId] ?? 0 : 0;
  return clamp(0.6 * cat + 0.2 * hist + 0.2 * school, 0, 1);
}

export function tasteDish(dish: TastableDish, eater: EaterProfile, condition: EaterCondition = eater.condition): TastingResult {
  const s = dish.scores;
  const p = dish.profile;
  const pref = preferenceMatch(dish, eater);
  const familiarity = familiarityOf(dish, eater);
  const novelty = (eater.culture.adventurous - 0.5) * ((s.originality - 50) / 50);

  // Condition: hunger makes food better, tiredness rewards restorative food, poor nutrition rewards nourishing food.
  const hungerMult = 0.85 + 0.3 * condition.hunger;
  const restore = condition.fatigue * (p.body.fatigue * 1.5 + p.nutrition.energy) * 0.6;
  const nourish = (1 - condition.nutrition) * (s.nutrition - 55) * 0.25;
  const conditionEffect = Math.round((s.deliciousness * 0.55 * (hungerMult - 1) + restore + nourish) * 10) / 10;

  let score =
    10 + s.deliciousness * 0.55 * hungerMult + dish.total * 0.15 + 20 * pref.compat +
    8 * (familiarity - 0.4) + 8 * novelty + restore + nourish;
  if (p.undercooked) score -= 25;
  score = clamp(Math.round(score), 0, 100);

  const finish = dish.process?.finish;
  const raw: Record<TastingStage, number> = {
    look: 40 + dish.total * 0.4 + (finish?.plating ? 8 : 0) + (finish?.vessel ? 5 : 0),
    aroma: 30 + p.taste.aroma * 6 + pref.aroma * 20,
    firstBite: s.deliciousness * 0.6 + pref.taste * 25 + 20 * hungerMult - 10,
    texture: textureScore(p) * 0.6 + pref.texture * 25 + 15,
    spread: tasteBalance(p) * 0.6 + p.taste.umami * 3 + 10,
    aftertaste: 62 - Math.max(0, p.taste.bitter - 3) * 8 + pref.aroma * 10 + (pref.dislikes.length ? -8 : 0),
    satisfaction: score,
  };
  const stages: StageScore[] = TASTING_STAGES.map((stage) => {
    const v = clamp(Math.round(raw[stage]), 0, 100);
    return { stage, score: v, tone: v >= 65 ? "good" : v < 45 ? "bad" : "neutral" };
  });

  return {
    eaterId: eater.id, score, compatibility: Math.round(pref.compat * 100) / 100, familiarity: Math.round(familiarity * 100) / 100,
    conditionEffect, stages, likes: pref.likes, dislikes: pref.dislikes,
  };
}

// ---------- 食経験による嗜好更新 ----------

/** How strongly one meal can move a preference. Small on purpose: tastes drift, they don't flip. */
export const LEARNING_RATE = 0.04;

/** -1..1 liking from the player's answer blended with the computed experience. */
export function blendLiking(answerLiking: number, score: number): number {
  return clamp(0.5 * answerLiking + 0.5 * ((score - 55) / 40), -1, 1);
}

/**
 * After a meal: the dish's prominent tastes / texture move a little toward (liked) or away
 * (disliked), and its ingredients become more familiar. Future: 苦手克服 can hook in here.
 */
export function learnFromMeal(eater: EaterProfile, dish: TastableDish, liking: number): EaterProfile {
  const r = LEARNING_RATE * liking;
  const t = dish.profile.taste;
  const taste = { ...eater.taste };
  for (const k of BASE_TASTES) {
    const st = strength(t[k]);
    if (st > 0.2) taste[k] = clamp((taste[k] ?? 0) + r * st, -1, 1);
  }
  const tag = dish.profile.textureTag;
  const texture = { ...eater.texture, [tag]: clamp((eater.texture[tag] ?? 0) + r, -1, 1) };
  const aroma = strength(t.aroma) > 0.2 ? clamp(eater.aroma + r * strength(t.aroma), -1, 1) : eater.aroma;
  const history = { ...eater.history };
  const familiar = { ...eater.culture.familiar };
  for (const id of dish.recipe.ingredientIds) {
    history[id] = (history[id] ?? 0) + 1;
    const cat = INGREDIENT_MAP[id]?.category;
    if (cat) familiar[cat] = clamp((familiar[cat] ?? 0.3) + 0.01, 0, 1);
  }
  const schools = { ...eater.culture.schools };
  if (dish.process) schools[dish.process.schoolId] = clamp((schools[dish.process.schoolId] ?? 0) + 0.01, 0, 1);
  const condition = {
    ...eater.condition,
    hunger: clamp(eater.condition.hunger - 0.5, 0, 1),
    nutrition: clamp(eater.condition.nutrition + (dish.scores.nutrition - 50) / 200, 0, 1),
  };
  return { ...eater, taste, texture, aroma, history, culture: { ...eater.culture, familiar, schools }, condition };
}
