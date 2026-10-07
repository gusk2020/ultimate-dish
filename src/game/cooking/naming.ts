import { METHOD_MAP } from "../../data/methods";
import type { DishProfile, Ingredient } from "../../types";

// Rule-based name: [特徴] + 主素材 (+ 副素材) + の + 主要調理法.

function pick<T>(list: T[], seed: number): T {
  return list[seed % list.length];
}

function feature(p: DishProfile, seed: number): string {
  if (p.body.mana >= 5) return pick(["蒼く輝く", "魔力満ちる"], seed);
  if (p.body.fatigue >= 5) return pick(["癒しの", "滋養の"], seed);
  if (p.body.condition >= 5) return pick(["清らかな", "整いの"], seed);
  const t = p.taste;
  const candidates: [number, string[]][] = [
    [t.aroma, ["香り立つ", "芳しき"]],
    [t.umami, ["旨み溢れる", "滋味深い"]],
    [t.sweet, ["甘やかな", "蜜色の"]],
    [t.sour * 1.1, ["爽やかな", "きりりとした"]],
    [t.salty * 0.9, ["塩香る", "力強い"]],
  ];
  candidates.sort((a, b) => b[0] - a[0]);
  if (p.textureTag === "crisp" && seed % 3 === 0) return "カリッと";
  if (p.textureTag === "tender" && seed % 3 === 0) return "ほろほろ";
  return pick(candidates[0][1], seed >>> 3);
}

/** The ingredient that "leads" the dish: most protein + umami, ties keep order. */
function mainIngredients(ings: Ingredient[]): Ingredient[] {
  return [...ings].sort(
    (a, b) => b.physical.protein + b.taste.umami - (a.physical.protein + a.taste.umami),
  );
}

export function generateDishName(ings: Ingredient[], p: DishProfile, seed: number): string {
  if (!ings.length) return "空っぽの皿";
  const [main, second] = mainIngredients(ings);
  const lastMethod = p.methodIds.length ? METHOD_MAP[p.methodIds[p.methodIds.length - 1]] : null;
  const dishWord = lastMethod ? lastMethod.verb : pick(["盛り合わせ", "和え物"], seed);
  const subject = second ? `${main.name}と${second.name}` : main.name;
  return `${feature(p, seed)}${subject}の${dishWord}`;
}
