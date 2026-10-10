import { describe, expect, it } from "vitest";
import { FOOD_STORY } from "../data/foodStory";
import { BATTLE_MAP } from "../data/battles";
import { EATER_MAP } from "../data/eaters";
import { EATER_SCHOOLS, EATER_SKILLS } from "../data/eaterSchools";
import { QUESTS, questsAt } from "../data/quests";
import { QUEST_STORIES } from "../data/stories";
import { SCHOOLS, SKILLS } from "../data/phase2";
import type { Dish, Recipe } from "../types";
import { finalizeCreation, newDraft, suggestedStats, type CreationDraft } from "./creation/creation";
import { buyShortage, finishCook, planCook, startCook } from "./commerce/simpleCook";
import { applyBattleResult, runBattle } from "./battle/battle";
import { eatAndTaste } from "./eating/eat";
import { EMPTY_FINISH, reviewFinish } from "./finish/finish";
import { buildDish } from "./cooking/buildDish";
import { judgeQuest } from "./quest/judge";
import { progressionOf } from "./codex/codex";
import { groupNotes, noteItems, searchNotes } from "./codex/notebookIndex";
import { eaterSkillLevel } from "./eater/skills";
import { EATER_QUEST_MAP, perceptionAccuracy, startJudge, judgeTruth, resolveJudge } from "./eater/challenges";
import { buyTakeaway, dineOut, offersHere } from "./food/prepared";
import { calendarOf, DAYS_PER_YEAR, formatDate, NEW_GAME_DAY, nextPartStart, partOf, slotIndex } from "./time/calendar";
import { advancePart, completeAction, dailyOf, passParts, routineMeal } from "./time/daily";
import {
  EVENT_KITCHEN, isAvailable, KITCHEN_MAP, KITCHENS, kitchenProblems, kitchenStatus, offerEventKitchen, rentKitchen, suggestKitchen,
} from "./kitchen/kitchens";
import { eaterBoard, makerBattles, OPPONENT_LIMIT, opponentOf, recordOpponent } from "./battle/rotation";
import { planTravel, travel } from "./travel/travel";
import { createWorld, type World } from "./world";
import { normalizeWorld, toPersisted, writeSlot, type SaveStore } from "../state/saves";

const STORY = { answers: Object.fromEntries(FOOD_STORY.map((q) => [q.id, q.options[1].id])), freeText: "" };
function born(over: Partial<CreationDraft> = {}): World {
  const d: CreationDraft = { ...newDraft(), lean: "maker", genderExpression: "masculine", age: 22, start: "tool", toolId: "stone", foodStory: STORY, stats: suggestedStats(), statsConfirmed: true, ...over };
  const w = finalizeCreation({ ...createWorld(), chef: { ...createWorld().chef, money: 5000 } }, d);
  if (typeof w === "string") throw new Error(w);
  return w;
}
const maker = () => born();
const eater = () => born({ lean: "eater", genderExpression: "feminine" });
const at = (w: World, locationId: string): World => ({ ...w, travel: { ...w.travel, currentLocationId: locationId, visitedLocationIds: [...new Set([...w.travel.visitedLocationIds, locationId])] } });

function cook(w: World, recipeId: string, seed = 1, portions = 3) {
  let world = w;
  const b = buyShortage(world, planCook(world, recipeId, portions, null));
  if (typeof b !== "string") world = b;
  const st = startCook(world, planCook(world, recipeId, portions, null), seed);
  if (typeof st === "string") throw new Error(st);
  const review = reviewFinish(EMPTY_FINISH);
  const out = finishCook(st.world, st.session, review.normalized, review);
  return { ...out, dish: { ...out.dish, description: "", image: { kind: "placeholder" as const, emoji: "🍲", colors: ["", ""] as [string, string] } } as Dish };
}

// ---------- role ----------

