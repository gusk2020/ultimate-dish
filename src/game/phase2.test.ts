import { describe, expect, it } from "vitest";
import type { ProcessStep } from "../types/world";
import { initialInventory, newStack } from "../data/items";
import { initialTools, SCHOOLS } from "../data/phase2";
import { checkAllocation, createDefaultChef, eff, ingredientCapacity, maxMP, maxSteps } from "./chef/stats";
import { gainXp, xpToNext } from "./chef/leveling";
import { ageStack, consume } from "./inventory/inventory";
import { rollGrade, simulateProcess, type ProcessContext } from "./process/simulate";
import { buildProcessDish, parseProcessKey, toProcessKey } from "./process/buildProcessDish";
import { reviewFinish, EMPTY_FINISH } from "./finish/finish";
import { canFuse, findSchool, fuseSchools, switchSchool } from "./school/school";
import { completeCooking, type World } from "./world";

const add = (line: number, itemId: string, amount = 1): ProcessStep => ({ kind: "add", line, itemId, amount });
const method = (line: number, methodId: string): ProcessStep => ({ kind: "method", line, methodId });
const tool = (line: number, toolId: string): ProcessStep => ({ kind: "tool", line, toolId });

function ctx(over: Partial<ProcessContext> = {}): ProcessContext {
  return {
    chef: createDefaultChef(),
    school: findSchool("village"),
    inventory: initialInventory(),
    tools: initialTools(),
    seed: 12345,
    ...over,
  };
}

const MEAT_AND_SAUCE: ProcessStep[] = [
  add(0, "rabbit"), method(0, "cut"), add(0, "salt", 0.5), method(0, "grill"),
  add(1, "onion"), method(1, "saute"), add(1, "honey", 0.5), add(1, "vinegar", 0.5), method(1, "reduce"),
  { kind: "merge", line: 0, from: 1 }, { kind: "finish", line: 0 },
];

describe("chef stats", () => {
  it("initial allocation: base 5 + 25 free, max 15, lowering refunds half", () => {
    const c = createDefaultChef();
    expect(checkAllocation(c.stats)).toMatchObject({ ok: true, remaining: 0 });
    // luck 5 → 1 frees 4 → +2 points elsewhere
    expect(checkAllocation({ ...c.stats, luck: 1, tech: 14 }).ok).toBe(true);
    expect(checkAllocation({ ...c.stats, luck: 1, tech: 15 }).ok).toBe(false);
    expect(checkAllocation({ ...c.stats, tech: 16, luck: 4 }).errors.join()).toContain("最大15");
    expect(checkAllocation({ ...c.stats, luck: 0 }).ok).toBe(false);
  });

  it("effects saturate: Lv/stat 9999 stays bounded", () => {
    const c = createDefaultChef();
    const huge = { ...c, level: 9999, stats: { tech: 9999, knowledge: 9999, luck: 9999, magic: 9999, strength: 9999 } };
    expect(eff(9999)).toBeLessThan(1);
    expect(maxSteps(huge)).toBeLessThanOrEqual(20);
    expect(ingredientCapacity(huge)).toBeLessThanOrEqual(16);
    expect(Number.isFinite(maxMP(huge))).toBe(true);
    const r = simulateProcess([add(0, "rabbit"), method(0, "grill")], ctx({ chef: huge }));
    expect(r.outcomes[1].chance).toBeLessThanOrEqual(0.97);
  });

  it("xp curve gets steeper and walls before milestones", () => {
    expect(xpToNext(2)).toBeGreaterThan(xpToNext(1));
    expect(xpToNext(9)).toBeGreaterThan(xpToNext(10)); // the wall into Lv10
    const { chef, levelUps } = gainXp(createDefaultChef(), 500, 1);
    expect(chef.level).toBeGreaterThan(1);
    expect(levelUps.length).toBe(chef.level - 1);
  });
});

