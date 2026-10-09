// Recipe book for the everyday kitchen (レシピ調理). Each school can add its own basics here.

export type SalesTag =
  | "light" | "soup" | "preserved" | "bread" // 朝向き
  | "deli" | "staple" | "worker" // 昼向き
  | "meat" | "luxury" | "snack" // 夕向き
  | "family" | "healthy";

export const SALES_TAG_LABEL: Record<SalesTag, string> = {
  light: "軽食", soup: "スープ", preserved: "保存食", bread: "パン系", deli: "総菜", staple: "主食",
  worker: "労働者向け", meat: "肉料理", luxury: "豪華", snack: "酒肴", family: "家族向け", healthy: "滋養",
};

export interface RecipeLine {
  itemId: string;
  amount: number; // per portion
}

export interface RecipeDef {
  id: string;
  name: string;
  schoolId: string;
  ingredients: RecipeLine[];
  seasonings: RecipeLine[];
  basePortions: number;
  difficulty: number; // 1 (easy) .. 5 (precise)
  baseTimeDays: number; // for basePortions
  baseStamina: number;
  baseMagic: number; // MP before any tool
  toolCompat: string[]; // magic tools that make sense here
  salesTags: SalesTag[];
  /** Internal step template (2-4 judgements). Labels are what the player sees. */
  steps: { label: string; methodId: string }[];
  // Phase 5
  /** Conditions to try (試作) this recipe once it is known. All must hold. */
  requirements?: RecipeRequirement[];
  /** Short lore line for recipes learned from people or books. */
  lore?: string;
  /** Player-made recipes (派生). Built-in data never sets these. */
  custom?: boolean;
  /** Lineage: one parent today; several for future fusion / other players' derivations. */
  parentRecipeIds?: string[];
  description?: string;
  origin?: string;
  variant?: string;
  createdDay?: number;
}

export type RecipeRequirement =
  | { kind: "level"; min: number }
  | { kind: "stat"; stat: "tech" | "knowledge" | "luck" | "magic" | "strength"; min: number }
  | { kind: "skill"; skill: string; min: number }
  | { kind: "school"; schoolId: string } // the school must be learned
  | { kind: "schoolMastery"; schoolId: string; min: number }
  | { kind: "ingredientExp"; itemId: string; min: number } // times cooked with it
  | { kind: "methodExp"; methodId: string; min: number }; // times the method was used

