import { describe, expect, it } from "vitest";
import { AGE_MAX, AGE_MIN, GENDER_CHOICES } from "../data/creation";
import { FOOD_STORY } from "../data/foodStory";
import { BATTLE_MAP } from "../data/battles";
import type { GenderExpression } from "../types/identity";
import type { Dish } from "../types";
import {
  clampAge, creationCandidates, creationSteps, finalizeCreation, missingSteps, needsCreation, newDraft, nextStep, previewCompanion,
  stepDone, suggestedStats, type CreationDraft,
} from "./creation/creation";
import { addressFor, firstPersonCandidates } from "./creation/identityText";
import { buyShortage, finishCook, planCook, startCook } from "./commerce/simpleCook";
import { endDay } from "./commerce/day";
import { applyBattleResult, runBattle } from "./battle/battle";
import { eatAndTaste } from "./eating/eat";
import { EMPTY_FINISH, reviewFinish } from "./finish/finish";
import { learnFromTeacher, recipeStatus } from "./learning/recipeBook";
import { getRelation, PLAYER } from "./social/relations";
import { perceivedForm } from "./social/companion";
import { planTravel, travel } from "./travel/travel";
import { createWorld, type World } from "./world";

const STORY = { answers: Object.fromEntries(FOOD_STORY.map((q) => [q.id, q.options[1].id])), freeText: "祖母の豆の煮物" };

/** A complete draft for either route. */
function draft(over: Partial<CreationDraft> = {}): CreationDraft {
  return {
    ...newDraft(),
    lean: "maker", genderExpression: "feminine", age: 22,
    start: "companion", companionPresentation: "boy", temperament: { pace: -0.7, talk: -0.7 }, companionSpeciesId: "salamander", companionName: "カグラ",
    foodStory: STORY, stats: suggestedStats(), statsConfirmed: true,
    ...over,
  };
}
const toolDraft = (over: Partial<CreationDraft> = {}) =>
  draft({ start: "tool", toolId: "jar", companionPresentation: null, companionSpeciesId: null, companionName: null, temperament: {}, ...over });

function born(d: CreationDraft): World {
  const w = finalizeCreation({ ...createWorld(), chef: { ...createWorld().chef, money: 5000 } }, d);
  if (typeof w === "string") throw new Error(w);
  return w;
}

function cook(w: World, recipeId: string, seed = 1) {
  let world = w;
  const b = buyShortage(world, planCook(world, recipeId, 2, null));
  if (typeof b !== "string") world = b;
  const st = startCook(world, planCook(world, recipeId, 2, null), seed);
  if (typeof st === "string") throw new Error(st);
  const review = reviewFinish(EMPTY_FINISH);
  const out = finishCook(st.world, st.session, review.normalized, review);
  return { ...out, dish: { ...out.dish, description: "", image: { kind: "placeholder" as const, emoji: "", colors: ["", ""] as [string, string] } } as Dish };
}

describe("the creation gate", () => {
  it("a new game starts in creation and only leaves it on この人物で始める", () => {
    const w = createWorld();
    expect(needsCreation(w)).toBe(true);
    expect(finalizeCreation(w, newDraft())).toContain("まだ決めていない");
    expect(typeof finalizeCreation(w, draft({ statsConfirmed: false }))).toBe("string");
    const done = born(draft());
    expect(needsCreation(done)).toBe(false);
    expect(done.identity.creationCompleted).toBe(true);
    // a world from before Phase 8 (no identity) counts as an existing player
    const { identity: _omit, ...old } = createWorld();
    expect(needsCreation(old as unknown as World)).toBe(false);
  });
});

