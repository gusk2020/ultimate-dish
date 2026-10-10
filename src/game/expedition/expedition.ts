import { EXPEDITION_MAP, HIRE_MAP, type ExpeditionDestination } from "../../data/expeditions";
import { itemInfo, newStack } from "../../data/items";
import type { ExpeditionHire, ExpeditionState } from "../../types/life";
import { maxStamina } from "../chef/stats";
import { progressionOf } from "../codex/codex";
import { gainEaterXp, recordEaten } from "../eater/progression";
import { addSkillXp } from "../eater/skills";
import { roadRisk } from "../property/property";
import { createRng, seedFrom } from "../rng";
import { formatDate } from "../time/calendar";
import { locationOf } from "../travel/market";
import { advanceTime, type World } from "../world";
import { cookRivalDish } from "../battle/battle";
import { VENDOR_COOK } from "../../data/meals";

// 日誌式遠征: prepare, set out, then each 次の日へ writes one day of the diary.

const has = (hires: ExpeditionHire[], role: string) => hires.map((h) => HIRE_MAP[h.hireId]).find((d) => d?.role === role);

export function fixedFees(hires: ExpeditionHire[]): number {
  return hires.filter((h) => h.contract === "fixed").reduce((a, h) => a + (HIRE_MAP[h.hireId]?.fee ?? 0), 0);
}

export function expeditionsHere(w: World): ExpeditionDestination[] {
  return Object.values(EXPEDITION_MAP).filter((e) => e.fromLocationId === locationOf(w).id);
}

/** Set out: fixed fees are paid now; shares come out of the haul at the end. */
export function startExpedition(w: World, destinationId: string, hires: ExpeditionHire[]): World | string {
  const d = EXPEDITION_MAP[destinationId];
  if (!d) return "そんな行き先はない";
  if (w.expedition?.status === "active") return "遠征の途中だ";
  if (d.fromLocationId !== locationOf(w).id) return "ここからは出発できない";
  const fee = fixedFees(hires);
  if (w.chef.money < fee) return "雇い賃が足りない";
  const goal = w.identity?.lean === "eater" ? "eater" : "maker";
  const state: ExpeditionState = {
    destinationId, goal, hires, day: 0, totalDays: d.days, progress: 0, risk: 0,
    log: [`${formatDate(w.day)} ${d.name}へ出発。目的：${goal === "eater" ? d.eaterGoal : d.makerGoal}${hires.length ? `（同行：${hires.map((h) => `${HIRE_MAP[h.hireId]?.name}・${h.contract === "fixed" ? "固定報酬" : "山分け"}`).join("、")}）` : "（ひとり）"}`],
    status: "active", outcome: null, rewards: [],
  };
  return { ...w, chef: { ...w.chef, money: w.chef.money - fee }, expedition: state };
}

/** One day on the road (次の日へ during an expedition). */
export function expeditionDay(w: World, seed: number): World {
  const e = w.expedition;
  if (!e || e.status !== "active") return w;
  const d = EXPEDITION_MAP[e.destinationId];
  const rng = createRng(seedFrom(seed, e.destinationId, e.day));
  const guide = has(e.hires, "guide"), guard = has(e.hires, "guard"), mage = has(e.hires, "mage"), spirit = has(e.hires, "spirit");
  const luck = (w.chef.stats.luck - 5) * 0.01;
  const know = Math.min(0.15, (w.travel.regionKnowledge?.[locationOf(w).regionId]?.visits ?? 0) * 0.03);
  const body = w.identity?.lean === "eater" ? Math.min(0.1, (progressionOf(w).eaterSkills?.body ?? 0) / 300) : 0;
  const day = e.day + 1;
  const lines: string[] = [];
  let progress = e.progress;
  let risk = e.risk;
  let extraCost = 0;

  // The way: a guide finds it, rough ground and weather slow you.
  const wayRoll = rng() + (guide?.skill ?? 0) * 0.4 + know + luck - d.terrain * 0.4;
  if (wayRoll > 0.7) { progress += 1.4; lines.push(guide ? `${guide.name}が近道を見つけた` : "思いがけず歩きやすい道に出た"); }
  else if (wayRoll > 0.25) { progress += 1; lines.push(["晴れ。順調に進んだ", "曇り。黙々と歩いた", "小雨の中を進んだ"][Math.floor(rng() * 3)]); }
  else { progress += 0.5; lines.push("雨と悪路で、思うように進めなかった"); }

  // Danger: guards keep you safe (for a price), magic and spirits read the land.
  const threat = rng() * d.danger - (guard?.skill ?? 0) * 0.35 - (mage?.skill ?? 0) * d.arcane * 0.3 - (spirit?.skill ?? 0) * d.arcane * 0.3 - body;
  if (threat > 0.3) { risk += 1; lines.push("魔物の縄張りに入り、荷の一部を捨てて逃げた"); }
  else if (threat > 0.12) {
    if (guard) { extraCost += 10; lines.push(`魔物と出くわしたが、${guard.name}が追い払った（危険手当 10G）`); }
    else { risk += 0.5; lines.push("物陰の気配を避けて大きく迂回した"); }
  } else if (spirit && rng() < 0.3) lines.push(`${spirit.name}の精霊が水場を教えてくれた`);

  let world = advanceTime(w, 1);
  world = { ...world, chef: { ...world.chef, money: Math.max(0, world.chef.money - extraCost), stamina: Math.max(0, world.chef.stamina - Math.round(maxStamina(world.chef) * 0.1)) } };
  const thieves = roadRisk(world, seedFrom(seed, "exp-thieves", day));
  world = thieves.world;
  if (thieves.text) lines.push(thieves.text);

  let next: ExpeditionState = { ...e, day, progress, risk, log: [...e.log, `${day}日目　${lines.join("。")}`] };
  if (progress >= d.days || day >= d.days + 2) next = finish(next, d);
  world = { ...world, expedition: next };
  return next.status === "done" ? applyRewards(world, d, seed) : world;
}

