import { describe, expect, it } from "vitest";
import { FOOD_STORY } from "../data/foodStory";
import { BATTLE_MAP } from "../data/battles";
import { APPRAISAL_TOOLS, EATER_TOOL_FOR } from "../data/eaterTools";
import { EXPEDITION_MAP } from "../data/expeditions";
import { SPICE_MAP } from "../data/magic";
import { QUEST_MAP } from "../data/quests";
import { EATER_MAP } from "../data/eaters";
import type { Dish } from "../types";
import { finalizeCreation, newDraft, suggestedStats, type CreationDraft } from "./creation/creation";
import { buyShortage, finishCook, planCook, startCook } from "./commerce/simpleCook";
import { applyBattleResult, runBattle } from "./battle/battle";
import { EMPTY_FINISH, reviewFinish } from "./finish/finish";
import { buildDish } from "./cooking/buildDish";
import { judgeQuest } from "./quest/judge";
import { progressionOf } from "./codex/codex";
import {
  bite, chanceForSHU, comfortSHU, EATER_QUEST_MAP, eatingCapacity, finishBigEater, judgeTruth, perceptionAccuracy, resolveSpicy, startBigEater, startJudge,
} from "./eater/challenges";
import { migratePhase11, pantryValue } from "./migrate";
import { EATER_TABS, MAKER_TABS, STAT_NAMES, startingToolLabel } from "./roleView";
import { countAction } from "./routine/count";
import { registerRoutine, ROUTINE_EFFICIENCY, routineCandidates, routinesOf, runNextDay, toggleRoutine } from "./routine/routines";
import { isAvailable, KITCHEN_MAP, kitchenProblems, kitchensHere, rentKitchen } from "./kitchen/kitchens";
import {
  buyHouse, buyPortableKitchen, buyShop, buyStorage, deposit, guildDeposit, guildWithdraw, nightlyStorage, openAccount, roadRisk, robberyChance,
  storagesHere, storeDish, subscribeGuildStorage, withdraw,
} from "./property/property";
import { closeExpedition, expeditionDay, startExpedition } from "./expedition/expedition";
import { dishSHU, scovilleOf } from "./food/scoville";
import { talkTo } from "./social/allies";
import { getRelation, PLAYER } from "./social/relations";
import { createWorld, type World } from "./world";
import { normalizeWorld, toPersisted } from "../state/saves";

const STORY = { answers: Object.fromEntries(FOOD_STORY.map((q) => [q.id, q.options[1].id])), freeText: "" };
function born(over: Partial<CreationDraft> = {}): World {
  const d: CreationDraft = { ...newDraft(), lean: "maker", genderExpression: "masculine", age: 22, start: "tool", toolId: "pot", foodStory: STORY, stats: suggestedStats(), statsConfirmed: true, ...over };
  const w = finalizeCreation({ ...createWorld(), chef: { ...createWorld().chef, money: 5000 } }, d);
  if (typeof w === "string") throw new Error(w);
  return w;
}
const maker = () => born();
const eater = (toolId = "pot"): World => {
  if (toolId !== "none") return born({ lean: "eater", genderExpression: "feminine", toolId });
  const w = born({ lean: "eater", genderExpression: "feminine", toolId: "pot" });
  return { ...w, progression: { ...progressionOf(w), eaterTools: [] } };
};
const at = (w: World, loc: string): World => ({ ...w, travel: { ...w.travel, currentLocationId: loc, visitedLocationIds: [...new Set([...w.travel.visitedLocationIds, loc])] } });
function cook(w: World, recipeId: string, seed = 1) {
  let world = w;
  const b = buyShortage(world, planCook(world, recipeId, 3, null));
  if (typeof b !== "string") world = b;
  const st = startCook(world, planCook(world, recipeId, 3, null), seed);
  if (typeof st === "string") throw new Error(st);
  const review = reviewFinish(EMPTY_FINISH);
  const out = finishCook(st.world, st.session, review.normalized, review);
  return { ...out, dish: { ...out.dish, description: "", image: { kind: "placeholder" as const, emoji: "🍲", colors: ["", ""] as [string, string] } } as Dish };
}
/** A Phase 10 eater save: pantry and cooking tools still there, no migration record. */
function phase10EaterSave(): World {
  const w = createWorld();
  const old = { ...w, identity: { ...w.identity, creationCompleted: true, lean: "eater" as const, startingToolId: "pot" }, tools: w.tools.filter((t) => t.toolId === "pot") } as Partial<World>;
  delete old.migrations;
  return old as World;
}

