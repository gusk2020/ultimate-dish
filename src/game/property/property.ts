import {
  BANK_BRANCHES, BANK_OPEN_FEE, FOOD_STORAGE_MAP, GUILD_PLAN_MAP, GUILD_TOWNS, HOUSE, PORTABLE_KITCHENS, SAFE_CASH, SHOP,
  type FoodStorageFacility,
} from "../../data/property";
import type { StoredFood } from "../../types/life";
import type { DishStock, InventoryStack } from "../../types/world";
import { NIGHT_FRESHNESS } from "../commerce/day";
import { createRng, seedFrom } from "../rng";
import { locationOf } from "../travel/market";
import type { World } from "../world";

// 不動産・保存・ギルド共有倉庫・銀行 (Phase 11).

const here = (w: World) => locationOf(w).id;
const pay = (w: World, cost: number): World => ({ ...w, chef: { ...w.chef, money: Math.round((w.chef.money - cost) * 100) / 100 } });
const prop = (w: World) => w.property ?? { houses: [], shops: [], portableKitchens: [] };
const storage = (w: World) => w.foodStorage ?? { facilities: [] };

// ---------- Property ----------

export function buyHouse(w: World): World | string {
  if (prop(w).houses.includes(here(w))) return "この土地にはもう家がある";
  if (w.chef.money < HOUSE.price) return "お金が足りない";
  const p = prop(w);
  return addStorage({ ...pay(w, HOUSE.price), property: { ...p, houses: [...p.houses, here(w)] } }, HOUSE.storageId, here(w));
}

export function buyShop(w: World): World | string {
  if (prop(w).shops.includes(here(w))) return "この土地にはもう店がある";
  if (w.chef.money < SHOP.price) return "お金が足りない";
  const p = prop(w);
  return addStorage({ ...pay(w, SHOP.price), property: { ...p, shops: [...p.shops, here(w)] } }, SHOP.storageId, here(w));
}

export function buyPortableKitchen(w: World, id: string): World | string {
  const def = PORTABLE_KITCHENS.find((k) => k.id === id);
  if (!def) return "そんな厨房はない";
  if (prop(w).portableKitchens.includes(id)) return "もう持っている";
  if (w.chef.money < def.price) return "お金が足りない";
  const p = prop(w);
  return { ...pay(w, def.price), property: { ...p, portableKitchens: [...p.portableKitchens, id] } };
}

// ---------- Food storage ----------

function addStorage(w: World, facilityId: string, locationId: string | null): World {
  const f = FOOD_STORAGE_MAP[facilityId];
  return { ...w, foodStorage: { facilities: [...storage(w).facilities, { facilityId, locationId: f.portable ? null : locationId, items: [] }] } };
}

export function buyStorage(w: World, facilityId: string): World | string {
  const f = FOOD_STORAGE_MAP[facilityId];
  if (!f || f.builtIn) return "単体では買えない";
  if (w.chef.money < f.price) return "お金が足りない";
  return addStorage(pay(w, f.price), facilityId, null);
}

/** Storage you can reach now: portable ones, and fixed ones in this place. */
export function storagesHere(w: World): { index: number; facility: FoodStorageFacility; items: StoredFood[] }[] {
  return storage(w).facilities
    .map((s, index) => ({ index, facility: FOOD_STORAGE_MAP[s.facilityId], items: s.items, locationId: s.locationId }))
    .filter((s) => s.facility && (s.locationId === null || s.locationId === here(w)));
}

const used = (items: StoredFood[]) => items.reduce((a, i) => a + (i.stock?.portions ?? i.stack?.quantity ?? 0), 0);
let storedCounter = 0;
const newId = () => `stored-${Date.now().toString(36)}-${++storedCounter}`;

