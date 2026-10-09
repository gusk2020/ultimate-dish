import { describe, expect, it } from "vitest";
import { ALLIES, ALLY_MAP } from "../data/allies";
import { BATTLE_MAP } from "../data/battles";
import type { Dish } from "../types";
import type { CookTeam, PlayerPersona } from "../types/social";
import { buyShortage, finishCook, openFailures, planCook, startCook } from "./commerce/simpleCook";
import { endDay } from "./commerce/day";
import { applyBattleResult, runBattle } from "./battle/battle";
import { eatAndTaste, setFoodStory } from "./eating/eat";
import { tasteDish } from "./eating/tasting";
import { EMPTY_FINISH, reviewFinish } from "./finish/finish";
import { adoptIdea, recipeStatus } from "./learning/recipeBook";
import { allyStatus, availableHelpers, inviteAlly, joinChecks, partyMembers, talkTo } from "./social/allies";
import { chooseCompanion, declineCompanion, generateCandidates, hasCompanion, inferPersona } from "./social/companion";
import { SOLO, synergy } from "./social/coop";
import { shareMeal } from "./social/meals";
import { adjustRelation, getRelation, PLAYER, relationStage, relationTendency } from "./social/relations";
import { createWorld, type World } from "./world";

// A meat-loving, careful, quiet maker.
const MEAT_STORY = { answers: { childhood: "game", feast: "roast", disliked: "bitter-greens", journey: "never", tired: "salty-meat" }, freeText: "" };
const PERSONA: PlayerPersona = { personality: { pace: -0.7, talk: -0.7, mind: -0.7, venture: -0.7 }, lean: "maker" };

const start = (): World => {
  const w = createWorld();
  return setFoodStory({ ...w, chef: { ...w.chef, money: 5000 } }, MEAT_STORY);
};
const withCompanion = (i = 1) => {
  const w = start();
  return chooseCompanion(w, generateCandidates(w, PERSONA)[i]);
};

function cook(w: World, recipeId: string, team: CookTeam = SOLO, seed = 1, portions = 3) {
  let world = w;
  const b = buyShortage(world, planCook(world, recipeId, portions, null, team));
  if (typeof b !== "string") world = b;
  const plan = planCook(world, recipeId, portions, null, team);
  const st = startCook(world, plan, seed);
  if (typeof st === "string") throw new Error(st);
  const review = reviewFinish(EMPTY_FINISH);
  const out = finishCook(st.world, st.session, review.normalized, review);
  const dish = { ...out.dish, description: "", image: { kind: "placeholder" as const, emoji: "", colors: ["", ""] as [string, string] } } as Dish;
  return { ...out, dish, session: st.session, plan };
}

/** Cooks until the session has no open failure (successive seeds). */
function cookClean(w: World, recipeId: string, team: CookTeam) {
  for (let seed = 1; seed < 300; seed++) {
    const r = cook(w, recipeId, team, seed);
    if (openFailures(r.session).length === 0 && r.dish.rank !== "D") return r;
  }
  throw new Error("no clean seed");
}

