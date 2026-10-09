import { RECIPE_MAP, RECIPES, type RecipeDef, type RecipeRequirement } from "../../data/recipes";
import { DERIVATION_MIN_COOKS, DERIVATION_MIN_MASTERY, DERIVATION_RULE_MAP, DERIVATION_RULES } from "../../data/derivations";
import { INGREDIENT_MAP } from "../../data/ingredients";
import { METHOD_MAP } from "../../data/methods";
import { SKILL_MAP } from "../../data/phase2";
import type { Dish } from "../../types";
import type { FinishInput, SkillId } from "../../types/world";
import type { DerivationIdea, LearningEvent, RecipeHistory, RecipeProgress, RecipeSource, RecipeStatus } from "../../types/learning";
import { skillLevel, STAT_LABEL } from "../chef/stats";
import type { CookSession } from "../commerce/simpleCook";
import { findSchool } from "../school/school";
import type { World } from "../world";

// レシピ帳: what the player knows, what they can try, what they have mastered, and the
// derivation ideas their own cooking history has sparked. Built-in and custom recipes are
// looked up through the same helpers so the rest of the game never cares which is which.

// ---------- Lookup (built-in + custom) ----------

export function getRecipe(w: Pick<World, "customRecipes">, id: string): RecipeDef | undefined {
  return RECIPE_MAP[id] ?? w.customRecipes.find((r) => r.id === id);
}

export function allRecipes(w: Pick<World, "customRecipes">): RecipeDef[] {
  return [...RECIPES, ...w.customRecipes];
}

// ---------- Mastery ----------

export const MASTERY_STAGES = [
  { min: 0, name: "見習い" },
  { min: 25, name: "習熟" },
  { min: 50, name: "熟練" },
  { min: 80, name: "達人" },
] as const;

export function masteryStage(m: number): { name: string; index: number; next: number | null } {
  let index = 0;
  MASTERY_STAGES.forEach((s, i) => { if (m >= s.min) index = i; });
  const next = MASTERY_STAGES[index + 1]?.min ?? null;
  return { name: MASTERY_STAGES[index].name, index, next };
}

/** Small, bounded effects: at 100 mastery, +6% success and −15% time / stamina. */
export function masteryEffects(m: number) {
  const v = Math.max(0, Math.min(100, m));
  return { chance: 0.0006 * v, timeMult: 1 - 0.0015 * v, staminaMult: 1 - 0.0015 * v, canDerive: v >= DERIVATION_MIN_MASTERY };
}

export function describeMasteryEffects(m: number): string {
  const e = masteryEffects(m);
  return `成功率+${(e.chance * 100).toFixed(1)}%・時間/体力−${((1 - e.timeMult) * 100).toFixed(1)}%${e.canDerive ? "・派生の着想あり" : ""}`;
}

/** Mastery gained by one cook: more for great results, big batches and good dishes; slows near the top. */
export function masteryGain(current: number, portions: number, greatSteps: number, total: number): number {
  const raw = 6 + 2 * Math.log2(Math.max(1, portions)) + 2 * greatSteps + (total >= 65 ? 2 : 0);
  return Math.round(raw * (1 - current / 150) * 10) / 10;
}

// ---------- Requirements ----------

export interface RequirementCheck {
  label: string;
  have: string;
  ok: boolean;
}

export function checkRequirement(w: World, r: RecipeRequirement): RequirementCheck {
  const c = w.chef;
  switch (r.kind) {
    case "level":
      return { label: `レベル${r.min}以上`, have: `Lv${c.level}`, ok: c.level >= r.min };
    case "stat":
      return { label: `${STAT_LABEL[r.stat]}${r.min}以上`, have: `${c.stats[r.stat]}`, ok: c.stats[r.stat] >= r.min };
    case "skill": {
      const lv = skillLevel(c, r.skill as SkillId);
      return { label: `${SKILL_MAP[r.skill as SkillId]?.name ?? r.skill}Lv${r.min}以上`, have: `Lv${lv}`, ok: lv >= r.min };
    }
    case "school":
      return { label: `流派「${findSchool(r.schoolId, w.customSchools).name}」を修めている`, have: c.learnedSchoolIds.includes(r.schoolId) ? "修得済み" : "未修得", ok: c.learnedSchoolIds.includes(r.schoolId) };
    case "schoolMastery": {
      const v = c.records.schoolMastery[r.schoolId] ?? 0;
      return { label: `${findSchool(r.schoolId, w.customSchools).name}の熟練${r.min}以上`, have: `${v}`, ok: v >= r.min };
    }
    case "ingredientExp": {
      const v = c.records.ingredientCounts?.[r.itemId] ?? 0;
      return { label: `${INGREDIENT_MAP[r.itemId]?.name ?? r.itemId}で${r.min}回以上料理した`, have: `${v}回`, ok: v >= r.min };
    }
    case "methodExp": {
      const v = c.records.techniqueCounts[r.methodId] ?? 0;
      return { label: `「${METHOD_MAP[r.methodId]?.name ?? r.methodId}」を${r.min}回以上使った`, have: `${v}回`, ok: v >= r.min };
    }
  }
}

