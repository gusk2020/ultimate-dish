import { itemInfo } from "../../data/items";
import { SLOTS, type Slot } from "../../data/commerce";
import type { DishStock, StackState } from "../../types/world";
import { maxMP, maxStamina } from "../chef/stats";
import { STATE_LABEL, upkeepPerDay } from "../inventory/inventory";
import { seedFrom } from "../rng";
import { customerVoice } from "../../services/customerVoice";
import { advanceTime, type World } from "../world";
import { contractDay, type ContractDay } from "./contracts";
import { effectivePrice, marketFor, recommendedPrice, sellListing, type ListingResult } from "./sales";

// 1日終了: sales (morning/noon/evening), contract income, leftovers, night-time ageing,
// sleep, upkeep, fame and trends — all in one pure step that also writes the 日報.

export const SLEEP_STAMINA_SHARE = 0.7;
export const SLEEP_MP_SHARE = 0.3;
export const NIGHT_FRESHNESS = 0.8; // dish stock keeps 80% of its freshness per night
export const LEFTOVER_DECISION_PORTIONS = 8;

export interface DailyReport {
  day: number; // the day that ended (1-based)
  listings: ListingResult[];
  slotTotals: Record<Slot, { sold: number; offered: number; revenue: number }>;
  salesRevenue: number;
  materialCost: number;
  purchases: number;
  upkeep: number;
  contracts: ContractDay[];
  endedContracts: string[];
  contractIncome: number;
  profit: number;
  inventoryChanges: { name: string; to: string }[];
  stamina: { before: number; after: number };
  mp: { before: number; after: number };
  fame: { before: number; after: number };
  trends: { tag: string; delta: number }[];
  voices: string[];
  leftovers: { stockId: string; name: string; portions: number; freshness: number; needsDecision: boolean }[];
  discarded: string[];
}

