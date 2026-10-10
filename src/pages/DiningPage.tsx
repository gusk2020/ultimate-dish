import { useState } from "react";
import type { Dish } from "../types";
import type { MealOffer } from "../data/meals";
import { RECIPE_MAP } from "../data/recipes";
import { buyTakeaway, dineOut, isOpen, offerDish, offersHere } from "../game/food/prepared";
import { buyRoutinePacks, dailyOf, hungerLabel, ROUTINE_PACK_PRICE } from "../game/time/daily";
import { locationOf } from "../game/travel/market";
import { textGenerator } from "../services/textGeneration";
import { imageGenerator } from "../services/imageGeneration";
import { useGame } from "../state/GameContext";
import { TastingView } from "../components/TastingView";
import { RankBadge } from "../components/DishParts";
import type { DishCore } from "../game/cooking/buildDish";

// 食事: the inn's dining room (外食), the market's ready-made food (総菜), and routine meals.

export async function decorate(core: DishCore): Promise<Dish> {
  const [description, image] = await Promise.all([textGenerator.describeDish(core), imageGenerator.generate(core)]);
  return { ...core, description, image, bought: true };
}

type Tab = "inn" | "market" | "daily";

function OfferRow({ o, onPick, label }: { o: MealOffer; onPick: () => void; label: string }) {
  const { state } = useGame();
  const w = state.world;
  const open = isOpen(w, o);
  const d = offerDish(w, o);
  return (
    <div className="card text-sm" data-offer={o.id}>
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 font-semibold">{RECIPE_MAP[o.recipeId]?.name ?? o.recipeId}</span>
        <RankBadge rank={d.rank} size="sm" />
      </div>
      <div className="text-[11px] text-stone-500">{o.vendorName}{o.vendor === "market" ? `・${o.portions}食入り` : ""}・今日の出来 {d.total}点</div>
      <button className="btn-primary mt-1 w-full py-2 text-sm" disabled={!open || w.chef.money < o.price} onClick={onPick}>
        {open ? `${label}（${o.price}G）` : "今の時間帯は売っていない"}
      </button>
    </div>
  );
}

export function DiningPage() {
  const { state, dispatch } = useGame();
  const w = state.world;
  const [tab, setTab] = useState<Tab>("inn");
  const [eating, setEating] = useState<{ dish: Dish; stockId: string } | null>(null);
  const [msg, setMsg] = useState("");
  const loc = locationOf(w);
  const daily = dailyOf(w);

  if (eating) {
    return (
      <div className="space-y-3 p-4">
        <div className="card text-sm">🍲 {loc.name}で「{eating.dish.name}」をいただく</div>
        <TastingView dish={eating.dish} stockId={eating.stockId} onClose={() => setEating(null)} />
      </div>
    );
  }

  const inn = offersHere(w, "inn");
  const market = offersHere(w, "market");
  return (
    <div className="space-y-3 p-4">
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-stone-200 p-1">
        {([["inn", "🍽 食堂"], ["market", "🧺 総菜"], ["daily", "🍞 日常食"]] as [Tab, string][]).map(([t, l]) => (
          <button key={t} className={`min-h-10 rounded-lg text-sm ${tab === t ? "bg-white font-bold shadow" : "text-stone-600"}`} onClick={() => { setTab(t); setMsg(""); }}>{l}</button>
        ))}
      </div>
      {msg && <p className="text-xs text-emerald-700">{msg}</p>}
      {tab === "inn" && (
        <>
          <p className="text-xs text-stone-500">{loc.name}の宿・食堂。食べると時間が進み、図鑑に記録される（実食）。</p>
          {inn.length === 0 && <p className="text-sm text-stone-500">この土地には食堂がない</p>}
          {inn.map((o) => (
            <OfferRow
              key={o.id} o={o} label="ここで食べる"
              onPick={async () => {
                const r = dineOut(w, o.id);
                if (typeof r === "string") return setMsg(r);
                const dish = await decorate(r.dish);
                dispatch({ type: "addDish", dish });
                dispatch({ type: "setWorld", world: r.world });
                setEating({ dish, stockId: r.stock.id });
                window.scrollTo({ top: 0 });
              }}
            />
          ))}
        </>
      )}
      {tab === "market" && (
        <>
          <p className="text-xs text-stone-500">持ち帰りの総菜。手持ちの料理（在庫）に入る。転売はできない。</p>
          {market.length === 0 && <p className="text-sm text-stone-500">この土地の市場に総菜はない</p>}
          {market.map((o) => (
            <OfferRow
              key={o.id} o={o} label="買う"
              onPick={async () => {
                const r = buyTakeaway(w, o.id);
                if (typeof r === "string") return setMsg(r);
                const dish = await decorate(r.dish);
                dispatch({ type: "addDish", dish });
                dispatch({ type: "setWorld", world: r.world });
                setMsg(`「${dish.name}」${r.stock.portions}食を買った（ノートの料理から食べられる）`);
              }}
            />
          ))}
        </>
      )}
      {tab === "daily" && (
        <div className="card space-y-2 text-sm">
          <div className="font-semibold">🍞 日常食（生活のための食事）</div>
          <p className="text-xs text-stone-600">時間が経つとお腹が減り、自動で食べる。手持ちの日常食パック → 手持ちの麦や豆で簡単な自炊 → 安い食事を買う、の順。経験値・図鑑・食レポには一切ならない。</p>
          <div>空腹度 {Math.round(daily.hunger * 100)}%{hungerLabel(w) ? `（${hungerLabel(w)}）` : ""}・日常食パック {daily.routineMeals}個</div>
          {daily.lastNote && <div className="text-xs text-stone-500">最近：{daily.lastNote}</div>}
          <button
            className="btn-secondary w-full"
            onClick={() => {
              const r = buyRoutinePacks(w, 3);
              if (typeof r === "string") return setMsg(r);
              dispatch({ type: "setWorld", world: r });
              setMsg("日常食パックを3個買った");
            }}
          >
            日常食パックを3個買う（{ROUTINE_PACK_PRICE * 3}G）
          </button>
        </div>
      )}
    </div>
  );
}
