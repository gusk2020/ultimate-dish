import type { Dish, Rank } from "../../types";
import { DEFAULT_EATER_SCHOOL } from "../../data/eaterSchools";
import type { CodexEntry, PlayerProgression, ThirdPartyReview } from "../../types/codex";
import type { RecipeProgress } from "../../types/learning";
import { RANK_ORDER, rankOf } from "../evaluation/rating";
import { getRecipe } from "../learning/recipeBook";
import { locationOf } from "../travel/market";
import type { World } from "../world";

// 私の図鑑 (codex): what the player has actually made or eaten. ノート (notebook): what they only
// know about. Eating a dish records it here, but never teaches its recipe.

/** What the codex needs to know about a dish (a full Dish or a tasted one). */
export type CodexDish = Pick<Dish, "id" | "name" | "recipe" | "profile" | "total"> & { recipeId?: string | null; rank?: Rank; image?: Dish["image"] };

export function newProgression(): PlayerProgression {
  return { eaterXp: 0, eaterLevel: 1, reputation: 0, experience: { ingredients: {}, methods: {}, regions: {} }, eatenCounts: {}, spiceTolerance: 0, questLog: [], eaterSchoolId: DEFAULT_EATER_SCHOOL, eaterSkills: {} };
}

export const progressionOf = (w: Pick<World, "progression">): PlayerProgression => w.progression ?? newProgression();

export function codexKeyOf(dish: Pick<CodexDish, "name" | "recipeId">): string {
  return dish.recipeId ? dish.recipeId : `dish:${dish.name}`;
}

const today = (w: World) => Math.floor(w.day) + 1;

function upsert(w: World, dish: CodexDish, origin: string): { entry: CodexEntry; isNew: boolean } {
  const key = codexKeyOf(dish);
  const prev = w.codex?.[key];
  const rank = dish.rank ?? rankOf(dish.total);
  const better = !prev || dish.total > prev.bestTotal;
  const recipe = dish.recipeId ? getRecipe(w, dish.recipeId) : undefined;
  const entry: CodexEntry = {
    key,
    name: prev?.name ?? dish.name,
    recipeId: dish.recipeId ?? null,
    emoji: prev?.emoji ?? dish.image?.emoji ?? "🍽️",
    bestRank: better ? rank : prev!.bestRank,
    bestTotal: better ? dish.total : prev!.bestTotal,
    ingredientIds: [...new Set([...(prev?.ingredientIds ?? []), ...dish.recipe.ingredientIds])],
    methodIds: [...new Set([...(prev?.methodIds ?? []), ...dish.profile.methodIds])],
    origin: prev?.origin ?? origin,
    timesCooked: prev?.timesCooked ?? 0,
    timesEaten: prev?.timesEaten ?? 0,
    firstCookedDay: prev?.firstCookedDay,
    firstEatenDay: prev?.firstEatenDay,
    ownReport: prev?.ownReport,
    reviews: prev?.reviews ?? [],
    parentKeys: prev?.parentKeys ?? (recipe?.parentRecipeIds ?? []),
    publicId: prev?.publicId,
    lastDishId: dish.id,
  };
  return { entry, isNew: !prev };
}

/** 作る側: completing a dish registers it (and counts a reproduction of a published recipe). */
export function recordCooked(w: World, dish: CodexDish, origin = "自作"): { world: World; entry: CodexEntry; isNew: boolean } {
  const { entry: e, isNew } = upsert(w, dish, origin);
  const entry: CodexEntry = { ...e, timesCooked: e.timesCooked + 1, firstCookedDay: e.firstCookedDay ?? today(w) };
  let publicRegistry = w.publicRegistry ?? [];
  if (entry.publicId) {
    publicRegistry = publicRegistry.map((p) => (p.id === entry.publicId ? { ...p, reproductions: p.reproductions + 1 } : p));
  }
  return { world: { ...w, codex: { ...(w.codex ?? {}), [entry.key]: entry }, publicRegistry }, entry, isNew };
}

