import type { SalesTag } from "./recipes";

// Customers, time slots, regions and shops. All fixed numbers for now; region/season/event
// modifiers can wrap these later.

export type Segment = "general" | "worker" | "wealthy" | "traveler" | "family";
export type Slot = "morning" | "noon" | "evening";

export const SEGMENTS: Record<Segment, { label: string; priceSens: number; qualitySens: number; likes: SalesTag[] }> = {
  general: { label: "一般客", priceSens: 1, qualitySens: 1, likes: ["deli", "soup", "staple"] },
  worker: { label: "労働者", priceSens: 1.3, qualitySens: 0.6, likes: ["staple", "meat", "worker", "deli"] },
  wealthy: { label: "裕福層", priceSens: 0.3, qualitySens: 2, likes: ["luxury", "meat", "snack"] },
  traveler: { label: "旅人", priceSens: 0.8, qualitySens: 1, likes: ["preserved", "light", "bread", "snack"] },
  family: { label: "家族層", priceSens: 1.2, qualitySens: 0.9, likes: ["family", "soup", "healthy"] },
};

export const SLOTS: Record<Slot, { label: string; share: number; likes: SalesTag[] }> = {
  morning: { label: "朝", share: 0.3, likes: ["light", "soup", "preserved", "bread", "healthy"] },
  noon: { label: "昼", share: 0.45, likes: ["deli", "staple", "worker", "family"] },
  evening: { label: "夕", share: 0.25, likes: ["meat", "luxury", "snack"] },
};
export const SLOT_ORDER: Slot[] = ["morning", "noon", "evening"];

export interface Region {
  id: string;
  name: string;
  traffic: number; // potential customers per day
  mix: Record<Segment, number>;
}

export const REGIONS: Record<string, Region> = {
  village: {
    id: "village",
    name: "村",
    traffic: 60,
    mix: { general: 0.35, worker: 0.3, wealthy: 0.05, traveler: 0.12, family: 0.18 },
  },
};

export interface Shop {
  id: string;
  name: string;
  region: string;
  segments: Segment[];
  power: number; // portions per day it can sell of a good dish
  minTotal: number; // 採用最低条件 (dish 総合点)
  baseRate: number; // base share of sales paid to the player
  days: number; // contract length
  priceMult: number; // shop price vs. recommended
}

export const SHOPS: Shop[] = [
  { id: "diner", name: "村の食堂", region: "village", segments: ["worker", "general"], power: 8, minTotal: 40, baseRate: 0.04, days: 7, priceMult: 1 },
  { id: "inn", name: "宿屋「麦の穂」", region: "village", segments: ["traveler", "family"], power: 6, minTotal: 50, baseRate: 0.06, days: 5, priceMult: 1.2 },
  { id: "fine", name: "高級料理店「銀の匙」", region: "village", segments: ["wealthy"], power: 4, minTotal: 65, baseRate: 0.1, days: 14, priceMult: 1.8 },
];
export const SHOP_MAP: Record<string, Shop> = Object.fromEntries(SHOPS.map((s) => [s.id, s]));
