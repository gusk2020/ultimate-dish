import { describe, expect, it } from "vitest";
import { LOCATION_MAP, REGIONS, REGION_MAP } from "../data/regions";
import { RECIPE_MAP } from "../data/recipes";
import type { Dish } from "../types";
import type { DishStock } from "../types/world";
import { buyShortage, finishCook, openFailures, planCook, startCook } from "./commerce/simpleCook";
import { endDay } from "./commerce/day";
import { eatAndTaste, setFoodStory } from "./eating/eat";
import { EMPTY_FINISH, reviewFinish } from "./finish/finish";
import { ageInventory } from "./inventory/inventory";
import { recipeStatus } from "./learning/recipeBook";
import { foundingStatus } from "./school/founding";
import { inviteAlly } from "./social/allies";
import { chooseCompanion, declineCompanion, generateCandidates } from "./social/companion";
import { adjustRelation, getRelation, PLAYER } from "./social/relations";
import { localPrice, marketEntry } from "./travel/market";
import {
  cuisineLine, destinations, findRoute, isUnlocked, learnRegionalRecipe, planTravel, provisionPlan, travel, travelCompanions,
} from "./travel/travel";
import { buy, createWorld, type World } from "./world";

const rich = (): World => ({ ...createWorld(), chef: { ...createWorld().chef, money: 5000 } });

/** Travels and fails the test loudly if it cannot. Seed 1 is not a rainy day. */
function go(w: World, to: string, companions: string[] = [], seed = 1) {
  const r = travel(w, planTravel(w, to, companions), seed);
  if (typeof r === "string") throw new Error(r);
  return r;
}

function cook(w: World, recipeId: string, seed = 1, portions = 2) {
  let world = w;
  const b = buyShortage(world, planCook(world, recipeId, portions, null));
  if (typeof b !== "string") world = b;
  const st = startCook(world, planCook(world, recipeId, portions, null), seed);
  if (typeof st === "string") throw new Error(st);
  const review = reviewFinish(EMPTY_FINISH);
  const out = finishCook(st.world, st.session, review.normalized, review);
  return { ...out, session: st.session, dish: { ...out.dish, description: "", image: { kind: "placeholder" as const, emoji: "", colors: ["", ""] as [string, string] } } as Dish };
}

function cookClean(w: World, recipeId: string) {
  for (let seed = 1; seed < 300; seed++) {
    const r = cook(w, recipeId, seed);
    if (openFailures(r.session).length === 0 && r.dish.rank !== "D") return r;
  }
  throw new Error("no clean seed");
}

describe("the map", () => {
  it("starts in the village; only the market town is open at first", () => {
    const w = createWorld();
    expect(w.travel.currentLocationId).toBe("village");
    expect(w.travel.visitedLocationIds).toEqual(["village"]);
    const d = Object.fromEntries(destinations(w).map((x) => [x.loc.id, x]));
    expect(d.rivertown.unlocked).toBe(true);
    expect(d.rivertown.route).toEqual({ path: ["village", "rivertown"], days: 1.5 });
    expect(d.harbor.unlocked).toBe(false);
    expect(d.highland.unlocked).toBe(false);
    expect(findRoute(w, "village", "harbor")).toBeNull();
    expect(planTravel(w, "harbor", []).problems.join()).toContain("川沿いの市場町");
  });

  it("reaching the market town opens the harbour and the highlands, in either order", () => {
    const a = go(rich(), "rivertown").world;
    expect(isUnlocked(a, "harbor")).toBe(true);
    expect(isUnlocked(a, "highland")).toBe(true);
    // harbour first, then the highlands through the market town
    const h = go(a, "harbor").world;
    expect(findRoute(h, "harbor", "highland")).toEqual({ path: ["harbor", "rivertown", "highland"], days: 4.5 });
    const both1 = go(h, "highland");
    expect(both1.log.via).toEqual(["rivertown"]);
    expect(both1.world.travel.visitedLocationIds.sort()).toEqual(["harbor", "highland", "rivertown", "village"]);
    // the other order works just as well
    const both2 = go(go(a, "highland").world, "harbor").world;
    expect(both2.travel.currentLocationId).toBe("harbor");
    // the graph is data, not coordinates
    expect(LOCATION_MAP.rivertown.connections.map((c) => c.to).sort()).toEqual(["harbor", "highland", "village"]);
  });
});

