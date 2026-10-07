import { useEffect, useState } from "react";
import type { Dish, Ingredient, Step, TasteKey } from "../types";
import { CATEGORY_LABEL, INGREDIENTS, MAX_INGREDIENTS } from "../data/ingredients";
import { METHODS } from "../data/methods";
import { SPICES, TOOLS, isUnlocked } from "../data/magic";
import { QUEST_MAP } from "../data/quests";
import { useGame } from "../state/GameContext";
import { completeDish } from "../state/completeDish";
import { DishDetail } from "../components/DishDetail";
import { stepLabel } from "../components/stepLabel";

const MAX_STEPS = 8;
const TASTE_SHORT: Record<TasteKey, string> = {
  sweet: "甘", salty: "塩", sour: "酸", bitter: "苦", umami: "旨", aroma: "香",
};

/** Two strongest traits, so a player can reason about combinations. */
function traits(i: Ingredient): string {
  const t = (Object.entries(i.taste) as [TasteKey, number][]).sort((a, b) => b[1] - a[1]).slice(0, 2);
  const tex = { tender: "柔", chewy: "噛", crisp: "シャキ", soft: "ふわ", firm: "硬" }[i.textureTag];
  return `${t.map(([k]) => TASTE_SHORT[k]).join("")}・${tex}`;
}

