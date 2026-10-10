// Phase 9: roles, the personal codex, third-party reviews and the public registry.
//
//   Recipe            = how to make it (RecipeDef, the player's recipeBook)
//   Dish              = one dish / batch actually made (Dish, DishStock)
//   Notebook          = what the player only knows about (recipeBook entries)
//   CodexEntry        = the player's own record of a dish they made or ate
//   PublicDishRecord  = a dish published to the world (guild → … → world)

export interface PlayerProgression {
  /** 料理人: chef.level / chef.xp are the maker progression (unchanged). */
  eaterXp: number;
  eaterLevel: number;
  reputation: number;
  /** What the eater has met at the table: ingredient / method / region / recipe id → count. */
  experience: { ingredients: Record<string, number>; methods: Record<string, number>; regions: Record<string, number> };
  /** Times each dish (codex key) has been eaten — drives diminishing XP. */
  eatenCounts: Record<string, number>;
  /** Spice the player has survived (激辛). */
  spiceTolerance: number;
  /** Eater quests taken (食べ比べ・大食い・激辛・審査員). */
  questLog: { questId: string; day: number; success: boolean }[];
  /** Phase 10: the eater's school (流派) and skill xp. */
  eaterSchoolId: string;
  eaterSkills: Partial<Record<import("../data/eaterSchools").EaterSkillId, number>>;
}

/** Phase 10: how often the player has faced each opponent (maker battles and eater challenges). */
export interface OpponentProgress {
  opponentId: string;
  matches: number;
  wins: number;
  losses: number;
}

export type ReviewSource = "questJudge" | "hiredTaster" | "guildReview" | "publicReview";

export interface ThirdPartyReview {
  reviewerId: string;
  reviewerName: string;
  reviewerLevel: number;
  reviewerFame: number;
  /** How much this review counts in public scoring (fame × expertise). */
  weight: number;
  context: string;
  score: number; // 0..100
  good: string;
  bad: string;
  forWhom: string;
  impression: string;
  day: number;
  source: ReviewSource;
}

export interface CodexEntry {
  key: string; // recipe id, or the dish name for free-form dishes
  name: string;
  recipeId: string | null;
  emoji: string;
  bestRank: string;
  bestTotal: number;
  ingredientIds: string[];
  methodIds: string[];
  origin: string; // 自作 / 旅先 / 勝負の相手 …
  timesCooked: number;
  timesEaten: number;
  firstCookedDay?: number;
  firstEatenDay?: number;
  ownReport?: { score: number; text: string; day: number };
  reviews: ThirdPartyReview[];
  parentKeys: string[];
  publicId?: string;
  lastDishId?: string;
}

export type PublicStage = "guild" | "nation" | "region" | "civilization" | "world";

export interface PublicDishRecord {
  id: string;
  codexKey: string;
  name: string;
  recipeId: string | null;
  author: string;
  stage: PublicStage;
  absolute: number; // the dish's own total
  reviews: ThirdPartyReview[];
  publishedDay: number;
  reproductions: number;
  parentPublicIds: string[];
}
