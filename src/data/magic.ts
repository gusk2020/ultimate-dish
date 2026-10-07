import type { MagicTool, Spice } from "../types";

// 異世界スパイス: one quality (料理品質向上系) and one body (身体効果系) spice.
// unlockAfterQuest gates items behind quest progress (used by the tools below).
export const SPICES: Spice[] = [
  {
    id: "homura", name: "焔胡椒", emoji: "🌶️", kind: "quality",
    tasteDelta: { aroma: 2.5, umami: 1.5, salty: 1 }, body: {}, crave: 8,
    rarity: 6, price: 4,
    description: "火山地帯の胡椒。香りとうま味を強め、やみつきの刺激を与える",
  },
  {
    id: "iyashi", name: "癒樹の根", emoji: "🪵", kind: "body",
    tasteDelta: { bitter: 1, aroma: 0.5 }, body: { fatigue: 6, condition: 2 }, crave: 0,
    rarity: 4, price: 3,
    description: "煎じると疲労回復、体調も少し整う。やや苦い",
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
