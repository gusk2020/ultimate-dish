import type { InventoryStack, Storage } from "../types/world";
import { INGREDIENT_MAP } from "./ingredients";
import { SPICE_MAP } from "./magic";

// Everything that can sit in the inventory: ingredients and the two spices.

export interface ItemInfo {
  id: string;
  name: string;
  emoji: string;
  kind: "ingredient" | "spice";
  category: string; // ingredient category or "spice"
  /** 組み合わせ容量: normal 1.0, seasoning 0.5, light spice/herb 0.2 per unit. */
  capacityWeight: number;
  shelfLifeDays: number; // at room temperature, fresh
  price: number;
  tags: string[];
}

const SHELF: Record<string, number> = {
  boar: 3, rabbit: 3, chicken: 2, fish: 2, offal: 1.5, egg: 14, saltfish: 120,
  wheat: 180, beans: 180, onion: 30, cabbage: 10, turnip: 14, garlic: 60, mushroom: 4,
  apple: 30, herb: 4, honey: 365, nuts: 90, milk: 3, butter: 14, cheese: 60,
  salt: 9999, vinegar: 365,
};
const LIGHT = new Set(["herb", "garlic"]);
const HALF = new Set(["honey", "butter", "salt", "vinegar"]);

export function itemInfo(id: string): ItemInfo | null {
  const ing = INGREDIENT_MAP[id];
  if (ing) {
    return {
      id, name: ing.name, emoji: ing.emoji, kind: "ingredient", category: ing.category,
      capacityWeight: LIGHT.has(id) ? 0.2 : HALF.has(id) || ing.category === "seasoning" ? 0.5 : 1,
      shelfLifeDays: SHELF[id] ?? 7, price: ing.resource.price, tags: ing.tags,
    };
  }
  const sp = SPICE_MAP[id];
  if (sp) {
    return {
      id, name: sp.name, emoji: sp.emoji, kind: "spice", category: "spice",
      capacityWeight: 0.2, shelfLifeDays: 365, price: sp.price, tags: [],
    };
  }
  return null;
}

export const STORAGES: Storage[] = [
  { id: "shelf", name: "常温棚", capacity: 40, decayRate: 1, upkeepPerDay: 0, affinity: ["plant", "seasoning", "spice"], agesTags: [] },
  { id: "cellar", name: "地下貯蔵庫", capacity: 25, decayRate: 0.5, upkeepPerDay: 1, affinity: ["plant", "dairy"], agesTags: ["meat"] },
  { id: "icehouse", name: "氷室", capacity: 12, decayRate: 0.15, upkeepPerDay: 3, affinity: ["animal", "dairy"], agesTags: [] },
];
export const STORAGE_MAP: Record<string, Storage> = Object.fromEntries(STORAGES.map((s) => [s.id, s]));

/** Starting stock: a few days of village staples. */
const START: [string, number, string, string][] = [
  ["rabbit", 2, "icehouse", "猟場"], ["boar", 1, "icehouse", "猟場"], ["boar", 1, "cellar", "猟場"], ["chicken", 1, "icehouse", "農地"],
  ["onion", 4, "shelf", "農地"], ["cabbage", 2, "cellar", "農地"], ["wheat", 4, "shelf", "農地"],
  ["beans", 3, "shelf", "農地"], ["garlic", 3, "shelf", "農地"], ["herb", 3, "shelf", "猟場"],
  ["mushroom", 2, "cellar", "猟場"], ["apple", 3, "cellar", "農地"], ["honey", 2, "shelf", "市場"],
  ["salt", 5, "shelf", "市場"], ["vinegar", 2, "shelf", "市場"], ["milk", 1, "icehouse", "農地"], ["milk", 1, "shelf", "農地"],
  ["butter", 1, "icehouse", "市場"], ["egg", 4, "cellar", "農地"], ["homura", 3, "shelf", "市場"],
  ["iyashi", 2, "shelf", "市場"],
];

export function newStack(itemId: string, quantity: number, storageId: string, source: string, day: number, n: number): InventoryStack {
  const info = itemInfo(itemId)!;
  return {
    id: `stk-${itemId}-${n}`,
    itemId, acquiredDay: day, quality: 0.8, source, storageId, quantity,
    price: info.price, freshness: 1,
    bestBeforeDay: day + info.shelfLifeDays * 0.6,
    useByDay: day + info.shelfLifeDays,
    processing: "raw", state: "fresh",
  };
}

export function initialInventory(day = 0): InventoryStack[] {
  return START.map(([id, q, st, src], i) => newStack(id, q, st, src, day, i));
}
