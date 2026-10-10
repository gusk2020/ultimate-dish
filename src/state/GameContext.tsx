import { createContext, useContext, useEffect, useReducer, useRef, type ReactNode } from "react";
import type { Dish, QuestResult, Recipe, ScreenId, WorldClock } from "../types";
import { createWorld, type World } from "../game/world";
import type { ProcessStep } from "../types/world";
import { needsCreation } from "../game/creation/creation";
import { loadStore, newSlotId, persistStore, writeSlot, type PersistedState } from "./saves";

// One reducer for the whole prototype. Phase 9: each character lives in a save slot
// (localStorage, see saves.ts) and is saved automatically while playing.

export interface KitchenSeed {
  recipe: Recipe;
  parentDishId: string | null;
  /** Set when the parent was cooked in the line kitchen. */
  steps?: ProcessStep[];
}

export interface GameState {
  screen: ScreenId;
  dishes: Dish[];
  clearedQuestIds: string[];
  questResults: Record<string, QuestResult[]>;
  clock: WorldClock;
  /** Prefill for the kitchen when deriving a dish from an existing one. */
  kitchenSeed: KitchenSeed | null;
  /** Phase 2: chef, inventory, tools, schools, time. Updated through pure functions in game/world.ts. */
  world: World;
  /** Phase 9: the startup screen, or playing (creation included). */
  mode: "title" | "play";
  /** The save slot this character lives in. */
  slotId: string | null;
  /** Phase 10: a recipe picked in the notebook, waiting for the kitchen. */
  cookRecipeId: string | null;
}

type Action =
  | { type: "navigate"; screen: ScreenId }
  | { type: "addDish"; dish: Dish }
  | { type: "renameDish"; id: string; name: string }
  | { type: "togglePublic"; id: string }
  | { type: "questResult"; result: QuestResult }
  | { type: "derive"; dish: Dish }
  | { type: "consumeSeed" }
  | { type: "setWorld"; world: World }
  | { type: "newGame" }
  | { type: "loadSlot"; slotId: string; state: PersistedState }
  | { type: "toTitle" }
  | { type: "cookRecipe"; recipeId: string }
  | { type: "consumeCookRecipe" };

const initialState: GameState = {
  screen: "village",
  dishes: [],
  clearedQuestIds: [],
  questResults: {},
  clock: { day: 1, season: "spring", weather: "sunny" },
  kitchenSeed: null,
  world: createWorld(),
  mode: "title",
  slotId: null,
  cookRecipeId: null,
};

function reducer(state: GameState, a: Action): GameState {
  switch (a.type) {
    case "navigate":
      return { ...state, screen: a.screen };
    case "addDish":
      return { ...state, dishes: [a.dish, ...state.dishes] };
    case "renameDish":
      return { ...state, dishes: state.dishes.map((d) => (d.id === a.id ? { ...d, name: a.name } : d)) };
    case "togglePublic":
      return {
        ...state,
        dishes: state.dishes.map((d) => (d.id === a.id ? { ...d, isPublic: !d.isPublic } : d)),
      };
    case "questResult": {
      const r = a.result;
      const prev = state.questResults[r.questId] ?? [];
      return {
        ...state,
        questResults: { ...state.questResults, [r.questId]: [r, ...prev] },
        clearedQuestIds:
          r.success && !state.clearedQuestIds.includes(r.questId)
            ? [...state.clearedQuestIds, r.questId]
            : state.clearedQuestIds,
      };
    }
    case "derive":
      return {
        ...state,
        screen: "kitchen",
        kitchenSeed: { recipe: a.dish.recipe, parentDishId: a.dish.id, steps: a.dish.process?.steps },
      };
    case "consumeSeed":
      return { ...state, kitchenSeed: null };
    case "setWorld":
      return { ...state, world: a.world, clock: { ...state.clock, day: Math.floor(a.world.day) + 1 } };
    case "newGame":
      return { ...initialState, world: createWorld(), mode: "play", slotId: newSlotId() };
    case "loadSlot":
      return { ...initialState, ...a.state, kitchenSeed: null, cookRecipeId: null, mode: "play", slotId: a.slotId };
    case "toTitle":
      return { ...initialState, world: createWorld() };
    case "cookRecipe":
      return { ...state, screen: "kitchen", cookRecipeId: a.recipeId };
    case "consumeCookRecipe":
      return { ...state, cookRecipeId: null };
  }
}

export function persistedOf(s: GameState): PersistedState {
  return { screen: s.screen, dishes: s.dishes, clearedQuestIds: s.clearedQuestIds, questResults: s.questResults, clock: s.clock, world: s.world };
}

/** Saves the current character into its slot (after creation is complete). */
export function saveNow(s: GameState): string | null {
  if (s.mode !== "play" || !s.slotId || needsCreation(s.world)) return null;
  const next = writeSlot(loadStore(), s.slotId, persistedOf(s));
  if (typeof next === "string") return next;
  return persistStore(next);
}

export const AUTOSAVE_DELAY_MS = 400;

const GameCtx = createContext<{ state: GameState; dispatch: React.Dispatch<Action> } | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  // 自動保存: debounced after every change; flushed when the page is hidden or closed.
  const latest = useRef(state);
  latest.current = state;
  useEffect(() => {
    if (state.mode !== "play" || !state.slotId || needsCreation(state.world)) return;
    const t = setTimeout(() => saveNow(latest.current), AUTOSAVE_DELAY_MS);
    return () => clearTimeout(t);
  }, [state.world, state.dishes, state.questResults, state.clearedQuestIds, state.mode, state.slotId]);
  useEffect(() => {
    const flush = () => saveNow(latest.current);
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", flush);
    };
  }, []);
  return <GameCtx.Provider value={{ state, dispatch }}>{children}</GameCtx.Provider>;
}

export function useGame() {
  const ctx = useContext(GameCtx);
  if (!ctx) throw new Error("useGame outside GameProvider");
  return ctx;
}