// ---------- role purity ----------

describe("role purity", () => {
  it("each role has its own tabs; an eater has no kitchen, sales or pantry", () => {
    expect(EATER_TABS.map((t) => t.id)).not.toContain("kitchen");
    expect(EATER_TABS.map((t) => t.id)).not.toContain("sales");
    expect(EATER_TABS.find((t) => t.id === "chef")!.label).toBe("食べ手");
    expect(MAKER_TABS.find((t) => t.id === "chef")!.label).toBe("料理人");
    expect(Object.values(STAT_NAMES.eater)).not.toContain("技術");
    expect(STAT_NAMES.eater.strength).toBe("身体能力");
  });

  it("a new eater starts with an empty pantry and an appraisal tool, never a cooking tool", () => {
    const e = eater();
    expect(e.inventory).toEqual([]);
    expect(e.tools).toEqual([]);
    expect(progressionOf(e).eaterTools).toEqual(["aroma-appraiser"]);
    expect(startingToolLabel(e)).toContain("香気鑑定器");
    const m = maker();
    expect(m.tools.map((t) => t.toolId)).toEqual(["pot"]);
    expect(startingToolLabel(m)).toContain("香封鍋");
    expect(progressionOf(m).eaterTools).toEqual([]);
  });
});

// ---------- migration ----------

describe("Phase 11 migration", () => {
  it("an old eater's pantry becomes money, once, and 香封鍋 becomes 香気鑑定器", () => {
    const old = phase10EaterSave();
    const value = pantryValue(old);
    expect(value).toBeGreaterThan(0);
    const m = normalizeWorld(old);
    expect(m.inventory).toEqual([]);
    expect(m.tools).toEqual([]);
    expect(m.chef.money).toBe(Math.round((old.chef.money + value) * 100) / 100);
    expect(progressionOf(m).eaterTools).toEqual(["aroma-appraiser"]);
    expect(m.migrations.phase11).toBe(true);
    // Reloading (normalising again, or a JSON round trip) never sells twice.
    const again = normalizeWorld(JSON.parse(JSON.stringify(toPersisted({ world: m }).world)));
    expect(again.chef.money).toBe(m.chef.money);
    expect(migratePhase11(m)).toBe(m);
  });

  it("a cook's save keeps its pantry and its 香封鍋", () => {
    const w = createWorld();
    const old = { ...w, identity: { ...w.identity, creationCompleted: true, lean: "maker" as const } } as Partial<World>;
    delete old.migrations;
    const m = normalizeWorld(old);
    expect(m.inventory.length).toBe(w.inventory.length);
    expect(m.tools.map((t) => t.toolId)).toContain("pot");
    expect(m.chef.money).toBe(w.chef.money);
  });
});

// ---------- eater tools ----------

describe("appraisal tools", () => {
  it("three tools take the cooking tools' slots", () => {
    expect(APPRAISAL_TOOLS).toHaveLength(3);
    expect(EATER_TOOL_FOR).toEqual({ stone: "thermo-needle", pot: "aroma-appraiser", jar: "taste-stone" });
  });
  it("温度 (heat), 香り (aroma), 味覚 (theme, heat relief) each help their own judging", () => {
    const base = eater("none");
    const s = startJudge(base, EATER_QUEST_MAP["eq-judge-harvest"]);
    const thermo = eater("stone"), aroma = eater("pot"), taste = eater("jar");
    expect(perceptionAccuracy(thermo, s.dish, "heat")).toBeGreaterThan(perceptionAccuracy(base, s.dish, "heat"));
    expect(perceptionAccuracy(aroma, s.dish, "aroma")).toBeGreaterThan(perceptionAccuracy(base, s.dish, "aroma"));
    expect(perceptionAccuracy(aroma, s.dish, "heat")).toBe(perceptionAccuracy(base, s.dish, "heat"));
    expect(perceptionAccuracy(taste, s.dish, "theme")).toBeGreaterThan(perceptionAccuracy(base, s.dish, "theme"));
    expect(chanceForSHU(taste, 15000)).toBeGreaterThan(chanceForSHU(base, 15000));
    expect(eatingCapacity(taste)).toBeGreaterThan(eatingCapacity(base));
  });
});