/** 保存する: a dish from your stock goes into one of your storages. */
export function storeDish(w: World, index: number, stockId: string): World | string {
  const s = storagesHere(w).find((x) => x.index === index);
  const stock = w.dishStock.find((d) => d.id === stockId);
  if (!s || !stock) return "保存先か料理がない";
  if (used(s.items) + stock.portions > s.facility.capacity) return `${s.facility.name}がいっぱい`;
  const item: StoredFood = { id: newId(), kind: "dish", stock: { ...stock, listed: false }, storedDay: w.day, from: here(w) };
  const facilities = storage(w).facilities.map((f, i) => (i === index ? { ...f, items: [...f.items, item] } : f));
  return { ...w, dishStock: w.dishStock.filter((d) => d.id !== stockId), foodStorage: { facilities } };
}

export function takeStored(w: World, index: number, itemId: string): World | string {
  const s = storagesHere(w).find((x) => x.index === index);
  const item = s?.items.find((i) => i.id === itemId);
  if (!s || !item) return "取り出せない";
  const facilities = storage(w).facilities.map((f, i) => (i === index ? { ...f, items: f.items.filter((x) => x.id !== itemId) } : f));
  return restore({ ...w, foodStorage: { facilities } }, item);
}

function restore(w: World, item: StoredFood): World {
  if (item.stock) return { ...w, dishStock: [...w.dishStock, item.stock] };
  if (item.stack) return { ...w, inventory: [...w.inventory, item.stack] };
  return w;
}

/** One night: stored food keeps better (by the facility), magic storage costs MP. */
export function nightlyStorage(w: World): World {
  let mp = w.chef.mp;
  const facilities = storage(w).facilities.map((f) => {
    const def = FOOD_STORAGE_MAP[f.facilityId];
    if (!def) return f;
    let mult = def.freshnessMultiplier;
    if (def.magicCost) {
      if (mp >= def.magicCost) mp -= def.magicCost;
      else mult = 1; // no MP, no magic: it keeps like an ordinary box
    }
    return { ...f, items: f.items.map((i) => decay(i, mult, 1)) };
  });
  return { ...w, chef: { ...w.chef, mp }, foodStorage: { facilities } };
}

function decay(i: StoredFood, mult: number, nights: number): StoredFood {
  const loss = (1 - NIGHT_FRESHNESS) * mult;
  const f = (x: number) => Math.round(x * Math.pow(1 - loss, nights) * 100) / 100;
  if (i.stock) return { ...i, stock: { ...i.stock, freshness: f(i.stock.freshness) } };
  if (i.stack) return { ...i, stack: { ...i.stack, freshness: f(i.stack.freshness) } };
  return i;
}

// ---------- ギルド共有魔力食在庫 ----------

/** What someone might try to put in: only food that is not alive gets in. */
export type DepositItem =
  | { type: "dish"; stockId: string }
  | { type: "ingredient"; stackId: string }
  | { type: "money"; amount: number }
  | { type: "tool"; toolId: string }
  | { type: "item"; name: string }
  | { type: "living"; name: string };

export const isGuildTown = (w: World) => GUILD_TOWNS.includes(here(w));

export function subscribeGuildStorage(w: World, planId: string): World | string {
  if (!GUILD_PLAN_MAP[planId]) return "そんなプランはない";
  if (!isGuildTown(w)) return "ここにはギルドがない";
  return { ...w, guildStorage: { ...(w.guildStorage ?? { items: [] }), plan: planId, items: w.guildStorage?.items ?? [] } };
}

export function guildDeposit(w: World, item: DepositItem): World | string {
  const g = w.guildStorage ?? { plan: null, items: [] };
  if (!g.plan) return "共有倉庫の契約がない";
  if (!isGuildTown(w)) return "ここにはギルドがない";
  switch (item.type) {
    case "money": return "お金は預けられない（銀行へ）";
    case "tool": return "道具は預けられない（食品だけ）";
    case "item": return "一般の品は預けられない（食品だけ）";
    case "living": return "生きているものは預けられない（生きていない食品だけ）";
    case "dish": {
      const stock = w.dishStock.find((d) => d.id === item.stockId);
      if (!stock) return "料理がない";
      const stored: StoredFood = { id: newId(), kind: "dish", stock: { ...stock, listed: false }, storedDay: w.day, from: here(w) };
      return { ...w, dishStock: w.dishStock.filter((d) => d.id !== item.stockId), guildStorage: { ...g, items: [...g.items, stored] } };
    }
    case "ingredient": {
      const stack = w.inventory.find((s) => s.id === item.stackId);
      if (!stack) return "食材がない";
      const stored: StoredFood = { id: newId(), kind: "ingredient", stack, storedDay: w.day, from: here(w) };
      return { ...w, inventory: w.inventory.filter((s) => s.id !== item.stackId), guildStorage: { ...g, items: [...g.items, stored] } };
    }
  }
}

