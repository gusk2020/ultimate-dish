import type { ScreenId } from "./types";
import { useGame } from "./state/GameContext";
import { VillageMap } from "./pages/VillageMap";
import { Kitchen } from "./pages/Kitchen";
import { Quests } from "./pages/Quests";
import { Dex } from "./pages/Dex";
import { ChefPage } from "./pages/ChefPage";
import { SalesPage } from "./pages/SalesPage";
import { maxMP, maxStamina } from "./game/chef/stats";
import { formatDays } from "./game/process/simulate";

const TABS: { id: ScreenId; label: string; icon: string }[] = [
  { id: "village", label: "村", icon: "🗺️" },
  { id: "chef", label: "料理人", icon: "🧑‍🍳" },
  { id: "kitchen", label: "厨房", icon: "🍳" },
  { id: "sales", label: "販売", icon: "🏪" },
  { id: "quests", label: "勝負", icon: "⚔️" },
  { id: "dex", label: "図鑑", icon: "📖" },
];

const SEASON = { spring: "春", summer: "夏", autumn: "秋", winter: "冬" };
const WEATHER = { sunny: "☀️晴れ", cloudy: "☁️曇り", rain: "🌧️雨", snow: "❄️雪" };

export default function App() {
  const { state, dispatch } = useGame();
  const { clock, world } = state;

  return (
    <div className="mx-auto min-h-dvh max-w-md bg-[#f7f3ea] pb-16">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-stone-200 bg-[#f7f3ea]/95 px-4 py-2 backdrop-blur">
        <h1 className="font-bold">Ultimate Dish</h1>
        <span className="text-right text-[11px] leading-tight text-stone-600">
          {Math.floor(world.day) + 1}日目 {formatDays(world.day % 1)}・{SEASON[clock.season]}・{WEATHER[clock.weather]}
          <br />
          Lv{world.chef.level}・体力{Math.round(world.chef.stamina)}/{maxStamina(world.chef)}・MP{world.chef.mp}/{maxMP(world.chef)}・{Math.floor(world.chef.money)}G
        </span>
      </header>

      {/* Pages stay mounted so a half-built recipe survives a peek at the quest board. */}
      <main>
        <div hidden={state.screen !== "village"}><VillageMap /></div>
        <div hidden={state.screen !== "chef"}><ChefPage /></div>
        <div hidden={state.screen !== "kitchen"}><Kitchen /></div>
        <div hidden={state.screen !== "sales"}><SalesPage /></div>
        <div hidden={state.screen !== "quests"}><Quests /></div>
        <div hidden={state.screen !== "dex"}><Dex /></div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-10 mx-auto grid h-16 max-w-md grid-cols-6 border-t border-stone-200 bg-white">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => dispatch({ type: "navigate", screen: t.id })}
            className={`flex flex-col items-center justify-center text-xs ${
              state.screen === t.id ? "font-bold text-amber-700" : "text-stone-500"
            }`}
          >
            <span className="text-xl leading-none">{t.icon}</span>
            {t.label}
            {t.id === "dex" && state.dishes.length > 0 && ` (${state.dishes.length})`}
          </button>
        ))}
      </nav>
    </div>
  );
}