// ---------- routines ----------

describe("routines", () => {
  it("meal and sleep are registered from the start and can be switched off", () => {
    const w = maker();
    expect(routinesOf(w).map((r) => r.id)).toEqual(["meal", "sleep"]);
    expect(routinesOf(toggleRoutine(w, "sleep")).find((r) => r.id === "sleep")!.enabled).toBe(false);
  });

  it("a battle becomes registrable after three manual matches (once it moved to 再戦); a first one never", () => {
    let w = cook(maker(), "rabbit-stew").world;
    const dish = cook(w, "rabbit-stew", 2).dish;
    w = applyBattleResult(w, runBattle(w, BATTLE_MAP.tutorial, dish, 1), dish);
    expect(routineCandidates(w).find((c) => c.key === "battle:tutorial")!.blocked).toContain("あと2回");
    expect(typeof registerRoutine(w, "battle:tutorial")).toBe("string");
    for (let i = 2; i <= 3; i++) w = applyBattleResult(w, runBattle(w, BATTLE_MAP.tutorial, dish, i), dish);
    const r = registerRoutine(w, "battle:tutorial");
    if (typeof r === "string") throw new Error(r);
    expect(routinesOf(r).map((x) => x.id)).toContain("battle:tutorial");
  });

  it("a chat becomes a routine after three days of talking", () => {
    let w = maker();
    for (let d = 0; d < 3; d++) {
      const t = talkTo({ ...w, day: w.day + d }, "teo");
      if (typeof t === "string") throw new Error(t);
      w = { ...t.world, day: w.day };
    }
    expect(w.actionCounts["talk:teo"]).toBe(3);
    const r = registerRoutine(w, "talk:teo");
    expect(typeof r).not.toBe("string");
  });

  it("次の日へ runs the routines: xp, money, expenses, relation and a diary", () => {
    let w = cook(maker(), "rabbit-stew").world;
    const dish = cook(w, "rabbit-stew", 2).dish;
    for (let i = 1; i <= 3; i++) w = applyBattleResult(w, runBattle(w, BATTLE_MAP.tutorial, dish, i), dish);
    for (let d = 0; d < 3; d++) w = { ...(talkTo({ ...w, day: w.day + d }, "teo") as { world: World }).world, day: w.day };
    w = registerRoutine(registerRoutine(w, "battle:tutorial") as World, "talk:teo") as World;
    const before = getRelation(w, PLAYER, "teo")!;
    const day0 = Math.floor(w.day);
    let found = { talked: false, battled: false };
    for (let i = 0; i < 6 && !(found.talked && found.battled); i++) {
      const r = runNextDay(w, 100 + i);
      const text = r.entry.lines.map((l) => l.text).join("／");
      if (text.includes("会話 → ")) found.talked = true;
      if (/再戦 → (勝利|敗北)/.test(text)) found.battled = true;
      expect(r.entry.lines.some((l) => l.text.includes("眠った"))).toBe(true);
      w = r.world;
    }
    expect(found).toEqual({ talked: true, battled: true });
    expect(Math.floor(w.day)).toBeGreaterThan(day0);
    expect(getRelation(w, PLAYER, "teo")!.affection).toBeGreaterThan(before.affection);
    expect(w.diary.length).toBeGreaterThan(0);
  });

  it("routine contests pay less than manual ones, and can fail (tired, absent, lost)", () => {
    expect(ROUTINE_EFFICIENCY).toBeLessThan(1);
    expect(ROUTINE_EFFICIENCY).toBeGreaterThanOrEqual(0.7);
    let w = cook(maker(), "rabbit-stew").world;
    const dish = cook(w, "rabbit-stew", 2).dish;
    for (let i = 1; i <= 3; i++) w = applyBattleResult(w, runBattle(w, BATTLE_MAP.tutorial, dish, i), dish);
    w = registerRoutine(w, "battle:tutorial") as World;
    const tired = { ...w, chef: { ...w.chef, stamina: 0 } };
    const r = runNextDay(tired, 7);
    expect(r.entry.lines.some((l) => !l.ok && l.text.includes("疲れていて見送った"))).toBe(true);
    // A win through a routine pays 75% of the battle's money.
    let paid = 0;
    for (let s = 0; s < 20 && !paid; s++) {
      const x = runNextDay(w, 300 + s).entry.lines.find((l) => l.text.includes("勝利"));
      if (x) paid = Number(x.text.match(/\+(\d+)G/)![1]);
    }
    expect(paid).toBe(Math.round(20 * ROUTINE_EFFICIENCY));
  });

  it("a meal and the night cost money but grant nothing", () => {
    const w = { ...maker(), inventory: [] };
    const r = runNextDay(w, 1);
    expect(r.entry.moneyDelta).toBeLessThan(0);
    expect(r.world.chef.xp).toBe(w.chef.xp);
    expect(Object.keys(r.world.codex)).toHaveLength(0);
  });

  it("eater challenges count toward routines too", () => {
    const w = countAction(countAction(countAction(eater(), "eater:eq-bigeat"), "eater:eq-bigeat"), "eater:eq-bigeat");
    const r = registerRoutine(w, "eater:eq-bigeat");
    expect(typeof r).not.toBe("string");
  });
});

