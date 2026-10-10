import { useState } from "react";
import type { Dish } from "../types";
import type { TastingResult } from "../types/eating";
import { TASTING_QUESTIONS } from "../data/foodStory";
import { eatAndTaste, recordTasting } from "../game/eating/eat";
import { describePalate } from "../game/eating/profile";
import { tastingReporter } from "../services/tastingReport";
import { useGame } from "../state/GameContext";
import { reportFee, type EatGain } from "../game/eater/progression";

const TONE = { good: "text-emerald-700", neutral: "text-stone-700", bad: "text-rose-700" };

/** 食べる → 7-stage 食体験 → the player's short 食リポ (Q&A + free text) → record + palate update. */
export function TastingView({ dish, stockId, onClose }: { dish: Dish; stockId: string; onClose: () => void }) {
  const { state, dispatch } = useGame();
  const w = state.world;
  const [result, setResult] = useState<TastingResult | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [freeText, setFreeText] = useState("");
  const [saved, setSaved] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [gain, setGain] = useState<EatGain | null>(null);

  if (!w.palate) {
    return (
      <div className="card space-y-2 text-sm">
        <p>食べる前に、あなたの「食遍歴」を教えてください。好みが食体験に反映されます。</p>
        <button className="btn-primary w-full" onClick={() => dispatch({ type: "navigate", screen: "chef" })}>食遍歴を作る（料理人）</button>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="card space-y-2">
        <p className="text-sm">「{dish.name}」を1食いただく。（体力が回復します）</p>
        {msg && <p className="text-xs text-red-700">{msg}</p>}
        <div className="grid grid-cols-2 gap-2">
          <button className="btn-secondary" onClick={onClose}>やめる</button>
          <button
            className="btn-primary"
            onClick={() => {
              const r = eatAndTaste(w, stockId, dish);
              if (typeof r === "string") return setMsg(r);
              dispatch({ type: "setWorld", world: r.world });
              setResult(r.result);
              setGain(r.gain);
            }}
          >
            🍴 食べる
          </button>
        </div>
      </div>
    );
  }

  const lines = tastingReporter.full({
    dishName: dish.name, eater: w.palate, result, plating: dish.process?.finish.plating, vessel: dish.process?.finish.vessel,
  });
  const allAnswered = TASTING_QUESTIONS.every((q) => answers[q.id]);

  return (
    <div className="card space-y-2">
      <h2 className="section-title mb-0">🍴 食体験：{dish.name}</h2>
      <ol className="space-y-1 text-sm">
        {lines.map((l) => (
          <li key={l.stage} className="flex gap-2">
            <span className="w-20 shrink-0 text-xs text-stone-500">{l.label}</span>
            <span className={TONE[l.tone]}>{l.text}</span>
          </li>
        ))}
      </ol>
      <div className="text-xs text-stone-500">あなたの体験 {result.score}点（料理の絶対評価 {dish.total}点）</div>
      {gain && (
        <div className="rounded-lg bg-amber-50 p-2 text-xs text-amber-900">
          📖 「私の図鑑」に記録された{gain.codexNew ? "（初めての料理）" : ""}・食べた経験 +{gain.xp}
          {gain.reasons.length > 0 && <span className="block text-[11px] text-stone-600">{gain.reasons.join("・")}</span>}
          <span className="block text-[11px] text-stone-500">食べただけでは作り方（レシピ）は分からない</span>
        </div>
      )}

      {saved ? (
        <div className="space-y-2 rounded-lg bg-emerald-50 p-2 text-sm">
          <p>📒 食リポを記録しました。{saved}</p>
          <button className="btn-secondary w-full" onClick={onClose}>閉じる</button>
        </div>
      ) : (
        <div className="space-y-2 border-t border-stone-200 pt-2">
          <div className="text-sm font-semibold">あなたの食リポ</div>
          {TASTING_QUESTIONS.map((q) => (
            <div key={q.id}>
              <div className="mb-1 text-xs text-stone-500">{q.question}</div>
              <div className="grid grid-cols-4 gap-1">
                {q.options.map((o) => (
                  <button key={o.id} className={`chip min-h-10 text-xs ${answers[q.id] === o.id ? "chip-on" : ""}`} onClick={() => setAnswers({ ...answers, [q.id]: o.id })}>
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <textarea
            className="w-full rounded-lg border border-stone-300 p-2 text-base"
            rows={2}
            maxLength={200}
            value={freeText}
            placeholder="ひとこと（任意）"
            onChange={(e) => setFreeText(e.target.value)}
          />
          <button
            className="btn-primary w-full"
            disabled={!allAnswered}
            onClick={() => {
              const liking = TASTING_QUESTIONS.reduce(
                (a, q) => a + (q.options.find((o) => o.id === answers[q.id])?.liking ?? 0), 0,
              );
              const before = describePalate(w.palate!).likes.join("・");
              const out = recordTasting(w, dish, result, answers, Math.max(-1, Math.min(1, liking)), freeText);
              dispatch({ type: "setWorld", world: out.world });
              const after = describePalate(out.world.palate!).likes.join("・");
              const fee = reportFee(w);
              setSaved(`${before !== after ? `好みが少し変わった（${after || "—"}）` : "好みが少しだけ育った"}${fee ? `／食レポ執筆料 ${fee}G` : ""}`);
            }}
          >
            記録する
          </button>
        </div>
      )}
    </div>
  );
}
