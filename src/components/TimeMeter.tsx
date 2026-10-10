import { advancePart, dailyOf, hungerLabel } from "../game/time/daily";
import { partOf, PART_ICON, PART_LABEL } from "../game/time/calendar";
import { useGame } from "../state/GameContext";
import { runNextDay } from "../game/routine/routines";
import { expeditionDay } from "../game/expedition/expedition";
import { newCookingSeed } from "../game/rng";
import type { World } from "../game/world";

/** 次の日へ: a day of the expedition while one is under way, otherwise a day of routines. */
export function nextDay(w: World): World {
  if (w.expedition?.status === "active") return expeditionDay(w, newCookingSeed());
  return runNextDay(w, newCookingSeed()).world;
}

/** 午前・午後・夜: where today is, plus 待つ (one part passes). Looking around never moves time. */
export function TimeMeter() {
  const { state, dispatch } = useGame();
  const w = state.world;
  const part = partOf(w.day).part;
  const hungry = hungerLabel(w);
  const note = dailyOf(w).lastNote;
  return (
    <div className="mt-1 flex items-center gap-1.5">
      <div className="grid flex-1 grid-cols-3 gap-0.5" data-testid="time-meter" aria-label={`今は${PART_LABEL[part]}`}>
        {PART_LABEL.map((l, i) => (
          <span
            key={l}
            className={`rounded px-1 py-0.5 text-center text-[11px] leading-tight ${i === part ? "bg-amber-500 font-bold text-white" : i < part ? "bg-stone-300 text-stone-500" : "bg-stone-100 text-stone-500"}`}
          >
            {PART_ICON[i]}{l}
          </span>
        ))}
      </div>
      <button
        className="shrink-0 rounded border border-stone-300 bg-white px-1.5 py-0.5 text-[11px] text-stone-600"
        aria-label="待つ（次の時間帯へ）"
        onClick={() => dispatch({ type: "setWorld", world: advancePart(w) })}
      >
        ⏭待つ
      </button>
      <button
        className="shrink-0 rounded border border-amber-400 bg-amber-50 px-1.5 py-0.5 text-[11px] text-amber-900"
        aria-label="次の日へ進む"
        onClick={() => {
          dispatch({ type: "setWorld", world: nextDay(w) });
          dispatch({ type: "navigate", screen: w.expedition?.status === "active" ? "expedition" : "routine" });
        }}
      >
        🌅翌日
      </button>
      {(hungry || note) && <span className="sr-only">{hungry ?? note}</span>}
      {hungry && <span className="shrink-0 text-[10px] text-rose-700" title={hungry}>🍞{dailyOf(w).hunger >= 0.9 ? "空腹！" : "食事"}</span>}
    </div>
  );
}
