import { useEffect, useState, type ReactNode } from "react";
import {
  AGE_MAX, AGE_MIN, GENDER_CHOICES, GENDER_LABEL, LEAN_CHOICES, PRESENTATION_CHOICES, START_CHOICES, TEMPERAMENT_QUESTIONS, TOOL_INTRO,
} from "../data/creation";
import { FOOD_STORY } from "../data/foodStory";
import { TOOL_MAP } from "../data/magic";
import { STAT_KEYS, type Stats } from "../types/world";
import type { World } from "../game/world";
import {
  clampAge, creationCandidates, creationSteps, finalizeCreation, newDraft, nextStep, previewCompanion, previousStep, speciesIdOf,
  STEP_LABEL, stepDone, suggestedStats, type CreationDraft, type CreationStep,
} from "../game/creation/creation";
import { addressFor, firstPersonCandidates } from "../game/creation/identityText";
import { buildPlayerProfile, describePalate } from "../game/eating/profile";
import { checkAllocation, INITIAL_MAX, STAT_LABEL, STAT_MIN } from "../game/chef/stats";
import { useGame } from "../state/GameContext";

// キャラクター作成: a quiet, black, one-thing-at-a-time sequence before the game begins.
// No normal UI (header, tabs, cards) is shown until この人物で始める.

const STAT_HINT: Record<keyof Stats, string> = {
  tech: "工程の成功・複雑さへの強さ", knowledge: "食材の容量・理解", luck: "大成功・救済", magic: "MP・魔導具", strength: "体力・工程数",
};

function Choice({ on, onClick, children, sub }: { on?: boolean; onClick: () => void; children: ReactNode; sub?: string }) {
  return (
    <button
      className={`w-full rounded-2xl border px-4 py-4 text-left transition-colors active:bg-stone-900 ${on ? "border-amber-200/70 bg-stone-900 text-amber-100" : "border-stone-700 bg-stone-950 text-stone-200"}`}
      onClick={onClick}
    >
      <div className="text-base font-semibold">{children}</div>
      {sub && <div className="mt-0.5 text-xs text-stone-400">{sub}</div>}
    </button>
  );
}

function Primary({ disabled, onClick, children }: { disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      className="w-full rounded-2xl border border-amber-200/60 bg-amber-200/10 py-4 text-base font-semibold text-amber-100 active:bg-amber-200/20 disabled:border-stone-800 disabled:bg-transparent disabled:text-stone-600"
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function Title({ children, sub }: { children: ReactNode; sub?: string }) {
  return (
    <div className="space-y-1">
      <h1 className="text-xl font-semibold tracking-wide text-stone-100">{children}</h1>
      {sub && <p className="text-sm leading-relaxed text-stone-400">{sub}</p>}
    </div>
  );
}

// ---------- Steps ----------

function GenderDiamond({ value, onChange }: { value: CreationDraft["genderExpression"]; onChange: (g: NonNullable<CreationDraft["genderExpression"]>) => void }) {
  const cell = (pos: "top" | "left" | "right" | "bottom") => {
    const g = GENDER_CHOICES.find((x) => x.pos === pos)!;
    const on = value === g.id;
    return (
      <button
        key={pos}
        aria-pressed={on}
        className={`flex h-16 flex-col items-center justify-center rounded-2xl border text-base font-semibold ${on ? "border-amber-200/70 bg-stone-900 text-amber-100" : "border-stone-700 bg-stone-950 text-stone-300"}`}
        onClick={() => onChange(g.id)}
      >
        <span className="text-xs leading-none text-stone-500">{on ? "◆" : "◇"}</span>
        {g.label}
      </button>
    );
  };
  return (
    <div className="mx-auto grid w-full max-w-[18rem] grid-cols-3 gap-2">
      <div />
      {cell("top")}
      <div />
      {cell("left")}
      <div className="flex items-center justify-center">
        <div className="h-8 w-8 rotate-45 border border-stone-600" />
      </div>
      {cell("right")}
      <div />
      {cell("bottom")}
      <div />
    </div>
  );
}

function AgePicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-center gap-4">
        <button aria-label="年齢を下げる" className="h-12 w-12 rounded-full border border-stone-700 text-xl text-stone-200 disabled:opacity-30" disabled={value <= AGE_MIN} onClick={() => onChange(clampAge(value - 1))}>−</button>
        <div className="w-24 text-center text-3xl font-semibold tabular-nums text-stone-100">{value}<span className="ml-1 text-base text-stone-400">歳</span></div>
        <button aria-label="年齢を上げる" className="h-12 w-12 rounded-full border border-stone-700 text-xl text-stone-200 disabled:opacity-30" disabled={value >= AGE_MAX} onClick={() => onChange(clampAge(value + 1))}>＋</button>
      </div>
      <input
        type="range" min={AGE_MIN} max={AGE_MAX} value={value} aria-label="年齢"
        className="w-full accent-amber-200"
        onChange={(e) => onChange(clampAge(Number(e.target.value)))}
      />
      <div className="flex justify-between text-[11px] text-stone-500"><span>{AGE_MIN}</span><span>{AGE_MAX}</span></div>
    </div>
  );
}