describe("capacity and step limit", () => {
  it("weights: normal 1.0, seasoning 0.5, herb 0.2", () => {
    const r = simulateProcess([add(0, "rabbit"), add(0, "salt"), add(0, "herb")], ctx());
    expect(r.capacityUsed).toBeCloseTo(1.7);
    expect(ingredientCapacity(createDefaultChef())).toBeGreaterThanOrEqual(6);
  });

  it("over capacity is an error", () => {
    const steps = ["rabbit", "boar", "onion", "cabbage", "beans", "wheat", "apple", "egg"].map((id) => add(0, id));
    expect(simulateProcess(steps, ctx()).errors.join()).toContain("食材容量");
  });

  it("step limit comes from strength", () => {
    const weak = { ...createDefaultChef(), stats: { tech: 15, knowledge: 15, luck: 5, magic: 5, strength: 5 } };
    const limit = maxSteps(weak);
    const steps = [add(0, "onion"), ...Array.from({ length: limit + 1 }, () => method(0, "cut"))];
    expect(simulateProcess(steps, ctx({ chef: weak })).errors.join()).toContain("工程数");
    expect(simulateProcess(steps.slice(0, limit + 1), ctx({ chef: weak })).errors).toEqual([]);
  });

  it("forbids impossible order only", () => {
    expect(simulateProcess([method(0, "cut")], ctx()).errors.length).toBe(1);
    expect(simulateProcess([add(0, "onion"), method(3, "grill")], ctx()).errors.length).toBe(1);
    // odd but possible: frying without fat just gets a worse chance
    const odd = simulateProcess([add(0, "cabbage"), method(0, "fry")], ctx());
    expect(odd.errors).toEqual([]);
    expect(odd.outcomes[1].note).toContain("油なし");
  });
});

describe("step judgement and cooking seed", () => {
  it("rollGrade maps rolls to grades", () => {
    expect(rollGrade(0.8, 0.5, 0.5, 5).grade).toBe("success");
    expect(rollGrade(0.8, 0.5, 0.0, 5).grade).toBe("miracle");
    expect(rollGrade(0.8, 0.9, 0.5, 5).grade).toBe("fail");
    expect(rollGrade(0.8, 0.9, 0.01, 5).grade).toBe("criticalFail");
  });

  it("technique raises success chance", () => {
    const low = { ...createDefaultChef(), stats: { tech: 1, knowledge: 1, luck: 5, magic: 5, strength: 5 } };
    const steps = [add(0, "rabbit"), method(0, "grill")];
    const a = simulateProcess(steps, ctx({ chef: low })).outcomes[1].chance;
    const b = simulateProcess(steps, ctx()).outcomes[1].chance;
    expect(b).toBeGreaterThan(a);
  });

  it("same seed reproduces; appended steps keep earlier outcomes", () => {
    const a = simulateProcess(MEAT_AND_SAUCE, ctx({ seed: 99 }));
    const b = simulateProcess(MEAT_AND_SAUCE, ctx({ seed: 99 }));
    expect(b.outcomes).toEqual(a.outcomes);
    const longer = simulateProcess([...MEAT_AND_SAUCE, { kind: "recover", line: 0, recoverId: "reheat" }], ctx({ seed: 99 }));
    expect(longer.outcomes.slice(0, MEAT_AND_SAUCE.length)).toEqual(a.outcomes);
    const grades = new Set<string>();
    for (let s = 0; s < 60; s++) simulateProcess(MEAT_AND_SAUCE, ctx({ seed: s })).outcomes.forEach((o) => grades.add(o.grade));
    expect(grades.has("fail") || grades.has("criticalFail")).toBe(true);
  });

  it("a recovery step repairs a matching failure", () => {
    let seed = 0;
    let r;
    do {
      r = simulateProcess([add(0, "rabbit"), method(0, "boil")], ctx({ seed: ++seed }));
    } while (r.outcomes[1].failure !== "火入れ失敗" && seed < 500);
    expect(r.outcomes[1].failure).toBe("火入れ失敗");
    const withRecovery = simulateProcess(
      [add(0, "rabbit"), method(0, "boil"), { kind: "recover", line: 0, recoverId: "reheat" }],
      ctx({ seed }),
    );
    const rec = withRecovery.outcomes[2];
    expect(rec.note === "火入れ失敗を挽回" || rec.failure === "挽回失敗").toBe(true);
  });
});

