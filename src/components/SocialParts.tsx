import { useState } from "react";
import { LEAN_LABEL } from "../data/companions";
import { RECIPE_MAP } from "../data/recipes";
import { FACILITIES } from "../data/facilities";
import type { CharacterDef, FoodMemory, Relationship } from "../types/social";
import type { CoopResult } from "../game/social/coop";
import { describePalate } from "../game/eating/profile";
import { tasteDish } from "../game/eating/tasting";
import { STAT_LABEL } from "../game/chef/stats";
import {
  getCharacter, hasCompanion, line, perceivedForm, personalityWords,
} from "../game/social/companion";
import { allyStatus, ALLY_STATUS_LABEL, joinChecks, partyMembers, talkTo } from "../game/social/allies";
import { shareMeal, type MealOutcome } from "../game/social/meals";
import { getRelation, PLAYER, relationStage, relationTendency } from "../game/social/relations";
import { tastingReporter } from "../services/tastingReport";
import type { World } from "../game/world";
import { useGame } from "../state/GameContext";

// 仲間・相棒 UI. Compact by default (stage names), numbers on the detail view.

const MEMORY_KIND = { firstDish: "初めての一皿", meal: "食事", sharedMeal: "みんなで食べた", cookTogether: "一緒に作った" };
const signed = (v: number | undefined) => (v ? `${v > 0 ? "+" : "−"}${Math.abs(Math.round(v * 10) / 10)}` : "±0");

export function nameOf(w: World, id: string): string {
  return id === PLAYER ? "あなた" : getCharacter(w, id)?.name ?? id;
}
function emojiOf(w: World, id: string): string {
  return id === PLAYER ? "🧑‍🍳" : getCharacter(w, id)?.emoji ?? "🙂";
}

/** 段階・傾向 in one short line. */
export function RelationLine({ r }: { r: Relationship | undefined }) {
  if (!r) return <span className="text-xs text-stone-500">まだ関わりがない</span>;
  return (
    <span className="text-xs text-stone-600">
      {relationStage(r).name}・{relationTendency(r).label}
    </span>
  );
}

function strengths(c: CharacterDef): string {
  return (Object.entries(c.chef.stats) as [keyof typeof STAT_LABEL, number][])
    .sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k]) => STAT_LABEL[k]).join("・");
}

function Profile({ c }: { c: CharacterDef }) {
  const { likes, dislikes } = describePalate(c.eater);
  return (
    <div className="space-y-0.5 text-xs text-stone-700">
      <div>性格：{personalityWords(c.personality).join("・") || "穏やか"}／{LEAN_LABEL[c.lean]}寄り</div>
      <div>好み：{likes.join("・") || "なんでも"}{dislikes.length > 0 && `／苦手：${dislikes.join("・")}`}</div>
      <div>得意：{c.specialties.map((s) => s.label).join("・")}（強み：{strengths(c)}）</div>
      <div>主担当で作れる：{c.signatureRecipeIds.map((id) => RECIPE_MAP[id]?.name ?? id).join("、")}</div>
      {c.lowMagicAppearance && (
        <>
          <div>あなたには：{perceivedForm(c, "player")}（{c.trueNature}）</div>
          <div className="text-stone-500">魔力の低い人には：{c.lowMagicAppearance.label}にしか見えない</div>
        </>
      )}
    </div>
  );
}

// ---------- Talk ----------

export function TalkButton({ id, onText }: { id: string; onText: (t: string) => void }) {
  const { state, dispatch } = useGame();
  return (
    <button
      className="btn-secondary px-1 text-sm"
      onClick={() => {
        const r = talkTo(state.world, id);
        if (typeof r === "string") return onText(r);
        dispatch({ type: "setWorld", world: r.world });
        onText(`「${r.text}」${r.stageUp ? `　⬆ 関係が「${r.stageUp}」になった` : ""}`);
      }}
    >
      💬 話す
    </button>
  );
}

// ---------- Share a meal ----------

