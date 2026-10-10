import { INGREDIENT_MAP } from "../../data/ingredients";
import { MEAL_OFFERS } from "../../data/meals";
import { SALES_TAG_LABEL, type RecipeDef } from "../../data/recipes";
import { allRecipes } from "../learning/recipeBook";
import { codexEntries, knowledgeState, type KnowledgeState } from "./codex";
import type { World } from "../world";

// 自分のノート (Phase 10): one entrance to every dish the player knows of, has made, has eaten,
// has recorded, has published or has seen offered. The underlying records stay separate
// (recipeBook / codex / publicRegistry); this only indexes them for the UI.

export type NoteView = "category" | "tag" | "region" | "method" | "status" | "name";

export const VIEW_LABEL: Record<NoteView, { icon: string; label: string }> = {
  category: { icon: "📁", label: "分類" },
  tag: { icon: "🏷", label: "タグ" },
  region: { icon: "📍", label: "地域" },
  method: { icon: "🔥", label: "技法" },
  status: { icon: "⭐", label: "状態" },
  name: { icon: "🔤", label: "名前" },
};

export const CATEGORIES = ["肉", "魚", "野菜", "穀物", "乳", "保存食", "菓子", "その他"] as const;
export const REGION_SHORT: Record<string, string> = { home: "村", river: "川沿い", coast: "港", mountain: "山岳" };
const LOCATION_REGION: Record<string, string> = { village: "home", rivertown: "river", harbor: "coast", highland: "mountain" };
const METHOD_FOLDER: Record<string, string> = {
  grill: "焼く", saute: "焼く", boil: "煮る", reduce: "煮る", pressure: "煮る", steam: "蒸す", fry: "揚げる",
  smoke: "燻製", ferment: "発酵", pickle: "保存", dry: "保存", sousvide: "その他",
};
export const METHOD_FOLDERS = ["焼く", "煮る", "蒸す", "揚げる", "燻製", "発酵", "保存", "その他"];

export type NoteStatus = "known" | "cooked" | "eaten" | "codex" | "public" | "found";
export const STATUS_ICON: Record<NoteStatus, { icon: string; label: string }> = {
  known: { icon: "📖", label: "知っている" },
  cooked: { icon: "🍳", label: "作った" },
  eaten: { icon: "🍴", label: "食べた" },
  codex: { icon: "📚", label: "図鑑" },
  public: { icon: "🌐", label: "公開" },
  found: { icon: "🔎", label: "見つけた" },
};

export interface NoteItem {
  key: string;
  name: string;
  recipeId: string | null;
  emoji: string;
  category: string;
  region: string;
  methods: string[];
  tags: string[];
  knowledge: KnowledgeState;
  status: Record<NoteStatus, boolean>;
}

const FISH = new Set(["fish", "seafish", "shellfish", "riverprawn", "saltfish"]);
const GRAIN = new Set(["wheat", "noodles", "beans"]);

export function categoryOf(ingredientIds: string[], salesTags: string[]): string {
  if (salesTags.includes("preserved")) return "保存食";
  const ids = ingredientIds;
  if (ids.some((id) => FISH.has(id))) return "魚";
  if (ids.some((id) => INGREDIENT_MAP[id]?.category === "animal")) return "肉";
  if ((ids.includes("honey") || ids.includes("apple")) && ids.length <= 4) return "菓子";
  if (ids.some((id) => INGREDIENT_MAP[id]?.category === "dairy")) return "乳";
  if (ids.some((id) => GRAIN.has(id))) return "穀物";
  if (ids.some((id) => INGREDIENT_MAP[id]?.category === "plant")) return "野菜";
  return "その他";
}

function fromRecipe(r: RecipeDef) {
  const ingredientIds = r.ingredients.map((l) => l.itemId);
  return {
    category: categoryOf(ingredientIds, r.salesTags),
    region: REGION_SHORT[r.originRegionId ?? "home"] ?? "村",
    methods: [...new Set(r.steps.map((s) => METHOD_FOLDER[s.methodId]).filter(Boolean))],
    tags: r.salesTags.map((t) => SALES_TAG_LABEL[t] ?? t),
  };
}

