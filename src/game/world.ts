import { itemInfo, newStack, STORAGE_MAP } from "../data/items";
import { RECOVERY_MAP, SKILL_MAP, skillForMethod } from "../data/phase2";
import { INGREDIENT_MAP } from "../data/ingredients";
import type { Dish, Rank } from "../types";
import type { Chef, Contract, DishStock, InventoryStack, ProcessStep, ProcessResult, School, SkillId, ToolState } from "../types/world";
import { initialInventory } from "../data/items";
import type { BattleRecord, EaterProfile, TastingRecord } from "../types/eating";
import type { DerivationIdea, RecipeProgress } from "../types/learning";
import type { SocialState } from "../types/social";
import type { TravelState } from "../types/travel";
import type { PlayerIdentity } from "../types/identity";
import type { CodexEntry, OpponentProgress, PlayerProgression, PublicDishRecord } from "../types/codex";
import type { DailyState } from "./time/daily";
import type { KitchenState } from "./kitchen/kitchens";
import { newProgression, recordCooked } from "./codex/codex";
import { HOME_LOCATION_ID } from "../data/regions";
import { localPrice, locationOf } from "./travel/market";
import type { RecipeDef } from "../data/recipes";
import { newProgress } from "./learning/recipeBook";
import { initialTools } from "../data/phase2";
import { STARTING_RECIPES } from "../data/recipes";
import { gainXp, type LevelUpLog } from "./chef/leveling";
import { createDefaultChef, maxMP, maxStamina, skillLevel } from "./chef/stats";
import { findSchool } from "./school/school";
import { ageInventory, consume, storageLoad, upkeepPerDay } from "./inventory/inventory";
import { seedFrom } from "./rng";

// Pure state transitions for the Phase 2 world. The React reducer only calls these.

export interface World {
  day: number; // real number, in days
  chef: Chef;
  inventory: InventoryStack[];
  tools: ToolState[];
  customSchools: School[];
  stackCounter: number;
  // Phase 3
  knownRecipes: string[];
  dishStock: DishStock[];
  contracts: Contract[];
  contractsSigned: number;
  /** 地域知名度 by region id. */
  fame: Record<string, number>;
  /** 流行: sales tag → -1..1 */
  trends: Record<string, number>;
  /** Money flows since the last day end (for the 日報). */
  ledger: { materialCost: number; purchases: number };
  // Phase 4
  /** The player's palate, built from the 食遍歴 questions (null until answered). */
  palate: EaterProfile | null;
  tastingLog: TastingRecord[];
  battleLog: BattleRecord[];
  // Phase 5
  /** Every recipe the player knows about (absent = unknown). `knownRecipes` lists the mastered ones. */
  recipeBook: Record<string, RecipeProgress>;
  /** Player-made derived recipes; looked up together with the built-ins via getRecipe(). */
  customRecipes: RecipeDef[];
  derivationIdeas: DerivationIdea[];
  /** Ideas adopted or turned down, so they are not offered again. */
  ideasClosed: string[];
  learning: { talkedTo: string[]; booksRead: string[] };
  // Phase 6
  /** Companion choice, party and every pair's relationship (player, companion, allies). */
  social: SocialState;
  // Phase 7
  /** Where the player is, where they have been and every journey so far. */
  travel: TravelState;
  // Phase 8
  /** Decided in the character creation sequence. Gender and age are for text only. */
  identity: PlayerIdentity;
  // Phase 9
  /** 食べる側の成長 (maker growth stays on chef). */
  progression: PlayerProgression;
  /** 私の図鑑: dishes the player has made or eaten, by codex key. */
  codex: Record<string, CodexEntry>;
  /** Dishes the player published through the guild. */
  publicRegistry: PublicDishRecord[];
  // Phase 10
  /** Hunger, carried routine meals and the last daily note (日常食). */
  daily: DailyState;
  /** Everyone faced in a battle or an eater challenge. */
  opponents: Record<string, OpponentProgress>;
  /** A kitchen rented for the current part of the day, or an event kitchen provided by a host. */
  kitchen: KitchenState;
}

