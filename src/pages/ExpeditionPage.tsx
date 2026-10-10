import { useState } from "react";
import { EXPEDITION_MAP, HIRES } from "../data/expeditions";
import { closeExpedition, expeditionsHere, fixedFees, startExpedition } from "../game/expedition/expedition";
import { isEaterRole } from "../game/roleView";
import { locationOf } from "../game/travel/market";
import type { ExpeditionHire } from "../types/life";
import { useGame } from "../state/GameContext";
import { nextDay } from "../components/TimeMeter";

// 日誌式遠征: choose where and whom to hire; the days are written as a diary.

export function ExpeditionPage() {
  const { state, dispatch } = useGame();
  const w = state.world;
  const eater = isEaterRole(w);
  const [dest, setDest] = useState<string | null>(null);
  const [hires, setHires] = useState<ExpeditionHire[]>([]);
  const [msg, setMsg] = useState("");
  const e = w.expedition;

  if (e) {
    const d = EXPEDITION_MAP[e.destinationId];
    return (
      <div className="space-y-3 p-4" data-testid="expedition-log">
        <div className="card text-sm">
          <div className="font-bold">🗺 {d.name}（{d.kind}）</div>
          <div className="text-xs text-stone-600">{e.status === "active" ? `${e.day}/${d.days}日目・進み具合 ${Math.min(100, Math.round((e.progress / d.days) * 100))}%` : `結果：${e.outcome === "success" ? "成功" : e.outcome === "partial" ? "部分成功" : "失敗"}`}</div>
        </div>
        <div className="card space-y-1 text-sm">
          {e.log.map((l, i) => <p key={i}>{l}</p>)}
          {e.rewards.map((r, i) => <p key={`r${i}`} className="font-semibold text-emerald-800">🎁 {r}</p>)}
        </div>
        {e.status === "active" ? (
          <button className="btn-primary w-full py-3" onClick={() => dispatch({ type: "setWorld", world: nextDay(w) })}>🌅 次の日へ（遠征を進める）</button>
        ) : (
          <button className="btn-secondary w-full" onClick={() => dispatch({ type: "setWorld", world: closeExpedition(w) })}>遠征を終える</button>
        )}
      </div>
    );
  }

  const list = expeditionsHere(w);
  const pick = dest ? EXPEDITION_MAP[dest] : null;
  const toggle = (hireId: string, contract: ExpeditionHire["contract"] | null) =>
    setHires([...hires.filter((h) => h.hireId !== hireId), ...(contract ? [{ hireId, contract }] : [])]);
  return (
    <div className="space-y-3 p-4">
      <p className="text-xs text-stone-500">遠征は準備だけ。道中は日誌で進む（1日ずつ「次の日へ」）。{eater ? "幻の料理・秘境の食堂・未知の辛さを求めて。" : "希少食材・調理法・保存法を求めて。"}</p>
      {list.length === 0 && <p className="card text-sm text-stone-500">{locationOf(w).name}から出られる遠征はない（港町・市場町・山岳から出発できる）</p>}
      {list.map((d) => (
        <button key={d.id} className={`card w-full text-left text-sm ${dest === d.id ? "border-amber-500 bg-amber-50" : ""}`} onClick={() => setDest(d.id)} data-expedition={d.id}>
          <div className="font-semibold">{d.name}（{d.kind}・{d.days}日）</div>
          <div className="text-xs text-stone-600">目的：{eater ? d.eaterGoal : d.makerGoal}</div>
          <div className="text-[11px] text-stone-500">危険 {"★".repeat(Math.round(d.danger * 5))}・道の険しさ {"★".repeat(Math.round(d.terrain * 5))}・魔力 {"★".repeat(Math.round(d.arcane * 5))}</div>
        </button>
      ))}
      {pick && (
        <div className="card space-y-1.5 text-sm">
          <div className="font-semibold">雇う</div>
          {HIRES.map((h) => {
            const cur = hires.find((x) => x.hireId === h.id)?.contract ?? null;
            return (
              <div key={h.id} className="space-y-1 rounded-lg border border-stone-200 p-2" data-hire={h.id}>
                <div className="text-xs"><b>{h.roleLabel}</b> {h.name}（腕前{Math.round(h.skill * 10)}）</div>
                <div className="grid grid-cols-3 gap-1">
                  <button className={`chip min-h-9 text-[11px] ${cur === null ? "chip-on" : ""}`} onClick={() => toggle(h.id, null)}>雇わない</button>
                  <button className={`chip min-h-9 text-[11px] ${cur === "fixed" ? "chip-on" : ""}`} onClick={() => toggle(h.id, "fixed")}>固定{h.fee}G</button>
                  <button className={`chip min-h-9 text-[11px] ${cur === "share" ? "chip-on" : ""}`} onClick={() => toggle(h.id, "share")}>山分け{Math.round(h.share * 100)}%</button>
                </div>
              </div>
            );
          })}
          <div className="text-xs">出発時の支払い：{fixedFees(hires)}G（山分けは成果から）</div>
          {msg && <p className="text-xs text-rose-700">{msg}</p>}
          <button
            className="btn-primary w-full"
            onClick={() => {
              const r = startExpedition(w, pick.id, hires);
              if (typeof r === "string") return setMsg(r);
              dispatch({ type: "setWorld", world: r });
            }}
          >
            出発する
          </button>
        </div>
      )}
    </div>
  );
}