describe("roles are fixed and play different games", () => {
  it("a character keeps the role chosen at creation (no in-game switch exists)", () => {
    expect(maker().identity.lean).toBe("maker");
    expect(eater().identity.lean).toBe("eater");
    // Every action that changes the world leaves the role alone.
    const w = eater();
    const later = advancePart(completeAction(w, w.day));
    expect(later.identity.lean).toBe("eater");
  });

  it("the same story has a maker side and an eater side, in the same place", () => {
    for (const s of QUEST_STORIES) {
      const makerSide = QUESTS.find((q) => q.id === s.makerQuestId) ?? BATTLE_MAP[s.makerQuestId];
      const eaterSide = EATER_QUEST_MAP[s.eaterQuestId];
      expect(makerSide, s.storyId).toBeDefined();
      expect(eaterSide, s.storyId).toBeDefined();
      expect((makerSide.locationId ?? "village")).toBe(s.locationId);
      expect(eaterSide.locationId ?? "village").toBe(s.locationId);
    }
    const meibutsu = QUEST_STORIES.find((s) => s.storyId === "meibutsu")!;
    expect(EATER_QUEST_MAP[meibutsu.eaterQuestId].kind).toBe("compare");
  });

  it("makers fight with dishes; eaters fight by eating", () => {
    const m = maker();
    expect(makerBattles(m).main.length).toBeGreaterThan(0);
    const b = eaterBoard(eater());
    expect(b.battles.map((q) => q.kind)).toEqual(expect.arrayContaining(["compare", "bigEater", "spicy", "judge"]));
    expect(b.requests.length).toBeGreaterThan(0);
  });

  it("maker schools/skills and eater schools/skills are separate sets", () => {
    expect(SCHOOLS.length).toBeGreaterThan(0);
    expect(SKILLS.length).toBeGreaterThan(0);
    expect(EATER_SCHOOLS).toHaveLength(3);
    expect(EATER_SKILLS.map((s) => s.id)).toEqual(expect.arrayContaining(["judgeGrill", "judgeStew", "judgeFerment", "judgeHeat", "judgePrep", "palate", "smell", "spice", "capacity", "report"]));
    const ids = new Set(SKILLS.map((s) => s.id as string));
    expect(EATER_SKILLS.some((s) => ids.has(s.id))).toBe(false);
  });

  it("eating smoked food grows smoke judging; schools change what grows fastest", () => {
    const w = at(eater(), "village");
    const g = buyTakeaway(at(w, "highland"), "m-mk-ibex");
    if (typeof g === "string") throw new Error(g);
    const r = eatAndTaste(g.world, g.stock.id, { ...g.dish, recipeId: "highland-smoked-ibex" });
    if (typeof r === "string") throw new Error(r);
    const p = progressionOf(r.world);
    expect(p.eaterSkills.judgeFerment ?? 0).toBeGreaterThan(0);
    expect(p.eaterSkills.smell ?? 0).toBeGreaterThan(0);
    const school = { ...g.world, progression: { ...progressionOf(g.world), eaterSchoolId: "aroma-culture" } };
    const r2 = eatAndTaste(school, g.stock.id, { ...g.dish, recipeId: "highland-smoked-ibex" });
    if (typeof r2 === "string") throw new Error(r2);
    expect(progressionOf(r2.world).eaterSkills.smell!).toBeGreaterThan(p.eaterSkills.smell!);
  });

  it("a judging failure still grows judging skill, and skill raises accuracy", () => {
    const w = eater();
    const def = EATER_QUEST_MAP["eq-judge-trial"];
    const s = startJudge(w, def);
    const wrong = Object.fromEntries(s.items.map((x) => [x.item, !judgeTruth(x.item, s.dish, def.conditions)]));
    const r = resolveJudge(w, s, wrong);
    expect(r.outcome.success).toBe(false);
    expect(progressionOf(r.world).eaterSkills.judgeHeat ?? 0).toBeGreaterThan(0);
    const skilled = { ...w, progression: { ...progressionOf(w), eaterSkills: { judgeHeat: 1000 } } };
    expect(eaterSkillLevel(progressionOf(skilled), "judgeHeat")).toBe(10);
    expect(perceptionAccuracy(skilled, s.dish, "heat")).toBeGreaterThan(perceptionAccuracy(w, s.dish, "heat"));
  });
});

// ---------- notebook ----------

