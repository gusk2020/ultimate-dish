import { itemInfo } from "../../data/items";
import { getRecipe, discoverRecipe, recipeStatus } from "../learning/recipeBook";
import { CUISINE_LABEL, HOME_LOCATION_ID, LOCATION_MAP, LOCATIONS, RATION_PRICE } from "../../data/regions";
import type { LocationDef, RegionalCuisineProfile, TravelLog } from "../../types/travel";
import type { InventoryStack } from "../../types/world";
import { maxStamina } from "../chef/stats";
import { NIGHT_FRESHNESS, SLEEP_STAMINA_SHARE } from "../commerce/day";
import { ageInventory } from "../inventory/inventory";
import { createRng, seedFrom } from "../rng";
import { getCharacter, hasCompanion } from "../social/companion";
import { adjustRelation, PLAYER } from "../social/relations";
import { advanceTime, type World } from "../world";
import { locationOf, regionOf } from "./market";

// 旅: the player picks a destination and who comes along; everything else is automatic.
// The journey is quiet: time passes (inventory ages, MP returns, upkeep is paid), road
// rations are taken from preserved dishes or bought, and companions share the road.

// ---------- The map (graph only) ----------

export function isUnlocked(w: World, id: string): boolean {
  const loc = LOCATION_MAP[id];
  return !!loc && loc.unlock.every((c) => c.kind === "visited" && w.travel.visitedLocationIds.includes(c.locationId));
}

export function unlockText(loc: LocationDef): string {
  return loc.unlock.map((c) => `${LOCATION_MAP[c.locationId]?.name ?? c.locationId}に一度着くと行ける`).join("・");
}

/** Shortest route over unlocked places (Dijkstra; the graph is tiny). */
export function findRoute(w: World, from: string, to: string): { path: string[]; days: number } | null {
  if (from === to || !isUnlocked(w, to)) return null;
  const dist: Record<string, number> = { [from]: 0 };
  const prev: Record<string, string> = {};
  const open = new Set([from]);
  while (open.size) {
    const cur = [...open].reduce((a, b) => (dist[a] <= dist[b] ? a : b));
    open.delete(cur);
    if (cur === to) break;
    for (const c of LOCATION_MAP[cur]?.connections ?? []) {
      if (!isUnlocked(w, c.to)) continue;
      const d = dist[cur] + c.travelDays;
      if (dist[c.to] === undefined || d < dist[c.to]) {
        dist[c.to] = d;
        prev[c.to] = cur;
        open.add(c.to);
      }
    }
  }
  if (dist[to] === undefined) return null;
  const path = [to];
  while (path[0] !== from) path.unshift(prev[path[0]]);
  return { path, days: dist[to] };
}

/** Every other place: reachable ones with their route, locked ones with what opens them. */
export function destinations(w: World) {
  const here = w.travel.currentLocationId;
  return LOCATIONS.filter((l) => l.id !== here).map((loc) => ({ loc, unlocked: isUnlocked(w, loc.id), route: findRoute(w, here, loc.id) }));
}

/** "この土地では鮮度と香りを重んじる": the profile's two strongest traits. */
export function cuisineLine(c: RegionalCuisineProfile): string {
  const top = (Object.entries(c) as [keyof RegionalCuisineProfile, number][]).sort((a, b) => b[1] - a[1]).slice(0, 2);
  return `この土地では${top.map(([k]) => CUISINE_LABEL[k]).join("と")}を重んじる`;
}

// ---------- Provisions ----------

/** One road ration per traveller per day (a portion of food is a day's ration on the road). */
export const MEALS_PER_DAY = 1;

export interface ProvisionPlan {
  needed: number;
  fromStock: { stockId: string; name: string; portions: number }[];
  fromStockTotal: number;
  toBuy: number;
  unitPrice: number;
  bought: number;
  cost: number;
  hungry: number; // meals neither in stock nor affordable: walked hungry, never a reason to stay home
}

