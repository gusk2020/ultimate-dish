import { itemInfo, STORAGE_MAP } from "../../data/items";
import type { InventoryStack, StackState } from "../../types/world";

// Time changes stacks along different routes depending on storage and processing:
//   room → stale → spoiled,  cellar + meat → aging → aged,  salted/dried → preserved,
//   icehouse → slows decay. (Season / weather multipliers can join `decayMultiplier` later.)

export function decayMultiplier(stack: InventoryStack): number {
  const storage = STORAGE_MAP[stack.storageId];
  const info = itemInfo(stack.itemId);
  let m = storage?.decayRate ?? 1;
  if (storage && info && storage.affinity.includes(info.category)) m *= 0.5;
  if (stack.processing === "salted") m *= 0.15;
  if (stack.processing === "dried") m *= 0.1;
  return m;
}

function nextState(stack: InventoryStack, ages: boolean): StackState {
  if (stack.freshness <= 0) return "spoiled";
  if (stack.processing !== "raw") return "preserved";
  if (ages) return stack.freshness < 0.75 ? "aged" : "aging";
  return stack.freshness < 0.45 ? "stale" : "fresh";
}

export function ageStack(stack: InventoryStack, days: number): InventoryStack {
  const info = itemInfo(stack.itemId);
  if (!info || days <= 0 || stack.state === "spoiled") return stack;
  const storage = STORAGE_MAP[stack.storageId];
  const ages = !!storage && info.tags.some((t) => storage.agesTags.includes(t));
  const m = decayMultiplier(stack) * (ages ? 0.6 : 1);
  const freshness = Math.max(0, stack.freshness - (days / info.shelfLifeDays) * m);
  const next = { ...stack, freshness };
  next.state = nextState(next, ages);
  return next;
}

export function ageInventory(stacks: InventoryStack[], days: number): InventoryStack[] {
  return stacks.map((s) => ageStack(s, days));
}

/** Quality an item brings into a dish right now. Aged meat gains a little. */
export function usableQuality(stack: InventoryStack): number {
  if (stack.state === "spoiled") return 0;
  const bonus = stack.state === "aged" ? 0.1 : 0;
  return Math.min(1.2, stack.quality * (0.5 + 0.5 * stack.freshness) + bonus);
}

export function isUsable(stack: InventoryStack): boolean {
  return stack.state !== "spoiled" && stack.quantity > 0;
}

export function availableAmount(stacks: InventoryStack[], itemId: string): number {
  return stacks.filter((s) => s.itemId === itemId && isUsable(s)).reduce((a, s) => a + s.quantity, 0);
}

/** Average usable quality of an item across stacks, earliest-expiring first (what gets used). */
export function itemQuality(stacks: InventoryStack[], itemId: string): number {
  const usable = stacks.filter((s) => s.itemId === itemId && isUsable(s));
  if (!usable.length) return 0.6;
  return usable.reduce((a, s) => a + usableQuality(s) * s.quantity, 0) / usable.reduce((a, s) => a + s.quantity, 0);
}

/** Takes `amount` from the earliest-expiring usable stacks. Returns null if there is not enough. */
export function consume(stacks: InventoryStack[], itemId: string, amount: number): InventoryStack[] | null {
  if (availableAmount(stacks, itemId) + 1e-9 < amount) return null;
  let left = amount;
  const order = stacks
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => s.itemId === itemId && isUsable(s))
    .sort((a, b) => a.s.useByDay - b.s.useByDay);
  const out = [...stacks];
  for (const { s, i } of order) {
    if (left <= 1e-9) break;
    const take = Math.min(s.quantity, left);
    out[i] = { ...s, quantity: Math.round((s.quantity - take) * 100) / 100 };
    left -= take;
  }
  return out.filter((s) => s.quantity > 1e-9);
}

export function upkeepPerDay(stacks: InventoryStack[]): number {
  const used = new Set(stacks.map((s) => s.storageId));
  return [...used].reduce((a, id) => a + (STORAGE_MAP[id]?.upkeepPerDay ?? 0), 0);
}

export function storageLoad(stacks: InventoryStack[], storageId: string): number {
  return stacks.filter((s) => s.storageId === storageId).reduce((a, s) => a + s.quantity, 0);
}

export const STATE_LABEL: Record<StackState, string> = {
  fresh: "新鮮", stale: "劣化", spoiled: "腐敗（飼料・肥料へ）", aging: "熟成中", aged: "熟成", preserved: "保存食",
};