describe("自分のノート", () => {
  it("every dish is reachable from one index, with status icons, search and views", () => {
    const m = cook(maker(), "rabbit-stew");
    const items = noteItems(m.world);
    const stew = items.find((i) => i.recipeId === "rabbit-stew")!;
    expect(stew.status).toMatchObject({ known: true, cooked: true, eaten: false, codex: true, public: false });
    expect(searchNotes(items, "兎").map((i) => i.recipeId)).toContain("rabbit-stew");
    expect(groupNotes(items, "category").map((g) => g.folder)).toContain("肉");
    expect(groupNotes(items, "region").map((g) => g.folder)).toContain("村");
    expect(groupNotes(items, "method").map((g) => g.folder)).toEqual(expect.arrayContaining(["煮る"]));
    expect(groupNotes(items, "tag").length).toBeGreaterThan(1);
    expect(groupNotes(items, "status").map((g) => g.folder)).toContain("作った");
  });

  it("dishes seen offered in a visited place appear as 見つけた (and can be eaten there)", () => {
    const w = at(eater(), "rivertown");
    const fish = noteItems(w).find((i) => i.recipeId === "river-grilled-fish")!;
    expect(fish.status.found).toBe(true);
    expect(fish.status.known).toBe(false);
    expect(offersHere(w).some((o) => o.recipeId === "river-grilled-fish")).toBe(true);
  });
});

// ---------- prepared food ----------

describe("外食と総菜", () => {
  it("eating at the inn: paid, really tasted, recorded, eater xp", () => {
    const w = eater();
    const r = dineOut(w, "v-inn-stew");
    if (typeof r === "string") throw new Error(r);
    expect(r.world.chef.money).toBe(w.chef.money - 6);
    const ate = eatAndTaste(r.world, r.stock.id, { ...r.dish, recipeId: "rabbit-stew" });
    if (typeof ate === "string") throw new Error(ate);
    expect(ate.gain.xp).toBeGreaterThan(0);
    expect(ate.world.codex["rabbit-stew"].timesEaten).toBe(1);
  });

  it("market takeaway goes into stock, cannot be resold, and differs by place", () => {
    const w = maker();
    const r = buyTakeaway(w, "v-mk-soup");
    if (typeof r === "string") throw new Error(r);
    const st = r.world.dishStock.find((s) => s.id === r.stock.id)!;
    expect(st.portions).toBe(2);
    expect(st.bought).toBe(true);
    expect(buyTakeaway(w, "r-mk-fish")).toBe("この土地では入手できない");
    const recipesAt = (loc: string) => offersHere(at(w, loc)).map((o) => o.recipeId).sort().join();
    expect(new Set(["village", "rivertown", "harbor", "highland"].map(recipesAt)).size).toBe(4);
  });
});

// ---------- time ----------

describe("世界暦と3区分", () => {
  it("a new character starts on 9876年5月4日 午後", () => {
    const w = maker();
    expect(w.day).toBe(NEW_GAME_DAY);
    expect(calendarOf(w.day)).toMatchObject({ year: 9876, month: 5, date: 4, part: 1, hour: 15 });
    expect(formatDate(w.day)).toBe("9876年5月4日");
  });

  it("360-day years of twelve 30-day months, no leap years", () => {
    expect(DAYS_PER_YEAR).toBe(360);
    const d0 = NEW_GAME_DAY;
    expect(calendarOf(d0 + 26)).toMatchObject({ month: 5, date: 30 });
    expect(calendarOf(d0 + 27)).toMatchObject({ month: 6, date: 1 });
    expect(calendarOf(d0 + 360)).toMatchObject({ year: 9877, month: 5, date: 4 });
  });

  it("午前 → 午後 → 夜 → 翌日午前, one part per main action; looking does not move time", () => {
    let w = maker();
    expect(partOf(w.day).part).toBe(1);
    w = advancePart(w);
    expect(partOf(w.day).part).toBe(2);
    w = advancePart(w);
    expect(partOf(w.day)).toEqual({ dayIndex: 1, part: 0 });
    w = completeAction(w, w.day);
    expect(partOf(w.day)).toEqual({ dayIndex: 1, part: 1 });
    // A long action that already crossed a part does not add another.
    const long = { ...w, day: nextPartStart(w.day) + 0.01 };
    expect(slotIndex(completeAction(long, w.day).day)).toBe(slotIndex(long.day));
    // Reading the notebook is not an action: it does not change the world at all.
    const before = JSON.stringify(w);
    groupNotes(noteItems(w), "category");
    expect(JSON.stringify(w)).toBe(before);
  });

  it("travel keeps its own days and stays consistent with the calendar", () => {
    const w = maker();
    const t = travel(w, planTravel(w, "rivertown", []), 1);
    if (typeof t === "string") throw new Error(t);
    expect(t.world.day).toBeCloseTo(w.day + 1.5, 5);
    // 15:00 + 1.5 days = 03:00 two days later, which is still the night of the 5th.
    expect(calendarOf(t.world.day)).toMatchObject({ date: 5, part: 2 });
  });

  it("the night's sleep restores stamina and MP", () => {
    let w = maker();
    w = { ...w, chef: { ...w.chef, stamina: 5, mp: 0 } };
    w = advancePart(advancePart(w));
    expect(w.chef.stamina).toBeGreaterThan(20);
    expect(w.chef.mp).toBeGreaterThan(0);
  });
});

