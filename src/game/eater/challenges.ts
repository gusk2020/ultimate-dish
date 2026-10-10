import type { Axis } from "../../types";
import type { BattleConditions } from "../../types/eating";
import { RIVAL_MAP } from "../../data/battles";
import { skillForMethod } from "../../data/phase2";
import { AXIS_LABEL } from "../labels";
import { cookRivalDish, themeFit } from "../battle/battle";
import { maxStamina } from "../chef/stats";
import { progressionOf } from "../codex/codex";
import { createRng, seedFrom } from "../rng";
import { advanceTime, type World } from "../world";
import { addExperience, gainEaterXp, recordEaten } from "./progression";
import type { DishCore } from "../cooking/buildDish";

// 食べる側の依頼: 食べ比べ・大食い・激辛・審査員. Every truth comes from a dish that was really
// cooked (the rival's per-step successes and failures). What the eater perceives is that truth,
// blurred by how little they know — a misjudgment always has a real cause.

export type EaterQuestKind = "compare" | "bigEater" | "spicy" | "judge";
export type JudgeItem = "heat" | "prep" | "aroma" | "theme" | "preserve";

export interface EaterQuestDef {
  id: string;
  kind: EaterQuestKind;
  title: string;
  client: string;
  /** The maker-side quest / battle this is the eater's version of. */
  from: string;
  blurb: string;
  rivalId: string;
  recipeIds: string[];
  conditions: BattleConditions;
  items?: JudgeItem[];
  target?: number;
  reward: { money: number; xp: number; reputation: number };
}

const theme = (label: string, axes: Partial<Record<Axis, number>>, tags: string[]): BattleConditions => ({ theme: { label, axes, tags } });

export const EATER_QUESTS: EaterQuestDef[] = [
  {
    id: "eq-pest", kind: "compare", title: "猪と兎の食べ比べ", client: "農夫ガルド", from: "害獣料理",
    blurb: "畑を荒らす猪と兎、どっちを料理すれば村が喜ぶか。食べ比べて決めてくれ。",
    rivalId: "gald", recipeIds: ["rabbit-stew", "boar-herb-roast"],
    conditions: theme("畑仕事のあとのがっつり料理", { deliciousness: 1, craveability: 0.8 }, ["meat", "worker"]),
    reward: { money: 15, xp: 25, reputation: 2 },
  },
  {
    id: "eq-nutrition", kind: "compare", title: "滋養料理の評価", client: "母エルサ", from: "栄養改善",
    blurb: "体の弱い子に食べさせたい。どちらが体にいいか、食べて確かめてほしい。",
    rivalId: "sigurd", recipeIds: ["mushroom-porridge", "bean-wheat-soup"],
    conditions: theme("体を養うやさしい一皿", { nutrition: 1, deliciousness: 0.5 }, ["healthy", "soup"]),
    reward: { money: 18, xp: 28, reputation: 2 },
  },
  {
    id: "eq-meibutsu", kind: "compare", title: "名物候補の食べ比べ", client: "ヨハン村長", from: "村の名物",
    blurb: "村の名物にする一皿を選びたい。食べ比べて、村らしいほうを教えてくれ。",
    rivalId: "gald", recipeIds: ["bean-wheat-soup", "boar-herb-roast"],
    conditions: theme("旅人に出せる村の名物", { culture: 1, deliciousness: 0.8 }, ["family", "staple"]),
    reward: { money: 20, xp: 30, reputation: 3 },
  },
  {
    id: "eq-bigeat", kind: "bigEater", title: "収穫祭の大食い", client: "収穫祭の世話役", from: "収穫祭",
    blurb: "豆と麦のスープを6杯食べきれば賞金。無理は禁物、途中でやめてもいい。",
    rivalId: "gald", recipeIds: ["bean-wheat-soup"], target: 6,
    conditions: theme("大食い", { deliciousness: 1 }, ["soup"]),
    reward: { money: 25, xp: 30, reputation: 2 },
  },
  {
    id: "eq-spicy", kind: "spicy", title: "焔胡椒の激辛勝負", client: "酒場の亭主", from: "酒場の名物",
    blurb: "焔胡椒をたっぷり使った煮込み。辛さを選んで完食できれば賞金。",
    rivalId: "gald", recipeIds: ["rabbit-stew"],
    conditions: theme("激辛", { craveability: 1 }, ["meat"]),
    reward: { money: 10, xp: 10, reputation: 1 },
  },
  {
    id: "eq-judge-trial", kind: "judge", title: "腕試しの審査員", client: "ヨハン村長", from: "料理勝負",
    blurb: "ガルドの兎の煮込みを審査してほしい。火入れ・下処理・テーマを○×で。",
    rivalId: "gald", recipeIds: ["rabbit-stew"], items: ["heat", "prep", "theme"],
    conditions: theme("村の家庭の味", { deliciousness: 1, culture: 0.6, costPerformance: 0.4 }, ["deli", "staple", "family", "soup"]),
    reward: { money: 15, xp: 25, reputation: 2 },
  },
  {
    id: "eq-judge-harvest", kind: "judge", title: "収穫祭の審査員", client: "収穫祭の世話役", from: "収穫祭の一皿勝負",
    blurb: "シグルドの燻製を審査する。火入れ・香り・保存の出来を見極めてほしい。",
    rivalId: "sigurd", recipeIds: ["smoked-boar"], items: ["heat", "aroma", "preserve"],
    conditions: theme("冬に備える一皿", { deliciousness: 1, sustainability: 0.6 }, ["preserved", "meat"]),
    reward: { money: 22, xp: 32, reputation: 3 },
  },
];