// ---------- kitchens you own ----------

describe("owned kitchens", () => {
  it("a house and a shop bring kitchens in their own place; portable ones go everywhere", () => {
    let w = buyHouse(maker()) as World;
    expect(kitchensHere(w).map((k) => k.id)).toContain("home-kitchen");
    w = buyShop(w) as World;
    expect(kitchensHere(w).map((k) => k.id)).toContain("shop-kitchen");
    expect(kitchensHere(at(w, "rivertown")).map((k) => k.id)).not.toContain("home-kitchen");
    for (const id of ["cart-kitchen", "travel-kit", "compact-magic"]) w = buyPortableKitchen(w, id) as World;
    const there = kitchensHere(at(w, "rivertown")).map((k) => k.id);
    expect(there).toEqual(expect.arrayContaining(["cart-kitchen", "travel-kit", "compact-magic"]));
    expect(isAvailable(at(w, "rivertown"), KITCHEN_MAP["cart-kitchen"])).toBe(true);
  });

  it("the travel kit only grills and boils a little; the compact magic kitchen does all, small, for MP", () => {
    expect(kitchenProblems(KITCHEN_MAP["travel-kit"], { methodIds: ["saute"], portions: 1, usesTool: false }).join()).toContain("saute");
    expect(kitchenProblems(KITCHEN_MAP["travel-kit"], { methodIds: ["boil"], portions: 3, usesTool: false })).toContain("2食まで");
    expect(kitchenProblems(KITCHEN_MAP["compact-magic"], { methodIds: ["smoke", "ferment"], portions: 3, usesTool: true })).toEqual([]);
    const w = buyPortableKitchen(maker(), "compact-magic") as World;
    const r = rentKitchen(w, "compact-magic", { methodIds: ["smoke"], portions: 2, usesTool: false }) as World;
    expect(r.chef.mp).toBe(w.chef.mp - 8);
    expect(r.chef.money).toBe(w.chef.money);
  });
});

// ---------- storage ----------

describe("storage", () => {
  it("stored dishes keep better, and magic storage costs MP each night", () => {
    let w = cook(buyStorage(maker(), "frost-chest") as World, "rabbit-stew").world;
    const stock = w.dishStock[0];
    const idx = storagesHere(w)[0].index;
    w = storeDish(w, idx, stock.id) as World;
    const after = nightlyStorage(w);
    const kept = storagesHere(after)[0].items[0].stock!.freshness;
    expect(kept).toBeGreaterThan(stock.freshness * 0.8);
    expect(after.chef.mp).toBe(w.chef.mp - 3);
  });

  it("the guilds' shared storage: deposit in one town, withdraw in a connected one; food only", () => {
    let w = cook(maker(), "rabbit-stew").world;
    w = subscribeGuildStorage(w, "chilled") as World;
    const stock = w.dishStock[0];
    w = guildDeposit(w, { type: "dish", stockId: stock.id }) as World;
    expect(w.dishStock.find((s) => s.id === stock.id)).toBeUndefined();
    const there = at({ ...w, day: w.day + 2 }, "rivertown");
    const out = guildWithdraw(there, there.guildStorage.items[0].id) as World;
    const back = out.dishStock.find((s) => s.id === stock.id)!;
    expect(back.freshness).toBeLessThan(stock.freshness);
    expect(back.freshness).toBeGreaterThan(stock.freshness * 0.8 * 0.8);
    expect(guildDeposit(w, { type: "money", amount: 10 })).toContain("お金");
    expect(guildDeposit(w, { type: "tool", toolId: "pot" })).toContain("道具");
    expect(guildDeposit(w, { type: "item", name: "剣" })).toContain("一般");
    expect(guildDeposit(w, { type: "living", name: "生きた鶏" })).toContain("生きている");
    const ing = guildDeposit(w, { type: "ingredient", stackId: w.inventory[0].id });
    expect(typeof ing).not.toBe("string");
  });
});

