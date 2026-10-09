import type { RecipeDef } from "./recipes";
import type { RecipeHistory, RecipeProgress } from "../types/learning";

// 派生の着想: a rule fires from what the player actually did with a recipe (tools, school,
// finishing, results, batch size), never from mastery alone. Mastery is only a gate.

export const DERIVATION_MIN_COOKS = 3;
export const DERIVATION_MIN_MASTERY = 25;

export interface DerivationRule {
  id: string;
  label: string; // 香草強化 …
  /** What the player did that sparked it (shown on the idea card). */
  because: string;
  /** Condition on the recipe's own history. */
  test: (h: RecipeHistory, p: RecipeProgress, base: RecipeDef) => boolean;
  /** Short description of the change. */
  change: string;
  apply: (base: RecipeDef) => Partial<RecipeDef>;
  namePrefixes: string[];
}

const addLine = (lines: RecipeDef["ingredients"], itemId: string, amount: number) =>
  lines.some((l) => l.itemId === itemId)
    ? lines.map((l) => (l.itemId === itemId ? { ...l, amount: Math.round((l.amount + amount) * 100) / 100 } : l))
    : [...lines, { itemId, amount }];
const addTag = (tags: RecipeDef["salesTags"], tag: RecipeDef["salesTags"][number]) => (tags.includes(tag) ? tags : [...tags, tag]);

export const DERIVATION_RULES: DerivationRule[] = [
  {
    id: "herb",
    label: "香草強化",
    because: "仕上げにハーブを添えて作った",
    test: (h) => (h.aromaUses["ハーブを添える"] ?? 0) >= 1,
    change: "ハーブを加え、香り高く仕上げる",
    apply: (b) => ({ ingredients: addLine(b.ingredients, "herb", 0.2), salesTags: addTag(b.salesTags, "healthy") }),
    namePrefixes: ["香草仕立ての", "ハーブ香る"],
  },
  {
    id: "stone",
    label: "魔導具活用",
    because: "魔石炉を使って何度も作った",
    test: (h) => (h.toolUses.stone ?? 0) >= 2,
    change: "魔石炉前提の火入れで、調理時間を短縮",
    apply: (b) => ({ toolCompat: ["stone", ...b.toolCompat.filter((t) => t !== "stone")], baseTimeDays: Math.round(b.baseTimeDays * 0.85 * 1000) / 1000 }),
    namePrefixes: ["魔石炉の", "炉焼きの"],
  },
  {
    id: "preserve",
    label: "保存寄り",
    because: "北方猟師料理の流派で作った",
    test: (h) => (h.schoolUses.north ?? 0) >= 2,
    change: "塩を増やし、日持ちする保存食に寄せる",
    apply: (b) => ({ seasonings: addLine(b.seasonings, "salt", 0.1), salesTags: addTag(b.salesTags, "preserved") }),
    namePrefixes: ["日持ちする", "塩締めの"],
  },
  {
    id: "nourish",
    label: "滋養寄り",
    because: "大成功を重ねた",
    test: (h) => h.greatSteps >= 2,
    change: "豆を加えて、腹持ちと栄養を高める",
    apply: (b) => ({ ingredients: addLine(b.ingredients, "beans", 0.2), salesTags: addTag(b.salesTags, "healthy") }),
    namePrefixes: ["滋養の", "力の出る"],
  },
  {
    id: "batch",
    label: "大鍋仕立て",
    because: "10食以上をまとめて作った",
    test: (h) => h.maxBatch >= 10,
    change: "大鍋向けに手順を整え、体力の消耗を抑える",
    apply: (b) => ({ baseStamina: Math.max(1, Math.round(b.baseStamina * 0.85)), salesTags: addTag(b.salesTags, "deli") }),
    namePrefixes: ["大鍋の", "村祭りの"],
  },
];

export const DERIVATION_RULE_MAP: Record<string, DerivationRule> = Object.fromEntries(DERIVATION_RULES.map((r) => [r.id, r]));
