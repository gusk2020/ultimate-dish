import { APPRAISAL_MAP, EATER_TOOL_FOR } from "../data/eaterTools";
import { TOOL_MAP } from "../data/magic";
import type { StatKey } from "../types/world";
import type { ScreenId } from "../types";
import type { World } from "./world";

// Phase 11: what each role is shown. The two roles share some internal numbers, but a cook is
// never shown eater growth and an eater is never shown a cook's.

export const isEaterRole = (w: Pick<World, "identity">) => w.identity?.lean === "eater";

/** The same five internal stats, named for what they mean to each role. */
export const STAT_NAMES: Record<"maker" | "eater", Record<StatKey, string>> = {
  maker: { tech: "技術", knowledge: "知識", luck: "幸運", magic: "魔力", strength: "強靭" },
  eater: { tech: "味覚分析", knowledge: "知識・鑑定", luck: "幸運", magic: "魔力", strength: "身体能力" },
};

export const STAT_MEANING: Record<"maker" | "eater", Record<StatKey, string>> = {
  maker: { tech: "工程成功率・複雑さへの強さ", knowledge: "食材容量・理解", luck: "大成功・救済・追加成長", magic: "MP・魔導具の同時使用", strength: "工程数の上限" },
  eater: { tech: "味の構成を読み解く力", knowledge: "食材と調理法の鑑定", luck: "思わぬ発見・運", magic: "鑑定魔導具を扱う力", strength: "大食い・激辛・遠征に耐える体" },
};

/** The starting tool by its role-appropriate name (香封鍋 for a cook, 香気鑑定器 for an eater …). */
export function startingToolLabel(w: Pick<World, "identity">): string | null {
  const id = w.identity?.startingToolId;
  if (!id) return null;
  if (isEaterRole(w)) {
    const a = APPRAISAL_MAP[EATER_TOOL_FOR[id] ?? id];
    return a ? `${a.emoji} ${a.name}` : null;
  }
  return TOOL_MAP[id] ? `${TOOL_MAP[id].emoji} ${TOOL_MAP[id].name}` : null;
}

export type NavTab = { id: ScreenId; label: string; icon: string };

/** The two roles play different games, so they get different tabs (Phase 10/11). */
export const MAKER_TABS: NavTab[] = [
  { id: "village", label: "村", icon: "🗺️" },
  { id: "chef", label: "料理人", icon: "🧑‍🍳" },
  { id: "people", label: "仲間", icon: "🤝" },
  { id: "kitchen", label: "厨房", icon: "🍳" },
  { id: "sales", label: "販売", icon: "🏪" },
  { id: "quests", label: "勝負", icon: "⚔️" },
  { id: "dex", label: "ノート", icon: "📖" },
];
export const EATER_TABS: NavTab[] = [
  { id: "village", label: "村", icon: "🗺️" },
  { id: "chef", label: "食べ手", icon: "🍴" },
  { id: "people", label: "仲間", icon: "🤝" },
  { id: "dining", label: "食事", icon: "🍲" },
  { id: "quests", label: "勝負", icon: "⚔️" },
  { id: "dex", label: "ノート", icon: "📖" },
];
