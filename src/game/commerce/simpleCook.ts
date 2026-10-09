import { itemInfo } from "../../data/items";
import { METHOD_MAP } from "../../data/methods";
import type { RecipeDef } from "../../data/recipes";
import type { LearningEvent } from "../../types/learning";
import { canCook, getRecipe, masteryEffects, recordCook } from "../learning/recipeBook";
import { RECOVERIES } from "../../data/phase2";
import type { Dish } from "../../types";
import type { DishStock, FinishInput, FinishReview, InventoryStack, ProcessResult, ProcessStep, ToolState } from "../../types/world";
import { eff, maxStamina, staminaPenalty } from "../chef/stats";
import { availableAmount, consume } from "../inventory/inventory";
import { simulateProcess } from "../process/simulate";
import { buildProcessDish } from "../process/buildProcessDish";
import { findSchool } from "../school/school";
import type { DishCore } from "../cooking/buildDish";
import { advanceTime, applyGrowth, buy, type CookingGains, type World } from "../world";
import { createRng, seedFrom } from "../rng";

// レシピ調理: the everyday kitchen. The player picks a recipe and a portion count; the
// Phase 2 process engine judges a short internal step template behind the scenes.

export type BatchKind = "time" | "stamina" | "magic";

/**
 * まとめて作る効率: grows sub-linearly with portions, and less efficiently the harder the dish.
 * Easy (difficulty 1): 2 → 1.6, 5 → 3.0, 10 → 4.8.  Hard (5): 10 → 8.3.
 */
export function batchScale(portions: number, difficulty: number, kind: BatchKind = "time"): number {
  const n = Math.max(1, portions);
  const base = { time: 0.62, stamina: 0.66, magic: 0.5 }[kind];
  const per = { time: 0.06, stamina: 0.06, magic: 0.08 }[kind];
  return Math.pow(n, Math.min(1, base + per * difficulty));
}

const TOOL_MP: Record<string, number> = { stone: 2, pot: 2, jar: 1 };

export interface PlanLine {
  itemId: string;
  need: number;
  have: number;
  short: number;
  unitPrice: number;
}

export interface CookPlan {
  recipe: RecipeDef;
  portions: number;
  toolId: string | null;
  lines: PlanLine[];
  shortCost: number;
  unitCost: number;
  timeDays: number;
  stamina: number;
  mp: number;
  chanceModifier: number;
  tired: boolean;
  /** Rough "how many more portions today" from current stamina. */
  maxPortionsByStamina: number;
  problems: string[];
}

const round2 = (v: number) => Math.round(v * 100) / 100;

