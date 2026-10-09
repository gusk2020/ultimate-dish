import { describe, expect, it } from "vitest";
import { STARTING_RECIPES } from "../data/recipes";
import { BATTLE_MAP } from "../data/battles";
import { FOOD_STORY } from "../data/foodStory";
import { FACILITIES } from "../data/facilities";
import { BOOKS, TEACHERS } from "../data/learningSources";
import type { FinishInput } from "../types/world";
import type { Dish } from "../types";
import {
  adoptIdea, checkRequirements, describeMasteryEffects, dismissIdea, getRecipe, learnFromTeacher, masteryStage, nameSuggestions,
  readBook, recipeStatus,
} from "./learning/recipeBook";
import { buyShortage, finishCook, openFailures, planCook, startCook } from "./commerce/simpleCook";
import { endDay } from "./commerce/day";
import { applyBattleResult, runBattle } from "./battle/battle";
import { eatAndTaste, setFoodStory } from "./eating/eat";
import { EMPTY_FINISH, reviewFinish } from "./finish/finish";
import { createWorld, type World } from "./world";

const rich = (): World => ({ ...createWorld(), chef: { ...createWorld().chef, money: 5000 } });
const HERB: FinishInput = { ...EMPTY_FINISH, aroma: "ハーブを添える" };

function cook(w: World, recipeId: string, portions = 2, seed = 1, finish: FinishInput = EMPTY_FINISH) {
  let world = w;
  const bought = buyShortage(world, planCook(world, recipeId, portions, null));
  if (typeof bought !== "string") world = bought;
  const st = startCook(world, planCook(world, recipeId, portions, null), seed);
  if (typeof st === "string") throw new Error(st);
  const review = reviewFinish(finish);
  const out = finishCook(st.world, st.session, review.normalized, review);
  const dish = { ...out.dish, description: "", image: { kind: "placeholder" as const, emoji: "", colors: ["", ""] as [string, string] } } as Dish;
  return { ...out, dish, session: st.session };
}

/** Cook until the recipe's trial (or any cook) comes out clean, trying successive seeds. */
function cookClean(w: World, recipeId: string, finish: FinishInput = EMPTY_FINISH) {
  for (let seed = 1; seed < 200; seed++) {
    const st = startCook(buyOk(w, recipeId), planCook(buyOk(w, recipeId), recipeId, 2, null), seed);
    if (typeof st !== "string" && openFailures(st.session).length === 0) return cook(w, recipeId, 2, seed, finish);
  }
  throw new Error("no clean seed");
}
function buyOk(w: World, recipeId: string): World {
  const b = buyShortage(w, planCook(w, recipeId, 2, null));
  return typeof b === "string" ? w : b;
}

describe("recipe knowledge", () => {
  it("starts with the 3 basics mastered and everything else unknown", () => {
    const w = createWorld();
    for (const id of STARTING_RECIPES) expect(recipeStatus(w, id)).toBe("mastered");
    expect(STARTING_RECIPES).toHaveLength(3);
    expect(recipeStatus(w, "hanna-pickled-cabbage")).toBe("unknown");
    expect(w.knownRecipes).toEqual(STARTING_RECIPES);
  });

  it("NPC and book make a recipe known, not mastered; unmet requirements block the trial", () => {
    const npc = learnFromTeacher(createWorld(), "hanna", "hanna-pickled-cabbage");
    expect(npc.isNew).toBe(true);
    expect(npc.world.recipeBook["hanna-pickled-cabbage"].source).toBe("npc");
    expect(recipeStatus(npc.world, "hanna-pickled-cabbage")).toBe("known");
    const check = checkRequirements(npc.world, getRecipe(npc.world, "hanna-pickled-cabbage")!);
    expect(check.ok).toBe(false);
    expect(check.checks.find((c) => !c.ok)?.label).toContain("煮る");
    expect(planCook(npc.world, "hanna-pickled-cabbage", 1, null).problems.join()).toContain("試作");
    // learning again changes nothing
    expect(learnFromTeacher(npc.world, "hanna", "hanna-pickled-cabbage").isNew).toBe(false);

    const book = readBook(createWorld(), "old-preserves", "archive-dried-boar");
    expect(book.world.recipeBook["archive-dried-boar"].state).toBe("known");
    expect(book.world.learning.booksRead).toContain("old-preserves");
  });

  it("battle victory gives a recipe as known; a loss gives none", () => {
    let w = rich();
    const soup = cook(w, "bean-wheat-soup", 1, 3).dish;
    let won = null;
    let lost = null;
    for (let seed = 0; seed < 60 && (!won || !lost); seed++) {
      const r = runBattle(w, BATTLE_MAP.tutorial, soup, seed);
      if (r.winner === "player" && !won) won = r;
      if (r.winner !== "player" && !lost) lost = r;
    }
    expect(won).not.toBeNull();
    const after = applyBattleResult(w, won!);
    expect(after.recipeBook["gald-baked-apple"]?.source).toBe("battle");
    expect(after.recipeBook["gald-baked-apple"]?.state).toBe("known");
    if (lost) expect(applyBattleResult(w, lost).recipeBook["gald-baked-apple"]).toBeUndefined();
    w = after;
    expect(recipeStatus(w, "gald-baked-apple")).not.toBe("mastered");
  });
});

