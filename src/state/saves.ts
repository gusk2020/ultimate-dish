import { GENDER_LABEL } from "../data/creation";
import { TOOL_MAP } from "../data/magic";
import { progressionOf } from "../game/codex/codex";
import { locationOf } from "../game/travel/market";
import { formatShort } from "../game/time/calendar";
import { createWorld, type World } from "../game/world";
import type { GameState } from "./GameContext";

// キャラクター別セーブ: up to four slots in localStorage. Every slot keeps the whole game
// (World, dishes, quest results…). Saving never deletes anything but the slot the player deletes.

export const SAVE_KEY = "ultimate-dish:saves:v1";
/** A pre-Phase 9 single save, if one ever exists: migrated into slot 1, never removed. */
export const LEGACY_KEY = "ultimate-dish:save";
export const MAX_SLOTS = 4;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export type PersistedState = Omit<GameState, "kitchenSeed" | "slotId" | "mode" | "cookRecipeId">;

export interface SlotSummary {
  name: string;
  lean: "maker" | "eater" | null;
  roleLabel: string;
  gender: string;
  age: number | null;
  level: number;
  levelLabel: string;
  location: string;
  day: number;
  /** Phase 10: 世界暦 date and part of the day. */
  dateLabel?: string;
  partner: string;
}

export interface SaveSlot {
  id: string;
  createdAt: number;
  updatedAt: number;
  summary: SlotSummary;
  state: PersistedState;
}

export interface SaveStore {
  version: 1;
  slots: SaveSlot[];
  lastSlotId: string | null;
  migratedLegacy?: boolean;
}

export function memoryStorage(init: Record<string, string> = {}): StorageLike & { data: Record<string, string> } {
  const data = { ...init };
  return { data, getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => void (data[k] = v) };
}

export function browserStorage(): StorageLike {
  try {
    if (typeof localStorage !== "undefined") return localStorage;
  } catch {
    /* storage blocked: fall through */
  }
  return memoryStorage();
}

/** Older worlds (before a phase added a field) get that field's starting value. */
export function normalizeWorld(w: Partial<World>): World {
  const base = createWorld();
  const merged = { ...base, ...w } as World;
  return { ...merged, progression: { ...base.progression, ...(w.progression ?? {}) }, codex: w.codex ?? {}, publicRegistry: w.publicRegistry ?? [] };
}

export function summarize(w: World): SlotSummary {
  const lean = w.identity?.lean ?? null;
  const p = progressionOf(w);
  const companion = w.social.companion;
  const toolId = w.identity?.startingToolId;
  return {
    name: w.identity?.name ?? w.chef.name,
    lean,
    roleLabel: lean === "eater" ? "食べる側" : "作る側",
    gender: w.identity?.genderExpression ? GENDER_LABEL[w.identity.genderExpression] : "—",
    age: w.identity?.age ?? null,
    level: lean === "eater" ? p.eaterLevel : w.chef.level,
    levelLabel: lean === "eater" ? `フードファイターLv${p.eaterLevel}` : `料理人Lv${w.chef.level}`,
    location: locationOf(w).shortName,
    day: Math.floor(w.day) + 1,
    dateLabel: formatShort(w.day),
    partner: companion ? `${companion.emoji} ${companion.name}` : toolId && TOOL_MAP[toolId] ? `${TOOL_MAP[toolId].emoji} ${TOOL_MAP[toolId].name}` : "—",
  };
}

function emptyStore(): SaveStore {
  return { version: 1, slots: [], lastSlotId: null };
}

/** Reads the store; a legacy single save becomes slot 1 the first time (and stays where it was). */
export function loadStore(storage: StorageLike = browserStorage()): SaveStore {
  let store = emptyStore();
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as SaveStore;
      if (parsed && Array.isArray(parsed.slots)) store = { ...emptyStore(), ...parsed };
    }
  } catch {
    // A broken store is left in place (never overwritten blindly); play continues without it.
    return emptyStore();
  }
  if (!store.migratedLegacy && store.slots.length < MAX_SLOTS) {
    const legacy = readLegacy(storage);
    if (legacy) {
      const slot = makeSlot("slot-legacy", legacy, Date.now());
      store = { ...store, slots: [slot, ...store.slots], lastSlotId: store.lastSlotId ?? slot.id, migratedLegacy: true };
      try { storage.setItem(SAVE_KEY, JSON.stringify(store)); } catch { /* full storage: keep in memory */ }
    }
  }
  return store;
}

function readLegacy(storage: StorageLike): PersistedState | null {
  try {
    const raw = storage.getItem(LEGACY_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    // Either a whole game state or a bare world.
    if (v && v.world) return toPersisted(v);
    if (v && v.chef) return toPersisted({ world: v });
  } catch {
    /* unreadable: ignore */
  }
  return null;
}

export function toPersisted(v: Partial<PersistedState> & { world: Partial<World> }): PersistedState {
  const world = normalizeWorld(v.world);
  // A legacy world had no creation step: treat it as an existing, finished character.
  const identity = world.identity?.creationCompleted ? world.identity : { ...world.identity, creationCompleted: true, lean: world.identity?.lean ?? "maker" };
  return {
    screen: v.screen ?? "village",
    dishes: v.dishes ?? [],
    clearedQuestIds: v.clearedQuestIds ?? [],
    questResults: v.questResults ?? {},
    clock: v.clock ?? { day: Math.floor(world.day) + 1, season: "spring", weather: "sunny" },
    world: { ...world, identity },
  };
}

function makeSlot(id: string, state: PersistedState, now: number, createdAt = now): SaveSlot {
  return { id, createdAt, updatedAt: now, summary: summarize(state.world), state };
}

let slotCounter = 0;
export function newSlotId(): string {
  slotCounter += 1;
  return `slot-${Date.now().toString(36)}-${slotCounter}`;
}

/** Writes one slot. A new slot beyond the fourth is refused. */
export function writeSlot(store: SaveStore, id: string, state: PersistedState, now = Date.now()): SaveStore | string {
  const existing = store.slots.find((s) => s.id === id);
  if (!existing && store.slots.length >= MAX_SLOTS) return `セーブ枠は${MAX_SLOTS}つまで。どれかを削除してから作ってください`;
  const slot = makeSlot(id, state, now, existing?.createdAt ?? now);
  const slots = existing ? store.slots.map((s) => (s.id === id ? slot : s)) : [...store.slots, slot];
  return { ...store, slots, lastSlotId: id };
}

export function deleteSlot(store: SaveStore, id: string): SaveStore {
  return { ...store, slots: store.slots.filter((s) => s.id !== id), lastSlotId: store.lastSlotId === id ? null : store.lastSlotId };
}

export function persistStore(store: SaveStore, storage: StorageLike = browserStorage()): string | null {
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(store));
    return null;
  } catch {
    return "保存できなかった（端末の空き容量を確認してください）";
  }
}

export function canCreate(store: SaveStore): boolean {
  return store.slots.length < MAX_SLOTS;
}

export function slotState(slot: SaveSlot): PersistedState {
  return toPersisted(slot.state);
}

export function formatUpdated(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
