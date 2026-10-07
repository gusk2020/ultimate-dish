import { AXES, type Axis, type AxisScores, type Rank } from "../../types";

// 総合点 → ランク, with two small rules on top of the plain threshold:
//   最低条件:   a high total cannot buy a top rank if a key axis is very low.
//   突出ボーナス: an axis at STANDOUT_SCORE or above earns a title and a small total bonus.

export const RANK_ORDER: Rank[] = ["D", "C", "B", "A", "S", "Legendary"];

export const RANK_THRESHOLDS: Record<Rank, number> = {
  D: 0, C: 42, B: 55, A: 65, S: 75, Legendary: 85,
};

/** Minimum conditions per rank (only the upper ranks have any). */
export const RANK_FLOORS: Partial<Record<Rank, { deliciousness: number; everyAxis: number }>> = {
  A: { deliciousness: 50, everyAxis: 0 },
  S: { deliciousness: 65, everyAxis: 25 },
  Legendary: { deliciousness: 80, everyAxis: 40 },
};

export const STANDOUT_SCORE = 90;
export const STANDOUT_BONUS = 2; // per standout axis
export const STANDOUT_BONUS_MAX = 4;

export const STANDOUT_TITLES: Record<Axis, string> = {
  deliciousness: "至高の味",
  originality: "奇想の一皿",
  nutrition: "滋養の極み",
  rarity: "幻の美味",
  culture: "伝統の結晶",
  sustainability: "大地の恵み",
  costPerformance: "庶民の宝",
  craveability: "魔性の味",
};

export interface Rating {
  baseTotal: number;
  bonus: number;
  total: number;
  titles: string[];
  rank: Rank;
  /** Set when 最低条件 lowered the rank: what the total alone would have given, and why. */
  rankCap: { from: Rank; reason: string } | null;
}

/** 基礎総合点: deliciousness counts double — it is a cooking game first. */
export function baseTotalScore(s: AxisScores): number {
  const sum = AXES.reduce((acc, a) => acc + s[a] * (a === "deliciousness" ? 2 : 1), 0);
  return Math.round(sum / (AXES.length + 1));
}

export function rankOf(total: number): Rank {
  return [...RANK_ORDER].reverse().find((r) => total >= RANK_THRESHOLDS[r])!;
}

function floorFailure(rank: Rank, s: AxisScores, undercooked: boolean): string | null {
  if (undercooked && RANK_ORDER.indexOf(rank) > RANK_ORDER.indexOf("C")) return "生焼け";
  const f = RANK_FLOORS[rank];
  if (!f) return null;
  if (s.deliciousness < f.deliciousness) return `美味しさ${f.deliciousness}未満`;
  if (AXES.some((a) => s[a] < f.everyAxis)) return `${f.everyAxis}未満の軸がある`;
  return null;
}

export function rateDish(s: AxisScores, undercooked = false): Rating {
  const baseTotal = baseTotalScore(s);
  const standouts = AXES.filter((a) => s[a] >= STANDOUT_SCORE);
  const bonus = Math.min(STANDOUT_BONUS_MAX, standouts.length * STANDOUT_BONUS);
  const total = Math.min(100, baseTotal + bonus);

  const byTotal = rankOf(total);
  let rank = byTotal;
  let reason: string | null = null;
  while (rank !== "D") {
    const fail = floorFailure(rank, s, undercooked);
    if (!fail) break;
    reason ??= fail;
    rank = RANK_ORDER[RANK_ORDER.indexOf(rank) - 1];
  }

  return {
    baseTotal,
    bonus,
    total,
    titles: standouts.map((a) => STANDOUT_TITLES[a]),
    rank,
    rankCap: rank !== byTotal && reason ? { from: byTotal, reason } : null,
  };
}