// ---------- kitchens ----------

describe("厨房を借りる", () => {
  const stew = { methodIds: ["cut", "boil"], portions: 2, usesTool: false };
  it("guild kitchens of three sizes, the inn's shared kitchen, and a free event kitchen", () => {
    expect(KITCHENS.filter((k) => k.kind === "guild").length).toBeGreaterThanOrEqual(3);
    expect(KITCHEN_MAP["inn-shared"].kind).toBe("inn");
    expect(EVENT_KITCHEN.cost).toBe(0);
    const costs = ["inn-shared", "guild-small", "guild-standard", "guild-large"].map((id) => KITCHEN_MAP[id].cost);
    expect(costs).toEqual([...costs].sort((a, b) => a - b));
    const caps = ["inn-shared", "guild-small", "guild-standard", "guild-large"].map((id) => KITCHEN_MAP[id].capacity);
    expect(caps).toEqual([...caps].sort((a, b) => a - b));
  });

  it("methods, size and tools limit what a kitchen can cook", () => {
    expect(kitchenProblems(KITCHEN_MAP["inn-shared"], { methodIds: ["smoke"], portions: 1, usesTool: false })[0]).toContain("smoke");
    expect(kitchenProblems(KITCHEN_MAP["inn-shared"], { ...stew, portions: 5 })).toContain("2食まで");
    expect(kitchenProblems(KITCHEN_MAP["guild-small"], { ...stew, usesTool: true })).toContain("魔導具は使えない");
    expect(kitchenProblems(KITCHEN_MAP["guild-large"], { methodIds: ["smoke", "ferment"], portions: 50, usesTool: true })).toEqual([]);
    expect(kitchenProblems(KITCHEN_MAP["guild-preserve"], { methodIds: ["cut", "smoke"], portions: 5, usesTool: false })).toEqual([]);
  });

  it("renting costs money once per part of the day; the event kitchen is free", () => {
    const w = maker();
    const k = suggestKitchen(w, stew)!;
    const r = rentKitchen(w, k.id, stew);
    if (typeof r === "string") throw new Error(r);
    expect(r.chef.money).toBe(w.chef.money - k.cost);
    const again = rentKitchen(r, k.id, stew);
    expect((again as World).chef.money).toBe(r.chef.money);
    const ev = offerEventKitchen(w, "勝負", "tutorial");
    expect(suggestKitchen(ev, stew)!.id).toBe("event");
    expect((rentKitchen(ev, "event", stew) as World).chef.money).toBe(w.chef.money);
  });

  it("free or taken is fixed for a place, kitchen and part of the day; luck helps", () => {
    const w = maker();
    for (const k of KITCHENS) expect(isAvailable(w, k)).toBe(isAvailable({ ...w }, k));
    // Over many parts of the day the big kitchen is sometimes taken, more often with bad luck.
    let taken = 0, takenUnlucky = 0;
    for (let i = 0; i < 300; i++) {
      const day = NEW_GAME_DAY + i / 3;
      if (!isAvailable({ ...w, day }, KITCHEN_MAP["guild-large"])) taken++;
      if (!isAvailable({ ...w, day, chef: { ...w.chef, stats: { ...w.chef.stats, luck: 1 } } }, KITCHEN_MAP["guild-large"])) takenUnlucky++;
    }
    expect(taken).toBeGreaterThan(0);
    expect(takenUnlucky).toBeGreaterThanOrEqual(taken);
    const full = Array.from({ length: 300 }, (_, i) => ({ ...w, day: NEW_GAME_DAY + i / 3 })).find((x) => !isAvailable(x, KITCHEN_MAP["guild-large"]))!;
    expect(kitchenStatus(full, KITCHEN_MAP["guild-large"], stew).problems[0]).toContain("今日は埋まっている");
  });
});