describe("choices", () => {
  it("作る側 and 食べる側 are both kept, and drive the companion's opposite role", () => {
    const maker = born(draft({ lean: "maker" }));
    const eater = born(draft({ lean: "eater" }));
    expect(maker.identity.lean).toBe("maker");
    expect(eater.identity.lean).toBe("eater");
    expect(maker.social.persona?.lean).toBe("maker");
    expect(maker.social.companion?.lean).toBe("eater");
    expect(eater.social.companion?.lean).toBe("maker");
  });

  it("all four gender expressions and the age range are accepted, and none of them change abilities", () => {
    expect(GENDER_CHOICES.map((g) => g.id).sort()).toEqual(["androgynous", "feminine", "masculine", "neutral"]);
    expect(clampAge(AGE_MIN - 1)).toBe(15);
    expect(clampAge(AGE_MAX + 1)).toBe(35);
    expect(stepDone(draft({ age: 14 }), "identity")).toBe(false);
    expect(stepDone(draft({ age: 36 }), "identity")).toBe(false);
    expect(stepDone(draft({ age: 15 }), "identity")).toBe(true);
    expect(stepDone(draft({ age: 35 }), "identity")).toBe(true);

    const ref = born(draft());
    const plan = (w: World) => planCook(w, "rabbit-stew", 3, null);
    for (const g of GENDER_CHOICES.map((x) => x.id) as GenderExpression[]) {
      for (const age of [15, 22, 35]) {
        const w = born(draft({ genderExpression: g, age }));
        expect(w.identity.genderExpression).toBe(g);
        expect(w.identity.age).toBe(age);
        expect(w.chef.stats).toEqual(ref.chef.stats);
        expect(w.chef.records).toEqual(ref.chef.records);
        expect(w.chef.mp).toBe(ref.chef.mp);
        expect(w.chef.stamina).toBe(ref.chef.stamina);
        expect(plan(w).chanceModifier).toBe(plan(ref).chanceModifier);
        expect(plan(w).stamina).toBe(plan(ref).stamina);
        expect(w.social.companion?.chef.stats).toEqual(ref.social.companion?.chef.stats);
      }
    }
    // text uses only
    expect(addressFor({ genderExpression: "masculine", age: 18 })).toBe("坊や");
    expect(addressFor({ genderExpression: "feminine", age: 25 })).toBe("姉さん");
    expect(firstPersonCandidates("neutral").length).toBeGreaterThan(0);
  });

  it("gender and age are never read by cooking, growth, battle or travel code", () => {
    // Every game-logic source file (tests and the creation sequence itself excluded), as text.
    const sources = import.meta.glob("./**/*.ts", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
    const files = Object.entries(sources).filter(([path]) => !path.endsWith(".test.ts") && !path.startsWith("./creation/"));
    expect(files.length).toBeGreaterThan(20);
    // reading the fields (writing defaults, as createWorld does, is fine)
    const offenders = files
      .filter(([, text]) => /\.(genderExpression|companionPresentation|presentationGender)\b|identity\.age\b/.test(text))
      .map(([path]) => path);
    expect(offenders).toEqual([]);
  });
});

describe("routes", () => {
  it("companion route: its own steps, a boy or a girl, with a low-magic appearance", () => {
    expect(creationSteps(draft())).toEqual(["lean", "identity", "start", "companionGender", "companion", "foodStory", "stats", "confirm"]);
    const boy = born(draft({ companionPresentation: "boy" }));
    const girl = born(draft({ companionPresentation: "girl", companionName: "ホムラ" }));
    for (const w of [boy, girl]) {
      const c = w.social.companion!;
      expect(w.social.companionChoice).toBe("accepted");
      expect(c.lowMagicAppearance?.label).toBeTruthy();
      expect(c.lowMagicAppearance?.remark).toBeTruthy();
      expect(c.trueNature).toBeTruthy();
      expect(perceivedForm(c, "player")).toBe(c.visibleForm);
      expect(perceivedForm(c, { magic: 5 })).toBe(c.lowMagicAppearance!.label);
      expect(getRelation(w, PLAYER, c.id)).toBeDefined();
      expect(w.tools).toEqual([]); // the companion instead of a tool
      expect(w.identity.startingToolId).toBeNull();
    }
    expect(boy.social.companion!.presentationGender).toBe("boy");
    expect(girl.social.companion!.presentationGender).toBe("girl");
    expect(girl.social.companion!.name).toBe("ホムラ");
    expect(girl.social.companion!.dialogue.success?.[0]).not.toContain("オレ"); // the girl's lines change words, never abilities
    expect(girl.social.companion!.chef.stats).toEqual(boy.social.companion!.chef.stats);
    expect(girl.social.companion!.eater.taste).toEqual(boy.social.companion!.eater.taste);
  });

  it("tool route: skips the companion screens and owns only the chosen tool", () => {
    const d = toolDraft();
    const steps = creationSteps(d);
    expect(steps).toContain("tool");
    expect(steps).not.toContain("companionGender");
    expect(steps).not.toContain("companion");
    expect(nextStep(d, "start", false)).toBe("tool");
    expect(nextStep(d, "tool", false)).toBe("foodStory");
    const w = born(d);
    expect(w.social.companion).toBeNull();
    expect(w.social.companionChoice).toBe("declined");
    expect(w.tools.map((t) => t.toolId)).toEqual(["jar"]);
    expect(w.identity.startingToolId).toBe("jar");
    expect(planCook(w, "hanna-pickled-cabbage", 1, "stone").problems.join()).toContain("魔導具");
  });

  it("candidates follow the chosen presentation and still complement the player", () => {
    const boys = creationCandidates(createWorld(), draft({ companionPresentation: "boy", statsConfirmed: false, foodStory: null }));
    const girls = creationCandidates(createWorld(), draft({ companionPresentation: "girl", statsConfirmed: false, foodStory: null }));
    expect(boys).toHaveLength(3);
    expect(boys.every((c) => c.presentationGender === "boy")).toBe(true);
    expect(girls.every((c) => c.presentationGender === "girl")).toBe(true);
    expect(boys.map((c) => c.name)).not.toEqual(girls.map((c) => c.name));
    expect(boys.every((c) => c.personality.pace > 0 && c.personality.talk > 0)).toBe(true); // careful, quiet player
    // food / stats not decided yet, and no two cards repeat the same reason
    expect(boys.every((c) => c.complement!.at(-1)!.includes("このあと"))).toBe(true);
    const middle = boys.flatMap((c) => c.complement!.slice(1, -1));
    expect(new Set(middle).size).toBe(middle.length);
    const final = previewCompanion(createWorld(), draft());
    expect(final?.complement).toHaveLength(3);
    expect(final?.complement!.at(-1)).not.toContain("このあと");
  });
});

describe("food story and stats", () => {
  it("the food story and the allocation are saved as chosen", () => {
    const stats = { tech: 15, knowledge: 5, luck: 10, magic: 5, strength: 15 };
    const w = born(draft({ stats }));
    expect(w.palate).not.toBeNull();
    expect(w.palate!.memories?.length).toBe(FOOD_STORY.length + 1);
    expect(w.chef.stats).toEqual(stats);
    expect(w.chef.allocationLocked).toBe(true);
    // unspent points do not count as a finished allocation
    expect(stepDone(draft({ stats: { tech: 5, knowledge: 5, luck: 5, magic: 5, strength: 5 } }), "stats")).toBe(false);
    expect(stepDone(draft({ stats: { tech: 16, knowledge: 5, luck: 5, magic: 5, strength: 14 } }), "stats")).toBe(false);
  });
});

describe("confirmation edits", () => {
  it("a change made from the confirmation screen returns there, asking only what the change opened", () => {
    const d = toolDraft();
    expect(missingSteps(d)).toEqual([]);
    // food story edited → back to confirm
    expect(nextStep({ ...d, foodStory: { ...STORY, freeText: "" } }, "foodStory", true)).toBe("confirm");
    // tool → companion: the companion screens are asked, then confirm
    const switched: CreationDraft = { ...d, start: "companion" };
    expect(nextStep(switched, "start", true)).toBe("companionGender");
    const g = { ...switched, companionPresentation: "girl" as const };
    expect(nextStep(g, "companionGender", true)).toBe("companion");
    const c = { ...g, temperament: { pace: 0.7, talk: 0.7 }, companionSpeciesId: "owl", companionName: "セピア" };
    expect(nextStep(c, "companion", true)).toBe("confirm");
    expect(born(c).social.companion?.name).toBe("セピア");
  });
});

describe("after creation, Phases 3-7 still work", () => {
  it("cooking, selling, a day passing, eating, a battle, learning and travel", () => {
    for (const w0 of [born(draft()), born(toolDraft({ toolId: "stone" }))]) {
      const made = cook(w0, "rabbit-stew", 2);
      const sold = endDay({ ...made.world, dishStock: made.world.dishStock.map((s) => ({ ...s, listed: true })) }, 3);
      expect(sold.world.day).toBeGreaterThan(made.world.day);
      const ate = eatAndTaste(made.world, made.stock.id, made.dish);
      expect(typeof ate).not.toBe("string");
      const r = runBattle(made.world, BATTLE_MAP.tutorial, made.dish, 1);
      expect(applyBattleResult(made.world, r).battleLog).toHaveLength(1);
      const t = learnFromTeacher(made.world, "hanna", "hanna-pickled-cabbage");
      expect(recipeStatus(t.world, "hanna-pickled-cabbage")).not.toBe("unknown");
      const trip = travel(made.world, planTravel(made.world, "rivertown", made.world.social.companion ? [made.world.social.companion.id] : []), 1);
      expect(typeof trip).not.toBe("string");
    }
  });
});
