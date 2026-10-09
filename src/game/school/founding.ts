import { LOCATION_MAP, TRAVEL_REGION_IDS } from "../../data/regions";
import { allRecipes } from "../learning/recipeBook";
import { PLAYER } from "../social/relations";
import type { World } from "../world";

// 独自流派の成立条件 (Phase 7: judging only).
//
// Not built yet, on purpose: the school's name, philosophy, signature methods, original
// techniques, representative recipes, members and disciples. A school is closed — passed on
// to a few chosen people (companions, allies, future disciples) — while recipes spread through
// the world freely. Each check below has an id so later phases can add conditions (relationships,
// aptitude, specific dishes …) without changing how the result is read.

export const FOUNDING = {
  regions: 2, // travel regions visited (of 市場町 / 港町 / 山岳)
  regionalDishes: 2, // regional dishes mastered …
  regionalRegions: 2, // … from at least this many regions
  derived: 1, // Phase 5 derived recipes adopted
  dishesCooked: 10,
  cookedTogether: 1, // Phase 6 cooking together with the companion or an ally
};

export type FoundingCheckId = "regions" | "regionalDishes" | "derived" | "cooking" | "together";

export interface FoundingCheck {
  id: FoundingCheckId;
  label: string;
  have: string;
  ok: boolean;
}

export const FOUNDING_READY_TEXT = "独自流派を興せるだけの経験が集まりつつある";

export function foundingStatus(w: World): { ready: boolean; checks: FoundingCheck[] } {
  const regionsVisited = new Set(
    w.travel.visitedLocationIds.map((id) => LOCATION_MAP[id]?.regionId).filter((r): r is string => !!r && TRAVEL_REGION_IDS.includes(r)),
  );
  const regional = allRecipes(w).filter(
    (r) => r.originRegionId && TRAVEL_REGION_IDS.includes(r.originRegionId) && w.recipeBook[r.id]?.state === "mastered",
  );
  const regionalRegions = new Set(regional.map((r) => r.originRegionId));
  const together = Object.values(w.social.relations)
    .filter((r) => r.a === PLAYER || r.b === PLAYER)
    .reduce((a, r) => a + r.cookedTogether, 0);
  const cooked = w.chef.records.dishesCooked;

  const checks: FoundingCheck[] = [
    {
      id: "regions",
      label: `複数の土地の食文化に触れる（市場町・港町・山岳のうち${FOUNDING.regions}か所以上）`,
      have: `${regionsVisited.size}か所`,
      ok: regionsVisited.size >= FOUNDING.regions,
    },
    {
      id: "regionalDishes",
      label: `異なる土地の料理を${FOUNDING.regionalDishes}品以上ものにする（${FOUNDING.regionalRegions}地域以上）`,
      have: `${regional.length}品・${regionalRegions.size}地域`,
      ok: regional.length >= FOUNDING.regionalDishes && regionalRegions.size >= FOUNDING.regionalRegions,
    },
    { id: "derived", label: `自分の派生レシピを${FOUNDING.derived}つ以上残す`, have: `${w.customRecipes.length}品`, ok: w.customRecipes.length >= FOUNDING.derived },
    { id: "cooking", label: `料理を${FOUNDING.dishesCooked}回以上作る`, have: `${cooked}回`, ok: cooked >= FOUNDING.dishesCooked },
    { id: "together", label: "相棒か仲間と一緒に料理する", have: `${together}回`, ok: together >= FOUNDING.cookedTogether },
  ];
  return { ready: checks.every((c) => c.ok), checks };
}