describe("trial and mastery", () => {
  function readyForPickles() {
    let w = learnFromTeacher(rich(), "hanna", "hanna-pickled-cabbage").world;
    w = cook(w, "rabbit-stew", 2, 1).world; // boil ×1
    expect(recipeStatus(w, "hanna-pickled-cabbage")).toBe("known");
    w = cook(w, "rabbit-stew", 2, 2).world; // boil ×2
    return w;
  }

  it("meeting requirements makes the trial available", () => {
    expect(recipeStatus(readyForPickles(), "hanna-pickled-cabbage")).toBe("trialAvailable");
  });

  it("a failed trial keeps the knowledge but does not master; first success masters", () => {
    const w = readyForPickles();
    let failed = null;
    for (let seed = 1; seed < 400 && !failed; seed++) {
      const ww = buyOk(w, "hanna-pickled-cabbage");
      const st = startCook(ww, planCook(ww, "hanna-pickled-cabbage", 2, null), seed);
      if (typeof st !== "string" && openFailures(st.session).length > 0) {
        const review = reviewFinish(EMPTY_FINISH);
        failed = finishCook(st.world, st.session, review.normalized, review);
      }
    }
    expect(failed).not.toBeNull();
    expect(failed!.learning.trialFailed).toBe(true);
    expect(recipeStatus(failed!.world, "hanna-pickled-cabbage")).toBe("trialAvailable");
    expect(failed!.world.recipeBook["hanna-pickled-cabbage"].failedTrials).toBe(1);
    expect(failed!.world.knownRecipes).not.toContain("hanna-pickled-cabbage");

    const ok = cookClean(failed!.world, "hanna-pickled-cabbage");
    expect(ok.learning.mastered).toBe(true);
    expect(recipeStatus(ok.world, "hanna-pickled-cabbage")).toBe("mastered");
    expect(ok.world.knownRecipes).toContain("hanna-pickled-cabbage");
    expect(ok.world.recipeBook["hanna-pickled-cabbage"].mastery).toBeGreaterThan(0);
  });

  it("cooking raises mastery, with named stages and readable effects", () => {
    let w = rich();
    const m0 = w.recipeBook["rabbit-stew"].mastery;
    w = cook(w, "rabbit-stew", 5, 4).world;
    const m1 = w.recipeBook["rabbit-stew"].mastery;
    expect(m1).toBeGreaterThan(m0);
    w = cook(w, "rabbit-stew", 5, 5).world;
    expect(w.recipeBook["rabbit-stew"].mastery).toBeGreaterThan(m1);
    expect(w.recipeBook["rabbit-stew"].timesCooked).toBe(2);
    expect(masteryStage(0).name).toBe("見習い");
    expect(masteryStage(30).name).toBe("習熟");
    expect(masteryStage(90).name).toBe("達人");
    expect(describeMasteryEffects(50)).toContain("成功率");
  });

  it("mastery is reflected in the cooking plan (small, bounded)", () => {
    const w = rich();
    const low = { ...w, recipeBook: { ...w.recipeBook, "rabbit-stew": { ...w.recipeBook["rabbit-stew"], mastery: 0 } } };
    const high = { ...w, recipeBook: { ...w.recipeBook, "rabbit-stew": { ...w.recipeBook["rabbit-stew"], mastery: 100 } } };
    const a = planCook(low, "rabbit-stew", 10, null);
    const b = planCook(high, "rabbit-stew", 10, null);
    expect(b.timeDays).toBeLessThan(a.timeDays);
    expect(b.stamina).toBeLessThanOrEqual(a.stamina);
    expect(b.chanceModifier - a.chanceModifier).toBeCloseTo(0.06, 5);
    expect(b.timeDays / a.timeDays).toBeGreaterThan(0.8);
  });
});

