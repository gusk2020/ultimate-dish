import { INGREDIENT_MAP } from "../../data/ingredients";
import { METHOD_MAP } from "../../data/methods";
import { SPICE_MAP, TOOL_MAP } from "../../data/magic";
import type {
  BodyEffects, DishProfile, Ingredient, MagicTool, Physical, Recipe, Taste, TasteKey, TextureTag,
} from "../../types";
import { clamp } from "../util";

const TASTE_KEYS: TasteKey[] = ["sweet", "salty", "sour", "bitter", "umami", "aroma"];
const PHYS_KEYS: (keyof Physical)[] = ["water", "fat", "protein", "hardness"];

export function resolveIngredients(recipe: Recipe): Ingredient[] {
  return recipe.ingredientIds.map((id) => INGREDIENT_MAP[id]).filter((i): i is Ingredient => !!i);
}

/**
 * Turns a recipe into the cooked dish's physical/taste state.
 * Pure and deterministic: the same recipe always gives the same profile.
 */
export function cookProfile(recipe: Recipe): DishProfile {
  const ings = resolveIngredients(recipe);
  const n = Math.max(ings.length, 1);

  // Strong flavours carry through a mix, so taste blends mean with max.
  const taste = {} as Taste;
  for (const k of TASTE_KEYS) {
    const vals = ings.map((i) => i.taste[k]);
    const avg = vals.reduce((a, b) => a + b, 0) / n;
    taste[k] = 0.5 * avg + 0.5 * (vals.length ? Math.max(...vals) : 0);
  }
  const physical = {} as Physical;
  for (const k of PHYS_KEYS) physical[k] = ings.reduce((a, i) => a + i.physical[k], 0) / n;
  const nutrition = {
    energy: ings.reduce((a, i) => a + i.nutrition.energy, 0) / n,
    protein: ings.reduce((a, i) => a + i.nutrition.protein, 0) / n,
    fat: ings.reduce((a, i) => a + i.nutrition.fat, 0) / n,
    carb: ings.reduce((a, i) => a + i.nutrition.carb, 0) / n,
    micro: ings.reduce((a, i) => a + i.nutrition.micro, 0) / n,
  };
  let textureTag: TextureTag = dominantTexture(ings);

  const body: BodyEffects = { fatigue: 0, mana: 0, condition: 0 };
  const methodFits: number[] = [];
  const methodIds: string[] = [];
  const spiceIds: string[] = [];
  const toolIds: string[] = [];
  let cost = ings.reduce((a, i) => a + i.resource.price, 0);
  let energyCost = 0;
  let microRetention = 1;
  let crave = 0;
  let preserved = false;
  let cooked = false;
  let volatileAroma = 0; // spice aroma: escapes during later heating
  let pendingTool: MagicTool | null = null;
  let prevMethod: string | null = null;

  for (const step of recipe.steps) {
    if (step.kind === "tool") {
      const tool = TOOL_MAP[step.id];
      if (!tool) continue;
      pendingTool = tool;
      toolIds.push(tool.id);
      cost += 1;
    } else if (step.kind === "spice") {
      const s = SPICE_MAP[step.id];
      if (!s) continue;
      spiceIds.push(s.id);
      for (const [k, v] of Object.entries(s.tasteDelta) as [TasteKey, number][]) {
        if (k === "aroma") volatileAroma += v;
        else taste[k] += v;
      }
      for (const [k, v] of Object.entries(s.body) as [keyof BodyEffects, number][]) body[k] += v;
      crave += s.crave;
      cost += s.price;
      preserved ||= !!s.preserves;
    } else {
      const m = METHOD_MAP[step.id];
      if (!m) continue;
      const tool = pendingTool;
      pendingTool = null;
      let fit = 55 + m.fit({ taste, physical });
      let mult = 1;
      let retentionBonus = 0;
      let energy = m.energyCost;
      const sealed = tool?.system === "aroma";
      const precise = tool?.system === "heat" && m.systems.includes("heat");

      if (precise) {
        fit += 25;
        retentionBonus = 0.1;
        energy = Math.max(0, energy - 1);
      }
      if (tool?.system === "time" && m.systems.includes("time")) {
        mult = 1.5;
        fit += 15;
      }
      if (sealed) {
        fit += 10;
        taste.aroma += 1;
      }
      if (m.needsPrecision && !precise) fit -= 35;
      if (prevMethod === m.id) fit -= 15;

      for (const [k, v] of Object.entries(m.tasteDelta) as [TasteKey, number][]) {
        if (sealed && k === "aroma" && v < 0) continue;
        taste[k] += v * mult;
      }
      for (const [k, v] of Object.entries(m.physicalDelta) as [keyof Physical, number][]) {
        physical[k] += v * mult;
      }
      if (m.setsTexture) textureTag = m.setsTexture;
      if (m.systems.includes("heat") && !sealed) volatileAroma *= 0.5;

      microRetention *= Math.min(1.15, m.microRetention + retentionBonus);
      if (m.safe && (!m.needsPrecision || precise)) cooked = true;
      preserved ||= m.preserves;
      energyCost += energy;
      methodFits.push(clamp(fit, 0, 100));
      methodIds.push(m.id);
      prevMethod = m.id;
    }
  }

  taste.aroma += volatileAroma;
  for (const k of TASTE_KEYS) taste[k] = clamp(taste[k], 0, 10);
  for (const k of PHYS_KEYS) physical[k] = clamp(physical[k], 0, 10);
  nutrition.micro = clamp(nutrition.micro * microRetention, 0, 10);

  const undercooked = ings.some((i) => i.tags.includes("needs-cook")) && !cooked;

  return {
    taste, physical, textureTag, nutrition, microRetention, body,
    methodFits, methodIds, spiceIds, toolIds,
    cost, energyCost, undercooked, preserved, crave,
  };
}

function dominantTexture(ings: Ingredient[]): TextureTag {
  if (!ings.length) return "soft";
  const counts = new Map<TextureTag, number>();
  for (const i of ings) counts.set(i.textureTag, (counts.get(i.textureTag) ?? 0) + 1);
  let best = ings[0].textureTag;
  for (const [tag, c] of counts) if (c > (counts.get(best) ?? 0)) best = tag;
  return best;
}
