import { useState } from "react";
import type { Dish } from "../types";
import type { DishStock, FinishInput } from "../types/world";
import { itemInfo } from "../data/items";
import { TOOL_MAP } from "../data/magic";
import { maxStamina, STAT_LABEL } from "../game/chef/stats";
import { formatDays } from "../game/process/simulate";
import {
  buyShortage, finishCook, openFailures, planCook, recoverOnce, startCook, type CookSession,
} from "../game/commerce/simpleCook";
import { recommendedPrice } from "../game/commerce/sales";
import { EMPTY_FINISH, reviewFinish } from "../game/finish/finish";
import { findSchool } from "../game/school/school";
import type { CookingGains } from "../game/world";
import type { LearningEvent } from "../types/learning";
import { getRecipe, recipeStatus } from "../game/learning/recipeBook";
import { newCookingSeed } from "../game/rng";
import { SKILL_MAP } from "../data/phase2";
import { textGenerator } from "../services/textGeneration";
import { imageGenerator } from "../services/imageGeneration";
import { useGame } from "../state/GameContext";
import { DishDetail } from "../components/DishDetail";
import { FinishForm } from "../components/FinishForm";
import { TastingView } from "../components/TastingView";
import { GRADE_LABEL, GRADE_STYLE } from "./LineKitchen";
import { IdeaAdopt, LearningResult, RecipeBookList, RecipeInfo } from "../components/RecipeBook";
import { CoopResultView, ShareMealPanel } from "../components/SocialParts";
import type { CoopResult } from "../game/social/coop";
import { canCookAsMain } from "../game/social/coop";
import { hasCompanion, line } from "../game/social/companion";
import { availableHelpers, partyMembers } from "../game/social/allies";
import { PLAYER } from "../game/social/relations";
import { RECIPE_MAP } from "../data/recipes";

const PORTIONS = [1, 2, 5, 10];

