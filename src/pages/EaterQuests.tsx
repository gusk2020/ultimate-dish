import { useState } from "react";
import type { Axis } from "../types";
import { AXIS_LABEL } from "../game/labels";
import {
  bite, finishBigEater, KIND_LABEL, resolveCompare, resolveJudge, resolveSpicy, SPICE_LEVELS, spicyChance, startBigEater,
  startCompare, startJudge, TRAIT_AXES, type BigEaterSession, type ChallengeOutcome, type CompareSession, type EaterQuestDef,
  type JudgeItem, type JudgeSession,
} from "../game/eater/challenges";
import { progressionOf } from "../game/codex/codex";
import { useGame } from "../state/GameContext";
import { eaterBoard, OPPONENT_LIMIT, opponentOf } from "../game/battle/rotation";
import { storyOfEater } from "../data/stories";
import { RIVAL_MAP } from "../data/battles";

// 食べる側の依頼板: 食べ比べ・大食い・激辛・審査員.

function OutcomeView({ def, out, onBack }: { def: EaterQuestDef; out: ChallengeOutcome; onBack: () => void }) {
  return (
    <div className="space-y-3">
      <div className={`card text-center ${out.success ? "bg-amber-50" : ""}`}>
        <div className="text-lg font-bold">{out.success ? "🎉 依頼達成" : "😓 今回は届かず"}</div>
        <div className="text-xs text-stone-500">{def.title}（{KIND_LABEL[def.kind]}）</div>
      </div>
      <div className="card space-y-1 text-sm">
        {out.lines.map((l, i) => <p key={i} className={l.startsWith("×") ? "text-rose-700" : l.startsWith("○") ? "text-emerald-700" : ""}>{l}</p>)}
      </div>
      <div className="card text-sm">
        <div>報酬 {out.money}G・食べた経験 +{out.xp}・評判 {out.reputation >= 0 ? "+" : ""}{out.reputation}</div>
        <div className="text-xs text-emerald-700">📖 食べた料理は「私の図鑑」に記録された（作り方は分からないまま）</div>
        {!out.success && <div className="text-xs text-stone-500">外れても、食べた食材と調理法の経験は積み重なる</div>}
      </div>
      <button className="btn-secondary w-full" onClick={onBack}>依頼一覧へ</button>
    </div>
  );
}

function CompareView({ s, def, onDone }: { s: CompareSession; def: EaterQuestDef; onDone: (o: ChallengeOutcome) => void }) {
  const { state, dispatch } = useGame();
  const [pick, setPick] = useState<number | null>(null);
  const [trait, setTrait] = useState<Axis | null>(null);
  return (
    <div className="space-y-3">
      <div className="card text-sm">
        <div className="font-semibold">お題：{def.conditions.theme.label}</div>
        <div className="text-xs text-stone-500">作り手：{s.dishes.length}皿とも実際に作られた料理。感じたことは経験が浅いほどぶれる。</div>
      </div>
      {s.dishes.map((d, i) => (
        <div key={i} className="card text-sm">
          <div className="font-semibold">{String.fromCharCode(65 + i)}　{d.name}</div>
          <ul className="mt-1 grid grid-cols-2 gap-x-2 text-xs text-stone-600">{s.impressions[i].map((t) => <li key={t}>{t}</li>)}</ul>
        </div>
      ))}
      <div className="card space-y-2 text-sm">
        <div>① お題に合うのは？</div>
        <div className="grid grid-cols-2 gap-2">
          {s.dishes.map((_, i) => (
            <button key={i} className={`chip min-h-10 ${pick === i ? "chip-on" : ""}`} onClick={() => setPick(i)}>{String.fromCharCode(65 + i)}</button>
          ))}
        </div>
        <div>② 2皿で一番際立っていた特徴は？</div>
        <div className="grid grid-cols-2 gap-2">
          {TRAIT_AXES.map((a) => (
            <button key={a} className={`chip min-h-10 text-xs ${trait === a ? "chip-on" : ""}`} onClick={() => setTrait(a)}>{AXIS_LABEL[a]}</button>
          ))}
        </div>
        <button
          className="btn-primary w-full"
          disabled={pick === null || !trait}
          onClick={() => {
            const r = resolveCompare(state.world, s, { pick: pick!, trait: trait! });
            dispatch({ type: "setWorld", world: r.world });
            onDone(r.outcome);
          }}
        >
          判定を伝える
        </button>
      </div>
    </div>
  );
}