function FoodStoryStep({ draft, onDone }: { draft: CreationDraft; onDone: (story: NonNullable<CreationDraft["foodStory"]>) => void }) {
  const [answers, setAnswers] = useState<Record<string, string>>(draft.foodStory?.answers ?? {});
  const [freeText, setFreeText] = useState(draft.foodStory?.freeText ?? "");
  const [i, setI] = useState(0);
  const q = FOOD_STORY[i];
  if (q) {
    return (
      <div className="space-y-5">
        <Title sub={`食遍歴 ${i + 1} / ${FOOD_STORY.length}`}>{q.question}</Title>
        <div className="space-y-2">
          {q.options.map((o) => (
            <Choice key={o.id} on={answers[q.id] === o.id} onClick={() => { setAnswers({ ...answers, [q.id]: o.id }); setI(i + 1); }}>{o.label}</Choice>
          ))}
        </div>
        {i > 0 && <button className="text-sm text-stone-500 underline" onClick={() => setI(i - 1)}>← 前の問い</button>}
      </div>
    );
  }
  return (
    <div className="space-y-5">
      <Title sub="なくてもかまわない。">ほかに、思い出の味があれば</Title>
      <textarea
        className="w-full rounded-2xl border border-stone-700 bg-stone-950 p-3 text-base text-stone-100 placeholder:text-stone-600"
        rows={3}
        maxLength={120}
        value={freeText}
        placeholder="例：祖母の作る甘い豆の煮物"
        onChange={(e) => setFreeText(e.target.value)}
      />
      <Primary onClick={() => onDone({ answers, freeText })}>この食遍歴で決める</Primary>
      <button className="text-sm text-stone-500 underline" onClick={() => setI(FOOD_STORY.length - 1)}>← 前の問い</button>
    </div>
  );
}

