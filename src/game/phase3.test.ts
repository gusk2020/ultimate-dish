import { describe, expect, it } from "vitest";
import { RECIPES, STARTING_RECIPES } from "../data/recipes";
import { SHOP_MAP } from "../data/commerce";
import type { Dish } from "../types";
import type { DishStock } from "../types/world";
import { createDefaultChef, maxStamina, staminaPenalty } from "./chef/stats";
import { batchScale, buyShortage, finishCook, planCook, recoverOnce, startCook, eatPortion, openFailures } from "./commerce/simpleCook";
import { expectedDemand, marketFor, priceFactor, recommendedPrice, segmentAppeal, sellListing } from "./commerce/sales";
import { canContract, contractDay, signContract } from "./commerce/contracts";
import { discountStock, endDay } from "./commerce/day";
import { EMPTY_FINISH, reviewFinish } from "./finish/finish";
import { createWorld, type World } from "./world";

const stock = (over: Partial<DishStock> = {}): DishStock => ({
  id: "s1", dishId: "d1", recipeId: "rabbit-stew", name: "テスト煮込み", tags: ["deli", "staple", "family"],
  portions: 10, total: 60, nutrition: 60, unitCost: 3, madeDay: 0, freshness: 1, price: 0, listed: true, discounted: false,
  ...over,
});

function richWorld(): World {
  const w = createWorld();
  return { ...w, chef: { ...w.chef, money: 1000 } };
}

function cookAndFinish(w: World, recipeId: string, portions: number, seed = 1) {
  let world = w;
  const plan0 = planCook(world, recipeId, portions, null);
  if (plan0.shortCost > 0) {
    const r = buyShortage(world, plan0);
    if (typeof r === "string") throw new Error(r);
    world = r;
  }
  const started = startCook(world, planCook(world, recipeId, portions, null), seed);
  if (typeof started === "string") throw new Error(started);
  const review = reviewFinish(EMPTY_FINISH);
  return { ...finishCook(started.world, started.session, EMPTY_FINISH, review), session: started.session, afterStart: started.world };
}

describe("stamina", () => {
  it("max stamina grows with strength and level, bounded", () => {
    const c = createDefaultChef();
    expect(c.stamina).toBe(maxStamina(c));
    expect(maxStamina({ ...c, stats: { ...c.stats, strength: 15 } })).toBeGreaterThan(maxStamina(c));
    expect(maxStamina({ ...c, level: 50 })).toBeGreaterThan(maxStamina(c));
    expect(maxStamina({ ...c, level: 9999, stats: { ...c.stats, strength: 9999 } })).toBeLessThan(300);
  });

  it("cooking spends stamina; low stamina lowers success and slows work but never blocks", () => {
    const w = richWorld();
    const { afterStart } = cookAndFinish(w, "bean-wheat-soup", 2);
    expect(afterStart.chef.stamina).toBeLessThan(w.chef.stamina);
    const tired = { ...w, chef: { ...w.chef, stamina: 0 } };
    const pen = staminaPenalty(tired.chef);
    expect(pen.chance).toBeLessThan(0);
    expect(pen.timeMult).toBeGreaterThan(1);
    const fresh = planCook(w, "bean-wheat-soup", 1, null);
    const weary = planCook(tired, "bean-wheat-soup", 1, null);
    expect(weary.timeDays).toBeGreaterThan(fresh.timeDays);
    expect(weary.chanceModifier).toBeLessThan(fresh.chanceModifier);
    expect(weary.problems).not.toContain(expect.stringContaining("体力"));
  });
});

describe("batch cooking", () => {
  it("time / stamina / magic grow sub-linearly, worse for hard dishes", () => {
    for (const kind of ["time", "stamina", "magic"] as const) {
      expect(batchScale(1, 2, kind)).toBe(1);
      expect(batchScale(10, 2, kind)).toBeLessThan(10);
      expect(batchScale(10, 2, kind)).toBeGreaterThan(batchScale(5, 2, kind));
      expect(batchScale(10, 5, kind)).toBeGreaterThan(batchScale(10, 1, kind));
    }
    expect(batchScale(2, 1)).toBeCloseTo(1.6, 1);
    expect(batchScale(10, 1)).toBeGreaterThan(4);
    expect(batchScale(10, 1)).toBeLessThan(5.5);
  });

  it("10 portions cost far less than 10x one portion", () => {
    const w = richWorld();
    const one = planCook(w, "rabbit-stew", 1, "stone");
    const ten = planCook(w, "rabbit-stew", 10, "stone");
    expect(ten.timeDays).toBeLessThan(one.timeDays * 10);
    expect(ten.stamina).toBeLessThan(one.stamina * 10);
    expect(ten.mp).toBeLessThan(one.mp * 10);
    expect(ten.lines[0].need).toBeCloseTo(one.lines[0].need * 10);
  });

  it("a hard dish in bulk at Lv1 overdraws stamina and gets much riskier (but is not blocked)", () => {
    const w = richWorld();
    const few = planCook(w, "boar-herb-roast", 5, null);
    const lots = planCook(w, "boar-herb-roast", 40, null);
    expect(lots.stamina).toBeGreaterThan(w.chef.stamina);
    expect(lots.chanceModifier).toBeLessThan(few.chanceModifier - 0.1);
    expect(lots.problems.join()).not.toContain("体力");
  });
});

