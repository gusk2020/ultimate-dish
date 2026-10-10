import { BATTLE_MAP, RIVAL_MAP } from "../../data/battles";
import { MEAL_OFFER_MAP } from "../../data/meals";
import type { DiaryEntry, DiaryLine, RoutineAction, RoutineKind } from "../../types/life";
import { gainXp } from "../chef/leveling";
import { maxStamina } from "../chef/stats";
import { progressionOf } from "../codex/codex";
import { EATER_QUEST_MAP } from "../eater/challenges";
import { eaterLevelFor, gainEaterXp, recordEaten } from "../eater/progression";
import { addSkillXp } from "../eater/skills";
import { graduated, recordOpponent } from "../battle/rotation";
import { isOpen, offerDish } from "../food/prepared";
import { createRng, seedFrom } from "../rng";
import { getCharacter } from "../social/companion";
import { adjustRelation, getRelation, PLAYER } from "../social/relations";
import { formatDate, nextPartStart, partOf } from "../time/calendar";
import { advancePart, dailyOf, routineMeal } from "../time/daily";
import { locationOf } from "../travel/market";
import { advanceTime, type World } from "../world";
import { defaultRoutines } from "./defaults";

// 日課 (Phase 11): what the player does every day without being asked. 次の日へ runs them in
// order (meal → people → contests → meal → sleep), one part of the day each, and writes a short
// diary. A routine is a repeat of something already done by hand: it earns less (75%), it can
// fail, and nothing new — a first quest, a discovery, a derivation — can ever be a routine.

export const ROUTINE_EFFICIENCY = 0.75;
export const UNLOCK_REPEATS = 3;

const PRIORITY: Record<RoutineKind, number> = { meal: 0, talk: 10, battle: 20, eaterBattle: 20, dine: 30, sleep: 99 };

export { countAction } from "./count";

export const routinesOf = (w: World): RoutineAction[] => w.routines ?? defaultRoutines();

export interface RoutineCandidate {
  key: string;
  kind: RoutineKind;
  targetId: string;
  label: string;
  count: number;
  /** null = can be registered; otherwise why not yet. */
  blocked: string | null;
}

/** Everything done by hand that could become (or is close to becoming) a routine. */
export function routineCandidates(w: World): RoutineCandidate[] {
  const registered = new Set(routinesOf(w).map((r) => `${r.kind}:${r.targetId}`));
  const out: RoutineCandidate[] = [];
  for (const [key, count] of Object.entries(w.actionCounts ?? {})) {
    const [prefix, id] = key.split(/:(.+)/);
    const repeat = count < UNLOCK_REPEATS ? `あと${UNLOCK_REPEATS - count}回、手で行うと登録できる` : null;
    if (prefix === "battle" && BATTLE_MAP[id]) {
      const def = BATTLE_MAP[id];
      if (registered.has(`battle:${id}`)) continue;
      out.push({ key, kind: "battle", targetId: id, label: `${RIVAL_MAP[def.rivalId]?.name ?? ""}と再戦（${def.name}）`, count, blocked: repeat ?? (graduated(w, def.rivalId) ? null : "「再戦」に移った勝負だけ登録できる") });
    } else if (prefix === "eater" && EATER_QUEST_MAP[id]) {
      const def = EATER_QUEST_MAP[id];
      if (registered.has(`eaterBattle:${id}`)) continue;
      out.push({ key, kind: "eaterBattle", targetId: id, label: def.title, count, blocked: repeat ?? (def.rotates && !graduated(w, def.rivalId) ? "「再戦」に移った勝負だけ登録できる" : null) });
    } else if (prefix === "talk") {
      if (registered.has(`talk:${id}`)) continue;
      out.push({ key, kind: "talk", targetId: id, label: `${getCharacter(w, id)?.name ?? id}と会話`, count, blocked: repeat });
    } else if (prefix === "dine" && MEAL_OFFER_MAP[id]) {
      if (registered.has(`dine:${id}`)) continue;
      out.push({ key, kind: "dine", targetId: id, label: `${MEAL_OFFER_MAP[id].vendorName}で外食`, count, blocked: repeat });
    }
  }
  return out;
}

export function registerRoutine(w: World, key: string): World | string {
  const c = routineCandidates(w).find((x) => x.key === key);
  if (!c) return "登録できる行動がない";
  if (c.blocked) return c.blocked;
  const r: RoutineAction = { id: `${c.kind}:${c.targetId}`, kind: c.kind, targetId: c.targetId, label: c.label, enabled: true, priority: PRIORITY[c.kind], unlocked: true, runCount: 0, lastResult: null };
  return { ...w, routines: [...routinesOf(w), r] };
}