export const EATER_QUEST_MAP: Record<string, EaterQuestDef> = Object.fromEntries(EATER_QUESTS.map((q) => [q.id, q]));

export const KIND_LABEL: Record<EaterQuestKind, string> = { compare: "食べ比べ", bigEater: "大食い", spicy: "激辛", judge: "審査員" };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function questSeed(w: World, id: string): number {
  return seedFrom(id, progressionOf(w).questLog?.length ?? 0, Math.floor(w.day));
}

/** How reliably the eater perceives a dish: level plus what they have met of its ingredients and methods. */
export function perceptionAccuracy(w: World, dish: Pick<DishCore, "recipe" | "profile">): number {
  const p = progressionOf(w);
  const met = [...dish.recipe.ingredientIds.map((id) => p.experience.ingredients[id] ?? 0), ...dish.profile.methodIds.map((id) => p.experience.methods[id] ?? 0)];
  const familiarity = Math.min(10, met.reduce((a, b) => a + Math.min(3, b), 0));
  return clamp(0.55 + 0.03 * (p.eaterLevel - 1) + 0.025 * familiarity, 0.55, 0.95);
}

export interface ChallengeOutcome {
  success: boolean;
  lines: string[];
  money: number;
  xp: number;
  reputation: number;
}

function settle(w: World, def: EaterQuestDef, dishes: DishCore[], out: ChallengeOutcome, origin: string): World {
  let world = advanceTime(w, 0.1);
  for (const d of dishes) world = recordEaten(world, d, origin).world;
  const p = progressionOf(world);
  world = { ...world, progression: { ...p, questLog: [...(p.questLog ?? []), { questId: def.id, day: Math.floor(w.day) + 1, success: out.success }] } };
  return gainEaterXp(world, out.xp, out.reputation, out.money);
}

// ---------- 食べ比べ ----------

export const TRAIT_AXES: Axis[] = ["deliciousness", "nutrition", "craveability", "culture"];

export interface CompareSession {
  questId: string;
  seed: number;
  dishes: DishCore[];
  /** What the eater noticed, per dish (truth blurred by accuracy). */
  impressions: string[][];
}

const band = (v: number) => (v >= 75 ? "かなり強い" : v >= 60 ? "しっかりある" : v >= 45 ? "ほどほど" : "弱い");

export function startCompare(w: World, def: EaterQuestDef): CompareSession {
  const seed = questSeed(w, def.id);
  const rival = RIVAL_MAP[def.rivalId];
  const dishes = def.recipeIds.map((id, i) => cookRivalDish(rival, id, seedFrom(seed, i)).dish);
  const rng = createRng(seedFrom(seed, "perceive"));
  const impressions = dishes.map((d) => {
    const noise = (1 - perceptionAccuracy(w, d)) * 40;
    return TRAIT_AXES.map((a) => `${AXIS_LABEL[a]}：${band(d.scores[a] + (rng() - 0.5) * 2 * noise)}`);
  });
  return { questId: def.id, seed, dishes, impressions };
}

