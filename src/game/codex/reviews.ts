import type { AxisScores } from "../../types";
import type { ReviewSource, ThirdPartyReview } from "../../types/codex";
import type { EaterProfile, EaterCondition } from "../../types/eating";
import { FIGHTER_MAP, type FoodFighter } from "../../data/fighters";
import { AXIS_LABEL } from "../labels";
import { dishTags } from "../battle/battle";
import { eatPortion } from "../commerce/simpleCook";
import { tasteDish, type TastableDish } from "../eating/tasting";
import { addReview, codexKeyOf } from "./codex";
import type { World } from "../world";

// 第三者の食レポ: a reviewer tastes the dish with their own palate and writes good points, problems,
// who it suits and an impression. Template text only (no external AI).

export interface Reviewer {
  id: string;
  name: string;
  level: number;
  fame: number;
  /** Base weight in public scoring. */
  weight: number;
  specialty: string[];
  detail: number; // 0..2
  eater: EaterProfile;
}

export function fighterReviewer(f: FoodFighter): Reviewer {
  return { id: f.id, name: f.name, level: f.level, fame: f.fame, weight: f.reviewWeight, specialty: f.specialty, detail: f.detail, eater: f.eater };
}

/** Quest / battle judges review too (level and fame from their role). */
export function judgeReviewer(j: EaterProfile): Reviewer {
  return { id: j.id, name: j.name, level: 10, fame: 20, weight: 1.5, specialty: [], detail: 1, eater: j };
}

const FOR_WHOM: { test: (s: AxisScores, tags: string[]) => boolean; text: string }[] = [
  { test: (s) => s.nutrition >= 65, text: "疲れた働き手や体を壊した人" },
  { test: (s, t) => t.includes("meat") || s.craveability >= 65, text: "がっつり食べたい若い人" },
  { test: (_s, t) => t.includes("soup"), text: "寒い日に温まりたい人" },
  { test: (s) => s.costPerformance >= 65, text: "財布の軽い家族" },
  { test: (s) => s.originality >= 65, text: "新しい味を探している食通" },
];

export function makeReview(
  dish: TastableDish & { recipeId?: string | null },
  r: Reviewer,
  ctx: { context: string; source: ReviewSource; day: number; condition?: EaterCondition },
): ThirdPartyReview {
  const t = tasteDish(dish, r.eater, ctx.condition ?? r.eater.condition);
  const tags = dishTags({ ...dish, recipeId: dish.recipeId ?? undefined });
  const inSpecialty = r.specialty.length === 0 || tags.some((x) => r.specialty.includes(x));
  const axes = Object.entries(dish.scores) as [keyof AxisScores, number][];
  const best = [...axes].sort((a, b) => b[1] - a[1])[0];
  const worst = [...axes].sort((a, b) => a[1] - b[1])[0];
  const good = [t.likes.length ? `${t.likes.slice(0, r.detail + 1).join("・")}がいい` : null, r.detail >= 1 ? `${AXIS_LABEL[best[0]]}が光る` : null]
    .filter(Boolean).join("。") || "食べやすい";
  const bad = [t.dislikes.length ? `${t.dislikes[0]}が気になる` : null, r.detail >= 1 && worst[1] < 50 ? `${AXIS_LABEL[worst[0]]}は物足りない` : null]
    .filter(Boolean).join("。") || (r.detail >= 2 ? "大きな欠点は見当たらない" : "特になし");
  const forWhom = FOR_WHOM.find((f) => f.test(dish.scores, tags))?.text ?? "誰にでも";
  const band = t.score >= 80 ? "また食べに来たい。人に勧められる一皿" : t.score >= 60 ? "手堅くうまい。日常に欲しい味" : t.score >= 40 ? "悪くはないが、もう一押し" : "今の自分の口には合わなかった";
  const expert = r.detail >= 2 ? (inSpecialty ? "（専門分野からの評）" : "（専門外なので参考程度に）") : "";
  return {
    reviewerId: r.id, reviewerName: r.name, reviewerLevel: r.level, reviewerFame: r.fame,
    // Fame counts, but nobody is an expert in everything: outside the specialty half the weight.
    weight: Math.round(r.weight * (inSpecialty ? 1 : 0.5) * 100) / 100,
    context: ctx.context, score: Math.round(t.score), good, bad, forWhom, impression: band + expert, day: ctx.day, source: ctx.source,
  };
}

/** フードファイターを雇う: pay the fee, they eat one portion and write a review into the codex. */
export function hireTaster(
  w: World,
  stockId: string,
  dish: TastableDish & { recipeId?: string | null },
  fighterId: string,
): { world: World; review: ThirdPartyReview } | string {
  const f = FIGHTER_MAP[fighterId];
  if (!f) return "そのフードファイターはいない";
  if (w.chef.money < f.fee) return "お金が足りない";
  const key = codexKeyOf({ name: dish.name, recipeId: dish.recipeId ?? null });
  if (!w.codex?.[key]) return "図鑑にない料理は依頼できない";
  const ate = eatPortion(w, stockId);
  if (typeof ate === "string") return ate;
  // eatPortion restores the player's stamina; a hired eater should not, so keep the old chef.
  const paid = { ...ate, chef: { ...w.chef, money: Math.round((w.chef.money - f.fee) * 100) / 100 } };
  const review = makeReview(dish, fighterReviewer(f), { context: "依頼した食レポ", source: "hiredTaster", day: Math.floor(w.day) + 1 });
  return { world: addReview(paid, key, review), review };
}
