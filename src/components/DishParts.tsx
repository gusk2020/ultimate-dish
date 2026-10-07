import { AXES, type AxisScores, type DishImage, type Rank } from "../types";
import { AXIS_LABEL, RANK_STYLE } from "../game/labels";

export function RankBadge({ rank, size = "md" }: { rank: Rank; size?: "sm" | "md" }) {
  const cls = size === "sm" ? "px-1.5 py-0.5 text-xs" : "px-2.5 py-1 text-sm";
  return <span className={`inline-block rounded-md font-bold ${cls} ${RANK_STYLE[rank]}`}>{rank}</span>;
}

export function DishImageView({ image, size = 64 }: { image: DishImage; size?: number }) {
  if (image.kind === "url" && image.url) {
    return <img src={image.url} alt="" width={size} height={size} className="rounded-xl object-cover" />;
  }
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-xl"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.5,
        background: `linear-gradient(135deg, ${image.colors[0]}, ${image.colors[1]})`,
      }}
      aria-hidden
    >
      {image.emoji}
    </div>
  );
}

function barColor(v: number): string {
  if (v >= 75) return "bg-amber-500";
  if (v >= 55) return "bg-emerald-500";
  if (v >= 35) return "bg-sky-500";
  return "bg-stone-400";
}

/** 8軸 as compact horizontal bars, two columns. `highlight` marks quest-relevant axes. */
export function ScoreBars({ scores, highlight = [] }: { scores: AxisScores; highlight?: string[] }) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
      {AXES.map((a) => (
        <div key={a} className={highlight.includes(a) ? "font-semibold" : ""}>
          <div className="flex justify-between text-xs">
            <span>
              {highlight.includes(a) && "★"}
              {AXIS_LABEL[a]}
            </span>
            <span className="tabular-nums">{scores[a]}</span>
          </div>
          <div className="h-2 rounded-full bg-stone-200">
            <div className={`h-2 rounded-full ${barColor(scores[a])}`} style={{ width: `${scores[a]}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function Meter({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-16 shrink-0">{label}</span>
      <div className="h-2 flex-1 rounded-full bg-stone-200">
        <div className="h-2 rounded-full bg-rose-400" style={{ width: `${Math.round(value * 100)}%` }} />
      </div>
    </div>
  );
}
