import type { Ingredient, IngredientCategory, SourceId, TextureTag } from "../types";

// Normalised 0-10 values: good enough for dishes to compare, not lab data.
// Arrays: taste [sweet,salty,sour,bitter,umami,aroma], physical [water,fat,protein,hardness],
// nutrition [energy,protein,fat,carb,micro], resource [rarity,price,ease,sustainability].
type N6 = [number, number, number, number, number, number];
type N5 = [number, number, number, number, number];
type N4 = [number, number, number, number];

function ing(
  id: string,
  name: string,
  emoji: string,
  category: IngredientCategory,
  source: SourceId,
  t: N6,
  p: N4,
  textureTag: TextureTag,
  n: N5,
  r: N4,
  culture: number,
  tags: string[] = [],
): Ingredient {
  return {
    id,
    name,
    emoji,
    category,
    source,
    taste: { sweet: t[0], salty: t[1], sour: t[2], bitter: t[3], umami: t[4], aroma: t[5] },
    physical: { water: p[0], fat: p[1], protein: p[2], hardness: p[3] },
    textureTag,
    nutrition: { energy: n[0], protein: n[1], fat: n[2], carb: n[3], micro: n[4] },
    resource: { rarity: r[0], price: r[1], ease: r[2], sustainability: r[3] },
    culture,
    tags,
  };
}