function BigEaterView({ s0, onDone }: { s0: BigEaterSession; onDone: (o: ChallengeOutcome) => void }) {
  const { state, dispatch } = useGame();
  const [s, setS] = useState(s0);
  const finish = () => {
    const r = finishBigEater(state.world, s);
    dispatch({ type: "setWorld", world: r.world });
    onDone(r.outcome);
  };
  const full = Math.min(1, s.eaten / s.capacity);
  return (
    <div className="space-y-3">
      <div className="card text-sm">
        <div className="font-semibold">{s.dish.name}　{s.eaten}/{s.target}杯</div>
        <div className="mt-1 h-2 rounded bg-stone-200"><div className="h-2 rounded bg-amber-500" style={{ width: `${full * 100}%` }} /></div>
        <div className="mt-1 text-xs text-stone-500">満腹感（限界に近いほど、次の一杯で箸が止まりやすい）</div>
        <ul className="mt-1 text-xs text-stone-600">{s.log.map((l) => <li key={l}>{l}</li>)}</ul>
      </div>
      {s.failed || s.eaten >= s.target ? (
        <button className="btn-primary w-full" onClick={finish}>結果へ</button>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <button className="btn-secondary" onClick={finish}>ここでやめる</button>
          <button className="btn-primary" onClick={() => setS(bite(s))}>もう一杯</button>
        </div>
      )}
    </div>
  );
}

function SpicyView({ def, onDone }: { def: EaterQuestDef; onDone: (o: ChallengeOutcome) => void }) {
  const { state, dispatch } = useGame();
  return (
    <div className="card space-y-2 text-sm">
      <div>辛さを選ぶ（辛いほど賞金が大きい）。辛さへの強さ：{progressionOf(state.world).spiceTolerance}</div>
      {SPICE_LEVELS.map((l) => (
        <button
          key={l.level}
          className="btn-secondary w-full"
          onClick={() => {
            const r = resolveSpicy(state.world, def, l.level);
            dispatch({ type: "setWorld", world: r.world });
            onDone(r.outcome);
          }}
        >
          🌶️×{l.level} {l.label}（完食の見込み {Math.round(spicyChance(state.world, l.level) * 100)}%・賞金{def.reward.money * l.level}G）
        </button>
      ))}
    </div>
  );
}

function JudgeView({ s, onDone }: { s: JudgeSession; onDone: (o: ChallengeOutcome) => void }) {
  const { state, dispatch } = useGame();
  const [answers, setAnswers] = useState<Partial<Record<JudgeItem, boolean>>>({});
  const all = s.items.every((x) => answers[x.item] !== undefined);
  return (
    <div className="space-y-3">
      <div className="card text-sm">
        <div className="font-semibold">審査する料理：{s.dish.name}</div>
        <div className="text-xs text-stone-500">作り手：{s.cook}。実際の調理の成否が正解になる。見立ての確かさ：{Math.round(s.accuracy * 100)}%</div>
      </div>
      {s.items.map((x) => (
        <div key={x.item} className="card space-y-1 text-sm" data-judge={x.item}>
          <div className="font-semibold">{x.question}</div>
          <div className="text-xs text-stone-600">感じたこと：{x.hint}</div>
          <div className="grid grid-cols-2 gap-2">
            {([true, false] as const).map((v) => (
              <button key={String(v)} className={`chip min-h-10 ${answers[x.item] === v ? "chip-on" : ""}`} onClick={() => setAnswers({ ...answers, [x.item]: v })}>
                {v ? "○" : "×"}
              </button>
            ))}
          </div>
        </div>
      ))}
      <button
        className="btn-primary w-full"
        disabled={!all}
        onClick={() => {
          const r = resolveJudge(state.world, s, answers);
          dispatch({ type: "setWorld", world: r.world });
          onDone(r.outcome);
        }}
      >
        審査結果を発表する
      </button>
    </div>
  );
}

type Active =
  | { def: EaterQuestDef; kind: "compare"; s: CompareSession }
  | { def: EaterQuestDef; kind: "bigEater"; s: BigEaterSession }
  | { def: EaterQuestDef; kind: "spicy" }
  | { def: EaterQuestDef; kind: "judge"; s: JudgeSession };

