// 世界暦と1日の区分 (Phase 10).
//
// world.day stays the continuous day counter every earlier phase uses (0.25 = 6:00 of day 1).
// A day is cut into three parts the player sees: 午前 6:00-12:00, 午後 12:00-18:00, 夜 18:00-翌6:00
// (the night belongs to the date it started on). The calendar is 12 months × 30 days = 360 days,
// no leap years, and world day index 0 is 9876年5月4日.

export const START_YEAR = 9876;
export const START_MONTH = 5;
export const START_DATE = 4;
/** New characters start at 15:00 on day index 0 (午後). */
export const NEW_GAME_DAY = 15 / 24;

export const DAYS_PER_MONTH = 30;
export const MONTHS_PER_YEAR = 12;
export const DAYS_PER_YEAR = DAYS_PER_MONTH * MONTHS_PER_YEAR;

export type DayPart = 0 | 1 | 2;
export const PART_LABEL = ["午前", "午後", "夜"] as const;
export const PART_ICON = ["☀️", "🌤", "🌙"] as const;

const DAY_START = 0.25; // 6:00
/** Where each part starts, as a fraction of a day after 6:00. */
const PART_STARTS = [0, 0.25, 0.5] as const;

const EPOCH_ORDINAL = (START_YEAR - 1) * DAYS_PER_YEAR + (START_MONTH - 1) * DAYS_PER_MONTH + (START_DATE - 1);

/** Day index (0 = 9876/5/4) and part of day for a world day. */
export function partOf(day: number): { dayIndex: number; part: DayPart } {
  const shifted = day - DAY_START;
  const dayIndex = Math.floor(shifted + 1e-9);
  const f = shifted - dayIndex;
  const part: DayPart = f < PART_STARTS[1] - 1e-9 ? 0 : f < PART_STARTS[2] - 1e-9 ? 1 : 2;
  return { dayIndex, part };
}

/** A number that grows by one for every part of a day (stable key for availability seeds). */
export function slotIndex(day: number): number {
  const { dayIndex, part } = partOf(day);
  return dayIndex * 3 + part;
}

/** The world day at which the next part begins. */
export function nextPartStart(day: number): number {
  const { dayIndex, part } = partOf(day);
  const base = dayIndex + DAY_START;
  return part === 0 ? base + 0.25 : part === 1 ? base + 0.5 : base + 1;
}

export interface CalendarDate {
  year: number;
  month: number;
  date: number;
  part: DayPart;
  hour: number;
}

export function calendarOf(day: number): CalendarDate {
  const { dayIndex, part } = partOf(day);
  const ord = EPOCH_ORDINAL + dayIndex;
  const year = Math.floor(ord / DAYS_PER_YEAR) + 1;
  const inYear = ((ord % DAYS_PER_YEAR) + DAYS_PER_YEAR) % DAYS_PER_YEAR;
  const hour = Math.floor((((day % 1) + 1) % 1) * 24);
  return { year, month: Math.floor(inYear / DAYS_PER_MONTH) + 1, date: (inYear % DAYS_PER_MONTH) + 1, part, hour };
}

export function formatDate(day: number): string {
  const c = calendarOf(day);
  return `${c.year}年${c.month}月${c.date}日`;
}

export function formatShort(day: number): string {
  const c = calendarOf(day);
  return `${c.year}/${c.month}/${c.date} ${PART_ICON[c.part]}${PART_LABEL[c.part]}`;
}
