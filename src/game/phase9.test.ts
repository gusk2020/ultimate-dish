import { describe, expect, it } from "vitest";
import { FOOD_STORY } from "../data/foodStory";
import { BATTLE_MAP, RIVAL_MAP } from "../data/battles";
import type { Dish } from "../types";
import type { DishStock } from "../types/world";
import type { ThirdPartyReview } from "../types/codex";
import { DEFAULT_NAMES, finalizeCreation, newDraft, resolvedName, suggestedStats, type CreationDraft, creationCandidates } from "./creation/creation";
import { buyShortage, finishCook, planCook, startCook } from "./commerce/simpleCook";
import { endDay } from "./commerce/day";
import { applyBattleResult, cookRivalDish, runBattle } from "./battle/battle";
import { eatAndTaste, recordTasting } from "./eating/eat";
import { EMPTY_FINISH, reviewFinish } from "./finish/finish";
import { learnFromTeacher } from "./learning/recipeBook";
import { codexKeyOf, codexSteps, notebook, progressionOf } from "./codex/codex";
import { hireTaster } from "./codex/reviews";
import { NPC_PUBLIC, promote, promotionBlock, publicScore, publish, ranking, REVIEW_WEIGHT_CAP } from "./codex/publicRegistry";
import { eaterLevelFor, eatXp, gainEaterXp, reportFee, roleLevelLabel } from "./eater/progression";
import {
  bite, compareTruth, EATER_QUEST_MAP, finishBigEater, judgeTruth, perceptionAccuracy, resolveCompare, resolveJudge, resolveSpicy,
  spicyChance, startBigEater, startCompare, startJudge, TRAIT_AXES,
} from "./eater/challenges";
import { createWorld, type World } from "./world";
import {
  canCreate, deleteSlot, LEGACY_KEY, loadStore, MAX_SLOTS, memoryStorage, normalizeWorld, persistStore, SAVE_KEY, slotState, toPersisted, writeSlot,
  type PersistedState, type SaveStore,
} from "../state/saves";

const STORY = { answers: Object.fromEntries(FOOD_STORY.map((q) => [q.id, q.options[1].id])), freeText: "" };

function draft(over: Partial<CreationDraft> = {}): CreationDraft {
  return {
    ...newDraft(), lean: "maker", genderExpression: "masculine", age: 22,
    start: "tool", toolId: "stone", foodStory: STORY, stats: suggestedStats(), statsConfirmed: true, ...over,
  };
}
function born(over: Partial<CreationDraft> = {}): World {
  const w = finalizeCreation({ ...createWorld(), chef: { ...createWorld().chef, money: 5000 } }, draft(over));
  if (typeof w === "string") throw new Error(w);
  return w;
}
const eaterWorld = () => born({ lean: "eater", genderExpression: "feminine" });

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

/** A dish someone else cooked, handed to the player (recipe unknown to them). */
function gift(w: World, rivalId: string, recipeId: string, seed = 3): { world: World; stock: DishStock; dish: Dish } {
  const d = cookRivalDish(RIVAL_MAP[rivalId], recipeId, seed).dish;
  const dish = { ...d, description: "", image: { kind: "placeholder" as const, emoji: "🍖", colors: ["", ""] as [string, string] } } as Dish;
  const stock: DishStock = {
    id: `gift-${recipeId}-${seed}`, dishId: dish.id, recipeId, name: dish.name, tags: [], portions: 3, total: dish.total, nutrition: dish.scores.nutrition,
    unitCost: 0, madeDay: w.day, freshness: 1, price: 0, listed: false, discounted: false, cookedBy: [rivalId],
  };
  return { world: { ...w, dishStock: [...w.dishStock, stock] }, stock, dish };
}

const persisted = (w: World): PersistedState => toPersisted({ world: w });

// ---------- Saves ----------

