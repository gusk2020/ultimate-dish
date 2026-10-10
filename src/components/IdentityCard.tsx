import { GENDER_LABEL, LEAN_CHOICES } from "../data/creation";
import { TOOL_MAP } from "../data/magic";
import { addressFor } from "../game/creation/identityText";
import { saveNow, useGame } from "../state/GameContext";
import { progressionOf } from "../game/codex/codex";
import { eaterXpForLevel } from "../game/eater/progression";

/** あなた: what was decided in character creation (read-only; the creation screens never return). */
export function IdentityCard() {
  const { state, dispatch } = useGame();
  const w = state.world;
  const id = w.identity;
  if (!id?.creationCompleted) return null;
  const comp = w.social.companion;
  const p = progressionOf(w);
  const eater = id.lean === "eater";
  const role = (
    <div className="mt-1 grid grid-cols-2 gap-2 text-xs">
      <div className={`rounded-lg border px-2 py-1 ${eater ? "border-stone-200 text-stone-500" : "border-amber-300 bg-amber-50"}`}>🧑‍🍳 料理人Lv{w.chef.level}</div>
      <div className={`rounded-lg border px-2 py-1 ${eater ? "border-amber-300 bg-amber-50" : "border-stone-200 text-stone-500"}`}>
        🍴 フードファイターLv{p.eaterLevel}
        <span className="block text-[10px] text-stone-500">経験 {p.eaterXp}/{eaterXpForLevel(p.eaterLevel + 1)}・評判 {p.reputation}</span>
      </div>
    </div>
  );
  return (
    <div className="card space-y-0.5 text-sm">
      <div className="flex items-center justify-between">
        <h2 className="section-title mb-1">🪪 {id.name ?? w.chef.name}</h2>
        <button
          className="rounded-lg border border-stone-300 px-2 py-1 text-[11px] text-stone-600"
          onClick={() => { saveNow(state); dispatch({ type: "toTitle" }); }}
        >
          保存してタイトルへ
        </button>
      </div>
      <div>{LEAN_CHOICES.find((l) => l.id === id.lean)?.label}・{id.genderExpression ? GENDER_LABEL[id.genderExpression] : "—"}・{id.age}歳</div>
      <div className="text-xs text-stone-600">
        旅立ちの道連れ：
        {id.start === "companion" && comp ? `相棒 ${comp.emoji}${comp.name}（${id.companionPresentation === "girl" ? "女の子" : "男の子"}の姿）` : id.startingToolId ? `魔導具 ${TOOL_MAP[id.startingToolId]?.emoji}${TOOL_MAP[id.startingToolId]?.name}` : "なし"}
      </div>
      <div className="text-[11px] text-stone-500">村での呼ばれ方：「{addressFor(id)}」</div>
      {role}
    </div>
  );
}
