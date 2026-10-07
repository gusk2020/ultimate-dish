import type { DishProfile } from "../../types";
import { clamp } from "../util";

// 美味しさ = 味バランス + 香り + 食感 + 調理工程との適合.
// Each part is its own function so a real pairing model can replace one later.

export function tasteBalance(p: DishProfile): number {
  const t = p.taste;
  const salty = 100 - 16 * Math.abs(t.salty - 5);
  const umami = Math.min(100, 25 + t.umami * 10);
  const sweet = 70 + 6 * Math.min(t.sweet, 4) - 15 * Math.max(0, t.sweet - 7);
  const sour = 70 + 8 * Math.min(t.sour, 3) - 12 * Math.max(0, t.sour - 5);
  const bitter = 100 - 14 * Math.max(0, t.bitter - 2.5);
  // Harmony: two or three clearly present tastes beat one, or five at once.
  const present = [t.sweet, t.salty, t.sour, t.umami].filter((v) => v >= 3).length;
  const harmony = present === 2 || present === 3 ? 8 : present === 4 ? 0 : -8;
  return clamp(0.25 * salty + 0.3 * umami + 0.15 * sweet + 0.1 * sour + 0.2 * bitter + harmony, 0, 100);
}

export function aromaScore(p: DishProfile): number {
  return clamp(20 + p.taste.aroma * 9, 0, 100);
}

export function textureScore(p: DishProfile): number {
  const { hardness, water, fat } = p.physical;
  const dist = (v: number, lo: number, hi: number) => (v < lo ? lo - v : v > hi ? v - hi : 0);
  const h = 100 - 18 * dist(hardness, 2.5, 6);
  const w = 100 - 15 * dist(water, 3, 7.5);
  const f = 100 - 12 * dist(fat, 1.5, 6.5);
  return clamp((h + w + f) / 3, 0, 100);
}

export function methodFitScore(p: DishProfile): number {
  if (!p.methodFits.length) return 30;
  return p.methodFits.reduce((a, b) => a + b, 0) / p.methodFits.length;
}

/** Depth: a plate built from several elements and stages tastes more layered. */
export function depthScore(p: DishProfile, ingredientCount: number): number {
  return clamp(
    15 + 12 * Math.min(ingredientCount, 4) + 12 * Math.min(new Set(p.methodIds).size, 3) + 8 * Math.min(p.spiceIds.length, 2),
    0,
    100,
  );
}

export function deliciousness(p: DishProfile, ingredientCount: number): number {
  let v =
    0.3 * tasteBalance(p) +
    0.15 * aromaScore(p) +
    0.15 * textureScore(p) +
    0.2 * methodFitScore(p) +
    0.2 * depthScore(p, ingredientCount);
  v *= 0.92;
  v -= 5 * Math.max(0, ingredientCount - 5); // too many things muddle the plate
  if (p.undercooked) v *= 0.45; // raw meat / raw grain
  return clamp(v, 0, 100);
}
