// 日誌式遠征 (Phase 11): the player only prepares (where, who to hire, on what terms); the days
// on the road are written as a diary. Cooks hunt ingredients and techniques, eaters hunt
// legendary dishes, hidden eateries and unknown heat.

export interface ExpeditionDestination {
  id: string;
  name: string;
  kind: "遺跡" | "秘境" | "ダンジョン" | "スラム街" | "危険地帯";
  /** Where you set out from. */
  fromLocationId: string;
  days: number;
  /** 0..1 — how dangerous the place is. */
  danger: number;
  /** How hard the way is to find without a guide. */
  terrain: number;
  /** Magic / spirits matter here. */
  arcane: number;
  makerGoal: string;
  eaterGoal: string;
  /** What success brings. */
  makerReward: { itemId?: string; amount?: number; recipeId?: string; text: string };
  eaterReward: { dishName: string; shu?: number; text: string };
}

export const EXPEDITIONS: ExpeditionDestination[] = [
  {
    id: "dragon-crater", name: "竜の火口", kind: "危険地帯", fromLocationId: "highland", days: 4, danger: 0.6, terrain: 0.5, arcane: 0.3,
    makerGoal: "野生の竜炎椒を採る", eaterGoal: "火口の隠れ食堂で、竜炎椒の地獄鍋を食べる",
    makerReward: { itemId: "ryuenshou", amount: 3, text: "竜炎椒（150,000 SHU）を3束手に入れた" },
    eaterReward: { dishName: "火口の地獄鍋", shu: 300000, text: "火口の地獄鍋（300,000 SHU）を完食した" },
  },
  {
    id: "sunken-ruins", name: "沈んだ神殿遺跡", kind: "遺跡", fromLocationId: "harbor", days: 3, danger: 0.4, terrain: 0.4, arcane: 0.6,
    makerGoal: "古代の保存法の碑文を読む", eaterGoal: "神殿の古い祭礼料理を再現した老婆に会う",
    makerReward: { itemId: "seasalt", amount: 4, text: "古代の塩田の塩と、保存法の碑文を書き写した" },
    eaterReward: { dishName: "神殿の祭礼粥", text: "祭礼粥を食べ、古い食文化を知った" },
  },
  {
    id: "back-alleys", name: "市場町の裏路地", kind: "スラム街", fromLocationId: "rivertown", days: 2, danger: 0.3, terrain: 0.6, arcane: 0,
    makerGoal: "闇市の珍しい乾物を仕入れる", eaterGoal: "看板のない名店を探す",
    makerReward: { itemId: "noodles", amount: 6, text: "闇市の上物の乾麺を仕入れた" },
    eaterReward: { dishName: "看板のない店の汁麺", text: "看板のない店の汁麺を食べた。評論家が通う店らしい" },
  },
];

export const EXPEDITION_MAP: Record<string, ExpeditionDestination> = Object.fromEntries(EXPEDITIONS.map((e) => [e.id, e]));

export interface ExpeditionHireDef {
  id: string;
  role: "guide" | "guard" | "mage" | "spirit";
  roleLabel: string;
  name: string;
  skill: number; // 0..1
  fee: number; // fixed fee for the whole trip
  share: number; // share of the haul's value instead (0..1)
}

export const HIRES: ExpeditionHireDef[] = [
  { id: "guide-tomas", role: "guide", roleLabel: "ガイド", name: "道案内のトマス", skill: 0.6, fee: 30, share: 0.15 },
  { id: "guard-irma", role: "guard", roleLabel: "護衛", name: "傭兵イルマ", skill: 0.7, fee: 50, share: 0.2 },
  { id: "mage-oren", role: "mage", roleLabel: "魔法使い", name: "旅の魔導士オレン", skill: 0.6, fee: 45, share: 0.2 },
  { id: "spirit-luu", role: "spirit", roleLabel: "精霊使い", name: "精霊使いルウ", skill: 0.55, fee: 40, share: 0.15 },
];

export const HIRE_MAP: Record<string, ExpeditionHireDef> = Object.fromEntries(HIRES.map((h) => [h.id, h]));
