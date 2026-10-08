// Phase 2 world model: the chef, inventory, magic tools, schools and the line-based process.
// Pure data shapes only.
import type { Axis, AxisScores } from "./index";

// ---------- Chef ----------

export const STAT_KEYS = ["tech", "knowledge", "luck", "magic", "strength"] as const;
export type StatKey = (typeof STAT_KEYS)[number];
export type Stats = Record<StatKey, number>; // integers, 1..9999

export type SkillId = "fire" | "ferment" | "magitool" | "knife" | "seasoning" | "preciseFire" | "multiTool";

/** Internal growth records. Only `xp` is shown as "経験値"; the rest is detail. */
export interface ChefRecords {
  skillXp: Partial<Record<SkillId, number>>;
  schoolMastery: Record<string, number>;
  techniqueCounts: Record<string, number>; // method id → uses
  genreCounts: Record<string, number>; // ingredient category → dishes
  achievements: string[];
  dishesCooked: number;
}

export interface Chef {
  name: string;
  level: number;
  xp: number; // xp inside the current level
  stats: Stats;
  /** Allocation is editable until confirmed (re-allocation later is a future, costlier feature). */
  allocationLocked: boolean;
  mp: number;
  money: number;
  activeSchoolId: string;
  learnedSchoolIds: string[];
  records: ChefRecords;
}

// ---------- Schools (流派) ----------

export type FusionDirection = "preserve" | "aroma" | "cost" | "magic";

export interface School {
  id: string;
  name: string;
  region: string; // 地域・文化
  philosophy: string; // 思想
  specialty: string; // 得意技法
  /** Success-rate bonus per method id. */
  methodSuccess: Record<string, number>;
  /** Same method, different behaviour: axis deltas applied each time the method is used. */
  methodVariant: Record<string, { label: string; axes: Partial<AxisScores> }>;
  /** Flat axis deltas for every dish cooked under this school. */
  axisBonus: Partial<AxisScores>;
  skillXpMult: Partial<Record<SkillId, number>>;
  parents?: [string, string];
  direction?: FusionDirection;
}

// ---------- Inventory ----------

export type StackState = "fresh" | "stale" | "spoiled" | "aging" | "aged" | "preserved";
export type ProcessingState = "raw" | "salted" | "dried";

export interface Storage {
  id: string;
  name: string;
  capacity: number; // total quantity units
  decayRate: number; // multiplier on the item's base decay
  upkeepPerDay: number;
  /** Item categories that keep especially well here (decay ×0.5). */
  affinity: string[];
  /** Items with these tags age instead of going stale here. */
  agesTags: string[];
}

export interface InventoryStack {
  id: string;
  itemId: string;
  acquiredDay: number;
  quality: number; // 0..1 at acquisition
  source: string; // 入手場所
  storageId: string;
  quantity: number;
  price: number; // per unit
  freshness: number; // 0..1, falls with time
  bestBeforeDay: number;
  useByDay: number;
  processing: ProcessingState;
  state: StackState;
}

// ---------- Magic tools ----------

export interface ToolState {
  toolId: string;
  durability: number;
  maxDurability: number;
}

// ---------- Process (line-based cooking) ----------

/** A line is one intermediate product; its index is the target of a step. */
export type ProcessStep =
  | { kind: "add"; line: number; itemId: string; amount: number }
  | { kind: "method"; line: number; methodId: string }
  | { kind: "tool"; line: number; toolId: string }
  | { kind: "recover"; line: number; recoverId: string }
  | { kind: "merge"; line: number; from: number }
  | { kind: "finish"; line: number };

export type StepGrade = "criticalFail" | "fail" | "success" | "great" | "miracle";

export interface StepOutcome {
  index: number;
  grade: StepGrade;
  chance: number; // success probability used
  timeDays: number;
  mpCost: number;
  failure?: string; // 焦げ, 香り飛び, ...
  note?: string;
}

export interface SourceShare {
  label: string; // ingredient name or intermediate name
  ratio: number; // 0..1 share of the merged amount
}

export interface Intermediate {
  line: number;
  name: string;
  amount: number;
  temperature: number; // °C, rough
  moisture: number; // 0..10
  state: "raw" | "prepped" | "cooked" | "aged" | "merged" | "plated";
  quality: number; // 0..1+
  ingredients: Record<string, number>; // item id → amount
  history: SourceShare[];
  openFailures: string[];
  clockDays: number; // when this line is ready (parallel time)
  mergedInto?: number;
}

export interface ProcessResult {
  errors: string[];
  outcomes: StepOutcome[];
  lines: Intermediate[];
  totalDays: number;
  mpCost: number;
  capacityUsed: number;
  stepCount: number; // steps that count against 工程上限 (everything except add)
  toolsUsed: string[];
  /** Quality delta to deliciousness etc. from step results, before finishing. */
  qualityScore: number; // 0..1
  schoolNotes: string[];
  schoolAxes: Partial<AxisScores>;
  /** Unmerged lines that hold something: a finished dish needs exactly one. */
  openLines: number[];
}

// ---------- Finishing (仕上げ) ----------

export interface FinishInput {
  mode: "free" | "qa";
  plating: string;
  vessel: string;
  aroma: string;
  temperature: "" | "hot" | "warm" | "cold";
  howToEat: string;
  freeText: string;
}

export interface FinishReview {
  corrections: string[]; // light contradictions, auto-fixed
  warnings: string[]; // serious contradictions
  axes: Partial<Record<Axis, number>>;
  normalized: FinishInput;
}

/** What a dish cooked in the line kitchen remembers about its making. */
export interface DishProcessInfo {
  steps: ProcessStep[];
  cookingSeed: number;
  outcomes: StepOutcome[];
  finalLine: Intermediate;
  totalDays: number;
  schoolId: string;
  schoolName: string;
  chefLevel: number;
  finish: FinishInput;
  finishReview: FinishReview;
}