/** Preserved dishes first (oldest first), the rest bought at the local price; short money → hungry, not blocked. */
export function provisionPlan(w: World, days: number, partySize: number): ProvisionPlan {
  const needed = Math.ceil(days * partySize * MEALS_PER_DAY);
  const preserved = w.dishStock.filter((s) => s.tags.includes("preserved") && s.portions > 0).sort((a, b) => a.freshness - b.freshness);
  const fromStock: ProvisionPlan["fromStock"] = [];
  let left = needed;
  for (const s of preserved) {
    if (left <= 0) break;
    const take = Math.min(left, Math.floor(s.portions));
    if (take <= 0) continue;
    fromStock.push({ stockId: s.id, name: s.name, portions: take });
    left -= take;
  }
  const unitPrice = Math.round(RATION_PRICE * regionOf(w).rationMult * 10) / 10;
  const bought = Math.max(0, Math.min(left, Math.floor(Math.max(0, w.chef.money) / unitPrice)));
  return {
    needed, fromStock, fromStockTotal: needed - left, toBuy: left, unitPrice, bought,
    cost: Math.round(bought * unitPrice * 10) / 10, hungry: left - bought,
  };
}

// ---------- Freshness ----------

export interface FreshnessChange {
  itemId: string;
  name: string;
  emoji: string;
  before: number;
  after: number;
  spoiled: boolean;
}

/** Perishables that will clearly lose freshness over `days` (the existing ageing rules, nothing new). */
export function freshnessChanges(before: InventoryStack[], after: InventoryStack[]): FreshnessChange[] {
  const byId = new Map(after.map((s) => [s.id, s]));
  const worst = new Map<string, FreshnessChange>();
  for (const b of before) {
    const a = byId.get(b.id);
    if (!a || b.state === "spoiled" || b.freshness - a.freshness < 0.1) continue;
    const info = itemInfo(b.itemId);
    const cur = worst.get(b.itemId);
    if (!cur || a.freshness < cur.after) {
      worst.set(b.itemId, { itemId: b.itemId, name: info?.name ?? b.itemId, emoji: info?.emoji ?? "", before: b.freshness, after: a.freshness, spoiled: a.state === "spoiled" });
    }
  }
  return [...worst.values()].sort((x, y) => x.after - y.after);
}

export function freshnessPreview(w: World, days: number): FreshnessChange[] {
  return freshnessChanges(w.inventory, ageInventory(w.inventory, days));
}

// ---------- Planning and travelling ----------

/** Who may come: the companion and party members. */
export function travelCompanions(w: World): string[] {
  return [...(hasCompanion(w) ? [w.social.companion!.id] : []), ...w.social.party];
}

export interface TravelPlan {
  to: string;
  route: { path: string[]; days: number } | null;
  companions: string[];
  partySize: number;
  provisions: ProvisionPlan;
  freshness: FreshnessChange[];
  problems: string[];
}

export function planTravel(w: World, to: string, companions: string[]): TravelPlan {
  const route = findRoute(w, w.travel.currentLocationId, to);
  const allowed = travelCompanions(w);
  const problems: string[] = [];
  if (to === w.travel.currentLocationId) problems.push("いまいる場所だ");
  else if (!isUnlocked(w, to)) problems.push(unlockText(LOCATION_MAP[to]) || "まだ行けない");
  else if (!route) problems.push("道がつながっていない");
  if (companions.some((id) => !allowed.includes(id))) problems.push("同行できない人がいる");
  const partySize = 1 + companions.length;
  const days = route?.days ?? 0;
  return { to, route, companions, partySize, provisions: provisionPlan(w, days, partySize), freshness: freshnessPreview(w, days), problems };
}

/** Very rare, harmless: a rainy half day on the road. */
export const DELAY_CHANCE = 0.04;
export const DELAY_DAYS = 0.5;
export const HUNGRY_STAMINA = 8;

export interface TravelResult {
  world: World;
  log: TravelLog;
  freshness: FreshnessChange[];
  firstVisit: boolean;
}

let travelCounter = 0;

