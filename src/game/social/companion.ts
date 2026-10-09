import {
  AXIS_COMPLEMENT, COMPANION_SPECIES, FOOD_COMPLEMENT, LEAN_COMPLEMENT, STAT_STYLE, type CompanionSpecies,
} from "../../data/companions";
import { ALLY_MAP } from "../../data/allies";
import type { BaseTaste, EaterProfile } from "../../types/eating";
import type { CharacterDef, Lean, Personality, PersonalityAxis, PlayerPersona } from "../../types/social";
import type { Chef, StatKey, Stats } from "../../types/world";
import { blankProfile, BASE_TASTES, describePalate } from "../eating/profile";
import { createDefaultChef, maxMP, maxStamina } from "../chef/stats";
import type { World } from "../world";
import { ensureRelation, palateSimilarity, PLAYER } from "./relations";

// 特殊相棒: built from the player's opposite. Not a full inversion — values, ethics and the
// love of food stay shared; temperament, palate, strengths and role are mirrored so the pair
// clash a little and cover each other's gaps.

const AXES: PersonalityAxis[] = ["pace", "talk", "mind", "venture"];
const clamp1 = (v: number) => Math.max(-1, Math.min(1, Math.round(v * 100) / 100));

// ---------- Persona (short) ----------

/** What can already be guessed: 保守/冒険 from the 食遍歴, 理屈/感覚 from the stats. */
export function inferPersona(w: World): { personality: Partial<Personality>; notes: Partial<Record<PersonalityAxis, string>> } {
  const personality: Partial<Personality> = {};
  const notes: Partial<Record<PersonalityAxis, string>> = {};
  if (w.palate) {
    personality.venture = w.palate.culture.adventurous >= 0.5 ? 0.7 : -0.7;
    notes.venture = "食遍歴から推定";
  }
  const s = w.chef.stats;
  personality.mind = s.tech + s.knowledge >= s.luck + s.magic ? -0.7 : 0.7;
  notes.mind = "能力から推定";
  return { personality, notes };
}

export function setPersona(w: World, persona: PlayerPersona): World {
  return { ...w, social: { ...w.social, persona } };
}

// ---------- Candidates ----------

const NAME_SEED = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);

/** The player's most familiar ingredient category (from the 食遍歴), if any. */
function topCategory(p: EaterProfile | null): string | null {
  if (!p) return null;
  const e = Object.entries(p.culture.familiar).filter(([k]) => k in FOOD_COMPLEMENT) as [string, number][];
  e.sort((a, b) => b[1] - a[1]);
  return e[0] && e[0][1] > 0.35 ? e[0][0] : null;
}

const PLAY_STATS: StatKey[] = ["tech", "knowledge", "luck", "magic"];

function complementStats(player: Stats, species: CompanionSpecies, lean: Lean): { stats: Stats; weak: StatKey[]; top: StatKey } {
  const sorted = [...PLAY_STATS].sort((a, b) => player[a] - player[b]);
  const weak = sorted.slice(0, 2);
  const top = sorted[sorted.length - 1];
  const stats: Stats = { tech: 8, knowledge: 8, luck: 6, magic: 8, strength: 8 };
  for (const k of weak) stats[k] += 6;
  stats[top] = Math.max(4, stats[top] - 2);
  stats[species.keyStat] += 4;
  if (lean === "maker") stats.tech += 4;
  else { stats.knowledge += 2; stats.luck += 2; }
  return { stats, weak, top };
}

function complementPalate(player: EaterProfile | null, species: CompanionSpecies, id: string, name: string): EaterProfile {
  const p = blankProfile(id, name, species.emoji, species.species);
  const taste: Partial<Record<BaseTaste, number>> = {};
  for (const k of BASE_TASTES) {
    const v = -0.7 * (player?.taste[k] ?? 0) + (species.taste[k] ?? 0);
    if (Math.abs(v) >= 0.05) taste[k] = clamp1(v);
  }
  const texture: EaterProfile["texture"] = {};
  for (const k of ["tender", "chewy", "crisp", "soft", "firm"] as const) {
    const v = -0.6 * (player?.texture[k] ?? 0) + (species.texture[k] ?? 0);
    if (Math.abs(v) >= 0.05) texture[k] = clamp1(v);
  }
  const top = topCategory(player);
  const familiar = { ...p.culture.familiar };
  if (top) {
    familiar[top] = 0.2;
    familiar[FOOD_COMPLEMENT[top].category] = 0.8;
  }
  const adventurous = Math.max(0, Math.min(1, 1 - (player?.culture.adventurous ?? 0.5)));
  const prof: EaterProfile = {
    ...p,
    taste, texture,
    aroma: clamp1(-0.5 * (player?.aroma ?? 0) + species.aroma),
    culture: { familiar, schools: { [species.schoolId]: 0.7 }, adventurous },
    condition: { hunger: 0.7, fatigue: 0.3, nutrition: 0.6 },
  };
  const { likes, dislikes } = describePalate(prof);
  return { ...prof, profileText: [likes.length ? `${likes.join("・")}が好き` : "", dislikes.length ? `${dislikes.join("・")}は苦手` : ""].filter(Boolean).join("。") };
}

