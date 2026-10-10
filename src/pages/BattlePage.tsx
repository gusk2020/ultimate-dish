import { useState } from "react";
import type { Dish } from "../types";
import type { BattleDef, BattleResult } from "../types/eating";
import { BATTLES, JUDGE_MAP, RIVAL_MAP } from "../data/battles";
import { RECIPE_MAP } from "../data/recipes";
import { INGREDIENT_MAP } from "../data/ingredients";
import { findSchool } from "../game/school/school";
import { formatDays } from "../game/process/simulate";
import { applyBattleResult, battleUnlocked, judgeInfo, judgeKnowledge, runBattle, themeFit } from "../game/battle/battle";
import { newCookingSeed } from "../game/rng";
import { completeAction } from "../game/time/daily";
import { offerEventKitchen } from "../game/kitchen/kitchens";
import { makerBattles, OPPONENT_LIMIT, opponentOf, rivalUnlocked } from "../game/battle/rotation";
import { storyOfMaker } from "../data/stories";
import { locationOf } from "../game/travel/market";
import { codexKeyOf } from "../game/codex/codex";
import { useGame } from "../state/GameContext";
import { DishImageView, RankBadge } from "../components/DishParts";

const KIND = { tutorial: "練習", rematch: "再戦", formal: "正式戦" };
const WINNER = { player: "🏆 あなたの勝ち！", rival: "😣 負け…", draw: "🤝 引き分け" };

function Conditions({ def }: { def: BattleDef }) {
  const c = def.conditions;
  return (
    <ul className="space-y-0.5 text-sm">
      <li>🎯 テーマ：{c.theme.label}</li>
      {c.requiredIngredient && <li>📌 必須食材：{INGREDIENT_MAP[c.requiredIngredient]?.name}</li>}
      {c.forbiddenIngredient && <li>🚫 禁止食材：{INGREDIENT_MAP[c.forbiddenIngredient]?.name}</li>}
      {c.timeLimitDays !== undefined && <li>⏱ 制限時間：{formatDays(c.timeLimitDays)}</li>}
      {c.target && <li>🍽 食べる人：{c.target.label}</li>}
    </ul>
  );
}

