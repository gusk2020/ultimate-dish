import { useState } from "react";
import { itemInfo } from "../data/items";
import { locationOf, marketList } from "../game/travel/market";
import { buy } from "../game/world";
import { useGame } from "../state/GameContext";

const defaultStorage = (id: string) => (itemInfo(id)?.category === "animal" || itemInfo(id)?.category === "dairy" ? "icehouse" : "shelf");
const fmt = (v: number) => `${Math.round(v * 10) / 10}G`;

/** 現在地の市場: local goods, imports, and what is not sold here. Prices are the local ones. */
export function MarketList() {
  const { state, dispatch } = useGame();
  const w = state.world;
  const loc = locationOf(w);
  const list = marketList(w);
  const [msg, setMsg] = useState("");
  const [showNone, setShowNone] = useState(false);

  const row = (r: (typeof list.local)[number]) => {
    const info = itemInfo(r.itemId)!;
    const diff = r.price! < r.base ? "安" : r.price! > r.base ? "高" : "";
    return (
      <button
        key={r.itemId}
        className="chip flex-row justify-between px-2"
        onClick={() => {
          const res = buy(w, r.itemId, 1, defaultStorage(r.itemId));
          if (typeof res === "string") return setMsg(res);
          setMsg(`${info.name}を買った（${fmt(r.price!)}）`);
          dispatch({ type: "setWorld", world: res });
        }}
      >
        <span className="min-w-0 truncate text-sm">{info.emoji}{info.name}</span>
        <span className="shrink-0 text-xs text-stone-500">
          {fmt(r.price!)}
          {diff && <span className={diff === "安" ? "ml-0.5 text-emerald-700" : "ml-0.5 text-rose-700"}>{diff}</span>}
        </span>
      </button>
    );
  };

  return (
    <div className="card space-y-2">
      <h2 className="section-title mb-0">🏪 {loc.name}の市場</h2>
      <p className="text-[11px] text-stone-500">1個ずつ買う。地元品は安く、遠くの品は高いか売っていない（安/高＝村の値段との比較）。</p>
      {msg && <p className="text-xs text-stone-700">{msg}</p>}
      <div className="text-xs font-semibold text-emerald-800">地元品（{list.local.length}）</div>
      <div className="grid grid-cols-2 gap-1.5">{list.local.map(row)}</div>
      {list.imported.length > 0 && (
        <>
          <div className="text-xs font-semibold text-amber-800">輸入品（{list.imported.length}）</div>
          <div className="grid grid-cols-2 gap-1.5">{list.imported.map(row)}</div>
        </>
      )}
      <button className="w-full text-left text-xs text-stone-500 underline" onClick={() => setShowNone(!showNone)}>
        売っていない品（{list.none.length}）{showNone ? "を隠す" : "を見る"}
      </button>
      {showNone && (
        <div className="flex flex-wrap gap-1 text-[11px] text-stone-400">
          {list.none.map((r) => <span key={r.itemId} className="rounded-full bg-stone-100 px-2 py-0.5">{itemInfo(r.itemId)?.emoji}{itemInfo(r.itemId)?.name}</span>)}
        </div>
      )}
    </div>
  );
}
