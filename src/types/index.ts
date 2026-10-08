// Shared game types. Pure data shapes only — no logic here.

export type TasteKey = "sweet" | "salty" | "sour" | "bitter" | "umami" | "aroma";
export type Taste = Record<TasteKey, number>; // 0-10

export type TextureTag = "tender" | "chewy" | "crisp" | "soft" | "firm";

/** 物性 */
export interface Physical {
  water: number; // 0-10
  fat: number;
  protein: number;
  hardness: number;
}

/** 栄養 (simplified, normalised 0-10) */
export interface Nutrition {
  energy: number;
  protein: number;
  fat: number;
  carb: number;
  micro: number; // vitamins/minerals, collapsed into one value
}

/** 資源性 */
export interface Resource {
  rarity: number; // 0-10
  price: number; // coins
  ease: number; // ease of production 0-10
  sustainability: number; // 0-10
}

export type IngredientCategory = "animal" | "plant" | "dairy" | "seasoning";
/** Where on the village map an ingredient comes from. */
export type SourceId = "farm" | "hunt" | "market";

export interface Ingredient {
  id: string;
  name: string;
  emoji: string;
  category: IngredientCategory;
  source: SourceId;
  taste: Taste;
  physical: Physical;
  textureTag: TextureTag;
  nutrition: Nutrition;
  resource: Resource;
  /** How familiar the village is with it, 0-10 (feeds 文化性). */
  culture: number;
  /** "pest" = crop-raiding animal, "needs-cook" = unsafe/inedible raw. */
  tags: string[];
}

/** 異世界調理法の三系統 */
export type CookingSystem = "heat" | "time" | "aroma";

export interface CookingMethod {
  id: string;
  name: string; // 焼く
  verb: string; // 焼き (used in dish names)
  systems: CookingSystem[];
  tasteDelta: Partial<Taste>;
  physicalDelta: Partial<Physical>;
  setsTexture?: TextureTag;
  /** Multiplier on vitamins/minerals that survive. */
  microRetention: number;
  /** Makes raw-risk ingredients safe to eat. */
  safe: boolean;
  preserves: boolean;
  traditional: boolean;
  /** Fuel/effort, 0-3. */
  energyCost: number;
  /** Real low-temperature cooking is risky without precise control. */
  needsPrecision?: boolean;
  /** Fit bonus/penalty for the dish state at the moment this method is applied. */
  fit: (p: { taste: Taste; physical: Physical }) => number;
  hint: string;
}

export type SpiceKind = "quality" | "body";

export interface BodyEffects {
  fatigue: number; // 疲労回復
  mana: number; // 魔力回復
  condition: number; // 状態改善
}

export interface Spice {
  id: string;
  name: string;
  emoji: string;
  kind: SpiceKind;
  tasteDelta: Partial<Taste>;
  body: Partial<BodyEffects>;
  crave: number; // extra やみつき
  preserves?: boolean;
  rarity: number;
  price: number;
  description: string;
  unlockAfterQuest?: string;
}

export interface MagicTool {
  id: string;
  name: string;
  emoji: string;
  system: CookingSystem;
  description: string;
  unlockAfterQuest?: string;
}

export type Step =
  | { kind: "method"; id: string }
  | { kind: "spice"; id: string }
  | { kind: "tool"; id: string };

export interface Recipe {
  ingredientIds: string[];
  steps: Step[];
}

/** The cooked dish's computed state (input to evaluation). */
export interface DishProfile {
  taste: Taste;
  physical: Physical;
  textureTag: TextureTag;
  nutrition: Nutrition;
  microRetention: number;
  body: BodyEffects;
  methodFits: number[]; // 0-100 per method step
  methodIds: string[];
  spiceIds: string[];
  toolIds: string[];
  cost: number;
  energyCost: number;
  undercooked: boolean;
  preserved: boolean;
  crave: number;
}

export const AXES = [
  "deliciousness",
  "originality",
  "nutrition",
  "rarity",
  "culture",
  "sustainability",
  "costPerformance",
  "craveability",
] as const;
export type Axis = (typeof AXES)[number];
export type AxisScores = Record<Axis, number>; // 0-100

export type Rank = "D" | "C" | "B" | "A" | "S" | "Legendary";

export interface DishImage {
  kind: "placeholder" | "url";
  emoji: string;
  colors: [string, string];
  url?: string;
}

export interface Dish {
  id: string;
  name: string;
  /** Deterministic recipe seed: same key → same dish data. */
  generationKey: string;
  parentDishId: string | null;
  isPublic: boolean;
  recipe: Recipe;
  profile: DishProfile;
  scores: AxisScores;
  total: number;
  rank: Rank;
  /** 突出ボーナス titles (an axis at 90+). */
  titles: string[];
  /** 最低条件: set when a weak axis held the rank below what the total earned. */
  rankCap: { from: Rank; reason: string } | null;
  description: string;
  image: DishImage;
  createdAt: number;
  /** Reserved for the future cooking guild (online). Always 0 offline. */
  guild: { favorites: number; reproductions: number };
  /** Present for dishes made in the line kitchen (Phase 2). */
  process?: import("./world").DishProcessInfo;
}

export interface Eater {
  id: string;
  name: string;
  emoji: string;
  role: string;
  /** -1 (dislikes) .. +1 (loves) */
  tastePrefs: Partial<Taste>;
  texturePrefs: TextureTag[];
  /** 0 = conservative (文化的慣れ重視), 1 = adventurous */
  adventurous: number;
  hunger: number; // 0-1
  fatigue: number; // 0-1
  nutritionNeed: number; // 0-1 (栄養状態が悪いほど高い)
}

export interface QuestCondition {
  axis: Axis;
  weight: number;
  min?: number;
}

export interface Quest {
  id: string;
  title: string;
  client: string;
  eaterId: string;
  request: string;
  conditions: QuestCondition[];
  passScore: number;
  minExperience: number;
  requirement?: {
    label: string;
    test: (recipe: Recipe) => boolean;
  };
  successText: string;
  failText: string;
}

export interface QuestResult {
  questId: string;
  dishId: string;
  success: boolean;
  questScore: number;
  experience: number;
  requirementMet: boolean;
  checks: { axis: Axis; value: number; min?: number; ok: boolean }[];
  reasons: string[];
}

/** Placeholder for the future time / season / weather simulation. */
export interface WorldClock {
  day: number;
  season: "spring" | "summer" | "autumn" | "winter";
  weather: "sunny" | "cloudy" | "rain" | "snow";
}

export type ScreenId = "village" | "chef" | "kitchen" | "sales" | "quests" | "dex";