describe("shortage and bulk buy", () => {
  it("lists need / have / short and buys only the shortage", () => {
    const w = richWorld();
    const plan = planCook(w, "rabbit-stew", 10, null);
    const rabbit = plan.lines.find((l) => l.itemId === "rabbit")!;
    expect(rabbit.need).toBe(5);
    expect(rabbit.short).toBe(rabbit.need - rabbit.have);
    expect(plan.shortCost).toBeGreaterThan(0);
    const bought = buyShortage(w, plan);
    if (typeof bought === "string") throw new Error(bought);
    expect(bought.chef.money).toBe(w.chef.money - plan.shortCost);
    expect(planCook(bought, "rabbit-stew", 10, null).lines.every((l) => l.short === 0)).toBe(true);
  });

  it("refuses when money is short", () => {
    const w = createWorld();
    const poor = { ...w, chef: { ...w.chef, money: 1 } };
    expect(typeof buyShortage(poor, planCook(poor, "rabbit-stew", 10, null))).toBe("string");
  });
});

describe("simple cooking", () => {
  it("starts with 3 known recipes of the starting school", () => {
    expect(createWorld().knownRecipes).toEqual(STARTING_RECIPES);
    expect(STARTING_RECIPES).toHaveLength(3);
    for (const r of RECIPES) expect(r.steps.length).toBeGreaterThanOrEqual(1);
  });

  it("judges 2-4 visible steps, reproducible by seed, and produces stock + 8 axes", () => {
    const a = cookAndFinish(richWorld(), "rabbit-stew", 5, 42);
    const b = cookAndFinish(richWorld(), "rabbit-stew", 5, 42);
    const visible = Object.keys(a.session.labels).length;
    expect(visible).toBeGreaterThanOrEqual(2);
    expect(visible).toBeLessThanOrEqual(5);
    expect(b.session.result.outcomes).toEqual(a.session.result.outcomes);
    expect(Object.values(a.dish.scores).every((v) => Number.isFinite(v))).toBe(true);
    expect(a.stock.portions).toBe(5);
    expect(a.world.dishStock).toHaveLength(1);
    expect(a.dish.name).toBe("兎肉と野菜の煮込み");
  });

  it("failures happen across seeds, and recovery repairs without changing earlier outcomes", () => {
    let found = null;
    for (let seed = 0; seed < 300 && !found; seed++) {
      const w = richWorld();
      const plan = planCook(w, "boar-herb-roast", 1, null);
      const st = startCook(w, plan, seed);
      if (typeof st !== "string" && openFailures(st.session).length) found = st;
    }
    expect(found).not.toBeNull();
    const r = recoverOnce(found!.world, found!.session);
    if (typeof r === "string") throw new Error(r);
    expect(r.session.result.outcomes.slice(0, found!.session.steps.length)).toEqual(found!.session.result.outcomes);
    expect(r.world.chef.stamina).toBeLessThan(found!.world.chef.stamina);
  });

  it("eating a portion restores stamina", () => {
    const { world, stock: s } = cookAndFinish(richWorld(), "bean-wheat-soup", 2);
    const tired = { ...world, chef: { ...world.chef, stamina: 5 } };
    const fed = eatPortion(tired, s.id);
    if (typeof fed === "string") throw new Error(fed);
    expect(fed.chef.stamina).toBeGreaterThan(5);
    expect(fed.dishStock[0].portions).toBe(1);
  });
});

