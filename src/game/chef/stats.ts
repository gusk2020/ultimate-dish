import { STAT_KEYS, type Chef, type SkillId, type StatKey, type Stats } from "../../types/world";

// Abilities are integers up to 9999. Every gameplay effect goes through `eff`,
// a saturating curve, so Lv9999 / stat 9999 never yields infinite success or steps.

export const STAT_LABEL: Record<StatKey, string> = {
  tech: "技術", knowledge: "知識", luck: "幸運", magic: "魔力", strength: "強靭",
};

export const STAT_BASE = 5;
export const FREE_POINTS = 25;
export const INITIAL_MAX = 15;
export const STAT_MIN = 1;
export const STAT_CAP = 9999;

/** 0..1, diminishing: 5 → 0.14, 15 → 0.33, 100 → 0.77, 9999 → ~1. */
export function eff(value: number, half = 30): number {
  const v = Math.max(0, Math.min(STAT_CAP, value));
  return v / (v + half);
}

export interface AllocationCheck {
  ok: boolean;
  remaining: number; // free points still unspent (may be fractional internally, shown floored)
  errors: string[];
}

/** Base 5 each + 25 free; max 15, min 1; lowering below 5 refunds 1 point per 2 lowered. */
export function checkAllocation(stats: Stats): AllocationCheck {
  const errors: string[] = [];
  let spent = 0;
  let lowered = 0;
  for (const k of STAT_KEYS) {
    const v = stats[k];
    if (!Number.isInteger(v)) errors.push(`${STAT_LABEL[k]}は整数`);
    if (v > INITIAL_MAX) errors.push(`${STAT_LABEL[k]}は最大${INITIAL_MAX}`);
    if (v < STAT_MIN) errors.push(`${STAT_LABEL[k]}は最低${STAT_MIN}`);
    if (v > STAT_BASE) spent += v - STAT_BASE;
    else lowered += STAT_BASE - v;
  }
  const remaining = FREE_POINTS + Math.floor(lowered / 2) - spent;
  if (remaining < 0) errors.push("ポイント不足");
  return { ok: errors.length === 0, remaining, errors };
}

export function skillLevel(chef: Chef, id: SkillId): number {
  const xp = chef.records.skillXp[id] ?? 0;
  return Math.min(999, Math.floor(Math.sqrt(xp / 8)));
}

export function skillStage(level: number): string {
  if (level >= 20) return "達人";
  if (level >= 10) return "熟練";
  if (level >= 5) return "一人前";
  if (level >= 1) return "見習い";
  return "未経験";
}

// ---- Derived numbers (all bounded) ----

/** 食材の組み合わせ容量: 6 at Lv1, grows slowly with knowledge and level. */
export function ingredientCapacity(chef: Chef): number {
  return Math.round((6 + 6 * eff(chef.stats.knowledge, 40) + 4 * eff(chef.level, 200)) * 10) / 10;
}

/** 工程数上限: strength only. 5 → 8, 15 → 10, 9999 → ~20. */
export function maxSteps(chef: Chef): number {
  return 6 + Math.floor(14 * eff(chef.stats.strength));
}

export function maxMP(chef: Chef): number {
  return 10 + Math.floor(90 * eff(chef.stats.magic, 40)) + Math.floor(chef.level / 2);
}

/** 同時に使える魔導具の種類数: magic + 魔具操作 skill. */
export function toolSlots(chef: Chef): number {
  return 1 + Math.floor(3 * eff(chef.stats.magic)) + (skillLevel(chef, "multiTool") >= 1 ? 1 : 0);
}

/** 最大体力: strength + level, saturating. 12 → ~59 at Lv1. */
export function maxStamina(chef: Chef): number {
  return 40 + Math.floor(60 * eff(chef.stats.strength)) + Math.floor(160 * eff(chef.level, 300));
}

/**
 * 低体力ペナルティ: below 30% of max, success drops, time grows and critical failures get likelier.
 * Never blocks cooking — pushing on while tired is a choice.
 */
export function staminaPenalty(chef: Chef): { chance: number; timeMult: number; tired: boolean } {
  const ratio = Math.max(0, chef.stamina) / maxStamina(chef);
  const lack = Math.max(0, 0.3 - ratio) / 0.3; // 0 (fine) .. 1 (empty)
  return { chance: -0.18 * lack, timeMult: 1 + 0.6 * lack, tired: lack > 0 };
}

export function createDefaultChef(): Chef {
  const chef: Chef = {
    name: "見習い料理人",
    level: 1,
    xp: 0,
    stats: { tech: 12, knowledge: 11, luck: 5, magic: 10, strength: 12 },
    allocationLocked: false,
    mp: 0,
    stamina: 0,
    money: 120,
    activeSchoolId: "village",
    learnedSchoolIds: ["village", "north", "court"],
    records: {
      skillXp: { fire: 40, knife: 20, seasoning: 20 },
      schoolMastery: {},
      techniqueCounts: {},
      genreCounts: {},
      achievements: [],
      dishesCooked: 0,
    },
  };
  chef.mp = maxMP(chef);
  chef.stamina = maxStamina(chef);
  return chef;
}
