import { useState } from "react";
import { RECIPES, SALES_TAG_LABEL, type RecipeDef, type SalesTag } from "../data/recipes";
import { DERIVATION_MIN_COOKS, DERIVATION_MIN_MASTERY, DERIVATION_RULE_MAP } from "../data/derivations";
import { itemInfo } from "../data/items";
import { TOOL_MAP } from "../data/magic";
import type { DerivationIdea, LearningEvent, RecipeSource } from "../types/learning";
import {
  adoptIdea, allRecipes, checkRequirements, describeMasteryEffects, dismissIdea, getRecipe, masteryStage,
  nameSuggestions, recipeStatus,
} from "../game/learning/recipeBook";
import { formatDays } from "../game/process/simulate";
import type { World } from "../game/world";
import { useGame } from "../state/GameContext";

// レシピ帳 UI: compact cards in the list, numbers and conditions in the detail.

const SOURCE_LABEL: Record<RecipeSource, string> = {
  start: "最初から知っている",
  npc: "村の人に教わった",
  book: "書庫の記録で見つけた",
  battle: "勝負の報酬で知った",
  derived: "自分で派生させた",
  region: "旅先で教わった",
};

const STAGE_STYLE = ["bg-stone-100 text-stone-700", "bg-sky-100 text-sky-800", "bg-violet-100 text-violet-800", "bg-amber-200 text-amber-900"];

const lineText = (r: RecipeDef) => r.ingredients.concat(r.seasonings).map((l) => `${itemInfo(l.itemId)?.emoji ?? ""}${itemInfo(l.itemId)?.name ?? l.itemId}${l.amount}`).join(" ");

export function parentNames(w: Pick<World, "customRecipes">, r: RecipeDef): string {
  return (r.parentRecipeIds ?? []).map((id) => getRecipe(w, id)?.name ?? id).join("・");
}

