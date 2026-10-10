import { useState } from "react";
import type { Dish } from "../types";
import { useGame } from "../state/GameContext";
import { DishDetail } from "../components/DishDetail";
import { DishImageView, RankBadge } from "../components/DishParts";
import { CodexDetail, PublicTab } from "../components/CodexParts";
import { TastingView } from "../components/TastingView";
import { itemInfo } from "../data/items";
import { METHOD_MAP } from "../data/methods";
import { LOCATION_MAP } from "../data/regions";
import { getRecipe } from "../game/learning/recipeBook";
import { KNOWLEDGE_JA } from "../game/codex/codex";
import { groupNotes, noteItems, searchNotes, STATUS_ICON, VIEW_LABEL, type NoteItem, type NoteStatus, type NoteView } from "../game/codex/notebookIndex";
import { buyTakeaway, dineOut, isOpen, offersFor, offersHere } from "../game/food/prepared";
import { locationOf } from "../game/travel/market";
import { decorate } from "./DiningPage";

function DishList() {
  const { state, dispatch } = useGame();
  const [openId, setOpenId] = useState<string | null>(null);
  if (!state.dishes.length) return <p className="p-6 text-center text-sm text-stone-500">まだ一皿も記録がない。</p>;
  return (
    <div className="space-y-2 p-4">
      <p className="text-xs text-stone-500">{state.dishes.length}品（一皿ごとの記録・自動保存）</p>
      {state.dishes.map((d) => (
        <div key={d.id} className="card">
          <button className="flex w-full items-center gap-3 text-left" onClick={() => setOpenId(openId === d.id ? null : d.id)}>
            <DishImageView image={d.image} size={48} />
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold">{d.name}</div>
              <div className="text-xs text-stone-500">{d.bought ? "買った料理" : d.parentDishId ? "🌱派生" : ""}{d.isPublic ? " 公開" : ""}</div>
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

function StatusIcons({ item }: { item: NoteItem }) {
  return (
    <span className="flex shrink-0 gap-0.5 text-sm" aria-label="状態">
      {(Object.keys(STATUS_ICON) as NoteStatus[]).filter((k) => item.status[k]).map((k) => (
        <span key={k} title={STATUS_ICON[k].label}>{STATUS_ICON[k].icon}</span>
      ))}
    </span>
  );
}

function NoteCard({ item, onOpen }: { item: NoteItem; onOpen: () => void }) {
  return (
    <button className="card flex w-full items-center gap-2 py-2 text-left" data-note-item={item.name} onClick={onOpen}>
      <span className="text-2xl">{item.emoji}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{item.name}</span>
        <span className="text-[10px] text-stone-500">{item.region}・{item.category}</span>
      </span>
      <StatusIcons item={item} />
    </button>
  );
}

/** 食べる: from your own stock, the dining room, the market — or (for a cook's recipe) cook it yourself. */
function EatOptions({ item, onEat }: { item: NoteItem; onEat: (dish: Dish, stockId: string) => void }) {
  const { state, dispatch } = useGame();
  const w = state.world;
  const [msg, setMsg] = useState("");
  const eater = w.identity?.lean === "eater";
  const stocks = w.dishStock.filter((s) => (item.recipeId ? s.recipeId === item.recipeId : s.name === item.name));
  const inn = item.recipeId ? offersHere(w, "inn").filter((o) => o.recipeId === item.recipeId) : [];
  const market = item.recipeId ? offersHere(w, "market").filter((o) => o.recipeId === item.recipeId) : [];
  const elsewhere = item.recipeId ? offersFor(item.recipeId).filter((o) => o.locationId !== locationOf(w).id) : [];
  const canCook = item.knowledge !== "unknown";
  const nothing = !stocks.length && !inn.length && !market.length && !canCook;
  return (
    <div className="card space-y-1.5 text-sm" data-testid="eat-options">
      <div className="font-semibold">🍴 食べる方法</div>
      {stocks.map((s) => {
        const dish = state.dishes.find((d) => d.id === s.dishId);
        return dish ? (
          <button key={s.id} className="btn-secondary w-full text-sm" onClick={() => onEat(dish, s.id)}>手持ちを食べる（残り{s.portions}食）</button>
        ) : null;
      })}
      {inn.map((o) => (
        <button
          key={o.id} className="btn-secondary w-full text-sm" disabled={!isOpen(w, o) || w.chef.money < o.price}
          onClick={async () => {
            const r = dineOut(w, o.id);
            if (typeof r === "string") return setMsg(r);
            const dish = await decorate(r.dish);
            dispatch({ type: "addDish", dish });
            dispatch({ type: "setWorld", world: r.world });
            onEat(dish, r.stock.id);
          }}
        >
          🍽 外食：{o.vendorName}で食べる（{o.price}G）{isOpen(w, o) ? "" : "・今は閉店"}
        </button>
      ))}
      {market.map((o) => (
        <button
          key={o.id} className="btn-secondary w-full text-sm" disabled={!isOpen(w, o) || w.chef.money < o.price}
          onClick={async () => {
            const r = buyTakeaway(w, o.id);
            if (typeof r === "string") return setMsg(r);
            const dish = await decorate(r.dish);
            dispatch({ type: "addDish", dish });
            dispatch({ type: "setWorld", world: r.world });
            setMsg(`総菜を${r.stock.portions}食買った。「手持ちを食べる」で食べられる`);
          }}
        >
          🧺 総菜：{o.vendorName}で買う（{o.portions}食 {o.price}G）{isOpen(w, o) ? "" : "・今は閉店"}
        </button>
      ))}
      {canCook && item.recipeId && (
        <button className="btn-secondary w-full text-sm" onClick={() => dispatch({ type: "cookRecipe", recipeId: item.recipeId! })}>
          🍳 自分で作る{eater ? "（食べる側の主な成長にはならない）" : ""}
        </button>
      )}
      {nothing && <p className="text-xs text-rose-700">この土地では入手できない</p>}
      {elsewhere.length > 0 && !inn.length && !market.length && (
        <p className="text-[11px] text-stone-500">ここで食べられる場所：{[...new Set(elsewhere.map((o) => LOCATION_MAP[o.locationId]?.name))].join("・")}</p>
      )}
      {msg && <p className="text-xs text-emerald-700">{msg}</p>}
    </div>
  );
}

function NoteDetail({ item, onBack }: { item: NoteItem; onBack: () => void }) {
  const { state, dispatch } = useGame();
  const w = state.world;
  const eater = w.identity?.lean === "eater";
  const [showEat, setShowEat] = useState(false);
  const [eating, setEating] = useState<{ dish: Dish; stockId: string } | null>(null);
  const recipe = item.recipeId ? getRecipe(w, item.recipeId) : undefined;
  const entry = w.codex?.[item.key];
  const ownStocks = w.dishStock.filter((s) => !s.bought && (item.recipeId ? s.recipeId === item.recipeId : s.name === item.name));
  const knows = item.knowledge !== "unknown";

  if (eating) {
    return (
      <div className="space-y-3 p-4">
        <button className="text-sm text-stone-500 underline" onClick={() => setEating(null)}>← {item.name}</button>
        <TastingView dish={eating.dish} stockId={eating.stockId} onClose={() => setEating(null)} />
      </div>
    );
  }
  return (
    <div className="space-y-3 p-4">
      <button className="text-sm text-stone-500 underline" onClick={onBack}>← ノート</button>
      <div className="card space-y-1 text-sm" data-testid="note-detail">
        <div className="flex items-center gap-3">
          <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-stone-100 text-3xl">{item.emoji}</span>
          <div className="min-w-0">
            <div className="text-lg font-bold">{item.name}</div>
            <StatusIcons item={item} />
          </div>
        </div>
        <div className="text-xs text-stone-600">地域：{item.region}・分類：{item.category}{item.tags.length ? `・${item.tags.join("・")}` : ""}</div>
        {recipe && (
          <>
            <div className="text-xs">食材：{[...recipe.ingredients, ...recipe.seasonings].map((l) => `${itemInfo(l.itemId)?.emoji}${itemInfo(l.itemId)?.name}`).join(" ")}</div>
            <div className="text-xs">技法：{recipe.steps.map((s) => METHOD_MAP[s.methodId]?.name ?? s.methodId).join("・")}</div>
          </>
        )}
        <div className="text-xs">レシピ知識：{knows ? KNOWLEDGE_JA[item.knowledge] : "作り方は知らない"}</div>
        <div className="text-xs">作った {entry?.timesCooked ?? 0}回・食べた {entry?.timesEaten ?? 0}回・図鑑 {entry ? "記録あり" : "なし"}・公開 {item.status.public ? "公開中" : "非公開"}</div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {!eater && knows && item.recipeId && (
          <button className="btn-primary" onClick={() => dispatch({ type: "cookRecipe", recipeId: item.recipeId! })}>🍳 作る</button>
        )}
        <button className={eater ? "btn-primary col-span-2" : "btn-secondary"} onClick={() => setShowEat(!showEat)}>🍴 食べる</button>
        {!eater && ownStocks.length > 0 && (
          <button
            className="btn-secondary col-span-2"
            onClick={() => {
              dispatch({ type: "setWorld", world: { ...w, dishStock: w.dishStock.map((s) => (ownStocks.some((o) => o.id === s.id) ? { ...s, listed: true } : s)) } });
              dispatch({ type: "navigate", screen: "sales" });
            }}
          >
            🏪 売る（{ownStocks.reduce((a, s) => a + s.portions, 0)}食を販売へ）
          </button>
        )}
      </div>
      {showEat && <EatOptions item={item} onEat={(dish, stockId) => setEating({ dish, stockId })} />}
      {entry ? (
        <div className="card text-sm">
          <div className="font-semibold">📚 図鑑の記録</div>
          <CodexDetail e={entry} />
        </div>
      ) : (
        <p className="text-xs text-stone-500">まだ作っても食べてもいない（図鑑の記録なし）。</p>
      )}
    </div>
  );
}

type Section = "notes" | "public" | "dishes";

/** 自分のノート: the one entrance to every dish — search, switch the view, open a folder, open a dish. */
export function Dex() {
  const { state } = useGame();
  const [section, setSection] = useState<Section>("notes");
  const [view, setView] = useState<NoteView>("category");
  const [query, setQuery] = useState("");
  const [folder, setFolder] = useState<string | null>(null);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const items = noteItems(state.world);
  const open = items.find((i) => i.key === openKey);
  if (section === "notes" && open) return <NoteDetail item={open} onBack={() => setOpenKey(null)} />;

  const found = searchNotes(items, query);
  const groups = groupNotes(found, view);
  const inFolder = folder ? groups.find((g) => g.folder === folder)?.items ?? [] : [];
  return (
    <div>
      <div className="mx-4 mt-3 grid grid-cols-3 gap-1 rounded-xl bg-stone-200 p-1 text-xs">
        {([["notes", "📖 自分のノート"], ["public", "🌐 公開料理"], ["dishes", "🍽 一皿の記録"]] as [Section, string][]).map(([s, l]) => (
          <button key={s} className={`min-h-9 rounded-lg ${section === s ? "bg-white font-bold shadow" : "text-stone-600"}`} onClick={() => setSection(s)}>{l}</button>
        ))}
      </div>
      {section === "public" && <PublicTab />}
      {section === "dishes" && <DishList />}
      {section === "notes" && (
        <div className="space-y-2 p-4">
          <input
            aria-label="ノートを検索"
            className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-base"
            placeholder="🔍 料理名・タグ・地域で探す"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setFolder(null); }}
          />
          <div className="grid grid-cols-6 gap-1" role="tablist" aria-label="表示切替">
            {(Object.keys(VIEW_LABEL) as NoteView[]).map((v) => (
              <button
                key={v}
                aria-label={VIEW_LABEL[v].label}
                className={`flex flex-col items-center rounded-lg border py-1 text-[10px] ${view === v ? "border-amber-500 bg-amber-50 font-bold" : "border-stone-200 bg-white text-stone-600"}`}
                onClick={() => { setView(v); setFolder(null); }}
              >
                <span className="text-base leading-none">{VIEW_LABEL[v].icon}</span>{VIEW_LABEL[v].label}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-stone-500">{(Object.keys(STATUS_ICON) as NoteStatus[]).map((k) => `${STATUS_ICON[k].icon}${STATUS_ICON[k].label}`).join(" ")}</p>
          {items.length === 0 && <p className="text-sm text-stone-500">まだ何もない。</p>}
          {query || view === "name" ? (
            found.map((it) => <NoteCard key={it.key} item={it} onOpen={() => setOpenKey(it.key)} />)
          ) : folder ? (
            <>
              <button className="text-sm text-stone-500 underline" onClick={() => setFolder(null)}>← {VIEW_LABEL[view].icon}{VIEW_LABEL[view].label}</button>
              <div className="text-sm font-semibold">📂 {folder}（{inFolder.length}）</div>
              {inFolder.map((it) => <NoteCard key={it.key} item={it} onOpen={() => setOpenKey(it.key)} />)}
            </>
          ) : (
            groups.map((g) => (
              <button key={g.folder} className="card flex w-full items-center justify-between py-2.5 text-left" data-folder={g.folder} onClick={() => setFolder(g.folder)}>
                <span className="text-sm font-semibold">📂 {g.folder}</span>
                <span className="text-xs text-stone-500">{g.items.length}品 ›</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