describe("character save slots", () => {
  it("keeps up to four characters and refuses a fifth", () => {
    let store: SaveStore = { version: 1, slots: [], lastSlotId: null };
    for (let i = 0; i < MAX_SLOTS; i++) {
      const next = writeSlot(store, `s${i}`, persisted(born({ name: `人${i}` })));
      if (typeof next === "string") throw new Error(next);
      store = next;
    }
    expect(store.slots).toHaveLength(4);
    expect(canCreate(store)).toBe(false);
    expect(writeSlot(store, "s5", persisted(born()))).toContain("4つまで");
    // An existing slot can still be updated when full.
    const upd = writeSlot(store, "s2", persisted(born({ name: "改名" })));
    expect(typeof upd).not.toBe("string");
    expect((upd as SaveStore).slots.find((s) => s.id === "s2")?.summary.name).toBe("改名");
  });

  it("switches, saves, reloads and deletes without touching other slots", () => {
    const storage = memoryStorage();
    const a = cook(born({ name: "アルト" }), "rabbit-stew").world;
    const b = eaterWorld();
    let store = writeSlot(loadStore(storage), "a", { ...persisted(a), dishes: [] }) as SaveStore;
    store = writeSlot(store, "b", persisted(b)) as SaveStore;
    expect(persistStore(store, storage)).toBeNull();
    const reloaded = loadStore(storage);
    expect(reloaded.slots.map((s) => s.summary.name)).toEqual(["アルト", "ハート"]);
    const sa = slotState(reloaded.slots[0]);
    expect(sa.world.chef.name).toBe("アルト");
    expect(sa.world.codex["rabbit-stew"].timesCooked).toBe(1);
    expect(JSON.parse(JSON.stringify(a))).toEqual(sa.world);
    expect(slotState(reloaded.slots[1]).world.identity.lean).toBe("eater");
    const after = deleteSlot(reloaded, "a");
    expect(after.slots.map((s) => s.id)).toEqual(["b"]);
  });

  it("summarises name, role, gender, age, level, place, day and partner", () => {
    const s = (writeSlot({ version: 1, slots: [], lastSlotId: null }, "x", persisted(eaterWorld())) as SaveStore).slots[0].summary;
    expect(s).toMatchObject({ name: "ハート", roleLabel: "食べる側", gender: "女性", age: 22, levelLabel: "フードファイターLv1", day: 1 });
    expect(s.partner).toContain("魔");
  });

  it("migrates a legacy single save into slot 1 without deleting it, once", () => {
    const old = createWorld() as Partial<World>;
    delete old.progression;
    delete old.codex;
    delete old.publicRegistry;
    const storage = memoryStorage({ [LEGACY_KEY]: JSON.stringify({ world: { ...old, chef: { ...old.chef!, name: "古参" } }, dishes: [] }) });
    const store = loadStore(storage);
    expect(store.slots).toHaveLength(1);
    expect(store.slots[0].summary.name).toBe("古参");
    const w = slotState(store.slots[0]).world;
    expect(w.identity.creationCompleted).toBe(true);
    expect(w.progression.eaterLevel).toBe(1);
    expect(w.codex).toEqual({});
    expect(storage.getItem(LEGACY_KEY)).not.toBeNull();
    expect(JSON.parse(storage.getItem(SAVE_KEY)!).migratedLegacy).toBe(true);
    expect(loadStore(storage).slots).toHaveLength(1);
  });

  it("fills in fields an older world lacks", () => {
    const w = normalizeWorld({ day: 3 } as Partial<World>);
    expect(w.publicRegistry).toEqual([]);
    expect(w.progression.questLog).toEqual([]);
  });
});

// ---------- Names ----------