export function planCook(w: World, recipeId: string, portions: number, toolId: string | null): CookPlan {
  const recipe = getRecipe(w, recipeId)!;
  // レシピ熟練度: small, bounded help with success, time and stamina.
  const mastery = masteryEffects(w.recipeBook[recipeId]?.mastery ?? 0);
  const chef = w.chef;
  const n = Math.max(1, Math.floor(portions));
  const lines: PlanLine[] = [...recipe.ingredients, ...recipe.seasonings].map((l) => {
    const need = round2(l.amount * n);
    const have = availableAmount(w.inventory, l.itemId);
    return { itemId: l.itemId, need, have, short: round2(Math.max(0, need - have)), unitPrice: itemInfo(l.itemId)?.price ?? 0 };
  });
  const shortCost = Math.ceil(lines.reduce((a, l) => a + Math.ceil(l.short) * l.unitPrice, 0));
  const unitCost = round2(lines.reduce((a, l) => a + l.need * l.unitPrice, 0) / n);

  const pen = staminaPenalty(chef);
  const toolTime = toolId === "stone" ? 0.7 : toolId === "jar" ? 0.5 : 1;
  const timeDays = recipe.baseTimeDays * batchScale(n, recipe.difficulty, "time") * pen.timeMult * (1 - 0.3 * eff(chef.stats.tech)) * toolTime * mastery.timeMult;
  const stamina = Math.round(recipe.baseStamina * batchScale(n, recipe.difficulty, "stamina") * (1 - 0.2 * eff(chef.stats.strength)) * mastery.staminaMult);
  const mp = Math.ceil((recipe.baseMagic + (toolId ? TOOL_MP[toolId] ?? 0 : 0)) * batchScale(n, recipe.difficulty, "magic"));
  // Big batches of hard dishes are harder to keep consistent, and working past the end of
  // your stamina (overdraw) makes it worse still — possible, never blocked, rarely wise.
  const overdraw = Math.max(0, stamina - chef.stamina) / maxStamina(chef);
  const chanceModifier = pen.chance - 0.012 * recipe.difficulty * Math.log2(n) - Math.min(0.4, 0.3 * overdraw) + mastery.chance;

  let maxPortionsByStamina = 0;
  for (let k = 1; k <= 99; k++) {
    if (recipe.baseStamina * batchScale(k, recipe.difficulty, "stamina") * (1 - 0.2 * eff(chef.stats.strength)) > chef.stamina) break;
    maxPortionsByStamina = k;
  }

  const problems: string[] = [];
  if (!canCook(w, recipeId)) problems.push("まだ試作の条件を満たしていない");
  if (lines.some((l) => l.short > 0)) problems.push("食材が足りない");
  if (mp > chef.mp) problems.push(`MPが足りない（必要${mp}）`);
  const tool = toolId ? w.tools.find((t) => t.toolId === toolId) : null;
  if (toolId && (!tool || tool.durability <= 0)) problems.push("魔導具の耐久切れ");
  return {
    recipe, portions: n, toolId, lines, shortCost, unitCost, timeDays: round2(timeDays * 1000) / 1000, stamina, mp,
    chanceModifier, tired: pen.tired, maxPortionsByStamina, problems,
  };
}

/** 不足素材を一括購入: buys whole units of what is missing, into the default storage. */
export function buyShortage(w: World, plan: CookPlan): World | string {
  if (plan.shortCost > w.chef.money) return `お金が足りない（必要${plan.shortCost}G）`;
  let world = w;
  for (const l of plan.lines) {
    if (l.short <= 0) continue;
    const cat = itemInfo(l.itemId)?.category;
    const order = cat === "animal" || cat === "dairy" ? ["icehouse", "cellar", "shelf"] : ["shelf", "cellar"];
    let r: World | string = "保管場所がいっぱい";
    for (const storage of order) {
      r = buy(world, l.itemId, Math.ceil(l.short), storage);
      if (typeof r !== "string") break;
    }
    if (typeof r === "string") return r;
    world = r;
  }
  return world;
}

export interface CookSession {
  recipeId: string;
  portions: number;
  toolId: string | null;
  steps: ProcessStep[];
  seed: number;
  chanceModifier: number;
  inventoryAtStart: InventoryStack[];
  toolsAtStart: ToolState[];
  lack: number;
  /** Label per step index for judged steps (others are hidden). */
  labels: Record<number, string>;
  result: ProcessResult;
  unitCost: number;
  recoveries: number;
}

const HEAT = (id: string) => METHOD_MAP[id]?.systems.includes("heat") ?? false;
const TIMED = (id: string) => METHOD_MAP[id]?.systems.includes("time") ?? false;

