import type { World } from "../world";

/** Counts a manual repeat (battle:/eater:/talk:/dine: + id); three of them unlock a routine. */
export function countAction(w: World, key: string): World {
  const c = w.actionCounts ?? {};
  return { ...w, actionCounts: { ...c, [key]: (c[key] ?? 0) + 1 } };
}
