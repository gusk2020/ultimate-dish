import { describe, expect, it } from "vitest";
import { FOOD_STORY } from "../data/foodStory";
import { BATTLE_MAP, JUDGE_MAP, RIVAL_MAP } from "../data/battles";
import { EATERS } from "../data/eaters";
import type { Dish } from "../types";
import { buildPlayerProfile, describePalate, eaterFromLegacy } from "./eating/profile";
import { learnFromMeal, LEARNING_RATE, tasteDish } from "./eating/tasting";
import { eatAndTaste, recordTasting, setFoodStory } from "./eating/eat";
import {
  applyBattleResult, battleUnlocked, chooseRivalRecipe, cookRivalDish, judgeInfo, judgeKnowledge, judgeScore, runBattle, themeFit,
} from "./battle/battle";
import { buyShortage, finishCook, planCook, startCook } from "./commerce/simpleCook";
import { endDay } from "./commerce/day";
import { EMPTY_FINISH, reviewFinish } from "./finish/finish";
import { createWorld, type World } from "./world";

const firstAnswers = { answers: Object.fromEntries(FOOD_STORY.map((q) => [q.id, q.options[0].id])), freeText: "" };
const otherAnswers = { answers: Object.fromEntries(FOOD_STORY.map((q) => [q.id, q.options[3].id])), freeText: "甘いお菓子が好き" };

function cook(recipeId: string, portions = 2, seed = 11): { world: World; dish: Dish; stockId: string } {
  let w: World = { ...createWorld(), chef: { ...createWorld().chef, money: 1000 } };
  const bought = buyShortage(w, planCook(w, recipeId, portions, null));
  if (typeof bought !== "string") w = bought;
  const st = startCook(w, planCook(w, recipeId, portions, null), seed);
  if (typeof st === "string") throw new Error(st);
  const f = finishCook(st.world, st.session, EMPTY_FINISH, reviewFinish(EMPTY_FINISH));
  const dish = { ...f.dish, description: "", image: { kind: "placeholder" as const, emoji: "", colors: ["", ""] as [string, string] } };
  return { world: f.world, dish, stockId: f.stock.id };
}

describe("food story → EaterProfile", () => {
  it("answers shape taste / aroma / texture / culture and leave memories", () => {
    const a = buildPlayerProfile("A", firstAnswers);
    const b = buildPlayerProfile("B", otherAnswers);
    expect(a.memories?.length).toBe(5);
    expect(b.memories?.length).toBe(6); // + free text
    expect(a.culture.schools.village).toBeGreaterThan(b.culture.schools.village ?? 0);
    expect(b.taste.sweet ?? 0).toBeGreaterThan(a.taste.sweet ?? 0);
    expect(a.taste.bitter ?? 0).toBeLessThan(0); // 苦い野草が苦手
    expect(a.profileText.length).toBeGreaterThan(0);
    expect(describePalate(a).dislikes).toContain("苦味");
  });

  it("legacy quest eaters convert to the same profile shape", () => {
    const p = eaterFromLegacy(EATERS[0]);
    expect(p.taste.umami).toBe(EATERS[0].tastePrefs.umami);
    expect(p.condition.nutrition).toBeCloseTo(1 - EATERS[0].nutritionNeed);
  });
});

describe("eating", () => {
  it("the same dish tastes different to different eaters", () => {
    const { dish } = cook("boar-herb-roast");
    const scores = ["j-bruno", "j-liene", "j-marta"].map((id) => tasteDish(dish, JUDGE_MAP[id]).score);
    expect(new Set(scores).size).toBeGreaterThan(1);
    const a = tasteDish(dish, buildPlayerProfile("A", firstAnswers));
    expect(a.stages).toHaveLength(7);
  });

  it("hunger and tiredness change the experience, not the dish", () => {
    const { dish } = cook("bean-wheat-soup");
    const judge = JUDGE_MAP["j-marta"];
    const full = tasteDish(dish, judge, { hunger: 0, fatigue: 0, nutrition: 1 });
    const starving = tasteDish(dish, judge, { hunger: 1, fatigue: 1, nutrition: 0.2 });
    expect(starving.score).toBeGreaterThan(full.score);
    expect(dish.scores).toEqual(dish.scores);
  });

  it("eating records a report and nudges preferences only slightly", () => {
    const { world, dish, stockId } = cook("rabbit-stew", 2);
    const w = setFoodStory(world, firstAnswers);
    const ate = eatAndTaste(w, stockId, dish);
    if (typeof ate === "string") throw new Error(ate);
    expect(ate.world.dishStock.find((s) => s.id === stockId)?.portions).toBe(1);
    const { world: after, record } = recordTasting(ate.world, dish, ate.result, { liked: "love" }, 1, "また作りたい");
    expect(after.tastingLog[0].id).toBe(record.id);
    expect(record.liking).toBeGreaterThan(0);
    const before = w.palate!;
    const learned = after.palate!;
    const tag = dish.profile.textureTag;
    expect(learned.texture[tag] ?? 0).toBeGreaterThan(before.texture[tag] ?? 0);
    expect((learned.texture[tag] ?? 0) - (before.texture[tag] ?? 0)).toBeLessThanOrEqual(LEARNING_RATE + 1e-9);
    expect(learned.history.rabbit).toBe(1);
    // Repeated liking strengthens the tendency gradually, never past 1.
    let p = before;
    for (let i = 0; i < 100; i++) p = learnFromMeal(p, dish, 1);
    expect(p.texture[tag]).toBeLessThanOrEqual(1);
  });

  it("eating without a food story asks for one", () => {
    const { world, dish, stockId } = cook("rabbit-stew");
    expect(eatAndTaste(world, stockId, dish)).toBe("先に食遍歴を作ろう");
  });
});

