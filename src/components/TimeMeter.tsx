import { advancePart, dailyOf, hungerLabel } from "../game/time/daily";
import { partOf, PART_ICON, PART_LABEL } from "../game/time/calendar";
import { useGame } from "../state/GameContext";

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
      {(hungry || note) && <span className="sr-only">{hungry ?? note}</span>}
      {hungry && <span className="shrink-0 text-[10px] text-rose-700" title={hungry}>🍞{dailyOf(w).hunger >= 0.9 ? "空腹！" : "食事"}</span>}
    </div>
  );
}
