import { ALLIES, ALLY_MAP } from "../../data/allies";
import { BATTLE_MAP } from "../../data/battles";
import type { CharacterDef, JoinCondition } from "../../types/social";
import type { World } from "../world";
import { getCharacter, hasCompanion, line } from "./companion";
import { adjustRelation, ensureRelation, getRelation, palateSimilarity, PLAYER, relationKey, relationStage } from "./relations";

// 通常の仲間: villagers first, party members once their own conditions are met.

export type AllyStatus = "unmet" | "met" | "candidate" | "joined";

export interface JoinContext {
  clearedQuestIds?: string[];
}

export function checkJoinCondition(w: World, allyId: string, c: JoinCondition, ctx: JoinContext = {}): { label: string; have: string; ok: boolean } {
  const r = getRelation(w, PLAYER, allyId);
  switch (c.kind) {
    case "affection":
      return { label: `好感${c.min}以上`, have: `${Math.floor(r?.affection ?? 0)}`, ok: (r?.affection ?? 0) >= c.min };
    case "trust":
      return { label: `信頼${c.min}以上`, have: `${Math.floor(r?.trust ?? 0)}`, ok: (r?.trust ?? 0) >= c.min };
    case "foodCompatibility":
      return { label: `食の相性${c.min}以上`, have: `${Math.floor(r?.foodCompatibility ?? 0)}`, ok: (r?.foodCompatibility ?? 0) >= c.min };
    case "memory": {
      const ok = !!r?.memories.some((m) => m.recipeId === c.recipeId && m.cookedBy.includes(PLAYER));
      return { label: c.label, have: ok ? "食べた" : "まだ", ok };
    }
    case "cookedTogether":
      return { label: `一緒に料理した（${c.min}回）`, have: `${r?.cookedTogether ?? 0}回`, ok: (r?.cookedTogether ?? 0) >= c.min };
    case "sharedMeals":
      return { label: `一緒に食べた（${c.min}回）`, have: `${r?.sharedMeals ?? 0}回`, ok: (r?.sharedMeals ?? 0) >= c.min };
    case "battleWin": {
      const ok = w.battleLog.some((b) => b.winner === "player" && (!c.battleId || b.battleId === c.battleId));
      return { label: c.battleId ? `「${BATTLE_MAP[c.battleId]?.name ?? c.battleId}」に勝つ` : "料理勝負で一度勝つ", have: ok ? "勝った" : "まだ", ok };
    }
    case "quest": {
      const ok = !!ctx.clearedQuestIds?.includes(c.questId);
      return { label: c.label, have: ok ? "達成" : "まだ", ok };
    }
  }
}

export function joinChecks(w: World, allyId: string, ctx: JoinContext = {}) {
  const def = ALLY_MAP[allyId];
  const checks = (def?.joinConditions ?? []).map((c) => checkJoinCondition(w, allyId, c, ctx));
  return { ok: checks.length > 0 && checks.every((c) => c.ok), checks };
}

export function allyStatus(w: World, allyId: string, ctx: JoinContext = {}): AllyStatus {
  if (w.social.party.includes(allyId)) return "joined";
  if (!getRelation(w, PLAYER, allyId)) return "unmet";
  return joinChecks(w, allyId, ctx).ok ? "candidate" : "met";
}

export const ALLY_STATUS_LABEL: Record<AllyStatus, string> = { unmet: "まだ会っていない", met: "村の人", candidate: "仲間候補", joined: "仲間" };

/** Can be asked to help in the kitchen: the companion, party members, and villagers who like you enough. */
export const HELP_AFFECTION = 20;
export function availableHelpers(w: World): CharacterDef[] {
  const out: CharacterDef[] = [];
  if (hasCompanion(w)) out.push(w.social.companion!);
  for (const a of ALLIES) {
    const r = getRelation(w, PLAYER, a.id);
    if (w.social.party.includes(a.id) || (r && r.affection >= HELP_AFFECTION)) out.push(a);
  }
  return out;
}

// ---------- Talking ----------

export interface TalkResult {
  world: World;
  text: string;
  firstMeeting: boolean;
  stageUp: string | null;
}

/** 話す: the first time is a meeting; after that, once a day it warms things up a little. */
export function talkTo(w: World, id: string): TalkResult | string {
  const c = getCharacter(w, id);
  if (!c) return "相手がいない";
  const today = Math.floor(w.day);
  const r = getRelation(w, PLAYER, id);
  if (!r) {
    const sim = w.palate ? palateSimilarity(w.palate, c.eater) : 0;
    const world = ensureRelation(w, PLAYER, id, { affection: 10, trust: 10, foodCompatibility: Math.round(50 + 25 * sim), lastTalkDay: today });
    return { world, text: line(c, "greet"), firstMeeting: true, stageUp: null };
  }
  const before = relationStage(r);
  const fresh = r.lastTalkDay !== today;
  let world = fresh ? adjustRelation(w, PLAYER, id, { affection: 3 }) : w;
  const key = world.social.relations[r.key];
  world = { ...world, social: { ...world.social, relations: { ...world.social.relations, [r.key]: { ...key, lastTalkDay: today } } } };
  const after = relationStage(world.social.relations[r.key]);
  const stageUp = after.index > before.index ? after.name : null;
  const text = c.kind === "ally" && stageUp ? line(c, "progress", today) : stageUp && c.kind === "companion" ? line(c, "relationUp") : line(c, "talk", today);
  return { world, text: fresh ? text : `${text}（今日はもう話した）`, firstMeeting: false, stageUp };
}

// ---------- Joining ----------

/** 仲間に誘う: only when every condition holds. New members get a relation with everyone already in the party. */
export function inviteAlly(w: World, allyId: string, ctx: JoinContext = {}): { world: World; text: string } | string {
  const def = ALLY_MAP[allyId];
  if (!def) return "相手がいない";
  if (w.social.party.includes(allyId)) return "もう仲間だ";
  if (!joinChecks(w, allyId, ctx).ok) return "まだ条件を満たしていない";
  let world: World = { ...w, social: { ...w.social, party: [...w.social.party, allyId] } };
  const others = [...(hasCompanion(w) ? [w.social.companion!] : []), ...w.social.party.map((id) => ALLY_MAP[id]).filter(Boolean)];
  for (const o of others) {
    world = ensureRelation(world, o.id, allyId, {
      affection: 20, trust: 15, foodCompatibility: Math.round(50 + 30 * palateSimilarity(o.eater, def.eater)), tags: ["party"],
    });
  }
  const r = world.social.relations[relationKey(PLAYER, allyId)];
  world = { ...world, social: { ...world.social, relations: { ...world.social.relations, [r.key]: { ...r, tags: [...new Set([...r.tags, "party"])] } } } };
  return { world, text: line(def, "join") };
}

/** Everyone in the party, companion first. */
export function partyMembers(w: World): CharacterDef[] {
  return [...(hasCompanion(w) ? [w.social.companion!] : []), ...w.social.party.map((id) => ALLY_MAP[id]).filter(Boolean)];
}
