import { FOOD_STORY, FREE_TEXT_HINTS, type StoryEffect } from "../../data/foodStory";
import type { Eater, TextureTag } from "../../types";
import type { BaseTaste, EaterProfile } from "../../types/eating";

export const BASE_TASTES: BaseTaste[] = ["sweet", "salty", "sour", "bitter", "umami"];
const TASTE_JA: Record<BaseTaste, string> = { sweet: "甘味", salty: "塩気", sour: "酸味", bitter: "苦味", umami: "うま味" };
const TEXTURE_JA: Record<TextureTag, string> = { tender: "柔らかい肉", chewy: "噛みごたえ", crisp: "カリッと", soft: "ふんわり", firm: "しっかり" };

const clamp1 = (v: number) => Math.max(-1, Math.min(1, v));
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export function blankProfile(id: string, name: string, emoji = "🙂", role = ""): EaterProfile {
  return {
    id, name, emoji, role,
    taste: {}, aroma: 0, texture: {},
    culture: { familiar: { plant: 0.3, animal: 0.3, dairy: 0.3, seasoning: 0.3 }, schools: {}, adventurous: 0.5 },
    condition: { hunger: 0.5, fatigue: 0.3, nutrition: 0.6 },
    history: {},
    profileText: "",
  };
}

export function applyEffect(p: EaterProfile, e: StoryEffect, scale = 1): EaterProfile {
  const taste = { ...p.taste };
  for (const [k, v] of Object.entries(e.taste ?? {}) as [BaseTaste, number][]) taste[k] = clamp1((taste[k] ?? 0) + v * scale);
  const texture = { ...p.texture };
  for (const [k, v] of Object.entries(e.texture ?? {}) as [TextureTag, number][]) texture[k] = clamp1((texture[k] ?? 0) + v * scale);
  const familiar = { ...p.culture.familiar };
  for (const [k, v] of Object.entries(e.familiar ?? {})) familiar[k] = clamp01((familiar[k] ?? 0.3) + (v ?? 0) * scale);
  const schools = { ...p.culture.schools };
  for (const [k, v] of Object.entries(e.schools ?? {})) schools[k] = clamp01((schools[k] ?? 0) + (v ?? 0) * scale);
  return {
    ...p,
    taste,
    texture,
    aroma: clamp1(p.aroma + (e.aroma ?? 0) * scale),
    culture: { familiar, schools, adventurous: clamp01(p.culture.adventurous + (e.adventurous ?? 0) * scale) },
  };
}

/** Short words for what this eater likes and dislikes. */
export function describePalate(p: EaterProfile): { likes: string[]; dislikes: string[] } {
  const entries: [string, number][] = [
    ...BASE_TASTES.map((k) => [TASTE_JA[k], p.taste[k] ?? 0] as [string, number]),
    ["香り", p.aroma],
    ...(Object.entries(p.texture) as [TextureTag, number][]).map(([k, v]) => [TEXTURE_JA[k], v] as [string, number]),
  ];
  const likes = entries.filter(([, v]) => v >= 0.2).sort((a, b) => b[1] - a[1]).map(([n]) => n).slice(0, 3);
  const dislikes = entries.filter(([, v]) => v <= -0.2).sort((a, b) => a[1] - b[1]).map(([n]) => n).slice(0, 2);
  return { likes, dislikes };
}

export interface FoodStoryAnswers {
  answers: Record<string, string>; // question id → option id
  freeText: string;
}

/** 食遍歴 → the player's EaterProfile. */
export function buildPlayerProfile(name: string, story: FoodStoryAnswers): EaterProfile {
  let p = blankProfile("player", name, "🧑‍🍳", "あなた");
  const memories: string[] = [];
  for (const q of FOOD_STORY) {
    const opt = q.options.find((o) => o.id === story.answers[q.id]);
    if (!opt) continue;
    p = applyEffect(p, opt.effect);
    memories.push(opt.memory);
  }
  const text = story.freeText.trim();
  if (text) {
    for (const hint of FREE_TEXT_HINTS) {
      // "苦手" contains 苦 but is not a taste preference; the hint words avoid single 苦 for that reason.
      if (hint.words.some((w) => text.includes(w))) p = applyEffect(p, hint.effect);
    }
    memories.push(text.slice(0, 60));
  }
  const { likes, dislikes } = describePalate(p);
  const profileText = [memories[0], likes.length ? `${likes.join("・")}が好き` : "", dislikes.length ? `${dislikes.join("・")}は苦手` : ""]
    .filter(Boolean)
    .join("。");
  return { ...p, memories, profileText };
}

/** Phase 1 quest eaters reuse the same profile shape. */
export function eaterFromLegacy(e: Eater): EaterProfile {
  const p = blankProfile(e.id, e.name, e.emoji, e.role);
  const taste: EaterProfile["taste"] = {};
  for (const k of BASE_TASTES) if (e.tastePrefs[k] !== undefined) taste[k] = e.tastePrefs[k];
  const texture: EaterProfile["texture"] = {};
  for (const t of e.texturePrefs) texture[t] = 0.5;
  return {
    ...p,
    taste,
    aroma: e.tastePrefs.aroma ?? 0,
    texture,
    culture: { ...p.culture, adventurous: e.adventurous },
    condition: { hunger: e.hunger, fatigue: e.fatigue, nutrition: 1 - e.nutritionNeed },
    profileText: e.role,
  };
}