function StatsStep({ draft, onDone }: { draft: CreationDraft; onDone: (stats: Stats) => void }) {
  const [stats, setStats] = useState<Stats>(draft.stats);
  const check = checkAllocation(stats);
  const bump = (k: keyof Stats, d: number) => {
    const v = stats[k] + d;
    if (v < STAT_MIN || v > INITIAL_MAX) return;
    setStats({ ...stats, [k]: v });
  };
  return (
    <div className="space-y-5">
      <Title sub="各5に自由な25を足す。最大15・最低1。5より2下げるごとに1戻る。">能力を振り分ける</Title>
      <div className="text-center text-sm text-stone-300">残り <span className="text-2xl font-semibold tabular-nums text-amber-100">{check.remaining}</span></div>
      <div className="space-y-2">
        {STAT_KEYS.map((k) => (
          <div key={k} className="flex items-center gap-2 rounded-2xl border border-stone-800 px-3 py-2">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-stone-100">{STAT_LABEL[k]}</div>
              <div className="text-[11px] leading-tight text-stone-500">{STAT_HINT[k]}</div>
            </div>
            <button aria-label={`${STAT_LABEL[k]}を下げる`} className="h-10 w-10 rounded-full border border-stone-700 text-lg text-stone-200 disabled:opacity-30" disabled={stats[k] <= STAT_MIN} onClick={() => bump(k, -1)}>−</button>
            <div className="w-8 text-center text-lg font-semibold tabular-nums text-stone-100">{stats[k]}</div>
            <button aria-label={`${STAT_LABEL[k]}を上げる`} className="h-10 w-10 rounded-full border border-stone-700 text-lg text-stone-200 disabled:opacity-30" disabled={stats[k] >= INITIAL_MAX || check.remaining <= 0} onClick={() => bump(k, 1)}>＋</button>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <button className="rounded-xl border border-stone-700 py-2.5 text-stone-300" onClick={() => setStats(suggestedStats())}>おすすめ配分</button>
        <button className="rounded-xl border border-stone-700 py-2.5 text-stone-300" onClick={() => setStats({ tech: 5, knowledge: 5, luck: 5, magic: 5, strength: 5 })}>各5に戻す</button>
      </div>
      {check.errors.length > 0 && <p className="text-xs text-rose-300">{check.errors.join("、")}</p>}
      {check.ok && check.remaining > 0 && <p className="text-xs text-stone-400">残り{check.remaining}ポイントを振り分けてください。</p>}
      <Primary disabled={!check.ok || check.remaining !== 0} onClick={() => onDone(stats)}>この能力で決める</Primary>
    </div>
  );
}

function CompanionStep({ base, draft, onTemperament, onPick }: {
  base: World; draft: CreationDraft;
  onTemperament: (t: CreationDraft["temperament"]) => void;
  onPick: (speciesId: string, name: string) => void;
}) {
  const t = draft.temperament;
  const answered = t.pace !== undefined && t.talk !== undefined;
  if (!answered) {
    return (
      <div className="space-y-5">
        <Title sub="その存在は、黙ってあなたを見定めている。">あなたのことを、少しだけ</Title>
        {TEMPERAMENT_QUESTIONS.map((q) => (
          <div key={q.axis} className="space-y-2">
            <div className="text-sm text-stone-400">{q.question}</div>
            <div className="grid grid-cols-2 gap-2">
              <Choice on={t[q.axis] === -0.7} onClick={() => onTemperament({ ...t, [q.axis]: -0.7 })}>{q.low}</Choice>
              <Choice on={t[q.axis] === 0.7} onClick={() => onTemperament({ ...t, [q.axis]: 0.7 })}>{q.high}</Choice>
            </div>
          </div>
        ))}
      </div>
    );
  }
  const list = creationCandidates(base, draft);
  return (
    <div className="space-y-4">
      <Title sub="あなたと正反対の三つの気配。ひとつを選ぶ。">相棒を選ぶ</Title>
      {list.map((c) => {
        const on = draft.companionSpeciesId === speciesIdOf(c);
        return (
          <div key={c.id} className={`space-y-2 rounded-2xl border p-4 ${on ? "border-amber-200/70 bg-stone-900" : "border-stone-700 bg-stone-950"}`}>
            <div className="flex items-center gap-3">
              <span className="text-3xl">{c.emoji}</span>
              <div className="min-w-0">
                <div className="text-base font-semibold text-stone-100">{c.name}<span className="ml-1 text-xs font-normal text-stone-400">{c.species}</span></div>
                <div className="text-xs text-amber-200/80">{c.role}</div>
              </div>
            </div>
            <p className="text-xs text-stone-300">あなたには：{c.visibleForm}</p>
            <p className="text-xs text-stone-500">魔力の低い人には：{c.lowMagicAppearance?.label}</p>
            <p className="text-sm text-stone-300">「{c.dialogue.greet?.[0]}」</p>
            <ul className="list-inside list-disc text-xs text-stone-400">{c.complement?.map((r) => <li key={r}>{r}</li>)}</ul>
            <div className="text-xs text-stone-400">🛠 {c.blurb}</div>
            <Primary onClick={() => onPick(speciesIdOf(c), c.name)}>{c.name}と行く</Primary>
          </div>
        );
      })}
      <button className="text-sm text-stone-500 underline" onClick={() => onTemperament({})}>あなたのことを答え直す</button>
    </div>
  );
}

function Row({ label, value, onChange, children }: { label: string; value: ReactNode; onChange: () => void; children?: ReactNode }) {
  return (
    <div className="space-y-1 border-b border-stone-800 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] text-stone-500">{label}</div>
          <div className="text-sm text-stone-100">{value}</div>
        </div>
        <button className="shrink-0 rounded-lg border border-stone-700 px-3 py-1.5 text-xs text-stone-300 active:bg-stone-900" onClick={onChange}>変更</button>
      </div>
      {children}
    </div>
  );
}

function ConfirmStep({ base, draft, goEdit, onStart, error }: { base: World; draft: CreationDraft; goEdit: (s: CreationStep) => void; onStart: () => void; error: string }) {
  const comp = previewCompanion(base, draft);
  const palate = draft.foodStory ? buildPlayerProfile("あなた", draft.foodStory) : null;
  const taste = palate ? describePalate(palate) : null;
  const tool = draft.toolId ? TOOL_MAP[draft.toolId] : null;
  return (
    <div className="space-y-4">
      <Title sub="変えたいところは、いつでも戻って変えられる。">この人物で、始めますか</Title>
      <div>
        <Row label="料理を" value={LEAN_CHOICES.find((l) => l.id === draft.lean)?.label} onChange={() => goEdit("lean")} />
        <Row
          label="性別表現・年齢"
          value={`${draft.genderExpression ? GENDER_LABEL[draft.genderExpression] : "—"}・${draft.age}歳`}
          onChange={() => goEdit("identity")}
        >
          <div className="text-[11px] text-stone-500">村での呼ばれ方の例：「{addressFor(draft)}」／一人称の候補：{firstPersonCandidates(draft.genderExpression).join("・")}（文章だけに使い、能力には関わらない）</div>
        </Row>
        <Row label="最初の道連れ" value={START_CHOICES.find((s) => s.id === draft.start)?.label} onChange={() => goEdit("start")} />
        {draft.start === "companion" && (
          <>
            <Row label="相棒の姿" value={PRESENTATION_CHOICES.find((p) => p.id === draft.companionPresentation)?.label} onChange={() => goEdit("companionGender")} />
            <Row label="相棒" value={comp ? `${comp.emoji} ${comp.name}（${comp.species}）` : "—"} onChange={() => goEdit("companion")}>
              {comp && (
                <div className="space-y-0.5 text-[11px] text-stone-400">
                  <div>{comp.role}・{comp.visibleForm}</div>
                  <div className="text-stone-500">魔力の低い人には「{comp.lowMagicAppearance?.label}」にしか見えない</div>
                  <ul className="list-inside list-disc">{comp.complement?.map((r) => <li key={r}>{r}</li>)}</ul>
                </div>
              )}
            </Row>
          </>
        )}
        {draft.start === "tool" && (
          <Row label="魔導具" value={tool ? `${tool.emoji} ${tool.name}` : "—"} onChange={() => goEdit("tool")}>
            {draft.toolId && <div className="text-[11px] text-stone-400">{TOOL_INTRO[draft.toolId]?.good}</div>}
          </Row>
        )}
        <Row label="食遍歴" value={palate?.memories?.[0] ?? "—"} onChange={() => goEdit("foodStory")}>
          {taste && <div className="text-[11px] text-stone-400">好き：{taste.likes.join("・") || "まだはっきりしない"}{taste.dislikes.length > 0 && `／苦手：${taste.dislikes.join("・")}`}</div>}
        </Row>
        <Row label="能力" value={STAT_KEYS.map((k) => `${STAT_LABEL[k]}${draft.stats[k]}`).join("　")} onChange={() => goEdit("stats")} />
      </div>
      {error && <p className="text-xs text-rose-300">{error}</p>}
      <Primary onClick={onStart}>この人物で始める</Primary>
    </div>
  );
}

// ---------- The sequence ----------

export function CharacterCreation() {
  const { state, dispatch } = useGame();
  const base = state.world;
  const [draft, setDraft] = useState<CreationDraft>(newDraft);
  const [step, setStep] = useState<CreationStep>("lean");
  const [returning, setReturning] = useState(false);
  const [born, setBorn] = useState<World | null>(null);
  const [error, setError] = useState("");

  const steps: CreationStep[] = creationSteps(draft).filter((s) => s !== "confirm");
  const finish = (d: CreationDraft, from: CreationStep) => {
    setDraft(d);
    setStep(nextStep(d, from, returning));
    window.scrollTo({ top: 0 });
  };
  const back = () => {
    if (returning) return setStep("confirm");
    const prev = previousStep(draft, step);
    if (prev) setStep(prev);
    window.scrollTo({ top: 0 });
  };
  const enter = () => {
    if (!born) return;
    dispatch({ type: "setWorld", world: born });
    dispatch({ type: "navigate", screen: "village" });
  };

  useEffect(() => {
    if (!born) return;
    const t = setTimeout(enter, 1800);
    return () => clearTimeout(t);
  }, [born]); // eslint-disable-line react-hooks/exhaustive-deps

  if (born) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-black px-6 text-center" onClick={enter}>
        <p className="animate-pulse text-lg tracking-widest text-stone-200">――そして、あなたの物語が始まる。</p>
      </div>
    );
  }

  let body: ReactNode = null;
  if (step === "lean") {
    body = (
      <div className="space-y-6">
        <Title>あなたは、料理を――</Title>
        <div className="space-y-3">
          {LEAN_CHOICES.map((c) => (
            <Choice key={c.id} on={draft.lean === c.id} sub={c.hint} onClick={() => finish({ ...draft, lean: c.id }, "lean")}>{c.label}</Choice>
          ))}
        </div>
      </div>
    );
  } else if (step === "identity") {
    body = (
      <div className="space-y-6">
        <Title sub="どれを選んでも、能力や才能には何の違いもない。">あなたの姿と、歳</Title>
        <GenderDiamond value={draft.genderExpression} onChange={(g) => setDraft({ ...draft, genderExpression: g })} />
        <AgePicker value={draft.age} onChange={(a) => setDraft({ ...draft, age: a })} />
        <Primary disabled={!stepDone(draft, "identity")} onClick={() => finish(draft, "identity")}>次へ</Primary>
      </div>
    );
  } else if (step === "start") {
    body = (
      <div className="space-y-6">
        <Title sub="どちらを選んでも、不利にはならない。">旅立ちに、何を連れていく</Title>
        <div className="space-y-3">
          {START_CHOICES.map((c) => (
            <Choice key={c.id} on={draft.start === c.id} sub={c.hint} onClick={() => finish({ ...draft, start: c.id }, "start")}>{c.label}</Choice>
          ))}
        </div>
      </div>
    );
  } else if (step === "tool") {
    body = (
      <div className="space-y-6">
        <Title sub="選ばなかった魔導具は、まだ手元にない。">魔導具をひとつ</Title>
        <div className="space-y-3">
          {Object.entries(TOOL_INTRO).map(([id, t]) => (
            <Choice key={id} on={draft.toolId === id} sub={`${t.line}得意：${t.good}`} onClick={() => finish({ ...draft, toolId: id }, "tool")}>
              {TOOL_MAP[id]?.emoji} {TOOL_MAP[id]?.name}
            </Choice>
          ))}
        </div>
      </div>
    );
  } else if (step === "companionGender") {
    body = (
      <div className="space-y-6">
        <Title sub="その本質は、精霊や使い魔に近いもの。魔力を持つあなたには人の姿で見えるが、ふつうの人には小さな動物か、ただの道具にしか見えない。">その子は――</Title>
        <div className="grid grid-cols-2 gap-3">
          {PRESENTATION_CHOICES.map((p) => (
            <Choice
              key={p.id}
              on={draft.companionPresentation === p.id}
              onClick={() => {
                const changed = draft.companionPresentation !== p.id;
                // A different presentation means different names: the player picks again.
                finish({ ...draft, companionPresentation: p.id, ...(changed ? { companionSpeciesId: null, companionName: null } : {}) }, "companionGender");
              }}
            >
              {p.label}
            </Choice>
          ))}
        </div>
      </div>
    );
  } else if (step === "companion") {
    body = (
      <CompanionStep
        base={base}
        draft={draft}
        onTemperament={(t) => setDraft({ ...draft, temperament: t })}
        onPick={(speciesId, name) => finish({ ...draft, companionSpeciesId: speciesId, companionName: name }, "companion")}
      />
    );
  } else if (step === "foodStory") {
    body = <FoodStoryStep key={returning ? "edit" : "new"} draft={draft} onDone={(story) => finish({ ...draft, foodStory: story }, "foodStory")} />;
  } else if (step === "stats") {
    body = <StatsStep draft={draft} onDone={(stats) => finish({ ...draft, stats, statsConfirmed: true }, "stats")} />;
  } else {
    body = (
      <ConfirmStep
        base={base}
        draft={draft}
        error={error}
        goEdit={(s) => { setReturning(true); setStep(s); setError(""); window.scrollTo({ top: 0 }); }}
        onStart={() => {
          const w = finalizeCreation(base, draft);
          if (typeof w === "string") return setError(w);
          setBorn(w);
        }}
      />
    );
  }

  const index = steps.indexOf(step);
  return (
    <div className="min-h-dvh bg-black text-stone-200">
      <div className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-12 pt-6">
        <div className="mb-8 flex h-6 items-center justify-between text-xs text-stone-500">
          {step !== "lean" && step !== "confirm" ? <button className="text-stone-400" onClick={back}>{returning ? "← 確認へ" : "← 戻る"}</button> : <span />}
          <span className="tracking-widest">{step === "confirm" ? "確認" : `${STEP_LABEL[step]}　${index + 1}${draft.start ? ` / ${steps.length}` : ""}`}</span>
        </div>
        {body}
      </div>
    </div>
  );
}