export function checkRequirements(w: World, recipe: RecipeDef): { ok: boolean; checks: RequirementCheck[] } {
  const checks = (recipe.requirements ?? []).map((r) => checkRequirement(w, r));
  return { ok: checks.every((c) => c.ok), checks };
}

export function recipeStatus(w: World, id: string): RecipeStatus {
  const p = w.recipeBook[id];
  if (!p) return "unknown";
  if (p.state === "mastered") return "mastered";
  const r = getRecipe(w, id);
  return r && checkRequirements(w, r).ok ? "trialAvailable" : "known";
}

/** Can be cooked from the kitchen right now: mastered, or known with requirements met (as a trial). */
export function canCook(w: World, id: string): boolean {
  const s = recipeStatus(w, id);
  return s === "mastered" || s === "trialAvailable";
}

// ---------- Discovery ----------

const emptyHistory = (): RecipeHistory => ({ toolUses: {}, schoolUses: {}, aromaUses: {}, vesselUses: {}, greatSteps: 0, maxBatch: 0, bestTotal: 0 });

export function newProgress(recipeId: string, state: RecipeProgress["state"], source: RecipeSource, day: number, mastery = 0): RecipeProgress {
  return {
    recipeId, state, source, discoveredDay: day, masteredDay: state === "mastered" ? day : undefined,
    mastery, timesCooked: 0, failedTrials: 0, history: emptyHistory(),
  };
}

/** 知る: adds the recipe as known. Never downgrades a recipe already known or mastered. */
export function discoverRecipe(w: World, recipeId: string, source: RecipeSource): { world: World; isNew: boolean } {
  if (w.recipeBook[recipeId] || !getRecipe(w, recipeId)) return { world: w, isNew: false };
  const day = Math.floor(w.day) + 1;
  return { world: { ...w, recipeBook: { ...w.recipeBook, [recipeId]: newProgress(recipeId, "known", source, day) } }, isNew: true };
}

// ---------- Cooking record: trial → mastered, mastery, history, derivation ----------

/** A trial counts as a success when no failure is left on the dish and it is not rank D. */
export function trialSucceeded(session: CookSession, dish: Pick<Dish, "rank">): boolean {
  const open = session.result.lines[0]?.openFailures ?? [];
  return open.length === 0 && dish.rank !== "D";
}

export function recordCook(
  w: World,
  session: CookSession,
  dish: Pick<Dish, "rank" | "total">,
  finish: FinishInput,
): { world: World; event: LearningEvent } {
  const id = session.recipeId;
  const day = Math.floor(w.day) + 1;
  const prev = w.recipeBook[id] ?? newProgress(id, "known", "start", day);
  const trial = prev.state === "known";
  const succeeded = trialSucceeded(session, dish);
  const greatSteps = session.result.outcomes.filter((o) => o.grade === "great" || o.grade === "miracle").length;

  const h = prev.history;
  const bump = (m: Record<string, number>, k: string | null | undefined) => (k ? { ...m, [k]: (m[k] ?? 0) + 1 } : m);
  const history: RecipeHistory = {
    toolUses: bump(h.toolUses, session.toolId),
    schoolUses: bump(h.schoolUses, w.chef.activeSchoolId),
    aromaUses: bump(h.aromaUses, finish.aroma || null),
    vesselUses: bump(h.vesselUses, finish.vessel || null),
    greatSteps: h.greatSteps + greatSteps,
    maxBatch: Math.max(h.maxBatch, session.portions),
    bestTotal: Math.max(h.bestTotal, dish.total),
  };

  let next: RecipeProgress;
  let mastered = false;
  if (trial && !succeeded) {
    next = { ...prev, failedTrials: prev.failedTrials + 1, history };
  } else {
    mastered = trial;
    const gain = masteryGain(prev.mastery, session.portions, greatSteps, dish.total);
    next = {
      ...prev,
      state: "mastered",
      masteredDay: prev.masteredDay ?? day,
      mastery: Math.min(100, Math.round((prev.mastery + gain) * 10) / 10),
      timesCooked: prev.timesCooked + 1,
      history,
    };
  }
  const before = masteryStage(prev.mastery);
  const after = masteryStage(next.mastery);

  let world: World = {
    ...w,
    recipeBook: { ...w.recipeBook, [id]: next },
    knownRecipes: next.state === "mastered" && !w.knownRecipes.includes(id) ? [...w.knownRecipes, id] : w.knownRecipes,
  };
  const newIdeas = findNewIdeas(world, id);
  if (newIdeas.length) world = { ...world, derivationIdeas: [...world.derivationIdeas, ...newIdeas] };

  return {
    world,
    event: {
      trial, mastered, trialFailed: trial && !succeeded,
      masteryBefore: prev.mastery, masteryAfter: next.mastery,
      stageUp: after.index > before.index ? after.name : null,
      newIdeas,
    },
  };
}

