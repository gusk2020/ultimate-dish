import { createContext, useContext, useReducer, type ReactNode } from "react";
import type { Dish, QuestResult, Recipe, ScreenId, WorldClock } from "../types";

// One reducer for the whole prototype. In-memory only (reload clears it);
// persistence / online sync will hook in here later.

export interface KitchenSeed {
  recipe: Recipe;
  parentDishId: string | null;
}

export interface GameState {
  screen: ScreenId;
  dishes: Dish[];
  clearedQuestIds: string[];
  questResults: Record<string, QuestResult[]>;
  clock: WorldClock;
  /** Prefill for the kitchen when deriving a dish from an existing one. */
  kitchenSeed: KitchenSeed | null;
}

type Action =
  | { type: "navigate"; screen: ScreenId }
  | { type: "addDish"; dish: Dish }
  | { type: "renameDish"; id: string; name: string }
  | { type: "togglePublic"; id: string }
  | { type: "questResult"; result: QuestResult }
  | { type: "derive"; dish: Dish }
  | { type: "consumeSeed" };

const initialState: GameState = {
  screen: "village",
  dishes: [],
  clearedQuestIds: [],
  questResults: {},
  clock: { day: 1, season: "spring", weather: "sunny" },
  kitchenSeed: null,
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
        kitchenSeed: { recipe: a.dish.recipe, parentDishId: a.dish.id },
      };
    case "consumeSeed":
      return { ...state, kitchenSeed: null };
  }
}

const GameCtx = createContext<{ state: GameState; dispatch: React.Dispatch<Action> } | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  return <GameCtx.Provider value={{ state, dispatch }}>{children}</GameCtx.Provider>;
}

export function useGame() {
  const ctx = useContext(GameCtx);
  if (!ctx) throw new Error("useGame outside GameProvider");
  return ctx;
}
