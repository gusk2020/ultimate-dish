import type { Dish, Recipe } from "../../types";
import { evaluateDish } from "../evaluation/absolute";
import { rateDish } from "../evaluation/rating";
import { cookProfile, resolveIngredients } from "./cook";
import { canonicalRecipe, seedFromKey, toGenerationKey } from "./generationKey";
import { generateDishName } from "./naming";

/** Everything about a dish except what the (future AI) services add. */
export type DishCore = Omit<Dish, "description" | "image">;

let counter = 0;
function newId(): string {
  counter += 1;
  return `dish-${Date.now().toString(36)}-${counter.toString(36)}`;
}

/** Recipe → dish data. Deterministic except for id / createdAt. */
export function buildDish(recipe: Recipe, parentDishId: string | null = null): DishCore {
  const canonical = canonicalRecipe(recipe);
  const generationKey = toGenerationKey(canonical);
  const ings = resolveIngredients(canonical);
  const profile = cookProfile(canonical);
  const scores = evaluateDish(profile, ings);
  const rating = rateDish(scores, profile.undercooked);
  return {
    id: newId(),
    name: generateDishName(ings, profile, seedFromKey(generationKey)),
    generationKey,
    parentDishId,
    isPublic: false,
    recipe: canonical,
    profile,
    scores,
    total: rating.total,
    rank: rating.rank,
    titles: rating.titles,
    rankCap: rating.rankCap,
    createdAt: Date.now(),
    guild: { favorites: 0, reproductions: 0 },
  };
}
