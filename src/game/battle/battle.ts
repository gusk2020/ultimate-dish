import { addReview, codexKeyOf } from "../codex/codex";
import { judgeReviewer, makeReview } from "../codex/reviews";
import { BATTLE_MAP, JUDGE_MAP, JUDGE_RUMORS, RIVAL_MAP } from "../../data/battles";
import { newStack } from "../../data/items";
import { RECIPE_MAP } from "../../data/recipes";
import { INGREDIENT_MAP } from "../../data/ingredients";
import type { Chef } from "../../types/world";
import type {
  BattleConditions, BattleDef, BattleResult, EaterCondition, EaterProfile, JudgeVerdict, Reward, Rival,
} from "../../types/eating";
import { createDefaultChef, maxMP } from "../chef/stats";
import { gainXp } from "../chef/leveling";
import { templateSteps } from "../commerce/simpleCook";
import type { DishCore } from "../cooking/buildDish";
import { describePalate } from "../eating/profile";
import { tasteDish, type TastableDish } from "../eating/tasting";
import { EMPTY_FINISH, reviewFinish } from "../finish/finish";
import { buildProcessDish } from "../process/buildProcessDish";
import { simulateProcess } from "../process/simulate";
import { createRng, seedFrom } from "../rng";
import { findSchool } from "../school/school";
import { tastingReporter } from "../../services/tastingReport";
import type { World } from "../world";
import { discoverRecipe } from "../learning/recipeBook";

// 料理勝負: one dish each, judged by 1–3 eaters. The verdict blends the dish's absolute
// evaluation, each judge's tasting (preference, culture, condition) and theme fit.

export const SCORE_WEIGHTS = { tasting: 0.5, theme: 0.25, absolute: 0.25 };
export const DRAW_MARGIN = 1; // points on the 0..100-per-judge scale

/** Sales-style tags for a dish: from its recipe, or guessed from what is in it. */
export function dishTags(dish: TastableDish & { recipeId?: string }): string[] {
  if (dish.recipeId && RECIPE_MAP[dish.recipeId]) return RECIPE_MAP[dish.recipeId].salesTags;
  const tags = new Set<string>();
  if (dish.recipe.ingredientIds.some((id) => INGREDIENT_MAP[id]?.tags.includes("meat"))) tags.add("meat");
  if (dish.profile.physical.water >= 6) tags.add("soup");
  if (dish.scores.nutrition >= 65) tags.add("healthy");
  if (dish.scores.craveability >= 70) tags.add("snack");
  if (!tags.size) tags.add("deli");
  return [...tags];
}

/** テーマ適合 0..100, including required / forbidden ingredients and the time limit. */
export function themeFit(dish: TastableDish & { recipeId?: string }, c: BattleConditions): number {
  const weights = Object.entries(c.theme.axes) as [keyof typeof dish.scores, number][];
  const wsum = weights.reduce((a, [, w]) => a + w, 0) || 1;
  let v = (weights.reduce((a, [k, w]) => a + dish.scores[k] * w, 0) / wsum) * 0.7;
  if (dishTags(dish).some((t) => c.theme.tags.includes(t))) v += 30;
  if (c.requiredIngredient && !dish.recipe.ingredientIds.includes(c.requiredIngredient)) v -= 40;
  if (c.forbiddenIngredient && dish.recipe.ingredientIds.includes(c.forbiddenIngredient)) v -= 50;
  if (c.timeLimitDays !== undefined && (dish.process?.totalDays ?? 0) > c.timeLimitDays) v -= 15;
  return Math.max(0, Math.min(100, Math.round(v)));
}

export function judgeCondition(judge: EaterProfile, c: BattleConditions): EaterCondition {
  return { ...judge.condition, ...(c.target?.condition ?? {}) };
}

export function judgeScore(dish: TastableDish & { recipeId?: string }, judge: EaterProfile, c: BattleConditions) {
  const tasting = tasteDish(dish, judge, judgeCondition(judge, c));
  const theme = themeFit(dish, c);
  const score =
    SCORE_WEIGHTS.tasting * tasting.score + SCORE_WEIGHTS.theme * theme + SCORE_WEIGHTS.absolute * dish.total;
  return { score: Math.round(score * 10) / 10, tasting, theme };
}

// ---------- Rival ----------

/** Wins against this rival make the next meeting harder (+2 technique each). */
export function rivalChef(rival: Rival, winsAgainst: number): Chef {
  const base = createDefaultChef();
  const chef: Chef = {
    ...base,
    name: rival.name,
    stats: { ...rival.stats, tech: rival.stats.tech + 2 * winsAgainst },
    activeSchoolId: rival.schoolId,
    learnedSchoolIds: [rival.schoolId],
    records: { ...base.records, skillXp: { ...rival.skills } },
  };
  return { ...chef, mp: maxMP(chef) };
}

