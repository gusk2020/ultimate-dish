import type { Eater } from "../types";

export const EATERS: Eater[] = [
  {
    id: "gald", name: "ガルド", emoji: "👨‍🌾", role: "農夫・村人代表",
    tastePrefs: { salty: 0.7, umami: 0.8, bitter: -0.6, sour: -0.3 },
    texturePrefs: ["tender", "firm"],
    adventurous: 0.25, hunger: 0.9, fatigue: 0.6, nutritionNeed: 0.3,
  },
  {
    id: "elsa", name: "エルザ婆さん", emoji: "👵", role: "村の長老・子供の世話役",
    tastePrefs: { sweet: 0.5, umami: 0.4, salty: -0.4, bitter: -0.5 },
    texturePrefs: ["soft", "tender"],
    adventurous: 0.4, hunger: 0.5, fatigue: 0.5, nutritionNeed: 0.9,
  },
  {
    id: "mayor", name: "ヨハン村長", emoji: "🧔", role: "村長",
    tastePrefs: { umami: 0.6, aroma: 0.6, sweet: 0.2, bitter: -0.2 },
    texturePrefs: ["crisp", "tender"],
    adventurous: 0.6, hunger: 0.5, fatigue: 0.4, nutritionNeed: 0.4,
  },
  // Phase 10: the people who ask in the other places.
  {
    id: "hans", name: "渡し守ハンス", emoji: "🧑‍✈️", role: "渡し場の渡し守",
    tastePrefs: { salty: 0.5, umami: 0.6, aroma: 0.3, bitter: -0.3 }, texturePrefs: ["crisp", "firm"],
    adventurous: 0.5, hunger: 0.8, fatigue: 0.6, nutritionNeed: 0.4,
  },
  {
    id: "mare", name: "漁師頭マレ", emoji: "🎣", role: "港の漁師頭",
    tastePrefs: { salty: 0.6, umami: 0.8, sour: 0.3, sweet: -0.2 }, texturePrefs: ["soft", "chewy"],
    adventurous: 0.6, hunger: 0.7, fatigue: 0.7, nutritionNeed: 0.4,
  },
  {
    id: "ilse", name: "山羊飼いイルゼ", emoji: "🐐", role: "高地の山羊飼い",
    tastePrefs: { umami: 0.6, sweet: 0.3, salty: 0.2, sour: -0.3 }, texturePrefs: ["soft", "tender"],
    adventurous: 0.4, hunger: 0.7, fatigue: 0.6, nutritionNeed: 0.8,
  },
];

export const EATER_MAP: Record<string, Eater> = Object.fromEntries(EATERS.map((e) => [e.id, e]));