describe("names", () => {
  it("blank names default by gender expression; a typed name wins", () => {
    expect(DEFAULT_NAMES).toEqual({ masculine: "スペード", feminine: "ハート", neutral: "クラブ", androgynous: "ダイヤ" });
    for (const g of ["masculine", "feminine", "neutral", "androgynous"] as const) {
      const w = born({ genderExpression: g });
      expect(w.chef.name).toBe(DEFAULT_NAMES[g]);
      expect(w.identity.name).toBe(DEFAULT_NAMES[g]);
    }
    expect(resolvedName({ name: "  ミラ ", genderExpression: "feminine" })).toBe("ミラ");
    const w = born({ name: "ミラ" });
    expect([w.chef.name, w.identity.name, w.palate?.name]).toEqual(["ミラ", "ミラ", "ミラ"]);
  });

  it("the companion's name seed uses the new name", () => {
    const base = { ...createWorld() };
    const d = draft({ start: "companion", companionPresentation: "girl", toolId: null, temperament: { pace: 0.7, talk: 0.7 } });
    const names = (n: string) => creationCandidates(base, { ...d, name: n }).map((c) => c.name).join();
    const variants = new Set(["アルト", "ミラ", "スペード", "ロウ", "セナ"].map(names));
    expect(variants.size).toBeGreaterThan(1);
  });
});

// ---------- Maker ----------

describe("作る側", () => {
  it("cooking grows the cook and registers the dish in the codex", () => {
    const w = born();
    const a = cook(w, "rabbit-stew");
    expect(a.gains.xp).toBeGreaterThan(0);
    expect(a.codexNew).toBe(true);
    const e = a.world.codex["rabbit-stew"];
    expect(e).toMatchObject({ timesCooked: 1, timesEaten: 0, firstCookedDay: 1 });
    expect(codexSteps(a.world, e)).not.toBeNull();
    const b = cook(a.world, "rabbit-stew", 5);
    expect(b.codexNew).toBe(false);
    expect(b.world.codex["rabbit-stew"].timesCooked).toBe(2);
    expect(roleLevelLabel(b.world)).toMatch(/^料理人Lv/);
  });

  it("battle judges' verdicts become codex reviews", () => {
    const a = cook(born(), "rabbit-stew");
    const r = runBattle(a.world, BATTLE_MAP.harvest, a.dish, 1);
    const w = applyBattleResult(a.world, r, a.dish);
    const reviews = w.codex["rabbit-stew"].reviews;
    expect(reviews).toHaveLength(3);
    expect(reviews.every((x) => x.source === "questJudge")).toBe(true);
    expect(reviews[0].score).toBe(Math.round(r.verdicts[0].player));
  });

  it("selling still pays the cook", () => {
    const a = cook(born(), "rabbit-stew");
    const sold = endDay({ ...a.world, dishStock: a.world.dishStock.map((s) => ({ ...s, listed: true, price: 1 })) }, 3);
    expect(sold.world.dishStock.reduce((n, s) => n + s.portions, 0)).toBeLessThan(a.world.dishStock.reduce((n, s) => n + s.portions, 0));
  });
});

// ---------- Eater ----------

