import type { DishImage } from "../types";
import { INGREDIENT_MAP } from "../data/ingredients";
import { seedFromKey } from "../game/cooking/generationKey";
import type { DishForText } from "./textGeneration";

// Image generation service. Mock: a deterministic placeholder (emoji + gradient)
// derived from the generation key, so the same key always gets the same picture.

export interface ImageGenerator {
  generate(dish: DishForText): Promise<DishImage>;
}

const mockImageGenerator: ImageGenerator = {
  async generate(dish) {
    const seed = seedFromKey(dish.generationKey);
    const hue = seed % 360;
    const main = INGREDIENT_MAP[dish.recipe.ingredientIds[0]];
    return {
      kind: "placeholder",
      emoji: main?.emoji ?? "🍽️",
      colors: [`hsl(${hue} 70% 82%)`, `hsl(${(hue + 40) % 360} 65% 62%)`],
    };
  },
};

export const imageGenerator: ImageGenerator = mockImageGenerator;
