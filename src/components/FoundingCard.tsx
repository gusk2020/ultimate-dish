import { FOUNDING_READY_TEXT, foundingStatus } from "../game/school/founding";
import { useGame } from "../state/GameContext";

/** 独自流派の成立条件: judging only. Naming, philosophy and members come in a later phase. */
export function FoundingCard() {
  const { state } = useGame();
  const s = foundingStatus(state.world);
  const done = s.checks.filter((c) => c.ok).length;
  return (
    <div className={`card space-y-1 ${s.ready ? "border-violet-300 bg-violet-50" : ""}`}>
      <h2 className="section-title mb-0">🏯 独自流派の成立条件</h2>
      <div className={`text-xs ${s.ready ? "font-semibold text-violet-800" : "text-stone-600"}`}>
        {s.ready ? `✨ ${FOUNDING_READY_TEXT}` : `${done}/${s.checks.length} を満たしている`}
      </div>
      <ul className="text-xs">
        {s.checks.map((c) => (
          <li key={c.id} className={c.ok ? "text-emerald-700" : "text-rose-700"}>
            {c.ok ? "✓" : "✗"} {c.label}（今：{c.have}）
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-stone-500">流派の名前・理念・技法・継承は今後。流派はレシピと違い、限られた仲間や弟子に受け継がれていく。</p>
    </div>
  );
}

/** One-line notice shown where the player is, once the conditions are met. */
export function FoundingNotice({ onOpen }: { onOpen: () => void }) {
  const { state } = useGame();
  if (!foundingStatus(state.world).ready) return null;
  return (
    <button className="card w-full border-violet-300 bg-violet-50 text-left text-sm font-semibold text-violet-800" onClick={onOpen}>
      ✨ {FOUNDING_READY_TEXT}
    </button>
  );
}
