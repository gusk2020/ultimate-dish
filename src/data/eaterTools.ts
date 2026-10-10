// 食べる側の魔導具 (Phase 11): appraisal tools, never cooking tools. They make judging more reliable
// and soften strain — they never remove the risk.

export type JudgeItemId = "heat" | "prep" | "aroma" | "theme" | "preserve";

export interface AppraisalTool {
  id: string;
  name: string;
  emoji: string;
  category: "appraisal";
  /** The cooking tool whose starting slot it takes for an eater. */
  replaces: string;
  description: string;
  good: string;
  judgeBonus: Partial<Record<JudgeItemId, number>>;
  /** Share of a dish's heat (SHU) it takes the edge off (0..1). */
  spiceRelief: number;
  /** Extra portions of stomach room in a big-eating challenge. */
  stomachRelief: number;
}

export const APPRAISAL_TOOLS: AppraisalTool[] = [
  {
    id: "thermo-needle", name: "温度鑑定針", emoji: "🌡️", category: "appraisal", replaces: "stone",
    description: "刺すと表面と中心の温度が分かる細い魔針。", good: "火入れ・下処理の判定が正確になる",
    judgeBonus: { heat: 0.12, prep: 0.05 }, spiceRelief: 0, stomachRelief: 0,
  },
  {
    id: "aroma-appraiser", name: "香気鑑定器", emoji: "🔮", category: "appraisal", replaces: "pot",
    description: "香りの強さと層、異臭・焦げ臭・発酵臭を見分ける小瓶。", good: "香り・保存（発酵・燻製）の判定が正確になる",
    judgeBonus: { aroma: 0.12, preserve: 0.08 }, spiceRelief: 0, stomachRelief: 0,
  },
  {
    id: "taste-stone", name: "味覚補助石", emoji: "💎", category: "appraisal", replaces: "jar",
    description: "舌にのせると五味を整理してくれる石。強い刺激も少し和らげる。", good: "テーマ判定が正確になり、激辛と大食いが少し楽になる",
    judgeBonus: { theme: 0.08 }, spiceRelief: 0.2, stomachRelief: 0.5,
  },
];

export const APPRAISAL_MAP: Record<string, AppraisalTool> = Object.fromEntries(APPRAISAL_TOOLS.map((t) => [t.id, t]));
/** Cooking tool id → the eater's tool in the same starting slot (香封鍋 → 香気鑑定器 …). */
export const EATER_TOOL_FOR: Record<string, string> = Object.fromEntries(APPRAISAL_TOOLS.map((t) => [t.replaces, t.id]));