// ---------- bank ----------

describe("bank", () => {
  it("an account, deposits and withdrawals; deposits are safe from thieves", () => {
    let w = openAccount(maker()) as World;
    expect(w.bank.opened).toBe(true);
    w = deposit(w, 4000) as World;
    expect(w.bank.balance).toBe(4000);
    w = withdraw(w, 500) as World;
    expect(w.bank.balance).toBe(3500);
    expect(withdraw(w, 99999)).toBe("残高が足りない");
    expect(robberyChance(100)).toBe(0);
    expect(robberyChance(2000)).toBeGreaterThan(robberyChance(400));
    const rich = { ...w, chef: { ...w.chef, money: 3000 } };
    let robbed = 0;
    for (let s = 0; s < 40; s++) { const r = roadRisk(rich, s); if (r.lost) { robbed++; expect(r.world.bank.balance).toBe(3500); } }
    expect(robbed).toBeGreaterThan(0);
    const poor = { ...w, chef: { ...w.chef, money: 50 } };
    expect([...Array(40).keys()].every((s) => roadRisk(poor, s).lost === 0)).toBe(true);
  });
});

// ---------- expeditions ----------

describe("expeditions", () => {
  it("hire a guide, a guard, a mage and a spirit user on fixed or share terms; the diary runs day by day", () => {
    const w = at(maker(), "highland");
    const hires = [
      { hireId: "guide-tomas", contract: "fixed" as const }, { hireId: "guard-irma", contract: "share" as const },
      { hireId: "mage-oren", contract: "fixed" as const }, { hireId: "spirit-luu", contract: "share" as const },
    ];
    let e = startExpedition(w, "dragon-crater", hires) as World;
    expect(e.chef.money).toBe(w.chef.money - 30 - 45);
    expect(e.expedition!.goal).toBe("maker");
    for (let i = 0; i < 8 && e.expedition!.status === "active"; i++) e = expeditionDay(e, 11 + i);
    expect(e.expedition!.status).toBe("done");
    expect(e.expedition!.log.length).toBeGreaterThan(2);
    expect(["success", "partial", "failure"]).toContain(e.expedition!.outcome);
    if (e.expedition!.outcome !== "failure") expect(e.inventory.some((s) => s.itemId === "ryuenshou")).toBe(true);
    expect(closeExpedition(e).expedition).toBeNull();
  });

  it("cooks and eaters go for different things", () => {
    const d = EXPEDITION_MAP["dragon-crater"];
    expect(d.makerGoal).not.toBe(d.eaterGoal);
    let e = startExpedition(at(eater(), "highland"), "dragon-crater", [{ hireId: "guide-tomas", contract: "fixed" }, { hireId: "guard-irma", contract: "fixed" }]) as World;
    expect(e.expedition!.goal).toBe("eater");
    for (let i = 0; i < 8 && e.expedition!.status === "active"; i++) e = expeditionDay(e, 21 + i);
    if (e.expedition!.outcome !== "failure") expect(Object.values(e.codex).some((c) => c.name === "火口の地獄鍋")).toBe(true);
    expect(e.inventory).toEqual([]);
  });

  it("with no help, the way is harder: success happens less", () => {
    const run = (hires: { hireId: string; contract: "fixed" | "share" }[]) => {
      let ok = 0;
      for (let s = 0; s < 20; s++) {
        let e = startExpedition(at(maker(), "highland"), "dragon-crater", hires) as World;
        for (let i = 0; i < 8 && e.expedition!.status === "active"; i++) e = expeditionDay(e, s * 100 + i);
        if (e.expedition!.outcome === "success") ok++;
      }
      return ok;
    };
    expect(run([{ hireId: "guide-tomas", contract: "fixed" }, { hireId: "guard-irma", contract: "fixed" }, { hireId: "mage-oren", contract: "fixed" }])).toBeGreaterThanOrEqual(run([]));
  });
});