describe("special companion candidates", () => {
  it("builds three different candidates, each the player's opposite", () => {
    const w = start();
    const c = generateCandidates(w, PERSONA);
    expect(c).toHaveLength(3);
    expect(new Set(c.map((x) => x.species)).size).toBe(3);
    for (const x of c) {
      expect(x.lean).toBe("eater"); // player is a maker
      expect(x.personality.pace).toBeGreaterThan(0); // player is careful
      expect(x.personality.talk).toBeGreaterThan(0); // player is quiet
      expect(x.complement!.length).toBe(3);
      expect(x.complement![0]).toContain("作り手");
      expect(x.eater.id).toBe(x.id);
      expect(x.signatureRecipeIds.length).toBeGreaterThan(0);
    }
    // Palate: the player is used to meat → candidates lean to plants.
    expect(c[0].eater.culture.familiar.plant).toBeGreaterThan(c[0].eater.culture.familiar.animal ?? 0);
    expect(c.some((x) => x.complement!.some((r) => r.includes("野菜")))).toBe(true);
    // Strengths: the player's weakest playing stats are the candidate's strong ones.
    const weakest = (["tech", "knowledge", "luck", "magic"] as const).reduce((a, k) => (w.chef.stats[k] < w.chef.stats[a] ? k : a), "tech" as "tech" | "knowledge" | "luck" | "magic");
    expect(c[1].chef.stats[weakest]).toBeGreaterThan(w.chef.stats[weakest]);
    // A food-lover gets a cook: the role flips.
    const eaterSide = generateCandidates(w, { ...PERSONA, lean: "eater" });
    expect(eaterSide.every((x) => x.lean === "maker")).toBe(true);
  });

  it("can guess part of the persona from the food story and stats", () => {
    const g = inferPersona(start());
    expect(g.personality.venture).toBeDefined();
    expect(g.personality.mind).toBeDefined();
    expect(g.personality.pace).toBeUndefined();
  });

  it("choosing or declining both keep the game playable", () => {
    const yes = withCompanion();
    expect(hasCompanion(yes)).toBe(true);
    const r = getRelation(yes, PLAYER, yes.social.companion!.id)!;
    for (const k of ["affection", "trust", "foodCompatibility", "conflicts"] as const) expect(typeof r[k]).toBe("number");
    expect(r.tags).toContain("companion");

    const no = declineCompanion(start());
    expect(no.social.companionChoice).toBe("declined");
    expect(hasCompanion(no)).toBe(false);
    expect(availableHelpers(no)).toHaveLength(0);
    for (const w of [yes, no]) {
      const made = cook(w, "rabbit-stew");
      const next = endDay({ ...made.world, dishStock: made.world.dishStock.map((s) => ({ ...s, listed: true })) }, 3);
      expect(next.world.day).toBeGreaterThan(w.day);
    }
  });
});

describe("meals and food memories", () => {
  it("the companion tastes differently from the player and remembers the meal", () => {
    const w0 = withCompanion();
    const comp = w0.social.companion!;
    const made = cook(w0, "boar-herb-roast");
    const mine = tasteDish(made.dish, made.world.palate!);
    const out = shareMeal(made.world, { stockId: made.stock.id, dish: made.dish, eaterIds: [comp.id] });
    if (typeof out === "string") throw new Error(out);
    const theirs = out.reactions[0].tasting;
    expect(theirs.score).not.toBe(mine.score);
    const r = getRelation(out.world, PLAYER, comp.id)!;
    expect(r.memories).toHaveLength(1);
    expect(r.memories[0]).toMatchObject({ dishName: made.dish.name, cookedBy: [PLAYER], kind: "firstDish" });
    expect(r.sharedMeals).toBe(1);
    expect(out.world.dishStock.find((s) => s.id === made.stock.id)?.portions).toBe(made.stock.portions - 1);
  });

  it("keeps only a few important memories", () => {
    let w = withCompanion();
    const id = w.social.companion!.id;
    for (let i = 0; i < 4; i++) {
      const made = cook(w, i % 2 ? "rabbit-stew" : "bean-wheat-soup", SOLO, i + 1, 2);
      const out = shareMeal(made.world, { stockId: made.stock.id, dish: made.dish, eaterIds: [id, PLAYER] });
      if (typeof out === "string") throw new Error(out);
      w = out.world;
    }
    const r = getRelation(w, PLAYER, id)!;
    expect(r.memories.length).toBeLessThanOrEqual(5);
    expect(r.sharedMeals).toBe(4);
  });
});