/** レシピ調理: pick a recipe and a portion count; the steps are judged behind the scenes. */
export function RecipeKitchen() {
  const { state, dispatch } = useGame();
  const w = state.world;
  const [recipeId, setRecipeId] = useState<string | null>(null);
  const [portions, setPortions] = useState(5);
  const [toolId, setToolId] = useState<string | null>(null);
  const [session, setSession] = useState<CookSession | null>(null);
  const [phase, setPhase] = useState<"plan" | "cooked" | "finish">("plan");
  const [finish, setFinish] = useState<FinishInput>(EMPTY_FINISH);
  const [done, setDone] = useState<{ dish: Dish; stock: DishStock; gains: CookingGains; learning: LearningEvent; name: string; coop: CoopResult | null; mainId: string } | null>(null);
  const [mainId, setMainId] = useState(PLAYER);
  const [helperId, setHelperId] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [ideaId, setIdeaId] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [tasting, setTasting] = useState(false);

  const setWorld = (world: typeof w) => dispatch({ type: "setWorld", world });
  const reset = () => {
    setRecipeId(null); setSession(null); setPhase("plan"); setFinish(EMPTY_FINISH); setDone(null); setMsg(""); setToolId(null); setTasting(false); setIdeaId(null);
    setMainId(PLAYER); setHelperId(null); setSharing(false);
  };

  // ---------- Done ----------
  if (done) {
    const stock = w.dishStock.find((s) => s.id === done.stock.id);
    const g = done.gains;
    return (
      <div className="space-y-3">
        <div className="text-center text-sm font-semibold text-emerald-700">✨ {done.stock.portions}食 完成！図鑑に登録しました</div>
        <div className="card"><DishDetail dish={state.dishes.find((d) => d.id === done.dish.id) ?? done.dish} showMeta={false} /></div>
        {done.coop && <CoopResultView coop={done.coop} />}
        {done.mainId === PLAYER && (
          <LearningResult name={done.name} event={done.learning} onIdea={() => { const id = done.learning.newIdeas[0]?.id; reset(); if (id) setIdeaId(id); }} />
        )}
        <div className="card text-sm">
          <div>経験値 +{g.xp}{g.levelUps.map((l) => `　🎉 Lv${l.level}！（${Object.entries(l.gains).map(([k, v]) => `${STAT_LABEL[k as keyof typeof STAT_LABEL]}+${v}`).join(" ")}）`).join("")}</div>
          <div className="text-xs text-stone-600">熟練：{Object.entries(g.skillXp).map(([k, v]) => `${SKILL_MAP[k as keyof typeof SKILL_MAP]?.name ?? k}+${v}`).join("、") || "なし"}</div>
          <div className="text-xs text-stone-600">残り {stock?.portions ?? 0}食・推奨価格 {recommendedPrice(done.stock)}G</div>
        </div>
        {msg && <p className="text-xs text-red-700">{msg}</p>}
        {tasting && (
          <TastingView dish={state.dishes.find((d) => d.id === done.dish.id) ?? done.dish} stockId={done.stock.id} onClose={() => setTasting(false)} />
        )}
        {sharing && stock && (
          <ShareMealPanel initialEaters={hasCompanion(w) ? [w.social.companion!.id] : []} stockId={stock.id} onClose={() => setSharing(false)} />
        )}
        <div className="grid grid-cols-2 gap-2">
          <button
            className="btn-primary col-span-2"
            disabled={!stock}
            onClick={() => {
              setWorld({ ...w, dishStock: w.dishStock.map((s) => (s.id === done.stock.id ? { ...s, listed: true } : s)) });
              dispatch({ type: "navigate", screen: "sales" });
            }}
          >
            🏪 総菜販売へ回す
          </button>
          <button className="btn-secondary" disabled={!stock || tasting} onClick={() => setTasting(true)}>
            🍴 自分で食べる
          </button>
          <button className="btn-secondary" onClick={() => dispatch({ type: "navigate", screen: "quests" })}>⚔️ 依頼・勝負へ</button>
          {(hasCompanion(w) || Object.keys(w.social.relations).length > 0) && (
            <button className="btn-secondary col-span-2" disabled={!stock || sharing} onClick={() => setSharing(true)}>
              {hasCompanion(w) ? `${w.social.companion!.emoji} ${w.social.companion!.name}に食べてもらう` : "🍽 誰かにふるまう"}
            </button>
          )}
          <button className="btn-secondary col-span-2" onClick={reset}>次の料理を作る</button>
        </div>
      </div>
    );
  }

  // ---------- Derivation idea ----------
  if (ideaId) {
    return <IdeaAdopt key={ideaId} ideaId={ideaId} onClose={() => setIdeaId(null)} onAdopted={(id) => { setIdeaId(null); setRecipeId(id); setToolId(null); }} />;
  }

  // ---------- Recipe book ----------
  const recipe = recipeId ? getRecipe(w, recipeId) : undefined;
  if (!recipeId || !recipe) {
    const signatures = partyMembers(w).flatMap((c) => c.signatureRecipeIds.filter((id) => canCookAsMain(w, c.id, id)).map((id) => ({ c, id })));
    return (
      <div className="space-y-2">
        {signatures.length > 0 && (
          <div className="card space-y-1">
            <div className="text-xs font-semibold text-stone-600">仲間が主担当で作れる料理</div>
            {signatures.map(({ c, id }) => (
              <button key={`${c.id}-${id}`} className="flex w-full items-center justify-between rounded-lg border border-stone-200 p-2 text-left text-sm" onClick={() => { setRecipeId(id); setToolId(null); setMainId(c.id); }}>
                <span>{c.emoji}{c.name}の「{RECIPE_MAP[id]?.name ?? id}」</span>
                <span className="text-xs text-stone-500">主担当：{c.name}</span>
              </button>
            ))}
          </div>
        )}
        <RecipeBookList
          schoolName={findSchool(w.chef.activeSchoolId, w.customSchools).name}
          onPick={(id) => { setRecipeId(id); setToolId(null); setMainId(PLAYER); }}
          onIdea={setIdeaId}
        />
      </div>
    );
  }

  const helpers = availableHelpers(w).filter((c) => c.id !== mainId);
  const helper = helperId && helpers.some((c) => c.id === helperId) ? helperId : null;
  const mains = [PLAYER, ...partyMembers(w).filter((c) => canCookAsMain(w, c.id, recipeId)).map((c) => c.id)];
  const team = { mainId, assistantIds: helper ? [helper] : [] };
  const plan = planCook(w, recipeId, portions, toolId, team);
  const trial = mainId === PLAYER && recipeStatus(w, recipeId) !== "mastered";
  const teamChars = [mainId, ...plan.team.assistantIds].filter((id) => id !== PLAYER).map((id) => helpers.concat(partyMembers(w)).find((c) => c.id === id)!).filter(Boolean);

  // ---------- Cooked: step results, recovery ----------
  if (session && phase !== "plan") {
    const judged = Object.entries(session.labels).map(([i, label]) => ({ label, o: session.result.outcomes[Number(i)] }));
    const fails = openFailures(session);
    if (phase === "finish") {
      return (
        <div className="space-y-3">
          <FinishForm finish={finish} onChange={setFinish} context={{
            ingredientNames: recipe.ingredients.map((l) => itemInfo(l.itemId)?.name ?? l.itemId),
            schoolName: findSchool(w.chef.activeSchoolId, w.customSchools).name,
            finalName: recipe.name,
          }} />
          <div className="grid grid-cols-2 gap-2">
            <button className="btn-secondary" onClick={() => setPhase("cooked")}>戻る</button>
            <button
              className="btn-primary"
              onClick={async () => {
                const review = reviewFinish(finish);
                const out = finishCook(w, session, review.normalized, review);
                const [description, image] = await Promise.all([
                  textGenerator.describeDish(out.dish, { schoolName: findSchool(w.chef.activeSchoolId, w.customSchools).name }),
                  imageGenerator.generate(out.dish),
                ]);
                const dish: Dish = { ...out.dish, description, image };
                dispatch({ type: "addDish", dish });
                setWorld(out.world);
                setDone({ dish, stock: out.stock, gains: out.gains, learning: out.learning, name: recipe.name, coop: out.coop, mainId: session.team.mainId });
                window.scrollTo({ top: 0 });
              }}
            >
              🍽️ 完成！
            </button>
          </div>
        </div>
      );
    }
    return (
      <div className="space-y-3">
        <div className="card">
          <h2 className="section-title">{recipe.name}　{session.portions}食</h2>
          {session.team.assistantIds.length > 0 && (
            <div className="mb-1 text-xs text-stone-600">🤝 {[session.team.mainId, ...session.team.assistantIds].map((id) => (id === PLAYER ? "あなた" : partyMembers(w).concat(availableHelpers(w)).find((c) => c.id === id)?.name ?? id)).join("＋")}（主担当が先）</div>
          )}
          <ul className="space-y-1.5">
            {judged.map(({ label, o }, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="w-24 shrink-0">{label}</span>
                <span className={`rounded px-2 py-0.5 text-xs font-semibold ${GRADE_STYLE[o.grade]}`}>{GRADE_LABEL[o.grade]}</span>
                {o.failure && <span className="text-xs text-rose-700">{o.failure}</span>}
                {o.note && <span className="text-xs text-sky-700">{o.note}</span>}
              </li>
            ))}
          </ul>
          {fails.length > 0 && <p className="mt-2 text-xs text-rose-700">残っている失敗：{fails.join("、")}</p>}
          {trial && <p className="mt-1 text-xs text-emerald-800">🧪 試作中：失敗が残らず、ランクD以外で仕上がれば習得{fails.length > 0 && "（挽回すると習得に近づく）"}</p>}
          {msg && <p className="mt-1 text-xs text-red-700">{msg}</p>}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            className="btn-secondary"
            disabled={fails.length === 0}
            onClick={() => {
              const r = recoverOnce(w, session);
              if (typeof r === "string") return setMsg(r);
              setMsg("");
              setWorld(r.world);
              setSession(r.session);
            }}
          >
            🩹 挽回する<br /><span className="text-[10px] font-normal">体力4・少し時間</span>
          </button>
          <button className="btn-primary" onClick={() => setPhase("finish")}>仕上げへ →</button>
        </div>
      </div>
    );
  }

  // ---------- Plan: portions, shortage, bulk buy ----------
  const custom = !PORTIONS.includes(portions);
  return (
    <div className="space-y-3">
      <button className="text-sm text-stone-500 underline" onClick={() => setRecipeId(null)}>← レシピ一覧</button>
      <div className="card space-y-2">
        <h2 className="section-title mb-0">{trial && <span className="mr-1 rounded bg-emerald-100 px-1.5 py-0.5 text-xs text-emerald-800">試作</span>}{recipe.name}</h2>
        {mainId === PLAYER ? <RecipeInfo w={w} id={recipeId} /> : <div className="text-xs text-violet-800">{teamChars[0]?.emoji}{teamChars[0]?.name}の得意料理（主担当：{teamChars[0]?.name}・あなたは補助）</div>}
        <div className="text-xs text-stone-500">何食分作る？</div>
        <div className="grid grid-cols-5 gap-1.5">
          {PORTIONS.map((n) => (
            <button key={n} className={`chip ${portions === n ? "chip-on" : ""}`} onClick={() => setPortions(n)}>{n}食</button>
          ))}
          <input
            type="number" min={1} max={99} inputMode="numeric" aria-label="食数"
            className={`min-h-12 w-full rounded-xl border px-1 text-center text-base ${custom ? "border-amber-500 bg-amber-50" : "border-stone-200"}`}
            value={portions}
            onChange={(e) => setPortions(Math.max(1, Math.min(99, Number(e.target.value) || 1)))}
          />
        </div>
        <div className="text-xs text-stone-500">魔導具（任意）</div>
        <div className="flex flex-wrap gap-1.5">
          <button className={`chip min-h-10 px-3 ${toolId === null ? "chip-on" : ""}`} onClick={() => setToolId(null)}>使わない</button>
          {recipe.toolCompat.map((t) => {
            const st = w.tools.find((x) => x.toolId === t);
            return (
              <button key={t} disabled={!st || st.durability <= 0} className={`chip min-h-10 px-3 ${toolId === t ? "chip-on" : ""}`} onClick={() => setToolId(t)}>
                {TOOL_MAP[t]?.emoji}{TOOL_MAP[t]?.name}<span className="text-[10px]">耐久{st?.durability}</span>
              </button>
            );
          })}
        </div>
      </div>

      {(helpers.length > 0 || mains.length > 1) && (
        <div className="card space-y-1.5">
          <div className="text-sm font-semibold">🤝 一緒に作る</div>
          {mains.length > 1 && (
            <>
              <div className="text-xs text-stone-500">主担当</div>
              <div className="flex flex-wrap gap-1.5">
                {mains.map((id) => {
                  const c = partyMembers(w).find((x) => x.id === id);
                  return (
                    <button key={id} className={`chip min-h-10 px-3 text-sm ${mainId === id ? "chip-on" : ""}`} onClick={() => { setMainId(id); if (helperId === id) setHelperId(null); }}>
                      {c ? `${c.emoji}${c.name}` : "🧑‍🍳あなた"}
                    </button>
                  );
                })}
              </div>
            </>
          )}
          <div className="text-xs text-stone-500">補助役</div>
          <div className="flex flex-wrap gap-1.5">
            <button className={`chip min-h-10 px-3 text-sm ${helper === null ? "chip-on" : ""}`} onClick={() => setHelperId(null)}>{mainId === PLAYER ? "ひとりで" : "あなただけ"}</button>
            {helpers.map((c) => (
              <button key={c.id} className={`chip min-h-10 px-3 text-sm ${helper === c.id ? "chip-on" : ""}`} onClick={() => setHelperId(c.id)}>
                {c.emoji}{c.name}{c.kind === "ally" && !w.social.party.includes(c.id) ? "（手伝い）" : ""}
              </button>
            ))}
          </div>
          {teamChars[0]?.dialogue.beforeCook && <p className="rounded-lg bg-stone-100 p-1.5 text-xs">{teamChars[0].emoji}「{line(teamChars[0], "beforeCook")}」</p>}
          {plan.coop.notes.length > 0 && (
            <ul className="text-[11px] text-stone-600">
              {plan.coop.notes.map((n) => <li key={n}>・{n}</li>)}
              <li className="font-semibold text-stone-700">成功率への補正 合計 {plan.coop.chance >= 0 ? "+" : "−"}{Math.abs(plan.coop.chance * 100).toFixed(1)}%</li>
            </ul>
          )}
        </div>
      )}

      <div className="card">
        <h2 className="section-title">必要な素材</h2>
        <table className="w-full text-sm">
          <thead><tr className="text-xs text-stone-500"><th className="text-left font-normal">素材</th><th className="font-normal">必要</th><th className="font-normal">在庫</th><th className="font-normal">不足</th></tr></thead>
          <tbody>
            {plan.lines.map((l) => (
              <tr key={l.itemId} className={l.short > 0 ? "text-rose-700" : ""}>
                <td>{itemInfo(l.itemId)?.emoji}{itemInfo(l.itemId)?.name}</td>
                <td className="text-center tabular-nums">{l.need}</td>
                <td className="text-center tabular-nums">{l.have}</td>
                <td className="text-center tabular-nums">{l.short > 0 ? Math.ceil(l.short) : "−"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {plan.shortCost > 0 && (
          <button
            className="btn-secondary mt-2 w-full"
            disabled={plan.shortCost > w.chef.money}
            onClick={() => {
              const r = buyShortage(w, plan);
              if (typeof r === "string") setMsg(r);
              else { setMsg(""); setWorld(r); }
            }}
          >
            🛒 不足素材を一括購入（{plan.shortCost}G / 所持{Math.floor(w.chef.money)}G）
          </button>
        )}
      </div>

      <div className="card grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
        <div>時間 {formatDays(plan.timeDays)}</div>
        <div>原価 {Math.round(plan.unitCost * plan.portions)}G（1食{plan.unitCost}G）</div>
        <div className={plan.stamina > w.chef.stamina ? "text-rose-700" : ""}>体力 −{plan.stamina}（{Math.round(w.chef.stamina)}/{maxStamina(w.chef)}）</div>
        <div>MP −{plan.mp}（{w.chef.mp}）</div>
        <div className="col-span-2 text-stone-500">今の体力で作れる目安：約{plan.maxPortionsByStamina}食</div>
        {plan.tired && <div className="col-span-2 text-rose-700">⚠ 体力が少ない：成功率低下・時間増加・大失敗しやすい</div>}
        {plan.stamina > w.chef.stamina && <div className="col-span-2 text-rose-700">⚠ 体力が足りない。無理をすると失敗しやすい</div>}
      </div>

      {msg && <p className="text-xs text-red-700">{msg}</p>}
      {plan.problems.length > 0 && <p className="text-xs text-rose-700">{plan.problems.join("、")}</p>}
      <button
        className="btn-primary w-full py-3.5 text-lg"
        disabled={plan.problems.length > 0}
        onClick={() => {
          const r = startCook(w, plan, newCookingSeed());
          if (typeof r === "string") return setMsg(r);
          setMsg("");
          setWorld(r.world);
          setSession(r.session);
          setPhase("cooked");
        }}
      >
        {trial ? "🧪 試作開始" : "🔥 調理開始"}
      </button>
    </div>
  );
}