// ---------- Scoville ----------

describe("Scoville", () => {
  it("peppers have SHU and so do dishes made with them", () => {
    expect(SPICE_MAP.homura.scovilleSHU).toBe(30000);
    expect([SPICE_MAP.akagarashi.scovilleSHU, SPICE_MAP.homura.scovilleSHU, SPICE_MAP.ryuenshou.scovilleSHU]).toEqual([5000, 30000, 150000]);
    expect(scovilleOf(["boar", "homura"])).toBe(30000);
    expect(scovilleOf(["homura", "akagarashi"])).toBe(36000);
    const dish = buildDish({ ingredientIds: ["boar", "garlic"], steps: [{ kind: "spice", id: "homura" }, { kind: "method", id: "grill" }] });
    expect(dishSHU(dish)).toBe(30000);
  });

  it("a cook's heat request needs 10,000 SHU", () => {
    const q = QUEST_MAP["rq-harbor-spicy"];
    const hot = { ...buildDish({ ingredientIds: ["boar", "garlic", "onion"], steps: [{ kind: "spice", id: "homura" }, { kind: "method", id: "grill" }] }), description: "", image: { kind: "placeholder" as const, emoji: "", colors: ["", ""] as [string, string] } };
    const mild = { ...buildDish({ ingredientIds: ["boar", "garlic", "onion"], steps: [{ kind: "method", id: "grill" }] }), description: "", image: hot.image };
    expect(judgeQuest(q, hot, EATER_MAP.mare).requirementMet).toBe(true);
    expect(judgeQuest(q, mild, EATER_MAP.mare).requirementMet).toBe(false);
  });

  it("an eater's heat tiers are 10,000 / 50,000 / 100,000 SHU; jumping ahead is risky; tolerance grows", () => {
    const w = eater("none");
    const def = EATER_QUEST_MAP["eq-spicy"];
    expect(chanceForSHU(w, 10000)).toBeGreaterThan(chanceForSHU(w, 100000));
    expect(chanceForSHU(w, 1000)).toBe(0.95);
    let x = w;
    for (let d = 0; d < 6; d++) x = resolveSpicy({ ...x, day: x.day + 1 }, def, 1).world;
    expect(comfortSHU(x)).toBeGreaterThan(comfortSHU(w));
    expect(progressionOf(x).maxSHU).toBeGreaterThanOrEqual(0);
  });

  it("heat you already handle teaches little (diminishing)", () => {
    const seasoned = { ...eater("none"), progression: { ...progressionOf(eater("none")), spiceTolerance: 10 } };
    const before = progressionOf(seasoned).spiceTolerance;
    const r = resolveSpicy(seasoned, EATER_QUEST_MAP["eq-spicy"], 1);
    expect(progressionOf(r.world).spiceTolerance - before).toBeLessThanOrEqual(0.2);
  });
});

// ---------- body adaptation ----------

describe("eater body adaptation", () => {
  it("eating more than ever trains the stomach most; the same amount again, less", () => {
    const w = eater("none");
    const def = EATER_QUEST_MAP["eq-bigeat"];
    let s = { ...startBigEater(w, def), capacity: 40 };
    for (let i = 0; i < 4; i++) s = bite(s);
    const first = finishBigEater(w, s).world;
    const cap1 = progressionOf(first).eaterSkills.capacity ?? 0;
    expect(progressionOf(first).maxPortions).toBe(4);
    let s2 = { ...startBigEater(first, def), capacity: 40 };
    for (let i = 0; i < 4; i++) s2 = bite(s2);
    const second = finishBigEater(first, s2).world;
    const gain2 = (progressionOf(second).eaterSkills.capacity ?? 0) - cap1;
    expect(gain2).toBeLessThan(cap1);
    expect(progressionOf(second).eaterSkills.body ?? 0).toBeGreaterThan(0);
  });
});

// ---------- quests still resolve ----------

describe("judging still grounded in real cooking", () => {
  it("truths come from the dish", () => {
    const w = eater();
    const s = startJudge(w, EATER_QUEST_MAP["eq-judge-trial"]);
    for (const x of s.items) expect(typeof judgeTruth(x.item, s.dish, EATER_QUEST_MAP["eq-judge-trial"].conditions)).toBe("boolean");
  });
});
