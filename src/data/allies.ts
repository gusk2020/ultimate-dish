import type { EaterProfile } from "../types/eating";
import type { CharacterDef } from "../types/social";
import { blankProfile } from "../game/eating/profile";

// 通常の仲間候補: ordinary villagers. They start as NPCs and join when their own conditions are met.

function eater(base: Partial<EaterProfile> & Pick<EaterProfile, "id" | "name" | "emoji" | "role">): EaterProfile {
  const b = blankProfile(base.id, base.name, base.emoji, base.role);
  return {
    ...b,
    ...base,
    culture: { ...b.culture, ...base.culture, familiar: { ...b.culture.familiar, ...base.culture?.familiar } },
    condition: { ...b.condition, ...base.condition },
  };
}

export const ALLIES: CharacterDef[] = [
  {
    id: "mira",
    name: "猟師の娘ミラ",
    emoji: "🏹",
    kind: "ally",
    species: "人間・猟師",
    role: "狩猟・採集・保存食",
    lean: "maker",
    personality: { pace: 0.5, talk: -0.4, mind: 0.4, venture: 0.3 },
    eater: eater({
      id: "mira", name: "猟師の娘ミラ", emoji: "🏹", role: "猟師",
      taste: { salty: 0.5, umami: 0.6, sweet: -0.4 }, texture: { chewy: 0.4, firm: 0.3 }, aroma: 0.2,
      culture: { familiar: { animal: 0.8, plant: 0.4, dairy: 0.2 }, schools: { north: 0.7, village: 0.4 }, adventurous: 0.3 },
      condition: { hunger: 0.8, fatigue: 0.6, nutrition: 0.5 },
      profileText: "獲物の肉と塩気が好き。甘いものは苦手",
    }),
    chef: { level: 3, stats: { tech: 9, knowledge: 7, luck: 12, magic: 4, strength: 16 }, schoolId: "north", skills: { fire: 60, ferment: 60, knife: 40 } },
    specialties: [
      { kind: "method", id: "smoke", label: "燻し" },
      { kind: "method", id: "dry", label: "干し" },
      { kind: "category", id: "animal", label: "肉・獣" },
    ],
    signatureRecipeIds: ["smoked-boar"],
    dialogue: {
      greet: ["……新しい料理人？ 獲物を無駄にしないなら、話くらいは聞く。"],
      talk: ["猪の脂は冬に乗る。覚えておいて。", "森は静かな日ほど危ない。"],
      progress: ["あんたの肉の扱い、悪くない。", "次の猟、ついてきてもいいよ。……荷物持ちとして。"],
      join: ["……いいよ。あんたの鍋に、私の獲物を預ける。"],
      afterGood: ["……うまい。獲った甲斐がある。"],
      afterBad: ["肉が泣いてる。"],
      beforeCook: ["火の番は任せて。肉は焦らないこと。"],
      success: ["……悪くない連携だった。"],
      fail: ["……次は気をつけて。肉に失礼だから。"],
    },
    blurb: "猟場で獲物を追う寡黙な娘。肉の扱いと保存食に詳しい。",
    joinConditions: [
      { kind: "affection", min: 25 },
      { kind: "memory", recipeId: "boar-herb-roast", label: "あなたの「猪肉の香草焼き」を食べた" },
      { kind: "battleWin" },
    ],
    homeFacilityId: "hunt",
  },
  {
    id: "teo",
    name: "パン焼きのテオ",
    emoji: "🥖",
    kind: "ally",
    species: "人間・パン職人",
    role: "料理・焼き菓子",
    lean: "maker",
    personality: { pace: -0.3, talk: 0.6, mind: 0.5, venture: 0.5 },
    eater: eater({
      id: "teo", name: "パン焼きのテオ", emoji: "🥖", role: "パン職人",
      taste: { sweet: 0.6, sour: 0.2, umami: 0.2, salty: -0.3, bitter: -0.4 }, aroma: 0.4, texture: { soft: 0.5, crisp: 0.3, chewy: -0.3 },
      culture: { familiar: { dairy: 0.8, plant: 0.6, animal: 0.2 }, schools: { court: 0.6, village: 0.4 }, adventurous: 0.6 },
      condition: { hunger: 0.5, fatigue: 0.4, nutrition: 0.6 },
      profileText: "甘い香りとふんわりした食感が好き。塩辛いのは苦手",
    }),
    chef: { level: 3, stats: { tech: 15, knowledge: 13, luck: 7, magic: 10, strength: 6 }, schoolId: "court", skills: { fire: 80, seasoning: 50 } },
    specialties: [
      { kind: "method", id: "grill", label: "焼き" },
      { kind: "method", id: "steam", label: "蒸し" },
      { kind: "category", id: "dairy", label: "乳・甘味" },
    ],
    signatureRecipeIds: ["gald-baked-apple"],
    dialogue: {
      greet: ["やあ！ 新しい料理人さんだね。焼きたての匂いにつられて来たんでしょ？"],
      talk: ["生地は寝かせた分だけ優しくなるんだ。", "今朝のパン、ちょっと膨らみすぎちゃった。"],
      progress: ["君と並んで火を見るの、楽しいなあ。", "今度、窯の温度の秘密を教えてあげる。"],
      join: ["決めた！ 君の厨房、ぼくも手伝うよ。毎朝パンを焼くからね！"],
      afterGood: ["わあ、優しい味！ これ好きだなあ。"],
      afterBad: ["うーん、ちょっと塩辛いかな……。"],
      beforeCook: ["よーし、窯の温度はぼくが見るね！"],
      success: ["やった！ ふたりで作ると楽しいね！"],
      fail: ["あちゃー、焦がしちゃったね……でも次はきっと大丈夫！"],
    },
    blurb: "村のパン焼き窯を守る陽気な青年。焼き物と甘い料理が得意。",
    joinConditions: [
      { kind: "trust", min: 30 },
      { kind: "cookedTogether", min: 1 },
      { kind: "foodCompatibility", min: 55 },
    ],
    homeFacilityId: "bakery",
  },
];

export const ALLY_MAP: Record<string, CharacterDef> = Object.fromEntries(ALLIES.map((a) => [a.id, a]));
