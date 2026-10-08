import { SEGMENTS, SHOP_MAP, type Shop } from "../../data/commerce";
import type { Dish } from "../../types";
import type { Contract } from "../../types/world";
import { createRng } from "../rng";
import type { World } from "../world";
import { recommendedPrice } from "./sales";

// レシピ契約: low risk, low return. The shop pays for materials and labour and sells the
// dish itself; the player gets a share. Non-exclusive: the player may still sell it too.

export function contractRate(shop: Shop, total: number, fame: number, signed: number): number {
  const r = shop.baseRate + Math.max(0, total - shop.minTotal) * 0.001 + fame * 0.0005 + signed * 0.005;
  return Math.round(Math.min(0.25, Math.max(0.03, r)) * 1000) / 1000;
}

export function canContract(w: World, shop: Shop, dish: Dish): { ok: boolean; reason?: string } {
  if (dish.total < shop.minTotal) return { ok: false, reason: `総合点${shop.minTotal}以上が条件` };
  if (w.contracts.some((c) => c.shopId === shop.id && c.dishId === dish.id)) return { ok: false, reason: "契約中" };
  return { ok: true };
}

export function dishTags(dish: Dish, w: World): string[] {
  return w.dishStock.find((s) => s.dishId === dish.id)?.tags ?? [];
}

export function signContract(w: World, shop: Shop, dish: Dish): World | string {
  const check = canContract(w, shop, dish);
  if (!check.ok) return check.reason!;
  const unitCost = w.dishStock.find((s) => s.dishId === dish.id)?.unitCost ?? 3;
  const contract: Contract = {
    id: `ct-${shop.id}-${dish.id}`,
    shopId: shop.id,
    dishId: dish.id,
    dishName: dish.name,
    total: dish.total,
    tags: dishTags(dish, w),
    price: Math.round(recommendedPrice({ unitCost, total: dish.total }) * shop.priceMult),
    rate: contractRate(shop, dish.total, w.fame[shop.region] ?? 0, w.contractsSigned),
    daysLeft: shop.days,
    earned: 0,
  };
  return { ...w, contracts: [...w.contracts, contract], contractsSigned: w.contractsSigned + 1 };
}

export interface ContractDay {
  contractId: string;
  shopName: string;
  dishName: string;
  shopSold: number;
  income: number;
  daysLeft: number;
}

/** One day of the shop selling the dish. Expected income per day is shown before signing too. */
export function contractDay(c: Contract, seed: number): ContractDay {
  const shop = SHOP_MAP[c.shopId];
  const fit = shop.segments.some((s) => c.tags.some((t) => SEGMENTS[s].likes.includes(t as never))) ? 1.2 : 0.8;
  const noise = 0.8 + 0.4 * createRng(seed)();
  const shopSold = Math.max(0, Math.round(shop.power * Math.pow(c.total / 60, 1.2) * fit * noise));
  return {
    contractId: c.id, shopName: shop.name, dishName: c.dishName, shopSold,
    income: Math.round(shopSold * c.price * c.rate), daysLeft: c.daysLeft - 1,
  };
}

export function expectedContractIncome(c: Pick<Contract, "shopId" | "tags" | "total" | "price" | "rate">): number {
  const shop = SHOP_MAP[c.shopId];
  const fit = shop.segments.some((s) => c.tags.some((t) => SEGMENTS[s].likes.includes(t as never))) ? 1.2 : 0.8;
  return Math.round(shop.power * Math.pow(c.total / 60, 1.2) * fit * c.price * c.rate);
}
