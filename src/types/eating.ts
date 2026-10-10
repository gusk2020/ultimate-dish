// Phase 4: eaters, tasting and cooking battles. Pure data shapes only.
import type { Axis, TextureTag } from "./index";

export type BaseTaste = "sweet" | "salty" | "sour" | "bitter" | "umami";

/**
 * One shape for every eater: the player, fixed NPCs, battle judges and (later) companions,
 * customers and rivals. Values are internal (-1 dislikes … +1 loves; conditions 0..1).
 */
export interface EaterProfile {
  id: string;
  name: string;
  emoji: string;
  role: string;
  taste: Partial<Record<BaseTaste, number>>;
  aroma: number; // likes strong aroma (+) or prefers it mild (−)
  texture: Partial<Record<TextureTag, number>>;
  culture: {
    /** Familiarity with ingredient categories (animal / plant / dairy / seasoning), 0..1. */
    familiar: Partial<Record<string, number>>;
    /** Familiarity with each cooking school's style, 0..1. */
    schools: Partial<Record<string, number>>;
    adventurous: number; // 0 conservative … 1 seeks novelty
  };
  condition: EaterCondition;
  /** Food history: how often each ingredient has been eaten (grows familiarity). */
  history: Record<string, number>;
  /** Short line shown in the UI. Everything else stays internal. */
  profileText: string;
  /** The player's 食遍歴 memories, reusable in tasting reports and future dialogue. */
  memories?: string[];
}

export interface EaterCondition {
  hunger: number; // 0 full … 1 starving
  fatigue: number; // 0 rested … 1 exhausted
  nutrition: number; // 0 malnourished … 1 well fed
}

// ---------- Tasting ----------

export type TastingStage = "look" | "aroma" | "firstBite" | "texture" | "spread" | "aftertaste" | "satisfaction";
export const TASTING_STAGES: TastingStage[] = ["look", "aroma", "firstBite", "texture", "spread", "aftertaste", "satisfaction"];

export interface StageScore {
  stage: TastingStage;
  score: number; // 0..100
  tone: "good" | "neutral" | "bad";
}

/** Internal result of one eater eating one dish. Also the input a future AI writer gets. */
export interface TastingResult {
  eaterId: string;
  score: number; // 0..100 experience
  compatibility: number; // -1..1 preference match
  familiarity: number; // 0..1
  conditionEffect: number; // points from hunger / fatigue / nutrition
  stages: StageScore[];
  likes: string[];
  dislikes: string[];
}

/** The player's own tasting report, kept as a record. */
export interface TastingRecord {
  id: string;
  day: number;
  dishId: string;
  dishName: string;
  score: number;
  /** Q&A answers by question id. */
  answers: Record<string, string>;
  freeText: string;
  /** -1..1 how much the player liked it (answers blended with the computed score). */
  liking: number;
}

// ---------- Battles ----------

export interface BattleTheme {
  label: string;
  /** Axes the theme cares about, as weights. */
  axes: Partial<Record<Axis, number>>;
  /** Sales tags that fit the theme. */
  tags: string[];
}

export interface BattleConditions {
  theme: BattleTheme;
  requiredIngredient?: string;
  forbiddenIngredient?: string;
  timeLimitDays?: number;
  /** Who is being cooked for, e.g. "tired harvest workers". Adjusts judges' condition. */
  target?: { label: string; condition: Partial<EaterCondition> };
}

export type RewardKind = "xp" | "money" | "ingredient" | "recipe" | "skill" | "school" | "contract";
export interface Reward {
  kind: RewardKind;
  amount?: number;
  id?: string;
}

/** Reserved for future special battles (recipe theft / seal …). Normal battles carry none. */
export interface SpecialRule {
  id: string;
  label: string;
}

export interface Rival {
  id: string;
  name: string;
  emoji: string;
  blurb: string;
  stats: { tech: number; knowledge: number; luck: number; magic: number; strength: number };
  schoolId: string;
  skills: Partial<Record<string, number>>; // skill xp
  preferredRecipes: string[];
  /** Quality of the rival's ingredients (0..1): beginners shop worse. */
  pantryQuality: number;
  /** Phase 10: appears once this rival has been faced OPPONENT_LIMIT times (rotation). */
  unlockAfter?: string;
}

export interface BattleDef {
  id: string;
  name: string;
  kind: "tutorial" | "rematch" | "formal";
  rivalId: string;
  judgeIds: string[];
  conditions: BattleConditions;
  rewards: Reward[];
  specialRules: SpecialRule[];
  /** Battle ids that must have been fought first. */
  requires: string[];
  intro: string;
  /** Phase 10: where the battle is held (absent = the home village). */
  locationId?: string;
}

export interface JudgeVerdict {
  judgeId: string;
  player: number; // 0..100
  rival: number;
  playerTasting: TastingResult;
  rivalTasting: TastingResult;
  playerTheme: number;
  rivalTheme: number;
  comment: string;
}

export interface BattleResult {
  battleId: string;
  seed: number;
  rivalDishName: string;
  rivalRecipeId: string;
  rivalOutcome: string; // e.g. "火入れ：失敗"
  verdicts: JudgeVerdict[];
  playerTotal: number;
  rivalTotal: number;
  winner: "player" | "rival" | "draw";
  reasons: string[];
  rewards: Reward[];
}

export interface BattleRecord {
  battleId: string;
  day: number;
  winner: BattleResult["winner"];
  playerTotal: number;
  rivalTotal: number;
}