/** 取り出す at any connected guild; freshness follows the plan for the days it was kept. */
export function guildWithdraw(w: World, itemId: string): World | string {
  const g = w.guildStorage ?? { plan: null, items: [] };
  if (!isGuildTown(w)) return "ここにはギルドがない";
  const item = g.items.find((i) => i.id === itemId);
  if (!item) return "預けたものがない";
  const plan = GUILD_PLAN_MAP[g.plan ?? "normal"] ?? GUILD_PLAN_MAP.normal;
  const nights = Math.max(0, Math.floor(w.day - item.storedDay));
  return restore({ ...w, guildStorage: { ...g, items: g.items.filter((i) => i.id !== itemId) } }, decay(item, plan.freshnessMultiplier, nights));
}

/** The nightly subscription fee and portable-kitchen upkeep. */
export function nightlyFees(w: World): { world: World; cost: number } {
  const plan = w.guildStorage?.plan ? GUILD_PLAN_MAP[w.guildStorage.plan] : null;
  const upkeep = prop(w).portableKitchens.reduce((a, id) => a + (PORTABLE_KITCHENS.find((k) => k.id === id)?.upkeepPerDay ?? 0), 0);
  const cost = (plan?.feePerDay ?? 0) + upkeep;
  return { world: cost ? pay(w, cost) : w, cost };
}

// ---------- 銀行 (a separate organisation) ----------

export const atBranch = (w: World) => BANK_BRANCHES.includes(here(w));
const bank = (w: World) => w.bank ?? { opened: false, balance: 0, openedDay: null };

export function openAccount(w: World): World | string {
  if (bank(w).opened) return "もう口座がある";
  if (!atBranch(w)) return "ここに銀行の支店はない";
  if (w.chef.money < BANK_OPEN_FEE) return "お金が足りない";
  return { ...pay(w, BANK_OPEN_FEE), bank: { opened: true, balance: 0, openedDay: Math.floor(w.day) + 1 } };
}

export function deposit(w: World, amount: number): World | string {
  const b = bank(w);
  if (!b.opened) return "口座がない";
  if (!atBranch(w)) return "ここに銀行の支店はない";
  const n = Math.floor(amount);
  if (n <= 0 || w.chef.money < n) return "手持ちが足りない";
  return { ...pay(w, n), bank: { ...b, balance: b.balance + n } };
}

export function withdraw(w: World, amount: number): World | string {
  const b = bank(w);
  if (!b.opened) return "口座がない";
  if (!atBranch(w)) return "ここに銀行の支店はない";
  const n = Math.floor(amount);
  if (n <= 0 || b.balance < n) return "残高が足りない";
  return { ...pay(w, -n), bank: { ...b, balance: b.balance - n } };
}

/** Carrying a lot of cash on the road draws thieves; money in the bank is never at risk. */
export function robberyChance(cash: number): number {
  return cash <= SAFE_CASH ? 0 : Math.min(0.3, (cash - SAFE_CASH) / 1500);
}

export function roadRisk(w: World, seed: number): { world: World; lost: number; text: string | null } {
  const cash = w.chef.money;
  const rng = createRng(seedFrom(seed, "thieves"));
  if (rng() >= robberyChance(cash)) return { world: w, lost: 0, text: null };
  const lost = Math.round(cash * (0.15 + rng() * 0.15));
  return { world: pay(w, lost), lost, text: `道中で盗賊に財布を狙われ、${lost}G失った（銀行の預金は無事）` };
}

export type { DishStock, InventoryStack };
