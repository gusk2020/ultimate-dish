import { useState } from "react";
import type { CodexEntry } from "../types/codex";
import { itemInfo } from "../data/items";
import { METHOD_MAP } from "../data/methods";
import { childrenOf, codexEntries } from "../game/codex/codex";
import { useGame } from "../state/GameContext";

// 図鑑 (Phase 11): a separate viewing / replay mode. Nothing here changes the game — the actions
// (cook, eat, sell, review, publish) live in the notebook.

function Record({ e, onBack }: { e: CodexEntry; onBack: () => void }) {
  const { state } = useGame();
  const w = state.world;
  const kids = childrenOf(w, e.key);
  return (
    <div className="space-y-3 p-4" data-testid="codex-record">
      <button className="text-sm text-stone-500 underline" onClick={onBack}>← 図鑑</button>
      <div className="card space-y-1 text-sm">
        <div className="flex items-center gap-3">
          <span className="flex h-16 w-16 items-center justify-center rounded-xl bg-stone-100 text-4xl">{e.emoji}</span>
          <div>
            <div className="text-lg font-bold">{e.name}</div>
            <div className="text-xs text-stone-500">最高 {e.bestRank}・{e.bestTotal}点</div>
          </div>
        </div>
        <div className="text-xs">作った {e.timesCooked}回{e.firstCookedDay ? `（初 ${e.firstCookedDay}日目）` : ""}・食べた {e.timesEaten}回{e.firstEatenDay ? `（初 ${e.firstEatenDay}日目）` : ""}</div>
        <div className="text-xs">食材：{e.ingredientIds.map((id) => itemInfo(id)?.name ?? id).join("・") || "—"}／技法：{e.methodIds.map((m) => METHOD_MAP[m]?.name ?? m).join("・") || "—"}</div>
        {(e.parentKeys.length > 0 || kids.length > 0) && <div className="text-xs">系譜：{e.parentKeys.map((k) => w.codex?.[k]?.name ?? k).join("・") || "—"} → この料理 → {kids.map((k) => k.name).join("・") || "—"}</div>}
      </div>
      <div className="card space-y-1 text-sm">
        <div className="font-semibold">🕰 出来事</div>
        {(e.events ?? []).length === 0 && <p className="text-xs text-stone-500">記録された出来事はまだない</p>}
        {(e.events ?? []).map((ev, i) => <div key={i} className="text-xs"><span className="text-stone-500">{ev.day}日目</span>　{ev.text}</div>)}
      </div>
      <div className="card space-y-1 text-sm">
        <div className="font-semibold">📝 食レポ</div>
        {e.ownReport ? <p className="text-xs">自分：{e.ownReport.score}点「{e.ownReport.text}」</p> : <p className="text-xs text-stone-500">自分の食レポはない</p>}
        {e.reviews.map((r, i) => (
          <p key={i} className="text-xs">{r.reviewerName}（{r.context}）：{r.score}点「{r.impression}」</p>
        ))}
      </div>
    </div>
  );
}

export function CodexGallery() {
  const { state } = useGame();
  const [open, setOpen] = useState<string | null>(null);
  const entries = codexEntries(state.world);
  const e = entries.find((x) => x.key === open);
  if (e) return <Record e={e} onBack={() => setOpen(null)} />;
  return (
    <div className="space-y-2 p-4">
      <p className="text-xs text-stone-500">図鑑は鑑賞と追体験のための記録。作る・食べるなどの行動はノートから。</p>
      {entries.length === 0 && <p className="text-sm text-stone-500">まだ記録はない。</p>}
      <div className="grid grid-cols-3 gap-2">
        {entries.map((x) => (
          <button key={x.key} className="card flex flex-col items-center gap-0.5 p-2 text-center" onClick={() => setOpen(x.key)} data-codex-card={x.name}>
            <span className="text-3xl">{x.emoji}</span>
            <span className="line-clamp-2 text-[11px] font-semibold leading-tight">{x.name}</span>
            <span className="text-[10px] text-stone-500">{x.bestRank}・{x.timesCooked + x.timesEaten}回</span>
          </button>
        ))}
      </div>
      {entries.length > 0 && <p className="text-[10px] text-stone-400">料理を選ぶと「この料理の記録」を見られる</p>}
    </div>
  );
}
