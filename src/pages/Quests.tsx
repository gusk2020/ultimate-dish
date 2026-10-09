import { useEffect, useRef, useState } from "react";
import { BattlePage } from "./BattlePage";
import type { Eater, Quest, QuestResult, TasteKey } from "../types";
import { QUESTS } from "../data/quests";
import { EATER_MAP } from "../data/eaters";
import { AXIS_LABEL } from "../game/labels";
import { SPICES, TOOLS } from "../data/magic";
import { judgeQuest } from "../game/quest/judge";
import { textGenerator } from "../services/textGeneration";
import { useGame } from "../state/GameContext";
import { DishImageView, Meter, RankBadge } from "../components/DishParts";

const TASTE_LABEL: Record<TasteKey, string> = {
  sweet: "甘味", salty: "塩味", sour: "酸味", bitter: "苦味", umami: "うま味", aroma: "香り",
};
const TEXTURE_LABEL = { tender: "柔らかい", chewy: "歯ごたえ", crisp: "サクサク", soft: "ふんわり", firm: "しっかり" };

function questStatus(q: Quest, idx: number, cleared: string[]): "cleared" | "open" | "locked" {
  if (cleared.includes(q.id)) return "cleared";
  if (idx === 0 || cleared.includes(QUESTS[idx - 1].id)) return "open";
  return "locked";
}

function EaterPanel({ eater }: { eater: Eater }) {
  const likes = (Object.entries(eater.tastePrefs) as [TasteKey, number][]).filter(([, v]) => v > 0).map(([k]) => TASTE_LABEL[k]);
  const dislikes = (Object.entries(eater.tastePrefs) as [TasteKey, number][]).filter(([, v]) => v < 0).map(([k]) => TASTE_LABEL[k]);
  return (
    <div className="space-y-1.5 rounded-lg bg-stone-100 p-2.5 text-sm">
      <div className="font-semibold">
        {eater.emoji} 食べる人：{eater.name} <span className="text-xs font-normal text-stone-500">{eater.role}</span>
      </div>
      <div>👍 好き：{likes.join("・") || "なし"}　👎 苦手：{dislikes.join("・") || "なし"}</div>
      <div>食感：{eater.texturePrefs.map((t) => TEXTURE_LABEL[t]).join("・")}が好み</div>
      <div>{eater.adventurous < 0.4 ? "慣れた味を好む（保守的）" : eater.adventurous > 0.55 ? "新しい味に興味津々" : "ほどほどに冒険する"}</div>
      <div className="space-y-1 pt-1">
        <Meter label="空腹" value={eater.hunger} />
        <Meter label="疲労" value={eater.fatigue} />
        <Meter label="栄養不足" value={eater.nutritionNeed} />
      </div>
    </div>
  );
}