describe("lines, merge and parallel time", () => {
  it("parallel lines take the longer line's time, not the sum", () => {
    const r = simulateProcess(MEAT_AND_SAUCE, ctx());
    const meat = simulateProcess(MEAT_AND_SAUCE.slice(0, 4), ctx());
    const sauceOnly = simulateProcess(MEAT_AND_SAUCE.slice(4, 9).map((s) => ({ ...s, line: 0 })) as ProcessStep[], ctx());
    expect(r.totalDays).toBeLessThan(meat.totalDays + sauceOnly.totalDays);
    expect(r.totalDays).toBeGreaterThanOrEqual(Math.max(meat.totalDays, sauceOnly.totalDays));
  });

  it("merge keeps source shares and ingredients", () => {
    const r = simulateProcess(MEAT_AND_SAUCE, ctx());
    expect(r.errors).toEqual([]);
    expect(r.openLines).toEqual([0]);
    const final = r.lines.find((l) => l.line === 0)!;
    expect(final.history).toHaveLength(2);
    expect(final.history[0].ratio + final.history[1].ratio).toBeCloseTo(1);
    expect(Object.keys(final.ingredients)).toEqual(expect.arrayContaining(["rabbit", "onion", "honey", "vinegar"]));
    expect(r.lines.find((l) => l.line === 1)!.mergedInto).toBe(0);
  });
});

describe("magic tools and MP", () => {
  it("stone costs 2 MP and shortens heating; jar pays per day saved", () => {
    const plain = simulateProcess([add(0, "rabbit"), method(0, "grill")], ctx());
    const stone = simulateProcess([add(0, "rabbit"), tool(0, "stone"), method(0, "grill")], ctx());
    expect(stone.mpCost).toBe(2);
    expect(stone.outcomes[2].timeDays).toBeLessThan(plain.outcomes[1].timeDays);
    expect(stone.outcomes[2].chance).toBeGreaterThanOrEqual(0.75);
    const jar = simulateProcess([add(0, "cabbage"), tool(0, "jar"), method(0, "ferment")], ctx({ seed: 3 }));
    if (jar.outcomes[1].failure === undefined) expect(jar.mpCost).toBeGreaterThanOrEqual(1);
  });

  it("not enough MP is an error", () => {
    const tired = { ...createDefaultChef(), mp: 1 };
    expect(simulateProcess([add(0, "rabbit"), tool(0, "stone"), method(0, "grill")], ctx({ chef: tired })).errors.join()).toContain("MP");
  });
});

describe("inventory over time", () => {
  it("storage changes the route: shelf spoils, icehouse keeps, cellar ages meat", () => {
    const shelf = ageStack(newStack("rabbit", 1, "shelf", "猟場", 0, 1), 4);
    const ice = ageStack(newStack("rabbit", 1, "icehouse", "猟場", 0, 2), 4);
    const cellar = ageStack(newStack("boar", 1, "cellar", "猟場", 0, 3), 2);
    expect(shelf.state).toBe("spoiled");
    expect(ice.freshness).toBeGreaterThan(0.5);
    expect(["aging", "aged"]).toContain(cellar.state);
  });

  it("consume takes from the earliest-expiring stack", () => {
    const stacks = [newStack("onion", 2, "shelf", "x", 5, 1), newStack("onion", 2, "shelf", "x", 0, 2)];
    const after = consume(stacks, "onion", 1)!;
    expect(after.find((s) => s.id === "stk-onion-2")!.quantity).toBe(1);
    expect(consume(stacks, "onion", 9)).toBeNull();
  });
});