/** The recipe's internal template as Phase 2 process steps (one portion). */
export function templateSteps(recipe: RecipeDef, toolId: string | null): { steps: ProcessStep[]; labels: Record<number, string> } {
  const steps: ProcessStep[] = [];
  const labels: Record<number, string> = {};
  for (const l of recipe.ingredients) steps.push({ kind: "add", line: 0, itemId: l.itemId, amount: l.amount });
  const toolAt = toolId
    ? recipe.steps.findIndex((s) => (toolId === "stone" ? HEAT(s.methodId) : toolId === "jar" ? TIMED(s.methodId) : true))
    : -1;
  recipe.steps.forEach((s, i) => {
    if (i === toolAt && toolId) {
      labels[steps.length] = "魔導具";
      steps.push({ kind: "tool", line: 0, toolId });
    }
    labels[steps.length] = s.label;
    steps.push({ kind: "method", line: 0, methodId: s.methodId });
    if (i === 0) for (const l of recipe.seasonings) steps.push({ kind: "add", line: 0, itemId: l.itemId, amount: l.amount });
  });
  labels[steps.length] = "仕上げ";
  steps.push({ kind: "finish", line: 0 });
  return { steps, labels };
}

/** Everything a judgement depends on, frozen at 調理開始 so a later recovery re-judges identically. */
interface JudgeInput {
  steps: ProcessStep[];
  seed: number;
  chanceModifier: number;
  inventory: InventoryStack[];
  tools: ToolState[];
  lack: number; // 0..1 tiredness at the start
}

function judge(w: World, j: JudgeInput): ProcessResult {
  const school = findSchool(w.chef.activeSchoolId, w.customSchools);
  const result = simulateProcess(j.steps, {
    chef: w.chef, school, inventory: j.inventory, tools: j.tools, seed: j.seed, chanceModifier: j.chanceModifier,
  });
  // Low stamina: some plain failures become critical ones (seeded per step index).
  const lack = j.lack;
  if (lack > 0) {
    result.outcomes = result.outcomes.map((o) =>
      o.grade === "fail" && createRng(seedFrom(j.seed, "tired", o.index))() < 0.5 * lack ? { ...o, grade: "criticalFail" } : o,
    );
  }
  return result;
}

/** 調理開始: pays materials, stamina, MP, tool wear and time, then judges the template. */
export function startCook(w: World, plan: CookPlan, seed: number): { world: World; session: CookSession } | string {
  if (plan.problems.length) return plan.problems.join("、");
  let inventory = w.inventory;
  for (const l of plan.lines) {
    const next = consume(inventory, l.itemId, l.need);
    if (!next) return `${itemInfo(l.itemId)?.name}が足りない`;
    inventory = next;
  }
  const { steps, labels } = templateSteps(plan.recipe, plan.toolId);
  const lack = Math.max(0, -staminaPenalty(w.chef).chance / 0.18);
  const result = judge(w, { steps, seed, chanceModifier: plan.chanceModifier, inventory: w.inventory, tools: w.tools, lack });
  const tools = plan.toolId ? w.tools.map((t) => (t.toolId === plan.toolId ? { ...t, durability: t.durability - 1 } : t)) : w.tools;
  const chef = { ...w.chef, mp: w.chef.mp - plan.mp, stamina: Math.max(0, w.chef.stamina - plan.stamina) };
  const world = advanceTime(
    { ...w, inventory, tools, chef, ledger: { ...w.ledger, materialCost: w.ledger.materialCost + plan.unitCost * plan.portions } },
    plan.timeDays,
  );
  return {
    world,
    session: {
      recipeId: plan.recipe.id, portions: plan.portions, toolId: plan.toolId, steps, seed,
      chanceModifier: plan.chanceModifier, inventoryAtStart: w.inventory, toolsAtStart: w.tools, lack,
      labels, result, unitCost: plan.unitCost, recoveries: 0,
    },
  };
}

export const RECOVERY_STAMINA = 4;
export const RECOVERY_DAYS = 0.02;

/** Open failures left on the dish. */
export function openFailures(s: CookSession): string[] {
  return s.result.lines[0]?.openFailures ?? [];
}

