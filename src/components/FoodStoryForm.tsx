import { useState } from "react";
import { FOOD_STORY } from "../data/foodStory";
import { describePalate } from "../game/eating/profile";
import { setFoodStory } from "../game/eating/eat";
import { useGame } from "../state/GameContext";

/** 食遍歴: five questions about what you have eaten, plus optional free text. */
export function FoodStoryForm({ onDone }: { onDone?: () => void }) {
  const { state, dispatch } = useGame();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [freeText, setFreeText] = useState("");
  const [step, setStep] = useState(0);
  const q = FOOD_STORY[step];
  const last = step >= FOOD_STORY.length;

  const finish = () => {
    dispatch({ type: "setWorld", world: setFoodStory(state.world, { answers, freeText }) });
    onDone?.();
  };

  return (
    <div className="card space-y-3">
      <div className="flex justify-between">
        <h2 className="section-title mb-0">🍽️ 食遍歴</h2>
        <span className="text-xs text-stone-500">{last ? "最後" : `${step + 1} / ${FOOD_STORY.length}`}</span>
      </div>
      {!last ? (
        <>
          <p className="font-semibold">{q.question}</p>
          <div className="grid grid-cols-1 gap-1.5">
            {q.options.map((o) => (
              <button
                key={o.id}
                className={`chip min-h-11 items-start px-3 text-left ${answers[q.id] === o.id ? "chip-on" : ""}`}
                onClick={() => {
                  setAnswers({ ...answers, [q.id]: o.id });
                  setStep(step + 1);
                }}
              >
                {o.label}
              </button>
            ))}
          </div>
          {step > 0 && <button className="text-xs text-stone-500 underline" onClick={() => setStep(step - 1)}>← 前の質問</button>}
        </>
      ) : (
        <>
          <p className="font-semibold">ほかに、思い出の味があれば（任意）</p>
          <textarea
            className="w-full rounded-lg border border-stone-300 p-2 text-base"
            rows={3}
            maxLength={120}
            value={freeText}
            placeholder="例：祖母の作る甘い豆の煮物"
            onChange={(e) => setFreeText(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-2">
            <button className="btn-secondary" onClick={() => setStep(step - 1)}>戻る</button>
            <button className="btn-primary" onClick={finish}>これで決定</button>
          </div>
        </>
      )}
    </div>
  );
}

/** The visible part of the player's palate. */
export function PalateCard() {
  const { state } = useGame();
  const p = state.world.palate;
  // The food story is answered in character creation; this is only a fallback for a world without one.
  if (!p) return <FoodStoryForm />;
  const { likes, dislikes } = describePalate(p);
  const log = state.world.tastingLog;
  return (
    <div className="card space-y-1 text-sm">
      <div className="flex justify-between">
        <h2 className="section-title mb-0">🍽️ 食の好み</h2>
      </div>
      <p className="text-xs text-stone-600">{p.profileText}</p>
      <div className="text-xs">好き：{likes.join("・") || "まだはっきりしない"}{dislikes.length > 0 && `／苦手：${dislikes.join("・")}`}</div>
      {log.length > 0 && (
        <div className="pt-1 text-xs text-stone-600">
          最近の食リポ：{log.slice(0, 3).map((r) => `${r.dishName}（${r.score}）`).join("、")}
        </div>
      )}
    </div>
  );
}