// ---------- Derivation ----------

/** Ideas sparked by this recipe's history that the player has not seen yet. */
export function findNewIdeas(w: World, recipeId: string): DerivationIdea[] {
  const p = w.recipeBook[recipeId];
  const base = getRecipe(w, recipeId);
  if (!p || !base || p.state !== "mastered") return [];
  if (p.timesCooked < DERIVATION_MIN_COOKS || p.mastery < DERIVATION_MIN_MASTERY) return [];
  const seen = new Set([...w.derivationIdeas.map((i) => i.id), ...w.ideasClosed]);
  const day = Math.floor(w.day) + 1;
  return DERIVATION_RULES.filter((r) => r.test(p.history, p, base))
    .map((r) => ({ id: `${recipeId}:${r.id}`, baseRecipeId: recipeId, ruleId: r.id, day }))
    .filter((i) => !seen.has(i.id));
}

export function nameSuggestions(w: World, idea: DerivationIdea): string[] {
  const base = getRecipe(w, idea.baseRecipeId)!;
  const rule = DERIVATION_RULE_MAP[idea.ruleId];
  return [
    `${rule.namePrefixes[0]}${base.name}`,
    `${rule.namePrefixes[1]}${base.name}`,
    `${base.name}・${rule.label}`,
  ];
}

let customCounter = 0;

/** この派生をレシピとして残す: only now does a custom recipe exist. */
export function adoptIdea(
  w: World,
  ideaId: string,
  input: { name: string; description: string; origin: string },
): { world: World; recipe: RecipeDef } | string {
  const idea = w.derivationIdeas.find((i) => i.id === ideaId);
  if (!idea) return "着想が見つからない";
  const base = getRecipe(w, idea.baseRecipeId);
  if (!base) return "元のレシピが見つからない";
  const name = input.name.trim();
  if (!name) return "名前を入れてください";
  if (allRecipes(w).some((r) => r.name === name)) return "同じ名前のレシピがある";
  const rule = DERIVATION_RULE_MAP[idea.ruleId];
  customCounter += 1;
  const day = Math.floor(w.day) + 1;
  const recipe: RecipeDef = {
    ...base,
    ...rule.apply(base),
    id: `custom-${Date.now().toString(36)}-${customCounter}`,
    name: name.slice(0, 30),
    requirements: [],
    lore: undefined,
    custom: true,
    parentRecipeIds: [base.id],
    description: input.description.trim().slice(0, 200),
    origin: input.origin.trim().slice(0, 200),
    variant: rule.id,
    createdDay: day,
  };
  return {
    world: {
      ...w,
      customRecipes: [...w.customRecipes, recipe],
      recipeBook: { ...w.recipeBook, [recipe.id]: newProgress(recipe.id, "mastered", "derived", day) },
      knownRecipes: [...w.knownRecipes, recipe.id],
      derivationIdeas: w.derivationIdeas.filter((i) => i.id !== ideaId),
      ideasClosed: [...w.ideasClosed, ideaId],
    },
    recipe,
  };
}

export function dismissIdea(w: World, ideaId: string): World {
  return { ...w, derivationIdeas: w.derivationIdeas.filter((i) => i.id !== ideaId), ideasClosed: [...w.ideasClosed, ideaId] };
}

// ---------- Village sources ----------

export function learnFromTeacher(w: World, teacherId: string, recipeId: string) {
  const r = discoverRecipe(w, recipeId, "npc");
  return { ...r, world: { ...r.world, learning: { ...r.world.learning, talkedTo: [...new Set([...r.world.learning.talkedTo, teacherId])] } } };
}

export function readBook(w: World, bookId: string, recipeId: string) {
  const r = discoverRecipe(w, recipeId, "book");
  return { ...r, world: { ...r.world, learning: { ...r.world.learning, booksRead: [...new Set([...r.world.learning.booksRead, bookId])] } } };
}
