import { describe, expect, it } from "vitest";
import { AXES, type Dish, type Recipe } from "../types";
import { INGREDIENTS } from "../data/ingredients";
import { METHODS } from "../data/methods";
import { SPICES, TOOLS } from "../data/magic";
import { QUESTS } from "../data/quests";
import { EATER_MAP, EATERS } from "../data/eaters";
import { buildDish } from "./cooking/buildDish";
import { parseGenerationKey, toGenerationKey } from "./cooking/generationKey";
import { RANK_THRESHOLDS, rankOf, rateDish, STANDOUT_SCORE } from "./evaluation/rating";
import { experienceOf } from "./evaluation/experience";
import { judgeQuest } from "./quest/judge";

const m = (id: string) => ({ kind: "method" as const, id });
const s = (id: string) => ({ kind: "spice" as const, id });
const t = (id: string) => ({ kind: "tool" as const, id });

function asDish(r: Recipe): Dish {
  return { ...buildDish(r), description: "", image: { kind: "placeholder", emoji: "", colors: ["", ""] } };
}

// Small deterministic PRNG so the fuzz test is reproducible.
function rng(seed: number) {
  return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
}

describe("dish generation", () => {
  it("never produces NaN or out-of-range scores", () => {
    const rand = rng(42);
    const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];
    for (let i = 0; i < 2000; i++) {
      const ingredientIds = Array.from({ length: Math.floor(rand() * 6) }, () => pick(INGREDIENTS).id);
      const steps = Array.from({ length: Math.floor(rand() * 8) }, () =>
        pick([m(pick(METHODS).id), s(pick(SPICES).id), t(pick(TOOLS).id)]),
      );
      const d = buildDish({ ingredientIds: [...new Set(ingredientIds)], steps });
      for (const a of AXES) {
        expect(Number.isFinite(d.scores[a])).toBe(true);
        expect(d.scores[a]).toBeGreaterThanOrEqual(0);
        expect(d.scores[a]).toBeLessThanOrEqual(100);
      }
      expect(Number.isFinite(d.total)).toBe(true);
      expect(d.name).not.toContain("undefined");
    }
  });

  it("same generation key reproduces the same dish", () => {
    const recipe: Recipe = { ingredientIds: ["onion", "boar"], steps: [s("homura"), t("stone"), m("grill"), m("boil")] };
    const key = toGenerationKey(recipe);
    const parsed = parseGenerationKey(key)!;
    expect(parsed).not.toBeNull();
    const a = buildDish(recipe);
    const b = buildDish(parsed);
    expect(b.generationKey).toBe(key);
    expect(b.scores).toEqual(a.scores);
    expect(b.name).toBe(a.name);
    // Ingredient order does not matter; step order does.
    expect(toGenerationKey({ ...recipe, ingredientIds: ["boar", "onion"] })).toBe(key);
    expect(toGenerationKey({ ...recipe, steps: [...recipe.steps].reverse() })).not.toBe(key);
  });

  it("rejects a tampered key", () => {
    const key = toGenerationKey({ ingredientIds: ["boar"], steps: [m("grill")] });
    expect(parseGenerationKey(key.replace("grill", "fry"))).toBeNull();
  });

  it("keeps parentDishId for derived dishes", () => {
    const parent = buildDish({ ingredientIds: ["boar"], steps: [m("grill")] });
    const child = buildDish({ ingredientIds: ["boar", "garlic"], steps: [m("grill")] }, parent.id);
    expect(child.parentDishId).toBe(parent.id);
    expect(child.id).not.toBe(parent.id);
  });
});

describe("evaluation", () => {
  it("cooking raw meat beats serving it raw", () => {
    const raw = buildDish({ ingredientIds: ["boar"], steps: [] });
    const cooked = buildDish({ ingredientIds: ["boar"], steps: [m("grill")] });
    expect(raw.profile.undercooked).toBe(true);
    expect(cooked.scores.deliciousness).toBeGreaterThan(raw.scores.deliciousness + 20);
  });

  it("sous-vide needs the 魔石炉 to be safe", () => {
    const without = buildDish({ ingredientIds: ["chicken"], steps: [m("sousvide")] });
    const withStone = buildDish({ ingredientIds: ["chicken"], steps: [t("stone"), m("sousvide")] });
    expect(without.profile.undercooked).toBe(true);
    expect(withStone.profile.undercooked).toBe(false);
  });

  it("aroma spices survive better when added after heating", () => {
    const before = buildDish({ ingredientIds: ["chicken"], steps: [s("homura"), m("boil")] });
    const after = buildDish({ ingredientIds: ["chicken"], steps: [m("boil"), s("homura")] });
    expect(after.profile.taste.aroma).toBeGreaterThan(before.profile.taste.aroma);
  });

  it("ranks follow fixed thresholds", () => {
    expect(RANK_THRESHOLDS.Legendary).toBe(85);
    expect(rankOf(10)).toBe("D");
    expect(rankOf(50)).toBe("C");
    expect(rankOf(90)).toBe("Legendary");
  });

  it("eaters rate the same dish differently without changing its absolute score", () => {
    const dish = asDish({ ingredientIds: ["boar", "garlic", "onion"], steps: [s("homura"), m("smoke")] });
    const before = { ...dish.scores };
    const scores = EATERS.map((e) => experienceOf(dish, e).score);
    expect(new Set(scores).size).toBeGreaterThan(1);
    expect(dish.scores).toEqual(before);
  });
});

