import { isRentedHere, kitchenStatus, kitchensHere, kitchenStateOf, type CookNeeds } from "../game/kitchen/kitchens";
import { useGame } from "../state/GameContext";

/** 厨房を借りる: every kitchen here with its price, size, limits and whether it is free right now. */
export function KitchenPicker({ needs, value, onChange }: { needs: CookNeeds; value: string | null; onChange: (id: string) => void }) {
  const { state } = useGame();
  const w = state.world;
  const ev = kitchenStateOf(w).event;
  return (
    <div className="card space-y-1.5" data-testid="kitchen-picker">
      <div className="text-sm font-semibold">🏠 厨房を借りる</div>
      <p className="text-[11px] text-stone-500">自宅の厨房はない。この時間帯に使う厨房を選ぶ（料金は調理開始時に払う）。{ev && `今は「${ev.label}」の主催者の厨房が使える。`}</p>
      {kitchensHere(w).map((k) => {
        const st = kitchenStatus(w, k, needs);
        const on = value === k.id;
        return (
          <button
            key={k.id}
            disabled={st.status !== "ok"}
            data-kitchen={k.id}
            className={`w-full rounded-lg border p-2 text-left text-xs disabled:opacity-60 ${on ? "border-amber-500 bg-amber-50" : "border-stone-200"}`}
            onClick={() => onChange(k.id)}
          >
            <div className="flex justify-between gap-2">
              <span className="font-semibold">{k.emoji}{k.name}</span>
              <span className="shrink-0">{k.cost === 0 ? "無料" : isRentedHere(w, k.id) ? "支払い済み" : `${k.cost}G`}・{k.capacity}食まで</span>
            </div>
            <div className="text-[11px] text-stone-500">{k.note}</div>
            {st.problems.length > 0 && <div className="text-[11px] text-rose-700">{st.problems.join("・")}</div>}
          </button>
        );
      })}
    </div>
  );
}