export function endDay(w: World, seed: number): { world: World; report: DailyReport } {
  const dayNo = Math.floor(w.day) + 1;
  const listed = w.dishStock.filter((s) => s.listed && s.portions > 0);
  const market = marketFor(w.fame, w.trends, listed.length);

  // 1. 総菜販売
  const listings = listed.map((s, i) => sellListing(s, market, seedFrom(seed, "sell", i)));
  const soldBy = new Map(listings.map((l) => [l.stockId, l.sold]));
  const slotTotals = { morning: { sold: 0, offered: 0, revenue: 0 }, noon: { sold: 0, offered: 0, revenue: 0 }, evening: { sold: 0, offered: 0, revenue: 0 } };
  for (const l of listings) for (const s of l.slots) {
    slotTotals[s.slot].sold += s.sold;
    slotTotals[s.slot].offered += s.offered;
    slotTotals[s.slot].revenue += s.revenue;
  }
  const salesRevenue = listings.reduce((a, l) => a + l.revenue, 0);

  // 2. レシピ契約
  const contracts = w.contracts.map((c, i) => contractDay(c, seedFrom(seed, "contract", i)));
  const contractIncome = contracts.reduce((a, c) => a + c.income, 0);
  const nextContracts = w.contracts
    .map((c, i) => ({ ...c, daysLeft: c.daysLeft - 1, earned: c.earned + contracts[i].income }))
    .filter((c) => c.daysLeft > 0);
  const endedContracts = w.contracts.filter((c) => c.daysLeft - 1 <= 0).map((c) => `${contracts.find((x) => x.contractId === c.id)?.shopName}：${c.dishName}`);

  // 3. 売れ残り: carried over automatically, losing freshness overnight.
  const discarded: string[] = [];
  const dishStock: DishStock[] = [];
  for (const s of w.dishStock) {
    const portions = s.portions - (soldBy.get(s.id) ?? 0);
    if (portions <= 0) continue;
    const freshness = Math.round(s.freshness * NIGHT_FRESHNESS * 100) / 100;
    if (freshness < 0.2) {
      discarded.push(`${s.name}×${portions}（傷んだため廃棄）`);
      continue;
    }
    dishStock.push({ ...s, portions, freshness });
  }
  const leftovers = dishStock.map((s) => ({
    stockId: s.id, name: s.name, portions: s.portions, freshness: s.freshness,
    needsDecision: s.portions >= LEFTOVER_DECISION_PORTIONS || s.freshness < 0.5,
  }));

  // 4. 夜: time to tomorrow morning (inventory ageing, MP regen, upkeep), then sleep.
  const before = new Map(w.inventory.map((s) => [s.id, s.state]));
  const nextMorning = Math.floor(w.day) + 1.25;
  const upkeep = Math.round(upkeepPerDay(w.inventory) * (nextMorning - w.day) * 100) / 100;
  let world = advanceTime({ ...w, dishStock, contracts: nextContracts }, nextMorning - w.day);
  const inventoryChanges = world.inventory
    .filter((s) => before.has(s.id) && before.get(s.id) !== s.state)
    .map((s) => ({ name: itemInfo(s.itemId)?.name ?? s.itemId, to: STATE_LABEL[s.state as StackState] }));
  const maxSt = maxStamina(world.chef);
  const maxM = maxMP(world.chef);
  const chef = {
    ...world.chef,
    stamina: Math.min(maxSt, world.chef.stamina + Math.ceil(maxSt * SLEEP_STAMINA_SHARE)),
    mp: Math.min(maxM, world.chef.mp + Math.ceil(maxM * SLEEP_MP_SHARE)),
    money: Math.round((world.chef.money + salesRevenue + contractIncome) * 100) / 100,
  };

  // 5. 知名度・流行
  const soldTotal = listings.reduce((a, l) => a + l.sold, 0);
  const pricePenalty = listings.filter((l) => l.priceRatio > 2).length * 2;
  const fameBefore = w.fame.village ?? 0;
  const fameAfter = Math.max(0, Math.round((fameBefore + soldTotal * 0.15 + (contracts.length ? 0.5 : 0) - pricePenalty) * 10) / 10);
  const trends: Record<string, number> = {};
  for (const [k, v] of Object.entries(w.trends)) trends[k] = v * 0.9;
  for (const l of listings) {
    const stock = listed.find((s) => s.id === l.stockId)!;
    for (const t of stock.tags) trends[t] = Math.min(1, (trends[t] ?? 0) + Math.min(0.3, l.sold * 0.01));
  }
  const trendChanges = Object.keys(trends)
    .map((tag) => ({ tag, delta: Math.round((trends[tag] - (w.trends[tag] ?? 0)) * 100) / 100 }))
    .filter((t) => Math.abs(t.delta) >= 0.02);

  world = {
    ...world,
    chef,
    fame: { ...world.fame, village: fameAfter },
    trends,
    ledger: { materialCost: 0, purchases: 0 },
  };

  const profit = Math.round(salesRevenue + contractIncome - w.ledger.materialCost - upkeep);
  return {
    world,
    report: {
      day: dayNo, listings, slotTotals, salesRevenue, materialCost: Math.round(w.ledger.materialCost),
      purchases: Math.round(w.ledger.purchases), upkeep, contracts, endedContracts, contractIncome, profit,
      inventoryChanges, stamina: { before: Math.round(w.chef.stamina), after: Math.round(chef.stamina) },
      mp: { before: w.chef.mp, after: chef.mp }, fame: { before: fameBefore, after: fameAfter },
      trends: trendChanges, voices: customerVoice.comments(listings, seed), leftovers, discarded,
    },
  };
}

// ---- 売れ残りの選択肢 (only offered when a leftover needs a decision) ----

export function discountStock(w: World, id: string): World {
  return {
    ...w,
    dishStock: w.dishStock.map((s) => (s.id === id ? { ...s, price: Math.max(1, Math.round(recommendedPrice(s) * 0.7)), discounted: true, listed: true } : s)),
  };
}

export function discardStock(w: World, id: string): World {
  return { ...w, dishStock: w.dishStock.filter((s) => s.id !== id) };
}

/** まかない: the leftovers feed the cook — one sitting restores stamina, the rest is eaten by helpers. */
export function staffMeal(w: World, id: string): World {
  const s = w.dishStock.find((x) => x.id === id);
  if (!s) return w;
  const gain = Math.round((8 + s.nutrition * 0.2 + s.total * 0.1) * (0.5 + 0.5 * s.freshness));
  return {
    ...discardStock(w, id),
    chef: { ...w.chef, stamina: Math.min(maxStamina(w.chef), w.chef.stamina + gain) },
  };
}

/** 再加工: cook it again into a stew — freshness back up a little, costs stamina. */
export function reprocessStock(w: World, id: string): World {
  return {
    ...w,
    chef: { ...w.chef, stamina: Math.max(0, w.chef.stamina - 5) },
    dishStock: w.dishStock.map((s) =>
      s.id === id ? { ...s, freshness: Math.max(s.freshness, 0.7), total: Math.max(0, s.total - 8), name: s.name.includes("再仕立て") ? s.name : `${s.name}（再仕立て）` } : s,
    ),
  };
}

export const SLOT_LABEL = (slot: Slot) => SLOTS[slot].label;
export { effectivePrice };