describe("the road", () => {
  it("advances time with the existing rules: the inventory ages exactly as it would at home", () => {
    const w = rich();
    const r = go(w, "rivertown");
    expect(r.world.day).toBeCloseTo(w.day + r.log.days, 6);
    expect(r.world.inventory).toEqual(ageInventory(w.inventory, r.log.days));
    expect(r.freshness.some((f) => f.itemId === "milk")).toBe(true); // milk on the room-temperature shelf suffers on the road
    expect(r.freshness.find((f) => f.itemId === "rabbit")).toBeUndefined(); // the icehouse keeps meat (existing rule)
    expect(r.freshness.find((f) => f.itemId === "salt")).toBeUndefined();
    expect(r.world.travel.travelLog[0]).toMatchObject({ from: "village", to: "rivertown", days: 1.5, companions: [] });
  });

  it("takes road rations from preserved dishes first and buys the rest automatically", () => {
    const base = rich();
    const none = provisionPlan(base, 1.5, 2);
    expect(none).toMatchObject({ needed: 3, fromStockTotal: 0, toBuy: 3, bought: 3, hungry: 0 });
    expect(none.cost).toBeCloseTo(3 * none.unitPrice, 6);

    const jerky: DishStock = {
      id: "s-jerky", dishId: "d", recipeId: "archive-dried-boar", name: "干し肉", tags: ["preserved"], portions: 2, total: 60,
      nutrition: 60, unitCost: 2, madeDay: 0, freshness: 1, price: 0, listed: false, discounted: false,
    };
    const w = { ...base, dishStock: [jerky] };
    const r = go(w, "rivertown");
    expect(r.log).toMatchObject({ mealsNeeded: 2, mealsFromStock: 2, mealsBought: 0, foodCost: 0 });
    expect(r.world.dishStock.find((s) => s.id === "s-jerky")).toBeUndefined();

    // No money and no food: still goes, just hungry.
    const broke = { ...createWorld(), chef: { ...createWorld().chef, money: 0 } };
    const b = go(broke, "rivertown");
    expect(b.log.hungryMeals).toBe(2);
    expect(b.world.travel.currentLocationId).toBe("rivertown");
  });

  it("companions share the road: traveledTogether grows, trust only by a hair", () => {
    let w = setFoodStory(rich(), { answers: { childhood: "game" }, freeText: "" });
    w = chooseCompanion(w, generateCandidates(w, { personality: { pace: -0.7, talk: -0.7, mind: -0.7, venture: -0.7 }, lean: "maker" })[0]);
    const cid = w.social.companion!.id;
    w = adjustRelation(w, PLAYER, "mira", { affection: 30 });
    w = { ...w, social: { ...w.social, party: [] } };
    const joined = inviteAlly({ ...w, battleLog: [] }, "mira");
    expect(typeof joined).toBe("string"); // Mira's own conditions are not met: not in the party
    expect(travelCompanions(w)).toEqual([cid]);
    expect(planTravel(w, "rivertown", ["mira"]).problems).toContain("同行できない人がいる");

    const before = getRelation(w, PLAYER, cid)!;
    const r = go(w, "rivertown", [cid]);
    const after = getRelation(r.world, PLAYER, cid)!;
    expect(after.traveledTogether).toBe(before.traveledTogether + 1);
    expect(after.trust - before.trust).toBeLessThanOrEqual(1);
    expect(after.affection).toBe(before.affection);
    expect(r.log.companions).toEqual([cid]);
    expect(r.log.mealsNeeded).toBe(Math.ceil(1.5 * 2));
  });

  it("works with no companion and no one along", () => {
    const w = declineCompanion(rich());
    expect(travelCompanions(w)).toEqual([]);
    const r = go(w, "rivertown");
    expect(r.world.travel.currentLocationId).toBe("rivertown");
    expect(Object.keys(r.world.social.relations)).toHaveLength(0);
  });
});

