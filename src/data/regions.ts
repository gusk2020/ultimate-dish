import type { LocationDef, RegionDef, RegionalCuisineProfile } from "../types/travel";
import { INGREDIENTS } from "./ingredients";
import { SPICES } from "./magic";

// 旅の世界: FIXED geography. Locations, roads, culture regions and their base cuisine are
// hand-made design data and are never generated. (Generation stays with food: player dishes,
// derivations and how dishes are described.)

export const HOME_LOCATION_ID = "village";

export const LOCATIONS: LocationDef[] = [
  {
    id: "village",
    name: "麦畑の村",
    shortName: "村",
    emoji: "🌾",
    description: "旅の出発点。麦畑と猟場に囲まれた小さな村。",
    regionId: "home",
    connections: [{ to: "rivertown", travelDays: 1.5 }],
    unlock: [],
  },
  {
    id: "rivertown",
    name: "川沿いの市場町",
    shortName: "市場町",
    emoji: "🛶",
    description: "大河の渡し場に市が立つ町。周りの農村から食材が集まり、旅人向けの安くて早い料理が並ぶ。",
    regionId: "river",
    connections: [{ to: "village", travelDays: 1.5 }, { to: "harbor", travelDays: 2 }, { to: "highland", travelDays: 2.5 }],
    unlock: [],
  },
  {
    id: "harbor",
    name: "海辺の港町",
    shortName: "港町",
    emoji: "⚓",
    description: "潮風と干物の匂いがする港。漁師の網と異国の商船が、海の幸と香辛料を運んでくる。",
    regionId: "coast",
    connections: [{ to: "rivertown", travelDays: 2 }],
    unlock: [{ kind: "visited", locationId: "rivertown" }],
  },
  {
    id: "highland",
    name: "山岳の高地集落",
    shortName: "山岳",
    emoji: "🏔️",
    description: "雪嶺のふもとの集落。山羊を飼い、乳と燻製で長い冬を越す。",
    regionId: "mountain",
    connections: [{ to: "rivertown", travelDays: 2.5 }],
    unlock: [{ kind: "visited", locationId: "rivertown" }],
  },
];

export const LOCATION_MAP: Record<string, LocationDef> = Object.fromEntries(LOCATIONS.map((l) => [l.id, l]));

/** Everything the village has always sold, at the base (Phase 1-6) price. */
const HOME_GOODS = [
  ...INGREDIENTS.filter((i) => i.source === "farm" || i.source === "hunt" || i.source === "market").map((i) => i.id),
  ...SPICES.map((s) => s.id),
];

const profile = (p: RegionalCuisineProfile) => p;

