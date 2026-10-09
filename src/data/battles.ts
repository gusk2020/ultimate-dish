import type { BattleDef, EaterProfile, Rival } from "../types/eating";
import { blankProfile } from "../game/eating/profile";

// 料理勝負: judges (EaterProfiles), rivals and battle definitions.

function judge(base: Partial<EaterProfile> & Pick<EaterProfile, "id" | "name" | "emoji" | "role">): EaterProfile {
  const b = blankProfile(base.id, base.name, base.emoji, base.role);
  return {
    ...b,
    ...base,
    culture: { ...b.culture, ...base.culture, familiar: { ...b.culture.familiar, ...base.culture?.familiar } },
    condition: { ...b.condition, ...base.condition },
  };
}

export const JUDGES: EaterProfile[] = [
  judge({
    id: "j-mayor", name: "ヨハン村長", emoji: "🧔", role: "村長",
    taste: { umami: 0.5, salty: 0.2 }, aroma: 0.4, texture: { tender: 0.3 },
    culture: { familiar: { plant: 0.7, animal: 0.6 }, schools: { village: 0.8 }, adventurous: 0.5 },
    condition: { hunger: 0.5, fatigue: 0.3, nutrition: 0.6 },
    profileText: "村の味をよく知る村長",
  }),
  judge({
    id: "j-bruno", name: "鍛冶屋ブルーノ", emoji: "🔨", role: "鍛冶屋",
    taste: { salty: 0.6, umami: 0.4, bitter: -0.3 }, texture: { chewy: 0.3, firm: 0.3 },
    culture: { familiar: { animal: 0.8, plant: 0.4 }, schools: { village: 0.6, north: 0.5 }, adventurous: 0.3 },
    condition: { hunger: 0.8, fatigue: 0.7, nutrition: 0.5 },
    profileText: "腹を空かせた力仕事の男",
  }),
  judge({
    id: "j-liene", name: "吟遊詩人リーネ", emoji: "🎻", role: "旅の吟遊詩人",
    taste: { sour: 0.3, sweet: 0.2 }, aroma: 0.6, texture: { crisp: 0.4 },
    culture: { familiar: { dairy: 0.6 }, schools: { court: 0.5 }, adventurous: 0.8 },
    condition: { hunger: 0.4, fatigue: 0.4, nutrition: 0.7 },
    profileText: "各地を巡る食通の旅人",
  }),
  judge({
    id: "j-marta", name: "薬師マルタ", emoji: "🌿", role: "村の薬師",
    taste: { sweet: 0.2, salty: -0.4 }, texture: { soft: 0.5, chewy: -0.4 },
    culture: { familiar: { plant: 0.8 }, schools: { village: 0.7 }, adventurous: 0.4 },
    condition: { hunger: 0.5, fatigue: 0.5, nutrition: 0.3 },
    profileText: "体に良いものを重んじる薬師",
  }),
];
export const JUDGE_MAP: Record<string, EaterProfile> = Object.fromEntries(JUDGES.map((j) => [j.id, j]));

/** What everyone knows about a judge before learning more (knowledge level 0). */
export const JUDGE_RUMORS: Record<string, string> = {
  "j-mayor": "昔ながらの村の味が好きらしい",
  "j-bruno": "肉料理と塩気に目がないらしい",
  "j-liene": "珍しい香りの料理を好むらしい",
  "j-marta": "体に優しい料理を評価するらしい",
};

export const RIVALS: Rival[] = [
  {
    id: "gald", name: "農夫ガルド", emoji: "👨‍🌾", blurb: "村一番の大食らい。腕前はまだ素人だが意地は強い。",
    stats: { tech: 7, knowledge: 6, luck: 5, magic: 3, strength: 14 },
    schoolId: "village", skills: { fire: 40 },
    preferredRecipes: ["rabbit-stew", "bean-wheat-soup", "boar-herb-roast"],
    pantryQuality: 0.55,
  },
  {
    id: "sigurd", name: "北方の猟師シグルド", emoji: "🏹", blurb: "北の森から来た燻製の名手。保存食と粥が得意。",
    stats: { tech: 13, knowledge: 11, luck: 6, magic: 6, strength: 15 },
    schoolId: "north", skills: { fire: 120, ferment: 160, knife: 80 },
    preferredRecipes: ["smoked-boar", "mushroom-porridge", "bean-wheat-soup"],
    pantryQuality: 0.7,
  },
];
export const RIVAL_MAP: Record<string, Rival> = Object.fromEntries(RIVALS.map((r) => [r.id, r]));

export const BATTLES: BattleDef[] = [
  {
    id: "tutorial",
    name: "ガルドとの腕試し",
    kind: "tutorial",
    rivalId: "gald",
    judgeIds: ["j-mayor"],
    intro: "「どっちの料理がうまいか、村長に決めてもらおうじゃねえか！」",
    conditions: {
      theme: { label: "村の家庭の味", axes: { deliciousness: 1, culture: 0.6, costPerformance: 0.4 }, tags: ["deli", "staple", "family", "soup"] },
    },
    rewards: [{ kind: "xp", amount: 20 }, { kind: "money", amount: 20 }, { kind: "recipe", id: "gald-baked-apple" }],
    specialRules: [],
    requires: [],
  },
  {
    id: "rematch",
    name: "ガルドとの再戦：肉料理",
    kind: "rematch",
    rivalId: "gald",
    judgeIds: ["j-mayor"],
    intro: "「今度は肉で勝負だ。負けっぱなしじゃいられねえ！」",
    conditions: {
      theme: { label: "がっつり肉料理", axes: { deliciousness: 1, craveability: 0.8 }, tags: ["meat", "worker", "snack"] },
    },
    rewards: [{ kind: "xp", amount: 30 }, { kind: "money", amount: 30 }],
    specialRules: [],
    requires: ["tutorial"],
  },
  {
    id: "harvest",
    name: "収穫祭の一皿勝負",
    kind: "formal",
    rivalId: "sigurd",
    judgeIds: ["j-bruno", "j-liene", "j-marta"],
    intro: "収穫祭の目玉。3人の審査員が、疲れた村人のための一皿を選ぶ。",
    conditions: {
      theme: { label: "体を温める滋養の一皿", axes: { nutrition: 1, deliciousness: 1, culture: 0.4 }, tags: ["soup", "healthy", "staple"] },
      requiredIngredient: "wheat",
      forbiddenIngredient: "offal",
      timeLimitDays: 0.25,
      target: { label: "収穫で疲れた村人", condition: { fatigue: 0.8, hunger: 0.8 } },
    },
    rewards: [{ kind: "xp", amount: 60 }, { kind: "money", amount: 80 }],
    specialRules: [],
    requires: ["tutorial"],
  },
];
export const BATTLE_MAP: Record<string, BattleDef> = Object.fromEntries(BATTLES.map((b) => [b.id, b]));