describe("sales demand", () => {
  const m = marketFor({ village: 5 }, {}, 1);

  it("higher price lowers demand; extreme price collapses it", () => {
    const s = stock();
    const rec = recommendedPrice(s);
    const sum = (p: number) => expectedDemand(s, p, m).reduce((a, d) => a + d.expected, 0);
    expect(sum(rec * 0.7)).toBeGreaterThan(sum(rec));
    expect(sum(rec)).toBeGreaterThan(sum(rec * 1.5));
    expect(priceFactor(2.5, 1)).toBeLessThan(priceFactor(1.9, 1) * 0.5);
  });

  it("time slots differ by tag", () => {
    const soup = expectedDemand(stock({ tags: ["soup", "light"] }), 15, m);
    const meat = expectedDemand(stock({ tags: ["meat", "snack"] }), 15, m);
    expect(soup[0].expected / soup[2].expected).toBeGreaterThan(meat[0].expected / meat[2].expected);
  });

  it("segment affinity: wealthy care about quality, workers about price", () => {
    const fancy = stock({ tags: ["luxury"], total: 85 });
    expect(segmentAppeal("wealthy", fancy, 1.5)).toBeGreaterThan(segmentAppeal("worker", fancy, 1.5));
    const cheap = stock({ tags: ["staple"], total: 50 });
    expect(segmentAppeal("worker", cheap, 0.8)).toBeGreaterThan(segmentAppeal("wealthy", cheap, 0.8));
  });

  it("sales are seeded, split into 3 slots, and can leave leftovers", () => {
    const r1 = sellListing(stock({ portions: 40 }), m, 7);
    const r2 = sellListing(stock({ portions: 40 }), m, 7);
    expect(r1).toEqual(r2);
    expect(r1.slots).toHaveLength(3);
    expect(r1.leftover).toBeGreaterThan(0);
    expect(r1.sold + r1.leftover).toBe(40);
    expect(r1.revenue).toBe(r1.sold * r1.price);
  });
});

describe("day end", () => {
  it("deli sales: revenue minus material cost; leftovers carry over and lose freshness", () => {
    const { world } = cookAndFinish(richWorld(), "rabbit-stew", 10, 3);
    const listed = { ...world, dishStock: world.dishStock.map((s) => ({ ...s, listed: true })) };
    const { world: next, report } = endDay(listed, 99);
    expect(report.salesRevenue).toBeGreaterThan(0);
    expect(report.materialCost).toBeGreaterThan(0);
    expect(report.profit).toBe(Math.round(report.salesRevenue + report.contractIncome - report.materialCost - report.upkeep));
    expect(next.chef.money).toBeCloseTo(listed.chef.money + report.salesRevenue + report.contractIncome - report.upkeep, 0);
    const sold = report.listings[0].sold;
    if (sold < 10) {
      expect(next.dishStock[0].portions).toBe(10 - sold);
      expect(next.dishStock[0].freshness).toBeLessThan(1);
      expect(report.leftovers).toHaveLength(1);
    }
    expect(Math.floor(next.day)).toBe(Math.floor(listed.day) + 1);
    expect(next.ledger.materialCost).toBe(0);
    const d = discountStock(next, next.dishStock[0]?.id ?? "");
    if (d.dishStock[0]) expect(d.dishStock[0].discounted).toBe(true);
  });

  it("sleep restores stamina and MP; inventory ages overnight", () => {
    const w = createWorld();
    const tired = { ...w, chef: { ...w.chef, stamina: 5, mp: 0 } };
    let world = tired;
    let report;
    for (let i = 0; i < 3; i++) ({ world, report } = endDay(world, i));
    expect(world.chef.stamina).toBeGreaterThan(5);
    expect(world.chef.mp).toBeGreaterThan(0);
    expect(world.inventory.some((s) => s.state !== "fresh")).toBe(true);
    expect(report!.stamina.after).toBeGreaterThanOrEqual(report!.stamina.before);
  });

  it("recipe contract: no material risk, income each day, expires", () => {
    const w = richWorld();
    const dish = { id: "d1", name: "名物煮込み", total: 62 } as Dish;
    const shop = SHOP_MAP.diner;
    expect(canContract(w, SHOP_MAP.fine, dish).ok).toBe(false); // needs 65
    const signed = signContract(w, shop, dish);
    if (typeof signed === "string") throw new Error(signed);
    expect(signed.contracts).toHaveLength(1);
    expect(signContract(signed, shop, dish)).toBe("契約中");
    const day = contractDay(signed.contracts[0], 1);
    expect(day.income).toBeGreaterThanOrEqual(0);
    let world = signed;
    let income = 0;
    for (let i = 0; i < shop.days; i++) {
      const r = endDay(world, i);
      income += r.report.contractIncome;
      expect(r.report.materialCost).toBe(0);
      world = r.world;
    }
    expect(income).toBeGreaterThan(0);
    expect(world.contracts).toHaveLength(0);
  });

  it("report aggregates slots and money", () => {
    const w = { ...richWorld(), dishStock: [stock({ portions: 12 }), stock({ id: "s2", tags: ["soup", "light"], portions: 6 })] };
    const { report } = endDay(w, 5);
    const slotSold = Object.values(report.slotTotals).reduce((a, s) => a + s.sold, 0);
    expect(slotSold).toBe(report.listings.reduce((a, l) => a + l.sold, 0));
    expect(Object.values(report.slotTotals).reduce((a, s) => a + s.revenue, 0)).toBe(report.salesRevenue);
    expect(report.day).toBe(1);
    expect(report.fame.after).toBeGreaterThanOrEqual(report.fame.before);
  });
});