describe("cooperative cooking", () => {
  it("a helper adds a small bonus; trust helps and friction hurts", () => {
    const w = withCompanion();
    const id = w.social.companion!.id;
    const team = { mainId: PLAYER, assistantIds: [id] };
    const solo = planCook(w, "rabbit-stew", 3, null).chanceModifier;
    const trusted = adjustRelation(w, PLAYER, id, { trust: 60, affection: 40 });
    const sore = adjustRelation(w, PLAYER, id, { conflicts: 90, trust: -20 });
    const pTrusted = planCook(trusted, "rabbit-stew", 3, null, team);
    const pSore = planCook(sore, "rabbit-stew", 3, null, team);
    expect(pTrusted.chanceModifier).toBeGreaterThan(solo);
    expect(pTrusted.chanceModifier).toBeGreaterThan(pSore.chanceModifier);
    expect(synergy(sore, PLAYER, id)).toBeLessThan(0);
    expect(pTrusted.chanceModifier - solo).toBeLessThanOrEqual(0.08 + 1e-9); // small on purpose
    expect(pTrusted.coop.notes.join()).toContain("連携");
    expect(pTrusted.stamina).toBeLessThan(planCook(w, "rabbit-stew", 3, null).stamina);
  });

  it("cooking together records it on the pair and in memories", () => {
    const w = withCompanion();
    const id = w.social.companion!.id;
    const before = getRelation(w, PLAYER, id)!;
    const r = cookClean(w, "rabbit-stew", { mainId: PLAYER, assistantIds: [id] });
    const after = getRelation(r.world, PLAYER, id)!;
    expect(after.cookedTogether).toBe(1);
    expect(after.trust).toBeGreaterThan(before.trust);
    expect(after.memories.some((m) => m.kind === "cookTogether")).toBe(true);
    expect(r.coop?.succeeded).toBe(true);
    expect(r.stock.cookedBy).toEqual([PLAYER, id]);
  });

  it("the companion can cook its own dish as the main cook", () => {
    const w = withCompanion(1); // salamander: honey-glazed chicken
    const comp = w.social.companion!;
    const recipeId = comp.signatureRecipeIds[0];
    expect(recipeStatus(w, recipeId)).toBe("unknown");
    const team = { mainId: comp.id, assistantIds: [] };
    expect(planCook(w, recipeId, 2, null, team).problems).not.toContain("この料理は主担当にできない");
    expect(planCook(w, recipeId, 2, null).problems.join()).toContain("試作");
    const r = cook(w, recipeId, team, 5, 2);
    expect(r.stock.cookedBy?.[0]).toBe(comp.id);
    expect(r.world.recipeBook[recipeId]).toBeUndefined(); // the player's recipe book is untouched
    expect(getRelation(r.world, PLAYER, comp.id)!.cookedTogether).toBe(1);
    expect(planCook(w, "rabbit-stew", 2, null, team).problems).toContain("この料理は主担当にできない");
  });
});