/** ふるまう: pick a dish and who eats it. Each eater reacts in their own way. */
export function ShareMealPanel({ initialEaters, stockId: fixedStock, onClose }: { initialEaters: string[]; stockId?: string; onClose: () => void }) {
  const { state, dispatch } = useGame();
  const w = state.world;
  const [stockId, setStockId] = useState<string | null>(fixedStock ?? w.dishStock[w.dishStock.length - 1]?.id ?? null);
  const [eaters, setEaters] = useState<string[]>(initialEaters);
  const [out, setOut] = useState<MealOutcome | null>(null);
  const [msg, setMsg] = useState("");
  const stock = w.dishStock.find((s) => s.id === stockId);
  const dish = state.dishes.find((d) => d.id === stock?.dishId);
  const options = [
    ...(hasCompanion(w) ? [w.social.companion!.id] : []),
    ...partyMembers(w).filter((c) => c.kind === "ally").map((c) => c.id),
    ...Object.values(w.social.relations).flatMap((r) => [r.a, r.b]).filter((id) => id !== PLAYER && getCharacter(w, id)?.kind === "ally"),
    ...initialEaters,
  ];
  const choices = [...new Set([...options, PLAYER])];
  const first = eaters.find((id) => id !== PLAYER);
  const firstChar = first ? getCharacter(w, first) : undefined;

  if (out) {
    const playerAte = out.reactions.some((r) => r.id === PLAYER);
    const mine = !playerAte && w.palate && dish ? tasteDish(dish, w.palate).score : null;
    return (
      <div className="card space-y-2 text-sm">
        <div className="font-semibold">🍽 {dish?.name}</div>
        {out.reactions.map((r) => (
          <div key={r.id} className="rounded-lg bg-stone-50 p-2">
            <div className="flex justify-between font-semibold"><span>{r.emoji}{r.name}</span><span className="tabular-nums">{r.tasting.score}点</span></div>
            {r.reaction && <div className="text-xs">{r.reaction}</div>}
            {r.id !== PLAYER && dish && (
              <div className="text-[11px] text-stone-500">{tastingReporter.brief({ dishName: dish.name, eater: getCharacter(w, r.id)!.eater, result: r.tasting })}</div>
            )}
          </div>
        ))}
        {mine !== null && <div className="text-xs text-stone-600">あなたの好みなら {mine}点 ― 同じ皿でも感じ方が違う</div>}
        {Object.entries(out.deltas).map(([id, d]) => (
          <div key={id} className="text-xs">{emojiOf(w, id)}{nameOf(w, id)}との関係：好感{signed(d.affection)}・信頼{signed(d.trust)}・食の相性{signed(d.foodCompatibility)}{d.conflicts ? `・わだかまり${signed(d.conflicts)}` : ""}</div>
        ))}
        {out.memories > 0 && <div className="text-xs text-amber-800">📔 食の記憶に残った</div>}
        {out.stageUps.map((s) => (
          <div key={s.id} className="text-xs font-semibold text-violet-700">⬆ {nameOf(w, s.id)}との関係が「{s.stage}」に{s.text && `　「${s.text}」`}</div>
        ))}
        <button className="btn-secondary w-full" onClick={onClose}>閉じる</button>
      </div>
    );
  }

  return (
    <div className="card space-y-2 text-sm">
      <div className="font-semibold">🍽 料理をふるまう</div>
      {firstChar?.dialogue.beforeMeal && <p className="rounded-lg bg-stone-100 p-1.5 text-xs">{firstChar.emoji}「{line(firstChar, "beforeMeal")}」</p>}
      {!fixedStock && (
        w.dishStock.length === 0 ? <p className="text-xs text-stone-500">ふるまえる料理がない。厨房で作ろう。</p> : (
          <div className="flex flex-wrap gap-1.5">
            {w.dishStock.map((s) => (
              <button key={s.id} className={`chip min-h-10 px-2 text-xs ${stockId === s.id ? "chip-on" : ""}`} onClick={() => setStockId(s.id)}>{s.name}（{s.portions}食）</button>
            ))}
          </div>
        )
      )}
      <div className="text-xs text-stone-500">食べる人（1人1食）</div>
      <div className="flex flex-wrap gap-1.5">
        {choices.map((id) => (
          <button key={id} className={`chip min-h-10 px-2 text-xs ${eaters.includes(id) ? "chip-on" : ""}`} onClick={() => setEaters(eaters.includes(id) ? eaters.filter((x) => x !== id) : [...eaters, id])}>
            {emojiOf(w, id)}{nameOf(w, id)}
          </button>
        ))}
      </div>
      {msg && <p className="text-xs text-red-700">{msg}</p>}
      <div className="grid grid-cols-2 gap-2">
        <button className="btn-secondary" onClick={onClose}>やめる</button>
        <button
          className="btn-primary"
          disabled={!stock || !dish || eaters.length === 0}
          onClick={() => {
            const r = shareMeal(w, { stockId: stock!.id, dish: dish!, eaterIds: eaters });
            if (typeof r === "string") return setMsg(r);
            dispatch({ type: "setWorld", world: r.world });
            setOut(r);
          }}
        >
          🍴 食べてもらう
        </button>
      </div>
    </div>
  );
}

// ---------- Detail ----------