export function createWorld(): World {
  return {
    day: 0.25, // morning of day 1
    chef: createDefaultChef(),
    inventory: initialInventory(0),
    tools: initialTools(),
    customSchools: [],
    stackCounter: 0,
    knownRecipes: [...STARTING_RECIPES],
    dishStock: [],
    contracts: [],
    contractsSigned: 0,
    fame: { village: 5 },
    trends: { soup: 0.2, meat: 0.1 },
    ledger: { materialCost: 0, purchases: 0 },
    palate: null,
    tastingLog: [],
    battleLog: [],
    recipeBook: Object.fromEntries(STARTING_RECIPES.map((id) => [id, newProgress(id, "mastered", "start", 1, 10)])),
    customRecipes: [],
    derivationIdeas: [],
    ideasClosed: [],
    learning: { talkedTo: [], booksRead: [] },
    social: { persona: null, companionChoice: "pending", companion: null, party: [], relations: {} },
    travel: { currentLocationId: HOME_LOCATION_ID, visitedLocationIds: [HOME_LOCATION_ID], travelLog: [], regionKnowledge: {} },
    identity: { creationCompleted: false, lean: null, genderExpression: null, age: null, start: null, startingToolId: null, companionPresentation: null },
    progression: newProgression(),
    codex: {},
    publicRegistry: [],
    daily: { hunger: 0.2, routineMeals: 0, lastNote: null },
    opponents: {},
    kitchen: { rental: null, event: null },
  };
}

/** Natural MP recovery per day, as a share of max MP. */
export const MP_REGEN_PER_DAY = 0.5;
export const REST_DAYS = 0.25;
export const REST_MP_SHARE = 0.4;
export const REST_STAMINA_SHARE = 0.3;

export function advanceTime(w: World, days: number): World {
  if (days <= 0) return w;
  const max = maxMP(w.chef);
  const mp = Math.min(max, Math.floor(w.chef.mp + max * MP_REGEN_PER_DAY * days));
  const upkeep = Math.round(upkeepPerDay(w.inventory) * days * 100) / 100;
  return {
    ...w,
    day: w.day + days,
    inventory: ageInventory(w.inventory, days),
    chef: { ...w.chef, mp, money: Math.round((w.chef.money - upkeep) * 100) / 100 },
  };
}

export function rest(w: World): World {
  const after = advanceTime(w, REST_DAYS);
  const max = maxMP(after.chef);
  const maxSt = maxStamina(after.chef);
  return {
    ...after,
    chef: {
      ...after.chef,
      mp: Math.min(max, after.chef.mp + Math.ceil(max * REST_MP_SHARE)),
      stamina: Math.min(maxSt, after.chef.stamina + Math.ceil(maxSt * REST_STAMINA_SHARE)),
    },
  };
}

export function buy(w: World, itemId: string, quantity: number, storageId: string): World | string {
  const info = itemInfo(itemId);
  const storage = STORAGE_MAP[storageId];
  if (!info || !storage) return "不明な品物";
  // Phase 7: the local market decides the price (the village keeps the old fixed prices).
  const price = localPrice(w, itemId);
  if (price === null) return `${info.name}はこの土地では売っていない`;
  const cost = Math.round(price * quantity * 100) / 100;
  if (w.chef.money < cost) return "お金が足りない";
  if (storageLoad(w.inventory, storageId) + quantity > storage.capacity) return `${storage.name}がいっぱい`;
  const here = w.travel?.currentLocationId ?? HOME_LOCATION_ID;
  const stack = { ...newStack(itemId, quantity, storageId, here === HOME_LOCATION_ID ? "市場" : `${locationOf(w).shortName}の市場`, w.day, w.stackCounter + 1000), price };
  return {
    ...w,
    stackCounter: w.stackCounter + 1,
    inventory: [...w.inventory, stack],
    chef: { ...w.chef, money: w.chef.money - cost },
    ledger: { ...w.ledger, purchases: w.ledger.purchases + cost },
  };
}

const RANK_XP: Record<Rank, number> = { D: 0, C: 3, B: 6, A: 10, S: 15, Legendary: 25 };

export interface CookingGains {
  xp: number;
  skillXp: Partial<Record<SkillId, number>>;
  levelUps: LevelUpLog[];
  newSkills: SkillId[];
}

/** Applies a finished cook: consumes stock, MP and tool durability, advances time, grants growth. */
export function completeCooking(
  w: World,
  steps: ProcessStep[],
  result: ProcessResult,
  dish: Dish,
): { world: World; gains: CookingGains; codexNew: boolean } | string {
  let inventory = w.inventory;
  const take = (id: string, amount: number) => {
    const next = consume(inventory, id, amount);
    if (!next) throw new Error(`${itemInfo(id)?.name ?? id}が足りない`);
    inventory = next;
  };
  try {
    for (const s of steps) {
      if (s.kind === "add") take(s.itemId, s.amount);
      if (s.kind === "recover" && RECOVERY_MAP[s.recoverId]?.needsItem) {
        const n = RECOVERY_MAP[s.recoverId].needsItem!;
        take(n.itemId, n.amount);
      }
    }
  } catch (e) {
    return (e as Error).message;
  }

  const tools = w.tools.map((t) => {
    const uses = steps.filter((s) => s.kind === "tool" && s.toolId === t.toolId).length;
    return uses ? { ...t, durability: Math.max(0, t.durability - uses) } : t;
  });

  const { chef: leveled, gains } = applyGrowth(
    { ...w.chef, mp: Math.max(0, w.chef.mp - result.mpCost) }, w.customSchools, steps, result, dish,
  );
  const timed = advanceTime({ ...w, inventory, tools, chef: leveled }, result.totalDays);
  const c = recordCooked(timed, dish);
  return { world: c.world, gains, codexNew: c.isNew };
}

