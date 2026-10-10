import { useState } from "react";
import type { Rank } from "../types";
import type { CodexEntry, ThirdPartyReview } from "../types/codex";
import { FOOD_FIGHTERS } from "../data/fighters";
import { itemInfo } from "../data/items";
import { METHOD_MAP } from "../data/methods";
import { SALES_TAG_LABEL } from "../data/recipes";
import { childrenOf, codexEntries, codexSteps, KNOWLEDGE_JA, notebook } from "../game/codex/codex";
import { hireTaster } from "../game/codex/reviews";
import { promote, promotionBlock, publicScore, publish, PUBLISH_FEE, ranking, STAGE_INFO } from "../game/codex/publicRegistry";
import { useGame } from "../state/GameContext";
import { RankBadge } from "./DishParts";

const SOURCE_JA: Record<ThirdPartyReview["source"], string> = { questJudge: "勝負の審査員", hiredTaster: "雇った食べ手", guildReview: "ギルド審査", publicReview: "公開審査" };
const NOTE_SOURCE: Record<string, string> = { start: "最初から", npc: "人から聞いた", book: "本で読んだ", battle: "勝負で知った", derived: "自分で派生", region: "旅先で知った" };

export function NotebookTab() {
  const { state } = useGame();
  const rows = notebook(state.world);
  return (
    <div className="space-y-2 p-4">
      <p className="text-xs text-stone-500">ノート：知っているだけの料理も含む、作り方の知識。作ったか・食べたかは別に記録される。</p>
      {rows.map((r) => (
        <div key={r.recipeId} className="card text-sm" data-note={r.recipeId}>
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-semibold">{r.name}</span>
            <span className="shrink-0 rounded bg-stone-100 px-1.5 text-[11px]">{KNOWLEDGE_JA[r.state]}</span>
          </div>
          <div className="text-[11px] text-stone-500">
            {NOTE_SOURCE[r.source] ?? r.source}・{r.cooked ? "作った" : "まだ作っていない"}・{r.tasted ? "食べた" : "まだ食べていない"}
          </div>
          {r.lore && <div className="text-[11px] text-stone-500">{r.lore}</div>}
        </div>
      ))}
    </div>
  );
}

function ReviewCard({ r }: { r: ThirdPartyReview }) {
  return (
    <div className="rounded-lg border border-stone-200 p-2 text-xs">
      <div className="flex justify-between gap-2">
        <span className="font-semibold">{r.reviewerName}（Lv{r.reviewerLevel}・名声{r.reviewerFame}）</span>
        <span className="shrink-0 tabular-nums">{r.score}点</span>
      </div>
      <div className="text-[11px] text-stone-500">{SOURCE_JA[r.source]}・{r.context}・{r.day}日目・重み{r.weight}</div>
      <div>👍 {r.good}</div>
      <div>👎 {r.bad}</div>
      <div>🎯 {r.forWhom}に</div>
      <div className="text-stone-600">「{r.impression}」</div>
    </div>
  );
}

