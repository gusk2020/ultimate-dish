// Phase 6: companions, relationships and cooperative cooking. Pure data shapes only.
import type { EaterProfile } from "./eating";
import type { SkillId, Stats } from "./world";
import type { CompanionPresentation } from "./identity";

/** Four short personality axes, each -1..1. */
export type PersonalityAxis = "pace" | "talk" | "mind" | "venture";
// pace: 慎重(-) … 即断(+) / talk: 寡黙(-) … おしゃべり(+) / mind: 理屈(-) … 感覚(+) / venture: 保守(-) … 冒険(+)
export type Personality = Record<PersonalityAxis, number>;

/** 作り手 (cooks) or 食べ手 (tastes and judges). */
export type Lean = "maker" | "eater";

export interface PlayerPersona {
  personality: Personality;
  lean: Lean;
}

/** What a character is good at when helping in the kitchen. */
export interface Specialty {
  kind: "method" | "category" | "skill";
  id: string;
  label: string;
}

export type DialogueKey =
  | "greet" // first meeting / candidate card
  | "talk" // small talk
  | "beforeMeal"
  | "afterGood"
  | "afterBad"
  | "beforeCook"
  | "success"
  | "fail"
  | "relationUp"
  | "progress" // allies: relationship moving on
  | "join"; // allies: joining the party

/** Shared by the special companion and ordinary allies. */
export interface CharacterDef {
  id: string;
  name: string;
  emoji: string;
  kind: "companion" | "ally";
  species: string; // 種族・素性
  role: string; // one line: 評者 / 火の番 / 猟師 …
  lean: Lean;
  personality: Personality;
  eater: EaterProfile;
  /** Chef-like ability data, so the same cooking engine can use them. */
  chef: { level: number; stats: Stats; schoolId: string; skills: Partial<Record<SkillId, number>> };
  specialties: Specialty[];
  /** Recipes this character can cook as the main cook (even if the player does not know them). */
  signatureRecipeIds: string[];
  dialogue: Partial<Record<DialogueKey, string[]>>;
  blurb: string;
  /** Companion candidates: why this one is the player's opposite (shown on the card). */
  complement?: string[];
  /** Allies: what it takes to join. Each ally has its own mix. */
  joinConditions?: JoinCondition[];
  /** Allies: where they are met in the village (facility id). */
  homeFacilityId?: string;
  // Phase 8: how the companion is seen. Its true nature is close to a spirit, a monster or a
  // familiar. People with enough magic (the player) see a boy / girl with a personality;
  // ordinary people only see an animal or an object.
  presentationGender?: CompanionPresentation;
  trueNature?: string;
  /** What someone with enough magic sees. */
  visibleForm?: string;
  /** What a low-magic person sees, and a line such a person might say about it. */
  lowMagicAppearance?: { kind: "animal" | "object"; label: string; remark: string };
}

export type JoinCondition =
  | { kind: "affection"; min: number }
  | { kind: "trust"; min: number }
  | { kind: "foodCompatibility"; min: number }
  | { kind: "memory"; recipeId: string; label: string } // has eaten this dish of yours (a food memory)
  | { kind: "cookedTogether"; min: number }
  | { kind: "sharedMeals"; min: number }
  | { kind: "battleWin"; battleId?: string } // any battle if omitted
  | { kind: "quest"; questId: string; label: string };

// ---------- Relationships ----------

export type MemoryKind = "firstDish" | "meal" | "sharedMeal" | "cookTogether";

export interface FoodMemory {
  id: string;
  dishId: string;
  dishName: string;
  recipeId: string | null;
  day: number;
  kind: MemoryKind;
  reaction: string;
  score: number; // 0..100 experience (for cooking: dish total)
  liking: number; // -1..1
  cookedBy: string[];
  sharedWith: string[];
  importance: number;
}

/** One pair of people (the player is "player"). Future: friendship / rivalry / mentor / romance grow from these numbers. */
export interface Relationship {
  key: string;
  a: string;
  b: string;
  affection: number; // 0..100
  trust: number; // 0..100
  foodCompatibility: number; // 0..100 (50 = neutral)
  conflicts: number; // 0..100 friction, eases with good moments
  memories: FoodMemory[];
  sharedMeals: number;
  cookedTogether: number;
  traveledTogether: number; // reserved: travel system
  tags: string[]; // e.g. "companion", "party"
  lastTalkDay?: number;
}

export interface SocialState {
  persona: PlayerPersona | null;
  companionChoice: "pending" | "accepted" | "declined";
  companion: CharacterDef | null;
  /** Ordinary allies who joined. */
  party: string[];
  relations: Record<string, Relationship>;
}

/** Who cooks: one main cook plus helpers (one today; the type allows more later). */
export interface CookTeam {
  mainId: string; // "player" or a character id
  assistantIds: string[];
}
