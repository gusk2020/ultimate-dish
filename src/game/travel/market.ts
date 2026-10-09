import { INGREDIENTS } from "../../data/ingredients";
import { itemInfo } from "../../data/items";
import { SPICES } from "../../data/magic";
import { HOME_LOCATION_ID, LOCATION_MAP, REGION_MAP } from "../../data/regions";
import type { LocationDef, RegionDef } from "../../types/travel";
import type { World } from "../world";

// 地域の市場: the old fixed price stays the base; each region multiplies it, or does not sell
// the item at all. The village sells everything it always did at exactly the old price.

export type MarketKind = "local" | "imported" | "none";

export function locationOf(w: Pick<World, "travel">): LocationDef {
  return LOCATION_MAP[w.travel?.currentLocationId ?? HOME_LOCATION_ID] ?? LOCATION_MAP[HOME_LOCATION_ID];
}

export function regionOf(w: Pick<World, "travel">): RegionDef {
  return REGION_MAP[locationOf(w).regionId];
}

const round1 = (v: number) => Math.max(0.1, Math.round(v * 10) / 10);

/** How this item is sold here, and for how much (null price = not sold). */
export function marketEntry(w: Pick<World, "travel">, itemId: string): { kind: MarketKind; price: number | null; base: number } {
  const base = itemInfo(itemId)?.price ?? 0;
  const m = regionOf(w).market;
  if (m.local[itemId] !== undefined) return { kind: "local", price: round1(base * m.local[itemId]), base };
  if (m.imported[itemId] !== undefined) return { kind: "imported", price: round1(base * m.imported[itemId]), base };
  return { kind: "none", price: null, base };
}

export function localPrice(w: Pick<World, "travel">, itemId: string): number | null {
  return marketEntry(w, itemId).price;
}

const ALL_ITEMS = [...INGREDIENTS.map((i) => i.id), ...SPICES.map((s) => s.id)];

/** Every item, grouped the way the shop shows it: 地元品 → 輸入品 → 売っていない. */
export function marketList(w: Pick<World, "travel">) {
  const rows = ALL_ITEMS.map((id) => ({ itemId: id, ...marketEntry(w, id) }));
  return {
    local: rows.filter((r) => r.kind === "local"),
    imported: rows.filter((r) => r.kind === "imported"),
    none: rows.filter((r) => r.kind === "none"),
  };
}
