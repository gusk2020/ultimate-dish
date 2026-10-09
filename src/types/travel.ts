// Phase 7: travel and regional cuisine. Pure data shapes only.
//
// Geography is FIXED design data (locations, roads, culture regions, their base cuisine).
// Nothing here is generated: procedural generation stays limited to food (player dishes,
// derivations, descriptions). The travel logic works on this graph and never on screen
// coordinates, so the same data can later be drawn as a text map or a 2D map.

/** A place you can be. Connections make a graph; no coordinates on purpose. */
export interface LocationDef {
  id: string;
  name: string;
  shortName: string; // nav label (≤3 chars)
  emoji: string;
  description: string;
  regionId: string; // culture region
  connections: { to: string; travelDays: number }[];
  /** All must hold before the place can be travelled to. */
  unlock: UnlockCondition[];
}

/** Extendable: future kinds (level, quest, fame, season) slot in here. */
export type UnlockCondition = { kind: "visited"; locationId: string };

/**
 * 地域料理観: how a food culture weighs things, 0..1 each.
 * Phase 7 only shows the top traits; NPC reactions, regional battles and contests can read it later.
 */
export interface RegionalCuisineProfile {
  freshness: number;
  preservation: number;
  aroma: number;
  nutrition: number;
  refinement: number;
  affordability: number;
  richness: number; // fat, dairy, depth
  salt: number;
}

/** A local market: what is sold and at what multiple of the base price. Absent = not sold here. */
export interface RegionMarket {
  local: Record<string, number>; // 地元品 (usually cheap)
  imported: Record<string, number>; // 輸入品 (usually dear)
}

export interface RegionDef {
  id: string;
  name: string;
  cultureTags: string[];
  philosophy: string; // one line shown on arrival
  cuisine: RegionalCuisineProfile;
  /** Methods the cooks here reach for, and how they keep food. */
  favouredMethods: string[];
  preservation: string[];
  market: RegionMarket;
  /** Dishes the region is known for; each is a RecipeDef carrying originRegionId. */
  specialtyRecipeIds: string[];
  /** Price multiple for the auto-bought road rations here. */
  rationMult: number;
}

export interface TravelLog {
  id: string;
  day: number; // departure day (1-based)
  from: string;
  to: string;
  via: string[]; // intermediate stops
  days: number;
  companions: string[];
  mealsNeeded: number;
  mealsFromStock: number;
  mealsBought: number;
  hungryMeals: number;
  foodCost: number;
  event?: string;
}

/**
 * Future: 地域理解度 / 文化経験. Phase 7 only records visits and regional dishes cooked;
 * nothing reads it yet and no number is shown.
 */
export interface RegionKnowledge {
  visits: number;
  firstVisitDay: number;
  cultureExperience: number;
}

export interface TravelState {
  currentLocationId: string;
  visitedLocationIds: string[];
  travelLog: TravelLog[];
  regionKnowledge: Record<string, RegionKnowledge>;
}