describe("derivation", () => {
  it("history (not mastery alone) sparks an idea, which is not registered automatically", () => {
    let plain = rich();
    for (let i = 0; i < 3; i++) plain = cook(plain, "rabbit-stew", 2, 10 + i).world;
    expect(plain.recipeBook["rabbit-stew"].mastery).toBeGreaterThanOrEqual(25);
    expect(plain.derivationIdeas.find((d) => d.ruleId === "herb")).toBeUndefined();

    let w = rich();
    let last;
    for (let i = 0; i < 3; i++) {
      last = cook(w, "rabbit-stew", 2, 10 + i, HERB);
      w = last.world;
    }
    const idea = w.derivationIdeas.find((d) => d.id === "rabbit-stew:herb");
    expect(idea).toBeDefined();
    expect(last!.learning.newIdeas.map((i) => i.id)).toContain("rabbit-stew:herb");
    expect(w.customRecipes).toHaveLength(0);
    expect(nameSuggestions(w, idea!).length).toBeGreaterThanOrEqual(1);
    // dismissed ideas are not offered again
    const dismissed = dismissIdea(w, idea!.id);
    const again = cook(dismissed, "rabbit-stew", 2, 20, HERB).world;
    expect(again.derivationIdeas.find((d) => d.id === idea!.id)).toBeUndefined();
  });

  it("adopting creates a custom recipe with name / description / origin / parent, and it can be cooked", () => {
    let w = rich();
    for (let i = 0; i < 3; i++) w = cook(w, "rabbit-stew", 2, 30 + i, HERB).world;
    const adopted = adoptIdea(w, "rabbit-stew:herb", { name: "森の香り煮込み", description: "香草を効かせた煮込み", origin: "ハーブを添えたら評判だった" });
    if (typeof adopted === "string") throw new Error(adopted);
    const r = adopted.recipe;
    expect(r.custom).toBe(true);
    expect(r.parentRecipeIds).toEqual(["rabbit-stew"]);
    expect(r.description).toBe("香草を効かせた煮込み");
    expect(r.origin).toBe("ハーブを添えたら評判だった");
    expect(r.ingredients.find((l) => l.itemId === "herb")?.amount).toBeGreaterThan(0);
    const w2 = adopted.world;
    expect(recipeStatus(w2, r.id)).toBe("mastered");
    expect(w2.knownRecipes).toContain(r.id);
    expect(w2.derivationIdeas.find((d) => d.id === "rabbit-stew:herb")).toBeUndefined();
    expect(adoptIdea(w2, "rabbit-stew:herb", { name: "x", description: "", origin: "" })).toBe("着想が見つからない");

    const made = cook(w2, r.id, 3, 7);
    expect(made.dish.name).toBe("森の香り煮込み");
    expect(made.dish.recipeId).toBe(r.id);
    expect(made.world.recipeBook[r.id].timesCooked).toBe(1);

    // Phase 4 still works on a custom dish: eat it, battle with it.
    const fed = setFoodStory(made.world, { answers: Object.fromEntries(FOOD_STORY.map((q) => [q.id, q.options[0].id])), freeText: "" });
    expect(typeof eatAndTaste(fed, made.stock.id, made.dish)).not.toBe("string");
    expect(["player", "rival", "draw"]).toContain(runBattle(fed, BATTLE_MAP.tutorial, made.dish, 1).winner);

    // Phase 3 still works: sell it and end the day.
    const listed = { ...made.world, dishStock: made.world.dishStock.map((s) => ({ ...s, listed: true })) };
    const { report, world: next } = endDay(listed, 3);
    expect(report.listings.some((l) => l.name === "森の香り煮込み")).toBe(true);
    expect(next.customRecipes).toHaveLength(1);
  });

  it("names must be unique and non-empty", () => {
    let w = rich();
    for (let i = 0; i < 3; i++) w = cook(w, "rabbit-stew", 2, 40 + i, HERB).world;
    expect(adoptIdea(w, "rabbit-stew:herb", { name: "  ", description: "", origin: "" })).toBe("名前を入れてください");
    expect(adoptIdea(w, "rabbit-stew:herb", { name: "兎肉と野菜の煮込み", description: "", origin: "" })).toBe("同じ名前のレシピがある");
  });
});

describe("village sources", () => {
  it("every teacher and book is reachable on the map and teaches a real recipe with requirements", () => {
    const w = createWorld();
    for (const src of [...TEACHERS, ...BOOKS]) {
      expect(FACILITIES.some((f) => f.teacherId === src.id || f.bookId === src.id)).toBe(true);
      expect(getRecipe(w, src.recipeId)?.requirements?.length).toBeGreaterThan(0);
      expect(recipeStatus(w, src.recipeId)).toBe("unknown");
    }
  });
});