function rivalPantry(rival: Rival, recipeId: string) {
  const r = RECIPE_MAP[recipeId];
  return [...r.ingredients, ...r.seasonings].map((l, i) => ({ ...newStack(l.itemId, 99, "shelf", "相手の蔵", 0, 9000 + i), quality: rival.pantryQuality }));
}

/** The rival cooks one recipe with the given seed: real per-step success / failure. */
export function cookRivalDish(rival: Rival, recipeId: string, seed: number, winsAgainst = 0) {
  const recipe = RECIPE_MAP[recipeId];
  const chef = rivalChef(rival, winsAgainst);
  const school = findSchool(rival.schoolId);
  const { steps, labels } = templateSteps(recipe, null);
  const result = simulateProcess(steps, { chef, school, inventory: rivalPantry(rival, recipeId), tools: [], seed });
  const review = reviewFinish(EMPTY_FINISH);
  const core = buildProcessDish({ steps, result, school, finish: EMPTY_FINISH, review, cookingSeed: seed, chefLevel: 1, parentDishId: null });
  const dish: DishCore = { ...core, name: recipe.name, recipeId };
  const outcome = Object.entries(labels)
    .map(([i, label]) => `${label}：${GRADE_JA[result.outcomes[Number(i)].grade]}`)
    .join("・");
  return { dish, outcome };
}

const GRADE_JA = { criticalFail: "大失敗", fail: "失敗", success: "成功", great: "大成功", miracle: "奇跡" } as const;

/**
 * The rival looks at the theme and the judges and picks from its preferred recipes, using a
 * nominal (seed 0) preview of each. Simple greedy choice with a little seeded noise.
 */
export function chooseRivalRecipe(rival: Rival, def: BattleDef, seed: number, winsAgainst = 0): string {
  const rng = createRng(seedFrom(seed, "choose"));
  const judges = def.judgeIds.map((id) => JUDGE_MAP[id]);
  let best = rival.preferredRecipes[0];
  let bestScore = -Infinity;
  for (const id of rival.preferredRecipes) {
    const r = RECIPE_MAP[id];
    if (!r) continue;
    const ids = r.ingredients.map((l) => l.itemId);
    if (def.conditions.forbiddenIngredient && ids.includes(def.conditions.forbiddenIngredient)) continue;
    const preview = cookRivalDish(rival, id, 0, winsAgainst).dish;
    const v = judges.reduce((a, j) => a + judgeScore(preview, j, def.conditions).score, 0) / judges.length + rng() * 4;
    if (v > bestScore) {
      bestScore = v;
      best = id;
    }
  }
  return best;
}

// ---------- Battle ----------

export function battleUnlocked(w: World, def: BattleDef): boolean {
  return def.requires.every((id) => w.battleLog.some((r) => r.battleId === id));
}

export function winsAgainst(w: World, rivalId: string): number {
  return w.battleLog.filter((r) => BATTLE_MAP[r.battleId]?.rivalId === rivalId && r.winner === "player").length;
}

export function runBattle(w: World, def: BattleDef, playerDish: TastableDish & { recipeId?: string }, seed: number): BattleResult {
  const rival = RIVAL_MAP[def.rivalId];
  const wins = winsAgainst(w, rival.id);
  const recipeId = chooseRivalRecipe(rival, def, seed, wins);
  const { dish: rivalDish, outcome } = cookRivalDish(rival, recipeId, seed, wins);

  const verdicts: JudgeVerdict[] = def.judgeIds.map((id) => {
    const judge = JUDGE_MAP[id];
    const p = judgeScore(playerDish, judge, def.conditions);
    const r = judgeScore(rivalDish, judge, def.conditions);
    return {
      judgeId: id,
      player: p.score,
      rival: r.score,
      playerTasting: p.tasting,
      rivalTasting: r.tasting,
      playerTheme: p.theme,
      rivalTheme: r.theme,
      comment: tastingReporter.brief({ dishName: playerDish.name, eater: judge, result: p.tasting, vessel: playerDish.process?.finish.vessel }),
    };
  });
  const playerTotal = Math.round(verdicts.reduce((a, v) => a + v.player, 0) * 10) / 10;
  const rivalTotal = Math.round(verdicts.reduce((a, v) => a + v.rival, 0) * 10) / 10;
  const diff = playerTotal - rivalTotal;
  const winner = Math.abs(diff) < DRAW_MARGIN ? "draw" : diff > 0 ? "player" : "rival";

  const avg = (f: (v: JudgeVerdict) => number) => verdicts.reduce((a, v) => a + f(v), 0) / verdicts.length;
  const reasons: string[] = [];
  const themeDiff = avg((v) => v.playerTheme - v.rivalTheme);
  const prefDiff = avg((v) => v.playerTasting.compatibility - v.rivalTasting.compatibility);
  const totalDiff = playerDish.total - rivalDish.total;
  if (Math.abs(themeDiff) >= 5) reasons.push(themeDiff > 0 ? "テーマにより合っていた" : "テーマ適合で劣った");
  if (Math.abs(prefDiff) >= 0.1) reasons.push(prefDiff > 0 ? "審査員の好みに合っていた" : "審査員の好みは相手寄りだった");
  if (Math.abs(totalDiff) >= 5) reasons.push(totalDiff > 0 ? "料理の完成度で上回った" : "料理の完成度で劣った");
  const c = def.conditions;
  if (c.requiredIngredient && !playerDish.recipe.ingredientIds.includes(c.requiredIngredient)) {
    reasons.push(`必須食材（${INGREDIENT_MAP[c.requiredIngredient]?.name}）を使っていない`);
  }
  if (outcome.includes("失敗")) reasons.push(`相手は調理でつまずいた（${outcome}）`);
  if (!reasons.length) reasons.push("僅差の勝負だった");

  const rewards: Reward[] =
    winner === "player"
      ? def.rewards
      : def.rewards.filter((r) => r.kind === "xp").map((r) => ({ ...r, amount: Math.round((r.amount ?? 0) * 0.3) }));

  return {
    battleId: def.id, seed, rivalDishName: rivalDish.name, rivalRecipeId: recipeId, rivalOutcome: outcome,
    verdicts, playerTotal, rivalTotal, winner, reasons, rewards,
  };
}

