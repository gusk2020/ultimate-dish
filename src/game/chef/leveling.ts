import { STAT_KEYS, type Chef, type StatKey } from "../../types/world";
import { createRng } from "../rng";
import { eff, maxMP, STAT_CAP } from "./stats";

// One visible experience value. Early levels are quick, later ones heavy, and the level
// right before each milestone is a wall (×2) so milestones feel earned.

export const MILESTONES = [10, 50, 100, 500, 1000, 5000];
export const LEVEL_CAP = 9999;

export function xpToNext(level: number): number {
  const wall = MILESTONES.includes(level + 1) ? 2 : 1;
  return Math.round(20 * Math.pow(level, 1.5) * wall);
}

export interface LevelUpLog {
  level: number;
  gains: Partial<Record<StatKey, number>>;
  luckyBonus: boolean;
}

/** Adds xp, levels up as needed. Growth is seeded so it can be reproduced. */
export function gainXp(chef: Chef, amount: number, seed: number): { chef: Chef; levelUps: LevelUpLog[] } {
  const rng = createRng(seed);
  let c: Chef = { ...chef, stats: { ...chef.stats }, xp: chef.xp + Math.max(0, Math.round(amount)) };
  const levelUps: LevelUpLog[] = [];
  while (c.level < LEVEL_CAP && c.xp >= xpToNext(c.level)) {
    c.xp -= xpToNext(c.level);
    c.level += 1;
    const gains: Partial<Record<StatKey, number>> = {};
    const add = (k: StatKey, n: number) => {
      c.stats[k] = Math.min(STAT_CAP, c.stats[k] + n);
      gains[k] = (gains[k] ?? 0) + n;
    };
    // 毎Lv: +1 to one random stat. 節目: +3 to every stat.
    add(STAT_KEYS[Math.floor(rng() * STAT_KEYS.length)], 1);
    if (MILESTONES.includes(c.level)) for (const k of STAT_KEYS) add(k, 3);
    // 幸運: chance of one extra point.
    const lucky = rng() < 0.1 + 0.4 * eff(c.stats.luck);
    if (lucky) add(STAT_KEYS[Math.floor(rng() * STAT_KEYS.length)], 1);
    levelUps.push({ level: c.level, gains, luckyBonus: lucky });
  }
  // No full refill on level-up (it hid MP spending); MP just stays within the new maximum.
  if (levelUps.length) c = { ...c, mp: Math.min(c.mp, maxMP(c)) };
  return { chef: c, levelUps };
}
