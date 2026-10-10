import type { TastingResult } from "../../types/eating";
import type { FoodMemory, MemoryKind } from "../../types/social";
import { eatPortion } from "../commerce/simpleCook";
import { recordEaten } from "../eater/progression";
import { playerCondition } from "../eating/eat";
import { tasteDish, type TastableDish } from "../eating/tasting";
import type { World } from "../world";
import { getCharacter, line } from "./companion";
import { adjustRelation, getRelation, newMemoryId, PLAYER, relationKey, relationStage, type RelationDelta } from "./relations";

// ふるまう / 一緒に食べる: each eater tastes with their own EaterProfile, so the same dish lands
// differently on each of them. The result moves every pair at the table and leaves food memories.

export interface MealReaction {
  id: string;
  name: string;
  emoji: string;
  tasting: TastingResult;
  liking: number; // -1..1
  reaction: string;
}

export interface MealOutcome {
  world: World;
  reactions: MealReaction[];
  /** Changes to the player's relation with each eater (for the result card). */
  deltas: Record<string, RelationDelta>;
  stageUps: { id: string; stage: string; text: string }[];
  memories: number;
}

const likingOf = (score: number) => Math.max(-1, Math.min(1, (score - 55) / 35));

function reactionText(w: World, id: string, t: TastingResult): string {
  const c = getCharacter(w, id);
  if (!c) return "";
  const good = t.score >= 58;
  const said = line(c, good ? "afterGood" : "afterBad", Math.floor(w.day));
  const why = good ? (t.likes.length ? `（${t.likes.slice(0, 2).join("・")}が気に入った）` : "") : t.dislikes.length ? `（${t.dislikes[0]}が苦手）` : "";
  return `「${said}」${why}`;
}

export function shareMeal(w: World, input: { stockId: string; dish: TastableDish & { recipeId?: string | null }; eaterIds: string[] }): MealOutcome | string {
  const stock = w.dishStock.find((s) => s.id === input.stockId);
  const eaters = [...new Set(input.eaterIds)];
  if (!stock) return "料理がない";
  if (eaters.length === 0) return "食べる人を選んでください";
  if (stock.portions < eaters.length) return `${eaters.length}食必要（残り${stock.portions}食）`;
  if (eaters.includes(PLAYER) && !w.palate) return "先に食遍歴を作ろう";

  const cooks = stock.cookedBy?.length ? stock.cookedBy : [PLAYER];
  const day = Math.floor(w.day) + 1;
  const reactions: MealReaction[] = eaters.map((id) => {
    if (id === PLAYER) {
      const t = tasteDish(input.dish, w.palate!, playerCondition(w));
      return { id, name: "あなた", emoji: "🧑‍🍳", tasting: t, liking: likingOf(t.score), reaction: "" };
    }
    const c = getCharacter(w, id)!;
    const t = tasteDish(input.dish, c.eater);
    return { id, name: c.name, emoji: c.emoji, tasting: t, liking: likingOf(t.score), reaction: reactionText(w, id, t) };
  });

  // Portions: the player's own portion restores stamina; everyone else's simply leaves the pot.
  let world = w;
  for (const id of eaters) {
    if (id === PLAYER) {
      const ate = eatPortion(world, stock.id);
      if (typeof ate === "string") return ate;
      // Phase 9: the player eating at the table counts for the codex and the eater's growth.
      world = recordEaten(ate, { ...input.dish, recipeId: input.dish.recipeId ?? stock.recipeId }, "食卓で").world;
    } else {
      world = { ...world, dishStock: world.dishStock.map((s) => (s.id === stock.id ? { ...s, portions: s.portions - 1 } : s)).filter((s) => s.portions > 0) };
    }
  }

  const before = Object.fromEntries(eaters.map((id) => [id, relationStage(getRelation(w, PLAYER, id)).index]));
  const people = [...new Set([...cooks, ...eaters])];
  const byId = Object.fromEntries(reactions.map((r) => [r.id, r]));
  const deltas: Record<string, RelationDelta> = {};
  let memories = 0;

  for (let i = 0; i < people.length; i++) {
    for (let j = i + 1; j < people.length; j++) {
      const a = people[i], b = people[j];
      const ra = byId[a], rb = byId[b];
      if (!ra && !rb) continue; // two cooks, neither ate: nothing shared at this table
      const d: Required<Pick<RelationDelta, "affection" | "trust" | "foodCompatibility" | "conflicts" | "sharedMeals">> = {
        affection: 0, trust: 0, foodCompatibility: 0, conflicts: 0, sharedMeals: 1,
      };
      // Cook → eater: did the food land?
      for (const [cook, eater] of [[a, b], [b, a]] as const) {
        const re = byId[eater];
        if (!cooks.includes(cook) || !re || cook === eater) continue;
        d.affection += Math.max(-6, Math.min(8, Math.round(2 + 6 * re.liking)));
        d.trust += stock.total >= 55 ? 3 : stock.total < 40 ? -2 : 1;
        d.foodCompatibility += Math.round(8 * re.tasting.compatibility);
      }
      // Both ate: did they enjoy it the same way?
      if (ra && rb) {
        const diff = Math.abs(ra.liking - rb.liking);
        d.foodCompatibility += Math.round(4 - 6 * diff);
        d.affection += 1;
        if (diff > 1.2) d.conflicts += 3;
        else if (ra.liking > 0.3 && rb.liking > 0.3) d.conflicts -= 2;
      }
      const eaterOfPair = [ra, rb].find((r) => r && r.id !== PLAYER) ?? ra ?? rb;
      const first = !getRelation(world, a, b)?.memories.some((m) => m.recipeId === (input.dish.recipeId ?? null));
      const kind: MemoryKind = people.length >= 3 ? "sharedMeal" : first && cooks.includes(PLAYER) ? "firstDish" : "meal";
      const score = eaterOfPair?.tasting.score ?? stock.total;
      const memory: FoodMemory = {
        id: newMemoryId(), dishId: input.dish.id, dishName: input.dish.name, recipeId: input.dish.recipeId ?? null, day, kind,
        reaction: eaterOfPair?.reaction || (eaterOfPair ? `${eaterOfPair.tasting.score}点の食体験` : ""),
        score, liking: eaterOfPair?.liking ?? 0, cookedBy: cooks, sharedWith: people,
        importance: 1 + (first ? 3 : 0) + (people.length >= 3 ? 2 : 0) + (score >= 75 || score <= 35 ? 2 : 0),
      };
      world = adjustRelation(world, a, b, d, memory);
      memories += 1;
      if (a === PLAYER || b === PLAYER) deltas[a === PLAYER ? b : a] = d;
    }
  }

  const stageUps = eaters
    .filter((id) => id !== PLAYER)
    .map((id) => {
      const after = relationStage(world.social.relations[relationKey(PLAYER, id)]);
      const c = getCharacter(world, id)!;
      return after.index > before[id] ? { id, stage: after.name, text: line(c, c.kind === "companion" ? "relationUp" : "progress", day) } : null;
    })
    .filter((x): x is NonNullable<typeof x> => !!x);

  return { world, reactions, deltas, stageUps, memories };
}