describe("ordinary allies", () => {
  function winBattle(w: World): World {
    const made = cook(w, "boar-herb-roast", SOLO, 2, 2);
    for (let seed = 0; seed < 80; seed++) {
      const r = runBattle(made.world, BATTLE_MAP.tutorial, made.dish, seed);
      if (r.winner === "player") return applyBattleResult(made.world, r);
    }
    throw new Error("no win");
  }

  it("two allies with different join conditions", () => {
    expect(ALLIES).toHaveLength(2);
    const [a, b] = ALLIES.map((x) => x.joinConditions!.map((c) => c.kind).sort().join());
    expect(a).not.toBe(b);
    expect(ALLY_MAP.mira.specialties).not.toEqual(ALLY_MAP.teo.specialties);
    expect(ALLY_MAP.mira.eater.taste.sweet).toBeLessThan(0);
    expect(ALLY_MAP.teo.eater.taste.sweet).toBeGreaterThan(0);
  });

  it("Mira joins after meeting, a shared roast and a battle win; party relations appear", () => {
    let w = withCompanion();
    expect(allyStatus(w, "mira")).toBe("unmet");
    const met = talkTo(w, "mira");
    if (typeof met === "string") throw new Error(met);
    expect(met.firstMeeting).toBe(true);
    w = met.world;
    expect(allyStatus(w, "mira")).toBe("met");
    expect(inviteAlly(w, "mira")).toBe("まだ条件を満たしていない");
    w = winBattle(w);
    for (let i = 0; i < 3 && !joinChecks(w, "mira").ok; i++) {
      const made = cook(w, "boar-herb-roast", SOLO, 10 + i, 2);
      const out = shareMeal(made.world, { stockId: made.stock.id, dish: made.dish, eaterIds: ["mira"] });
      if (typeof out === "string") throw new Error(out);
      w = out.world;
    }
    expect(joinChecks(w, "mira").checks.map((c) => c.ok)).toEqual([true, true, true]);
    expect(allyStatus(w, "mira")).toBe("candidate");
    const joined = inviteAlly(w, "mira");
    if (typeof joined === "string") throw new Error(joined);
    w = joined.world;
    expect(allyStatus(w, "mira")).toBe("joined");
    expect(partyMembers(w).map((c) => c.id)).toEqual([w.social.companion!.id, "mira"]);
    // Companion ↔ ally relation exists and moves with a shared meal.
    const cid = w.social.companion!.id;
    const pair0 = getRelation(w, cid, "mira")!;
    expect(pair0).toBeDefined();
    const made = cook(w, "rabbit-stew", SOLO, 21, 3);
    const out = shareMeal(made.world, { stockId: made.stock.id, dish: made.dish, eaterIds: [cid, "mira", PLAYER] });
    if (typeof out === "string") throw new Error(out);
    const pair1 = getRelation(out.world, cid, "mira")!;
    expect(pair1.sharedMeals).toBe(1);
    expect(pair1.memories[0].kind).toBe("sharedMeal");
    // Teo's conditions are different and not met by the same history.
    expect(joinChecks(out.world, "teo").ok).toBe(false);
  });

  it("cooking together with a companion and an ally moves the companion–ally pair", () => {
    let w = withCompanion();
    const cid = w.social.companion!.id;
    w = adjustRelation(w, PLAYER, "teo", { affection: 20, trust: 30, foodCompatibility: 20 });
    expect(availableHelpers(w).map((c) => c.id)).toContain("teo");
    const r = cookClean(w, "rabbit-stew", { mainId: PLAYER, assistantIds: ["teo"] });
    expect(getRelation(r.world, PLAYER, "teo")!.cookedTogether).toBe(1);
    expect(joinChecks(r.world, "teo").ok).toBe(true);
    const j = inviteAlly(r.world, "teo");
    if (typeof j === "string") throw new Error(j);
    expect(getRelation(j.world, cid, "teo")).toBeDefined();
    const ctrl = { mainId: cid, assistantIds: ["teo"] };
    const recipeId = w.social.companion!.signatureRecipeIds[0];
    const r2 = cook(j.world, recipeId, ctrl, 3, 2);
    expect(getRelation(r2.world, cid, "teo")!.cookedTogether).toBe(1);
  });
});

describe("relationship labels", () => {
  it("stage and tendency are derived from numbers and history", () => {
    let w = withCompanion();
    const id = w.social.companion!.id;
    expect(relationStage(getRelation(w, PLAYER, id)).name).toBe("顔見知り");
    w = adjustRelation(w, PLAYER, id, { affection: 50, trust: 50, cookedTogether: 3 });
    expect(relationStage(getRelation(w, PLAYER, id)).name).toBe("信頼している");
    expect(relationTendency(getRelation(w, PLAYER, id)!).label).toBe("息が合う");
    w = adjustRelation(w, PLAYER, id, { conflicts: 60, affection: -60 });
    expect(relationTendency(getRelation(w, PLAYER, id)!).label).toBe("競争的");
  });
});

describe("earlier phases still work with companions around", () => {
  it("Phase 4 eating and battles, Phase 5 derivation", () => {
    const w = withCompanion();
    const made = cook(w, "rabbit-stew", { mainId: PLAYER, assistantIds: [w.social.companion!.id] }, 4, 2);
    const ate = eatAndTaste(made.world, made.stock.id, made.dish);
    expect(typeof ate).not.toBe("string");
    const r = runBattle(made.world, BATTLE_MAP.tutorial, made.dish, 1);
    expect(["player", "rival", "draw"]).toContain(r.winner);
    expect(made.learning.masteryAfter).toBeGreaterThan(made.learning.masteryBefore);
    expect(typeof adoptIdea(made.world, "none", { name: "x", description: "", origin: "" })).toBe("string");
  });
});