describe("schools", () => {
  it("switching is instant and changes results of the same process", () => {
    const chef = createDefaultChef();
    expect(switchSchool(chef, "north").activeSchoolId).toBe("north");
    expect(switchSchool(chef, "unknown").activeSchoolId).toBe(chef.activeSchoolId);
    const steps = [add(0, "boar"), add(0, "salt", 0.5), method(0, "smoke")];
    const build = (id: string) => {
      const school = findSchool(id);
      const result = simulateProcess(steps, ctx({ school, seed: 7 }));
      return buildProcessDish({
        steps, result, school, finish: EMPTY_FINISH, review: reviewFinish(EMPTY_FINISH),
        cookingSeed: 7, chefLevel: 1, parentDishId: null,
      });
    };
    const north = build("north");
    const court = build("court");
    expect(north.scores.sustainability).toBeGreaterThan(court.scores.sustainability);
    expect(court.scores.originality).toBeGreaterThan(north.scores.originality);
  });

  it("fusion needs mastery and adds a new school without removing parents", () => {
    const chef = createDefaultChef();
    expect(canFuse(chef, "north", "court").ok).toBe(false);
    const trained = { ...chef, records: { ...chef.records, schoolMastery: { north: 3, court: 3 } } };
    expect(canFuse(trained, "north", "court").ok).toBe(true);
    const f = fuseSchools(trained, SCHOOLS[1], SCHOOLS[2], "preserve");
    expect(f.parents).toEqual(["north", "court"]);
    expect(fuseSchools(trained, SCHOOLS[1], SCHOOLS[2], "aroma").id).not.toBe(f.id);
  });
});

describe("dish building and completion", () => {
  it("process dish has 8 axes, a v2 key that round-trips, and keeps line history", () => {
    const c = ctx();
    const result = simulateProcess(MEAT_AND_SAUCE, c);
    const review = reviewFinish({ ...EMPTY_FINISH, vessel: "木の椀", freeText: "熱々で出す" });
    const dish = buildProcessDish({ steps: MEAT_AND_SAUCE, result, school: c.school, finish: review.normalized, review, cookingSeed: c.seed, chefLevel: 1, parentDishId: null });
    expect(Object.values(dish.scores).every((v) => Number.isFinite(v) && v >= 0 && v <= 100)).toBe(true);
    expect(parseProcessKey(dish.generationKey)).toEqual(MEAT_AND_SAUCE);
    expect(toProcessKey(MEAT_AND_SAUCE)).toBe(dish.generationKey);
    expect(dish.process?.finalLine.history.length).toBe(2);
    expect(dish.recipe.ingredientIds).toContain("rabbit");
  });

  it("completing consumes stock, MP and durability, advances time and grants xp", () => {
    const c = ctx();
    const steps = [add(0, "rabbit"), tool(0, "stone"), method(0, "grill")];
    const result = simulateProcess(steps, c);
    const review = reviewFinish(EMPTY_FINISH);
    const core = buildProcessDish({ steps, result, school: c.school, finish: EMPTY_FINISH, review, cookingSeed: c.seed, chefLevel: 1, parentDishId: null });
    const dish = { ...core, description: "", image: { kind: "placeholder" as const, emoji: "", colors: ["", ""] as [string, string] } };
    const w: World = { day: 0, chef: c.chef, inventory: c.inventory, tools: c.tools, customSchools: [], stackCounter: 0 };
    const out = completeCooking(w, steps, result, dish);
    if (typeof out === "string") throw new Error(out);
    const rabbitBefore = w.inventory.find((s) => s.itemId === "rabbit")!.quantity;
    expect(out.world.inventory.find((s) => s.itemId === "rabbit")?.quantity ?? 0).toBe(rabbitBefore - 1);
    expect(out.world.tools.find((t) => t.toolId === "stone")!.durability).toBe(29);
    expect(out.world.day).toBeGreaterThan(0);
    expect(out.gains.xp).toBeGreaterThan(0);
    expect(out.world.chef.records.schoolMastery.village).toBe(1);
    expect(out.world.chef.allocationLocked).toBe(true);
  });
});

describe("finishing", () => {
  it("auto-corrects light contradictions and warns on serious ones", () => {
    const light = reviewFinish({ ...EMPTY_FINISH, vessel: "白い陶器", freeText: "木の椀で熱々に" });
    expect(light.normalized.vessel).toBe("木の椀");
    expect(light.normalized.temperature).toBe("hot");
    expect(light.warnings).toEqual([]);
    const serious = reviewFinish({ ...EMPTY_FINISH, temperature: "cold", freeText: "熱々の湯気を楽しむ" });
    expect(serious.warnings.length).toBe(1);
    for (const v of Object.values(serious.axes)) expect(Math.abs(v ?? 0)).toBeLessThanOrEqual(6);
  });
});
