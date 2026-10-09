import type { EaterProfile } from "../../types/eating";
import type { FoodMemory, Relationship } from "../../types/social";
import { BASE_TASTES } from "../eating/profile";
import type { World } from "../world";

// 関係: one record per pair of people, the same shape for player↔NPC, player↔companion and
// companion↔ally. Labels (stage, tendency) are always derived from numbers and history.

export const PLAYER = "player";
export const MAX_MEMORIES = 5;

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, Math.round(v * 10) / 10));

export function relationKey(a: string, b: string): string {
  return [a, b].sort().join("|");
}

export function getRelation(w: Pick<World, "social">, a: string, b: string): Relationship | undefined {
  return w.social.relations[relationKey(a, b)];
}

/** -1..1 how alike two palates are (tastes, aroma, textures). */
export function palateSimilarity(x: EaterProfile, y: EaterProfile): number {
  const keys: [number, number][] = [
    ...BASE_TASTES.map((k) => [x.taste[k] ?? 0, y.taste[k] ?? 0] as [number, number]),
    [x.aroma, y.aroma],
    ...(["tender", "chewy", "crisp", "soft", "firm"] as const).map((k) => [x.texture[k] ?? 0, y.texture[k] ?? 0] as [number, number]),
  ];
  let dot = 0, nx = 0, ny = 0;
  for (const [a, b] of keys) { dot += a * b; nx += a * a; ny += b * b; }
  return nx && ny ? dot / Math.sqrt(nx * ny) : 0;
}

export function newRelation(a: string, b: string, init: Partial<Relationship> = {}): Relationship {
  return {
    key: relationKey(a, b), a, b,
    affection: 10, trust: 10, foodCompatibility: 50, conflicts: 0,
    memories: [], sharedMeals: 0, cookedTogether: 0, traveledTogether: 0, tags: [],
    ...init,
  };
}

/** Returns the world with the pair present (created with `init` if missing). */
export function ensureRelation(w: World, a: string, b: string, init: Partial<Relationship> = {}): World {
  const key = relationKey(a, b);
  if (w.social.relations[key]) return w;
  return { ...w, social: { ...w.social, relations: { ...w.social.relations, [key]: newRelation(a, b, init) } } };
}

export interface RelationDelta {
  affection?: number;
  trust?: number;
  foodCompatibility?: number;
  conflicts?: number;
  sharedMeals?: number;
  cookedTogether?: number;
  traveledTogether?: number;
}

export function adjustRelation(w: World, a: string, b: string, d: RelationDelta, memory?: FoodMemory): World {
  const base = ensureRelation(w, a, b);
  const r = base.social.relations[relationKey(a, b)];
  const next: Relationship = {
    ...r,
    affection: clamp(r.affection + (d.affection ?? 0)),
    trust: clamp(r.trust + (d.trust ?? 0)),
    foodCompatibility: clamp(r.foodCompatibility + (d.foodCompatibility ?? 0)),
    conflicts: clamp(r.conflicts + (d.conflicts ?? 0)),
    sharedMeals: r.sharedMeals + (d.sharedMeals ?? 0),
    cookedTogether: r.cookedTogether + (d.cookedTogether ?? 0),
    traveledTogether: r.traveledTogether + (d.traveledTogether ?? 0),
    memories: memory ? keepMemories([...r.memories, memory]) : r.memories,
  };
  return { ...base, social: { ...base.social, relations: { ...base.social.relations, [r.key]: next } } };
}

/** Keep the few that matter: the most important, newest first among equals. */
export function keepMemories(list: FoodMemory[]): FoodMemory[] {
  return [...list].sort((x, y) => y.importance - x.importance || y.day - x.day).slice(0, MAX_MEMORIES)
    .sort((x, y) => y.day - x.day);
}

// ---------- Derived labels ----------

export const RELATION_STAGES = [
  { min: 0, name: "距離がある" },
  { min: 20, name: "顔見知り" },
  { min: 40, name: "親しい" },
  { min: 65, name: "信頼している" },
] as const;

export function relationStage(r: Pick<Relationship, "affection" | "trust"> | undefined): { name: string; index: number } {
  const v = r ? (r.affection + r.trust) / 2 : 0;
  let index = 0;
  RELATION_STAGES.forEach((s, i) => { if (v >= s.min) index = i; });
  return { name: RELATION_STAGES[index].name, index };
}

export type TendencyId = "friendship" | "rivalry" | "mentor" | "romanceCandidate" | "partnerBond";

/**
 * 関係の傾向: scores for each possible direction, from numbers and history only. Nothing is
 * fixed — a pair can drift from friendly to competitive and back. Only a short label is shown.
 */
export function relationTendency(r: Relationship): { scores: Record<TendencyId, number>; label: string } {
  const scores: Record<TendencyId, number> = {
    friendship: r.affection * 0.6 + Math.min(20, r.sharedMeals * 3) + (r.foodCompatibility - 50) * 0.3,
    rivalry: r.conflicts * 1.5 + (r.trust > r.affection ? (r.trust - r.affection) * 0.3 : 0),
    partnerBond: r.trust * 0.5 + Math.min(30, r.cookedTogether * 8) - r.conflicts * 0.3,
    mentor: r.tags.includes("mentor") ? r.trust * 0.6 : 0, // future: teacher / pupil pairs
    romanceCandidate: r.affection > 70 && r.trust > 60 ? (r.affection + r.trust) / 2 - 50 : 0, // future, internal only
  };
  let label = "まだ様子見";
  if (r.conflicts >= 15 && scores.rivalry >= Math.max(scores.friendship, scores.partnerBond) * 0.8) label = "競争的";
  else if (r.cookedTogether > 0 && scores.partnerBond >= scores.friendship) label = "息が合う";
  else if (scores.friendship >= 25) label = "友好的";
  return { scores, label };
}

let memoryCounter = 0;
export function newMemoryId(): string {
  memoryCounter += 1;
  return `mem-${Date.now().toString(36)}-${memoryCounter}`;
}