describe("regional markets", () => {
  it("each place sells different things, and the same thing at different prices", () => {
    const village = rich();
    const river = go(village, "rivertown").world;
    const harbor = go(river, "harbor").world;
    const high = go(harbor, "highland").world;
    // availability
    expect(marketEntry(village, "seafish").kind).toBe("none");
    expect(marketEntry(river, "seafish").kind).toBe("none");
    expect(marketEntry(harbor, "seafish").kind).toBe("local");
    expect(marketEntry(high, "goatmilk").kind).toBe("local");
    expect(marketEntry(harbor, "goatmilk").kind).toBe("none");
    expect(marketEntry(village, "noodles").kind).toBe("imported");
    // the village keeps its old fixed prices
    expect(localPrice(village, "fish")).toBe(4);
    expect(localPrice(village, "salt")).toBe(1);
    // same item, different price
    const fish = [village, river, harbor].map((w) => localPrice(w, "fish"));
    expect(new Set(fish).size).toBe(3);
    expect(localPrice(river, "fish")!).toBeLessThan(localPrice(village, "fish")!);
    expect(localPrice(harbor, "fish")!).toBeGreaterThan(localPrice(village, "fish")!);
    // buying follows the local market
    expect(buy(village, "seafish", 1, "icehouse")).toContain("売っていない");
    const bought = buy(harbor, "seafish", 1, "icehouse");
    if (typeof bought === "string") throw new Error(bought);
    expect(harbor.chef.money - bought.chef.money).toBeCloseTo(localPrice(harbor, "seafish")!, 6);
    // a recipe whose ingredient is not sold here says so instead of failing later
    expect(planCook(high, "river-grilled-fish", 2, null).problems.join()).toContain("この土地の市場にない");
  });

  it("every region has its dishes, cuisine profile and methods", () => {
    for (const r of REGIONS) {
      expect(r.specialtyRecipeIds.length).toBeGreaterThanOrEqual(2);
      if (r.id !== "home") for (const id of r.specialtyRecipeIds) expect(RECIPE_MAP[id].originRegionId).toBe(r.id);
      expect(cuisineLine(r.cuisine)).toMatch(/^この土地では.+を重んじる$/);
    }
    expect(cuisineLine(REGION_MAP.coast.cuisine)).toContain("塩");
    expect(cuisineLine(REGION_MAP.mountain.cuisine)).toContain("保存");
  });
});

describe("regional dishes", () => {
  it("learned on location, then tried and mastered (Phase 5 recipe book)", () => {
    const village = rich();
    expect(learnRegionalRecipe(village, "river-grilled-fish")).toBe("この土地の料理ではない");
    let w = go(village, "rivertown").world;
    expect(recipeStatus(w, "river-grilled-fish")).toBe("unknown");
    const learned = learnRegionalRecipe(w, "river-grilled-fish");
    if (typeof learned === "string") throw new Error(learned);
    w = learned.world;
    expect(w.recipeBook["river-grilled-fish"].source).toBe("region");
    expect(recipeStatus(w, "river-grilled-fish")).toBe("trialAvailable");
    expect(w.travel.regionKnowledge.river.cultureExperience).toBe(1);
    const r = cookClean(w, "river-grilled-fish");
    expect(r.learning.mastered).toBe(true);
    expect(recipeStatus(r.world, "river-grilled-fish")).toBe("mastered");
    // a harder dish of the same town is known but waits for its requirements
    const harder = learnRegionalRecipe(w, "river-vinegar-fish");
    if (typeof harder === "string") throw new Error(harder);
    expect(recipeStatus(harder.world, "river-vinegar-fish")).toBe("known");
  });
});