/** 食べる側: eating registers the dish. The recipe book is never touched. */
export function recordEatenEntry(w: World, dish: CodexDish, origin: string): { world: World; entry: CodexEntry; isNew: boolean } {
  const { entry: e, isNew } = upsert(w, dish, origin);
  const entry: CodexEntry = { ...e, timesEaten: e.timesEaten + 1, firstEatenDay: e.firstEatenDay ?? today(w) };
  return { world: { ...w, codex: { ...(w.codex ?? {}), [entry.key]: entry } }, entry, isNew };
}

export function setOwnReport(w: World, key: string, score: number, text: string): World {
  const e = w.codex?.[key];
  if (!e) return w;
  return { ...w, codex: { ...w.codex, [key]: { ...e, ownReport: { score: Math.round(score), text: text.slice(0, 200), day: today(w) } } } };
}

/** A third-party review lands in the codex, and on the public record when the dish is published. */
export function addReview(w: World, key: string, review: ThirdPartyReview): World {
  const e = w.codex?.[key];
  if (!e) return w;
  const publicRegistry = (w.publicRegistry ?? []).map((p) => (e.publicId && p.id === e.publicId ? { ...p, reviews: [...p.reviews, review] } : p));
  return { ...w, codex: { ...w.codex, [key]: { ...e, reviews: [...e.reviews, review] } }, publicRegistry };
}

export function codexEntries(w: World): CodexEntry[] {
  return Object.values(w.codex ?? {}).sort((a, b) => b.bestTotal - a.bestTotal);
}

/** Children: entries whose parents include this one. */
export function childrenOf(w: World, key: string): CodexEntry[] {
  return codexEntries(w).filter((e) => e.parentKeys.includes(key));
}

// ---------- ノート ----------

export type KnowledgeState = "unknown" | "known" | "attempted" | "mastered";

export interface NotebookRow {
  recipeId: string;
  name: string;
  state: KnowledgeState;
  source: RecipeProgress["source"];
  cooked: boolean;
  tasted: boolean;
  lore?: string;
}

export function knowledgeState(p: RecipeProgress | undefined): KnowledgeState {
  if (!p) return "unknown";
  if (p.state === "mastered") return "mastered";
  return p.failedTrials > 0 || p.timesCooked > 0 ? "attempted" : "known";
}

export const KNOWLEDGE_JA: Record<KnowledgeState, string> = { unknown: "未知", known: "知っている", attempted: "試作した", mastered: "習得" };

export function notebook(w: World): NotebookRow[] {
  return Object.values(w.recipeBook).map((p) => {
    const r = getRecipe(w, p.recipeId);
    const e = w.codex?.[p.recipeId];
    return {
      recipeId: p.recipeId, name: r?.name ?? p.recipeId, state: knowledgeState(p), source: p.source,
      cooked: (e?.timesCooked ?? 0) > 0 || p.timesCooked > 0, tasted: (e?.timesEaten ?? 0) > 0, lore: r?.lore,
    };
  });
}

/** What the codex can show of how it is made: the steps only once the recipe is really known. */
export function codexSteps(w: World, e: CodexEntry): string[] | null {
  if (!e.recipeId) return null;
  const p = w.recipeBook[e.recipeId];
  if (!p) return null;
  return getRecipe(w, e.recipeId)?.steps.map((s) => s.label) ?? null;
}

export function originLabel(w: World): string {
  return `${locationOf(w).shortName}で`;
}

export const rankAtLeast = (a: string, b: Rank) => RANK_ORDER.indexOf(a as Rank) >= RANK_ORDER.indexOf(b);

/** The dish picture (placeholder emoji) arrives after the dish: keep the first one in the codex. */
export function withCodexImage(w: World, dish: Pick<Dish, "name" | "image"> & { recipeId?: string | null }): World {
  const key = codexKeyOf({ name: dish.name, recipeId: dish.recipeId ?? null });
  const e = w.codex?.[key];
  if (!e || e.emoji !== "🍽️" || !dish.image?.emoji) return w;
  return { ...w, codex: { ...w.codex, [key]: { ...e, emoji: dish.image.emoji } } };
}
