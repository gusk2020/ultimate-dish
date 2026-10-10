import { GENDER_LABEL, LEAN_CHOICES } from "../data/creation";
import { TOOL_MAP } from "../data/magic";
import { addressFor } from "../game/creation/identityText";
import { useGame } from "../state/GameContext";

/** あなた: what was decided in character creation (read-only; the creation screens never return). */
export function IdentityCard() {
  const { state } = useGame();
  const w = state.world;
  const id = w.identity;
  if (!id?.creationCompleted) return null;
  const comp = w.social.companion;
  return (
    <div className="card space-y-0.5 text-sm">
      <h2 className="section-title mb-1">🪪 あなた</h2>
      <div>{LEAN_CHOICES.find((l) => l.id === id.lean)?.label}・{id.genderExpression ? GENDER_LABEL[id.genderExpression] : "—"}・{id.age}歳</div>
      <div className="text-xs text-stone-600">
        旅立ちの道連れ：
        {id.start === "companion" && comp ? `相棒 ${comp.emoji}${comp.name}（${id.companionPresentation === "girl" ? "女の子" : "男の子"}の姿）` : id.startingToolId ? `魔導具 ${TOOL_MAP[id.startingToolId]?.emoji}${TOOL_MAP[id.startingToolId]?.name}` : "なし"}
      </div>
      <div className="text-[11px] text-stone-500">村での呼ばれ方：「{addressFor(id)}」</div>
    </div>
  );
}