describe("食べる側", () => {
  it("eating grows the eater and the codex, never the recipe book", () => {
    const g = gift(eaterWorld(), "sigurd", "smoked-boar");
    expect(g.world.recipeBook["smoked-boar"]).toBeUndefined();
    const r = eatAndTaste(g.world, g.stock.id, g.dish);
    if (typeof r === "string") throw new Error(r);
    expect(r.gain.xp).toBeGreaterThan(10);
    expect(r.gain.codexNew).toBe(true);
    expect(progressionOf(r.world).eaterXp).toBe(r.gain.xp);
    expect(r.world.recipeBook["smoked-boar"]).toBeUndefined();
    const e = r.world.codex["smoked-boar"];
    expect(e.timesEaten).toBe(1);
    expect(e.timesCooked).toBe(0);
    expect(codexSteps(r.world, e)).toBeNull();
    // Second helping: lightly diminishing.
    const again = eatAndTaste(r.world, g.stock.id, g.dish);
    if (typeof again === "string") throw new Error(again);
    expect(again.gain.xp).toBeLessThan(r.gain.xp);
    expect(again.gain.xp).toBeGreaterThan(0);
  });

  it("high rank and unknown ingredients count for more", () => {
    const w = eaterWorld();
    const d = cookRivalDish(RIVAL_MAP.sigurd, "smoked-boar", 3).dish;
    const low = eatXp(w, { ...d, total: 20, rank: "D" });
    const high = eatXp(w, { ...d, total: 80, rank: "A" });
    expect(high.xp).toBeGreaterThan(low.xp);
    expect(low.reasons.join()).toContain("未知の食材");
  });

  it("levels and the eater's report fee", () => {
    expect([0, 19, 20, 80, 180].map(eaterLevelFor)).toEqual([1, 1, 2, 3, 4]);
    const w = gainEaterXp(eaterWorld(), 85);
    expect(roleLevelLabel(w)).toBe("フードファイターLv3");
    expect(reportFee(w)).toBe(5);
    expect(reportFee(born())).toBe(0);
    const g = gift(w, "sigurd", "smoked-boar");
    const ate = eatAndTaste(g.world, g.stock.id, g.dish);
    if (typeof ate === "string") throw new Error(ate);
    const out = recordTasting(ate.world, g.dish, ate.result, {}, 0.5, "燻香がいい");
    expect(out.world.chef.money).toBe(ate.world.chef.money + 5);
    expect(out.world.codex["smoked-boar"].ownReport?.text).toBe("燻香がいい");
  });

  it("食べ比べ: the truth is the dishes as cooked", () => {
    const w = eaterWorld();
    const def = EATER_QUEST_MAP["eq-nutrition"];
    const s = startCompare(w, def);
    expect(s.dishes).toHaveLength(2);
    const t = compareTruth(def, s);
    const right = resolveCompare(w, s, t);
    expect(right.outcome.success).toBe(true);
    expect(Math.round(right.world.chef.money - w.chef.money)).toBe(def.reward.money); // minus a little storage upkeep
    expect(Object.keys(right.world.codex)).toHaveLength(2);
    expect(right.world.recipeBook["mushroom-porridge"]).toBeUndefined();
    const wrong = resolveCompare(w, s, { pick: 1 - t.pick, trait: TRAIT_AXES.find((a) => a !== t.trait)! });
    expect(wrong.outcome.success).toBe(false);
    expect(progressionOf(wrong.world).eaterXp).toBeGreaterThan(0);
    expect(progressionOf(wrong.world).eaterXp).toBeLessThan(progressionOf(right.world).eaterXp);
  });

  it("大食い: stopping is safe, pushing past the limit can fail", () => {
    const w = eaterWorld();
    const def = EATER_QUEST_MAP["eq-bigeat"];
    let s = startBigEater(w, def);
    s = bite(bite(s));
    const stop = finishBigEater(w, s);
    expect(stop.outcome.success).toBe(false);
    expect(stop.outcome.money).toBe(6);
    // A small stomach, kept eating: it eventually stops you, and costs stamina.
    let t = { ...startBigEater(w, def), capacity: 2.5 };
    for (let i = 0; i < 10 && !t.failed; i++) t = bite(t);
    expect(t.failed).toBe(true);
    const fail = finishBigEater(w, t);
    expect(fail.world.chef.stamina).toBeLessThan(w.chef.stamina);
    // A big stomach finishes.
    let u = { ...startBigEater(w, def), capacity: 40 };
    while (u.eaten < u.target) u = bite(u);
    expect(finishBigEater(w, u).outcome.success).toBe(true);
  });

  it("激辛: tolerance comes from experience and changes the odds", () => {
    const w = eaterWorld();
    const def = EATER_QUEST_MAP["eq-spicy"];
    const seasoned = { ...w, progression: { ...w.progression, spiceTolerance: 6 } };
    expect(spicyChance(seasoned, 3)).toBeGreaterThan(spicyChance(w, 3));
    let wins = 0, losses = 0;
    for (let d = 0; d < 30; d++) {
      const r = resolveSpicy({ ...w, day: d + 0.25 }, def, 3);
      if (r.outcome.success) {
        wins++;
        expect(r.outcome.money).toBe(def.reward.money * 3);
        expect(progressionOf(r.world).spiceTolerance).toBe(1);
      } else {
        losses++;
        expect(r.outcome.money).toBe(6);
        expect(progressionOf(r.world).spiceTolerance).toBe(0.5);
      }
    }
    expect(wins).toBeGreaterThan(0);
    expect(losses).toBeGreaterThan(0);
  });

  it("審査員: correct verdicts pay and build reputation", () => {
    const w0 = eaterWorld();
    const w = { ...w0, progression: { ...w0.progression, reputation: 5 } };
    const def = EATER_QUEST_MAP["eq-judge-trial"];
    const s = startJudge(w, def);
    const truth = Object.fromEntries(s.items.map((x) => [x.item, judgeTruth(x.item, s.dish, def.conditions)]));
    const r = resolveJudge(w, s, truth);
    expect(r.outcome.success).toBe(true);
    expect(r.outcome.results.every((x) => x.correct)).toBe(true);
    expect(progressionOf(r.world).reputation).toBe(5 + def.reward.reputation);
    expect(Math.round(r.world.chef.money - w.chef.money)).toBe(def.reward.money + 15);
    expect(r.outcome.lines.join()).toContain("ありがとう");
  });

  it("審査員: wrong verdicts are corrected, cost reputation, and still teach", () => {
    const w0 = eaterWorld();
    const w = { ...w0, progression: { ...w0.progression, reputation: 5 } };
    const def = EATER_QUEST_MAP["eq-judge-trial"];
    const s = startJudge(w, def);
    const wrong = Object.fromEntries(s.items.map((x) => [x.item, !judgeTruth(x.item, s.dish, def.conditions)]));
    const r = resolveJudge(w, s, wrong);
    expect(r.outcome.success).toBe(false);
    expect(r.outcome.results.every((x) => x.correction?.includes("ガルド"))).toBe(true);
    expect(progressionOf(r.world).reputation).toBe(5 - s.items.length);
    expect(r.outcome.lines.join()).toContain("苦情");
    const ex = progressionOf(r.world).experience;
    expect(Object.keys(ex.methods).length).toBeGreaterThan(0);
    // Knowing the dish better makes the next judging more reliable.
    expect(perceptionAccuracy(r.world, s.dish)).toBeGreaterThan(perceptionAccuracy(w, s.dish));
  });

  it("審査員: truths vary with how the rival actually cooked", () => {
    const def = EATER_QUEST_MAP["eq-judge-trial"];
    const seen = new Set<boolean>();
    for (let seed = 0; seed < 40; seed++) {
      const d = cookRivalDish(RIVAL_MAP.gald, "rabbit-stew", seed).dish;
      seen.add(judgeTruth("heat", d, def.conditions));
    }
    expect(seen.size).toBe(2);
  });
});