export function travel(w: World, plan: TravelPlan, seed: number): TravelResult | string {
  if (plan.problems.length || !plan.route) return plan.problems.join("、") || "行けない";
  const from = w.travel.currentLocationId;
  const p = plan.provisions;

  // 1. Road rations: preserved dishes leave the stock, the rest is paid for here.
  const take = new Map(p.fromStock.map((x) => [x.stockId, x.portions]));
  let world: World = {
    ...w,
    dishStock: w.dishStock.map((s) => (take.has(s.id) ? { ...s, portions: s.portions - take.get(s.id)! } : s)).filter((s) => s.portions > 0),
    chef: { ...w.chef, money: Math.round((w.chef.money - p.cost) * 100) / 100 },
    ledger: { ...w.ledger, purchases: w.ledger.purchases + p.cost },
  };

  // 2. Quiet road; very rarely a rainy half day.
  const delayed = createRng(seedFrom(seed, "travel-delay"))() < DELAY_CHANCE;
  const days = plan.route.days + (delayed ? DELAY_DAYS : 0);

  // 3. Time passes with the existing rules (ageing, MP, upkeep). Nights on the road give some sleep;
  //    cooked dishes lose freshness per night as they do at home; hunger costs stamina.
  const nights = Math.floor(w.day + days) - Math.floor(w.day);
  const beforeInv = world.inventory;
  world = advanceTime(world, days);
  const maxSt = maxStamina(world.chef);
  const stamina = Math.max(0, Math.min(maxSt, world.chef.stamina + nights * Math.ceil(maxSt * SLEEP_STAMINA_SHARE * 0.5) - p.hungry * HUNGRY_STAMINA));
  world = {
    ...world,
    chef: { ...world.chef, stamina },
    dishStock: world.dishStock.map((s) => ({ ...s, freshness: Math.round(s.freshness * Math.pow(NIGHT_FRESHNESS, nights) * 100) / 100 })),
  };
  const freshness = freshnessChanges(beforeInv, world.inventory);

  // 4. The people who shared the road: a journey together, and only a hair more trust.
  const people = [PLAYER, ...plan.companions];
  for (let i = 0; i < people.length; i++) {
    for (let j = i + 1; j < people.length; j++) world = adjustRelation(world, people[i], people[j], { traveledTogether: 1, trust: 1 });
  }

  // 5. Arrival.
  const to = LOCATION_MAP[plan.to];
  const firstVisit = !w.travel.visitedLocationIds.includes(plan.to);
  const visited = [...new Set([...w.travel.visitedLocationIds, ...plan.route.path])];
  const k = world.travel.regionKnowledge[to.regionId];
  travelCounter += 1;
  const log: TravelLog = {
    id: `trip-${Date.now().toString(36)}-${travelCounter}`,
    day: Math.floor(w.day) + 1,
    from, to: plan.to, via: plan.route.path.slice(1, -1), days,
    companions: plan.companions,
    mealsNeeded: p.needed, mealsFromStock: p.fromStockTotal, mealsBought: p.bought, hungryMeals: p.hungry, foodCost: p.cost,
    event: delayed ? "雨で半日足止めされた" : undefined,
  };
  world = {
    ...world,
    travel: {
      ...world.travel,
      currentLocationId: plan.to,
      visitedLocationIds: visited,
      travelLog: [...world.travel.travelLog, log],
      regionKnowledge: {
        ...world.travel.regionKnowledge,
        [to.regionId]: { visits: (k?.visits ?? 0) + 1, firstVisitDay: k?.firstVisitDay ?? Math.floor(world.day) + 1, cultureExperience: k?.cultureExperience ?? 0 },
      },
    },
  };
  return { world, log, freshness, firstVisit };
}

// ---------- Regional dishes ----------

/** 名物の作り方を教わる: only where the dish belongs. Uses the Phase 5 recipe book (known → trial → mastered). */
export function learnRegionalRecipe(w: World, recipeId: string): { world: World; isNew: boolean } | string {
  const region = regionOf(w);
  const recipe = getRecipe(w, recipeId);
  if (!recipe || !region.specialtyRecipeIds.includes(recipeId)) return "この土地の料理ではない";
  if (recipeStatus(w, recipeId) !== "unknown") return { world: w, isNew: false };
  const r = discoverRecipe(w, recipeId, "region");
  const k = r.world.travel.regionKnowledge[region.id];
  return {
    isNew: r.isNew,
    world: {
      ...r.world,
      travel: {
        ...r.world.travel,
        regionKnowledge: { ...r.world.travel.regionKnowledge, [region.id]: { visits: k?.visits ?? 0, firstVisitDay: k?.firstVisitDay ?? Math.floor(w.day) + 1, cultureExperience: (k?.cultureExperience ?? 0) + 1 } },
      },
    },
  };
}

export function isHome(w: World): boolean {
  return w.travel.currentLocationId === HOME_LOCATION_ID;
}

/** Names for the people on a trip. */
export function companionNames(w: World, ids: string[]): string {
  return ids.map((id) => getCharacter(w, id)?.name ?? id).join("・");
}

export { locationOf, regionOf };
