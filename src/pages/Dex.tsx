import { useState } from "react";
import { useGame } from "../state/GameContext";
import { DishDetail } from "../components/DishDetail";
import { DishImageView, RankBadge } from "../components/DishParts";

export function Dex() {
  const { state, dispatch } = useGame();
  const [openId, setOpenId] = useState<string | null>(null);

  if (!state.dishes.length) {
    return (
      <div className="p-6 text-center text-stone-500">
        <p className="mb-3">図鑑はまだ空です。</p>
        <button className="btn-primary" onClick={() => dispatch({ type: "navigate", screen: "kitchen" })}>
          厨房で料理を作る
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2 p-4">
      <p className="text-xs text-stone-500">{state.dishes.length}品（再読み込みで消えます）</p>
      {state.dishes.map((d) => (
        <div key={d.id} className="card">
          <button className="flex w-full items-center gap-3 text-left" onClick={() => setOpenId(openId === d.id ? null : d.id)}>
            <DishImageView image={d.image} size={48} />
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold">{d.name}</div>
              <div className="text-xs text-stone-500">
                {d.parentDishId ? "🌱派生 " : ""}
                {d.isPublic ? "公開" : "非公開"}
              </div>
            </div>
            <RankBadge rank={d.rank} />
            <span className="w-8 text-right text-lg font-bold tabular-nums">{d.total}</span>
          </button>
          {openId === d.id && (
            <div className="mt-3 border-t border-stone-200 pt-3">
              <DishDetail
                dish={d}
                onRename={(name) => dispatch({ type: "renameDish", id: d.id, name })}
                onTogglePublic={() => dispatch({ type: "togglePublic", id: d.id })}
                onDerive={() => dispatch({ type: "derive", dish: d })}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