// ---------- Notebook / codex ----------

describe("ノート and 私の図鑑", () => {
  it("the notebook holds known recipes with made / eaten flags", () => {
    const w = learnFromTeacher(born(), "hanna", "hanna-pickled-cabbage").world;
    const row = notebook(w).find((r) => r.recipeId === "hanna-pickled-cabbage")!;
    expect(row).toMatchObject({ state: "known", cooked: false, tasted: false });
    expect(w.codex["hanna-pickled-cabbage"]).toBeUndefined();
    const cooked = cook(w, "rabbit-stew").world;
    expect(notebook(cooked).find((r) => r.recipeId === "rabbit-stew")).toMatchObject({ state: "mastered", cooked: true, tasted: false });
  });
});

// ---------- Reviews and the public registry ----------

const review = (score: number, weight: number, fame: number): ThirdPartyReview => ({
  reviewerId: "t", reviewerName: "t", reviewerLevel: 1, reviewerFame: fame, weight, context: "", score, good: "", bad: "", forWhom: "", impression: "", day: 1, source: "hiredTaster",
});

describe("reviews, publishing and ranking", () => {
  it("hiring a food fighter: fee, one portion, a detailed review from the famous", () => {
    const a = cook(born(), "rabbit-stew");
    const before = a.world.dishStock.find((s) => s.id === a.stock.id)!.portions;
    const pip = hireTaster(a.world, a.stock.id, a.dish, "ff-pip");
    const garm = hireTaster(a.world, a.stock.id, a.dish, "ff-garm");
    if (typeof pip === "string" || typeof garm === "string") throw new Error("hire failed");
    expect(garm.world.chef.money).toBe(a.world.chef.money - 60);
    expect(garm.world.dishStock.find((s) => s.id === a.stock.id)!.portions).toBe(before - 1);
    expect(garm.review.weight).toBeGreaterThan(pip.review.weight);
    expect(garm.world.codex["rabbit-stew"].reviews).toHaveLength(1);
    expect(garm.review.impression.length).toBeGreaterThan(pip.review.impression.length);
  });

  it("public score weighs fame and caps any single review", () => {
    expect(publicScore({ absolute: 50, reviews: [review(90, 3, 85)] })).toBeGreaterThan(publicScore({ absolute: 50, reviews: [review(90, 1, 5)] }));
    expect(publicScore({ absolute: 50, reviews: [review(100, 50, 99)] })).toBe(publicScore({ absolute: 50, reviews: [review(100, REVIEW_WEIGHT_CAP, 99)] }));
  });

  it("only dishes you made can be published; stages need reviews; reproductions count", () => {
    const g = gift(eaterWorld(), "sigurd", "smoked-boar");
    const ate = eatAndTaste(g.world, g.stock.id, g.dish);
    if (typeof ate === "string") throw new Error(ate);
    expect(publish(ate.world, "smoked-boar")).toContain("自分で作った");

    const a = cook(born(), "rabbit-stew");
    const pub = publish(a.world, "rabbit-stew");
    if (typeof pub === "string") throw new Error(pub);
    expect(pub.record.stage).toBe("guild");
    expect(pub.world.chef.money).toBe(a.world.chef.money - 10);
    expect(promotionBlock(pub.record)).toContain("食レポ");
    expect(typeof promote(pub.world, pub.record.id)).toBe("string");

    const hired = hireTaster(pub.world, a.stock.id, a.dish, "ff-nora");
    if (typeof hired === "string") throw new Error(hired);
    const rec = hired.world.publicRegistry[0];
    expect(rec.reviews).toHaveLength(1);
    const boosted = { ...hired.world, publicRegistry: [{ ...rec, absolute: 70 }] };
    const up = promote(boosted, rec.id);
    if (typeof up === "string") throw new Error(up);
    expect(up.record.stage).toBe("nation");

    const again = cook(up.world, "rabbit-stew", 9);
    expect(again.world.publicRegistry[0].reproductions).toBe(1);

    const rows = ranking(again.world);
    expect(rows).toHaveLength(NPC_PUBLIC.length + 1);
    expect(rows.map((r) => r.score)).toEqual([...rows.map((r) => r.score)].sort((x, y) => y - x));
    expect(rows.some((r) => r.mine)).toBe(true);
  });

  it("codex keys follow the recipe, or the name for free dishes", () => {
    expect(codexKeyOf({ name: "x", recipeId: "rabbit-stew" })).toBe("rabbit-stew");
    expect(codexKeyOf({ name: "猪の串", recipeId: null })).toBe("dish:猪の串");
  });
});
