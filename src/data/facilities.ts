import type { ScreenId, SourceId } from "../types";

export interface Facility {
  id: string;
  name: string;
  emoji: string;
  /** Grid position on the village map (columns 0-3, rows 0-5). */
  col: number;
  row: number;
  /** Screen opened on tap; null = info only for now. */
  screen: ScreenId | null;
  /** Ingredient source this place supplies (future: gathering / hunting / trading). */
  source?: SourceId;
  description: string;
}

export const FACILITIES: Facility[] = [
  { id: "mayor", name: "村長宅", emoji: "🏠", col: 1, row: 0, screen: "quests", description: "依頼を受ける" },
  { id: "kitchen", name: "食堂／厨房", emoji: "🍳", col: 2, row: 2, screen: "kitchen", description: "料理を作る" },
  { id: "archive", name: "図鑑／記録所", emoji: "📖", col: 0, row: 2, screen: "dex", description: "作った料理を見る" },
  { id: "farm", name: "農地", emoji: "🌾", col: 0, row: 4, screen: null, source: "farm", description: "畑と家畜（採集は今後実装）" },
  { id: "hunt", name: "猟場", emoji: "🌲", col: 3, row: 0, screen: null, source: "hunt", description: "森と川（狩猟は今後実装）" },
  { id: "market", name: "市場／商店", emoji: "🏪", col: 3, row: 4, screen: null, source: "market", description: "保存食や乳製品（売買は今後実装）" },
];