export function toggleRoutine(w: World, id: string): World {
  return { ...w, routines: routinesOf(w).map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)) };
}

const PART_WORD = ["朝", "昼", "夕"] as const;

interface Step { world: World; text: string; ok: boolean; money: number; xp: number }

function runOne(w: World, r: RoutineAction, seed: number): Step {
  const rng = createRng(seed);
  const max = maxStamina(w.chef);
  const tired = w.chef.stamina < max * 0.15;
  const m0 = w.chef.money;
  switch (r.kind) {
    case "battle": {
      const def = BATTLE_MAP[r.targetId];
      const rival = RIVAL_MAP[def?.rivalId ?? ""];
      if (!def || !rival) return { world: w, text: `${r.label}：相手がいない`, ok: false, money: 0, xp: 0 };
      if ((def.locationId ?? "village") !== locationOf(w).id) return { world: w, text: `${r.label}：ここでは開かれていない`, ok: false, money: 0, xp: 0 };
      if (tired) return { world: w, text: `${r.label}：疲れていて見送った`, ok: false, money: 0, xp: 0 };
      const power = w.chef.level + (w.chef.stats.tech + w.chef.stats.knowledge) / 5;
      const rivalPower = (rival.stats.tech + rival.stats.knowledge) / 5 + (w.opponents?.[rival.id]?.wins ?? 0) * 0.5;
      const win = rng() < Math.max(0.15, Math.min(0.85, 0.5 + (power - rivalPower) * 0.05));
      const xp = Math.round((win ? def.rewards.find((x) => x.kind === "xp")?.amount ?? 10 : 4) * ROUTINE_EFFICIENCY);
      const money = win ? Math.round((def.rewards.find((x) => x.kind === "money")?.amount ?? 0) * ROUTINE_EFFICIENCY) : 0;
      let world = recordOpponent(w, rival.id, win ? "win" : "loss");
      world = {
        ...world,
        chef: { ...gainXp(world.chef, xp, seedFrom(seed, "rx")).chef, money: world.chef.money + money, stamina: Math.max(0, world.chef.stamina - Math.round(max * 0.1)) },
        battleLog: [...world.battleLog, { battleId: def.id, day: Math.floor(w.day) + 1, winner: win ? "player" : "rival", playerTotal: 0, rivalTotal: 0 }],
      };
      return { world, text: `${rival.name}と再戦 → ${win ? `勝利 +${xp}XP +${money}G` : `敗北 +${xp}XP`}`, ok: win, money, xp };
    }
    case "eaterBattle": {
      const def = EATER_QUEST_MAP[r.targetId];
      if (!def) return { world: w, text: `${r.label}：依頼がない`, ok: false, money: 0, xp: 0 };
      if ((def.locationId ?? "village") !== locationOf(w).id) return { world: w, text: `${r.label}：ここでは開かれていない`, ok: false, money: 0, xp: 0 };
      if (tired) return { world: w, text: `${r.label}：疲れていて見送った`, ok: false, money: 0, xp: 0 };
      const lv = progressionOf(w).eaterLevel;
      const win = rng() < Math.max(0.15, Math.min(0.85, 0.5 + (lv - 2) * 0.06));
      const xp = Math.round((win ? def.reward.xp : 6) * ROUTINE_EFFICIENCY);
      const money = win ? Math.round(def.reward.money * ROUTINE_EFFICIENCY) : 0;
      let world = gainEaterXp(w, xp, win ? Math.round(def.reward.reputation * ROUTINE_EFFICIENCY) : 0, money);
      world = { ...world, progression: addSkillXp(progressionOf(world), { palate: 2, body: 1 }) };
      if (def.rotates) world = recordOpponent(world, def.rivalId, win ? "win" : "loss");
      world = { ...world, chef: { ...world.chef, stamina: Math.max(0, world.chef.stamina - Math.round(max * 0.1)) } };
      return { world, text: `${def.title} → ${win ? `成功 +${xp}XP +${money}G` : `失敗 +${xp}XP`}`, ok: win, money, xp };
    }
    case "talk": {
      const c = getCharacter(w, r.targetId);
      if (!c || !getRelation(w, PLAYER, r.targetId)) return { world: w, text: `${r.label}：相手がいない`, ok: false, money: 0, xp: 0 };
      if (rng() < 0.2) return { world: w, text: `${c.name}を訪ねたが不在だった`, ok: false, money: 0, xp: 0 };
      // A manual chat warms things by 3; a routine one a little less.
      const world = adjustRelation(w, PLAYER, r.targetId, { affection: 2, trust: 1 });
      return { world, text: `${c.name}と会話 → 好感+2・信頼+1`, ok: true, money: 0, xp: 0 };
    }
    case "dine": {
      const o = MEAL_OFFER_MAP[r.targetId];
      if (!o || o.locationId !== locationOf(w).id) return { world: w, text: `${r.label}：この土地にはない店`, ok: false, money: 0, xp: 0 };
      if (!isOpen(w, o)) return { world: w, text: `${r.label}：店が閉まっていた`, ok: false, money: 0, xp: 0 };
      if (w.chef.money < o.price) return { world: w, text: `${r.label}：お金が足りなかった`, ok: false, money: 0, xp: 0 };
      const paid: World = { ...w, chef: { ...w.chef, money: w.chef.money - o.price } };
      const ate = recordEaten(paid, offerDish(w, o), "日課の外食");
      const cut = Math.round(ate.gain.xp * (1 - ROUTINE_EFFICIENCY));
      const p = progressionOf(ate.world);
      const eaterXp = Math.max(0, p.eaterXp - cut);
      const world: World = { ...ate.world, progression: { ...p, eaterXp, eaterLevel: eaterLevelFor(eaterXp) }, daily: { ...dailyOf(ate.world), hunger: 0 } };
      const xp = ate.gain.xp - cut;
      return { world, text: `${o.vendorName}で外食 -${o.price}G${xp ? ` +${xp}XP` : ""}`, ok: true, money: world.chef.money - m0, xp };
    }
    default:
      return { world: w, text: "", ok: true, money: 0, xp: 0 };
  }
}

