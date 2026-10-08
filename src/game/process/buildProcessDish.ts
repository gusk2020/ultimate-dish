import { INGREDIENT_MAP } from "../../data/ingredients";
import { AXES, type AxisScores, type Recipe, type Step } from "../../types";
import type { FinishInput, FinishReview, ProcessResult, ProcessStep, School } from "../../types/world";
import { cookProfile, resolveIngredients } from "../cooking/cook";
import type { DishCore } from "../cooking/buildDish";
import { generateDishName } from "../cooking/naming";
import { evaluateDish } from "../evaluation/absolute";
import { rateDish } from "../evaluation/rating";
import { clamp, fnv1a } from "../util";

// A: 構造評価 = the existing 8-axis formulas on the recipe the process boils down to,
//    adjusted by how well each step actually went and by the active school.
// B: 仕上げ評価 = small, capped nudges from the finishing input.
// C: 体験評価 = per eater, at serving time (experience.ts + finishExperienceBonus).

/** The process flattened to the Phase 1 recipe shape, so existing evaluation and quests keep working. */
export function processToRecipe(steps: ProcessStep[], result: ProcessResult): Recipe {
  const ingredientIds = new Set<string>();
  const out: Step[] = [];
  const failedTools = new Set(result.outcomes.filter((o) => o.failure === "魔導具工程失敗").map((o) => o.index));
  steps.forEach((s, i) => {
    if (s.kind === "add") {
      if (INGREDIENT_MAP[s.itemId]) ingredientIds.add(s.itemId);
      else out.push({ kind: "spice", id: s.itemId });
    } else if (s.kind === "method") out.push({ kind: "method", id: s.methodId });
    else if (s.kind === "tool" && !failedTools.has(i)) out.push({ kind: "tool", id: s.toolId });
  });
  return { ingredientIds: [...ingredientIds], steps: out };
}

// ---- 生成キー v2: the whole line design (not the roll results) ----

function encodeStep(s: ProcessStep): string {
  switch (s.kind) {
    case "add": return `a${s.line}:${s.itemId}:${s.amount}`;
    case "method": return `m${s.line}:${s.methodId}`;
    case "tool": return `t${s.line}:${s.toolId}`;
    case "recover": return `r${s.line}:${s.recoverId}`;
    case "merge": return `j${s.line}:${s.from}`;
    case "finish": return `f${s.line}`;
  }
}

export function toProcessKey(steps: ProcessStep[]): string {
  const body = `UD2|${steps.map(encodeStep).join(",")}`;
  return `${body}|${fnv1a(body).toString(36)}`;
}

export function parseProcessKey(key: string): ProcessStep[] | null {
  const parts = key.split("|");
  if (parts.length !== 3 || parts[0] !== "UD2") return null;
  if (fnv1a(`UD2|${parts[1]}`).toString(36) !== parts[2]) return null;
  if (!parts[1]) return [];
  const steps: ProcessStep[] = [];
  for (const tok of parts[1].split(",")) {
    const kind = tok[0];
    const [lineStr, a, b] = tok.slice(1).split(":");
    const line = Number(lineStr);
    if (kind === "a") steps.push({ kind: "add", line, itemId: a, amount: Number(b) });
    else if (kind === "m") steps.push({ kind: "method", line, methodId: a });
    else if (kind === "t") steps.push({ kind: "tool", line, toolId: a });
    else if (kind === "r") steps.push({ kind: "recover", line, recoverId: a });
    else if (kind === "j") steps.push({ kind: "merge", line, from: Number(a) });
    else if (kind === "f") steps.push({ kind: "finish", line });
    else return null;
  }
  return steps;
}

export interface ProcessDishInput {
  steps: ProcessStep[];
  result: ProcessResult;
  school: School;
  finish: FinishInput;
  review: FinishReview;
  cookingSeed: number;
  chefLevel: number;
  parentDishId: string | null;
}

let counter = 0;

export function buildProcessDish(input: ProcessDishInput): DishCore {
  const { steps, result, school, review } = input;
  const recipe = processToRecipe(steps, result);
  const ings = resolveIngredients(recipe);
  const profile = cookProfile(recipe);
  const base = evaluateDish(profile, ings);

  // Step quality: 0.8 is "everything went to plan".
  const q = (result.qualityScore - 0.8) * 60;
  const scores = { ...base } as AxisScores;
  scores.deliciousness += clamp(q, -25, 15);
  scores.craveability += clamp(q / 2, -12, 8);
  for (const a of AXES) {
    const schoolDelta = (school.axisBonus[a] ?? 0) + (result.schoolAxes[a] ?? 0);
    scores[a] += clamp(schoolDelta, -10, 10) + clamp(review.axes[a] ?? 0, -6, 6);
    scores[a] = Math.round(clamp(scores[a], 0, 100));
  }
  const rating = rateDish(scores, profile.undercooked);
  const key = toProcessKey(steps);
  const finalLine = result.lines.find((l) => l.line === result.openLines[0]) ?? result.lines[0];

  counter += 1;
  return {
    id: `dish-${Date.now().toString(36)}-p${counter.toString(36)}`,
    name: generateDishName(ings, profile, fnv1a(key)),
    generationKey: key,
    parentDishId: input.parentDishId,
    isPublic: false,
    recipe,
    profile,
    scores,
    total: rating.total,
    rank: rating.rank,
    titles: rating.titles,
    rankCap: rating.rankCap,
    createdAt: Date.now(),
    guild: { favorites: 0, reproductions: 0 },
    process: {
      steps,
      cookingSeed: input.cookingSeed,
      outcomes: result.outcomes,
      finalLine,
      totalDays: result.totalDays,
      schoolId: school.id,
      schoolName: school.name,
      chefLevel: input.chefLevel,
      finish: review.normalized,
      finishReview: review,
    },
  };
}
