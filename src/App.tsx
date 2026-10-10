import type { ScreenId } from "./types";
import { useGame } from "./state/GameContext";
import { LocationPage } from "./pages/LocationPage";
import { CharacterCreation } from "./pages/CharacterCreation";
import { TitleScreen } from "./pages/TitleScreen";
import { roleLevelLabel } from "./game/eater/progression";
import { needsCreation } from "./game/creation/creation";
import { locationOf } from "./game/travel/market";
import { HOME_LOCATION_ID } from "./data/regions";
import { Kitchen } from "./pages/Kitchen";
import { Quests } from "./pages/Quests";
import { Dex } from "./pages/Dex";
import { ChefPage } from "./pages/ChefPage";
import { SalesPage } from "./pages/SalesPage";
import { PeoplePage } from "./pages/PeoplePage";
import { maxMP, maxStamina } from "./game/chef/stats";
import { formatDate } from "./game/time/calendar";
import { TimeMeter } from "./components/TimeMeter";
import { DiningPage } from "./pages/DiningPage";

type Tab = { id: ScreenId; label: string; icon: string };

/** Phase 10: the two roles play different games, so they get different tabs. */
const MAKER_TABS: Tab[] = [
  { id: "village", label: "村", icon: "🗺️" },
  { id: "chef", label: "料理人", icon: "🧑‍🍳" },
  { id: "people", label: "仲間", icon: "🤝" },
  { id: "kitchen", label: "厨房", icon: "🍳" },
  { id: "sales", label: "販売", icon: "🏪" },
  { id: "quests", label: "勝負", icon: "⚔️" },
  { id: "dex", label: "ノート", icon: "📖" },
];
const EATER_TABS: Tab[] = [
  { id: "village", label: "村", icon: "🗺️" },
  { id: "chef", label: "食べ手", icon: "🍴" },
  { id: "people", label: "仲間", icon: "🤝" },
  { id: "dining", label: "食事", icon: "🍲" },
  { id: "quests", label: "勝負", icon: "⚔️" },
  { id: "dex", label: "ノート", icon: "📖" },
];

const WEATHER = { sunny: "☀️晴れ", cloudy: "☁️曇り", rain: "🌧️雨", snow: "❄️雪" };

export default function App() {
  const { state, dispatch } = useGame();
  const { clock, world } = state;

  // Phase 8: a new game is a black, standalone character creation; no normal UI until it is done.
  // Phase 9: the startup screen chooses (or creates) the character first.
  if (state.mode === "title") return <TitleScreen />;
  if (needsCreation(world)) return <CharacterCreation />;
  const tabs = world.identity?.lean === "eater" ? EATER_TABS : MAKER_TABS;

  return (
    <div className="mx-auto min-h-dvh max-w-md bg-[#f7f3ea] pb-16">
      <header className="sticky top-0 z-10 border-b border-stone-200 bg-[#f7f3ea]/95 px-3 py-1.5 backdrop-blur">
        <div className="flex items-center justify-between gap-2">
          <h1 className="shrink-0 text-xs font-bold leading-tight">Catenary<span className="block text-[10px] font-normal">Devourers &amp; Delicacies</span></h1>
          <span className="min-w-0 text-right text-[11px] leading-tight text-stone-600">
            <span data-testid="calendar">{formatDate(world.day)}・{WEATHER[clock.weather]}</span>
            <br />
            {roleLevelLabel(world)}・体力{Math.round(world.chef.stamina)}/{maxStamina(world.chef)}・MP{world.chef.mp}/{maxMP(world.chef)}・{Math.floor(world.chef.money)}G
          </span>
        </div>
        <TimeMeter />
      </header>

      {/* Pages stay mounted so a half-built recipe survives a peek at the quest board. */}
      <main>
        <div hidden={state.screen !== "village"}><LocationPage /></div>
        <div hidden={state.screen !== "chef"}><ChefPage /></div>
        <div hidden={state.screen !== "people"}><PeoplePage /></div>
        <div hidden={state.screen !== "kitchen"}><Kitchen /></div>
        <div hidden={state.screen !== "sales"}><SalesPage /></div>
        <div hidden={state.screen !== "quests"}><Quests /></div>
        <div hidden={state.screen !== "dex"}><Dex /></div>
        <div hidden={state.screen !== "dining"}><DiningPage /></div>
      </main>

      <nav className={`fixed inset-x-0 bottom-0 z-10 mx-auto grid h-16 max-w-md border-t border-stone-200 bg-white ${tabs.length === 7 ? "grid-cols-7" : "grid-cols-6"}`}>
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => dispatch({ type: "navigate", screen: t.id })}
            className={`flex flex-col items-center justify-center text-xs ${
              state.screen === t.id ? "font-bold text-amber-700" : "text-stone-500"
            }`}
          >
            {/* The first tab is "where you are": the village at home, the town's name on the road. */}
            <span className="text-xl leading-none">{t.id === "village" && world.travel.currentLocationId !== HOME_LOCATION_ID ? locationOf(world).emoji : t.icon}</span>
            {t.id === "village" ? locationOf(world).shortName : t.label}

          </button>
        ))}
      </nav>
    </div>
  );
}