describe("quests", () => {
  const good: Record<string, Recipe> = {
    q1: { ingredientIds: ["boar", "onion", "garlic"], steps: [s("homura"), m("pressure")] },
    q2: { ingredientIds: ["chicken", "beans", "cabbage", "wheat", "onion"], steps: [m("boil")] },
    q3: {
      ingredientIds: ["rabbit", "mushroom", "apple", "herb"],
      steps: [s("homura"), t("stone"), m("grill"), s("homura")],
    },
  };

  it("each quest has a passing recipe and a plain dish fails it", () => {
    const plain = asDish({ ingredientIds: ["wheat", "milk"], steps: [m("boil")] });
    for (const q of QUESTS) {
      const eater = EATER_MAP[q.eaterId];
      expect(judgeQuest(q, asDish(good[q.id]), eater).success, q.id).toBe(true);
      expect(judgeQuest(q, plain, eater).success, q.id).toBe(false);
    }
  });

  it("quest 1 requires a pest animal", () => {
    const q1 = QUESTS[0];
    const r = judgeQuest(q1, asDish({ ingredientIds: ["chicken", "onion", "garlic"], steps: [s("homura"), m("grill")] }), EATER_MAP[q1.eaterId]);
    expect(r.requirementMet).toBe(false);
    expect(r.success).toBe(false);
  });
});

describe("rating: 最低条件 and 突出ボーナス", () => {
  const flat = (v: number) => Object.fromEntries(AXES.map((a) => [a, v])) as Record<(typeof AXES)[number], number>;

  it("a balanced dish gets the rank its total earns", () => {
    const r = rateDish(flat(80));
    expect(r.rank).toBe("S");
    expect(r.rankCap).toBeNull();
    expect(r.bonus).toBe(0);
  });

  it("最低条件: one very low axis keeps a high total out of the top ranks", () => {
    const s = { ...flat(95), rarity: 10 };
    const r = rateDish(s);
    expect(rankOf(r.total)).toBe("Legendary");
    expect(r.rank).toBe("A");
    expect(r.rankCap?.from).toBe("Legendary");
  });

  it("最低条件: weak deliciousness caps the rank", () => {
    const r = rateDish({ ...flat(90), deliciousness: 60 });
    expect(r.rank).toBe("A");
    expect(r.rankCap?.reason).toContain("美味しさ");
  });

  it("最低条件: an undercooked dish cannot rise above C", () => {
    expect(rateDish(flat(80), true).rank).toBe("C");
  });

  it("突出ボーナス: axes at 90+ earn titles and a capped bonus", () => {
    const one = rateDish({ ...flat(60), craveability: STANDOUT_SCORE });
    expect(one.titles).toEqual(["魔性の味"]);
    expect(one.total).toBe(one.baseTotal + 2);
    const many = rateDish({ ...flat(60), craveability: 95, nutrition: 92, culture: 90 });
    expect(many.titles).toHaveLength(3);
    expect(many.bonus).toBe(4);
    expect(rateDish(flat(89)).titles).toEqual([]);
  });

  it("real dishes carry titles and caps consistently", () => {
    const fried = buildDish({
      ingredientIds: ["chicken", "wheat", "garlic", "cheese"],
      steps: [t("stone"), m("fry"), s("homura")],
    });
    expect(fried.scores.craveability).toBeGreaterThanOrEqual(STANDOUT_SCORE);
    expect(fried.titles).toContain("魔性の味");
    expect(fried.total).toBeGreaterThan(0);
  });
});

describe("data", () => {
  it("has exactly one quality spice and one body spice", () => {
    expect(SPICES).toHaveLength(2);
    expect(SPICES.filter((x) => x.kind === "quality")).toHaveLength(1);
    expect(SPICES.filter((x) => x.kind === "body")).toHaveLength(1);
  });
});
