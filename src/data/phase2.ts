import type { School, SkillId, ToolState } from "../types/world";

// ---------- 魔導具: fixed, readable effects ("kitchen appliances", not loot) ----------

export interface ToolRule {
  toolId: string;
  maxDurability: number;
  /** Human-readable rule shown in the UI. */
  effect: string;
  mpRule: string;
}

export const TOOL_RULES: Record<string, ToolRule> = {
  stone: { toolId: "stone", maxDurability: 30, effect: "次の加熱工程：時間×0.6、成功率+12%（最低75%保証）", mpRule: "加熱1回ごとにMP2" },
  jar: { toolId: "jar", maxDurability: 20, effect: "次の熟成・発酵・乾燥・燻製：時間×0.1", mpRule: "短縮1日ごとにMP1" },
  pot: { toolId: "pot", maxDurability: 25, effect: "次の工程：香りが飛ばない（香り飛び失敗なし）", mpRule: "使用1回ごとにMP2" },
};

export function initialTools(): ToolState[] {
  return Object.values(TOOL_RULES).map((r) => ({ toolId: r.toolId, durability: r.maxDurability, maxDurability: r.maxDurability }));
}

// ---------- 工程の基準時間 (日) ----------

export const METHOD_BASE_DAYS: Record<string, number> = {
  cut: 0.007, saute: 0.01, grill: 0.02, boil: 0.04, steam: 0.03, fry: 0.015, reduce: 0.02,
  smoke: 0.25, pickle: 1, dry: 2, ferment: 3, sousvide: 0.12, pressure: 0.03,
};
export const ADD_DAYS = 0.002;
export const MERGE_DAYS = 0.005;
export const FINISH_DAYS = 0.01;

/** Base difficulty: base success before abilities (0..1). */
export const METHOD_BASE_SUCCESS: Record<string, number> = {
  cut: 0.92, saute: 0.88, grill: 0.85, boil: 0.9, steam: 0.9, fry: 0.78, reduce: 0.82,
  smoke: 0.8, pickle: 0.85, dry: 0.86, ferment: 0.75, sousvide: 0.7, pressure: 0.8,
};

/** Failure flavour per method. */
export const METHOD_FAILURE: Record<string, string> = {
  cut: "切り方失敗", saute: "焦げ", grill: "焦げ", boil: "火入れ失敗", steam: "火入れ失敗", fry: "焦げ",
  reduce: "焦げ", smoke: "香り飛び", pickle: "漬かりムラ", dry: "乾燥ムラ", ferment: "発酵失敗",
  sousvide: "火入れ失敗", pressure: "火入れ失敗",
};

// ---------- 挽回工程 ----------

export interface Recovery {
  id: string;
  name: string;
  fixes: string[]; // failure kinds it can repair
  days: number;
  baseSuccess: number;
  needsItem?: { itemId: string; amount: number };
  skill: SkillId;
}

export const RECOVERIES: Recovery[] = [
  { id: "reheat", name: "再加熱", fixes: ["火入れ失敗", "発酵失敗"], days: 0.02, baseSuccess: 0.75, skill: "fire" },
  { id: "rechop", name: "刻み直す", fixes: ["切り方失敗", "乾燥ムラ", "漬かりムラ"], days: 0.01, baseSuccess: 0.85, skill: "knife" },
  { id: "rearoma", name: "香りを足す", fixes: ["香り飛び", "焦げ"], days: 0.005, baseSuccess: 0.8, needsItem: { itemId: "herb", amount: 0.5 }, skill: "seasoning" },
  { id: "reemulsify", name: "再乳化", fixes: ["分離", "魔導具工程失敗"], days: 0.01, baseSuccess: 0.7, needsItem: { itemId: "butter", amount: 0.5 }, skill: "seasoning" },
];
export const RECOVERY_MAP: Record<string, Recovery> = Object.fromEntries(RECOVERIES.map((r) => [r.id, r]));

// ---------- スキル ----------

export interface SkillDef {
  id: SkillId;
  name: string;
  /** Methods whose success this skill improves. */
  methods: string[];
  /** Derived skills: unlocked when `requires` reaches level. */
  requires?: { skill: SkillId; level: number };
  effect: string;
}

const HEAT = ["grill", "boil", "steam", "fry", "saute", "reduce", "smoke", "sousvide", "pressure"];
export const SKILLS: SkillDef[] = [
  { id: "fire", name: "火入れ", methods: HEAT, effect: "加熱工程の成功率アップ" },
  { id: "ferment", name: "発酵", methods: ["ferment", "pickle", "dry", "smoke"], effect: "時間系工程の成功率アップ" },
  { id: "knife", name: "包丁", methods: ["cut"], effect: "切る工程の成功率アップ" },
  { id: "seasoning", name: "味付け", methods: [], effect: "合流・挽回の成功率アップ" },
  { id: "magitool", name: "魔具操作", methods: [], effect: "魔導具工程の失敗を減らす" },
  { id: "preciseFire", name: "精密火入れ", methods: HEAT, requires: { skill: "fire", level: 5 }, effect: "加熱成功率+8%" },
  { id: "multiTool", name: "複数魔具制御", methods: [], requires: { skill: "magitool", level: 5 }, effect: "魔導具の同時使用+1" },
];
export const SKILL_MAP = Object.fromEntries(SKILLS.map((s) => [s.id, s])) as Record<SkillId, SkillDef>;

export function skillForMethod(methodId: string): SkillId {
  if (methodId === "cut") return "knife";
  if (["ferment", "pickle", "dry"].includes(methodId)) return "ferment";
  return "fire";
}

// ---------- 流派 ----------

export const SCHOOLS: School[] = [
  {
    id: "village", name: "村の家庭料理", region: "麦畑の村", philosophy: "倹約主義", specialty: "煮込み",
    methodSuccess: { boil: 0.08, pressure: 0.05, cut: 0.03 },
    methodVariant: { boil: { label: "家庭流煮込み：原価重視", axes: { costPerformance: 3, culture: 2 } } },
    axisBonus: { costPerformance: 3 },
    skillXpMult: { knife: 1.3 },
  },
  {
    id: "north", name: "北方猟師料理", region: "北の森", philosophy: "豪快主義", specialty: "燻製",
    methodSuccess: { smoke: 0.12, grill: 0.05, dry: 0.06 },
    methodVariant: { smoke: { label: "北方流燻製：保存性重視", axes: { sustainability: 6, culture: 2 } } },
    axisBonus: { sustainability: 3 },
    skillXpMult: { ferment: 1.3, fire: 1.1 },
  },
  {
    id: "court", name: "宮廷料理", region: "王都", philosophy: "洗練主義", specialty: "香りの演出",
    methodSuccess: { saute: 0.06, reduce: 0.08, sousvide: 0.08 },
    methodVariant: { smoke: { label: "宮廷流燻製：香り重視", axes: { craveability: 5, originality: 3 } }, reduce: { label: "宮廷流ソース", axes: { deliciousness: 2 } } },
    axisBonus: { originality: 3, costPerformance: -3 },
    skillXpMult: { seasoning: 1.3, magitool: 1.2 },
  },
];

export const FUSION_DIRECTIONS = {
  preserve: { label: "保存重視", axes: { sustainability: 4 } },
  aroma: { label: "香り重視", axes: { craveability: 4 } },
  cost: { label: "原価重視", axes: { costPerformance: 4 } },
  magic: { label: "魔導具重視", axes: { originality: 4 } },
} as const;

/** 流派合成の条件: both parents at this mastery. */
export const FUSION_MASTERY = 3;
