import { useState } from "react";
import { itemInfo } from "../data/items";
import { METHOD_MAP } from "../data/methods";
import { RECIPE_MAP } from "../data/recipes";
import { LOCATION_MAP, REGION_MAP } from "../data/regions";
import { recipeStatus } from "../game/learning/recipeBook";
import { newCookingSeed } from "../game/rng";
import { hasCompanion, getCharacter, line } from "../game/social/companion";
import { marketList } from "../game/travel/market";
import {
  companionNames, cuisineLine, destinations, isHome, learnRegionalRecipe, locationOf, planTravel, regionOf, travel, travelCompanions,
  unlockText, type FreshnessChange, type TravelResult,
} from "../game/travel/travel";
import { useGame } from "../state/GameContext";
import { FoundingCard, FoundingNotice } from "../components/FoundingCard";
import { MarketList } from "../components/MarketList";
import { VillageMap } from "./VillageMap";

// 現在地: the village map at home, a region page anywhere else, and the travel planner.
// Everything here is text and cards; the map data itself is a graph and knows no coordinates.

const pct = (v: number) => `${Math.round(v * 100)}%`;
const methodNames = (ids: string[]) => ids.map((id) => METHOD_MAP[id]?.name ?? id).join("・");
const STATUS = { unknown: "未知", known: "知っている（条件未達）", trialAvailable: "試作可能", mastered: "習得済み" } as const;

function freshnessText(list: FreshnessChange[]): string {
  if (!list.length) return "鮮度が大きく落ちる食材はない";
  const spoiled = list.filter((f) => f.spoiled).length;
  return `生鮮品は鮮度が落ちます：${list.slice(0, 3).map((f) => `${f.emoji}${f.name} ${pct(f.before)}→${pct(f.after)}`).join("、")}${list.length > 3 ? " ほか" : ""}${spoiled ? `（${spoiled}品が傷む）` : ""}`;
}

function TravelEntry({ onPlan, onFounding }: { onPlan: () => void; onFounding: () => void }) {
  const { state } = useGame();
  const loc = locationOf(state.world);
  return (
    <div className="card flex items-center justify-between gap-2">
      <div className="min-w-0">
        <div className="text-[11px] text-stone-500">現在地</div>
        <div className="text-sm font-bold">{loc.emoji}{loc.name}</div>
      </div>
      <div className="flex shrink-0 gap-1.5">
        <button className="btn-primary px-3 text-sm" onClick={onPlan}>🧭 旅に出る</button>
        <button className="btn-secondary px-2 text-sm" onClick={onFounding}>🏯 流派</button>
      </div>
    </div>
  );
}

