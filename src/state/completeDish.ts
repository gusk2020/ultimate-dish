import type { Dish, Recipe } from "../types";
import { buildDish } from "../game/cooking/buildDish";
import { textGenerator } from "../services/textGeneration";
import { imageGenerator } from "../services/imageGeneration";

/** Game logic builds the dish; the (mock) AI services decorate it. */
export async function completeDish(recipe: Recipe, parentDishId: string | null): Promise<Dish> {
  const core = buildDish(recipe, parentDishId);
  const [description, image] = await Promise.all([
    textGenerator.describeDish(core),
    imageGenerator.generate(core),
  ]);
  return { ...core, description, image };
}
