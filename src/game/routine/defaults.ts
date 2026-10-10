import type { RoutineAction } from "../../types/life";

/** 食事 and 睡眠 are registered from the start (and can be switched off). */
export function defaultRoutines(): RoutineAction[] {
  return [
    { id: "meal", kind: "meal", targetId: "meal", label: "食事（日常食）", enabled: true, priority: 0, unlocked: true, runCount: 0, lastResult: null },
    { id: "sleep", kind: "sleep", targetId: "sleep", label: "睡眠", enabled: true, priority: 99, unlocked: true, runCount: 0, lastResult: null },
  ];
}