// ---------- routine meals ----------

describe("日常食", () => {
  it("is eaten automatically and costs money or ingredients", () => {
    const w = { ...maker(), inventory: [] };
    const r = routineMeal(w);
    expect(r.source).toBe("bought");
    expect(r.world.chef.money).toBe(w.chef.money - 3);
    expect(dailyOf(r.world).hunger).toBe(0);
    const packed = routineMeal({ ...w, daily: { ...dailyOf(w), routineMeals: 2 } });
    expect(packed.source).toBe("pack");
    expect(dailyOf(packed.world).routineMeals).toBe(1);
  });

  it("restores stamina and gives no maker xp, no eater xp and no codex entry", () => {
    for (const w0 of [maker(), eater()]) {
      const w = { ...w0, chef: { ...w0.chef, stamina: 10 }, daily: { ...dailyOf(w0), hunger: 0.4 } };
      const after = passParts(w, 1);
      expect(dailyOf(after).hunger).toBe(0);
      expect(after.chef.stamina).toBeGreaterThan(10);
      expect(after.chef.xp).toBe(w.chef.xp);
      expect(progressionOf(after).eaterXp).toBe(progressionOf(w).eaterXp);
      expect(Object.keys(after.codex)).toHaveLength(0);
      expect(after.tastingLog).toHaveLength(0);
    }
  });

  it("an explicit meal is different: it grows an eater and records the dish", () => {
    const w = eater();
    const r = dineOut(w, "v-inn-soup");
    if (typeof r === "string") throw new Error(r);
    const ate = eatAndTaste(r.world, r.stock.id, { ...r.dish, recipeId: "bean-wheat-soup" });
    if (typeof ate === "string") throw new Error(ate);
    expect(progressionOf(ate.world).eaterXp).toBeGreaterThan(0);
    // A cook eating on purpose records the dish but grows by cooking, not eating.
    const m = dineOut(maker(), "v-inn-soup");
    if (typeof m === "string") throw new Error(m);
    const ate2 = eatAndTaste(m.world, m.stock.id, { ...m.dish, recipeId: "bean-wheat-soup" });
    if (typeof ate2 === "string") throw new Error(ate2);
    expect(ate2.gain.xp).toBe(0);
    expect(ate2.world.codex["bean-wheat-soup"].timesEaten).toBe(1);
  });
});

// ---------- location quests ----------