export const REGIONS: RegionDef[] = [
  {
    id: "home",
    name: "麦畑の村",
    cultureTags: ["thrift", "stew", "family"],
    philosophy: "あるものを無駄なく、家族の鍋で。",
    cuisine: profile({ freshness: 0.5, preservation: 0.5, aroma: 0.3, nutrition: 0.6, refinement: 0.2, affordability: 0.9, richness: 0.4, salt: 0.4 }),
    favouredMethods: ["boil", "grill"],
    preservation: ["pickle", "dry"],
    market: {
      local: Object.fromEntries(HOME_GOODS.map((id) => [id, 1])),
      imported: { noodles: 1.5, seasalt: 1.6, seaweed: 1.8, hardcheese: 1.8 },
    },
    specialtyRecipeIds: ["rabbit-stew", "boar-herb-roast", "bean-wheat-soup"],
    rationMult: 1,
  },
  {
    id: "river",
    name: "川沿いの交易圏",
    cultureTags: ["fresh", "trade", "quick", "vinegar"],
    philosophy: "獲れたてを、すぐ焼いて、すぐ出す。",
    cuisine: profile({ freshness: 0.9, preservation: 0.5, aroma: 0.4, nutrition: 0.5, refinement: 0.3, affordability: 0.85, richness: 0.3, salt: 0.4 }),
    favouredMethods: ["grill", "boil"],
    preservation: ["pickle"],
    market: {
      local: { fish: 0.7, riverprawn: 0.8, leek: 0.8, noodles: 0.7, vinegar: 0.7, wheat: 0.9, beans: 0.9, onion: 0.9, cabbage: 0.9, egg: 1, salt: 1 },
      imported: {
        seasalt: 1.2, seaweed: 1.3, hardcheese: 1.3, saltfish: 1.1, honey: 1.2, butter: 1.3, cheese: 1.2, chicken: 1.2, boar: 1.4,
        garlic: 1, apple: 1.2, herb: 1.3, mushroom: 1.3, nuts: 1.2, milk: 1.3, lemon: 1.5, cinnamon: 1.8, homura: 1.4, iyashi: 1.4,
      },
    },
    specialtyRecipeIds: ["river-grilled-fish", "river-travelers-noodles", "river-vinegar-fish"],
    rationMult: 0.9,
  },
  {
    id: "coast",
    name: "潮風の港湾圏",
    cultureTags: ["sea", "salt", "exotic", "dried"],
    philosophy: "海の恵みは塩と風で生かし、異国の香りで飾る。",
    cuisine: profile({ freshness: 0.85, preservation: 0.7, aroma: 0.8, nutrition: 0.5, refinement: 0.5, affordability: 0.5, richness: 0.4, salt: 0.9 }),
    favouredMethods: ["grill", "steam", "boil"],
    preservation: ["dry", "ferment"],
    market: {
      local: { seafish: 0.7, shellfish: 0.7, seaweed: 0.6, seasalt: 0.5, lemon: 0.8, cinnamon: 1, saltfish: 0.7, salt: 0.8 },
      imported: {
        wheat: 1.3, onion: 1.2, cabbage: 1.3, beans: 1.3, garlic: 1.2, vinegar: 1.1, noodles: 1.2, fish: 1.4, honey: 1.3,
        butter: 1.4, cheese: 1.3, egg: 1.3, chicken: 1.4, homura: 1.2, iyashi: 1.6,
      },
    },
    specialtyRecipeIds: ["coast-dried-fish", "coast-seafood-stew", "coast-spiced-shells"],
    rationMult: 1.1,
  },
  {
    id: "mountain",
    name: "雪嶺の高地",
    cultureTags: ["dairy", "smoke", "cold", "nourish"],
    philosophy: "長い冬を越すために、乳と煙と保存の知恵を重ねる。",
    cuisine: profile({ freshness: 0.3, preservation: 0.9, aroma: 0.5, nutrition: 0.9, refinement: 0.2, affordability: 0.5, richness: 0.8, salt: 0.6 }),
    favouredMethods: ["boil", "smoke"],
    preservation: ["smoke", "dry"],
    market: {
      local: { goatmilk: 0.6, hardcheese: 0.7, wildgreens: 0.6, ibex: 0.8, nuts: 0.7, mushroom: 0.7, herb: 0.7, boar: 0.9, butter: 0.9, cheese: 0.9, honey: 0.9, iyashi: 0.8 },
      imported: { wheat: 1.4, salt: 1.5, seasalt: 1.8, onion: 1.4, beans: 1.4, garlic: 1.3, vinegar: 1.5, noodles: 1.5, apple: 1.3, homura: 1.6, saltfish: 1.6, egg: 1.5 },
    },
    specialtyRecipeIds: ["highland-cheese-porridge", "highland-smoked-ibex", "highland-greens-nuts"],
    rationMult: 1.2,
  },
];

export const REGION_MAP: Record<string, RegionDef> = Object.fromEntries(REGIONS.map((r) => [r.id, r]));

/** The three travel regions (not home): the ones that count as 文化接触 for a new school. */
export const TRAVEL_REGION_IDS = ["river", "coast", "mountain"];

export const CUISINE_LABEL: Record<keyof RegionalCuisineProfile, string> = {
  freshness: "鮮度", preservation: "保存", aroma: "香り", nutrition: "滋養", refinement: "洗練", affordability: "安さ", richness: "濃厚さ", salt: "塩",
};

/** Road rations bought when the party has no preserved food left (per meal, before the regional multiple). */
export const RATION_PRICE = 3;
