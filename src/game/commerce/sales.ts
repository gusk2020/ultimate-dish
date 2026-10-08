import { REGIONS, SEGMENTS, SLOT_ORDER, SLOTS, type Region, type Segment, type Slot } from "../../data/commerce";
import type { SalesTag } from "../../data/recipes";
import type { DishStock } from "../../types/world";
import { createRng } from "../rng";

// 総菜販売: one "day of sales" computes morning / noon / evening in one go.

export interface MarketState {
  region: Region;
  fame: number;
  trends: Record<string, number>;
  /** How many dishes are on the counter together (they share customers). */
  listedCount: number;
}

export function marketFor(fame: Record<string, number>, trends: Record<string, number>, listedCount: number, regionId = "village"): MarketState {
  return { region: REGIONS[regionId], fame: fame[regionId] ?? 0, trends, listedCount: Math.max(1, listedCount) };
}

/** 推奨価格: material cost plus a margin that grows with how good the dish is. */
export function recommendedPrice(stock: Pick<DishStock, "unitCost" | "total">): number {
  return Math.max(4, Math.round(6 + stock.unitCost * 1.5 + stock.total * 0.15));
}

export function effectivePrice(stock: DishStock): number {
  return stock.price > 0 ? stock.price : recommendedPrice(stock);
}

const matches = (tags: string[], likes: string[]) => tags.some((t) => likes.includes(t as SalesTag));

export function priceFactor(ratio: number, sensitivity: number): number {
  let f = Math.exp(-sensitivity * (ratio - 1) * 1.6);
  if (ratio > 2) f *= 0.3; // extreme price: few will even try
  return Math.min(2.5, f);
}

/** 客層相性: how much a segment wants this dish at this price, relative to 1. */
export function segmentAppeal(seg: Segment, stock: DishStock, ratio: number): number {
  const s = SEGMENTS[seg];
  const like = matches(stock.tags, s.likes) ? 1.4 : 0.8;
  const quality = Math.pow(Math.max(0.2, stock.total / 60), s.qualitySens);
  return like * quality * priceFactor(ratio, s.priceSens);
}

export interface SlotDemand {
  slot: Slot;
  expected: number;
  topSegment: Segment;
  slotMatch: boolean;
}

/** Expected portions per time slot (deterministic). */
export function expectedDemand(stock: DishStock, price: number, m: MarketState): SlotDemand[] {
  const ratio = price / recommendedPrice(stock);
  const trend = stock.tags.reduce((a, t) => a + (m.trends[t] ?? 0), 0) / Math.max(1, stock.tags.length);
  const common = m.region.traffic * 0.12 * (1 + m.fame / 100) * (1 + 0.25 * trend) * (0.4 + 0.6 * stock.freshness) / Math.sqrt(m.listedCount);
  const segs = Object.entries(m.region.mix) as [Segment, number][];
  const appeal = segs.map(([seg, share]) => ({ seg, v: share * segmentAppeal(seg, stock, ratio) }));
  const total = appeal.reduce((a, x) => a + x.v, 0);
  const topSegment = appeal.sort((a, b) => b.v - a.v)[0].seg;
  return SLOT_ORDER.map((slot) => {
    const slotMatch = matches(stock.tags, SLOTS[slot].likes);
    return { slot, expected: common * SLOTS[slot].share * (slotMatch ? 1.3 : 0.7) * total, topSegment, slotMatch };
  });
}

export interface SlotResult {
  slot: Slot;
  offered: number;
  sold: number;
  revenue: number;
  comment: string;
}

export interface ListingResult {
  stockId: string;
  name: string;
  price: number;
  recommended: number;
  offered: number;
  sold: number;
  revenue: number;
  leftover: number;
  slots: SlotResult[];
  reasons: string[];
  topSegment: Segment;
  priceRatio: number;
}

function slotComment(stock: DishStock, d: SlotDemand, sold: number, offered: number, ratio: number): string {
  if (offered === 0) return "（品切れ）";
  if (sold >= offered) return "売り切れ！";
  if (ratio > 1.4 && sold < offered / 2) return "値段を見て帰る客が多い";
  if (!d.slotMatch) {
    if (d.slot === "morning") return stock.tags.includes("meat") ? "朝食には少し重い" : "朝はいまひとつ";
    if (d.slot === "evening") return "夕食にはもう一品ほしい";
    return "昼には合わない";
  }
  if (sold >= d.expected * 0.9) return `${SEGMENTS[d.topSegment].label}に人気`;
  return "まずまず";
}

/** Sells one listing through the day. Seeded: same inputs → same result. */
export function sellListing(stock: DishStock, m: MarketState, seed: number): ListingResult {
  const price = effectivePrice(stock);
  const rec = recommendedPrice(stock);
  const ratio = price / rec;
  const rng = createRng(seed);
  const demand = expectedDemand(stock, price, m);
  let remaining = stock.portions;
  const slots: SlotResult[] = demand.map((d) => {
    const want = Math.round(d.expected * (0.8 + 0.4 * rng()));
    const offered = remaining;
    const sold = Math.min(remaining, Math.max(0, want));
    remaining -= sold;
    return { slot: d.slot, offered, sold, revenue: sold * price, comment: slotComment(stock, d, sold, offered, ratio) };
  });
  const sold = stock.portions - remaining;
  const reasons: string[] = [];
  if (ratio > 1.5) reasons.push("推奨価格よりかなり高い");
  else if (ratio < 0.7) reasons.push("安さで客が集まった（利益は薄い）");
  if (stock.total >= 70) reasons.push("料理の評判が良い");
  else if (stock.total < 45) reasons.push("料理の出来がいまひとつ");
  if (stock.freshness < 0.7) reasons.push("作り置きで鮮度が落ちていた");
  if (remaining > 0 && sold > 0) reasons.push(`作りすぎ（${remaining}食余った）`);
  if (remaining === 0) reasons.push("完売。もっと作れたかも");
  return {
    stockId: stock.id, name: stock.name, price, recommended: rec, offered: stock.portions, sold,
    revenue: sold * price, leftover: remaining, slots, reasons, topSegment: demand[0].topSegment, priceRatio: ratio,
  };
}