export const INGREDIENTS: Ingredient[] = [
  // 動物性
  ing("boar", "イノシシ肉", "🐗", "animal", "hunt", [1, 1, 0, 1, 7, 4], [5, 6, 8, 8], "chewy", [7, 9, 6, 0, 4], [4, 5, 4, 9], 6, ["pest", "meat", "needs-cook"]),
  ing("rabbit", "ウサギ肉", "🐇", "animal", "hunt", [1, 1, 0, 0, 5, 2], [6, 2, 8, 5], "tender", [5, 9, 2, 0, 4], [3, 4, 6, 9], 6, ["pest", "meat", "needs-cook"]),
  ing("chicken", "鶏肉", "🐔", "animal", "farm", [1, 1, 0, 0, 6, 2], [6, 4, 8, 4], "tender", [6, 9, 4, 0, 3], [2, 5, 7, 6], 8, ["meat", "needs-cook"]),
  ing("fish", "淡水魚", "🐟", "animal", "hunt", [1, 1, 0, 1, 6, 3], [7, 3, 8, 2], "soft", [4, 8, 3, 0, 5], [3, 4, 6, 6], 7, ["needs-cook"]),
  ing("saltfish", "保存魚", "🐠", "animal", "market", [0, 9, 0, 1, 8, 5], [2, 3, 9, 7], "firm", [5, 9, 3, 0, 5], [2, 4, 8, 7], 9),
  ing("egg", "卵", "🥚", "animal", "farm", [1, 1, 0, 0, 5, 1], [7, 5, 6, 2], "soft", [5, 7, 5, 0, 5], [1, 2, 9, 7], 8),
  ing("offal", "内臓", "🫀", "animal", "hunt", [0, 1, 0, 4, 7, 5], [6, 4, 7, 5], "chewy", [5, 8, 4, 1, 9], [2, 1, 5, 10], 4, ["needs-cook"]),
  // 植物系
  ing("wheat", "麦", "🌾", "plant", "farm", [3, 0, 0, 1, 1, 2], [1, 1, 2, 7], "firm", [8, 2, 1, 9, 3], [1, 1, 9, 8], 10, ["needs-cook"]),
  ing("beans", "豆", "🫘", "plant", "farm", [2, 0, 0, 2, 4, 1], [2, 1, 6, 8], "firm", [6, 6, 1, 6, 6], [1, 1, 8, 9], 8, ["needs-cook"]),
  ing("onion", "玉ねぎ", "🧅", "plant", "farm", [5, 0, 1, 2, 2, 6], [8, 0, 1, 4], "crisp", [2, 1, 0, 4, 5], [1, 1, 9, 9], 9),
  ing("cabbage", "キャベツ", "🥬", "plant", "farm", [3, 0, 0, 2, 2, 2], [9, 0, 1, 3], "crisp", [1, 1, 0, 3, 8], [1, 1, 9, 9], 9),
  ing("turnip", "カブ", "🥔", "plant", "farm", [4, 0, 0, 2, 1, 1], [9, 0, 1, 5], "crisp", [1, 1, 0, 3, 6], [1, 1, 9, 9], 9),
  ing("garlic", "ニンニク", "🧄", "plant", "farm", [1, 0, 0, 3, 3, 10], [6, 0, 2, 4], "firm", [2, 2, 0, 3, 6], [2, 2, 8, 8], 7),
  ing("mushroom", "キノコ", "🍄", "plant", "hunt", [0, 0, 0, 1, 9, 5], [9, 0, 3, 3], "chewy", [1, 3, 0, 1, 7], [4, 3, 5, 8], 7),
  ing("apple", "リンゴ", "🍎", "plant", "farm", [8, 0, 5, 0, 0, 6], [9, 0, 0, 5], "crisp", [3, 0, 0, 6, 6], [2, 2, 8, 8], 8),
  ing("herb", "ハーブ", "🌿", "plant", "hunt", [0, 0, 1, 4, 1, 10], [8, 0, 1, 1], "soft", [0, 0, 0, 1, 7], [2, 2, 8, 9], 6),
  ing("honey", "蜂蜜", "🍯", "plant", "market", [10, 0, 1, 0, 0, 6], [2, 0, 0, 1], "soft", [8, 0, 0, 10, 2], [5, 6, 4, 7], 6),
  ing("nuts", "ナッツ", "🌰", "plant", "hunt", [2, 0, 0, 2, 3, 4], [1, 9, 4, 7], "crisp", [9, 4, 9, 2, 7], [4, 4, 6, 8], 5),
  // 乳製品
  ing("milk", "牛乳", "🥛", "dairy", "farm", [4, 0, 0, 0, 2, 2], [9, 4, 3, 0], "soft", [4, 4, 4, 3, 6], [1, 2, 8, 6], 8),
  ing("butter", "バター", "🧈", "dairy", "market", [1, 1, 0, 0, 2, 6], [2, 10, 0, 2], "soft", [10, 0, 10, 0, 2], [3, 5, 6, 5], 7),
  // 調味料
  ing("salt", "塩", "🧂", "seasoning", "market", [0, 10, 0, 1, 1, 0], [0, 0, 0, 5], "firm", [0, 0, 0, 0, 3], [1, 1, 9, 9], 10),
  ing("vinegar", "酢", "🍶", "seasoning", "market", [1, 1, 9, 1, 2, 4], [9, 0, 0, 0], "soft", [0, 0, 0, 1, 2], [2, 2, 7, 8], 7),
  ing("cheese", "チーズ", "🧀", "dairy", "market", [1, 6, 2, 1, 9, 7], [4, 7, 7, 4], "soft", [7, 7, 7, 0, 5], [4, 5, 5, 6], 7),
  // Phase 7: regional ingredients (fixed data). The village knows them less well (low culture).
  // 川沿いの市場町
  ing("riverprawn", "川海老", "🦐", "animal", "river", [2, 1, 0, 0, 7, 4], [7, 1, 8, 4], "firm", [3, 8, 1, 0, 6], [4, 3, 6, 7], 5, ["needs-cook"]),
  ing("leek", "川葱", "🧅", "plant", "river", [3, 0, 0, 2, 3, 8], [9, 0, 1, 3], "soft", [1, 1, 0, 3, 7], [1, 1, 9, 9], 6),
  ing("noodles", "乾麺", "🍜", "plant", "river", [1, 1, 0, 0, 1, 1], [1, 0, 3, 8], "chewy", [8, 3, 0, 9, 2], [2, 2, 8, 8], 5, ["needs-cook"]),
  // 港町
  ing("seafish", "海魚", "🐟", "animal", "sea", [1, 2, 0, 1, 8, 4], [7, 5, 8, 3], "soft", [5, 9, 5, 0, 6], [3, 4, 6, 6], 3, ["needs-cook"]),
  ing("shellfish", "貝", "🦪", "animal", "sea", [2, 3, 0, 1, 9, 5], [8, 1, 6, 4], "chewy", [2, 7, 1, 1, 9], [3, 4, 6, 7], 2, ["needs-cook"]),
  ing("seaweed", "海藻", "🍃", "plant", "sea", [0, 4, 0, 1, 8, 4], [6, 0, 1, 2], "soft", [0, 1, 0, 1, 10], [2, 2, 8, 9], 2),
  ing("seasalt", "海塩", "🧂", "seasoning", "sea", [0, 10, 0, 1, 3, 1], [0, 0, 0, 5], "firm", [0, 0, 0, 0, 5], [2, 2, 8, 9], 6),
  ing("lemon", "酸柑", "🍋", "plant", "sea", [2, 0, 9, 2, 0, 9], [8, 0, 0, 4], "crisp", [1, 0, 0, 3, 8], [3, 3, 7, 8], 3),
  ing("cinnamon", "肉桂", "🍂", "seasoning", "sea", [3, 0, 0, 3, 0, 10], [0, 0, 0, 8], "firm", [0, 0, 0, 1, 4], [6, 6, 4, 6], 2),
  // 山岳・高地
  ing("goatmilk", "山羊乳", "🐐", "dairy", "mountain", [3, 1, 1, 1, 3, 4], [9, 5, 4, 0], "soft", [5, 5, 5, 3, 7], [3, 3, 6, 7], 4),
  ing("hardcheese", "硬質チーズ", "🧀", "dairy", "mountain", [1, 7, 2, 1, 10, 8], [2, 8, 9, 8], "firm", [8, 9, 8, 0, 6], [5, 5, 5, 7], 4),
  ing("wildgreens", "山菜", "🌱", "plant", "mountain", [1, 0, 0, 5, 2, 7], [8, 0, 1, 3], "crisp", [0, 1, 0, 2, 9], [3, 2, 6, 9], 5),
  ing("ibex", "岩山羊肉", "🥩", "animal", "mountain", [1, 1, 0, 1, 8, 5], [5, 4, 9, 8], "chewy", [7, 10, 4, 0, 5], [5, 5, 4, 8], 3, ["meat", "needs-cook"]),
];

export const INGREDIENT_MAP: Record<string, Ingredient> = Object.fromEntries(
  INGREDIENTS.map((i) => [i.id, i]),
);

export const CATEGORY_LABEL: Record<IngredientCategory, string> = {
  animal: "動物性",
  plant: "植物系",
  dairy: "乳製品",
  seasoning: "調味料",
};

export const MAX_INGREDIENTS = 6;
