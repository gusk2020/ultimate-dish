import { useState } from "react";
import { useGame } from "../state/GameContext";
import { DishDetail } from "../components/DishDetail";
import { DishImageView, RankBadge } from "../components/DishParts";
import { CodexTab, NotebookTab, PublicTab } from "../components/CodexParts";

function DishList() {
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
      <p className="text-xs text-stone-500">{state.dishes.length}品（一皿ごとの記録・自動保存）</p>
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

type DexTab = "codex" | "notebook" | "public" | "dishes";

/** 図鑑: ノート (knowledge) / 私の図鑑 (made or eaten) / 公開料理 / 一皿の記録 (every dish made). */
export function Dex() {
  const { state } = useGame();
  const [tab, setTab] = useState<DexTab>("codex");
  const tabs: [DexTab, string][] = [["notebook", "ノート"], ["codex", "私の図鑑"], ["public", "公開料理"], ["dishes", "一皿の記録"]];
  return (
    <div>
      <div className="mx-4 mt-4 grid grid-cols-4 gap-1 rounded-xl bg-stone-200 p-1">
        {tabs.map(([t, l]) => (
          <button key={t} className={`min-h-10 rounded-lg text-xs ${tab === t ? "bg-white font-bold shadow" : "text-stone-600"}`} onClick={() => setTab(t)}>
            {l}
            {t === "codex" && ` ${Object.keys(state.world.codex ?? {}).length}`}
          </button>
        ))}
      </div>
      {tab === "notebook" && <NotebookTab />}
      {tab === "codex" && <CodexTab />}
      {tab === "public" && <PublicTab />}
      {tab === "dishes" && <DishList />}
    </div>
  );
}
