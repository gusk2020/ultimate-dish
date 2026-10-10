import type { Rival } from "../types/eating";

// 調理済みの料理 (Phase 10): the inn's dining room and the market's ready-made food, per place.

export type MealVendor = "inn" | "market";

export interface MealOffer {
  id: string;
  recipeId: string;
  vendor: MealVendor;
  vendorName: string;
  locationId: string;
  price: number;
  /** Portions a takeaway sale gives (the dining room always serves one). */
  portions: number;
  freshness: number;
  /** Parts of the day it is on offer (0 午前, 1 午後, 2 夜). */
  parts: (0 | 1 | 2)[];
  tags: string[];
}

const ALL: (0 | 1 | 2)[] = [0, 1, 2];
const DAY: (0 | 1 | 2)[] = [0, 1];

export const MEAL_OFFERS: MealOffer[] = [
  // 村
  { id: "v-inn-stew", recipeId: "rabbit-stew", vendor: "inn", vendorName: "村の宿屋", locationId: "village", price: 6, portions: 1, freshness: 1, parts: ALL, tags: ["deli", "family"] },
  { id: "v-inn-soup", recipeId: "bean-wheat-soup", vendor: "inn", vendorName: "村の宿屋", locationId: "village", price: 4, portions: 1, freshness: 1, parts: ALL, tags: ["soup"] },
  { id: "v-mk-soup", recipeId: "bean-wheat-soup", vendor: "market", vendorName: "村の市場の総菜屋", locationId: "village", price: 3, portions: 2, freshness: 0.9, parts: DAY, tags: ["soup"] },
  { id: "v-mk-pickle", recipeId: "hanna-pickled-cabbage", vendor: "market", vendorName: "村の市場の総菜屋", locationId: "village", price: 3, portions: 2, freshness: 1, parts: DAY, tags: ["preserved"] },
  // 川沿いの市場町
  { id: "r-inn-fish", recipeId: "river-grilled-fish", vendor: "inn", vendorName: "渡し場の食堂", locationId: "rivertown", price: 5, portions: 1, freshness: 1, parts: ALL, tags: ["meat"] },
  { id: "r-inn-noodle", recipeId: "river-travelers-noodles", vendor: "inn", vendorName: "渡し場の食堂", locationId: "rivertown", price: 5, portions: 1, freshness: 1, parts: ALL, tags: ["staple"] },
  { id: "r-mk-fish", recipeId: "river-grilled-fish", vendor: "market", vendorName: "市場の焼き魚屋", locationId: "rivertown", price: 4, portions: 2, freshness: 0.9, parts: DAY, tags: ["meat"] },
  { id: "r-mk-vinegar", recipeId: "river-vinegar-fish", vendor: "market", vendorName: "市場の焼き魚屋", locationId: "rivertown", price: 4, portions: 2, freshness: 1, parts: DAY, tags: ["preserved"] },
  // 港町
  { id: "h-inn-stew", recipeId: "coast-seafood-stew", vendor: "inn", vendorName: "港の酒場", locationId: "harbor", price: 8, portions: 1, freshness: 1, parts: ALL, tags: ["soup"] },
  { id: "h-inn-shells", recipeId: "coast-spiced-shells", vendor: "inn", vendorName: "港の酒場", locationId: "harbor", price: 7, portions: 1, freshness: 1, parts: ALL, tags: ["snack"] },
  { id: "h-mk-dried", recipeId: "coast-dried-fish", vendor: "market", vendorName: "干物屋", locationId: "harbor", price: 4, portions: 3, freshness: 1, parts: DAY, tags: ["preserved"] },
  // 山岳
  { id: "m-inn-porridge", recipeId: "highland-cheese-porridge", vendor: "inn", vendorName: "山小屋の食堂", locationId: "highland", price: 6, portions: 1, freshness: 1, parts: ALL, tags: ["healthy"] },
  { id: "m-inn-ibex", recipeId: "highland-smoked-ibex", vendor: "inn", vendorName: "山小屋の食堂", locationId: "highland", price: 9, portions: 1, freshness: 1, parts: ALL, tags: ["meat"] },
  { id: "m-mk-ibex", recipeId: "highland-smoked-ibex", vendor: "market", vendorName: "燻製小屋", locationId: "highland", price: 7, portions: 2, freshness: 1, parts: DAY, tags: ["preserved"] },
  { id: "m-mk-greens", recipeId: "highland-greens-nuts", vendor: "market", vendorName: "燻製小屋", locationId: "highland", price: 5, portions: 2, freshness: 0.9, parts: DAY, tags: ["light"] },
];

export const MEAL_OFFER_MAP: Record<string, MealOffer> = Object.fromEntries(MEAL_OFFERS.map((o) => [o.id, o]));

/** The cooks behind the counters: competent, not masters. */
export const VENDOR_COOK: Rival = {
  id: "vendor", name: "店の料理人", emoji: "👩‍🍳", blurb: "", stats: { tech: 11, knowledge: 10, luck: 6, magic: 6, strength: 11 },
  schoolId: "village", skills: { fire: 120, knife: 80, ferment: 80 }, preferredRecipes: [], pantryQuality: 0.75,
};
