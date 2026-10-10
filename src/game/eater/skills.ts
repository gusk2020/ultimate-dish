import { DEFAULT_EATER_SCHOOL, EATER_SCHOOL_MAP, type EaterSchool, type EaterSkillId } from "../../data/eaterSchools";
import { INGREDIENT_MAP } from "../../data/ingredients";
import type { PlayerProgression } from "../../types/codex";

// 食べる側スキル: xp from the methods and ingredients of what was eaten. Level = √(xp/10).

const METHOD_SKILLS: Record<string, EaterSkillId[]> = {
  grill: ["judgeGrill", "judgeHeat"], saute: ["judgeGrill", "judgeHeat"], fry: ["judgeGrill", "judgeHeat"],
  boil: ["judgeStew", "judgeHeat"], reduce: ["judgeStew", "judgeHeat"], steam: ["judgeStew", "judgeHeat"], pressure: ["judgeStew", "judgeHeat"],
  smoke: ["judgeFerment", "smell"], ferment: ["judgeFerment", "palate"], pickle: ["judgeFerment", "palate"], dry: ["judgeFerment"],
  cut: ["judgePrep", "texture"], sousvide: ["judgeHeat", "texture"],
};

export const skillLevelOf = (xp: number) => Math.floor(Math.sqrt(Math.max(0, xp) / 10));

export function eaterSchoolOf(p: Pick<PlayerProgression, "eaterSchoolId">): EaterSchool {
  return EATER_SCHOOL_MAP[p.eaterSchoolId ?? DEFAULT_EATER_SCHOOL] ?? EATER_SCHOOL_MAP[DEFAULT_EATER_SCHOOL];
}

export function eaterSkillLevel(p: Pick<PlayerProgression, "eaterSkills">, id: EaterSkillId): number {
  return skillLevelOf(p.eaterSkills?.[id] ?? 0);
}

/** Skill xp for eating one dish (methods, ingredients, spice), school multipliers applied. */
export function eatingSkillXp(
  p: Pick<PlayerProgression, "eaterSchoolId">,
  dish: { recipe: { ingredientIds: string[] }; profile: { methodIds: string[] } },
  extra: Partial<Record<EaterSkillId, number>> = {},
): Partial<Record<EaterSkillId, number>> {
  const school = eaterSchoolOf(p);
  const out: Partial<Record<EaterSkillId, number>> = {};
  const add = (id: EaterSkillId, n: number) => (out[id] = (out[id] ?? 0) + n);
  for (const m of dish.profile.methodIds) for (const s of METHOD_SKILLS[m] ?? []) add(s, 3);
  for (const id of dish.recipe.ingredientIds) {
    const ing = INGREDIENT_MAP[id];
    if (!ing) continue;
    add("ingredients", 1);
    if (ing.source === "river" || ing.source === "sea") add("seafood", 3);
  }
  add("palate", 2);
  add("texture", 1);
  add("culture", 1);
  for (const [k, v] of Object.entries(extra) as [EaterSkillId, number][]) add(k, v);
  for (const k of Object.keys(out) as EaterSkillId[]) out[k] = Math.round(out[k]! * (school.skillXpMult[k] ?? 1));
  return out;
}

export function addSkillXp(p: PlayerProgression, gains: Partial<Record<EaterSkillId, number>>): PlayerProgression {
  const eaterSkills = { ...(p.eaterSkills ?? {}) };
  for (const [k, v] of Object.entries(gains) as [EaterSkillId, number][]) eaterSkills[k] = (eaterSkills[k] ?? 0) + v;
  return { ...p, eaterSkills };
}
