import type { Dish, Eater, TasteKey } from "../../types";
import { finishExperienceBonus } from "../finish/finish";
import { clamp } from "../util";

// 食べ手の体験評価. Reads the dish's absolute scores and profile; never changes them.

export interface Experience {
  score: number;
  comments: string[];
}

const TASTE_LABEL: Record<TasteKey, string> = {
  sweet: "甘さ", salty: "塩気", sour: "酸味", bitter: "苦味", umami: "うま味", aroma: "香り",
};

export function experienceOf(dish: Pick<Dish, "scores" | "profile" | "process">, eater: Eater): Experience {
  const { scores, profile: p } = dish;
  const comments: string[] = [];

  // Hunger makes everything taste better.
  let v = scores.deliciousness * (0.6 + 0.2 * eater.hunger);

  // Taste preferences: liked tastes that are strong please, disliked ones annoy.
  let pref = 0;
  for (const [k, w] of Object.entries(eater.tastePrefs) as [TasteKey, number][]) {
    const strength = (p.taste[k] - 4) / 6; // -0.67 .. +1
    const delta = 9 * w * strength;
    pref += delta;
    if (delta >= 4) comments.push(`${TASTE_LABEL[k]}がうれしい`);
    if (delta <= -4) comments.push(`${TASTE_LABEL[k]}が気になる`);
  }
  v += pref;

  if (eater.texturePrefs.includes(p.textureTag)) {
    v += 6;
    comments.push("食感が好み");
  } else v -= 3;

  // Body state: tired people value restorative food, malnourished people value nutrition.
  const restore = eater.fatigue * (p.body.fatigue * 2 + p.nutrition.energy);
  v += restore * 0.5;
  if (eater.fatigue >= 0.5 && p.body.fatigue >= 4) comments.push("疲れが取れる");
  v += eater.nutritionNeed * (scores.nutrition - 55) * 0.35;
  if (eater.nutritionNeed >= 0.6 && scores.nutrition >= 65) comments.push("体に良さそう");

  // Cultural familiarity: conservative eaters distrust novelty, adventurous ones seek it.
  v += (eater.adventurous - 0.5) * (scores.originality - 50) * 0.3;
  v += (1 - eater.adventurous) * (scores.culture - 50) * 0.2;
  if (eater.adventurous < 0.4 && scores.originality >= 70) comments.push("見慣れなくて少し不安");
  if (eater.adventurous >= 0.5 && scores.originality >= 65) comments.push("新しい驚きがある");

  // 仕上げとの相性 (Phase 2 dishes only).
  const finish = finishExperienceBonus(dish.process?.finish, eater);
  v += finish;
  if (finish >= 3) comments.push("盛り付けが好み");

  if (p.undercooked) {
    v -= 25;
    comments.push("生焼けでは…");
  }

  return { score: Math.round(clamp(v, 0, 100)), comments };
}