describe("founding a school (conditions only)", () => {
  it("is false at first and true once every condition holds; each condition really counts", () => {
    expect(foundingStatus(createWorld()).ready).toBe(false);
    expect(foundingStatus(createWorld()).checks.every((c) => !c.ok)).toBe(true);

    let w = go(rich(), "rivertown").world;
    const l1 = learnRegionalRecipe(w, "river-grilled-fish");
    if (typeof l1 === "string") throw new Error(l1);
    w = cookClean(l1.world, "river-grilled-fish").world;
    w = go(w, "harbor").world;
    const l2 = learnRegionalRecipe(w, "coast-dried-fish");
    if (typeof l2 === "string") throw new Error(l2);
    w = cookClean(l2.world, "coast-dried-fish").world;
    const s1 = foundingStatus(w);
    expect(s1.checks.find((c) => c.id === "regions")!.ok).toBe(true);
    expect(s1.checks.find((c) => c.id === "regionalDishes")!.ok).toBe(true);
    expect(s1.ready).toBe(false);

    const custom = { ...RECIPE_MAP["rabbit-stew"], id: "custom-x", name: "森の香草煮込み", custom: true, parentRecipeIds: ["rabbit-stew"] };
    w = { ...w, customRecipes: [custom], chef: { ...w.chef, records: { ...w.chef.records, dishesCooked: 10 } } };
    w = adjustRelation(w, PLAYER, "teo", { cookedTogether: 1 });
    expect(foundingStatus(w).ready).toBe(true);

    // derived recipe and cooking together are genuinely referenced
    expect(foundingStatus({ ...w, customRecipes: [] }).ready).toBe(false);
    expect(foundingStatus({ ...w, customRecipes: [] }).checks.find((c) => c.id === "derived")!.ok).toBe(false);
    const apart = adjustRelation(w, PLAYER, "teo", { cookedTogether: -1 });
    expect(foundingStatus(apart).checks.find((c) => c.id === "together")!.ok).toBe(false);
    expect(foundingStatus({ ...w, chef: { ...w.chef, records: { ...w.chef.records, dishesCooked: 9 } } }).ready).toBe(false);
  });
});

describe("stamina hint", () => {
  it("maxPortionsByStamina matches the stamina cost including mastery and helpers", () => {
    let w = setFoodStory(rich(), { answers: {}, freeText: "" });
    w = chooseCompanion(w, generateCandidates(w, { personality: { pace: 0.7, talk: 0.7, mind: 0.7, venture: 0.7 }, lean: "maker" })[1]);
    const team = { mainId: PLAYER, assistantIds: [w.social.companion!.id] };
    for (const t of [undefined, team]) {
      const p = planCook(w, "rabbit-stew", 1, null, t);
      const at = (n: number) => planCook(w, "rabbit-stew", n, null, t).stamina;
      expect(at(p.maxPortionsByStamina)).toBeLessThanOrEqual(w.chef.stamina);
      expect(at(p.maxPortionsByStamina + 1)).toBeGreaterThan(w.chef.stamina);
    }
  });
});

describe("earlier phases keep working away from home", () => {
  it("cooking, eating, selling and ending the day after a journey", () => {
    let w = setFoodStory(rich(), { answers: {}, freeText: "" });
    w = go(w, "rivertown").world;
    const made = cook(w, "rabbit-stew", 3);
    const ate = eatAndTaste(made.world, made.stock.id, made.dish);
    expect(typeof ate).not.toBe("string");
    const next = endDay({ ...made.world, dishStock: made.world.dishStock.map((s) => ({ ...s, listed: true })) }, 2);
    expect(next.world.day).toBeGreaterThan(made.world.day);
    expect(next.world.travel.currentLocationId).toBe("rivertown");
  });
});