describe("その土地の依頼・勝負", () => {
  const villageIds = questsAt("village").map((q) => q.id);
  it("village requests only in the village", () => {
    expect(villageIds).toEqual(["q1", "q2", "q3"]);
    for (const loc of ["rivertown", "harbor", "highland"]) {
      const here = questsAt(loc).map((q) => q.id);
      expect(here.some((id) => villageIds.includes(id))).toBe(false);
      expect(here.length).toBeGreaterThanOrEqual(2);
      const w = at(maker(), loc);
      expect(makerBattles(w).main.every((b) => b.locationId === loc)).toBe(true);
      const e = eaterBoard(at(eater(), loc));
      expect([...e.battles, ...e.requests].every((q) => q.locationId === loc)).toBe(true);
      expect(e.battles.length + e.requests.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("each regional request can be passed with a real dish", () => {
    const good: Record<string, Recipe> = {
      "rq-river-fish": { ingredientIds: ["leek", "wildgreens", "cheese"], steps: [{ kind: "spice", id: "homura" }, { kind: "method", id: "smoke" }, { kind: "method", id: "grill" }, { kind: "method", id: "pressure" }] },
      "rq-river-traveler": { ingredientIds: ["cheese"], steps: [{ kind: "method", id: "sousvide" }, { kind: "spice", id: "iyashi" }] },
      "rq-harbor-seafood": { ingredientIds: ["noodles", "cinnamon", "honey", "seaweed"], steps: [{ kind: "spice", id: "homura" }, { kind: "method", id: "pickle" }, { kind: "method", id: "grill" }, { kind: "spice", id: "homura" }] },
      "rq-harbor-preserve": { ingredientIds: ["saltfish", "chicken", "rabbit"], steps: [{ kind: "method", id: "fry" }, { kind: "method", id: "ferment" }, { kind: "method", id: "dry" }] },
      "rq-highland-dairy": { ingredientIds: ["vinegar", "seafish"], steps: [{ kind: "method", id: "pickle" }, { kind: "method", id: "smoke" }] },
      "rq-highland-nourish": { ingredientIds: ["saltfish", "wheat"], steps: [{ kind: "method", id: "smoke" }, { kind: "method", id: "cut" }, { kind: "spice", id: "homura" }] },
    };
    for (const q of QUESTS.filter((x) => x.locationId)) {
      const dish = { ...buildDish(good[q.id]), description: "", image: { kind: "placeholder" as const, emoji: "", colors: ["", ""] as [string, string] } };
      expect(judgeQuest(q, dish, EATER_MAP[q.eaterId]).success, q.id).toBe(true);
    }
  });

  it("a place with nothing on offer simply shows nothing", () => {
    expect(questsAt("nowhere")).toEqual([]);
  });
});

// ---------- opponents ----------

describe("勝負相手の交代", () => {
  it("records every match and rotates after three", () => {
    let w = cook(maker(), "rabbit-stew").world;
    const dish = cook(w, "rabbit-stew", 2).dish;
    expect(makerBattles(w).main.map((b) => b.rivalId)).not.toContain("berta");
    for (let i = 0; i < OPPONENT_LIMIT; i++) w = applyBattleResult(w, runBattle(w, BATTLE_MAP.tutorial, dish, i), dish);
    const o = opponentOf(w, "gald");
    expect(o.matches).toBe(3);
    expect(o.wins + o.losses).toBeLessThanOrEqual(3);
    const { main, rematch } = makerBattles(w);
    expect(main.map((b) => b.rivalId)).toContain("berta");
    expect(main.map((b) => b.rivalId)).not.toContain("gald");
    expect(rematch.map((b) => b.id)).toContain("tutorial");
  });

  it("eaters face the same people from the other side", () => {
    let w = eater();
    expect(eaterBoard(w).battles.map((q) => q.id)).not.toContain("eq-judge-berta");
    for (let i = 0; i < OPPONENT_LIMIT; i++) w = recordOpponent(w, "gald", "win");
    const b = eaterBoard(w);
    expect(b.battles.map((q) => q.id)).toContain("eq-judge-berta");
    expect(b.rematch.map((q) => q.id)).toContain("eq-judge-trial");
  });
});

// ---------- saves ----------

describe("saves carry Phase 10 state", () => {
  it("date, meals, kitchen, eater skills and opponents survive; Phase 9 saves load", () => {
    let w = recordOpponent(eater(), "gald", "win");
    w = { ...w, daily: { ...dailyOf(w), routineMeals: 2 }, progression: { ...progressionOf(w), eaterSkills: { palate: 30 } } };
    const store = writeSlot({ version: 1, slots: [], lastSlotId: null } as SaveStore, "x", toPersisted({ world: w })) as SaveStore;
    const back = JSON.parse(JSON.stringify(store)).slots[0].state.world as World;
    expect(back.day).toBe(w.day);
    expect(back.daily.routineMeals).toBe(2);
    expect(back.opponents.gald.matches).toBe(1);
    expect(back.progression.eaterSkills.palate).toBe(30);
    const old = { ...createWorld() } as Partial<World>;
    delete old.daily; delete old.opponents; delete old.kitchen;
    const n = normalizeWorld({ ...old, progression: { ...old.progression!, eaterSchoolId: undefined as unknown as string } });
    expect(n.daily.hunger).toBeGreaterThanOrEqual(0);
    expect(n.opponents).toEqual({});
    expect(n.kitchen).toEqual({ rental: null, event: null });
  });
});
