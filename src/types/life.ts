// Phase 11: routines and the day log, property and kitchens you own, food storage, the guilds'
// shared food storage, the bank, expeditions and save migrations. Pure data shapes only.
import type { DishStock, InventoryStack } from "./world";

export type RoutineKind = "meal" | "sleep" | "battle" | "eaterBattle" | "talk" | "dine";

export interface RoutineAction {
  id: string;
  kind: RoutineKind;
  targetId: string;
  label: string;
  enabled: boolean;
  priority: number;
  unlocked: boolean;
  runCount: number;
  lastResult: string | null;
}

export interface DiaryLine {
  part: "朝" | "昼" | "夕" | "夜";
  text: string;
  ok: boolean;
}

export interface DiaryEntry {
  dateLabel: string;
  lines: DiaryLine[];
  moneyDelta: number;
  xpDelta: number;
}

export interface PropertyState {
  /** Locations with a house (自宅). */
  houses: string[];
  /** Locations with a shop (店舗). */
  shops: string[];
  /** Portable kitchens owned (carried everywhere). */
  portableKitchens: string[];
}

export interface StoredFood {
  id: string;
  /** dish = cooked / preserved dish; ingredient = dead or processed foodstuff. */
  kind: "dish" | "ingredient";
  stock?: DishStock;
  stack?: InventoryStack;
  storedDay: number;
  from: string;
}

export interface FoodStorageState {
  /** Owned storage facilities and what is in them. */
  facilities: { facilityId: string; locationId: string | null; items: StoredFood[] }[];
}

export interface GuildStorageState {
  plan: string | null;
  items: StoredFood[];
}

export interface BankAccount {
  opened: boolean;
  balance: number;
  openedDay: number | null;
}

export interface ExpeditionHire {
  hireId: string;
  contract: "fixed" | "share";
}

export interface ExpeditionState {
  destinationId: string;
  goal: "maker" | "eater";
  hires: ExpeditionHire[];
  day: number;
  totalDays: number;
  progress: number;
  risk: number;
  log: string[];
  status: "active" | "done";
  outcome: "success" | "partial" | "failure" | null;
  rewards: string[];
}

export interface Migrations {
  phase11?: boolean;
}
