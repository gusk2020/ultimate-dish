// Phase 11: things you can own — a house, a shop, portable kitchens, food storage — and the two
// separate organisations that keep things for you: the guilds (food only) and the bank (money only).

export interface PropertyDef {
  id: string;
  kind: "house" | "shop";
  name: string;
  price: number;
  /** The kitchen and the storage that come with it. */
  kitchenId: string;
  storageId: string;
  note: string;
}

export const HOUSE: PropertyDef = { id: "cottage", kind: "house", name: "簡易住宅", price: 300, kitchenId: "home-kitchen", storageId: "pantry-box", note: "自宅厨房と食料箱つき。この土地でだけ使える" };
export const SHOP: PropertyDef = { id: "small-diner", kind: "shop", name: "小さな食堂", price: 1500, kitchenId: "shop-kitchen", storageId: "cool-cellar", note: "店の厨房・販売設備・冷暗庫つき" };

export interface PortableKitchenDef {
  id: string;
  name: string;
  price: number;
  upkeepPerDay: number;
}

export const PORTABLE_KITCHENS: PortableKitchenDef[] = [
  { id: "travel-kit", name: "旅用簡易キッチン", price: 60, upkeepPerDay: 0 },
  { id: "cart-kitchen", name: "荷車厨房", price: 400, upkeepPerDay: 2 },
  { id: "compact-magic", name: "コンパクト魔導厨房", price: 1200, upkeepPerDay: 0 },
  { id: "magic-cart", name: "魔導厨房車", price: 2500, upkeepPerDay: 6 },
];

export interface FoodStorageFacility {
  id: string;
  name: string;
  emoji: string;
  price: number;
  capacity: number; // portions / ingredient units
  /** How much of the usual nightly freshness loss still happens (0 = none, 1 = as outside). */
  freshnessMultiplier: number;
  /** MP spent each night to keep the magic running. */
  magicCost: number;
  allowedFoodTypes: ("dish" | "ingredient")[];
  portable: boolean;
  /** Only comes with a house / shop (not sold alone). */
  builtIn?: boolean;
}

export const FOOD_STORAGES: FoodStorageFacility[] = [
  { id: "pantry-box", name: "食料箱", emoji: "📦", price: 0, capacity: 20, freshnessMultiplier: 0.6, magicCost: 0, allowedFoodTypes: ["dish", "ingredient"], portable: false, builtIn: true },
  { id: "cool-cellar", name: "冷暗庫", emoji: "🧊", price: 0, capacity: 60, freshnessMultiplier: 0.35, magicCost: 0, allowedFoodTypes: ["dish", "ingredient"], portable: false, builtIn: true },
  { id: "frost-chest", name: "冷凍の魔法箱", emoji: "❄️", price: 800, capacity: 15, freshnessMultiplier: 0.15, magicCost: 3, allowedFoodTypes: ["dish", "ingredient"], portable: true },
  { id: "time-coffer", name: "時遅れの櫃", emoji: "⏳", price: 3000, capacity: 10, freshnessMultiplier: 0.02, magicCost: 10, allowedFoodTypes: ["dish", "ingredient"], portable: true },
];

export const FOOD_STORAGE_MAP: Record<string, FoodStorageFacility> = Object.fromEntries(FOOD_STORAGES.map((f) => [f.id, f]));

/** ギルド共有魔力食在庫: subscription plans. */
export interface GuildStoragePlan {
  id: string;
  name: string;
  feePerDay: number;
  freshnessMultiplier: number;
}

export const GUILD_PLANS: GuildStoragePlan[] = [
  { id: "normal", name: "通常", feePerDay: 1, freshnessMultiplier: 1 },
  { id: "chilled", name: "冷蔵", feePerDay: 3, freshnessMultiplier: 0.4 },
  { id: "frozen", name: "冷凍・時間遅延", feePerDay: 6, freshnessMultiplier: 0.1 },
  { id: "premium", name: "高級保存", feePerDay: 12, freshnessMultiplier: 0 },
];

export const GUILD_PLAN_MAP: Record<string, GuildStoragePlan> = Object.fromEntries(GUILD_PLANS.map((p) => [p.id, p]));
/** Guild halls connected to the shared storage. */
export const GUILD_TOWNS = ["village", "rivertown", "harbor", "highland"];
/** Branches of the bank (a separate organisation from the guilds). */
export const BANK_BRANCHES = ["village", "rivertown", "harbor", "highland"];
export const BANK_OPEN_FEE = 5;
/** Cash above this starts to draw thieves on the road. */
export const SAFE_CASH = 150;
