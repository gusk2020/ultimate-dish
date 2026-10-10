import { AGE_DEFAULT, AGE_MAX, AGE_MIN } from "../../data/creation";
import { FOOD_STORY } from "../../data/foodStory";
import { TOOL_RULES } from "../../data/phase2";
import type { CompanionPresentation, GenderExpression, PlayerIdentity, StartChoice } from "../../types/identity";
import type { CharacterDef, Lean, PlayerPersona } from "../../types/social";
import type { Stats } from "../../types/world";
import { checkAllocation, createDefaultChef, maxMP, maxStamina, STAT_BASE } from "../chef/stats";
import { setFoodStory } from "../eating/eat";
import type { FoodStoryAnswers } from "../eating/profile";
import { chooseCompanion, declineCompanion, generateCandidates } from "../social/companion";
import type { World } from "../world";

// キャラクター作成: a draft the creation screens fill in, the order of its steps, and the one
// function that turns it into the starting world. Nothing reaches the normal game until then.

export type CreationStep = "lean" | "identity" | "start" | "tool" | "companionGender" | "companion" | "foodStory" | "stats" | "confirm";

export const STEP_LABEL: Record<CreationStep, string> = {
  lean: "作る側／食べる側", identity: "性別表現・年齢", start: "相棒か魔導具か", tool: "魔導具",
  companionGender: "相棒の姿", companion: "相棒", foodStory: "食遍歴", stats: "能力", confirm: "確認",
};

export interface CreationDraft {
  lean: Lean | null;
  genderExpression: GenderExpression | null;
  age: number;
  start: StartChoice | null;
  toolId: string | null;
  companionPresentation: CompanionPresentation | null;
  /** The two temperament answers the companion route asks for (the other two are inferred). */
  temperament: { pace?: number; talk?: number };
  companionSpeciesId: string | null;
  /** Kept from the card the player chose, so later edits never rename the companion. */
  companionName: string | null;
  foodStory: FoodStoryAnswers | null;
  stats: Stats;
  statsConfirmed: boolean;
  /** Phase 9: typed name; blank = the default for the chosen gender expression. */
  name: string;
}

/** Blank names take a card-suit default from the gender expression (text only). */
export const DEFAULT_NAMES: Record<GenderExpression, string> = { masculine: "スペード", feminine: "ハート", neutral: "クラブ", androgynous: "ダイヤ" };
export const NAME_MAX = 12;

export function resolvedName(d: Pick<CreationDraft, "name" | "genderExpression">): string {
  const typed = d.name.trim().slice(0, NAME_MAX);
  if (typed) return typed;
  return d.genderExpression ? DEFAULT_NAMES[d.genderExpression] : "名無し";
}

export function newDraft(): CreationDraft {
  const base = STAT_BASE;
  return {
    lean: null, genderExpression: null, age: AGE_DEFAULT, start: null, toolId: null, companionPresentation: null,
    temperament: {}, companionSpeciesId: null, companionName: null, foodStory: null,
    stats: { tech: base, knowledge: base, luck: base, magic: base, strength: base }, statsConfirmed: false, name: "",
  };
}

/** The suggested allocation (the pre-Phase 8 default chef). */
export function suggestedStats(): Stats {
  return { ...createDefaultChef().stats };
}

export const clampAge = (n: number) => Math.max(AGE_MIN, Math.min(AGE_MAX, Math.round(n)));

/** The steps for this draft: the companion route and the tool route never see each other's screens. */
export function creationSteps(d: CreationDraft): CreationStep[] {
  const branch: CreationStep[] = d.start === "tool" ? ["tool"] : d.start === "companion" ? ["companionGender", "companion"] : [];
  return ["lean", "identity", "start", ...branch, "foodStory", "stats", "confirm"];
}

export function stepDone(d: CreationDraft, step: CreationStep): boolean {
  switch (step) {
    case "lean": return d.lean !== null;
    case "identity": return d.genderExpression !== null && d.age >= AGE_MIN && d.age <= AGE_MAX;
    case "start": return d.start !== null;
    case "tool": return !!d.toolId && !!TOOL_RULES[d.toolId];
    case "companionGender": return d.companionPresentation !== null;
    case "companion": return d.companionSpeciesId !== null && d.temperament.pace !== undefined && d.temperament.talk !== undefined;
    case "foodStory": return !!d.foodStory && FOOD_STORY.every((q) => !!d.foodStory!.answers[q.id]);
    case "stats": return d.statsConfirmed && checkAllocation(d.stats).ok && checkAllocation(d.stats).remaining === 0;
    case "confirm": return false;
  }
}

export function missingSteps(d: CreationDraft): CreationStep[] {
  return creationSteps(d).filter((s) => s !== "confirm" && !stepDone(d, s));
}

