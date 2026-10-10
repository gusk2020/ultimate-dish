// Phase 8: who the player is, decided once in the character creation sequence.
//
// Gender expression and age are TEXT ONLY: forms of address, first-person candidates, lines,
// social reactions in quests and future relationship events. Nothing that computes cooking,
// growth, success, stats or battles may read them (a test guards this).
import type { Lean } from "./social";

export type GenderExpression = "masculine" | "feminine" | "androgynous" | "neutral";
export type StartChoice = "companion" | "tool";
/** How the companion's human-like form presents (its true nature is a spirit / familiar). */
export type CompanionPresentation = "boy" | "girl";

export interface PlayerIdentity {
  creationCompleted: boolean;
  lean: Lean | null;
  genderExpression: GenderExpression | null;
  age: number | null;
  start: StartChoice | null;
  startingToolId: string | null;
  companionPresentation: CompanionPresentation | null;
}
