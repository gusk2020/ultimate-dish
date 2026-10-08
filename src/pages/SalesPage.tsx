import { useState } from "react";
import { SEGMENTS, SHOPS, SLOT_ORDER, SLOTS } from "../data/commerce";
import { SALES_TAG_LABEL, type SalesTag } from "../data/recipes";
import { maxStamina } from "../game/chef/stats";
import { canContract, contractRate, expectedContractIncome, signContract } from "../game/commerce/contracts";
import { discardStock, discountStock, endDay, reprocessStock, staffMeal, type DailyReport } from "../game/commerce/day";
import { effectivePrice, expectedDemand, marketFor, recommendedPrice } from "../game/commerce/sales";
import { newCookingSeed } from "../game/rng";
import { rest } from "../game/world";
import { useGame } from "../state/GameContext";
import type { DishStock } from "../types/world";

const tagText = (tags: string[]) => tags.map((t) => SALES_TAG_LABEL[t as SalesTag] ?? t).join("・");

function StockCard({ s }: { s: DishStock }) {
  const { state, dispatch } = useGame();
  const w = state.world;
  const recP = recommendedPrice(s);
  const price = effectivePrice(s);
  const market = marketFor(w.fame, w.trends, Math.max(1, w.dishStock.filter((x) => x.listed).length + (s.listed ? 0 : 1)));
  const demand = expectedDemand(s, price, market);
  const expectedSold = Math.min(s.portions, Math.round(demand.reduce((a, d) => a + d.expected, 0)));
  const update = (patch: Partial<DishStock>) =>
    dispatch({ type: "setWorld", world: { ...w, dishStock: w.dishStock.map((x) => (x.id === s.id ? { ...x, ...patch } : x)) } });
  const ratio = price / recP;

  return (
    <div className={`card space-y-2 ${s.listed ? "ring-2 ring-amber-400" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-bold">{s.name}</div>
          <div className="text-[11px] text-stone-500">在庫{s.portions}食・評価{s.total}・鮮度{Math.round(s.freshness * 100)}%・{tagText(s.tags)}</div>
        </div>
        <button className={`chip min-h-10 shrink-0 px-3 ${s.listed ? "chip-on" : ""}`} onClick={() => update({ listed: !s.listed })}>
          {s.listed ? "✅ 販売する" : "販売しない"}
        </button>
      </div>
      <div className="flex items-center gap-2">
        <button className="icon-btn border border-stone-200" onClick={() => update({ price: Math.max(1, price - 1) })}>−</button>
        <input
          type="range" min={Math.max(1, Math.round(recP * 0.5))} max={Math.round(recP * 1.5)} value={Math.min(Math.round(recP * 1.5), price)}
          className="flex-1 accent-amber-600" aria-label="価格"
          onChange={(e) => update({ price: Number(e.target.value) })}
        />
        <button className="icon-btn border border-stone-200" onClick={() => update({ price: price + 1 })}>＋</button>
        <input
          type="number" inputMode="numeric" min={1} aria-label="価格を入力"
          className="w-16 rounded-lg border border-stone-300 px-1 py-1.5 text-center text-base"
          value={price}
          onChange={(e) => update({ price: Math.max(1, Number(e.target.value) || 1) })}
        />
      </div>
      <div className="flex justify-between text-xs">
        <span>推奨 {recP}G・設定 <b className={ratio > 1.5 ? "text-rose-700" : ratio < 0.7 ? "text-sky-700" : ""}>{price}G</b>{s.discounted && "（値下げ中）"}</span>
        <button className="text-stone-500 underline" onClick={() => update({ price: 0 })}>推奨に戻す</button>
      </div>
      <div className="grid grid-cols-3 gap-1 text-center text-[11px]">
        {demand.map((d) => (
          <div key={d.slot} className={`rounded-lg py-1 ${d.slotMatch ? "bg-emerald-50" : "bg-stone-100"}`}>
            {SLOTS[d.slot].label} 約{d.expected.toFixed(1)}食
          </div>
        ))}
      </div>
      <div className="text-xs text-stone-700">
        予想 {expectedSold}/{s.portions}食 → 売上 約{expectedSold * price}G（原価{Math.round(s.unitCost * s.portions)}G、想定利益 {Math.round(expectedSold * price - s.unitCost * s.portions)}G）
        <span className="text-stone-500">・{SEGMENTS[demand[0].topSegment].label}向き</span>
      </div>
    </div>
  );
}

function ReportView({ r, onClose }: { r: DailyReport; onClose: () => void }) {
  const { state, dispatch } = useGame();
  const w = state.world;
  const act = (fn: (w: typeof state.world, id: string) => typeof state.world, id: string) => dispatch({ type: "setWorld", world: fn(w, id) });
  return (
    <div className="card space-y-2 border-2 border-amber-400">
      <h2 className="text-lg font-bold">📒 {r.day}日目の日報</h2>
      <section>
        <div className="font-semibold">【総菜販売】</div>
        {r.listings.length === 0 && <p className="text-xs text-stone-500">販売なし</p>}
        {r.listings.map((l) => (
          <div key={l.stockId} className="mb-1 text-sm">
            <div>{l.name}（{l.price}G）：{l.sold}/{l.offered}食・{l.revenue}G</div>
            {l.slots.map((s) => (
              <div key={s.slot} className="pl-2 text-xs text-stone-600">
                {SLOTS[s.slot].label} {s.sold}/{s.offered}食　{s.revenue}G　「{s.comment}」
              </div>
            ))}
            {l.reasons.length > 0 && <div className="pl-2 text-[11px] text-amber-800">理由：{l.reasons.join("／")}</div>}
          </div>
        ))}
        <div className="text-xs text-stone-600">
          朝{r.slotTotals.morning.sold}食・昼{r.slotTotals.noon.sold}食・夕{r.slotTotals.evening.sold}食
        </div>
      </section>
      <section className="rounded-lg bg-stone-100 p-2 text-sm tabular-nums">
        <div className="flex justify-between"><span>売上</span><span>{r.salesRevenue}G</span></div>
        <div className="flex justify-between"><span>契約収入</span><span>+{r.contractIncome}G</span></div>
        <div className="flex justify-between"><span>材料費</span><span>−{r.materialCost}G</span></div>
        <div className="flex justify-between"><span>維持費</span><span>−{Math.round(r.upkeep)}G</span></div>
        <div className="flex justify-between border-t border-stone-300 font-bold"><span>利益</span><span className={r.profit < 0 ? "text-rose-700" : "text-emerald-700"}>{r.profit}G</span></div>
      </section>
      <section className="text-sm">
        <div className="font-semibold">【レシピ契約】</div>
        {r.contracts.length === 0 ? <p className="text-xs text-stone-500">なし</p> : r.contracts.map((c) => (
          <div key={c.contractId} className="text-xs">{c.shopName}（{c.dishName}）：{c.shopSold}食売れて +{c.income}G・残り{Math.max(0, c.daysLeft)}日</div>
        ))}
        {r.endedContracts.map((e) => <div key={e} className="text-xs text-stone-500">契約終了：{e}</div>)}
      </section>
      <section className="text-sm">
        <div className="font-semibold">【在庫】</div>
        {r.inventoryChanges.length === 0 ? <p className="text-xs text-stone-500">変化なし</p> : (
          <p className="text-xs">{r.inventoryChanges.map((c) => `${c.name}：${c.to}`).join("、")}</p>
        )}
        {r.discarded.map((d) => <p key={d} className="text-xs text-rose-700">{d}</p>)}
      </section>
      <section className="text-xs">
        体力 {r.stamina.before} → {r.stamina.after}・MP {r.mp.before} → {r.mp.after}・知名度（村）{r.fame.before} → {r.fame.after}
        {r.trends.length > 0 && <div>流行：{r.trends.map((t) => `${SALES_TAG_LABEL[t.tag as SalesTag] ?? t.tag}${t.delta > 0 ? "↑" : "↓"}`).join(" ")}</div>}
      </section>
      {r.voices.length > 0 && (
        <section className="text-sm">
          <div className="font-semibold">【客の声】</div>
          {r.voices.map((v) => <p key={v} className="text-xs">{v}</p>)}
        </section>
      )}
      {r.leftovers.length > 0 && (
        <section className="text-sm">
          <div className="font-semibold">【売れ残り】（翌日へ自動で持ち越し）</div>
          {r.leftovers.map((l) => {
            const live = w.dishStock.find((s) => s.id === l.stockId);
            return (
              <div key={l.stockId} className="mb-1 text-xs">
                {l.name} {l.portions}食・鮮度{Math.round(l.freshness * 100)}%
                {l.needsDecision && live && (
                  <div className="mt-1 grid grid-cols-4 gap-1">
                    <button className="chip min-h-9 text-[11px]" onClick={() => act(discountStock, l.stockId)}>値下げ</button>
                    <button className="chip min-h-9 text-[11px]" onClick={() => act(staffMeal, l.stockId)}>まかない</button>
                    <button className="chip min-h-9 text-[11px]" onClick={() => act(reprocessStock, l.stockId)}>再加工</button>
                    <button className="chip min-h-9 text-[11px]" onClick={() => act(discardStock, l.stockId)}>廃棄</button>
                  </div>
                )}
              </div>
            );
          })}
        </section>
      )}
      <button className="btn-primary w-full" onClick={onClose}>{Math.floor(w.day) + 1}日目を始める</button>
    </div>
  );
}

export function SalesPage() {
  const { state, dispatch } = useGame();
  const w = state.world;
  const [report, setReport] = useState<DailyReport | null>(null);
  const [dishId, setDishId] = useState("");
  const [msg, setMsg] = useState("");
  const dish = state.dishes.find((d) => d.id === dishId) ?? state.dishes[0];

  if (report) return <div className="p-4"><ReportView r={report} onClose={() => { setReport(null); window.scrollTo({ top: 0 }); }} /></div>;

  return (
    <div className="space-y-3 p-4 pb-8">
      <div className="card grid grid-cols-2 gap-x-3 text-xs">
        <div>{Math.floor(w.day) + 1}日目・所持金 {Math.floor(w.chef.money)}G</div>
        <div>体力 {Math.round(w.chef.stamina)}/{maxStamina(w.chef)}</div>
        <div>知名度（村）{w.fame.village ?? 0}</div>
        <div className="truncate">流行：{Object.entries(w.trends).filter(([, v]) => v > 0.05).map(([k]) => SALES_TAG_LABEL[k as SalesTag] ?? k).join("・") || "なし"}</div>
      </div>

      <h2 className="section-title mb-0">🏪 総菜販売（自分で売る）</h2>
      <p className="text-[11px] text-stone-500">材料費は自分持ち・売れ残りは損。うまく当てれば高利益。朝昼夕は「1日終了」でまとめて販売。</p>
      {w.dishStock.length === 0 ? (
        <button className="btn-secondary w-full" onClick={() => dispatch({ type: "navigate", screen: "kitchen" })}>売る料理がない → 厨房で作る</button>
      ) : (
        w.dishStock.map((s) => <StockCard key={s.id} s={s} />)
      )}

      <h2 className="section-title mb-0">📜 レシピ契約（店に任せる）</h2>
      <p className="text-[11px] text-stone-500">材料費・売れ残りリスクなし。店の売上の一部が毎日入る（低利益）。自分で同じ料理を売ってもよい。</p>
      {state.dishes.length > 0 && (
        <select className="w-full rounded-lg border border-stone-300 p-2 text-sm" value={dish?.id} onChange={(e) => setDishId(e.target.value)}>
          {state.dishes.map((d) => <option key={d.id} value={d.id}>{d.name}（{d.total}点）</option>)}
        </select>
      )}
      {SHOPS.map((shop) => {
        const check = dish ? canContract(w, shop, dish) : { ok: false, reason: "料理がない" };
        const rate = dish ? contractRate(shop, dish.total, w.fame[shop.region] ?? 0, w.contractsSigned) : 0;
        const tags = dish ? w.dishStock.find((s) => s.dishId === dish.id)?.tags ?? [] : [];
        const unitCost = dish ? w.dishStock.find((s) => s.dishId === dish.id)?.unitCost ?? 3 : 3;
        const price = dish ? Math.round(recommendedPrice({ unitCost, total: dish.total }) * shop.priceMult) : 0;
        const perDay = dish ? expectedContractIncome({ shopId: shop.id, tags, total: dish.total, price, rate }) : 0;
        return (
          <div key={shop.id} className="card text-sm">
            <div className="flex justify-between font-semibold"><span>{shop.name}</span><span className="text-xs font-normal">{shop.days}日契約</span></div>
            <div className="text-[11px] text-stone-500">客層：{shop.segments.map((s) => SEGMENTS[s].label).join("・")}／条件：総合点{shop.minTotal}以上</div>
            {dish && <div className="text-xs">歩合{Math.round(rate * 1000) / 10}%・店価格{price}G・見込み 約{perDay}G/日</div>}
            <button
              className="btn-secondary mt-1 w-full"
              disabled={!check.ok}
              onClick={() => {
                const r = signContract(w, shop, dish!);
                if (typeof r === "string") setMsg(r);
                else { setMsg(""); dispatch({ type: "setWorld", world: r }); }
              }}
            >
              {check.ok ? "この料理で契約する" : check.reason}
            </button>
          </div>
        );
      })}
      {msg && <p className="text-xs text-red-700">{msg}</p>}
      {w.contracts.length > 0 && (
        <div className="card text-xs">
          <div className="mb-1 font-semibold">契約中</div>
          {w.contracts.map((c) => (
            <div key={c.id}>{SHOPS.find((s) => s.id === c.shopId)?.name}：{c.dishName}・歩合{Math.round(c.rate * 1000) / 10}%・残り{c.daysLeft}日・累計{c.earned}G</div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        <button className="btn-secondary" onClick={() => dispatch({ type: "setWorld", world: rest(w) })}>😴 休息</button>
        <button
          className="btn-primary col-span-2"
          onClick={() => {
            const r = endDay(w, newCookingSeed());
            dispatch({ type: "setWorld", world: r.world });
            setReport(r.report);
            window.scrollTo({ top: 0 });
          }}
        >
          🌙 1日終了（販売して休む）
        </button>
      </div>
      <p className="text-center text-[11px] text-stone-500">
        販売中 {w.dishStock.filter((s) => s.listed).reduce((a, s) => a + s.portions, 0)}食・{SLOT_ORDER.map((s) => SLOTS[s].label).join("→")}
      </p>
    </div>
  );
}