/** Every dish worth a page in the notebook. */
export function noteItems(w: World): NoteItem[] {
  const visited = new Set(w.travel?.visitedLocationIds ?? ["village"]);
  const foundRecipes = new Set(MEAL_OFFERS.filter((o) => visited.has(o.locationId)).map((o) => o.recipeId));
  const pub = new Set((w.publicRegistry ?? []).map((p) => p.codexKey));
  const items: NoteItem[] = [];
  for (const r of allRecipes(w)) {
    const p = w.recipeBook[r.id];
    const e = w.codex?.[r.id];
    if (!p && !e && !foundRecipes.has(r.id)) continue;
    const offerRegion = MEAL_OFFERS.find((o) => o.recipeId === r.id)?.locationId;
    const base = fromRecipe(r);
    items.push({
      key: r.id, name: r.name, recipeId: r.id, emoji: e?.emoji ?? "🍽️",
      ...base,
      region: r.originRegionId ? base.region : REGION_SHORT[LOCATION_REGION[offerRegion ?? "village"]] ?? base.region,
      knowledge: knowledgeState(p),
      status: {
        known: !!p, cooked: (e?.timesCooked ?? 0) > 0 || (p?.timesCooked ?? 0) > 0, eaten: (e?.timesEaten ?? 0) > 0,
        codex: !!e, public: pub.has(r.id), found: foundRecipes.has(r.id),
      },
    });
  }
  // Free-form dishes exist only in the codex.
  for (const e of codexEntries(w)) {
    if (e.recipeId) continue;
    items.push({
      key: e.key, name: e.name, recipeId: null, emoji: e.emoji, category: categoryOf(e.ingredientIds, []), region: "村",
      methods: [...new Set(e.methodIds.map((m) => METHOD_FOLDER[m]).filter(Boolean))], tags: [], knowledge: "unknown",
      status: { known: false, cooked: e.timesCooked > 0, eaten: e.timesEaten > 0, codex: true, public: pub.has(e.key), found: false },
    });
  }
  return items.sort((a, b) => a.name.localeCompare(b.name, "ja"));
}

/** Folders for a view (tags / methods can put one dish in several). */
export function foldersOf(item: NoteItem, view: NoteView): string[] {
  switch (view) {
    case "category": return [item.category];
    case "tag": return item.tags.length ? item.tags : ["タグなし"];
    case "region": return [item.region];
    case "method": return item.methods.length ? item.methods : ["その他"];
    case "status": return (Object.keys(item.status) as NoteStatus[]).filter((k) => item.status[k]).map((k) => STATUS_ICON[k].label);
    case "name": return ["すべて"];
  }
}

export function folderOrder(view: NoteView): string[] {
  switch (view) {
    case "category": return [...CATEGORIES];
    case "region": return ["村", "川沿い", "港", "山岳"];
    case "method": return METHOD_FOLDERS;
    case "status": return (Object.keys(STATUS_ICON) as NoteStatus[]).map((k) => STATUS_ICON[k].label);
    default: return [];
  }
}

export function groupNotes(items: NoteItem[], view: NoteView): { folder: string; items: NoteItem[] }[] {
  const map = new Map<string, NoteItem[]>();
  for (const it of items) for (const f of foldersOf(it, view)) map.set(f, [...(map.get(f) ?? []), it]);
  const order = folderOrder(view);
  return [...map.entries()]
    .sort((a, b) => (order.indexOf(a[0]) + 1 || 99) - (order.indexOf(b[0]) + 1 || 99) || a[0].localeCompare(b[0], "ja"))
    .map(([folder, list]) => ({ folder, items: list }));
}

export function searchNotes(items: NoteItem[], q: string): NoteItem[] {
  const s = q.trim();
  if (!s) return items;
  return items.filter((i) => i.name.includes(s) || i.tags.some((t) => t.includes(s)) || i.region.includes(s) || i.category.includes(s));
}