export function EaterQuestBoard({ board }: { board: "battle" | "request" }) {
  const { state } = useGame();
  const w = state.world;
  const lists = eaterBoard(w);
  const [active, setActive] = useState<Active | null>(null);
  const [out, setOut] = useState<ChallengeOutcome | null>(null);
  const log = progressionOf(w).questLog ?? [];
  const back = () => { setActive(null); setOut(null); window.scrollTo({ top: 0 }); };
  const done = (o: ChallengeOutcome) => { setOut(o); window.scrollTo({ top: 0 }); };

  if (active && out) return <div className="p-4"><OutcomeView def={active.def} out={out} onBack={back} /></div>;
  if (active) {
    return (
      <div className="space-y-3 p-4">
        <button className="text-sm text-stone-500 underline" onClick={back}>← 依頼一覧</button>
        <div className="card text-sm">
          <div className="font-semibold">{active.def.title}</div>
          <div className="text-xs text-stone-600">{active.def.client}「{active.def.blurb}」</div>
        </div>
        {active.kind === "compare" && <CompareView s={active.s} def={active.def} onDone={done} />}
        {active.kind === "bigEater" && <BigEaterView s0={active.s} onDone={done} />}
        {active.kind === "spicy" && <SpicyView def={active.def} onDone={done} />}
        {active.kind === "judge" && <JudgeView s={active.s} onDone={done} />}
      </div>
    );
  }

  const start = (def: EaterQuestDef) => {
    window.scrollTo({ top: 0 });
    if (def.kind === "compare") return setActive({ def, kind: "compare", s: startCompare(w, def) });
    if (def.kind === "bigEater") return setActive({ def, kind: "bigEater", s: startBigEater(w, def) });
    if (def.kind === "judge") return setActive({ def, kind: "judge", s: startJudge(w, def) });
    setActive({ def, kind: "spicy" });
  };

  const row = (q: EaterQuestDef) => {
        const tries = log.filter((l) => l.questId === q.id);
        const story = storyOfEater(q.id);
        const opp = q.rotates ? opponentOf(w, q.rivalId) : null;
        return (
          <div key={q.id} className="card text-sm" data-eater-quest={q.id}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-semibold">{q.title}</span>
              <span className="shrink-0 rounded bg-stone-100 px-1.5 text-[11px] text-stone-600">{KIND_LABEL[q.kind]}</span>
            </div>
            <div className="text-xs text-stone-500">{q.client}・{q.label}{opp && `・${RIVAL_MAP[q.rivalId]?.name}の料理 ${opp.matches}/${OPPONENT_LIMIT}回`}</div>
            <div className="text-xs text-stone-600">{q.blurb}</div>
            {story && <div className="text-[10px] text-stone-400">🔁 物語「{story.title}」— 作る側は料理を出す側で関わる</div>}
            <div className="mt-1 flex items-center justify-between">
              <span className="text-[11px] text-stone-500">報酬 {q.reward.money}G〜{tries.length ? `・挑戦${tries.length}回（成功${tries.filter((t) => t.success).length}）` : ""}</span>
              <button className="btn-primary px-4 py-1.5 text-sm" onClick={() => start(q)}>受ける</button>
            </div>
          </div>
        );
  };
  const main = board === "battle" ? lists.battles : lists.requests;
  return (
    <div className="space-y-2 p-4">
      <p className="text-xs text-stone-500">
        {board === "battle" ? `食べる勝負：食べ比べ・大食い・激辛・審査。同じ料理人の皿は${OPPONENT_LIMIT}回まで、済んだら次の料理人へ。` : "食べる依頼：試食・品評・名物選定。食べて、見極めて、言葉にして稼ぐ。"}外れても経験は残る。
      </p>
      {main.length === 0 && <p className="card text-sm text-stone-500">現在、この土地で受けられる{board === "battle" ? "勝負" : "依頼"}はない</p>}
      {main.map(row)}
      {board === "battle" && lists.rematch.length > 0 && <h3 className="pt-2 text-xs font-semibold text-stone-500">🔁 再戦</h3>}
      {board === "battle" && lists.rematch.map(row)}
    </div>
  );
}