function Specialties() {
  const { state, dispatch } = useGame();
  const w = state.world;
  const region = regionOf(w);
  const [msg, setMsg] = useState("");
  return (
    <div className="card space-y-2">
      <h2 className="section-title mb-0">🍽 名物料理</h2>
      {msg && <p className="text-xs text-emerald-800">{msg}</p>}
      {region.specialtyRecipeIds.map((id) => {
        const r = RECIPE_MAP[id];
        const st = recipeStatus(w, id);
        return (
          <div key={id} className="space-y-1 rounded-lg border border-stone-200 p-2">
            <div className="flex items-start justify-between gap-2">
              <span className="min-w-0 font-semibold">{r.name}</span>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] ${st === "mastered" ? "bg-amber-200 text-amber-900" : st === "trialAvailable" ? "bg-emerald-100 text-emerald-800" : "bg-stone-100 text-stone-700"}`}>{STATUS[st]}</span>
            </div>
            <div className="text-xs text-stone-600">{r.lore}</div>
            <div className="text-[11px] text-stone-500">{[...r.ingredients, ...r.seasonings].map((l) => `${itemInfo(l.itemId)?.emoji}${itemInfo(l.itemId)?.name}`).join(" ")}</div>
            {st === "unknown" && (
              <button
                className="btn-secondary w-full text-sm"
                onClick={() => {
                  const res = learnRegionalRecipe(w, id);
                  if (typeof res === "string") return setMsg(res);
                  dispatch({ type: "setWorld", world: res.world });
                  setMsg(`📕 「${r.name}」の作り方を教わった（厨房のレシピ帳に載った）`);
                }}
              >
                📖 作り方を教わる
              </button>
            )}
            {(st === "known" || st === "trialAvailable") && (
              <button className="btn-secondary w-full text-sm" onClick={() => dispatch({ type: "navigate", screen: "kitchen" })}>
                {st === "trialAvailable" ? "🧪 厨房で試作する" : "厨房のレシピ帳で条件を見る"}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

function RegionView() {
  const { state } = useGame();
  const w = state.world;
  const loc = locationOf(w);
  const region = regionOf(w);
  const local = marketList(w).local;
  const last = w.travel.travelLog[w.travel.travelLog.length - 1];
  return (
    <div className="space-y-3 p-4">
      <div className="card space-y-1">
        <div className="text-lg font-bold">{loc.emoji} {loc.name}</div>
        <div className="text-[11px] text-stone-500">{region.name}</div>
        <p className="text-sm">{loc.description}</p>
        <p className="text-sm font-semibold text-amber-800">{cuisineLine(region.cuisine)}</p>
        <p className="text-xs text-stone-600">「{region.philosophy}」</p>
        <div className="text-xs text-stone-600">よく使う調理：{methodNames(region.favouredMethods)}／保存：{methodNames(region.preservation)}</div>
        <div className="text-xs text-stone-600">地元の食材：{local.map((r) => `${itemInfo(r.itemId)?.emoji}${itemInfo(r.itemId)?.name}`).join(" ")}</div>
      </div>
      <Specialties />
      <MarketList />
      {last && last.to === loc.id && (
        <div className="text-center text-[11px] text-stone-500">
          {last.day}日目に{LOCATION_MAP[last.from]?.name}を発ち、{last.days}日かけて到着{last.companions.length ? `（同行：${companionNames(w, last.companions)}）` : ""}
        </div>
      )}
    </div>
  );
}

function TravelPlanner({ onCancel, onTravelled }: { onCancel: () => void; onTravelled: (r: TravelResult) => void }) {
  const { state, dispatch } = useGame();
  const w = state.world;
  const here = locationOf(w);
  const allowed = travelCompanions(w);
  const [to, setTo] = useState<string | null>(null);
  const [companions, setCompanions] = useState<string[]>(hasCompanion(w) ? [w.social.companion!.id] : []);
  const [msg, setMsg] = useState("");
  const plan = to ? planTravel(w, to, companions) : null;
  const via = plan?.route ? plan.route.path.slice(1, -1).map((id) => LOCATION_MAP[id]?.name).join("・") : "";

  return (
    <div className="space-y-3 p-4">
      <button className="text-sm text-stone-500 underline" onClick={onCancel}>← {here.name}にもどる</button>
      <div className="card text-sm">📍 現在地：{here.emoji}{here.name}</div>
      <h2 className="section-title mb-0">行き先</h2>
      {destinations(w).map((d) => {
        const v = d.route ? d.route.path.slice(1, -1).map((id) => LOCATION_MAP[id]?.shortName).join("・") : "";
        return (
          <button
            key={d.loc.id}
            disabled={!d.unlocked}
            className={`card w-full text-left disabled:opacity-50 ${to === d.loc.id ? "border-amber-500 bg-amber-50" : ""}`}
            onClick={() => setTo(d.loc.id)}
          >
            <div className="flex justify-between gap-2">
              <span className="min-w-0 font-bold">{d.loc.emoji}{d.loc.name}</span>
              <span className="shrink-0 text-xs text-stone-600">{d.route ? `片道${d.route.days}日` : "🔒"}</span>
            </div>
            <div className="text-xs text-stone-600">
              {d.unlocked ? `${cuisineLine(REGION_MAP[d.loc.regionId].cuisine)}${v ? `（${v}経由）` : ""}` : unlockText(d.loc)}
            </div>
          </button>
        );
      })}

      {plan && plan.route && (
        <div className="card space-y-1.5 text-sm">
          <div className="font-semibold">🧳 {LOCATION_MAP[plan.to].name}への旅</div>
          <div>片道{plan.route.days}日{via && `（${via}経由）`}・{plan.partySize}人</div>
          <div>
            携行食 {plan.provisions.needed}食（自動）：
            {plan.provisions.fromStockTotal > 0 && `保存食${plan.provisions.fromStockTotal}食を使う`}
            {plan.provisions.fromStockTotal > 0 && plan.provisions.bought > 0 && "・"}
            {plan.provisions.bought > 0 && `${plan.provisions.bought}食を購入（${plan.provisions.cost}G）`}
          </div>
          {plan.provisions.hungry > 0 && <div className="text-xs text-rose-700">所持金が足りず{plan.provisions.hungry}食分は空腹で歩く（体力が少し減る）</div>}
          <div className="text-xs text-stone-600">{freshnessText(plan.freshness)}</div>
          {allowed.length > 0 && (
            <>
              <div className="text-xs text-stone-500">同行者</div>
              <div className="flex flex-wrap gap-1.5">
                {allowed.map((id) => {
                  const c = getCharacter(w, id)!;
                  const on = companions.includes(id);
                  return (
                    <button key={id} className={`chip min-h-10 px-3 text-sm ${on ? "chip-on" : ""}`} onClick={() => setCompanions(on ? companions.filter((x) => x !== id) : [...companions, id])}>
                      {c.emoji}{c.name}
                    </button>
                  );
                })}
              </div>
            </>
          )}
          {plan.problems.length > 0 && <p className="text-xs text-rose-700">{plan.problems.join("、")}</p>}
          {msg && <p className="text-xs text-red-700">{msg}</p>}
          <button
            className="btn-primary w-full py-3"
            disabled={plan.problems.length > 0}
            onClick={() => {
              const r = travel(w, plan, newCookingSeed());
              if (typeof r === "string") return setMsg(r);
              dispatch({ type: "setWorld", world: r.world });
              onTravelled(r);
              window.scrollTo({ top: 0 });
            }}
          >
            🚶 出発する
          </button>
        </div>
      )}
    </div>
  );
}

function TravelResultView({ result, onClose, onFounding }: { result: TravelResult; onClose: () => void; onFounding: () => void }) {
  const { state } = useGame();
  const w = state.world;
  const log = result.log;
  const to = LOCATION_MAP[log.to];
  const comp = hasCompanion(w) && log.companions.includes(w.social.companion!.id) ? w.social.companion! : null;
  return (
    <div className="space-y-3 p-4">
      <div className="card space-y-1 text-sm">
        <div className="text-lg font-bold">🧳 {to.emoji}{to.name}に着いた</div>
        {result.firstVisit && <div className="text-xs font-semibold text-amber-800">初めて訪れる土地。{cuisineLine(REGION_MAP[to.regionId].cuisine)}</div>}
        <div>{log.days}日の旅{log.via.length > 0 && `（${log.via.map((id) => LOCATION_MAP[id]?.name).join("・")}経由）`}</div>
        <div>携行食：保存食{log.mealsFromStock}食・購入{log.mealsBought}食（{log.foodCost}G）{log.hungryMeals > 0 && `・空腹${log.hungryMeals}食`}</div>
        <div>同行：{log.companions.length ? `${companionNames(w, log.companions)}（一緒に旅した回数+1）` : "ひとり旅"}</div>
        {log.event && <div className="text-xs text-sky-700">☔ {log.event}</div>}
        <div className="text-xs text-stone-600">{freshnessText(result.freshness).replace("落ちます", "落ちた")}</div>
        {comp && <p className="rounded-lg bg-stone-100 p-1.5 text-xs">{comp.emoji}「{line(comp, "talk", log.day)}」</p>}
      </div>
      <FoundingNotice onOpen={onFounding} />
      <button className="btn-primary w-full" onClick={onClose}>{to.name}を見て回る</button>
    </div>
  );
}

export function LocationPage() {
  const { state } = useGame();
  const [view, setView] = useState<"here" | "plan" | TravelResult>("here");
  const [showFounding, setShowFounding] = useState(false);

  if (view === "plan") return <TravelPlanner onCancel={() => setView("here")} onTravelled={(r) => setView(r)} />;
  if (typeof view === "object") return <TravelResultView result={view} onClose={() => setView("here")} onFounding={() => { setShowFounding(true); setView("here"); }} />;

  return (
    <div>
      <div className="space-y-2 px-4 pt-4">
        <FoundingNotice onOpen={() => setShowFounding(true)} />
        <TravelEntry onPlan={() => setView("plan")} onFounding={() => setShowFounding(!showFounding)} />
        {showFounding && <FoundingCard />}
      </div>
      {isHome(state.world) ? <VillageMap /> : <RegionView />}
    </div>
  );
}