function QuestDetail({ quest }: { quest: Quest }) {
  const { state, dispatch } = useGame();
  const eater = EATER_MAP[quest.eaterId];
  const [selected, setSelected] = useState<string | null>(null);
  const [last, setLast] = useState<{ result: QuestResult; text: string } | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (last) resultRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [last]);
  const unlocks = [...SPICES, ...TOOLS].filter((x) => x.unlockAfterQuest === quest.id);

  const submit = async () => {
    const dish = state.dishes.find((d) => d.id === selected);
    if (!dish) return;
    const result = judgeQuest(quest, dish, eater);
    const text = await textGenerator.questResult(quest, dish, result);
    dispatch({ type: "questResult", result });
    setLast({ result, text });
  };

  return (
    <div className="space-y-3">
      <p className="rounded-lg bg-amber-50 p-3 text-sm leading-relaxed">
        <span className="font-semibold">{quest.client}：</span>「{quest.request}」
      </p>

      <div className="text-sm">
        <div className="mb-1 font-semibold">評価条件</div>
        <ul className="space-y-0.5">
          {quest.conditions.map((c) => (
            <li key={c.axis}>
              ★ {AXIS_LABEL[c.axis]}（重み{Math.round(c.weight * 100)}%{c.min !== undefined && `・${c.min}以上`}）
            </li>
          ))}
          {quest.requirement && <li>📌 {quest.requirement.label}</li>}
          <li className="text-stone-500">
            依頼評価{quest.passScore}以上・満足度{quest.minExperience}以上で成功
          </li>
        </ul>
      </div>

      <EaterPanel eater={eater} />

      <div>
        <div className="mb-1 text-sm font-semibold">料理を提出</div>
        {state.dishes.length === 0 ? (
          <button className="btn-secondary w-full" onClick={() => dispatch({ type: "navigate", screen: "kitchen" })}>
            まだ料理がありません → 厨房へ
          </button>
        ) : (
          <div className="max-h-64 space-y-1.5 overflow-y-auto">
            {state.dishes.map((d) => (
              <button
                key={d.id}
                onClick={() => setSelected(d.id)}
                className={`flex w-full items-center gap-2 rounded-lg border p-1.5 text-left ${
                  selected === d.id ? "border-amber-500 bg-amber-50" : "border-stone-200 bg-white"
                }`}
              >
                <DishImageView image={d.image} size={40} />
                <span className="min-w-0 flex-1 truncate text-sm">{d.name}</span>
                <RankBadge rank={d.rank} size="sm" />
                <span className="w-7 text-right text-sm tabular-nums">{d.total}</span>
              </button>
            ))}
          </div>
        )}
        {state.dishes.length > 0 && (
          <button className="btn-primary mt-2 w-full" disabled={!selected} onClick={submit}>
            この料理を出す
          </button>
        )}
      </div>

      {last && (
        <div ref={resultRef} className={`rounded-lg p-3 text-sm ${last.result.success ? "bg-emerald-100" : "bg-rose-100"}`}>
          <div className="text-lg font-bold">{last.result.success ? "🎉 依頼成功！" : "😔 依頼失敗"}</div>
          <div className="mb-1">
            依頼評価 <b className="tabular-nums">{last.result.questScore}</b> ／ {eater.name}の満足度{" "}
            <b className="tabular-nums">{last.result.experience}</b>
          </div>
          <p className="mb-1">{last.text}</p>
          {last.result.success && unlocks.length > 0 && (
            <p className="mb-1 font-semibold text-violet-800">
              🔓 解放：{unlocks.map((u) => `${u.emoji}${u.name}`).join("、")}
            </p>
          )}
          <ul className="list-inside list-disc text-xs text-stone-700">
            {last.result.reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function QuestList() {
  const { state } = useGame();
  const firstOpen = QUESTS.find((q, i) => questStatus(q, i, state.clearedQuestIds) === "open");
  const [openId, setOpenId] = useState<string | null>(firstOpen?.id ?? QUESTS[0].id);

  return (
    <div className="space-y-3 p-4">
      {QUESTS.map((q, idx) => {
        const status = questStatus(q, idx, state.clearedQuestIds);
        const expanded = openId === q.id && status !== "locked";
        return (
          <div key={q.id} className="card">
            <button
              className="flex w-full items-center justify-between py-1 text-left"
              disabled={status === "locked"}
              onClick={() => setOpenId(expanded ? null : q.id)}
            >
              <span className="font-bold">
                依頼{idx + 1}：{status === "locked" ? "？？？" : q.title}
              </span>
              <span className="text-sm">
                {status === "cleared" ? "✅ 達成" : status === "open" ? "📜 受付中" : "🔒 未解放"}
              </span>
            </button>
            {expanded && (
              <div className="mt-2">
                <QuestDetail quest={q} />
              </div>
            )}
          </div>
        );
      })}
      {state.clearedQuestIds.length === QUESTS.length && (
        <p className="text-center text-sm text-emerald-700">全依頼達成！究極の料理への旅は続く…</p>
      )}
    </div>
  );
}

/** 勝負 tab: cooking battles (Phase 4) and the village quests (Phase 1). */
export function Quests() {
  const [tab, setTab] = useState<"battle" | "quest">("battle");
  return (
    <div>
      <div className="mx-4 mt-4 grid grid-cols-2 gap-1 rounded-xl bg-stone-200 p-1">
        {([["battle", "⚔️ 料理勝負"], ["quest", "📜 依頼"]] as const).map(([t, l]) => (
          <button key={t} className={`min-h-10 rounded-lg text-sm ${tab === t ? "bg-white font-bold shadow" : "text-stone-600"}`} onClick={() => setTab(t)}>
            {l}
          </button>
        ))}
      </div>
      {tab === "battle" ? <div className="p-4"><BattlePage /></div> : <QuestList />}
    </div>
  );
}
