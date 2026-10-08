import { useEffect, useMemo, useState } from "react";
import type { Dish } from "../types";
import type { FinishInput, ProcessStep, StepGrade } from "../types/world";
import { INGREDIENTS } from "../data/ingredients";
import { itemInfo } from "../data/items";
import { METHODS, METHOD_MAP } from "../data/methods";
import { SPICES, TOOL_MAP } from "../data/magic";
import { RECOVERIES, RECOVERY_MAP, SKILL_MAP, TOOL_RULES } from "../data/phase2";
import { ingredientCapacity, maxSteps, toolSlots } from "../game/chef/stats";
import { availableAmount } from "../game/inventory/inventory";
import { formatDays, simulateProcess } from "../game/process/simulate";
import { buildProcessDish } from "../game/process/buildProcessDish";
import { EMPTY_FINISH, FINISH_OPTIONS, reviewFinish } from "../game/finish/finish";
import { findSchool } from "../game/school/school";
import { completeCooking, type CookingGains } from "../game/world";
import { newCookingSeed } from "../game/rng";
import { textGenerator } from "../services/textGeneration";
import { imageGenerator } from "../services/imageGeneration";
import { useGame } from "../state/GameContext";
import { DishDetail } from "../components/DishDetail";
import { STAT_LABEL } from "../game/chef/stats";

type Panel = "item" | "method" | "tool" | "recover" | "merge";
const AMOUNTS = [0.5, 1, 2];
const LINE_NAMES = ["A", "B", "C", "D"];

export const GRADE_LABEL: Record<StepGrade, string> = {
  criticalFail: "大失敗", fail: "失敗", success: "成功", great: "大成功", miracle: "奇跡的成功",
};
const GRADE_STYLE: Record<StepGrade, string> = {
  criticalFail: "bg-red-200 text-red-900", fail: "bg-rose-100 text-rose-800", success: "bg-emerald-100 text-emerald-800",
  great: "bg-sky-100 text-sky-800", miracle: "bg-violet-200 text-violet-900",
};

function stepText(s: ProcessStep): string {
  switch (s.kind) {
    case "add": {
      const i = itemInfo(s.itemId);
      return `${i?.emoji ?? ""}${i?.name ?? s.itemId} ×${s.amount} を投入`;
    }
    case "method": return METHOD_MAP[s.methodId]?.name ?? s.methodId;
    case "tool": return `${TOOL_MAP[s.toolId]?.emoji ?? ""}${TOOL_MAP[s.toolId]?.name}を使う`;
    case "recover": return `🩹${RECOVERY_MAP[s.recoverId]?.name}`;
    case "merge": return `ライン${LINE_NAMES[s.from]}を合わせる`;
    case "finish": return "盛り付け";
  }
}

