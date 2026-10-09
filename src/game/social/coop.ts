import { INGREDIENT_MAP } from "../../data/ingredients";
import { METHOD_MAP } from "../../data/methods";
import { skillForMethod } from "../../data/phase2";
import type { RecipeDef } from "../../data/recipes";
import type { CharacterDef, CookTeam, FoodMemory, Specialty } from "../../types/social";
import type { Stats } from "../../types/world";
import { eff } from "../chef/stats";
import type { World } from "../world";
import { getCharacter, hasCompanion, line } from "./companion";
import { adjustRelation, getRelation, newMemoryId, PLAYER, relationKey, relationStage, type RelationDelta } from "./relations";

// 共同料理: one main cook (judged by the engine) plus helpers. Helpers add a small, explained
// bonus from their ability, their specialties and how well they get on with the main cook.
// Kept small on purpose: cooking alone stays a perfectly good choice.

export const SOLO: CookTeam = { mainId: PLAYER, assistantIds: [] };
export const COOP_LIMITS = { perHelper: [-0.03, 0.06] as const, total: [-0.04, 0.08] as const };

export interface CoopEffect {
  chance: number;
  timeMult: number;
  /** Multiplier on the player's stamina cost. */
  staminaMult: number;
  notes: string[];
}

const pct = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v * 100).toFixed(1)}%`;
const clamp = (v: number, [lo, hi]: readonly [number, number]) => Math.max(lo, Math.min(hi, v));

function nameOf(w: World, id: string): string {
  return id === PLAYER ? "あなた" : getCharacter(w, id)?.name ?? id;
}

/** The player as a helper: their specialties are the methods they have used a lot. */
function helperProfile(w: World, id: string): { stats: Stats; specialties: Specialty[] } | null {
  if (id === PLAYER) {
    const used = Object.entries(w.chef.records.techniqueCounts).filter(([, n]) => n >= 3).map(([m]) => m);
    return { stats: w.chef.stats, specialties: used.map((m) => ({ kind: "method", id: m, label: METHOD_MAP[m]?.name ?? m })) };
  }
  const c = getCharacter(w, id);
  return c ? { stats: c.chef.stats, specialties: c.specialties } : null;
}

/** Which of a helper's specialties this recipe actually uses. */
export function matchingSpecialties(recipe: RecipeDef, specialties: Specialty[], toolId: string | null): Specialty[] {
  const methods = recipe.steps.map((s) => s.methodId);
  const cats = new Set(recipe.ingredients.map((l) => INGREDIENT_MAP[l.itemId]?.category));
  return specialties.filter((s) =>
    s.kind === "method" ? methods.includes(s.id)
    : s.kind === "category" ? cats.has(s.id as never)
    : s.id === "seasoning" ? recipe.seasonings.length > 0
    : s.id === "magitool" ? !!toolId
    : methods.some((m) => skillForMethod(m) === s.id),
  );
}

/** How a pair works together: trust helps most, affection a little, friction hurts. */
export function synergy(w: World, a: string, b: string): number {
  const r = getRelation(w, a, b);
  const trust = r?.trust ?? 10, affection = r?.affection ?? 10, conflicts = r?.conflicts ?? 0;
  return 0.02 * (trust - 40) / 60 + 0.01 * (affection - 40) / 60 - 0.03 * conflicts / 100;
}

export function teamEffect(w: World, team: CookTeam, recipe: RecipeDef, toolId: string | null): CoopEffect {
  const notes: string[] = [];
  let chance = 0;
  for (const id of team.assistantIds) {
    const h = helperProfile(w, id);
    if (!h) continue;
    const name = nameOf(w, id);
    const ability = 0.02 * eff((h.stats.tech + h.stats.knowledge) / 2);
    const match = matchingSpecialties(recipe, h.specialties, toolId);
    const spec = Math.min(0.03, 0.015 * match.length);
    const syn = synergy(w, team.mainId, id);
    const total = clamp(ability + spec + syn, COOP_LIMITS.perHelper);
    chance += total;
    notes.push(`${name}の腕 ${pct(ability)}`);
    if (match.length) notes.push(`得意「${match.map((s) => s.label).join("・")}」${pct(spec)}`);
    notes.push(`${syn >= 0 ? "連携" : "ぎこちなさ"}（信頼・好感・わだかまり）${pct(syn)}`);
  }
  chance = clamp(chance, COOP_LIMITS.total);
  const helped = team.assistantIds.length > 0;
  const byOther = team.mainId !== PLAYER;
  return {
    chance,
    timeMult: helped ? 0.92 : 1,
    staminaMult: byOther ? 0.4 : helped ? 0.85 : 1,
    notes: byOther ? [`主担当は${nameOf(w, team.mainId)}（あなたの体力消費は少なめ）`, ...notes] : notes,
  };
}

/** Recipes a character can cook as the main cook right now. */
export function canCookAsMain(w: World, id: string, recipeId: string): boolean {
  if (id === PLAYER) return true;
  const c = getCharacter(w, id);
  if (!c) return false;
  const available = c.kind === "companion" ? hasCompanion(w) : w.social.party.includes(id);
  return available && c.signatureRecipeIds.includes(recipeId);
}

export interface CoopResult {
  succeeded: boolean;
  lines: { id: string; name: string; emoji: string; text: string }[];
  deltas: { pair: string; names: string; delta: RelationDelta }[];
  stageUps: { id: string; stage: string; text: string }[];
}

/** After cooking together: every pair in the team gets a little closer — or a little sore. */
export function afterTeamCook(
  w: World,
  team: CookTeam,
  dish: { id: string; name: string; total: number; recipeId?: string | null },
  succeeded: boolean,
  greatSteps: number,
): { world: World; result: CoopResult } {
  const members = [team.mainId, ...team.assistantIds];
  const day = Math.floor(w.day) + 1;
  let world = w;
  const deltas: CoopResult["deltas"] = [];
  const beforeStage = Object.fromEntries(members.filter((m) => m !== PLAYER).map((m) => [m, relationStage(getRelation(w, PLAYER, m)).index]));
  for (let i = 0; i < members.length; i++) {
    for (let j = i + 1; j < members.length; j++) {
      const a = members[i], b = members[j];
      const first = (getRelation(world, a, b)?.cookedTogether ?? 0) === 0;
      const d: RelationDelta = succeeded
        ? { trust: 4 + Math.min(2, greatSteps), affection: 2, conflicts: -2, cookedTogether: 1 }
        : { trust: -1, conflicts: 6, cookedTogether: 1 };
      const helper = [a, b].find((x) => x !== PLAYER) ?? b;
      const c = getCharacter(world, helper);
      const memory: FoodMemory = {
        id: newMemoryId(), dishId: dish.id, dishName: dish.name, recipeId: dish.recipeId ?? null, day, kind: "cookTogether",
        reaction: c ? `「${line(c, succeeded ? "success" : "fail", day)}」` : "",
        score: dish.total, liking: succeeded ? 0.5 : -0.3, cookedBy: members, sharedWith: members,
        importance: 2 + (first ? 2 : 0) + (greatSteps > 0 ? 1 : 0),
      };
      world = adjustRelation(world, a, b, d, memory);
      deltas.push({ pair: relationKey(a, b), names: `${nameOf(w, a)}と${nameOf(w, b)}`, delta: d });
    }
  }
  const lines = members.filter((m) => m !== PLAYER).map((m) => {
    const c = getCharacter(world, m) as CharacterDef;
    return { id: m, name: c.name, emoji: c.emoji, text: line(c, succeeded ? "success" : "fail", day) || (succeeded ? "うまくいった！" : "……次はがんばろう。") };
  });
  const stageUps = members
    .filter((m) => m !== PLAYER)
    .map((m) => {
      const after = relationStage(getRelation(world, PLAYER, m));
      const c = getCharacter(world, m)!;
      return after.index > beforeStage[m] ? { id: m, stage: after.name, text: line(c, c.kind === "companion" ? "relationUp" : "progress", day) } : null;
    })
    .filter((x): x is NonNullable<typeof x> => !!x);
  return { world, result: { succeeded, lines, deltas, stageUps } };
}