export const RECIPES: RecipeDef[] = [
  {
    id: "rabbit-stew",
    name: "兎肉と野菜の煮込み",
    schoolId: "village",
    ingredients: [{ itemId: "rabbit", amount: 0.5 }, { itemId: "onion", amount: 0.5 }, { itemId: "cabbage", amount: 0.5 }],
    seasonings: [{ itemId: "salt", amount: 0.1 }],
    basePortions: 1,
    difficulty: 2,
    baseTimeDays: 0.05,
    baseStamina: 6,
    baseMagic: 0,
    toolCompat: ["stone", "pot"],
    salesTags: ["deli", "staple", "family"],
    steps: [{ label: "下処理", methodId: "cut" }, { label: "煮込み", methodId: "boil" }],
  },
  {
    id: "boar-herb-roast",
    name: "猪肉の香草焼き",
    schoolId: "village",
    ingredients: [{ itemId: "boar", amount: 0.5 }, { itemId: "herb", amount: 0.3 }, { itemId: "garlic", amount: 0.2 }],
    seasonings: [{ itemId: "salt", amount: 0.1 }],
    basePortions: 1,
    difficulty: 3,
    baseTimeDays: 0.04,
    baseStamina: 8,
    baseMagic: 0,
    toolCompat: ["stone", "pot"],
    salesTags: ["meat", "snack", "worker"],
    steps: [{ label: "下処理", methodId: "cut" }, { label: "火入れ", methodId: "grill" }],
  },
  {
    id: "bean-wheat-soup",
    name: "豆と麦の滋養スープ",
    schoolId: "village",
    ingredients: [{ itemId: "beans", amount: 0.4 }, { itemId: "wheat", amount: 0.4 }, { itemId: "onion", amount: 0.3 }],
    seasonings: [{ itemId: "salt", amount: 0.1 }],
    basePortions: 1,
    difficulty: 1,
    baseTimeDays: 0.06,
    baseStamina: 4,
    baseMagic: 0,
    toolCompat: ["stone", "jar"],
    salesTags: ["soup", "light", "healthy"],
    steps: [{ label: "炒め", methodId: "saute" }, { label: "煮込み", methodId: "boil" }],
  },
  // Other schools' basics. Rivals cook these today; learning them is Phase 5.
  {
    id: "smoked-boar",
    name: "猪肉の塩燻し",
    schoolId: "north",
    ingredients: [{ itemId: "boar", amount: 0.5 }, { itemId: "herb", amount: 0.1 }],
    seasonings: [{ itemId: "salt", amount: 0.2 }],
    basePortions: 1,
    difficulty: 3,
    baseTimeDays: 0.2,
    baseStamina: 7,
    baseMagic: 0,
    toolCompat: ["jar", "stone"],
    salesTags: ["meat", "preserved", "snack"],
    steps: [{ label: "下処理", methodId: "cut" }, { label: "燻し", methodId: "smoke" }],
  },
  {
    id: "mushroom-porridge",
    name: "茸と麦のミルク粥",
    schoolId: "north",
    ingredients: [{ itemId: "mushroom", amount: 0.3 }, { itemId: "wheat", amount: 0.4 }, { itemId: "milk", amount: 0.3 }],
    seasonings: [{ itemId: "salt", amount: 0.1 }],
    basePortions: 1,
    difficulty: 1,
    baseTimeDays: 0.05,
    baseStamina: 4,
    baseMagic: 0,
    toolCompat: ["stone"],
    salesTags: ["soup", "healthy", "light"],
    steps: [{ label: "炒め", methodId: "saute" }, { label: "煮込み", methodId: "boil" }],
  },
  {
    id: "honey-glazed-chicken",
    name: "鶏肉の蜂蜜照り焼き",
    schoolId: "court",
    ingredients: [{ itemId: "chicken", amount: 0.5 }, { itemId: "honey", amount: 0.2 }, { itemId: "butter", amount: 0.1 }],
    seasonings: [{ itemId: "salt", amount: 0.1 }],
    basePortions: 1,
    difficulty: 4,
    baseTimeDays: 0.04,
    baseStamina: 8,
    baseMagic: 0,
    toolCompat: ["stone", "pot"],
    salesTags: ["meat", "luxury"],
    steps: [{ label: "火入れ", methodId: "saute" }, { label: "照り", methodId: "reduce" }],
  },
  // Phase 5: recipes learned in play (NPC / book / battle). Not known at start.
  {
    id: "hanna-pickled-cabbage",
    name: "女将の林檎キャベツ酢漬け",
    schoolId: "village",
    ingredients: [{ itemId: "cabbage", amount: 0.5 }, { itemId: "apple", amount: 0.3 }],
    seasonings: [{ itemId: "vinegar", amount: 0.2 }, { itemId: "salt", amount: 0.1 }],
    basePortions: 1,
    difficulty: 2,
    baseTimeDays: 0.3,
    baseStamina: 4,
    baseMagic: 0,
    toolCompat: ["jar"],
    salesTags: ["preserved", "light", "healthy"],
    steps: [{ label: "下処理", methodId: "cut" }, { label: "漬け込み", methodId: "pickle" }],
    requirements: [{ kind: "methodExp", methodId: "boil", min: 2 }, { kind: "stat", stat: "knowledge", min: 10 }],
    lore: "宿屋の女将ハンナが母から受け継いだ、冬を越すための酢漬け。",
  },
  {
    id: "archive-dried-boar",
    name: "古記録の塩漬け干し肉",
    schoolId: "north",
    ingredients: [{ itemId: "boar", amount: 0.5 }, { itemId: "herb", amount: 0.1 }],
    seasonings: [{ itemId: "salt", amount: 0.3 }],
    basePortions: 1,
    difficulty: 3,
    baseTimeDays: 0.4,
    baseStamina: 6,
    baseMagic: 0,
    toolCompat: ["jar"],
    salesTags: ["preserved", "snack", "worker"],
    steps: [{ label: "下処理", methodId: "cut" }, { label: "干し", methodId: "dry" }],
    requirements: [{ kind: "level", min: 2 }, { kind: "ingredientExp", itemId: "boar", min: 1 }],
    lore: "資料庫の『古い保存食の記録』に残る、猟師たちの干し肉。",
  },
  {
    id: "gald-baked-apple",
    name: "ガルド家の焼き林檎蜂蜜がけ",
    schoolId: "village",
    ingredients: [{ itemId: "apple", amount: 0.6 }, { itemId: "honey", amount: 0.2 }, { itemId: "butter", amount: 0.1 }],
    seasonings: [],
    basePortions: 1,
    difficulty: 1,
    baseTimeDays: 0.03,
    baseStamina: 3,
    baseMagic: 0,
    toolCompat: ["stone"],
    salesTags: ["light", "family", "snack"],
    steps: [{ label: "下処理", methodId: "cut" }, { label: "焼き", methodId: "grill" }],
    requirements: [{ kind: "school", schoolId: "village" }, { kind: "schoolMastery", schoolId: "village", min: 3 }],
    lore: "勝負に負けたガルドが「お前なら化けさせられる」と託した家の味。",
  },
];

export const RECIPE_MAP: Record<string, RecipeDef> = Object.fromEntries(RECIPES.map((r) => [r.id, r]));

/** Recipes known (and mastered) at game start: the starting school's basics — those with no requirements. */
export const STARTING_RECIPES = RECIPES.filter((r) => r.schoolId === "village" && !r.requirements?.length).map((r) => r.id);