export function LineKitchen({ seedSteps, parentDishId, onSeedUsed }: {
  seedSteps?: ProcessStep[]; parentDishId: string | null; onSeedUsed: () => void;
}) {
  const { state, dispatch } = useGame();
  const w = state.world;
  const school = findSchool(w.chef.activeSchoolId, w.customSchools);

  const [steps, setSteps] = useState<ProcessStep[]>([]);
  const [lineCount, setLineCount] = useState(1);
  const [target, setTarget] = useState(0);
  const [amount, setAmount] = useState(1);
  const [panel, setPanel] = useState<Panel>("item");
  const [seed, setSeed] = useState<number | null>(null);
  const [locked, setLocked] = useState(0);
  const [phase, setPhase] = useState<"build" | "finish">("build");
  const [finish, setFinish] = useState<FinishInput>(EMPTY_FINISH);
  const [suggestions, setSuggestions] = useState<Partial<FinishInput>[]>([]);
  const [parent, setParent] = useState<string | null>(parentDishId);
  const [done, setDone] = useState<{ dish: Dish; gains: CookingGains } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!seedSteps) return;
    setSteps(seedSteps);
    setLineCount(Math.max(1, ...seedSteps.map((s) => s.line + 1)));
    setParent(parentDishId);
    setSeed(null);
    setLocked(0);
    setPhase("build");
    setDone(null);
    onSeedUsed();
  }, [seedSteps, parentDishId, onSeedUsed]);

  const ctx = { chef: w.chef, school, inventory: w.inventory, tools: w.tools, seed: seed ?? 0 };
  const sim = useMemo(() => simulateProcess(steps, ctx), [steps, w, seed, school]); // eslint-disable-line react-hooks/exhaustive-deps
  const review = reviewFinish(finish);
  const lineHas = (i: number) => steps.some((s) => s.line === i && s.kind === "add");
  const mergedLines = new Set(sim.lines.filter((l) => l.mergedInto !== undefined).map((l) => l.line));

  const push = (s: ProcessStep) => setSteps((cur) => [...cur, s]);
  const remove = (i: number) => setSteps((cur) => cur.filter((_, j) => j !== i));
  const moveUp = (i: number) =>
    setSteps((cur) => {
      const n = [...cur];
      [n[i - 1], n[i]] = [n[i], n[i - 1]];
      return n;
    });

  const judge = () => {
    if (seed === null) setSeed(newCookingSeed());
    setLocked(steps.length);
  };
  const reset = () => {
    setSteps([]); setLineCount(1); setTarget(0); setSeed(null); setLocked(0);
    setPhase("build"); setFinish(EMPTY_FINISH); setSuggestions([]); setParent(null); setDone(null); setError("");
  };

  const complete = async () => {
    const result = simulateProcess(steps, ctx);
    const core = buildProcessDish({
      steps, result, school, finish: review.normalized, review, cookingSeed: seed ?? 0,
      chefLevel: w.chef.level, parentDishId: parent,
    });
    const [description, image] = await Promise.all([
      textGenerator.describeDish(core, { schoolName: school.name }),
      imageGenerator.generate(core),
    ]);
    const dish: Dish = { ...core, description, image };
    const out = completeCooking(w, steps, result, dish);
    if (typeof out === "string") return setError(out);
    dispatch({ type: "addDish", dish });
    dispatch({ type: "setWorld", world: out.world });
    setDone({ dish, gains: out.gains });
    window.scrollTo({ top: 0 });
  };

  // ---------- Result ----------
  if (done) {
    const current = state.dishes.find((d) => d.id === done.dish.id) ?? done.dish;
    const g = done.gains;
    return (
      <div className="space-y-3">
        <div className="text-center text-sm font-semibold text-emerald-700">✨ 完成！図鑑に登録しました</div>
        <div className="card">
          <DishDetail dish={current} showMeta={false} onRename={(name) => dispatch({ type: "renameDish", id: current.id, name })} />
        </div>
        <div className="card text-sm">
          <div>経験値 +{g.xp}{g.levelUps.map((l) => `　🎉 Lv${l.level}！（${Object.entries(l.gains).map(([k, v]) => `${STAT_LABEL[k as keyof typeof STAT_LABEL]}+${v}`).join(" ")}${l.luckyBonus ? "・幸運ボーナス" : ""}）`).join("")}</div>
          <div className="text-xs text-stone-600">熟練：{Object.entries(g.skillXp).map(([k, v]) => `${SKILL_MAP[k as keyof typeof SKILL_MAP]?.name ?? k}+${v}`).join("、") || "なし"}</div>
          {g.newSkills.length > 0 && <div className="text-xs text-violet-700">新スキル：{g.newSkills.map((k) => SKILL_MAP[k]?.name ?? k).join("、")}</div>}
          <div className="text-xs text-stone-600">調理時間 {formatDays(current.process?.totalDays ?? 0)} が経過しました</div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button className="btn-primary" onClick={() => dispatch({ type: "navigate", screen: "quests" })}>📜 依頼に出す</button>
          <button className="btn-secondary" onClick={() => dispatch({ type: "derive", dish: current })}>🌱 改良する</button>
          <button className="btn-secondary col-span-2" onClick={reset}>新しく作る</button>
        </div>
      </div>
    );
  }

  const nonAdd = sim.stepCount;
  const canJudge = steps.length > locked && sim.errors.length === 0;
  const canFinish = steps.length > 0 && locked === steps.length && sim.errors.length === 0 && sim.openLines.length === 1;

  // ---------- Finishing ----------
  if (phase === "finish") {
    const opt = (key: "plating" | "vessel" | "aroma" | "howToEat", label: string) => (
      <div>
        <div className="mb-1 text-xs text-stone-500">{label}</div>
        <div className="grid grid-cols-2 gap-1.5">
          {FINISH_OPTIONS[key].map((o) => (
            <button key={o} className={`chip ${finish[key] === o ? "chip-on" : ""}`} onClick={() => setFinish({ ...finish, [key]: finish[key] === o ? "" : o })}>
              <span className="text-sm">{o}</span>
            </button>
          ))}
        </div>
      </div>
    );
    const finalLine = sim.lines.find((l) => l.line === sim.openLines[0]);
    return (
      <div className="space-y-3">
        <div className="card space-y-3">
          <h2 className="section-title">仕上げ・盛り付け</h2>
          <p className="text-xs text-stone-500">「{finalLine?.name}」をどう出すか。将来はここが生成AIへの指示文になります。</p>
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-stone-200 p-1">
            {(["qa", "free"] as const).map((m) => (
              <button key={m} className={`min-h-10 rounded-lg text-sm ${finish.mode === m ? "bg-white font-bold shadow" : ""}`} onClick={() => setFinish({ ...finish, mode: m })}>
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
                    <button key={v} className={`chip ${finish.temperature === v ? "chip-on" : ""}`} onClick={() => setFinish({ ...finish, temperature: finish.temperature === v ? "" : v })}>{l}</button>
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
              onChange={(e) => setFinish({ ...finish, freeText: e.target.value })}
            />
          </div>
          <button
            className="btn-secondary w-full"
            onClick={async () =>
              setSuggestions(await textGenerator.suggestFinishing({
                ingredientNames: Object.keys(finalLine?.ingredients ?? {}).map((id) => itemInfo(id)?.name ?? id),
                schoolName: school.name,
                finalName: finalLine?.name ?? "料理",
              }))
            }
          >
            ✨ AI補助候補（ダミー）
          </button>
          {suggestions.map((sg, i) => (
            <button key={i} className="w-full rounded-lg border border-violet-200 bg-violet-50 p-2 text-left text-xs" onClick={() => setFinish({ ...finish, ...sg })}>
              {sg.vessel}・{sg.plating}・{sg.aroma}<br />「{sg.freeText}」<span className="text-violet-700">→ 使う</span>
            </button>
          ))}
          {review.corrections.map((c) => <p key={c} className="text-xs text-sky-700">🔧 {c}</p>)}
          {review.warnings.map((c) => <p key={c} className="text-xs text-red-700">⚠ {c}</p>)}
        </div>
        {error && <p className="text-sm text-red-700">{error}</p>}
        <div className="grid grid-cols-2 gap-2">
          <button className="btn-secondary" onClick={() => setPhase("build")}>工程に戻る</button>
          <button className="btn-primary" onClick={complete}>🍽️ 完成！</button>
        </div>
      </div>
    );
  }

  // ---------- Build ----------
  const items = [...INGREDIENTS, ...SPICES].map((i) => itemInfo(i.id)!).filter((i) => availableAmount(w.inventory, i.id) > 0);
  const usedTools = new Set(steps.filter((s) => s.kind === "tool").map((s) => (s as { toolId: string }).toolId));

  return (
    <div className="space-y-3 pb-24">
      <div className="card grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
        <div>容量 {sim.capacityUsed}/{ingredientCapacity(w.chef)}</div>
        <div>工程 {nonAdd}/{maxSteps(w.chef)}</div>
        <div>時間 {formatDays(sim.totalDays)}（並列）</div>
        <div>MP {sim.mpCost}/{w.chef.mp}</div>
        <div>魔導具 {usedTools.size}/{toolSlots(w.chef)}種</div>
        <div className="truncate">流派 {school.name}</div>
      </div>

      {/* Step list */}
      <div className="card">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="section-title mb-0">工程</h2>
          {seed !== null && <span className="text-[10px] text-stone-400">調理シード {seed.toString(36)}</span>}
        </div>
        {steps.length === 0 && <p className="text-sm text-stone-500">下のボタンで素材を投入し、工程を足していきます。</p>}
        <ol className="space-y-1">
          {steps.map((s, i) => {
            const o = i < locked ? sim.outcomes[i] : undefined;
            const editable = i >= locked;
            return (
              <li key={i} className="rounded-lg bg-stone-100 px-2 py-1.5 text-sm">
                <div className="flex items-center gap-1.5">
                  <span className="w-5 text-xs text-stone-500 tabular-nums">{i + 1}</span>
                  <span className="rounded bg-amber-200 px-1 text-[11px] font-bold">{LINE_NAMES[s.line]}</span>
                  <span className="min-w-0 flex-1 truncate">{stepText(s)}</span>
                  {editable && i > locked && <button className="icon-btn h-8 w-8" onClick={() => moveUp(i)} aria-label="上へ">↑</button>}
                  {editable && <button className="icon-btn h-8 w-8" onClick={() => remove(i)} aria-label="削除">✕</button>}
                </div>
                {o && s.kind !== "add" && (
                  <div className="mt-1 flex flex-wrap items-center gap-1 pl-6 text-[11px]">
                    <span className={`rounded px-1.5 py-0.5 font-semibold ${GRADE_STYLE[o.grade]}`}>{GRADE_LABEL[o.grade]}</span>
                    <span className="text-stone-500">{Math.round(o.chance * 100)}%・{formatDays(o.timeDays)}{o.mpCost ? `・MP${o.mpCost}` : ""}</span>
                    {o.failure && <span className="text-rose-700">{o.failure}</span>}
                    {o.note && <span className="text-sky-700">{o.note}</span>}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
        {sim.errors.length > 0 && <ul className="mt-2 text-xs text-red-700">{sim.errors.map((e) => <li key={e}>⚠ {e}</li>)}</ul>}
        {sim.openLines.length > 1 && <p className="mt-1 text-xs text-amber-700">完成には全ラインを1つに合流させる</p>}
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button className="btn-primary" disabled={!canJudge} onClick={judge}>🎲 ここまで調理</button>
          <button className="btn-primary" disabled={!canFinish} onClick={() => setPhase("finish")}>仕上げへ →</button>
        </div>
        <button className="mt-2 w-full text-xs text-stone-500 underline" onClick={reset}>全部やり直す</button>
        {locked > 0 && <p className="mt-1 text-[11px] text-stone-500">判定済みの工程は変更不可。失敗したら下の「挽回」で直せます。</p>}
      </div>

      {/* Target line */}
      <div className="card">
        <div className="mb-1 text-xs text-stone-500">対象ライン（中間生成物）</div>
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: lineCount }, (_, i) => {
            const l = sim.lines.find((x) => x.line === i);
            return (
              <button
                key={i}
                disabled={mergedLines.has(i)}
                className={`chip min-h-11 flex-row gap-1 px-2 ${target === i ? "chip-on" : ""}`}
                onClick={() => setTarget(i)}
              >
                <b>{LINE_NAMES[i]}</b>
                <span className="text-xs">{mergedLines.has(i) ? "合流済" : l ? `${l.name}（${l.amount}）` : "空"}</span>
              </button>
            );
          })}
          {lineCount < LINE_NAMES.length && (
            <button className="chip min-h-11 px-3" onClick={() => { setLineCount(lineCount + 1); setTarget(lineCount); setPanel("item"); }}>
              ＋ライン
            </button>
          )}
        </div>
      </div>

      {/* Action panel */}
      <div className="card">
        <div className="mb-2 grid grid-cols-5 gap-1 rounded-xl bg-stone-200 p-1 text-xs">
          {([["item", "素材"], ["method", "調理"], ["tool", "魔導具"], ["recover", "挽回"], ["merge", "合流"]] as [Panel, string][]).map(([p, l]) => (
            <button key={p} className={`min-h-9 rounded-lg ${panel === p ? "bg-white font-bold shadow" : ""}`} onClick={() => setPanel(p)}>{l}</button>
          ))}
        </div>

        {panel === "item" && (
          <>
            <div className="mb-2 flex items-center gap-1.5 text-xs">
              量：{AMOUNTS.map((a) => (
                <button key={a} className={`chip min-h-9 px-3 ${amount === a ? "chip-on" : ""}`} onClick={() => setAmount(a)}>{a}</button>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {items.map((i) => (
                <button key={i.id} className="chip" onClick={() => push({ kind: "add", line: target, itemId: i.id, amount })}>
                  <span className="text-base leading-none">{i.emoji}</span>
                  <span className="text-[12px] leading-tight">{i.name}</span>
                  <span className="text-[10px] text-stone-500">在庫{availableAmount(w.inventory, i.id)}・容量{i.capacityWeight}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {panel === "method" && (
          <div className="grid grid-cols-2 gap-1.5">
            {METHODS.map((m) => (
              <button key={m.id} disabled={!lineHas(target)} className="chip items-start text-left" onClick={() => push({ kind: "method", line: target, methodId: m.id })}>
                <span className="text-sm font-semibold">{m.name}</span>
                <span className="text-[10px] leading-tight text-stone-500">{m.hint}</span>
              </button>
            ))}
            <button disabled={!lineHas(target)} className="chip col-span-2" onClick={() => push({ kind: "finish", line: target })}>🍽️ 盛り付け</button>
          </div>
        )}

        {panel === "tool" && (
          <div className="space-y-1.5">
            {w.tools.map((t) => (
              <button key={t.toolId} disabled={!lineHas(target) || t.durability <= 0} className="chip w-full items-start text-left" onClick={() => push({ kind: "tool", line: target, toolId: t.toolId })}>
                <span className="text-sm font-semibold">{TOOL_MAP[t.toolId]?.emoji}{TOOL_MAP[t.toolId]?.name}　<span className="text-[10px] font-normal">耐久{t.durability}</span></span>
                <span className="text-[10px] leading-tight text-stone-600">{TOOL_RULES[t.toolId].effect}／{TOOL_RULES[t.toolId].mpRule}</span>
              </button>
            ))}
          </div>
        )}

        {panel === "recover" && (
          <div className="space-y-1.5">
            <p className="text-xs text-stone-500">ライン{LINE_NAMES[target]}の未解決の失敗：{sim.lines.find((l) => l.line === target)?.openFailures.join("、") || "なし"}</p>
            {RECOVERIES.map((r) => (
              <button key={r.id} disabled={!lineHas(target)} className="chip w-full items-start text-left" onClick={() => push({ kind: "recover", line: target, recoverId: r.id })}>
                <span className="text-sm font-semibold">🩹{r.name}</span>
                <span className="text-[10px] text-stone-600">直せる：{r.fixes.join("・")}{r.needsItem ? `／${itemInfo(r.needsItem.itemId)?.name}×${r.needsItem.amount}使用` : ""}</span>
              </button>
            ))}
          </div>
        )}

        {panel === "merge" && (
          <div className="space-y-1.5">
            <p className="text-xs text-stone-500">選んだラインを、対象ライン{LINE_NAMES[target]}に合わせる</p>
            {Array.from({ length: lineCount }, (_, i) => i)
              .filter((i) => i !== target && lineHas(i) && !mergedLines.has(i))
              .map((i) => (
                <button key={i} disabled={!lineHas(target)} className="chip w-full" onClick={() => push({ kind: "merge", line: target, from: i })}>
                  ライン{LINE_NAMES[i]}（{sim.lines.find((l) => l.line === i)?.name}）→ {LINE_NAMES[target]}
                </button>
              ))}
            {lineCount < 2 && <p className="text-xs text-stone-400">先に「＋ライン」で別ラインを作る</p>}
          </div>
        )}
      </div>
    </div>
  );
}