/** Growth from one cook: skill xp per step (school multipliers apply), school mastery, records, xp. */
export function applyGrowth(
  chef0: Chef,
  customSchools: School[],
  steps: ProcessStep[],
  result: ProcessResult,
  dish: Dish,
  xpBonus = 0,
): { chef: Chef; gains: CookingGains } {
  // Growth: skill xp per step (school multipliers apply), one mastery point for the school.
  const school = chef0.activeSchoolId;
  const mult = (id: SkillId) => findSchool(school, customSchools).skillXpMult[id] ?? 1;
  const skillXp: Partial<Record<SkillId, number>> = {};
  const addSkill = (id: SkillId, n: number) => (skillXp[id] = (skillXp[id] ?? 0) + Math.round(n * mult(id)));
  const techniqueCounts = { ...chef0.records.techniqueCounts };
  result.outcomes.forEach((o) => {
    const s = steps[o.index];
    const bonus = o.grade === "great" || o.grade === "miracle" ? 2 : o.grade === "success" ? 1 : 0.5;
    if (s.kind === "method") {
      addSkill(skillForMethod(s.methodId), 6 * bonus);
      techniqueCounts[s.methodId] = (techniqueCounts[s.methodId] ?? 0) + 1;
      if (skillForMethod(s.methodId) === "fire" && (chef0.records.skillXp.fire ?? 0) >= 200) addSkill("preciseFire", 4 * bonus);
    } else if (s.kind === "tool") {
      addSkill("magitool", 8 * bonus);
      if ((chef0.records.skillXp.magitool ?? 0) >= 200) addSkill("multiTool", 4 * bonus);
    } else if (s.kind === "merge" || s.kind === "recover") addSkill("seasoning", 6 * bonus);
  });
  const records = {
    ...chef0.records,
    skillXp: { ...chef0.records.skillXp },
    techniqueCounts,
    schoolMastery: { ...chef0.records.schoolMastery, [school]: (chef0.records.schoolMastery[school] ?? 0) + 1 },
    genreCounts: { ...chef0.records.genreCounts },
    achievements: [...chef0.records.achievements],
    dishesCooked: chef0.records.dishesCooked + 1,
  };
  const before = new Set(learnedSkills(chef0));
  for (const [k, v] of Object.entries(skillXp) as [SkillId, number][]) records.skillXp[k] = (records.skillXp[k] ?? 0) + v;
  const ingredientCounts = { ...(chef0.records.ingredientCounts ?? {}) };
  for (const id of dish.recipe.ingredientIds) ingredientCounts[id] = (ingredientCounts[id] ?? 0) + 1;
  records.ingredientCounts = ingredientCounts;
  const mainCat = INGREDIENT_MAP[dish.recipe.ingredientIds[0]]?.category ?? "other";
  records.genreCounts[mainCat] = (records.genreCounts[mainCat] ?? 0) + 1;
  if (result.outcomes.some((o) => o.grade === "miracle") && !records.achievements.includes("奇跡の一皿")) {
    records.achievements.push("奇跡の一皿");
  }

  const xp = 8 + 2 * result.stepCount + RANK_XP[dish.rank] + xpBonus;
  const { chef: leveled, levelUps } = gainXp(
    { ...chef0, records, allocationLocked: true },
    xp,
    seedFrom(dish.generationKey, dish.process?.cookingSeed ?? 0, "level"),
  );
  const newSkills = learnedSkills(leveled).filter((s) => !before.has(s));

  return { chef: leveled, gains: { xp, skillXp, levelUps, newSkills } };
}

/** Skills with level ≥ 1, derived ones only once their prerequisite is met. */
export function learnedSkills(chef: Chef): SkillId[] {
  return (Object.keys(SKILL_MAP) as SkillId[]).filter((id) => {
    const req = SKILL_MAP[id].requires;
    if (req && skillLevel(chef, req.skill) < req.level) return false;
    return skillLevel(chef, id) >= 1;
  });
}
