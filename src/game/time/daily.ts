import { maxMP, maxStamina } from "../chef/stats";
import { endDay } from "../commerce/day";
import { consume } from "../inventory/inventory";
import { seedFrom } from "../rng";
import { locationOf } from "../travel/market";
import { advanceTime, type World } from "../world";
import { nextPartStart, partOf, PART_LABEL, slotIndex } from "./calendar";

// 日常生活 (Phase 10): time moves one part of the day per main action (午前 → 午後 → 夜 → 翌日午前),
// the player gets hungry, and eats a ROUTINE MEAL on their own. Routine meals keep you alive and
// nothing else: no cook xp, no eater xp, no codex entry, no report, no derivation.

export interface DailyState {
  /** 0 = full … 1 = starving. Rises by a third each part of the day. */
  hunger: number;
  /** Ready-made routine meals carried (日常食パック). */
  routineMeals: number;
  /** What happened last, for the header / day line (eating, sleeping…). */
  lastNote: string | null;
}

export const newDaily = (): DailyState => ({ hunger: 0.2, routineMeals: 0, lastNote: null });
export const dailyOf = (w: Pick<World, "daily">): DailyState => w.daily ?? newDaily();

export const HUNGER_PER_PART = 1 / 3;
/** At this hunger a routine meal is taken automatically. */
export const MEAL_AT = 0.5;
export const ROUTINE_PACK_PRICE = 2;
/** Cheapest local meal when nothing is carried and nothing can be cooked. */
export const ROUTINE_PRICE: Record<string, number> = { village: 3, rivertown: 3, harbor: 4, highland: 4 };
/** Plain self-catering: a little grain or beans from the pantry. */
const SELF_CATER = [{ itemId: "wheat", amount: 0.3 }, { itemId: "beans", amount: 0.3 }];

export type RoutineSource = "pack" | "selfCook" | "bought" | "none";

/** 日常食: eaten automatically. Money / ingredients only — never xp or codex. */
export function routineMeal(w: World): { world: World; source: RoutineSource; note: string } {
  const d = dailyOf(w);
  const fed = (world: World, note: string, source: RoutineSource) => {
    const max = maxStamina(world.chef);
    return {
      world: { ...world, chef: { ...world.chef, stamina: Math.min(max, world.chef.stamina + Math.ceil(max * 0.08)) }, daily: { ...dailyOf(world), hunger: 0, lastNote: note } },
      source, note,
    };
  };
  if (d.routineMeals > 0) return fed({ ...w, daily: { ...d, routineMeals: d.routineMeals - 1 } }, "日常食：手持ちの日常食パックを食べた", "pack");
  for (const s of SELF_CATER) {
    const inv = consume(w.inventory, s.itemId, s.amount);
    if (inv) return fed({ ...w, inventory: inv }, "日常食：手持ちの食材で簡単に自炊した", "selfCook");
  }
  const price = ROUTINE_PRICE[locationOf(w).id] ?? 3;
  if (w.chef.money >= price) {
    return fed({ ...w, chef: { ...w.chef, money: Math.round((w.chef.money - price) * 100) / 100 } }, `日常食：安い食事を買って食べた（${price}G）`, "bought");
  }
  const max = maxStamina(w.chef);
  return {
    world: { ...w, chef: { ...w.chef, stamina: Math.max(0, w.chef.stamina - Math.ceil(max * 0.05)) }, daily: { ...d, lastNote: "食べるものがない……空腹で体力が落ちた" } },
    source: "none", note: "食べるものがない……空腹で体力が落ちた",
  };
}

/** Hunger for the parts of the day that passed, and a routine meal if one is due. */
export function passParts(w: World, parts: number): World {
  if (parts <= 0) return w;
  const d = dailyOf(w);
  const world: World = { ...w, daily: { ...d, hunger: Math.min(1, d.hunger + parts * HUNGER_PER_PART) } };
  return dailyOf(world).hunger >= MEAL_AT ? routineMeal(world).world : world;
}

/**
 * One part of the day passes (待つ, or what is left of a main action). From 夜 it is a night's
 * sleep: the day-end (sales, contracts, stamina / MP) runs and it becomes the next morning.
 */
export function advancePart(w: World): World {
  const from = slotIndex(w.day);
  let world: World;
  if (partOf(w.day).part === 2) {
    world = endDay(w, seedFrom("sleep", from)).world;
    world = { ...world, daily: { ...dailyOf(world), lastNote: "眠って朝になった（体力・MPが回復）" } };
  } else {
    world = advanceTime(w, nextPartStart(w.day) - w.day);
  }
  return passParts(world, slotIndex(world.day) - from);
}

/**
 * Call after a main action (cooking, eating out, a quest, a battle…): at least one part of the
 * day has passed, then hunger and the routine meal for every part that did.
 */
export function completeAction(w: World, fromDay: number): World {
  if (slotIndex(w.day) === slotIndex(fromDay)) return advancePart(w);
  return passParts(w, slotIndex(w.day) - slotIndex(fromDay));
}

export function hungerLabel(w: Pick<World, "daily">): string | null {
  const h = dailyOf(w).hunger;
  return h >= 0.9 ? "空腹！食事が必要" : h >= 0.45 ? "そろそろ食事が必要" : null;
}

/** 日常食パックを買う (carried, eaten automatically later). */
export function buyRoutinePacks(w: World, n: number): World | string {
  const cost = ROUTINE_PACK_PRICE * n;
  if (w.chef.money < cost) return "お金が足りない";
  const d = dailyOf(w);
  return { ...w, chef: { ...w.chef, money: w.chef.money - cost }, daily: { ...d, routineMeals: d.routineMeals + n } };
}

export const sleepRecovery = (w: World) => ({ stamina: maxStamina(w.chef), mp: maxMP(w.chef) });
export const partName = (day: number) => PART_LABEL[partOf(day).part];
