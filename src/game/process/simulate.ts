import { INGREDIENT_MAP } from "../../data/ingredients";
import { itemInfo } from "../../data/items";
import { METHOD_MAP } from "../../data/methods";
import {
  ADD_DAYS, FINISH_DAYS, MERGE_DAYS, METHOD_BASE_DAYS, METHOD_BASE_SUCCESS, METHOD_FAILURE,
  RECOVERY_MAP, skillForMethod,
} from "../../data/phase2";
import type { AxisScores } from "../../types";
import type {
  Chef, Intermediate, InventoryStack, ProcessResult, ProcessStep, School, StepGrade, StepOutcome, ToolState,
} from "../../types/world";
import { eff, ingredientCapacity, maxSteps, skillLevel, toolSlots } from "../chef/stats";
import { availableAmount, itemQuality } from "../inventory/inventory";
import { createRng } from "../rng";

// Runs a line-based process step by step with seeded rolls.
// Every step consumes exactly two random numbers, so appending steps (e.g. a recovery)
// never changes the outcomes of the steps already judged with the same cooking seed.

export interface ProcessContext {
  chef: Chef;
  school: School;
  inventory: InventoryStack[];
  tools: ToolState[];
  seed: number;
  /** Extra success modifier from outside the process (low stamina, batch size). Default 0. */
  chanceModifier?: number;
}

const GRADE_QUALITY: Record<StepGrade, number> = {
  criticalFail: -0.25, fail: -0.12, success: 0.02, great: 0.08, miracle: 0.2,
};
const PAST: Record<string, string> = {
  grill: "焼いた", boil: "煮た", steam: "蒸した", fry: "揚げた", smoke: "燻した", pickle: "漬けた",
  dry: "干した", ferment: "発酵させた", sousvide: "低温調理した", pressure: "圧力で煮た",
  cut: "切った", saute: "炒めた", reduce: "煮詰めた",
};
const HEAT_TEMP: Record<string, number> = { fry: 170, grill: 200, saute: 160, smoke: 70, sousvide: 60 };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Shared roll: success / great / miracle / fail / critical fail, with luck-driven rescue. */
export function rollGrade(chance: number, r1: number, r2: number, luck: number): { grade: StepGrade; rescued: boolean } {
  const L = eff(luck);
  if (r1 < chance) {
    if (r2 < 0.004 + 0.03 * L) return { grade: "miracle", rescued: false };
    if (r2 < 0.08 + 0.25 * L) return { grade: "great", rescued: false };
    return { grade: "success", rescued: false };
  }
  if (r2 > 1 - 0.15 * L) return { grade: "success", rescued: true }; // 失敗後の救済
  return { grade: r2 < 0.25 * (1 - 0.8 * L) ? "criticalFail" : "fail", rescued: false };
}

export function methodChance(methodId: string, ctx: ProcessContext, complexity: number, amount: number): number {
  const { chef, school } = ctx;
  const s = chef.stats;
  const skill = skillForMethod(methodId);
  const heat = METHOD_MAP[methodId]?.systems.includes("heat") ?? false;
  let p = METHOD_BASE_SUCCESS[methodId] ?? 0.85;
  p += 0.22 * eff(s.tech) + 0.08 * eff(s.knowledge) + 0.02 * eff(s.luck);
  p += 0.12 * eff(skillLevel(chef, skill), 10);
  if (heat && skillLevel(chef, "preciseFire") >= 1) p += 0.08;
  p += school.methodSuccess[methodId] ?? 0;
  p += ctx.chanceModifier ?? 0;
  // 複雑化: each step past the third costs more; technique and knowledge soften it.
  p -= 0.03 * Math.max(0, complexity - 3) * (1 - 0.6 * eff(s.tech + s.knowledge, 40));
  p -= 0.03 * Math.max(0, amount - 3);
  return p;
}