function MemoryList({ memories, w }: { memories: FoodMemory[]; w: World }) {
  if (!memories.length) return <div className="text-xs text-stone-500">まだ食の記憶はない</div>;
  return (
    <ul className="space-y-1">
      {memories.map((m) => (
        <li key={m.id} className="rounded-lg bg-amber-50 p-1.5 text-xs">
          <div className="font-semibold">{m.day}日目・{m.dishName}<span className="ml-1 font-normal text-stone-500">{MEMORY_KIND[m.kind]}</span></div>
          <div className="text-stone-600">作った人：{m.cookedBy.map((id) => nameOf(w, id)).join("・")}{m.sharedWith.length > 2 && `／一緒に：${m.sharedWith.map((id) => nameOf(w, id)).join("・")}`}</div>
          {m.reaction && <div>{m.reaction}</div>}
        </li>
      ))}
    </ul>
  );
}

/** One pair, in numbers. */
export function RelationDetail({ a, b, onBack }: { a: string; b: string; onBack: () => void }) {
  const { state } = useGame();
  const w = state.world;
  const r = getRelation(w, a, b);
  const other = a === PLAYER ? b : a;
  const c = getCharacter(w, other);
  const ally = c?.kind === "ally" && a === PLAYER;
  const checks = ally ? joinChecks(w, other, { clearedQuestIds: state.clearedQuestIds }) : null;
  const t = r ? relationTendency(r) : null;
  return (
    <div className="space-y-2">
      <button className="text-sm text-stone-500 underline" onClick={onBack}>← 仲間</button>
      <div className="card space-y-1.5">
        <h2 className="section-title mb-0">{emojiOf(w, a)}{nameOf(w, a)} ⇄ {emojiOf(w, b)}{nameOf(w, b)}</h2>
        {c && a === PLAYER && <div className="text-xs text-stone-600">{c.kind === "companion" ? "✨ 特殊相棒" : `${ALLY_STATUS_LABEL[allyStatus(w, other, { clearedQuestIds: state.clearedQuestIds })]}`}・{c.role}</div>}
        {r ? (
          <>
            <div className="grid grid-cols-2 gap-x-3 text-sm tabular-nums">
              <div>好感 {Math.floor(r.affection)}</div>
              <div>信頼 {Math.floor(r.trust)}</div>
              <div>食の相性 {Math.floor(r.foodCompatibility)}</div>
              <div>わだかまり {Math.floor(r.conflicts)}</div>
            </div>
            <div className="text-xs text-stone-600">段階「{relationStage(r).name}」・傾向「{t!.label}」・一緒に食べた{r.sharedMeals}回・一緒に作った{r.cookedTogether}回{r.traveledTogether > 0 && `・一緒に旅した${r.traveledTogether}回`}</div>
          </>
        ) : <div className="text-xs text-stone-500">まだ関わりがない</div>}
        {c && a === PLAYER && <Profile c={c} />}
      </div>
      {checks && (
        <div className="card text-xs">
          <div className="font-semibold">仲間になる条件</div>
          <ul>{checks.checks.map((x) => <li key={x.label} className={x.ok ? "text-emerald-700" : "text-rose-700"}>{x.ok ? "✓" : "✗"} {x.label}（今：{x.have}）</li>)}</ul>
        </div>
      )}
      <div className="card space-y-1">
        <div className="text-sm font-semibold">📔 印象的な食の記憶</div>
        <MemoryList memories={r?.memories ?? []} w={w} />
      </div>
    </div>
  );
}

// ---------- Cooperative result ----------

export function CoopResultView({ coop }: { coop: CoopResult }) {
  const { state } = useGame();
  const w = state.world;
  return (
    <div className="card space-y-1 text-sm">
      <div className={`font-semibold ${coop.succeeded ? "text-emerald-700" : "text-rose-700"}`}>🤝 共同料理 {coop.succeeded ? "成功" : "失敗"}</div>
      {coop.lines.map((l) => <div key={l.id} className="text-xs">{l.emoji}{l.name}「{l.text}」</div>)}
      {coop.deltas.map((d) => (
        <div key={d.pair} className="text-[11px] text-stone-600">{d.names}：信頼{signed(d.delta.trust)}・好感{signed(d.delta.affection)}・わだかまり{signed(d.delta.conflicts)}</div>
      ))}
      {coop.stageUps.map((s) => <div key={s.id} className="text-xs font-semibold text-violet-700">⬆ {nameOf(w, s.id)}との関係が「{s.stage}」に{s.text && `　「${s.text}」`}</div>)}
    </div>
  );
}

export function facilityName(id?: string): string {
  return FACILITIES.find((f) => f.id === id)?.name ?? "村";
}
