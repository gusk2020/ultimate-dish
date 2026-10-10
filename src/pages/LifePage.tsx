import { useState } from "react";
import { BANK_OPEN_FEE, FOOD_STORAGES, GUILD_PLANS, GUILD_PLAN_MAP, HOUSE, PORTABLE_KITCHENS, SAFE_CASH, SHOP } from "../data/property";
import { itemInfo } from "../data/items";
import {
  atBranch, buyHouse, buyPortableKitchen, buyShop, buyStorage, deposit, guildDeposit, guildWithdraw, isGuildTown, openAccount, robberyChance,
  storagesHere, storeDish, subscribeGuildStorage, takeStored, withdraw, type DepositItem,
} from "../game/property/property";
import { isEaterRole } from "../game/roleView";
import { locationOf } from "../game/travel/market";
import type { World } from "../game/world";
import { useGame } from "../state/GameContext";

// 住まい・保存・ギルド共有倉庫・銀行 (Phase 11). The guilds keep food; the bank keeps money.

type Tab = "home" | "storage" | "guild" | "bank";

export function LifePage() {
  const { state, dispatch } = useGame();
  const w = state.world;
  const eater = isEaterRole(w);
  const [tab, setTab] = useState<Tab>(eater ? "storage" : "home");
  const [msg, setMsg] = useState("");
  const [amount, setAmount] = useState(50);
  const act = (r: World | string, ok: string) => {
    if (typeof r === "string") return setMsg(r);
    dispatch({ type: "setWorld", world: r });
    setMsg(ok);
  };
  const here = locationOf(w);
  const tabs: [Tab, string][] = eater
    ? [["storage", "📦 保存"], ["guild", "🏛 共有倉庫"], ["bank", "🏦 銀行"]]
    : [["home", "🏠 住まい・厨房"], ["storage", "📦 保存"], ["guild", "🏛 共有倉庫"], ["bank", "🏦 銀行"]];
  const p = w.property ?? { houses: [], shops: [], portableKitchens: [] };
  const g = w.guildStorage ?? { plan: null, items: [] };
  const b = w.bank ?? { opened: false, balance: 0, openedDay: null };
  return (
    <div className="space-y-3 p-4">
      <div className={`grid gap-1 rounded-xl bg-stone-200 p-1 text-xs ${tabs.length === 4 ? "grid-cols-4" : "grid-cols-3"}`}>
        {tabs.map(([t, l]) => (
          <button key={t} className={`min-h-10 rounded-lg ${tab === t ? "bg-white font-bold shadow" : "text-stone-600"}`} onClick={() => { setTab(t); setMsg(""); }}>{l}</button>
        ))}
      </div>
      {msg && <p className="text-xs text-emerald-800">{msg}</p>}

      {tab === "home" && !eater && (
        <div className="space-y-2">
          <div className="card space-y-1 text-sm">
            <div className="font-semibold">🏠 {HOUSE.name}（{HOUSE.price}G）</div>
            <div className="text-xs text-stone-600">{HOUSE.note}</div>
            <button className="btn-secondary w-full text-sm" disabled={p.houses.includes(here.id)} onClick={() => act(buyHouse(w), `${here.name}に家を買った`)}>
              {p.houses.includes(here.id) ? "この土地に家がある" : `${here.name}に家を買う`}
            </button>
          </div>
          <div className="card space-y-1 text-sm">
            <div className="font-semibold">🏪 {SHOP.name}（{SHOP.price}G）</div>
            <div className="text-xs text-stone-600">{SHOP.note}</div>
            <button className="btn-secondary w-full text-sm" disabled={p.shops.includes(here.id)} onClick={() => act(buyShop(w), `${here.name}に店を構えた`)}>
              {p.shops.includes(here.id) ? "この土地に店がある" : `${here.name}に店を構える`}
            </button>
          </div>
          <div className="card space-y-1.5 text-sm">
            <div className="font-semibold">🛒 持ち運べる厨房</div>
            {PORTABLE_KITCHENS.map((k) => (
              <button key={k.id} className="btn-secondary w-full text-left text-xs" disabled={p.portableKitchens.includes(k.id)} onClick={() => act(buyPortableKitchen(w, k.id), `${k.name}を手に入れた`)} data-portable={k.id}>
                {k.name}（{k.price}G{k.upkeepPerDay ? `・維持費${k.upkeepPerDay}G/日` : ""}）{p.portableKitchens.includes(k.id) ? "・所持" : ""}
              </button>
            ))}
            <p className="text-[11px] text-stone-500">持っている厨房は、厨房の「厨房を借りる」に無料で並ぶ。</p>
          </div>
        </div>
      )}

      {tab === "storage" && (
        <div className="space-y-2">
          {storagesHere(w).map((s) => (
            <div key={s.index} className="card space-y-1 text-sm">
              <div className="font-semibold">{s.facility.emoji} {s.facility.name}（{s.items.length}件）</div>
              <div className="text-[11px] text-stone-500">劣化 ×{s.facility.freshnessMultiplier}{s.facility.magicCost ? `・毎晩MP ${s.facility.magicCost}` : ""}</div>
              {s.items.map((i) => (
                <div key={i.id} className="flex items-center justify-between gap-2 text-xs">
                  <span>{i.stock ? `${i.stock.name}×${i.stock.portions}（鮮度${Math.round(i.stock.freshness * 100)}%）` : `${itemInfo(i.stack!.itemId)?.name}×${i.stack!.quantity}`}</span>
                  <button className="btn-secondary px-2 py-1 text-xs" onClick={() => act(takeStored(w, s.index, i.id), "取り出した")}>出す</button>
                </div>
              ))}
              {w.dishStock.filter((d) => !d.listed).map((d) => (
                <button key={d.id} className="btn-secondary w-full text-xs" onClick={() => act(storeDish(w, s.index, d.id), `${d.name}をしまった`)}>「{d.name}」×{d.portions}をしまう</button>
              ))}
            </div>
          ))}
          <div className="card space-y-1.5 text-sm">
            <div className="font-semibold">保存の魔導具を買う</div>
            {FOOD_STORAGES.filter((f) => !f.builtIn).map((f) => (
              <button key={f.id} className="btn-secondary w-full text-left text-xs" onClick={() => act(buyStorage(w, f.id), `${f.name}を買った`)}>
                {f.emoji}{f.name}（{f.price}G・{f.capacity}食・劣化×{f.freshnessMultiplier}・毎晩MP{f.magicCost}）
              </button>
            ))}
            <p className="text-[11px] text-stone-500">高いほど広く、劣化が遅い。ただし魔力の維持費（MP）も高い。</p>
          </div>
        </div>
      )}

      {tab === "guild" && (
        <div className="space-y-2">
          <div className="card space-y-1.5 text-sm">
            <div className="font-semibold">🏛 ギルド共有魔力食在庫</div>
            <p className="text-[11px] text-stone-500">つながったギルド（村・市場町・港町・山岳）のどこで預けても、どこでも取り出せる。入れられるのは生きていない食品だけ（料理・加工食材・保存食・死んだ食材）。お金・道具・一般の品・生き物は不可。</p>
            {!isGuildTown(w) && <p className="text-xs text-rose-700">ここにはギルドがない</p>}
            <div className="grid grid-cols-2 gap-1">
              {GUILD_PLANS.map((pl) => (
                <button key={pl.id} className={`chip min-h-10 text-xs ${g.plan === pl.id ? "chip-on" : ""}`} onClick={() => act(subscribeGuildStorage(w, pl.id), `「${pl.name}」プランで契約した`)}>
                  {pl.name} {pl.feePerDay}G/日
                </button>
              ))}
            </div>
            {g.plan && <div className="text-xs">契約中：{GUILD_PLAN_MAP[g.plan].name}（{g.items.length}件預け中）</div>}
          </div>
          {g.plan && (
            <div className="card space-y-1 text-sm">
              {g.items.map((i) => (
                <div key={i.id} className="flex items-center justify-between gap-2 text-xs">
                  <span>{i.stock ? `${i.stock.name}×${i.stock.portions}` : `${itemInfo(i.stack!.itemId)?.name}×${i.stack!.quantity}`}（{i.from}で預けた）</span>
                  <button className="btn-secondary px-2 py-1 text-xs" onClick={() => act(guildWithdraw(w, i.id), "取り出した")}>出す</button>
                </div>
              ))}
              {w.dishStock.filter((d) => !d.listed).map((d) => (
                <button key={d.id} className="btn-secondary w-full text-xs" onClick={() => act(guildDeposit(w, { type: "dish", stockId: d.id }), "預けた")}>料理「{d.name}」を預ける</button>
              ))}
              {!eater && w.inventory.slice(0, 4).map((st) => (
                <button key={st.id} className="btn-secondary w-full text-xs" onClick={() => act(guildDeposit(w, { type: "ingredient", stackId: st.id }), "預けた")}>食材「{itemInfo(st.itemId)?.name}」×{st.quantity}を預ける</button>
              ))}
              <div className="grid grid-cols-2 gap-1 pt-1">
                {([{ type: "money", amount: 10 }, { type: "living", name: "生きた鶏" }] as DepositItem[]).map((it, i) => (
                  <button key={i} className="btn-secondary text-[11px]" onClick={() => act(guildDeposit(w, it), "")}>{it.type === "money" ? "お金を預けてみる" : "生きた鶏を預けてみる"}</button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "bank" && (
        <div className="card space-y-1.5 text-sm" data-testid="bank">
          <div className="font-semibold">🏦 王国両替銀行（ギルドとは別の組織）</div>
          <p className="text-[11px] text-stone-500">手持ちの金貨はかさばり、旅で狙われる（{SAFE_CASH}Gを超えると危険が増す：今 {Math.round(robberyChance(w.chef.money) * 100)}%）。預金は失われない。</p>
          {!atBranch(w) && <p className="text-xs text-rose-700">ここに支店はない</p>}
          {!b.opened ? (
            <button className="btn-primary w-full" onClick={() => act(openAccount(w), "口座を開いた")}>口座を開く（{BANK_OPEN_FEE}G）</button>
          ) : (
            <>
              <div>残高 {b.balance}G・手持ち {Math.floor(w.chef.money)}G</div>
              <input type="number" aria-label="金額" className="w-full rounded-lg border border-stone-300 px-2 py-1 text-base" value={amount} min={1} onChange={(e) => setAmount(Math.max(1, Number(e.target.value) || 1))} />
              <div className="grid grid-cols-2 gap-2">
                <button className="btn-secondary" onClick={() => act(deposit(w, amount), `${amount}G預けた`)}>預ける</button>
                <button className="btn-secondary" onClick={() => act(withdraw(w, amount), `${amount}G引き出した`)}>引き出す</button>
              </div>
              <p className="text-[11px] text-stone-500">💬 資金相談：開店資金の融資や投資は、実績を積めば相談に乗れる（準備中）</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
