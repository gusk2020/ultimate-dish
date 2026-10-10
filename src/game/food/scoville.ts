import { SPICE_MAP } from "../../data/magic";
import type { RecipeDef } from "../../data/recipes";

// スコビル値 (Phase 11): heat in Scoville Heat Units. A dish is as hot as its hottest pepper,
// a little hotter for each extra hot ingredient.

export function itemSHU(id: string): number {
  return SPICE_MAP[id]?.scovilleSHU ?? 0;
}

export function scovilleOf(ids: string[]): number {
  const hot = [...new Set(ids)].map(itemSHU).filter((v) => v > 0).sort((a, b) => b - a);
  if (!hot.length) return 0;
  return Math.round(hot[0] * (1 + 0.2 * (hot.length - 1)));
}

/** A cooked dish: its ingredients plus every spice added along the way. */
export function dishSHU(dish: { recipe: { ingredientIds: string[]; steps?: { kind: string; id?: string }[] }; profile?: { spiceIds?: string[] } }): number {
  const spices = [...(dish.profile?.spiceIds ?? []), ...((dish.recipe.steps ?? []).filter((s) => s.kind === "spice").map((s) => s.id ?? ""))];
  return scovilleOf([...dish.recipe.ingredientIds, ...spices]);
}

export function recipeSHU(r: Pick<RecipeDef, "ingredients" | "seasonings">): number {
  return scovilleOf([...r.ingredients, ...r.seasonings].map((l) => l.itemId));
}

export function shuLabel(shu: number): string {
  if (shu <= 0) return "辛くない";
  return `🌶 ${shu.toLocaleString("ja-JP")} SHU`;
}