function StatusChip({ w, id }: { w: World; id: string }) {
  const s = recipeStatus(w, id);
  const p = w.recipeBook[id];
  if (s === "mastered" && p) {
    const st = masteryStage(p.mastery);
    return <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${STAGE_STYLE[st.index]}`}>{st.name} {Math.floor(p.mastery)}</span>;
  }
  if (s === "trialAvailable") return <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">試作可能</span>;
  return <span className="shrink-0 rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-800">条件未達</span>;
}

function RecipeCard({ w, r, onPick }: { w: World; r: RecipeDef; onPick: (id: string) => void }) {
  return (
    <button className="card w-full text-left active:bg-stone-50" onClick={() => onPick(r.id)}>
      <div className="flex items-start justify-between gap-2">
        <span className="min-w-0 font-bold">{r.name}</span>
        <StatusChip w={w} id={r.id} />
      </div>
      {r.custom && <div className="text-[11px] text-violet-700">✍️ 自作・{parentNames(w, r)}から派生</div>}
      <div className="truncate text-xs text-stone-600">{lineText(r)}（1食分）</div>
      <div className="mt-1 flex flex-wrap items-center gap-1">
        <span className="text-[11px] text-stone-500">難度{"★".repeat(r.difficulty)}</span>
        {r.salesTags.map((t) => <span key={t} className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px]">{SALES_TAG_LABEL[t as SalesTag]}</span>)}
      </div>
    </button>
  );
}

/** The kitchen's recipe list: ideas, mastered, discovered, and how many are still unknown. */
export function RecipeBookList({ onPick, onIdea, schoolName }: { onPick: (id: string) => void; onIdea: (id: string) => void; schoolName: string }) {
  const { state } = useGame();
  const w = state.world;
  const book = allRecipes(w).filter((r) => w.recipeBook[r.id]);
  const mastered = book.filter((r) => w.recipeBook[r.id].state === "mastered");
  const known = book.filter((r) => w.recipeBook[r.id].state === "known");
  const unknown = RECIPES.filter((r) => !w.recipeBook[r.id]).length;
  return (
    <div className="space-y-2">
      <div className="flex justify-between gap-2 text-xs text-stone-500">
        <span className="min-w-0">📕 レシピ帳（{schoolName}）</span>
        <span className="shrink-0 tabular-nums">習得{mastered.length}・発見{known.length}・未知{unknown}</span>
      </div>
      {w.derivationIdeas.map((idea) => {
        const rule = DERIVATION_RULE_MAP[idea.ruleId];
        return (
          <button key={idea.id} className="card w-full border-amber-400 bg-amber-50 text-left" onClick={() => onIdea(idea.id)}>
            <div className="text-sm font-bold">💡 派生の着想：{getRecipe(w, idea.baseRecipeId)?.name}・{rule.label}</div>
            <div className="text-xs text-stone-600">{rule.because}から。タップして確認</div>
          </button>
        );
      })}
      {mastered.map((r) => <RecipeCard key={r.id} w={w} r={r} onPick={onPick} />)}
      {known.length > 0 && <div className="pt-1 text-xs font-semibold text-stone-500">発見済み（試作に成功すると習得）</div>}
      {known.map((r) => <RecipeCard key={r.id} w={w} r={r} onPick={onPick} />)}
      {unknown > 0 && (
        <div className="rounded-xl border border-dashed border-stone-300 p-2 text-center text-xs text-stone-500">
          ❔ 未知のレシピ あと{unknown}品<br />村の人・書庫・料理勝負・旅先で見つかることがある
        </div>
      )}
    </div>
  );
}

/** Detail block for the plan screen: status, source, mastery numbers, next effect, requirements. */
export function RecipeInfo({ w, id }: { w: World; id: string }) {
  const r = getRecipe(w, id);
  const p = w.recipeBook[id];
  if (!r || !p) return null;
  const status = recipeStatus(w, id);
  const req = checkRequirements(w, r);
  const st = masteryStage(p.mastery);
  return (
    <div className="space-y-1.5 text-xs">
      <div className="flex flex-wrap items-center gap-1.5">
        <StatusChip w={w} id={id} />
        <span className="text-stone-500">{SOURCE_LABEL[p.source]}</span>
      </div>
      {r.custom && (
        <div className="rounded-lg bg-violet-50 p-2">
          <div className="font-semibold text-violet-800">✍️ {parentNames(w, r)}から派生</div>
          {r.description && <div>説明：{r.description}</div>}
          {r.origin && <div>由来：{r.origin}</div>}
        </div>
      )}
      {r.lore && <p className="text-stone-600">{r.lore}</p>}
      {status === "mastered" ? (
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="shrink-0">熟練度</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-stone-200">
              <div className="h-full bg-amber-500" style={{ width: `${Math.min(100, p.mastery)}%` }} />
            </div>
            <span className="shrink-0 font-semibold tabular-nums">{p.mastery.toFixed(1)}/100</span>
          </div>
          <div className="text-stone-600">段階「{st.name}」・調理{p.timesCooked}回</div>
          <div className="text-stone-600">今の効果：{describeMasteryEffects(p.mastery)}</div>
          <div className="text-stone-600">
            {st.next !== null ? `次の段階（${st.next}）：${describeMasteryEffects(st.next)}` : "最高段階に達している"}
          </div>
          {p.timesCooked < DERIVATION_MIN_COOKS || p.mastery < DERIVATION_MIN_MASTERY ? (
            <div className="text-stone-500">派生の着想：調理{DERIVATION_MIN_COOKS}回・熟練度{DERIVATION_MIN_MASTERY}以上で、作り方の積み重ねから生まれる</div>
          ) : (
            <div className="text-stone-500">派生の着想：使った道具・流派・仕上げ・大成功の積み重ねから生まれる</div>
          )}
        </div>
      ) : (
        <div className="space-y-0.5">
          <div className="font-semibold">試作の条件</div>
          <ul>
            {req.checks.map((c) => (
              <li key={c.label} className={c.ok ? "text-emerald-700" : "text-rose-700"}>
                {c.ok ? "✓" : "✗"} {c.label}（今：{c.have}）
              </li>
            ))}
          </ul>
          <div className="text-stone-500">試作で失敗が残らず仕上がれば習得。失敗しても知識は残る{p.failedTrials > 0 && `（試作失敗${p.failedTrials}回）`}</div>
        </div>
      )}
    </div>
  );
}

/** Result of one cook in terms of the recipe book (shown on the done screen). */
export function LearningResult({ name, event, onIdea }: { name: string; event: LearningEvent; onIdea: () => void }) {
  const st = masteryStage(event.masteryAfter);
  return (
    <div className="card space-y-1 text-sm">
      {event.mastered && <div className="font-bold text-emerald-700">🎉 レシピを習得した！「{name}」</div>}
      {event.trialFailed && <div className="font-semibold text-rose-700">🧪 試作は失敗…レシピの知識は残る。もう一度試作できる</div>}
      {!event.trialFailed && (
        <div className="text-xs">
          熟練度 <span className="tabular-nums">{event.masteryBefore.toFixed(1)} → <b>{event.masteryAfter.toFixed(1)}</b></span>（{st.name}）
        </div>
      )}
      {event.stageUp && <div className="text-xs font-semibold text-violet-700">⬆ 熟練段階が「{event.stageUp}」に上がった</div>}
      {event.newIdeas.length > 0 && (
        <>
          <div className="font-semibold text-amber-700">💡 新しい派生レシピの着想を得た（{event.newIdeas.map((i) => DERIVATION_RULE_MAP[i.ruleId].label).join("・")}）</div>
          <button className="btn-secondary w-full text-sm" onClick={onIdea}>着想を確認する</button>
        </>
      )}
    </div>
  );
}

/** What the derived recipe changes compared with its base, as short lines. */
function ideaDiff(base: RecipeDef, idea: DerivationIdea): string[] {
  const d = { ...base, ...DERIVATION_RULE_MAP[idea.ruleId].apply(base) };
  const out: string[] = [];
  for (const key of ["ingredients", "seasonings"] as const) {
    for (const l of d[key]) {
      const b = base[key].find((x) => x.itemId === l.itemId);
      if (!b || b.amount !== l.amount) out.push(`${itemInfo(l.itemId)?.emoji ?? ""}${itemInfo(l.itemId)?.name ?? l.itemId} ${b ? `${b.amount}→` : "追加 "}${l.amount}`);
    }
  }
  if (d.baseTimeDays !== base.baseTimeDays) out.push(`時間 ${formatDays(base.baseTimeDays)}→${formatDays(d.baseTimeDays)}`);
  if (d.baseStamina !== base.baseStamina) out.push(`体力 ${base.baseStamina}→${d.baseStamina}`);
  if (d.toolCompat[0] !== base.toolCompat[0]) out.push(`${TOOL_MAP[d.toolCompat[0]]?.name ?? d.toolCompat[0]}前提`);
  for (const t of d.salesTags) if (!base.salesTags.includes(t)) out.push(`売り：${SALES_TAG_LABEL[t as SalesTag]}`);
  return out;
}

/** 派生の着想 → the player decides whether to keep it, and names it. */
export function IdeaAdopt({ ideaId, onClose, onAdopted }: { ideaId: string; onClose: () => void; onAdopted: (recipeId: string) => void }) {
  const { state, dispatch } = useGame();
  const w = state.world;
  const idea = w.derivationIdeas.find((i) => i.id === ideaId);
  const base = idea && getRecipe(w, idea.baseRecipeId);
  const names = idea && base ? nameSuggestions(w, idea) : [];
  const [name, setName] = useState(names[0] ?? "");
  const [description, setDescription] = useState("");
  const [origin, setOrigin] = useState("");
  const [msg, setMsg] = useState("");
  if (!idea || !base) {
    return (
      <div className="space-y-2">
        <p className="text-sm">この着想はもう残っていない。</p>
        <button className="btn-secondary w-full" onClick={onClose}>レシピ帳へ</button>
      </div>
    );
  }
  const rule = DERIVATION_RULE_MAP[idea.ruleId];
  const adopt = () => {
    const r = adoptIdea(w, idea.id, { name, description, origin });
    if (typeof r === "string") return setMsg(r);
    dispatch({ type: "setWorld", world: r.world });
    onAdopted(r.recipe.id);
  };
  return (
    <div className="space-y-3">
      <button className="text-sm text-stone-500 underline" onClick={onClose}>← レシピ帳</button>
      <div className="card space-y-1.5 text-sm">
        <h2 className="section-title mb-0">💡 派生の着想</h2>
        <div>元のレシピ：<b>{base.name}</b></div>
        <div>方向：<b>{rule.label}</b>（{rule.because}）</div>
        <div className="text-xs text-stone-600">{rule.change}</div>
        <ul className="flex flex-wrap gap-1">
          {ideaDiff(base, idea).map((t) => <li key={t} className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px]">{t}</li>)}
        </ul>
        <p className="text-[11px] text-stone-500">残すと、自作レシピとしてレシピ帳に載る（習得済み・熟練0から）。</p>
      </div>
      <div className="card space-y-2">
        <div className="text-xs text-stone-500">名前の候補</div>
        <div className="flex flex-wrap gap-1.5">
          {names.map((n) => (
            <button key={n} className={`chip min-h-10 px-3 text-sm ${name === n ? "chip-on" : ""}`} onClick={() => setName(n)}>{n}</button>
          ))}
        </div>
        <label className="block text-xs text-stone-500">
          レシピ名（自由に変更できる）
          <input aria-label="レシピ名" className="mt-0.5 w-full rounded-lg border border-stone-300 p-2 text-base text-stone-900" maxLength={30} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="block text-xs text-stone-500">
          説明（任意）
          <textarea aria-label="説明" className="mt-0.5 w-full rounded-lg border border-stone-300 p-2 text-base text-stone-900" rows={2} maxLength={200} value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <label className="block text-xs text-stone-500">
          由来（任意）
          <textarea aria-label="由来" className="mt-0.5 w-full rounded-lg border border-stone-300 p-2 text-base text-stone-900" rows={2} maxLength={200} value={origin} onChange={(e) => setOrigin(e.target.value)} />
        </label>
        {msg && <p className="text-xs text-red-700">{msg}</p>}
        <button className="btn-primary w-full py-3" onClick={adopt}>✍️ この派生をレシピとして残す</button>
        <div className="grid grid-cols-2 gap-2">
          <button className="btn-secondary" onClick={onClose}>あとで</button>
          <button className="btn-secondary" onClick={() => { dispatch({ type: "setWorld", world: dismissIdea(w, idea.id) }); onClose(); }}>見送る</button>
        </div>
      </div>
    </div>
  );
}
