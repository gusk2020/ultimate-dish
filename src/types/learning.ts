// Phase 5: recipe knowledge, mastery and derivation. Pure data shapes only.

/** unknown = absent from the book; trialAvailable is derived (known + requirements met). */
export type RecipeStatus = "unknown" | "known" | "trialAvailable" | "mastered";
export type RecipeSource = "start" | "npc" | "book" | "battle" | "derived" | "region";

/** What the player has actually done with a recipe — the source for derivation ideas. */
export interface RecipeHistory {
  toolUses: Record<string, number>;
  schoolUses: Record<string, number>;
  aromaUses: Record<string, number>; // finishing 香り演出
  vesselUses: Record<string, number>;
  greatSteps: number; // great / miracle step results
  maxBatch: number;
  bestTotal: number;
}

export interface RecipeProgress {
  recipeId: string;
  state: "known" | "mastered";
  source: RecipeSource;
  discoveredDay: number;
  masteredDay?: number;
  mastery: number; // 0..100
  timesCooked: number;
  failedTrials: number;
  history: RecipeHistory;
  // Future special battles (steal / seal / erase) would add fields here, e.g. sealedUntilDay.
  // Normal play never removes a learned recipe.
}

export interface DerivationIdea {
  id: string; // `${baseRecipeId}:${ruleId}`
  baseRecipeId: string;
  ruleId: string;
  day: number;
}

export interface LearningEvent {
  trial: boolean;
  mastered: boolean; // first success just now
  trialFailed: boolean;
  masteryBefore: number;
  masteryAfter: number;
  stageUp: string | null;
  newIdeas: DerivationIdea[];
}