export function compareTruth(def: EaterQuestDef, s: CompareSession): { pick: number; trait: Axis } {
  const fits = s.dishes.map((d) => themeFit(d, def.conditions));
  const pick = fits.indexOf(Math.max(...fits));
  const trait = [...TRAIT_AXES].sort((a, b) => Math.max(...s.dishes.map((d) => d.scores[b])) - Math.max(...s.dishes.map((d) => d.scores[a])))[0];
  return { pick, trait };
}

export function resolveCompare(w: World, s: CompareSession, answer: { pick: number; trait: Axis }): { world: World; outcome: ChallengeOutcome } {
  const def = EATER_QUEST_MAP[s.questId];
  const truth = compareTruth(def, s);
  const okPick = answer.pick === truth.pick;
  const okTrait = answer.trait === truth.trait;
  const names = s.dishes.map((d, i) => `${String.fromCharCode(65 + i)}「${d.name}」`);
  const lines = [
    okPick ? `○ テーマに合うのは${names[truth.pick]}。見立てどおりだった` : `× テーマに合っていたのは${names[truth.pick]}だった`,
    okTrait ? `○ 一番際立っていたのは${AXIS_LABEL[truth.trait]}` : `× 一番際立っていたのは${AXIS_LABEL[truth.trait]}だった`,
  ];
  const n = Number(okPick) + Number(okTrait);
  const r = def.reward;
  const out: ChallengeOutcome = n === 2
    ? { success: true, lines: [...lines, `${def.client}「助かったよ、ありがとう！」`], money: r.money, xp: r.xp, reputation: r.reputation }
    : n === 1
      ? { success: true, lines: [...lines, `${def.client}「半分は参考になった」`], money: Math.round(r.money / 2), xp: Math.round(r.xp * 0.6), reputation: 0 }
      : { success: false, lines: [...lines, "今回は見立てが外れた。食べた経験は次に活きる"], money: 0, xp: 6, reputation: 0 };
  return { world: settle(w, def, s.dishes, out, "食べ比べ"), outcome: out };
}

// ---------- 大食い ----------

export interface BigEaterSession {
  questId: string;
  seed: number;
  dish: DishCore;
  capacity: number;
  target: number;
  eaten: number;
  failed: boolean;
  log: string[];
}

export function eatingCapacity(w: World): number {
  const p = progressionOf(w);
  return Math.round((4 + w.chef.stats.strength * 0.2 + (p.eaterLevel - 1) * 0.6 + Math.min(2, (p.questLog ?? []).filter((q) => q.questId === "eq-bigeat").length * 0.3)) * 10) / 10;
}

export function startBigEater(w: World, def: EaterQuestDef): BigEaterSession {
  const seed = questSeed(w, def.id);
  const dish = cookRivalDish(RIVAL_MAP[def.rivalId], def.recipeIds[0], seed).dish;
  return { questId: def.id, seed, dish, capacity: eatingCapacity(w), target: def.target ?? 6, eaten: 0, failed: false, log: [] };
}

/** Chance that the next portion stops you (fullness near the limit). */
export function biteRisk(s: BigEaterSession): number {
  return clamp(((s.eaten + 1) / s.capacity - 0.8) * 1.5, 0, 0.85);
}

export function bite(s: BigEaterSession): BigEaterSession {
  if (s.failed) return s;
  const risk = biteRisk(s);
  const roll = createRng(seedFrom(s.seed, "bite", s.eaten))();
  if (roll < risk) return { ...s, failed: true, log: [...s.log, `${s.eaten + 1}杯目、苦しくて箸が止まった`] };
  const eaten = s.eaten + 1;
  const full = eaten / s.capacity;
  const feel = full >= 0.9 ? "もう限界が近い" : full >= 0.7 ? "少し苦しくなってきた" : "まだいける";
  return { ...s, eaten, log: [...s.log, `${eaten}杯目：${feel}`] };
}