/** 挽回する: one button. Picks the recovery that fixes the first open failure. */
export function recoverOnce(w: World, s: CookSession): { world: World; session: CookSession } | string {
  const failure = openFailures(s)[0];
  if (!failure) return "直す失敗がない";
  const r = RECOVERIES.find((x) => x.fixes.includes(failure));
  if (!r) return "この失敗は挽回できない";
  let inventory = w.inventory;
  if (r.needsItem) {
    const amount = r.needsItem.amount * Math.max(1, s.portions / 5);
    const next = consume(inventory, r.needsItem.itemId, amount);
    if (!next) return `${itemInfo(r.needsItem.itemId)?.name}が足りない`;
    inventory = next;
  }
  const steps: ProcessStep[] = [...s.steps, { kind: "recover", line: 0, recoverId: r.id }];
  // Re-judge with the same seed: earlier outcomes stay identical, only the new step rolls.
  const result = judge(w, { steps, seed: s.seed, chanceModifier: s.chanceModifier, inventory: s.inventoryAtStart, tools: s.toolsAtStart, lack: s.lack });
  const chef = { ...w.chef, stamina: Math.max(0, w.chef.stamina - RECOVERY_STAMINA) };
  const world = advanceTime({ ...w, inventory, chef }, RECOVERY_DAYS);
  return {
    world,
    session: { ...s, steps, result, labels: { ...s.labels, [steps.length - 1]: `挽回：${r.name}` }, recoveries: s.recoveries + 1 },
  };
}

let stockCounter = 0;

/** 完成: builds the dish (existing 8-axis evaluation), stocks the portions and grants growth. */
export function finishCook(
  w: World,
  s: CookSession,
  finish: FinishInput,
  review: FinishReview,
): { world: World; dish: DishCore; stock: DishStock; gains: CookingGains; learning: LearningEvent } {
  const recipe = getRecipe(w, s.recipeId)!;
  const school = findSchool(w.chef.activeSchoolId, w.customSchools);
  const core = buildProcessDish({
    steps: s.steps, result: s.result, school, finish, review, cookingSeed: s.seed,
    chefLevel: w.chef.level, parentDishId: null,
  });
  const dish: DishCore = { ...core, name: recipe.name, recipeId: recipe.id };
  const { chef, gains } = applyGrowth(w.chef, w.customSchools, s.steps, s.result, dish as Dish, Math.floor(Math.log2(s.portions)) * 3);
  stockCounter += 1;
  const stock: DishStock = {
    id: `stock-${Date.now().toString(36)}-${stockCounter}`,
    dishId: dish.id,
    recipeId: recipe.id,
    name: recipe.name,
    tags: [...new Set([...recipe.salesTags, ...(SCHOOL_TAGS[school.id] ?? [])])],
    portions: s.portions,
    total: dish.total,
    nutrition: dish.scores.nutrition,
    unitCost: s.unitCost,
    madeDay: w.day,
    freshness: 1,
    price: 0,
    listed: false,
    discounted: false,
  };
  // Phase 5: trial → mastered, mastery, cooking history and derivation ideas.
  const learned = recordCook({ ...w, chef, dishStock: [...w.dishStock, stock] }, s, dish, finish);
  return { world: learned.world, dish, stock, gains, learning: learned.event };
}

/** 流派 → 販売タグ: the active school colours how the dish is sold. */
export const SCHOOL_TAGS: Record<string, string[]> = {
  village: ["family"],
  north: ["preserved", "worker"],
  court: ["luxury"],
};

/** 自分で食べる: one portion restores stamina; better and more nourishing food restores more. */
export function eatPortion(w: World, stockId: string): World | string {
  const st = w.dishStock.find((x) => x.id === stockId);
  if (!st || st.portions < 1) return "料理がない";
  const gain = Math.round((8 + st.nutrition * 0.2 + st.total * 0.1) * (0.5 + 0.5 * st.freshness));
  const max = maxStamina(w.chef);
  return {
    ...w,
    chef: { ...w.chef, stamina: Math.min(max, w.chef.stamina + gain) },
    dishStock: w.dishStock.map((x) => (x.id === stockId ? { ...x, portions: x.portions - 1 } : x)).filter((x) => x.portions > 0),
  };
}