/** Pays rewards (xp / money now; ingredients, recipes, skills… reserved) and records the match. */
export function applyBattleResult(w: World, result: BattleResult, playerDish?: TastableDish & { recipeId?: string | null }): World {
  let chef = w.chef;
  let recipeBookWorld = w;
  for (const r of result.rewards) {
    if (r.kind === "money") chef = { ...chef, money: chef.money + (r.amount ?? 0) };
    if (r.kind === "xp") chef = gainXp(chef, r.amount ?? 0, seedFrom(result.seed, "battle-xp")).chef;
    // レシピ報酬: the recipe becomes known (trial still needed), never mastered outright.
    if (r.kind === "recipe" && r.id) recipeBookWorld = discoverRecipe(recipeBookWorld, r.id, "battle").world;
  }
  const def = BATTLE_MAP[result.battleId];
  const fameGain = result.winner === "player" ? (def.kind === "formal" ? 3 : 1) : 0;
  // Phase 9: the judges' verdicts become third-party reviews in the player's codex.
  let reviewed = w;
  if (playerDish) {
    const key = codexKeyOf({ name: playerDish.name, recipeId: playerDish.recipeId ?? null });
    if (reviewed.codex?.[key]) {
      for (const v of result.verdicts) {
        const j = JUDGE_MAP[v.judgeId];
        if (!j) continue;
        const review = makeReview(playerDish, judgeReviewer(j), { context: `${def.name}の審査`, source: "questJudge", day: Math.floor(w.day) + 1, condition: judgeCondition(j, def.conditions) });
        reviewed = addReview(reviewed, key, { ...review, score: Math.round(v.player), impression: `${v.comment}　${review.impression}` });
      }
    }
  }
  return {
    ...reviewed,
    recipeBook: recipeBookWorld.recipeBook,
    chef,
    fame: { ...w.fame, village: (w.fame.village ?? 0) + fameGain },
    battleLog: [
      ...w.battleLog,
      { battleId: result.battleId, day: Math.floor(w.day) + 1, winner: result.winner, playerTotal: result.playerTotal, rivalTotal: result.rivalTotal },
    ],
  };
}

// ---------- 審査員情報の見え方 ----------

/** 0..3: grows with fame and with battles already judged by this judge. */
export function judgeKnowledge(w: World, judgeId: string): number {
  const met = w.battleLog.filter((r) => BATTLE_MAP[r.battleId]?.judgeIds.includes(judgeId)).length;
  return Math.min(3, Math.floor((w.fame.village ?? 0) / 15) + met);
}

export function judgeInfo(judge: EaterProfile, level: number, c?: BattleConditions): string[] {
  const lines = [JUDGE_RUMORS[judge.id] ?? judge.profileText];
  const { likes, dislikes } = describePalate(judge);
  if (level >= 1 && likes.length) lines.push(`好き：${likes.join("・")}`);
  if (level >= 2) {
    if (dislikes.length) lines.push(`苦手：${dislikes.join("・")}`);
    lines.push(judge.culture.adventurous >= 0.6 ? "新しい味に興味がある" : judge.culture.adventurous <= 0.35 ? "慣れた味を好む" : "ほどほどに冒険する");
  }
  if (level >= 3) {
    const cond = c ? judgeCondition(judge, c) : judge.condition;
    lines.push(`今日は${cond.fatigue >= 0.6 ? "疲れている" : "元気"}・${cond.hunger >= 0.6 ? "空腹" : "空腹ではない"}`);
  }
  return lines;
}