function speciesDialogue(species: CompanionSpecies, talk: number): CharacterDef["dialogue"] {
  const i = talk > 0 ? 1 : 0;
  return Object.fromEntries(Object.entries(species.dialogue).map(([k, v]) => [k, [v![i]]]));
}

/**
 * 相棒候補: three beings, each the player's opposite in role, temperament, palate and strengths,
 * but each leaning on a different axis so the cards are genuinely different.
 */
export function generateCandidates(w: World, persona: PlayerPersona): CharacterDef[] {
  const lean: Lean = persona.lean === "maker" ? "eater" : "maker";
  // Player's strongest axes first: candidate i explains the i-th one (falling back to its species focus).
  const strongest = [...AXES].sort((a, b) => Math.abs(persona.personality[b]) - Math.abs(persona.personality[a]));
  const seed = NAME_SEED(w.chef.name);
  const top = topCategory(w.palate);

  return COMPANION_SPECIES.map((species, i) => {
    const personality = Object.fromEntries(
      AXES.map((a) => [a, clamp1(-0.75 * persona.personality[a] + 0.45 * species.base[a])]),
    ) as Personality;
    const name = species.names[(seed + i) % species.names.length];
    const id = `companion-${species.id}`;
    const { stats, weak, top: topStat } = complementStats(w.chef.stats, species, lean);
    const axis = Math.abs(persona.personality[species.focus]) >= 0.3 ? species.focus : strongest[i % strongest.length];
    const reasons = [
      LEAN_COMPLEMENT[persona.lean],
      AXIS_COMPLEMENT[axis][persona.personality[axis] < 0 ? "low" : "high"],
      i !== 1 && top
        ? `あなたが${FOOD_COMPLEMENT[top].you}好きなので、この相棒は${FOOD_COMPLEMENT[top].them}を好む`
        : `あなたは${STAT_STYLE[topStat]}型なので、この相棒は${weak.map((k) => STAT_STYLE[k]).join("と")}で補う`,
    ];
    return {
      id, name, emoji: species.emoji, kind: "companion", species: species.species,
      role: lean === "maker" ? species.roleMaker : species.roleEater,
      lean, personality,
      eater: complementPalate(w.palate, species, id, name),
      chef: { level: Math.max(1, w.chef.level), stats, schoolId: species.schoolId, skills: { ...species.skills } },
      specialties: species.specialties,
      signatureRecipeIds: species.signatureRecipeIds,
      dialogue: speciesDialogue(species, personality.talk),
      blurb: species.job,
      complement: reasons,
    } satisfies CharacterDef;
  });
}

/** Picks one candidate. The bond starts warm but untested: 凸凹 on purpose. */
export function chooseCompanion(w: World, candidate: CharacterDef): World {
  const sim = w.palate ? palateSimilarity(w.palate, candidate.eater) : 0;
  const world: World = { ...w, social: { ...w.social, companionChoice: "accepted", companion: candidate } };
  return ensureRelation(world, PLAYER, candidate.id, {
    affection: 30, trust: 20, foodCompatibility: Math.round(50 + 30 * sim), tags: ["companion"],
  });
}

/** 誰も選ばない: the dry route. Nothing else in the game depends on having a companion. */
export function declineCompanion(w: World): World {
  return { ...w, social: { ...w.social, companionChoice: "declined", companion: null } };
}

// ---------- Characters (companion + allies) ----------

export function getCharacter(w: Pick<World, "social">, id: string): CharacterDef | undefined {
  if (w.social.companion?.id === id) return w.social.companion;
  return ALLY_MAP[id];
}

export function hasCompanion(w: Pick<World, "social">): boolean {
  return w.social.companionChoice === "accepted" && !!w.social.companion;
}

/** A Chef the cooking engine can use for a character (as main cook or as an assistant). */
export function characterChef(c: CharacterDef): Chef {
  const base = createDefaultChef();
  const chef: Chef = {
    ...base,
    name: c.name,
    level: c.chef.level,
    stats: { ...c.chef.stats },
    activeSchoolId: c.chef.schoolId,
    learnedSchoolIds: [c.chef.schoolId],
    records: { ...base.records, skillXp: { ...c.chef.skills } },
  };
  return { ...chef, mp: maxMP(chef), stamina: maxStamina(chef) };
}

export function personalityWords(p: Personality): string[] {
  const words: Record<PersonalityAxis, [string, string]> = {
    pace: ["慎重", "即断"], talk: ["寡黙", "おしゃべり"], mind: ["理屈派", "感覚派"], venture: ["保守的", "冒険好き"],
  };
  return AXES.filter((a) => Math.abs(p[a]) >= 0.2).map((a) => words[a][p[a] < 0 ? 0 : 1]);
}

/** One line of dialogue (deterministic by day so it does not flicker on re-render). */
export function line(c: CharacterDef, key: keyof NonNullable<CharacterDef["dialogue"]>, salt = 0): string {
  const list = c.dialogue[key];
  if (!list?.length) return "";
  return list[Math.abs(salt) % list.length];
}
