import { useState } from "react";
import type { FinishInput } from "../types/world";
import { FINISH_OPTIONS, reviewFinish } from "../game/finish/finish";
import { textGenerator, type FinishingContext } from "../services/textGeneration";

/** 仕上げ・盛り付け input: Q&A or free text, dummy AI suggestions, live contradiction review. */
export function FinishForm({ finish, onChange, context }: {
  finish: FinishInput;
  onChange: (f: FinishInput) => void;
  context: FinishingContext;
}) {
  const [suggestions, setSuggestions] = useState<Partial<FinishInput>[]>([]);
  const review = reviewFinish(finish);
  const opt = (key: "plating" | "vessel" | "aroma" | "howToEat", label: string) => (
    <div>
      <div className="mb-1 text-xs text-stone-500">{label}</div>
      <div className="grid grid-cols-2 gap-1.5">
        {FINISH_OPTIONS[key].map((o) => (
          <button key={o} className={`chip ${finish[key] === o ? "chip-on" : ""}`} onClick={() => onChange({ ...finish, [key]: finish[key] === o ? "" : o })}>
            <span className="text-sm">{o}</span>
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="card space-y-3">
      <h2 className="section-title">仕上げ・盛り付け</h2>
      <p className="text-xs text-stone-500">「{context.finalName}」をどう出すか。将来はここが生成AIへの指示文になります。</p>
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-stone-200 p-1">
        {(["qa", "free"] as const).map((m) => (
          <button key={m} className={`min-h-10 rounded-lg text-sm ${finish.mode === m ? "bg-white font-bold shadow" : ""}`} onClick={() => onChange({ ...finish, mode: m })}>
            {m === "qa" ? "一問一答" : "自由記入"}
          </button>
        ))}
      </div>
      {finish.mode === "qa" && (
        <>
          {opt("plating", "盛り付け")}
          {opt("vessel", "器")}
          {opt("aroma", "香り演出")}
          <div>
            <div className="mb-1 text-xs text-stone-500">提供温度</div>
            <div className="grid grid-cols-3 gap-1.5">
              {FINISH_OPTIONS.temperature.map(([v, l]) => (
                <button key={v} className={`chip ${finish.temperature === v ? "chip-on" : ""}`} onClick={() => onChange({ ...finish, temperature: finish.temperature === v ? "" : v })}>{l}</button>
              ))}
            </div>
          </div>
          {opt("howToEat", "食べ方")}
        </>
      )}
      <div>
        <div className="mb-1 text-xs text-stone-500">自由記述（仕上げの指示）</div>
        <textarea
          className="w-full rounded-lg border border-stone-300 p-2 text-base"
          rows={3}
          maxLength={200}
          value={finish.freeText}
          placeholder="例：木の椀に熱々で。ハーブを散らして"
          onChange={(e) => onChange({ ...finish, freeText: e.target.value })}
        />
      </div>
      <button className="btn-secondary w-full" onClick={async () => setSuggestions(await textGenerator.suggestFinishing(context))}>
        ✨ AI補助候補（ダミー）
      </button>
      {suggestions.map((sg, i) => (
        <button key={i} className="w-full rounded-lg border border-violet-200 bg-violet-50 p-2 text-left text-xs" onClick={() => onChange({ ...finish, ...sg })}>
          {sg.vessel}・{sg.plating}・{sg.aroma}<br />「{sg.freeText}」<span className="text-violet-700">→ 使う</span>
        </button>
      ))}
      {review.corrections.map((c) => <p key={c} className="text-xs text-sky-700">🔧 {c}</p>)}
      {review.warnings.map((c) => <p key={c} className="text-xs text-red-700">⚠ {c}</p>)}
    </div>
  );
}
