import type { Recipe, Step } from "../../types";
import { fnv1a } from "../util";

// Generation key = a canonical, human-readable encoding of the recipe plus a checksum.
//   UD1|boar.onion|m:grill,t:stone,m:boil,s:homura|1x9k2a
// The same key always rebuilds the same recipe, and the dish logic is deterministic,
// so the key is a reproduction seed. The checksum doubles as the numeric seed used
// for cosmetic choices (name wording, placeholder colours, future AI image seed).

const VERSION = "UD1";
const STEP_CODE: Record<Step["kind"], string> = { method: "m", spice: "s", tool: "t" };
const CODE_STEP: Record<string, Step["kind"]> = { m: "method", s: "spice", t: "tool" };

/** Ingredients are a set, so they are sorted; steps keep their order. */
export function canonicalRecipe(recipe: Recipe): Recipe {
  return { ingredientIds: [...recipe.ingredientIds].sort(), steps: recipe.steps.map((s) => ({ ...s })) };
}

function body(recipe: Recipe): string {
  const c = canonicalRecipe(recipe);
  const steps = c.steps.map((s) => `${STEP_CODE[s.kind]}:${s.id}`).join(",");
  return `${VERSION}|${c.ingredientIds.join(".")}|${steps}`;
}

export function toGenerationKey(recipe: Recipe): string {
  const b = body(recipe);
  return `${b}|${fnv1a(b).toString(36)}`;
}

export function seedFromKey(key: string): number {
  const parts = key.split("|");
  return parseInt(parts[parts.length - 1], 36) >>> 0;
}

/** Returns null for a malformed or tampered key. */
export function parseGenerationKey(key: string): Recipe | null {
  const parts = key.split("|");
  if (parts.length !== 4 || parts[0] !== VERSION) return null;
  const [, ings, steps, check] = parts;
  const recipe: Recipe = {
    ingredientIds: ings ? ings.split(".") : [],
    steps: steps
      ? steps.split(",").map((tok) => {
          const [code, id] = tok.split(":");
          return { kind: CODE_STEP[code], id } as Step;
        })
      : [],
  };
  if (recipe.steps.some((s) => !s.kind || !s.id)) return null;
  if (fnv1a(body(recipe)).toString(36) !== check) return null;
  return recipe;
}
