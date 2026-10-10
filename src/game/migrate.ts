import { EATER_TOOL_FOR } from "../data/eaterTools";
import { itemInfo } from "../data/items";
import { progressionOf } from "./codex/codex";
import type { World } from "./world";

// Phase 11 save migration (runs once; migrations.phase11 guards against a second sale).
// 食べる側 keeps no ingredients and no cooking tools: the pantry is sold at base price and each
// cooking tool becomes the appraisal tool of the same starting slot (香封鍋 → 香気鑑定器 …).

export function pantryValue(w: Pick<World, "inventory">): number {
  return Math.round(w.inventory.reduce((a, s) => a + (itemInfo(s.itemId)?.price ?? 0) * s.quantity, 0) * 100) / 100;
}

export function migratePhase11(w: World): World {
  if (w.migrations?.phase11) return w;
  const done = { ...(w.migrations ?? {}), phase11: true };
  if (w.identity?.lean !== "eater") return { ...w, migrations: done };
  const value = pantryValue(w);
  const p = progressionOf(w);
  const eaterTools = [...new Set([...(p.eaterTools ?? []), ...w.tools.map((t) => EATER_TOOL_FOR[t.toolId]).filter(Boolean)])];
  return {
    ...w,
    inventory: [],
    tools: [],
    chef: { ...w.chef, money: Math.round((w.chef.money + value) * 100) / 100 },
    progression: { ...p, eaterTools },
    migrations: done,
    daily: w.daily ? { ...w.daily, lastNote: value > 0 ? `食材をすべて売った（+${Math.round(value)}G）` : w.daily.lastNote } : w.daily,
  };
}