export function Kitchen() {
  const { state, dispatch } = useGame();
  const [ingredientIds, setIngredientIds] = useState<string[]>([]);
  const [steps, setSteps] = useState<Step[]>([]);
  const [parentDishId, setParentDishId] = useState<string | null>(null);
  const [result, setResult] = useState<Dish | null>(null);
  const [busy, setBusy] = useState(false);

  // Derive: prefill from an existing dish.
  useEffect(() => {
    if (!state.kitchenSeed) return;
    setIngredientIds(state.kitchenSeed.recipe.ingredientIds);
    setSteps(state.kitchenSeed.recipe.steps);
    setParentDishId(state.kitchenSeed.parentDishId);
    setResult(null);
    dispatch({ type: "consumeSeed" });
  }, [state.kitchenSeed, dispatch]);

  const toggleIngredient = (id: string) =>
    setIngredientIds((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : cur.length < MAX_INGREDIENTS ? [...cur, id] : cur,
    );
  const addStep = (s: Step) => setSteps((cur) => (cur.length < MAX_STEPS ? [...cur, s] : cur));
  const removeStep = (idx: number) => setSteps((cur) => cur.filter((_, i) => i !== idx));
  const moveUp = (idx: number) =>
    setSteps((cur) => {
      if (idx === 0) return cur;
      const next = [...cur];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next;
    });

  const reset = () => {
    setIngredientIds([]);
    setSteps([]);
    setParentDishId(null);
    setResult(null);
  };

  const cook = async () => {
    setBusy(true);
    const dish = await completeDish({ ingredientIds, steps }, parentDishId);
    dispatch({ type: "addDish", dish });
    setResult(dish);
    setBusy(false);
    window.scrollTo({ top: 0 });
  };

  if (result) {
    const current = state.dishes.find((d) => d.id === result.id) ?? result;
    return (
      <div className="space-y-3 p-4">
        <div className="text-center text-sm font-semibold text-emerald-700">✨ 完成！図鑑に登録しました</div>
        <div className="card">
          <DishDetail
            dish={current}
            showMeta={false}
            onRename={(name) => dispatch({ type: "renameDish", id: current.id, name })}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button className="btn-primary" onClick={() => dispatch({ type: "navigate", screen: "quests" })}>
            📜 依頼に出す
          </button>
          <button className="btn-secondary" onClick={() => dispatch({ type: "derive", dish: current })}>
            🌱 改良する
          </button>
          <button className="btn-secondary col-span-2" onClick={reset}>
            新しく作る
          </button>
        </div>
      </div>
    );
  }

  const unlockLabel = (q?: string) => (q ? `${QUEST_MAP[q]?.title}達成で解放` : "");

  return (
    <div className="space-y-4 p-4 pb-28">
      {parentDishId && (
        <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          🌱 派生料理を作成中（元：{state.dishes.find((d) => d.id === parentDishId)?.name ?? parentDishId}）
          <button className="ml-2 underline" onClick={() => setParentDishId(null)}>
            解除
          </button>
        </div>
      )}

      <section className="card">
        <h2 className="section-title">
          1. 素材を選ぶ <span className="text-sm font-normal text-stone-500">{ingredientIds.length}/{MAX_INGREDIENTS}</span>
        </h2>
        {(["animal", "plant", "dairy"] as const).map((cat) => (
          <div key={cat} className="mb-2">
            <div className="mb-1 text-xs text-stone-500">{CATEGORY_LABEL[cat]}</div>
            <div className="grid grid-cols-3 gap-1.5">
              {INGREDIENTS.filter((i) => i.category === cat).map((i) => {
                const on = ingredientIds.includes(i.id);
                return (
                  <button
                    key={i.id}
                    onClick={() => toggleIngredient(i.id)}
                    className={`chip ${on ? "chip-on" : ""}`}
                    aria-pressed={on}
                  >
                    <span className="text-base leading-none">{i.emoji}</span>
                    <span className="text-[13px] leading-tight">{i.name}</span>
                    <span className="text-[10px] text-stone-500">{traits(i)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </section>

      <section className="card">
        <h2 className="section-title">
          2. 工程 <span className="text-sm font-normal text-stone-500">{steps.length}/{MAX_STEPS}</span>
        </h2>
        {steps.length === 0 ? (
          <p className="mb-2 text-sm text-stone-500">下のボタンで工程を順番に追加</p>
        ) : (
          <ol className="mb-3 space-y-1">
            {steps.map((s, idx) => (
              <li key={idx} className="flex items-center gap-2 rounded-lg bg-stone-100 px-2 py-1.5 text-sm">
                <span className="w-5 text-stone-500 tabular-nums">{idx + 1}.</span>
                <span className="flex-1">{stepLabel(s)}</span>
                <button className="icon-btn" onClick={() => moveUp(idx)} aria-label="上へ" disabled={idx === 0}>
                  ↑
                </button>
                <button className="icon-btn" onClick={() => removeStep(idx)} aria-label="削除">
                  ✕
                </button>
              </li>
            ))}
          </ol>
        )}

        <div className="mb-1 text-xs text-stone-500">調理法</div>
        <div className="mb-3 grid grid-cols-2 gap-1.5">
          {METHODS.map((m) => (
            <button key={m.id} className="chip items-start text-left" onClick={() => addStep({ kind: "method", id: m.id })}>
              <span className="text-sm font-semibold">{m.name}</span>
              <span className="text-[10px] leading-tight text-stone-500">{m.hint}</span>
            </button>
          ))}
        </div>

        <div className="mb-1 text-xs text-stone-500">異世界スパイス（入れた時点で効く）</div>
        <div className="mb-3 grid grid-cols-2 gap-1.5">
          {SPICES.map((s) => {
            const open = isUnlocked(s, state.clearedQuestIds);
            return (
              <button
                key={s.id}
                disabled={!open}
                className="chip items-start text-left"
                onClick={() => addStep({ kind: "spice", id: s.id })}
              >
                <span className="text-sm font-semibold">
                  {open ? s.emoji : "🔒"} {s.name}
                  <span className="ml-1 text-[10px] font-normal text-violet-700">{s.kind === "body" ? "身体" : "品質"}</span>
                </span>
                <span className="text-[10px] leading-tight text-stone-500">{open ? s.description : unlockLabel(s.unlockAfterQuest)}</span>
              </button>
            );
          })}
        </div>

        <div className="mb-1 text-xs text-stone-500">特殊器具（次の調理法に効く）</div>
        <div className="grid grid-cols-1 gap-1.5">
          {TOOLS.map((t) => {
            const open = isUnlocked(t, state.clearedQuestIds);
            return (
              <button
                key={t.id}
                disabled={!open}
                className="chip items-start text-left"
                onClick={() => addStep({ kind: "tool", id: t.id })}
              >
                <span className="text-sm font-semibold">
                  {open ? t.emoji : "🔒"} {t.name}
                </span>
                <span className="text-[10px] leading-tight text-stone-500">{open ? t.description : unlockLabel(t.unlockAfterQuest)}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-stone-500">
          💡 香りのスパイスは加熱すると飛びやすい。最後に入れるか香封鍋で。
        </p>
      </section>

      <div className="fixed inset-x-0 bottom-16 z-10 mx-auto max-w-md px-4">
        <button className="btn-primary w-full py-3.5 text-lg shadow-lg" disabled={!ingredientIds.length || busy} onClick={cook}>
          {busy ? "調理中…" : "🍽️ 完成！"}
        </button>
      </div>
    </div>
  );
}
