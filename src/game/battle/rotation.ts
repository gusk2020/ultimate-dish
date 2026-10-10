import { BATTLES, RIVAL_MAP } from "../../data/battles";
import type { BattleDef } from "../../types/eating";
import type { OpponentProgress } from "../../types/codex";
import { EATER_QUESTS, type EaterQuestDef } from "../eater/challenges";
import { locationOf } from "../travel/market";
import type { World } from "../world";

// 勝負相手の交代 (Phase 10): after OPPONENT_LIMIT matches against one person, the next one takes the
// main slot and the old opponent moves to 再戦. Cooks and eaters face the same people from
// opposite sides (a cook challenges their dish; an eater judges it).

export const OPPONENT_LIMIT = 3;

export function opponentOf(w: Pick<World, "opponents">, id: string): OpponentProgress {
  return w.opponents?.[id] ?? { opponentId: id, matches: 0, wins: 0, losses: 0 };
}

export function recordOpponent(w: World, id: string, outcome: "win" | "loss" | "draw"): World {
  const p = opponentOf(w, id);
  const next: OpponentProgress = {
    ...p, matches: p.matches + 1, wins: p.wins + (outcome === "win" ? 1 : 0), losses: p.losses + (outcome === "loss" ? 1 : 0),
  };
  return { ...w, opponents: { ...(w.opponents ?? {}), [id]: next } };
}

/** A rival waiting behind another appears once that one has been faced enough. */
export function rivalUnlocked(w: World, rivalId: string): boolean {
  const after = RIVAL_MAP[rivalId]?.unlockAfter;
  return !after || opponentOf(w, after).matches >= OPPONENT_LIMIT;
}

export const graduated = (w: World, rivalId: string) => opponentOf(w, rivalId).matches >= OPPONENT_LIMIT;

const here = (w: World, locationId?: string) => (locationId ?? "village") === locationOf(w).id;

/** 作る側の勝負 here: main (fresh opponents) and 再戦 (faced OPPONENT_LIMIT times). */
export function makerBattles(w: World): { main: BattleDef[]; rematch: BattleDef[] } {
  const open = BATTLES.filter((b) => here(w, b.locationId) && rivalUnlocked(w, b.rivalId) && b.requires.every((id) => w.battleLog.some((r) => r.battleId === id)));
  return { main: open.filter((b) => !graduated(w, b.rivalId)), rematch: open.filter((b) => graduated(w, b.rivalId)) };
}

/** 食べる側 here, split into 勝負 and 依頼; rotating contests move to 再戦 the same way. */
export function eaterBoard(w: World): { battles: EaterQuestDef[]; rematch: EaterQuestDef[]; requests: EaterQuestDef[] } {
  const list = EATER_QUESTS.filter((q) => here(w, q.locationId) && rivalUnlocked(w, q.rivalId));
  const battles = list.filter((q) => q.board === "battle");
  return {
    battles: battles.filter((q) => !q.rotates || !graduated(w, q.rivalId)),
    rematch: battles.filter((q) => q.rotates && graduated(w, q.rivalId)),
    requests: list.filter((q) => q.board === "request"),
  };
}