export function CodexDetail({ e }: { e: CodexEntry }) {
  const { state, dispatch } = useGame();
  const w = state.world;
  const [msg, setMsg] = useState("");
  const steps = codexSteps(w, e);
  const kids = childrenOf(w, e.key);
  const stocks = w.dishStock.filter((st) => (e.recipeId ? st.recipeId === e.recipeId : st.name === e.name));
  const stock = stocks[0];
  const dish = stock ? state.dishes.find((d) => d.id === stock.dishId) ?? state.dishes.find((d) => d.id === e.lastDishId) : undefined;
  const pub = (w.publicRegistry ?? []).find((p) => p.id === e.publicId);
  const name = (id: string) => itemInfo(id)?.name ?? id;

  return (
    <div className="mt-2 space-y-2 border-t border-stone-200 pt-2 text-xs">
      <div><span className="text-stone-500">出会い：</span>{e.origin}</div>
      <div><span className="text-stone-500">食材：</span>{e.ingredientIds.map(name).join("・") || "—"}</div>
      <div><span className="text-stone-500">調理法：</span>{e.methodIds.map((m) => METHOD_MAP[m]?.name ?? m).join("・") || "—"}</div>
      <div><span className="text-stone-500">作り方：</span>{steps ? steps.join(" → ") : "詳細不明（食べただけでは作り方は分からない）"}</div>
      <div>
        作った {e.timesCooked}回{e.firstCookedDay ? `（初 ${e.firstCookedDay}日目）` : ""}・食べた {e.timesEaten}回{e.firstEatenDay ? `（初 ${e.firstEatenDay}日目）` : ""}
      </div>
      {(e.parentKeys.length > 0 || kids.length > 0) && (
        <div>系譜：{e.parentKeys.map((k) => w.codex?.[k]?.name ?? k).join("・") || "—"} → この料理 → {kids.map((k) => k.name).join("・") || "—"}</div>
      )}
      <div>
        <div className="font-semibold">自分の食レポ</div>
        {e.ownReport ? <div>{e.ownReport.score}点「{e.ownReport.text}」（{e.ownReport.day}日目）</div> : <div className="text-stone-500">まだ書いていない（食べたあとに記録できる）</div>}
      </div>
      <div className="space-y-1">
        <div className="font-semibold">第三者の食レポ（{e.reviews.length}件）</div>
        {e.reviews.map((r, i) => <ReviewCard key={i} r={r} />)}
      </div>

      <div className="space-y-1 rounded-lg bg-stone-50 p-2">
        <div className="font-semibold">🍴 フードファイターに食レポを頼む</div>
        {!stock || !dish ? (
          <div className="text-stone-500">在庫がない（作り置きがあると1食出して頼める）</div>
        ) : (
          FOOD_FIGHTERS.map((f) => (
            <button
              key={f.id}
              className="btn-secondary w-full text-left text-xs"
              disabled={w.chef.money < f.fee}
              onClick={() => {
                const r = hireTaster(w, stock.id, { ...dish, recipeId: dish.recipeId ?? e.recipeId }, f.id);
                if (typeof r === "string") return setMsg(r);
                dispatch({ type: "setWorld", world: r.world });
                setMsg(`${f.name}が${r.review.score}点の食レポを書いた`);
              }}
            >
              {f.emoji} {f.name}（{f.title}・Lv{f.level}・名声{f.fame}）{f.fee}G
              <span className="block text-[10px] text-stone-500">得意：{f.specialty.map((t) => SALES_TAG_LABEL[t as keyof typeof SALES_TAG_LABEL] ?? t).join("・")}（専門外の評は重み半分）</span>
            </button>
          ))
        )}
      </div>

      <div className="rounded-lg bg-stone-50 p-2">
        <div className="font-semibold">公開</div>
        {pub ? (
          <div>{STAGE_INFO[pub.stage].name}に公開中・公開評価 {publicScore(pub)}</div>
        ) : (
          <button
            className="btn-primary mt-1 w-full text-xs"
            disabled={e.timesCooked < 1}
            onClick={() => {
              const r = publish(w, e.key);
              if (typeof r === "string") return setMsg(r);
              dispatch({ type: "setWorld", world: r.world });
              setMsg("料理ギルドに登録した");
            }}
          >
            🏛️ 料理ギルドに公開する（登録料{PUBLISH_FEE}G）{e.timesCooked < 1 ? "・自分で作った料理のみ" : ""}
          </button>
        )}
      </div>
      {msg && <p className="text-emerald-700">{msg}</p>}
    </div>
  );
}

