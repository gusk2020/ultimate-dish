import { useGame } from "../state/GameContext";
import { registerRoutine, routineCandidates, routinesOf, toggleRoutine } from "../game/routine/routines";
import { nextDay } from "../components/TimeMeter";

// 日課: what happens every day without being asked, the diary of the last day, and the actions
// done often enough by hand to become routines.

export function RoutinePage() {
  const { state, dispatch } = useGame();
  const w = state.world;
  const last = w.diary?.[0];
  const candidates = routineCandidates(w);
  return (
    <div className="space-y-3 p-4">
      {last && (
        <div className="card space-y-1 text-sm" data-testid="diary">
          <div className="font-bold">📔 {last.dateLabel}</div>
          {last.lines.map((l, i) => (
            <div key={i} className={`flex gap-2 ${l.ok ? "" : "text-rose-700"}`}>
              <span className="w-6 shrink-0 text-stone-500">{l.part}</span>
              <span className="min-w-0">{l.text}</span>
            </div>
          ))}
          <div className="text-xs text-stone-500">所持金 {last.moneyDelta >= 0 ? "+" : ""}{last.moneyDelta}G・経験 +{last.xpDelta}</div>
        </div>
      )}
      <button className="btn-primary w-full py-3" onClick={() => dispatch({ type: "setWorld", world: nextDay(w) })}>🌅 次の日へ進む</button>
      <div className="card space-y-1.5 text-sm" data-testid="routines">
        <div className="font-semibold">📅 日課</div>
        <p className="text-[11px] text-stone-500">次の日へ進むと、ONの日課を上から順に自動で行う（食事 → 交流 → 勝負 → 食事 → 睡眠）。手で行うより効率は少し落ち（75%）、失敗もある。</p>
        {routinesOf(w).map((r) => (
          <label key={r.id} className="flex items-center gap-2" data-routine={r.id}>
            <input type="checkbox" className="h-5 w-5" checked={r.enabled} onChange={() => dispatch({ type: "setWorld", world: toggleRoutine(w, r.id) })} />
            <span className="min-w-0 flex-1">{r.label}</span>
            {r.lastResult && <span className="max-w-[45%] truncate text-[10px] text-stone-500">{r.lastResult}</span>}
          </label>
        ))}
      </div>
      {candidates.length > 0 && (
        <div className="card space-y-1.5 text-sm">
          <div className="font-semibold">➕ 日課にできる行動</div>
          <p className="text-[11px] text-stone-500">同じことを3回手で行うと登録できる。勝負は「再戦」に移ったものだけ。初めての依頼や発見は日課にできない。</p>
          {candidates.map((c) => (
            <div key={c.key} className="flex items-center justify-between gap-2" data-candidate={c.key}>
              <span className="min-w-0 text-xs">{c.label}<span className="block text-[10px] text-stone-500">{c.blocked ?? `${c.count}回行った`}</span></span>
              <button
                className="btn-secondary shrink-0 px-3 py-1 text-xs"
                disabled={!!c.blocked}
                onClick={() => {
                  const r = registerRoutine(w, c.key);
                  if (typeof r !== "string") dispatch({ type: "setWorld", world: r });
                }}
              >
                登録
              </button>
            </div>
          ))}
        </div>
      )}
      {(w.diary?.length ?? 0) > 1 && (
        <details className="card text-xs">
          <summary className="cursor-pointer text-sm">これまでの日誌</summary>
          {w.diary.slice(1).map((d, i) => (
            <div key={i} className="mt-1 border-t border-stone-100 pt-1">
              <div className="font-semibold">{d.dateLabel}</div>
              {d.lines.map((l, j) => <div key={j}>{l.part}　{l.text}</div>)}
            </div>
          ))}
        </details>
      )}
    </div>
  );
}
