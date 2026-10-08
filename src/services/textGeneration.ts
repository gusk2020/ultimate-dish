import type { Dish, Quest, QuestResult } from "../types";
import type { FinishInput } from "../types/world";
import { INGREDIENT_MAP } from "../data/ingredients";
import { METHOD_MAP } from "../data/methods";
import { FINISH_OPTIONS } from "../game/finish/finish";

// Text generation service. The game only talks to this interface; swap
// `textGenerator` for an API-backed implementation later without touching game logic.
//
// Future AI mapping: chef profile, ingredients, intermediates, step history, scores,
// school and skills are the *reference material*; the finishing free text is the *user prompt*.

export type DishForText = Omit<Dish, "description" | "image">;

export interface FinishingContext {
  ingredientNames: string[];
  schoolName: string;
  finalName: string;
}

export interface TextGenerator {
  describeDish(dish: DishForText, context?: { schoolName?: string }): Promise<string>;
  questResult(quest: Quest, dish: Dish, result: QuestResult): Promise<string>;
  /** "AI補助候補" for the finishing input. */
  suggestFinishing(context: FinishingContext): Promise<Partial<FinishInput>[]>;
}

const pick = <T,>(xs: readonly T[], n: number) => xs[Math.abs(n) % xs.length];

const mockTextGenerator: TextGenerator = {
  async describeDish(dish, context) {
    const ings = dish.recipe.ingredientIds.map((id) => INGREDIENT_MAP[id]?.name).filter(Boolean);
    const methods = dish.profile.methodIds.map((id) => METHOD_MAP[id]?.name).filter(Boolean);
    const how = methods.length ? `${methods.join("→")}で仕上げた` : "火を通さずに盛った";
    const p = dish.process;
    if (!p) return `${ings.join("、")}を${how}一皿。（ダミー説明文：将来AIが描写します）`;
    const f = p.finish;
    const parts = [
      `${context?.schoolName ?? ""}の手で、${ings.join("、")}を${how}一皿。`,
      p.finalLine.history.length ? `${p.finalLine.history.map((h) => `${h.label}${Math.round(h.ratio * 100)}%`).join("・")}の配合。` : "",
      f.vessel ? `${f.vessel}に${f.plating || "盛り付け"}、` : "",
      f.aroma && f.aroma !== "特になし" ? `${f.aroma}。` : "",
      f.freeText ? `「${f.freeText.slice(0, 40)}」` : "",
      "（ダミー説明文：将来AIが描写します）",
    ];
    return parts.filter(Boolean).join("");
  },
  async questResult(quest, _dish, result) {
    return result.success ? quest.successText : quest.failText;
  },
  async suggestFinishing(c) {
    const n = c.ingredientNames.join("").length;
    return [0, 1, 2].map((i) => ({
      plating: pick(FINISH_OPTIONS.plating, n + i),
      vessel: pick(FINISH_OPTIONS.vessel, n + i * 2),
      aroma: pick(FINISH_OPTIONS.aroma, n + i * 3),
      temperature: pick(["hot", "warm", "hot"] as const, i),
      howToEat: pick(FINISH_OPTIONS.howToEat, n + i),
      freeText: [
        `${c.finalName}を${c.schoolName}らしく素朴に。湯気ごと味わってほしい`,
        `${c.ingredientNames[0] ?? "素材"}の色を活かし、余白を大きくとって品よく`,
        `村の祭りのように皆で取り分けて、熱々のうちに`,
      ][i],
    }));
  },
};

export const textGenerator: TextGenerator = mockTextGenerator;