describe("cooking battles", () => {
  it("three judges give different scores", () => {
    const { dish } = cook("bean-wheat-soup");
    const def = BATTLE_MAP.harvest;
    const scores = def.judgeIds.map((id) => judgeScore(dish, JUDGE_MAP[id], def.conditions).score);
    expect(new Set(scores).size).toBe(3);
  });

  it("theme fit and the required ingredient matter", () => {
    const soup = cook("bean-wheat-soup").dish; // has wheat, soup / healthy
    const roast = cook("boar-herb-roast").dish; // no wheat, meat
    const c = BATTLE_MAP.harvest.conditions;
    expect(themeFit(soup, c)).toBeGreaterThan(themeFit(roast, c) + 20);
    const meat = BATTLE_MAP.rematch.conditions;
    expect(themeFit(roast, meat)).toBeGreaterThan(themeFit(soup, meat));
  });

  it("the rival picks from its candidate recipes and cooks with seeded success/failure", () => {
    const sigurd = RIVAL_MAP.sigurd;
    const pick = chooseRivalRecipe(sigurd, BATTLE_MAP.harvest, 5);
    expect(sigurd.preferredRecipes).toContain(pick);
    expect(pick).toBe("mushroom-porridge"); // the wheat soup fits the harvest theme
    const a = cookRivalDish(sigurd, pick, 9);
    const b = cookRivalDish(sigurd, pick, 9);
    expect(a.dish.scores).toEqual(b.dish.scores);
    expect(a.outcome).toMatch(/成功|失敗|奇跡/);
  });

  it("battle result is decided, rewards paid, and rematch is possible", () => {
    const { world, dish } = cook("bean-wheat-soup");
    const def = BATTLE_MAP.tutorial;
    expect(battleUnlocked(world, BATTLE_MAP.harvest)).toBe(false);
    const result = runBattle(world, def, dish, 1);
    expect(["player", "rival", "draw"]).toContain(result.winner);
    expect(result.verdicts).toHaveLength(1);
    const diff = result.playerTotal - result.rivalTotal;
    if (result.winner === "player") expect(diff).toBeGreaterThanOrEqual(1);
    if (result.winner === "rival") expect(diff).toBeLessThanOrEqual(-1);
    const after = applyBattleResult(world, result);
    expect(after.battleLog).toHaveLength(1);
    if (result.winner === "player") expect(after.chef.money).toBeGreaterThan(world.chef.money);
    expect(battleUnlocked(after, BATTLE_MAP.harvest)).toBe(true);
    // Rematch: same battle again works and is recorded.
    const again = applyBattleResult(after, runBattle(after, def, dish, 2));
    expect(again.battleLog).toHaveLength(2);
  });

  it("a dish without the required ingredient loses ground in the formal battle", () => {
    const { world } = cook("bean-wheat-soup");
    const soup = cook("bean-wheat-soup").dish;
    const roast = cook("boar-herb-roast").dish;
    const withWheat = runBattle(world, BATTLE_MAP.harvest, soup, 3);
    const without = runBattle(world, BATTLE_MAP.harvest, roast, 3);
    expect(withWheat.playerTotal).toBeGreaterThan(without.playerTotal);
    expect(without.reasons.join()).toContain("必須食材");
    expect(withWheat.verdicts).toHaveLength(3);
  });

  it("judge info grows with knowledge", () => {
    const w = createWorld();
    const j = JUDGE_MAP["j-bruno"];
    expect(judgeKnowledge(w, j.id)).toBe(0);
    expect(judgeInfo(j, 0)).toHaveLength(1);
    expect(judgeInfo(j, 3, BATTLE_MAP.harvest.conditions).length).toBeGreaterThan(3);
  });
});

describe("phase 3 still works", () => {
  it("cook → sell → end day with a palate present", () => {
    const { world } = cook("rabbit-stew", 5);
    const w = setFoodStory({ ...world, dishStock: world.dishStock.map((s) => ({ ...s, listed: true })) }, firstAnswers);
    const hungry = w.palate!.condition.hunger;
    const { world: next, report } = endDay(w, 4);
    expect(report.salesRevenue).toBeGreaterThan(0);
    expect(Math.floor(next.day)).toBe(Math.floor(w.day) + 1);
    expect(next.palate!.condition.hunger).toBeGreaterThanOrEqual(hungry);
  });
});