function finish(e: ExpeditionState, d: ExpeditionDestination): ExpeditionState {
  const reached = e.progress >= d.days;
  const outcome = !reached ? "failure" : e.risk >= 1.5 ? "partial" : "success";
  const text = outcome === "success" ? "目的地に到達し、目的を果たした" : outcome === "partial" ? "目的地には着いたが、荷を失い成果は半分" : "日数が尽き、引き返した";
  return { ...e, status: "done", outcome, log: [...e.log, `結果：${text}${e.day > d.days ? `（予定より${e.day - d.days}日延長）` : ""}`] };
}

function applyRewards(w: World, d: ExpeditionDestination, seed: number): World {
  const e = w.expedition!;
  if (e.outcome === "failure") return { ...w, expedition: { ...e, rewards: [] } };
  const half = e.outcome === "partial";
  const rewards: string[] = [];
  let world = w;
  let haulValue = 0;
  if (e.goal === "maker") {
    const r = d.makerReward;
    if (r.itemId) {
      const amount = Math.max(1, Math.floor((r.amount ?? 1) * (half ? 0.5 : 1)));
      world = { ...world, stackCounter: world.stackCounter + 1, inventory: [...world.inventory, newStack(r.itemId, amount, "shelf", "遠征", world.day, world.stackCounter + 5000)] };
      haulValue = (itemInfo(r.itemId)?.price ?? 5) * amount;
      rewards.push(half ? `${r.text}（半分だけ）` : r.text);
    }
  } else {
    const r = d.eaterReward;
    const base = cookRivalDish(VENDOR_COOK, "highland-smoked-ibex", seedFrom(seed, "legend")).dish;
    const dish = { ...base, name: r.dishName, recipeId: undefined, total: Math.min(100, base.total + 15), profile: { ...base.profile, spiceIds: r.shu ? [...base.profile.spiceIds, "ryuenshou"] : base.profile.spiceIds } };
    world = recordEaten(world, dish, `遠征：${d.name}`).world;
    world = gainEaterXp(world, half ? 15 : 40, half ? 1 : 3);
    const p = progressionOf(world);
    world = { ...world, progression: { ...addSkillXp(p, { body: 10, culture: 8 }), maxSHU: r.shu && !half ? Math.max(p.maxSHU ?? 0, r.shu) : p.maxSHU } };
    haulValue = 40;
    rewards.push(half ? `${r.dishName}をひと口だけ味わえた` : r.text);
  }
  // 山分け: those on a share take their cut of the haul's worth in coin.
  const shareCost = Math.round(e.hires.filter((h) => h.contract === "share").reduce((a, h) => a + (HIRE_MAP[h.hireId]?.share ?? 0) * haulValue * 2, 0));
  if (shareCost) { world = { ...world, chef: { ...world.chef, money: Math.max(0, world.chef.money - shareCost) } }; rewards.push(`山分けで${shareCost}G支払った`); }
  return { ...world, expedition: { ...world.expedition!, rewards } };
}

export function closeExpedition(w: World): World {
  return w.expedition?.status === "done" ? { ...w, expedition: null } : w;
}
