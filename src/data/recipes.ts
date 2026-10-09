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
  // Phase 7
  /** 地域料理: the culture region this dish belongs to (absent = the home village's everyday food). */
  originRegionId?: string;
  /** Culture traits (fresh, preserve, aroma …) for future regional evaluation and school fusion. */
  cultureTags?: string[];
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
  // Phase 7: regional dishes (fixed data). Learned on location; ingredients mostly bought there.
  {
    id: "river-grilled-fish",
    name: "川魚の串焼き",
    schoolId: "village",
    ingredients: [{ itemId: "fish", amount: 0.6 }, { itemId: "leek", amount: 0.2 }],
    seasonings: [{ itemId: "salt", amount: 0.1 }],
    basePortions: 1,
    difficulty: 1,
    baseTimeDays: 0.03,
    baseStamina: 4,
    baseMagic: 0,
    toolCompat: ["stone"],
    salesTags: ["deli", "light"],
    steps: [{ label: "下処理", methodId: "cut" }, { label: "串焼き", methodId: "grill" }],
    lore: "川沿いの市場町で、旅人が真っ先に頬張る獲れたての川魚。",
    originRegionId: "river",
    cultureTags: ["fresh", "quick", "fish"],
  },
  {
    id: "river-travelers-noodles",
    name: "旅人の汁麺",
    schoolId: "village",
    ingredients: [{ itemId: "noodles", amount: 0.5 }, { itemId: "leek", amount: 0.2 }, { itemId: "riverprawn", amount: 0.2 }],
    seasonings: [{ itemId: "salt", amount: 0.1 }],
    basePortions: 1,
    difficulty: 2,
    baseTimeDays: 0.04,
    baseStamina: 4,
    baseMagic: 0,
    toolCompat: ["pot"],
    salesTags: ["soup", "staple", "worker"],
    steps: [{ label: "下処理", methodId: "cut" }, { label: "汁で煮る", methodId: "boil" }],
    requirements: [{ kind: "methodExp", methodId: "boil", min: 3 }],
    lore: "安く、早く、温かい。市場町の屋台が旅人に出す一杯。",
    originRegionId: "river",
    cultureTags: ["cheap", "quick", "soup"],
  },
  {
    id: "river-vinegar-fish",
    name: "川魚の酢締め",
    schoolId: "village",
    ingredients: [{ itemId: "fish", amount: 0.5 }, { itemId: "onion", amount: 0.2 }],
    seasonings: [{ itemId: "vinegar", amount: 0.3 }, { itemId: "salt", amount: 0.1 }],
    basePortions: 1,
    difficulty: 2,
    baseTimeDays: 0.25,
    baseStamina: 4,
    baseMagic: 0,
    toolCompat: ["jar"],
    salesTags: ["preserved", "snack"],
    steps: [{ label: "下処理", methodId: "cut" }, { label: "酢で締める", methodId: "pickle" }],
    requirements: [{ kind: "stat", stat: "knowledge", min: 12 }],
    lore: "獲れすぎた日の知恵。酢で締めて数日もたせる。",
    originRegionId: "river",
    cultureTags: ["preserve", "vinegar", "fish"],
  },
  {
    id: "coast-dried-fish",
    name: "海魚の一夜干し",
    schoolId: "north",
    ingredients: [{ itemId: "seafish", amount: 0.6 }],
    seasonings: [{ itemId: "seasalt", amount: 0.2 }],
    basePortions: 1,
    difficulty: 2,
    baseTimeDays: 0.35,
    baseStamina: 5,
    baseMagic: 0,
    toolCompat: ["jar", "stone"],
    salesTags: ["preserved", "worker", "snack"],
    steps: [{ label: "開く", methodId: "cut" }, { label: "潮風で干す", methodId: "dry" }, { label: "炙る", methodId: "grill" }],
    lore: "港の軒先にずらりと並ぶ、潮風で一晩干した魚。食べる前にさっと炙る。",
    originRegionId: "coast",
    cultureTags: ["salt", "preserve", "fish"],
  },
  {
    id: "coast-seafood-stew",
    name: "港の魚介煮込み",
    schoolId: "village",
    ingredients: [{ itemId: "seafish", amount: 0.3 }, { itemId: "shellfish", amount: 0.3 }, { itemId: "onion", amount: 0.2 }, { itemId: "lemon", amount: 0.1 }],
    seasonings: [{ itemId: "seasalt", amount: 0.1 }],
    basePortions: 1,
    difficulty: 3,
    baseTimeDays: 0.06,
    baseStamina: 6,
    baseMagic: 0,
    toolCompat: ["pot", "stone"],
    salesTags: ["soup", "luxury", "family"],
    steps: [{ label: "下処理", methodId: "cut" }, { label: "大鍋で煮込む", methodId: "boil" }],
    requirements: [{ kind: "methodExp", methodId: "boil", min: 3 }, { kind: "level", min: 2 }],
    lore: "漁師町の大鍋。その日の網に入ったものを酸柑で締める。",
    originRegionId: "coast",
    cultureTags: ["fresh", "seafood", "aroma"],
  },
  {
    id: "coast-spiced-shells",
    name: "異国香る貝の蒸し物",
    schoolId: "court",
    ingredients: [{ itemId: "shellfish", amount: 0.5 }, { itemId: "seaweed", amount: 0.2 }, { itemId: "lemon", amount: 0.1 }],
    seasonings: [{ itemId: "cinnamon", amount: 0.05 }, { itemId: "seasalt", amount: 0.05 }],
    basePortions: 1,
    difficulty: 3,
    baseTimeDays: 0.04,
    baseStamina: 4,
    baseMagic: 0,
    toolCompat: ["pot"],
    salesTags: ["luxury", "snack"],
    steps: [{ label: "下処理", methodId: "cut" }, { label: "香り蒸し", methodId: "steam" }],
    requirements: [{ kind: "level", min: 3 }],
    lore: "異国の商船が持ち込んだ肉桂の香りを、港の貝にまとわせた一皿。",
    originRegionId: "coast",
    cultureTags: ["aroma", "exotic", "seafood"],
  },
  {
    id: "highland-cheese-porridge",
    name: "高地の山羊乳チーズ粥",
    schoolId: "north",
    ingredients: [{ itemId: "goatmilk", amount: 0.4 }, { itemId: "wheat", amount: 0.3 }, { itemId: "hardcheese", amount: 0.2 }],
    seasonings: [{ itemId: "salt", amount: 0.05 }],
    basePortions: 1,
    difficulty: 1,
    baseTimeDays: 0.05,
    baseStamina: 4,
    baseMagic: 0,
    toolCompat: ["pot"],
    salesTags: ["healthy", "staple", "light"],
    steps: [{ label: "下処理", methodId: "cut" }, { label: "煮る", methodId: "boil" }],
    lore: "冷えた朝に体の芯から温める、高地の滋養粥。",
    originRegionId: "mountain",
    cultureTags: ["nourish", "dairy", "cold"],
  },
  {
    id: "highland-smoked-ibex",
    name: "岩山羊の燻製",
    schoolId: "north",
    ingredients: [{ itemId: "ibex", amount: 0.6 }, { itemId: "herb", amount: 0.1 }],
    seasonings: [{ itemId: "salt", amount: 0.2 }],
    basePortions: 1,
    difficulty: 3,
    baseTimeDays: 0.4,
    baseStamina: 7,
    baseMagic: 0,
    toolCompat: ["jar", "stone"],
    salesTags: ["preserved", "meat", "worker"],
    steps: [{ label: "下処理", methodId: "cut" }, { label: "燻す", methodId: "smoke" }],
    requirements: [{ kind: "methodExp", methodId: "grill", min: 2 }, { kind: "level", min: 2 }],
    lore: "冬を越すための燻製。煙の香りは高地の家々の匂いそのもの。",
    originRegionId: "mountain",
    cultureTags: ["smoke", "preserve", "meat"],
  },
  {
    id: "highland-greens-nuts",
    name: "山菜と木の実の炒め",
    schoolId: "village",
    ingredients: [{ itemId: "wildgreens", amount: 0.5 }, { itemId: "nuts", amount: 0.2 }, { itemId: "hardcheese", amount: 0.1 }],
    seasonings: [{ itemId: "salt", amount: 0.05 }],
    basePortions: 1,
    difficulty: 2,
    baseTimeDays: 0.03,
    baseStamina: 3,
    baseMagic: 0,
    toolCompat: ["stone"],
    salesTags: ["healthy", "light"],
    steps: [{ label: "下処理", methodId: "cut" }, { label: "炒め", methodId: "saute" }],
    requirements: [{ kind: "stat", stat: "knowledge", min: 12 }],
    lore: "雪解けの頃だけ味わえる、ほろ苦い山の恵み。",
    originRegionId: "mountain",
    cultureTags: ["nourish", "seasonal", "bitter"],
  },
];

export const RECIPE_MAP: Record<string, RecipeDef> = Object.fromEntries(RECIPES.map((r) => [r.id, r]));

/** Recipes known (and mastered) at game start: the starting school's basics — those with no requirements. */
export const STARTING_RECIPES = RECIPES.filter((r) => r.schoolId === "village" && !r.requirements?.length && !r.originRegionId).map((r) => r.id);