export function finishBigEater(w: World, s: BigEaterSession): { world: World; outcome: ChallengeOutcome } {
  const def = EATER_QUEST_MAP[s.questId];
  const r = def.reward;
  let out: ChallengeOutcome;
  if (!s.failed && s.eaten >= s.target) {
    out = { success: true, lines: [`${s.eaten}杯を完食！会場が沸いた`], money: r.money, xp: r.xp, reputation: r.reputation };
  } else if (s.failed) {
    out = { success: false, lines: [`${s.eaten}杯で限界。胃が重く、しばらく動けない（体力が減った）`], money: Math.floor(1.5 * s.eaten), xp: 4 + 2 * s.eaten, reputation: 0 };
  } else {
    out = { success: false, lines: [`${s.eaten}杯で自分から箸を置いた。無理をしない判断だ`], money: 3 * s.eaten, xp: 3 * s.eaten + 2, reputation: 0 };
  }
  let world = settle(w, def, [s.dish], out, "大食い");
  if (s.failed) world = { ...world, chef: { ...world.chef, stamina: Math.max(0, world.chef.stamina - Math.round(maxStamina(world.chef) * 0.2)) } };
  return { world, outcome: out };
}

// ---------- 激辛 ----------

export const SPICE_LEVELS = [
  { level: 1, label: "ひと振り" },
  { level: 2, label: "たっぷり" },
  { level: 3, label: "焔の海" },
];

export function spiceTolerance(w: World): number {
  const p = progressionOf(w);
  return p.spiceTolerance + (p.eaterLevel - 1) * 0.5 + w.chef.stats.strength * 0.05;
}

export function spicyChance(w: World, level: number): number {
  return Math.round(clamp(0.85 - level * 0.25 + spiceTolerance(w) * 0.08, 0.05, 0.95) * 100) / 100;
}

export function resolveSpicy(w: World, def: EaterQuestDef, level: number): { world: World; outcome: ChallengeOutcome } {
  const seed = questSeed(w, def.id);
  const base = cookRivalDish(RIVAL_MAP[def.rivalId], def.recipeIds[0], seed).dish;
  const dish: DishCore = { ...base, name: `焔胡椒の激辛煮込み（${SPICE_LEVELS[level - 1].label}）`, recipeId: undefined };
  const ok = createRng(seedFrom(seed, "spicy", level))() < spicyChance(w, level);
  const r = def.reward;
  const out: ChallengeOutcome = ok
    ? { success: true, lines: [`辛さ「${SPICE_LEVELS[level - 1].label}」を完食！汗だくの勝利`], money: r.money * level, xp: r.xp + 8 * level, reputation: r.reputation * level }
    : { success: false, lines: ["途中で水に手が伸びた。口の中が火事で、少し体調を崩した"], money: 2 * level, xp: 4 + 2 * level, reputation: 0 };
  let world = settle(w, def, [dish], out, "激辛勝負");
  const p = progressionOf(world);
  world = { ...world, progression: { ...p, spiceTolerance: Math.round((p.spiceTolerance + (ok ? 1 : 0.5)) * 10) / 10 } };
  if (!ok) world = { ...world, chef: { ...world.chef, stamina: Math.max(0, world.chef.stamina - Math.round(maxStamina(world.chef) * 0.15)) } };
  return { world, outcome: out };
}

// ---------- 審査員 ----------

export const JUDGE_ITEM_LABEL: Record<JudgeItem, string> = { heat: "火入れ", prep: "食材の扱い", aroma: "香り", theme: "テーマ", preserve: "保存" };

const QUESTION: Record<JudgeItem, (c: BattleConditions) => string> = {
  heat: () => "火入れは成功している？",
  prep: () => "食材の下処理は丁寧？",
  aroma: () => "香りはしっかり立っている？",
  theme: (c) => `テーマ「${c.theme.label}」に合っている？`,
  preserve: () => "日持ちする作りになっている？",
};

const HINT: Record<JudgeItem, [string, string]> = {
  heat: ["火の通りは均一で、芯まで温かい気がする", "どこか生っぽい、焦げっぽい気がする"],
  prep: ["筋や臭みがきれいに取れている気がする", "臭みや筋が残っている気がする"],
  aroma: ["鼻に抜ける香りがはっきりある", "香りはあまり感じない"],
  theme: ["お題にぴったりの一皿に思える", "お題からは少しずれている気がする"],
  preserve: ["しっかり水気が抜けて、日持ちしそうだ", "その日のうちに食べる料理に思える"],
};

const CORRECTION: Record<JudgeItem, [string, string]> = {
  // [truth was ○ but answered ×, truth was × but answered ○]
  heat: ["火入れは成功していた。中心までちゃんと火は通っていたはずだ", "実は火入れで失敗していた。あれを見逃すとは"],
  prep: ["下処理は手を抜いていない。そこは見てほしかった", "下処理が雑だったのに、気づかなかったのか"],
  aroma: ["香りはちゃんと立っていた。鼻が慣れていなかったのでは", "香りはほとんど飛んでいた"],
  theme: ["テーマにはちゃんと沿っていた", "テーマからは外れていた。皆そう感じていた"],
  preserve: ["しっかり保存の効く作りだった", "日持ちする作りではなかった"],
};

