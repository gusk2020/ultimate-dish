import type { Axis, BodyEffects, Rank } from "../types";

export const AXIS_LABEL: Record<Axis, string> = {
  deliciousness: "美味しさ",
  originality: "独創性",
  nutrition: "栄養",
  rarity: "希少性",
  culture: "文化性",
  sustainability: "持続性",
  costPerformance: "コスパ",
  craveability: "やみつき",
};

export const BODY_LABEL: Record<keyof BodyEffects, string> = {
  fatigue: "疲労回復",
  mana: "魔力回復",
  condition: "状態改善",
};

export const RANK_STYLE: Record<Rank, string> = {
  D: "bg-stone-300 text-stone-800",
  C: "bg-emerald-200 text-emerald-900",
  B: "bg-sky-200 text-sky-900",
  A: "bg-violet-200 text-violet-900",
  S: "bg-amber-300 text-amber-950",
  Legendary: "bg-gradient-to-r from-rose-400 via-amber-300 to-violet-400 text-stone-900",
};
