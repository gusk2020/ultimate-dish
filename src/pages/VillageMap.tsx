import { useState } from "react";
import { FACILITIES, type Facility } from "../data/facilities";
import { INGREDIENTS } from "../data/ingredients";
import { useGame } from "../state/GameContext";

// 2D top-down village: a 4x6 grid with a dirt-road cross. Facilities are tap targets.
export function VillageMap() {
  const { state, dispatch } = useGame();
  const [info, setInfo] = useState<Facility | null>(null);

  const tap = (f: Facility) => {
    if (f.screen) dispatch({ type: "navigate", screen: f.screen });
    else setInfo(f);
  };

  return (
    <div className="p-4">
      {!state.world.palate && (
        <button className="btn-primary mb-3 w-full" onClick={() => dispatch({ type: "navigate", screen: "chef" })}>
          🍽️ まずはあなたの「食遍歴」を教えてください
        </button>
      )}
      <div className="relative aspect-[4/6] w-full overflow-hidden rounded-2xl bg-lime-200 shadow-inner">
        {/* roads */}
        <div className="absolute inset-y-0 left-1/2 w-8 -translate-x-1/2 bg-amber-200/80" />
        <div className="absolute inset-x-0 top-1/2 h-8 -translate-y-1/2 bg-amber-200/80" />
        <div className="absolute right-3 bottom-[18%] text-3xl opacity-60">🌳</div>
        <div className="absolute top-[28%] left-[30%] text-2xl opacity-60">🌳</div>
        <div className="absolute top-[70%] left-[35%] text-2xl opacity-60">⛲</div>

        <div className="absolute inset-0 grid grid-cols-4 grid-rows-6 p-2">
          {FACILITIES.map((f) => (
            <button
              key={f.id}
              onClick={() => tap(f)}
              style={{ gridColumn: `${f.col + 1}`, gridRow: `${f.row + 1} / span 2` }}
              className="m-1 flex flex-col items-center justify-center rounded-xl bg-white/90 p-1 shadow active:scale-95"
            >
              <span className="text-3xl leading-none">{f.emoji}</span>
              <span className="mt-1 text-center text-[11px] leading-tight font-semibold">{f.name}</span>
            </button>
          ))}
        </div>
      </div>
      <p className="mt-2 text-center text-xs text-stone-500">施設をタップして移動</p>

      {info && (
        <div className="fixed inset-0 z-20 flex items-end bg-black/30" onClick={() => setInfo(null)}>
          <div className="mx-auto w-full max-w-md rounded-t-2xl bg-white p-4 pb-8" onClick={(e) => e.stopPropagation()}>
            <div className="mb-1 text-lg font-bold">
              {info.emoji} {info.name}
            </div>
            <p className="mb-2 text-sm text-stone-600">{info.description}</p>
            <div className="mb-3 flex flex-wrap gap-1.5 text-sm">
              {INGREDIENTS.filter((i) => i.source === info.source).map((i) => (
                <span key={i.id} className="rounded-full bg-stone-100 px-2 py-1">
                  {i.emoji}
                  {i.name}
                </span>
              ))}
            </div>
            <button className="btn-secondary w-full" onClick={() => setInfo(null)}>
              閉じる
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