function ResultView({ def, result, dish, onRematch, onBack }: {
  def: BattleDef; result: BattleResult; dish: Dish; onRematch: () => void; onBack: () => void;
}) {
  const rival = RIVAL_MAP[def.rivalId];
  const { state } = useGame();
  const inCodex = !!state.world.codex?.[codexKeyOf({ name: dish.name, recipeId: dish.recipeId ?? null })];
  return (
    <div className="space-y-3">
      <div className={`card text-center ${result.winner === "player" ? "bg-amber-50" : ""}`}>
        <div className="text-xl font-bold">{WINNER[result.winner]}</div>
        <div className="mt-1 text-sm tabular-nums">
          あなた {Math.round(result.playerTotal)} ― {Math.round(result.rivalTotal)} {rival.name}
        </div>
      </div>
      <div className="card space-y-1 text-sm">
        <div>あなた：{dish.name}（{dish.total}点）</div>
        <div>{rival.emoji}{rival.name}：{result.rivalDishName}</div>
        <div className="text-xs text-stone-500">相手の調理 {result.rivalOutcome}</div>
      </div>
      {result.verdicts.map((v) => {
        const j = JUDGE_MAP[v.judgeId];
        return (
          <div key={v.judgeId} className="card space-y-1 text-sm">
            <div className="flex justify-between font-semibold">
              <span>{j.emoji}{j.name}</span>
              <span className="tabular-nums">
                <span className={v.player > v.rival ? "text-emerald-700" : ""}>{(v.player / 10).toFixed(1)}</span>
                {" ／ "}
                <span className={v.rival > v.player ? "text-rose-700" : ""}>{(v.rival / 10).toFixed(1)}</span>
              </span>
            </div>
            <p className="text-xs">「{v.comment}」</p>
            <div className="text-[11px] text-stone-500">テーマ適合 {v.playerTheme} / {v.rivalTheme}・好み相性 {v.playerTasting.compatibility} / {v.rivalTasting.compatibility}</div>
          </div>
        );
      })}
      <div className="card text-xs">
        <div className="font-semibold">勝敗の理由</div>
        <ul className="list-inside list-disc">{result.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
        {inCodex && <div className="mt-1 text-emerald-700">📖 審査員の講評が「私の図鑑」に記録された</div>}
        <div className="mt-1">報酬：{result.rewards.map((r) => (r.kind === "xp" ? `経験値+${r.amount}` : r.kind === "money" ? `${r.amount}G` : r.kind === "recipe" ? `レシピ「${RECIPE_MAP[r.id ?? ""]?.name ?? r.id}」を知った（厨房のレシピ帳で条件を確認）` : r.kind)).join("、") || "なし"}</div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button className="btn-secondary" onClick={onBack}>勝負一覧へ</button>
        <button className="btn-primary" onClick={onRematch}>🔁 再戦する</button>
      </div>
    </div>
  );
}

function BattleDetail({ def, onBack }: { def: BattleDef; onBack: () => void }) {
  const { state, dispatch } = useGame();
  const w = state.world;
  const rival = RIVAL_MAP[def.rivalId];
  const [dishId, setDishId] = useState<string | null>(null);
  const [result, setResult] = useState<BattleResult | null>(null);
  const dish = state.dishes.find((d) => d.id === dishId);

  const fight = () => {
    if (!dish) return;
    const r = runBattle(w, def, dish, newCookingSeed());
    // Phase 10: a battle is a main action — one part of the day passes.
    dispatch({ type: "setWorld", world: completeAction(applyBattleResult(w, r, dish), w.day) });
    setResult(r);
    window.scrollTo({ top: 0 });
  };

  if (result && dish) {
    return <ResultView def={def} result={result} dish={dish} onBack={onBack} onRematch={() => { setResult(null); window.scrollTo({ top: 0 }); }} />;
  }

  return (
    <div className="space-y-3">
      <button className="text-sm text-stone-500 underline" onClick={onBack}>← 勝負一覧</button>
      <div className="card space-y-2">
        <h2 className="section-title mb-0">{def.name}</h2>
        <p className="text-xs text-stone-600">{def.intro}</p>
        <Conditions def={def} />
      </div>
      <div className="card text-sm">
        <div className="font-semibold">{rival.emoji} 相手：{rival.name}</div>
        <div className="text-xs text-stone-600">{rival.blurb}</div>
        <div className="text-xs">流派：{findSchool(rival.schoolId).name}・得意：{rival.preferredRecipes.map((id) => RECIPE_MAP[id]?.name).join("、")}</div>
      </div>
      <div className="card space-y-2 text-sm">
        <div className="font-semibold">審査員（{def.judgeIds.length}人）</div>
        {def.judgeIds.map((id) => {
          const j = JUDGE_MAP[id];
          const lv = judgeKnowledge(w, id);
          return (
            <div key={id}>
              <div>{j.emoji}{j.name} <span className="text-[11px] text-stone-500">情報{"●".repeat(lv)}{"○".repeat(3 - lv)}</span></div>
              <div className="text-xs text-stone-600">{judgeInfo(j, lv, def.conditions).join("／")}</div>
            </div>
          );
        })}
      </div>
      <div className="card space-y-1.5">
        <div className="text-sm font-semibold">提出する料理</div>
        {state.dishes.length === 0 && (
          <button className="btn-secondary w-full" onClick={() => dispatch({ type: "navigate", screen: "kitchen" })}>料理がない → 厨房で作る</button>
        )}
        <div className="max-h-72 space-y-1.5 overflow-y-auto">
          {state.dishes.filter((d) => !d.bought).map((d) => {
            const fit = themeFit(d, def.conditions);
            const req = def.conditions.requiredIngredient;
            return (
              <button
                key={d.id}
                className={`flex w-full items-center gap-2 rounded-lg border p-1.5 text-left ${dishId === d.id ? "border-amber-500 bg-amber-50" : "border-stone-200 bg-white"}`}
                onClick={() => setDishId(d.id)}
              >
                <DishImageView image={d.image} size={40} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{d.name}</span>
                  <span className="text-[11px] text-stone-500">
                    テーマ適合{fit}{req && (d.recipe.ingredientIds.includes(req) ? "・必須✓" : "・必須✗")}
                  </span>
                </span>
                <RankBadge rank={d.rank} size="sm" />
              </button>
            );
          })}
        </div>
        <button
          className="btn-secondary w-full text-sm"
          onClick={() => {
            dispatch({ type: "setWorld", world: offerEventKitchen(w, def.name, def.id) });
            dispatch({ type: "navigate", screen: "kitchen" });
          }}
        >
          🎪 主催者の厨房で作る（使用料なし）
        </button>
        <button className="btn-primary w-full py-3" disabled={!dish} onClick={fight}>⚔️ この料理で勝負！</button>
      </div>
    </div>
  );
}

function BattleRow({ b, onOpen }: { b: BattleDef; onOpen: () => void }) {
  const { state } = useGame();
  const w = state.world;
  const open = battleUnlocked(w, b);
  const log = w.battleLog.filter((r) => r.battleId === b.id);
  const wins = log.filter((r) => r.winner === "player").length;
  const draws = log.filter((r) => r.winner === "draw").length;
  const story = storyOfMaker(b.id);
  const opp = opponentOf(w, b.rivalId);
  return (
    <button disabled={!open} className="card w-full text-left disabled:opacity-50" onClick={onOpen}>
      <div className="flex justify-between">
        <span className="font-bold">{open ? b.name : "？？？"}</span>
        <span className="text-xs text-stone-500">{KIND[b.kind]}・審査{b.judgeIds.length}人</span>
      </div>
      <div className="text-xs text-stone-600">
        {open ? `${RIVAL_MAP[b.rivalId].name}／${b.conditions.theme.label}` : "前の勝負を終えると解放"}
        {log.length > 0 && `・戦績 ${wins}勝${log.length - wins - draws}敗${draws}分`}
        {open && `・この相手と${opp.matches}/${OPPONENT_LIMIT}戦`}
      </div>
      {story && <div className="text-[10px] text-stone-400">🔁 物語「{story.title}」— 食べる側は審査する側で関わる</div>}
    </button>
  );
}

export function BattlePage() {
  const { state } = useGame();
  const w = state.world;
  const [openId, setOpenId] = useState<string | null>(null);
  const def = BATTLES.find((b) => b.id === openId);
  if (def) return <BattleDetail def={def} onBack={() => setOpenId(null)} />;
  const { main, rematch } = makerBattles(w);
  const here = locationOf(w).id;
  // Battles here still waiting on an earlier one (shown as ？？？).
  const locked = BATTLES.filter((b) => (b.locationId ?? "village") === here && rivalUnlocked(w, b.rivalId) && !battleUnlocked(w, b));

  return (
    <div className="space-y-2">
      <p className="text-xs text-stone-500">一皿勝負。審査員が食べて採点します。同じ相手とは{OPPONENT_LIMIT}戦まで。済んだら次の相手が現れ、前の相手は「再戦」へ。</p>
      {main.length === 0 && locked.length === 0 && <p className="card text-sm text-stone-500">現在、この土地で受けられる勝負はない</p>}
      {[...main, ...locked].map((b) => <BattleRow key={b.id} b={b} onOpen={() => setOpenId(b.id)} />)}
      {rematch.length > 0 && <h3 className="pt-2 text-xs font-semibold text-stone-500">🔁 再戦</h3>}
      {rematch.map((b) => <BattleRow key={b.id} b={b} onOpen={() => setOpenId(b.id)} />)}
    </div>
  );
}