function failedMethod(d: DishCore, test: (methodId: string) => boolean): boolean | null {
  const info = d.process;
  if (!info) return null;
  const graded = info.outcomes.filter((o) => {
    const st = info.steps[o.index];
    return st && st.kind === "method" && test(st.methodId);
  });
  if (!graded.length) return null;
  return graded.some((o) => o.grade === "fail" || o.grade === "criticalFail");
}

/** The real answer, from the dish as it was actually cooked. */
export function judgeTruth(item: JudgeItem, d: DishCore, c: BattleConditions): boolean {
  switch (item) {
    case "heat": return !(failedMethod(d, (m) => m !== "cut" && skillForMethod(m) === "fire") ?? false) && !d.profile.undercooked;
    case "prep": return !(failedMethod(d, (m) => m === "cut") ?? false);
    case "aroma": return d.profile.taste.aroma >= 5;
    case "theme": return themeFit(d, c) >= 60;
    case "preserve": return d.profile.preserved;
  }
}

export interface JudgeSession {
  questId: string;
  seed: number;
  dish: DishCore;
  cook: string;
  items: { item: JudgeItem; question: string; hint: string }[];
  accuracy: number;
}

export function startJudge(w: World, def: EaterQuestDef): JudgeSession {
  const seed = questSeed(w, def.id);
  const rival = RIVAL_MAP[def.rivalId];
  const dish = cookRivalDish(rival, def.recipeIds[0], seed).dish;
  const accuracy = perceptionAccuracy(w, dish);
  const rng = createRng(seedFrom(seed, "judge-hint"));
  const items = (def.items ?? ["theme"]).map((item) => {
    const truth = judgeTruth(item, dish, def.conditions);
    const perceived = rng() < accuracy ? truth : !truth;
    return { item, question: QUESTION[item](def.conditions), hint: HINT[item][perceived ? 0 : 1] };
  });
  return { questId: def.id, seed, dish, cook: rival.name, items, accuracy };
}

export interface JudgeOutcome extends ChallengeOutcome {
  results: { item: JudgeItem; answer: boolean; truth: boolean; correct: boolean; correction?: string }[];
}

export function resolveJudge(w: World, s: JudgeSession, answers: Partial<Record<JudgeItem, boolean>>): { world: World; outcome: JudgeOutcome } {
  const def = EATER_QUEST_MAP[s.questId];
  const results = s.items.map(({ item }) => {
    const truth = judgeTruth(item, s.dish, def.conditions);
    const answer = answers[item] ?? false;
    const correct = answer === truth;
    return { item, answer, truth, correct, correction: correct ? undefined : `${s.cook}「${CORRECTION[item][truth ? 0 : 1]}」` };
  });
  const right = results.filter((r) => r.correct).length;
  const wrong = results.length - right;
  const won = right >= Math.ceil((results.length * 2) / 3);
  const r = def.reward;
  const lines = results.map((x) => `${x.correct ? "○" : "×"} ${JUDGE_ITEM_LABEL[x.item]}：${x.answer ? "○" : "×"}と判定（実際は${x.truth ? "○" : "×"}）`);
  const out: JudgeOutcome = won
    ? {
      success: true, results, money: r.money + 5 * right, xp: r.xp + 5 * right, reputation: r.reputation,
      lines: [...lines, ...results.filter((x) => x.correction).map((x) => x.correction!), `${def.client}「見事な審査だった。ありがとう」`],
    }
    : {
      success: false, results, money: Math.round(r.money / 3), xp: 6 + 2 * right, reputation: -wrong,
      lines: [...lines, ...results.filter((x) => x.correction).map((x) => x.correction!), "観客から「審査が的外れだ」と苦情が出た。評判が下がった"],
    };
  // Experience grows either way: the eater has now really met this dish's ingredients and methods.
  let world = settle(w, def, [s.dish], out, "審査");
  const p = progressionOf(world);
  world = { ...world, progression: addExperience(p, s.dish) };
  return { world, outcome: out };
}
