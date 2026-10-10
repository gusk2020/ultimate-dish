import { MEAL_OFFER_MAP, MEAL_OFFERS, VENDOR_COOK, type MealOffer } from "../../data/meals";
import type { DishStock } from "../../types/world";
import { cookRivalDish } from "../battle/battle";
import type { DishCore } from "../cooking/buildDish";
import { seedFrom } from "../rng";
import { partOf } from "../time/calendar";
import { locationOf } from "../travel/market";
import type { World } from "../world";

// 外食・総菜 (Phase 10): ready-made food bought where you are. The dish is really cooked (by the
// vendor, once per day per offer), so eating it is a real tasting with real ingredients and methods.

export function offersHere(w: World, vendor?: MealOffer["vendor"]): MealOffer[] {
  const here = locationOf(w).id;
  return MEAL_OFFERS.filter((o) => o.locationId === here && (!vendor || o.vendor === vendor));
}

export function isOpen(w: World, o: MealOffer): boolean {
  return o.parts.includes(partOf(w.day).part);
}

/** Offers anywhere for a recipe (the notebook uses this to say where a dish can be found). */
export function offersFor(recipeId: string): MealOffer[] {
  return MEAL_OFFERS.filter((o) => o.recipeId === recipeId);
}

/** Today's dish from this counter (same all day). */
export function offerDish(w: World, o: MealOffer): DishCore {
  return cookRivalDish(VENDOR_COOK, o.recipeId, seedFrom("meal", o.id, partOf(w.day).dayIndex)).dish;
}

let counter = 0;

function stockFor(w: World, o: MealOffer, dish: DishCore, portions: number): DishStock {
  counter += 1;
  return {
    id: `bought-${o.id}-${Date.now().toString(36)}-${counter}`,
    dishId: dish.id, recipeId: o.recipeId, name: dish.name, tags: o.tags, portions, total: dish.total, nutrition: dish.scores.nutrition,
    unitCost: o.price, madeDay: w.day, freshness: o.freshness, price: 0, listed: false, discounted: false, cookedBy: ["vendor"], bought: true,
  };
}

function check(w: World, offerId: string, n: number): MealOffer | string {
  const o = MEAL_OFFER_MAP[offerId];
  if (!o) return "そんな料理はない";
  if (o.locationId !== locationOf(w).id) return "この土地では入手できない";
  if (!isOpen(w, o)) return "今の時間帯は売っていない";
  if (w.chef.money < o.price * n) return "お金が足りない";
  return o;
}

/** 食堂で食べる: one portion served at the table. The UI then eats it (実食). */
export function dineOut(w: World, offerId: string): { world: World; dish: DishCore; stock: DishStock } | string {
  const o = check(w, offerId, 1);
  if (typeof o === "string") return o;
  if (o.vendor !== "inn") return "ここは持ち帰りの店";
  const dish = offerDish(w, o);
  const stock = stockFor(w, o, dish, 1);
  return { world: { ...w, chef: { ...w.chef, money: w.chef.money - o.price }, dishStock: [...w.dishStock, stock] }, dish, stock };
}

/** 総菜を買う: takeaway portions go into your stock (not resellable). */
export function buyTakeaway(w: World, offerId: string, sets = 1): { world: World; dish: DishCore; stock: DishStock } | string {
  const o = check(w, offerId, sets);
  if (typeof o === "string") return o;
  if (o.vendor !== "market") return "ここは食堂";
  const dish = offerDish(w, o);
  const stock = stockFor(w, o, dish, o.portions * sets);
  return { world: { ...w, chef: { ...w.chef, money: w.chef.money - o.price * sets }, dishStock: [...w.dishStock, stock] }, dish, stock };
}