/**
 * Where to go after finishing a step. Going forward follows the order; after a change made from
 * the confirmation screen it returns there — unless the change opened a new step (e.g. switching
 * from the tool to a companion), which is asked first.
 */
export function nextStep(d: CreationDraft, current: CreationStep, returning: boolean): CreationStep {
  if (returning) return missingSteps(d)[0] ?? "confirm";
  const steps = creationSteps(d);
  return steps[Math.min(steps.length - 1, steps.indexOf(current) + 1)];
}

export function previousStep(d: CreationDraft, current: CreationStep): CreationStep | null {
  const steps = creationSteps(d);
  const i = steps.indexOf(current);
  return i > 0 ? steps[i - 1] : null;
}

// ---------- Building the starting world ----------

/** Temperament: two answers from the companion route, two read from the stats and the food story. */
export function personaFor(d: CreationDraft, w: World): PlayerPersona {
  const s = d.stats;
  return {
    lean: d.lean ?? "maker",
    personality: {
      pace: d.temperament.pace ?? 0,
      talk: d.temperament.talk ?? 0,
      mind: d.statsConfirmed ? (s.tech + s.knowledge >= s.luck + s.magic ? -0.7 : 0.7) : 0,
      venture: w.palate ? (w.palate.culture.adventurous >= 0.5 ? 0.7 : -0.7) : 0,
    },
  };
}

/** The world as far as the draft goes (stats and palate only once those steps are done). */
function provisional(base: World, d: CreationDraft): World {
  // The name is known from the identity step on, so the companion's name seed already uses it.
  let w: World = d.genderExpression ? { ...base, chef: { ...base.chef, name: resolvedName(d) } } : base;
  if (d.statsConfirmed) {
    const chef = { ...w.chef, stats: { ...d.stats } };
    w = { ...w, chef: { ...chef, mp: maxMP(chef), stamina: maxStamina(chef) } };
  }
  if (d.foodStory) w = setFoodStory(w, d.foodStory);
  return w;
}

export const UNDECIDED_COMPLEMENT = "食の好みと得意な能力は、このあとの食遍歴と能力配分を見て決まる";

/** The three candidates for the companion step, from what is known so far. */
export function creationCandidates(base: World, d: CreationDraft): CharacterDef[] {
  const w = provisional(base, d);
  const list = generateCandidates(w, personaFor(d, w), { presentation: d.companionPresentation ?? undefined });
  const known = d.statsConfirmed && !!d.foodStory;
  // The last reason is always the food / stats one: not decided until those steps are done.
  return list.map((c) => (known ? c : { ...c, complement: [...(c.complement ?? []).slice(0, -1), UNDECIDED_COMPLEMENT] }));
}

/** The companion exactly as it will be born (shown on the confirmation screen). */
export function previewCompanion(base: World, d: CreationDraft): CharacterDef | null {
  if (d.start !== "companion" || !d.companionSpeciesId) return null;
  const w = provisional(base, d);
  const list = generateCandidates(w, personaFor(d, w), { presentation: d.companionPresentation ?? undefined });
  const c = list.find((x) => x.id === `companion-${d.companionSpeciesId}`);
  return c ? { ...c, name: d.companionName ?? c.name, eater: { ...c.eater, name: d.companionName ?? c.eater.name } } : null;
}

export function speciesIdOf(c: CharacterDef): string {
  return c.id.replace(/^companion-/, "");
}

/** この人物で始める: everything the draft says becomes the starting world, at once. */
export function finalizeCreation(base: World, d: CreationDraft): World | string {
  const missing = missingSteps(d);
  if (missing.length) return `まだ決めていない項目がある：${missing.map((s) => STEP_LABEL[s]).join("・")}`;
  const check = checkAllocation(d.stats);
  if (!check.ok) return check.errors.join("、");

  let w = provisional(base, d);
  w = { ...w, chef: { ...w.chef, allocationLocked: true } };
  w = { ...w, social: { ...w.social, persona: personaFor(d, w) } };

  if (d.start === "companion") {
    const c = previewCompanion(base, d);
    if (!c) return "相棒が見つからない";
    // The companion route starts without a magic tool: the two are an either / or.
    w = chooseCompanion({ ...w, tools: [] }, c);
  } else {
    w = declineCompanion({ ...w, tools: w.tools.filter((t) => t.toolId === d.toolId) });
  }

  const identity: PlayerIdentity = {
    creationCompleted: true,
    lean: d.lean,
    genderExpression: d.genderExpression,
    age: d.age,
    start: d.start,
    startingToolId: d.start === "tool" ? d.toolId : null,
    companionPresentation: d.start === "companion" ? d.companionPresentation : null,
    name: resolvedName(d),
  };
  return { ...w, identity };
}

/** New games show the creation sequence; a world without identity data counts as an existing player. */
export function needsCreation(w: Pick<World, "identity">): boolean {
  return w.identity ? !w.identity.creationCompleted : false;
}
