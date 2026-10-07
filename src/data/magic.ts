import type { MagicTool, Spice } from "../types";

// 異世界スパイス: quality (料理品質向上系) and body (身体効果系).
// unlockAfterQuest gates them behind quest progress so the toolbox grows.
export const SPICES: Spice[] = [
  {
    id: "kirijio", name: "霧塩", emoji: "🧂", kind: "quality",
    tasteDelta: { salty: 3, umami: 1.5 }, body: {}, crave: 4, preserves: true,
    rarity: 3, price: 2,
    description: "霧の谷で採れる塩。塩味とうま味、保存性を与える",
  },
  {
    id: "iyashi", name: "癒樹の根", emoji: "🪵", kind: "body",
    tasteDelta: { bitter: 1, aroma: 0.5 }, body: { fatigue: 6 }, crave: 0,
    rarity: 4, price: 3,
    description: "煎じると疲労回復。少し苦い",
  },
  {
    id: "homura", name: "焔胡椒", emoji: "🌶️", kind: "quality",
    tasteDelta: { aroma: 2.5, umami: 1, bitter: 0.3 }, body: {}, crave: 8,
    rarity: 6, price: 5,
    description: "火山地帯の胡椒。強い香りとやみつきの刺激",
    unlockAfterQuest: "q1",
  },
  {
    id: "seirei", name: "清霊ミント", emoji: "🍃", kind: "body",
    tasteDelta: { aroma: 1.5, bitter: 0.5 }, body: { condition: 6 }, crave: 1,
    rarity: 4, price: 3,
    description: "消化を助け、体調を整える清涼なミント",
    unlockAfterQuest: "q1",
  },
  {
    id: "suzune", name: "鈴音草の実", emoji: "🔔", kind: "quality",
    tasteDelta: { sweet: 1, aroma: 1.5 }, body: {}, crave: 10,
    rarity: 7, price: 6,
    description: "噛むと鈴の音がする実。甘い香りと楽しい食感",
    unlockAfterQuest: "q2",
  },
  {
    id: "soushou", name: "蒼晶花", emoji: "💠", kind: "body",
    tasteDelta: { aroma: 1, sweet: 0.5 }, body: { mana: 7, fatigue: 2 }, crave: 2,
    rarity: 8, price: 8,
    description: "魔力を回復する希少な花弁",
    unlockAfterQuest: "q2",
  },
];

// 特殊調理器具: each modifies the NEXT cooking method step.
export const TOOLS: MagicTool[] = [
  {
    id: "stone", name: "魔石炉", emoji: "🔥", system: "heat",
    description: "次の加熱を精密に温度制御。適合度と栄養保持が上がる",
  },
  {
    id: "jar", name: "時熟壺", emoji: "⏳", system: "time",
    description: "次の熟成・発酵・乾燥・燻製の時間を短縮し、効果を深める",
    unlockAfterQuest: "q1",
  },
  {
    id: "pot", name: "香封鍋", emoji: "🫕", system: "aroma",
    description: "次の工程で香りを閉じ込め、逃さない",
    unlockAfterQuest: "q2",
  },
];

export const SPICE_MAP: Record<string, Spice> = Object.fromEntries(SPICES.map((s) => [s.id, s]));
export const TOOL_MAP: Record<string, MagicTool> = Object.fromEntries(TOOLS.map((t) => [t.id, t]));

export function isUnlocked(item: { unlockAfterQuest?: string }, clearedQuestIds: string[]): boolean {
  return !item.unlockAfterQuest || clearedQuestIds.includes(item.unlockAfterQuest);
}
