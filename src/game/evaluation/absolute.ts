import { METHOD_MAP } from "../../data/methods";
import { SPICE_MAP } from "../../data/magic";
import type { AxisScores, DishProfile, Ingredient } from "../../types";
import { AXES } from "../../types";
import { clamp } from "../util";
import { deliciousness } from "./deliciousness";

// 料理の絶対評価 (8軸). Pure formulas over the cooked profile and its ingredients.
// It never depends on who eats the dish — that is experience.ts.
// Future AI adjustments (独創性/文化性/物語性) should be applied on top of this output.

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export function originality(p: DishProfile, ings: Ingredient[]): number {
  const methods = new Set(p.methodIds).size;
  const magic = p.spiceIds.length + p.toolIds.length;
  const categories = new Set(ings.map((i) => i.category)).size;
  const t = p.taste;
  let v = 10 + 9 * methods + 10 * Math.min(magic, 4) + 7 * (categories - 1) + 3 * ings.length;
  if (t.sweet >= 5 && t.umami >= 5) v += 12; // sweet-savoury
  if (t.sour >= 4 && p.physical.fat >= 4) v += 8; // acid against fat
  // A dish built from the most familiar staples reads as ordinary.
  v -= 2 * Math.max(0, avg(ings.map((i) => i.culture)) - 7) * 3;
  return clamp(v, 0, 100);
}

export function nutrition(p: DishProfile, ings: Ingredient[]): number {
  const { protein, fat, carb, micro, energy } = p.nutrition;
  const macro = protein + fat + carb || 1;
  const dev =
    Math.abs(protein / macro - 0.3) + Math.abs(fat / macro - 0.25) + Math.abs(carb / macro - 0.45);
  const balance = 100 - 110 * dev;
  const microScore = micro * 11;
  const energyScore = 100 - 18 * (energy < 4 ? 4 - energy : energy > 7 ? energy - 7 : 0);
  const diversity = Math.min(100, 30 * new Set(ings.map((i) => i.category)).size + 5 * ings.length);
  const bodyBonus = 2 * p.body.condition + p.body.fatigue;
  return clamp(
    0.4 * balance + 0.3 * microScore + 0.15 * energyScore + 0.15 * diversity + bodyBonus - (p.undercooked ? 30 : 0),
    0,
    100,
  );
}

export function rarity(p: DishProfile, ings: Ingredient[]): number {
  const r = ings.map((i) => i.resource.rarity);
  const spiceR = p.spiceIds.map((id) => SPICE_MAP[id]?.rarity ?? 0);
  return clamp((0.6 * Math.max(0, ...r) + 0.4 * avg(r)) * 10 + 3 * Math.max(0, ...spiceR), 0, 100);
}

export function culture(p: DishProfile, ings: Ingredient[]): number {
  const familiar = avg(ings.map((i) => i.culture)) * 10;
  const traditional = p.methodIds.filter((id) => METHOD_MAP[id]?.traditional).length;
  const magic = p.spiceIds.length + p.toolIds.length;
  return clamp(0.65 * familiar + 9 * Math.min(traditional, 3) + (p.preserved ? 6 : 0) - 3 * magic, 0, 100);
}

export function sustainability(p: DishProfile, ings: Ingredient[]): number {
  const base = avg(ings.map((i) => i.resource.sustainability)) * 10;
  const pests = ings.filter((i) => i.tags.includes("pest")).length;
  return clamp(
    0.6 * base + 12 * Math.min(pests, 2) + (p.preserved ? 12 : 0) + 15 - 4 * p.energyCost - 2 * p.spiceIds.length,
    0,
    100,
  );
}

export function costPerformance(p: DishProfile, deli: number, nutri: number): number {
  const value = 0.6 * deli + 0.4 * nutri;
  return clamp(value * (1.2 - p.cost / 45), 0, 100);
}

export function craveability(p: DishProfile, deli: number): number {
  const t = p.taste;
  let v = 3.5 * p.physical.fat + 3 * t.umami + 2 * t.sweet + 2 * t.aroma + (12 - 3 * Math.abs(t.salty - 5));
  if (p.textureTag === "crisp") v += 12;
  if (p.methodIds.includes("fry")) v += 10;
  if (p.methodIds.includes("grill")) v += 5;
  v += p.crave;
  // Nobody craves something that is not good to begin with.
  return clamp(v * (0.5 + deli / 200), 0, 100);
}

export function evaluateDish(p: DishProfile, ings: Ingredient[]): AxisScores {
  const deli = deliciousness(p, ings.length);
  const nutri = nutrition(p, ings);
  const scores: AxisScores = {
    deliciousness: deli,
    originality: originality(p, ings),
    nutrition: nutri,
    rarity: rarity(p, ings),
    culture: culture(p, ings),
    sustainability: sustainability(p, ings),
    costPerformance: costPerformance(p, deli, nutri),
    craveability: craveability(p, deli),
  };
  for (const a of AXES) scores[a] = Math.round(scores[a]);
  return scores;
}
