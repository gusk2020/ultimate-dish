import { createRng, seedFrom } from "../rng";
import { slotIndex } from "../time/calendar";
import { locationOf } from "../travel/market";
import type { World } from "../world";

// 厨房を借りる (Phase 10): there is no home kitchen. Cooking happens in a rented guild kitchen,
// the inn's shared kitchen, or a kitchen a host provides for an event (free, that event only).
// Fewer limits + more room + bigger batches = a higher price.

export type KitchenKind = "inn" | "guild" | "event";

export interface KitchenFacility {
  id: string;
  name: string;
  emoji: string;
  kind: KitchenKind;
  /** Cooking methods allowed here ("all" = no limit). */
  allowedMethods: string[] | "all";
  /** Most portions per cook. */
  capacity: number;
  toolSupport: boolean;
  cost: number;
  /** Chance of being free in a given part of the day. */
  availability: number;
  note: string;
}

const BASIC = ["cut", "boil", "grill", "saute", "reduce", "steam"];

export const KITCHENS: KitchenFacility[] = [
  { id: "inn-shared", name: "宿屋の共同台所", emoji: "🛖", kind: "inn", allowedMethods: BASIC, capacity: 2, toolSupport: false, cost: 3, availability: 0.95, note: "安いが狭く、他の客と共用。特殊な工程や大量調理はできない" },
  { id: "guild-small", name: "ギルド小厨房", emoji: "🔪", kind: "guild", allowedMethods: [...BASIC, "fry"], capacity: 3, toolSupport: false, cost: 6, availability: 0.9, note: "一人用。基本の技法だけ" },
  { id: "guild-standard", name: "ギルド標準厨房", emoji: "🍳", kind: "guild", allowedMethods: [...BASIC, "fry", "pressure"], capacity: 10, toolSupport: true, cost: 15, availability: 0.8, note: "5〜10食向け。魔導具も使える" },
  { id: "guild-preserve", name: "ギルド燻製・発酵室", emoji: "🪵", kind: "guild", allowedMethods: ["cut", "boil", "smoke", "ferment", "pickle", "dry"], capacity: 10, toolSupport: true, cost: 20, availability: 0.75, note: "燻製・発酵・漬け・干しの専門設備" },
  { id: "guild-large", name: "ギルド大厨房", emoji: "🏰", kind: "guild", allowedMethods: "all", capacity: 60, toolSupport: true, cost: 40, availability: 0.7, note: "大量調理向け。制限はほぼない" },
];

export const EVENT_KITCHEN: KitchenFacility = {
  id: "event", name: "主催者の厨房", emoji: "🎪", kind: "event", allowedMethods: "all", capacity: 20, toolSupport: true, cost: 0, availability: 1,
  note: "依頼・勝負の主催者が用意した厨房。使用料なし・この催しのためだけ",
};

export const KITCHEN_MAP: Record<string, KitchenFacility> = Object.fromEntries([...KITCHENS, EVENT_KITCHEN].map((k) => [k.id, k]));

export interface KitchenState {
  /** Paid for this part of the day at this place. */
  rental: { kitchenId: string; slot: number; locationId: string } | null;
  /** Provided by a host for one cook (a quest or a battle). */
  event: { label: string; sourceId: string } | null;
}

export const kitchenStateOf = (w: Pick<World, "kitchen">): KitchenState => w.kitchen ?? { rental: null, event: null };

/** Luck helps a little: up to +10%. */
export function availabilityFor(w: World, k: KitchenFacility): number {
  return Math.min(0.99, k.availability + Math.max(0, Math.min(0.1, (w.chef.stats.luck - 5) * 0.01)));
}

/** Free or taken — fixed for a given place, kitchen and part of the day (no re-rolling by tapping). */
export function isAvailable(w: World, k: KitchenFacility): boolean {
  if (k.kind === "event") return !!kitchenStateOf(w).event;
  if (isRentedHere(w, k.id)) return true;
  const roll = createRng(seedFrom("kitchen", locationOf(w).id, k.id, slotIndex(w.day)))();
  return roll < availabilityFor(w, k);
}

export function isRentedHere(w: World, kitchenId: string): boolean {
  const r = kitchenStateOf(w).rental;
  return !!r && r.kitchenId === kitchenId && r.slot === slotIndex(w.day) && r.locationId === locationOf(w).id;
}

/** Kitchens offered where the player is: the inn and the guild, plus a host's kitchen during an event. */
export function kitchensHere(w: World): KitchenFacility[] {
  return kitchenStateOf(w).event ? [EVENT_KITCHEN, ...KITCHENS] : KITCHENS;
}

export interface CookNeeds {
  methodIds: string[];
  portions: number;
  usesTool: boolean;
}

/** Why this dish cannot be cooked here (empty = it can). */
export function kitchenProblems(k: KitchenFacility, needs: CookNeeds): string[] {
  const out: string[] = [];
  if (k.allowedMethods !== "all") {
    const allowed = k.allowedMethods;
    const missing = [...new Set(needs.methodIds.filter((m) => !allowed.includes(m)))];
    if (missing.length) out.push(`設備がない工程：${missing.join("・")}`);
  }
  if (needs.portions > k.capacity) out.push(`${k.capacity}食まで`);
  if (needs.usesTool && !k.toolSupport) out.push("魔導具は使えない");
  return out;
}

export type KitchenStatus = "ok" | "taken" | "unsuitable" | "money";

export function kitchenStatus(w: World, k: KitchenFacility, needs: CookNeeds): { status: KitchenStatus; problems: string[] } {
  const problems = kitchenProblems(k, needs);
  if (!isAvailable(w, k)) return { status: "taken", problems: ["今日は埋まっている（次の時間帯なら空くかも）"] };
  if (problems.length) return { status: "unsuitable", problems };
  if (!isRentedHere(w, k.id) && w.chef.money < k.cost) return { status: "money", problems: ["お金が足りない"] };
  return { status: "ok", problems: [] };
}

/** The cheapest kitchen that works for this cook right now (the host's kitchen first). */
export function suggestKitchen(w: World, needs: CookNeeds): KitchenFacility | null {
  return [...kitchensHere(w)].sort((a, b) => a.cost - b.cost).find((k) => kitchenStatus(w, k, needs).status === "ok") ?? null;
}

/** 借りる: pay and hold it for this part of the day. Renting the same one again costs nothing. */
export function rentKitchen(w: World, kitchenId: string, needs: CookNeeds): World | string {
  const k = KITCHEN_MAP[kitchenId];
  if (!k) return "そんな厨房はない";
  const st = kitchenStatus(w, k, needs);
  if (st.status !== "ok") return st.problems.join("、");
  if (k.kind === "event" || isRentedHere(w, k.id)) return w;
  return {
    ...w,
    chef: { ...w.chef, money: Math.round((w.chef.money - k.cost) * 100) / 100 },
    kitchen: { ...kitchenStateOf(w), rental: { kitchenId: k.id, slot: slotIndex(w.day), locationId: locationOf(w).id } },
  };
}

/** After cooking: an event kitchen is used up (a rental simply expires with the time of day). */
export function afterCooking(w: World, kitchenId: string): World {
  return kitchenId === "event" ? { ...w, kitchen: { ...kitchenStateOf(w), event: null } } : w;
}

/** A host provides a kitchen for this quest / battle. */
export function offerEventKitchen(w: World, label: string, sourceId: string): World {
  return { ...w, kitchen: { ...kitchenStateOf(w), event: { label, sourceId } } };
}