function lineName(l: Intermediate, verb: string | null): string {
  const main = Object.entries(l.ingredients)
    .filter(([id]) => itemInfo(id)?.kind === "ingredient" && INGREDIENT_MAP[id]?.category !== "seasoning")
    .sort((a, b) => b[1] - a[1])[0]?.[0] ?? Object.keys(l.ingredients)[0];
  const name = itemInfo(main)?.name ?? "素材";
  return verb ? `${verb}${name}` : name;
}

export function simulateProcess(steps: ProcessStep[], ctx: ProcessContext): ProcessResult {
  const { chef, school } = ctx;
  const rng = createRng(ctx.seed);
  const lines = new Map<number, Intermediate>();
  const errors: string[] = [];
  const outcomes: StepOutcome[] = [];
  const pendingTool = new Map<number, string>();
  const used: Record<string, number> = {}; // item id → amount taken
  const toolUses: Record<string, number> = {};
  const schoolAxes: Partial<AxisScores> = {};
  const schoolNotes: string[] = [];
  let capacityUsed = 0;
  let mpCost = 0;
  let complexity = 0;

  const live = (i: number) => {
    const l = lines.get(i);
    return l && l.mergedInto === undefined ? l : null;
  };

  steps.forEach((step, index) => {
    const r1 = rng();
    const r2 = rng();
    const out: StepOutcome = { index, grade: "success", chance: 1, timeDays: 0, mpCost: 0 };
    const invalid = (msg: string) => {
      errors.push(`${index + 1}: ${msg}`);
      out.grade = "fail";
      out.failure = "無効な工程";
      outcomes.push(out);
    };

    if (step.kind === "add") {
      const info = itemInfo(step.itemId);
      if (!info || !(step.amount > 0)) return invalid("不明な素材");
      used[step.itemId] = (used[step.itemId] ?? 0) + step.amount;
      if (used[step.itemId] > availableAmount(ctx.inventory, step.itemId) + 1e-9) {
        errors.push(`${index + 1}: ${info.name}の在庫が足りない`);
      }
      capacityUsed += step.amount * info.capacityWeight;
      let l = live(step.line);
      if (!l) {
        if (lines.has(step.line)) return invalid("合流済みのラインには投入できない");
        l = {
          line: step.line, name: info.name, amount: 0, temperature: 20, moisture: 5, state: "raw",
          quality: 0, ingredients: {}, history: [], openFailures: [], clockDays: 0,
        };
        lines.set(step.line, l);
      }
      const q = itemQuality(ctx.inventory, step.itemId);
      l.quality = (l.quality * l.amount + q * step.amount) / (l.amount + step.amount);
      const water = INGREDIENT_MAP[step.itemId]?.physical.water ?? 2;
      l.moisture = (l.moisture * l.amount + water * step.amount) / (l.amount + step.amount);
      l.amount += step.amount;
      l.ingredients[step.itemId] = (l.ingredients[step.itemId] ?? 0) + step.amount;
      if (l.state === "raw") l.name = lineName(l, null);
      out.timeDays = ADD_DAYS;
      l.clockDays += out.timeDays;
      outcomes.push(out);
      return;
    }

    const l = live(step.line);
    if (!l) return invalid("対象のラインに中身がない");
    complexity += 1;

    if (step.kind === "tool") {
      const tool = ctx.tools.find((t) => t.toolId === step.toolId);
      toolUses[step.toolId] = (toolUses[step.toolId] ?? 0) + 1;
      if (!tool || tool.durability < toolUses[step.toolId]) return invalid("魔導具の耐久が足りない");
      if (Object.keys(toolUses).length > toolSlots(chef)) errors.push(`${index + 1}: 同時に使える魔導具は${toolSlots(chef)}種まで`);
      if (step.toolId !== "jar") out.mpCost = 2; // jar pays per day saved, when applied
      out.chance = clamp(0.9 + 0.08 * eff(skillLevel(chef, "magitool"), 10) + 0.02 * eff(chef.stats.magic), 0.05, 0.99);
      const g = rollGrade(out.chance, r1, r2, chef.stats.luck);
      out.grade = g.grade;
      if (g.grade === "fail" || g.grade === "criticalFail") {
        out.failure = "魔導具工程失敗";
        l.openFailures.push(out.failure);
      } else pendingTool.set(step.line, step.toolId);
      if (g.rescued) out.note = "幸運に救われた";
      out.timeDays = 0.001;
    } else if (step.kind === "method") {
      const m = METHOD_MAP[step.methodId];
      if (!m) return invalid("不明な工程");
      const tool = pendingTool.get(step.line);
      pendingTool.delete(step.line);
      const heat = m.systems.includes("heat");
      const timed = m.systems.includes("time");
      let chance = methodChance(m.id, ctx, complexity, l.amount);
      if (m.id === "fry" && (l.ingredients.butter ?? 0) === 0 && l.ingredients.nuts === undefined) {
        chance -= 0.1;
        out.note = "油なしで揚げた";
      }
      let days = (METHOD_BASE_DAYS[m.id] ?? 0.02) * (0.6 + 0.15 * Math.min(l.amount, 10)) * (1 - 0.3 * eff(chef.stats.tech));
      if (tool === "stone" && heat) {
        chance = Math.max(0.75, chance + 0.12);
        days *= 0.6;
      }
      if (tool === "jar" && timed) {
        const saved = days * 0.9;
        days -= saved;
        out.mpCost = Math.max(1, Math.ceil(saved));
      }
      out.chance = clamp(chance, 0.05, 0.97);
      const g = rollGrade(out.chance, r1, r2, chef.stats.luck);
      out.grade = g.grade;
      if (g.rescued) out.note = "幸運に救われた";
      if (g.grade === "fail" || g.grade === "criticalFail") {
        const failure = METHOD_FAILURE[m.id] ?? "失敗";
        if (failure === "香り飛び" && tool === "pot") {
          out.grade = "success";
          out.note = "香封鍋が香りを守った";
        } else {
          out.failure = failure;
          l.openFailures.push(failure);
        }
      }
      out.timeDays = days;
      l.quality += GRADE_QUALITY[out.grade];
      l.moisture = clamp(l.moisture + (m.physicalDelta.water ?? 0), 0, 10);
      if (heat) l.temperature = HEAT_TEMP[m.id] ?? 95;
      l.state = heat ? "cooked" : timed ? "aged" : "prepped";
      l.name = lineName(l, PAST[m.id] ?? m.verb);
      const variant = school.methodVariant[m.id];
      if (variant) {
        schoolNotes.push(variant.label);
        for (const [k, v] of Object.entries(variant.axes) as [keyof AxisScores, number][]) {
          schoolAxes[k] = (schoolAxes[k] ?? 0) + v;
        }
      }
    } else if (step.kind === "recover") {
      const r = RECOVERY_MAP[step.recoverId];
      if (!r) return invalid("不明な挽回工程");
      if (r.needsItem) {
        const info = itemInfo(r.needsItem.itemId)!;
        used[info.id] = (used[info.id] ?? 0) + r.needsItem.amount;
        if (used[info.id] > availableAmount(ctx.inventory, info.id) + 1e-9) errors.push(`${index + 1}: ${info.name}の在庫が足りない`);
        capacityUsed += r.needsItem.amount * info.capacityWeight;
        l.ingredients[info.id] = (l.ingredients[info.id] ?? 0) + r.needsItem.amount;
      }
      const target = l.openFailures.findIndex((f) => r.fixes.includes(f));
      out.chance = clamp(r.baseSuccess + 0.12 * eff(skillLevel(chef, r.skill), 10) + 0.12 * eff(chef.stats.tech), 0.05, 0.97);
      const g = rollGrade(out.chance, r1, r2, chef.stats.luck);
      out.grade = g.grade === "criticalFail" ? "fail" : g.grade;
      if (target < 0) out.note = "直す失敗がない";
      else if (out.grade === "fail") out.failure = "挽回失敗";
      else {
        out.note = `${l.openFailures[target]}を挽回`;
        l.openFailures.splice(target, 1);
        l.quality += 0.1;
      }
      if (out.grade === "fail") l.quality -= 0.03;
      out.timeDays = r.days;
    } else if (step.kind === "merge") {
      const from = live(step.from);
      if (!from || step.from === step.line) return invalid("合流元のラインがない");
      out.chance = clamp(0.88 + 0.1 * eff(skillLevel(chef, "seasoning"), 10) + 0.05 * eff(chef.stats.knowledge), 0.05, 0.98);
      const g = rollGrade(out.chance, r1, r2, chef.stats.luck);
      out.grade = g.grade;
      const total = l.amount + from.amount;
      const wt = l.amount / total;
      l.history = [
        { label: l.name, ratio: Math.round(wt * 100) / 100 },
        { label: from.name, ratio: Math.round((1 - wt) * 100) / 100 },
      ];
      for (const [id, a] of Object.entries(from.ingredients)) l.ingredients[id] = (l.ingredients[id] ?? 0) + a;
      l.quality = l.quality * wt + from.quality * (1 - wt) + GRADE_QUALITY[out.grade];
      l.temperature = l.temperature * wt + from.temperature * (1 - wt);
      l.moisture = l.moisture * wt + from.moisture * (1 - wt);
      l.openFailures.push(...from.openFailures);
      if (out.grade === "fail" || out.grade === "criticalFail") {
        out.failure = "分離";
        l.openFailures.push("分離");
      }
      l.name = `${l.name}と${from.name}`;
      l.amount = total;
      l.state = "merged";
      l.clockDays = Math.max(l.clockDays, from.clockDays); // parallel lines: wait for the slower one
      from.mergedInto = l.line;
      out.timeDays = MERGE_DAYS;
    } else if (step.kind === "finish") {
      out.chance = clamp(0.9 + 0.05 * eff(chef.stats.tech), 0.05, 0.99);
      out.grade = rollGrade(out.chance, r1, r2, chef.stats.luck).grade;
      if (out.grade === "criticalFail") out.grade = "fail";
      if (out.grade === "fail") out.failure = "盛り崩れ";
      l.quality += GRADE_QUALITY[out.grade] / 2;
      l.state = "plated";
      out.timeDays = FINISH_DAYS;
    }

    l.clockDays += out.timeDays;
    mpCost += out.mpCost;
    outcomes.push(out);
  });

  const stepCount = steps.filter((s) => s.kind !== "add").length;
  if (stepCount > maxSteps(chef)) errors.push(`工程数が上限${maxSteps(chef)}を超えている（強靭で増える）`);
  const cap = ingredientCapacity(chef);
  if (capacityUsed > cap + 1e-9) errors.push(`食材容量${cap}を超えている（${round(capacityUsed)}）`);
  if (mpCost > chef.mp) errors.push(`MPが足りない（必要${mpCost} / 現在${chef.mp}）`);

  const all = [...lines.values()];
  const open = all.filter((l) => l.mergedInto === undefined);
  const final = open.length === 1 ? open[0] : undefined;
  return {
    errors,
    outcomes,
    lines: all,
    totalDays: open.reduce((a, l) => Math.max(a, l.clockDays), 0),
    mpCost,
    capacityUsed: round(capacityUsed),
    stepCount,
    toolsUsed: Object.keys(toolUses),
    qualityScore: final ? clamp(final.quality, 0, 1.3) : 0,
    schoolNotes,
    schoolAxes,
    openLines: open.map((l) => l.line),
  };
}

const round = (v: number) => Math.round(v * 100) / 100;

/** 日 → 「1日3時間」「45分」 */
export function formatDays(days: number): string {
  const totalMin = Math.round(days * 24 * 60);
  const d = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const m = totalMin % 60;
  if (d > 0) return `${d}日${h ? `${h}時間` : ""}`;
  if (h > 0) return `${h}時間${m ? `${m}分` : ""}`;
  return `${m}分`;
}