/**
 * 次の日へ: the rest of today, one registered routine per part of the day, meals when they are
 * on, then (with 睡眠 on) a night's sleep into the next morning. Returns the diary of the day.
 */
export function runNextDay(w0: World, seed: number): { world: World; entry: DiaryEntry } {
  let w = w0;
  const lines: DiaryLine[] = [];
  let xp = 0;
  const dateLabel = formatDate(w.day);
  const routines = routinesOf(w);
  const on = (id: string) => routines.find((r) => r.id === id)?.enabled ?? false;
  const queue = routines.filter((r) => r.enabled && r.kind !== "meal" && r.kind !== "sleep").sort((a, b) => a.priority - b.priority);
  const ran: Record<string, string> = {};

  const meal = (part: DiaryLine["part"]) => {
    if (!on("meal")) return;
    const r = routineMeal(w);
    w = r.world;
    lines.push({ part, text: r.note.replace(/^日常食：/, ""), ok: r.source !== "none" });
  };

  const start = partOf(w.day).part;
  if (start === 0) meal("朝");
  for (let part = start; part <= 2; part++) {
    const r = queue.shift();
    if (r) {
      const step = runOne(w, r, seedFrom(seed, r.id, part));
      w = step.world;
      xp += step.xp;
      ran[r.id] = step.text;
      lines.push({ part: PART_WORD[part], text: step.text, ok: step.ok });
    } else if (part < 2) {
      lines.push({ part: PART_WORD[part], text: "特に予定はなく過ごした", ok: true });
    }
    if (part === 2) meal("夕");
    if (part < 2) w = advanceTime(w, nextPartStart(w.day) - w.day);
  }
  for (const r of queue) lines.push({ part: "夕", text: `${r.label}：時間が足りず見送り`, ok: false });

  // 睡眠: the day-end (sales, contracts, stamina, MP, storage) — or a sleepless night.
  if (on("sleep")) {
    w = advancePart(w);
    lines.push({ part: "夜", text: "宿で眠った（体力・MP回復）", ok: true });
  } else {
    w = advanceTime(w, nextPartStart(w.day) - w.day);
    w = { ...w, chef: { ...w.chef, stamina: Math.max(0, w.chef.stamina - Math.round(maxStamina(w.chef) * 0.15)) } };
    lines.push({ part: "夜", text: "眠らずに夜を明かした（体力が減った）", ok: false });
  }

  const routinesAfter = routinesOf(w).map((r) => (ran[r.id] ? { ...r, runCount: r.runCount + 1, lastResult: ran[r.id] } : r));
  const entry: DiaryEntry = { dateLabel, lines, moneyDelta: Math.round(w.chef.money - w0.chef.money), xpDelta: xp };
  return { world: { ...w, routines: routinesAfter, diary: [entry, ...(w.diary ?? [])].slice(0, 10) }, entry };
}