export function CodexTab() {
  const { state } = useGame();
  const entries = codexEntries(state.world);
  const [open, setOpen] = useState<string | null>(null);
  if (!entries.length) return <p className="p-6 text-center text-sm text-stone-500">まだ何も記録されていない。作るか食べると「私の図鑑」に載る。</p>;
  return (
    <div className="space-y-2 p-4">
      <p className="text-xs text-stone-500">私の図鑑：自分で作った／食べた料理の記録。</p>
      {entries.map((e) => (
        <div key={e.key} className="card" data-codex={e.name}>
          <button className="flex w-full items-center gap-3 text-left" onClick={() => setOpen(open === e.key ? null : e.key)}>
            <span className="text-3xl">{e.emoji}</span>
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold">{e.name}</div>
              <div className="text-[11px] text-stone-500">
                {e.timesCooked > 0 ? "作った" : ""}{e.timesCooked > 0 && e.timesEaten > 0 ? "・" : ""}{e.timesEaten > 0 ? "食べた" : ""}
                {e.reviews.length > 0 && `・食レポ${e.reviews.length}件`}{e.publicId ? "・公開中" : ""}
              </div>
            </div>
            <RankBadge rank={e.bestRank as Rank} size="sm" />
            <span className="w-8 text-right font-bold tabular-nums">{e.bestTotal}</span>
          </button>
          {open === e.key && <CodexDetail e={e} />}
        </div>
      ))}
    </div>
  );
}

export function PublicTab() {
  const { state, dispatch } = useGame();
  const w = state.world;
  const [msg, setMsg] = useState("");
  const mine = w.publicRegistry ?? [];
  const rows = ranking(w);
  return (
    <div className="space-y-3 p-4">
      <div className="card space-y-2 text-sm">
        <h2 className="section-title mb-0">🏛️ 自分の公開料理</h2>
        <p className="text-[11px] text-stone-500">ギルド → 王国 → 地域 → 文明圏 → 世界。公開評価＝料理そのものの点＋第三者の食レポ（名声と専門性で重み付け、1件の影響には上限）。</p>
        {mine.length === 0 && <p className="text-xs text-stone-500">まだ公開していない（私の図鑑から公開できる）</p>}
        {mine.map((r) => {
          const block = promotionBlock(r);
          return (
            <div key={r.id} className="rounded-lg border border-stone-200 p-2 text-xs" data-public={r.name}>
              <div className="flex justify-between gap-2">
                <span className="font-semibold">{r.name}</span>
                <span className="shrink-0">{STAGE_INFO[r.stage].name}</span>
              </div>
              <div>公開評価 {publicScore(r)}（料理 {r.absolute}・食レポ{r.reviews.length}件）・再現 {r.reproductions}回</div>
              {block ? (
                <div className="text-stone-500">次の段階まで：{block}</div>
              ) : (
                <button
                  className="btn-primary mt-1 w-full text-xs"
                  onClick={() => {
                    const out = promote(w, r.id);
                    if (typeof out === "string") return setMsg(out);
                    dispatch({ type: "setWorld", world: out.world });
                    setMsg(`${out.record.name}が${STAGE_INFO[out.record.stage].name}に載った！`);
                  }}
                >
                  ⬆️ 昇格を申請する
                </button>
              )}
            </div>
          );
        })}
        {msg && <p className="text-xs text-emerald-700">{msg}</p>}
      </div>
      <div className="card space-y-1 text-sm">
        <h2 className="section-title mb-0">🏆 公開料理ランキング</h2>
        {rows.map((x, i) => (
          <div key={x.record.id} className={`rounded-lg p-2 text-xs ${x.mine ? "bg-amber-50" : ""}`}>
            <div className="flex justify-between gap-2">
              <span className="font-semibold">{i + 1}. {x.record.name}</span>
              <span className="shrink-0 tabular-nums">{x.score}</span>
            </div>
            <div className="text-[11px] text-stone-500">{x.record.author}・{STAGE_INFO[x.record.stage].short}・食レポ{x.record.reviews.length}件</div>
            {x.representative && <div className="text-[11px] text-stone-600">「{x.representative.impression}」— {x.representative.reviewerName}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
