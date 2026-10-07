import type { Dish, Quest, QuestResult } from "../types";
import { INGREDIENT_MAP } from "../data/ingredients";
import { METHOD_MAP } from "../data/methods";

// Text generation service. The game only talks to this interface; swap
// `textGenerator` for an API-backed implementation later without touching game logic.

export type DishForText = Omit<Dish, "description" | "image">;

export interface TextGenerator {
  describeDish(dish: DishForText): Promise<string>;
  questResult(quest: Quest, dish: Dish, result: QuestResult): Promise<string>;
}

const mockTextGenerator: TextGenerator = {
  async describeDish(dish) {
    const ings = dish.recipe.ingredientIds.map((id) => INGREDIENT_MAP[id]?.name).filter(Boolean);
    const methods = dish.profile.methodIds.map((id) => METHOD_MAP[id]?.name).filter(Boolean);
    const how = methods.length ? `${methods.join("→")}で仕上げた` : "火を通さずに盛った";
    return `${ings.join("、")}を${how}一皿。（ダミー説明文：将来AIが描写します）`;
  },
  async questResult(quest, _dish, result) {
    return result.success ? quest.successText : quest.failText;
  },
};

export const textGenerator: TextGenerator = mockTextGenerator;
