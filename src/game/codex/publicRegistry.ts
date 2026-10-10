import type { CodexEntry, PublicDishRecord, PublicStage, ThirdPartyReview } from "../../types/codex";
import type { World } from "../world";

// 公開料理: dishes published through the guild climb from the guild register to the world canon.
// Public score = the dish's own (absolute) score plus third-party reviews, weighted by the
// reviewers' fame and expertise; no single review can dominate.

export const STAGES: PublicStage[] = ["guild", "nation", "region", "civilization", "world"];

export const STAGE_INFO: Record<PublicStage, { name: string; short: string }> = {
  guild: { name: "料理ギルド登録", short: "ギルド" },
  nation: { name: "王国料理図書館登録", short: "王国" },
  region: { name: "西方地域料理録", short: "地域" },
  civilization: { name: "西洋文明圏料理大全", short: "文明圏" },
  world: { name: "世界料理大典", short: "世界" },
};

/** What the NEXT stage requires (index = target stage). */
export const STAGE_REQUIREMENTS: Record<Exclude<PublicStage, "guild">, { score: number; reviews: number; fame: number; reproductions: number }> = {
  nation: { score: 55, reviews: 1, fame: 0, reproductions: 0 },
  region: { score: 65, reviews: 2, fame: 0, reproductions: 0 },
  civilization: { score: 75, reviews: 2, fame: 50, reproductions: 1 },
  world: { score: 85, reviews: 3, fame: 70, reproductions: 2 },
};

export const PUBLISH_FEE = 10;
/** One review can never count more than this. */
export const REVIEW_WEIGHT_CAP = 3;
const ABSOLUTE_WEIGHT = 2;

export function publicScore(r: Pick<PublicDishRecord, "absolute" | "reviews">): number {
  let num = r.absolute * ABSOLUTE_WEIGHT;
  let den = ABSOLUTE_WEIGHT;
  for (const v of r.reviews) {
    const wgt = Math.min(REVIEW_WEIGHT_CAP, v.weight);
    num += wgt * v.score;
    den += wgt;
  }
  return Math.round((num / den) * 10) / 10;
}

export function nextStage(s: PublicStage): PublicStage | null {
  return STAGES[STAGES.indexOf(s) + 1] ?? null;
}

/** null when it may be promoted; otherwise what is missing. */
export function promotionBlock(r: PublicDishRecord): string | null {
  const next = nextStage(r.stage);
  if (!next) return "これ以上の段階はない";
  const req = STAGE_REQUIREMENTS[next as Exclude<PublicStage, "guild">];
  const missing: string[] = [];
  const score = publicScore(r);
  if (score < req.score) missing.push(`公開評価${req.score}以上（現在${score}）`);
  if (r.reviews.length < req.reviews) missing.push(`第三者の食レポ${req.reviews}件以上（現在${r.reviews.length}件）`);
  const fame = Math.max(0, ...r.reviews.map((v) => v.reviewerFame));
  if (req.fame && fame < req.fame) missing.push(`名声${req.fame}以上の評者による食レポ`);
  if (r.reproductions < req.reproductions) missing.push(`再現${req.reproductions}回以上（現在${r.reproductions}回）`);
  return missing.length ? missing.join("・") : null;
}

/** ギルドに公開: needs a dish the player has really made, and the guild fee. */
export function publish(w: World, key: string): { world: World; record: PublicDishRecord } | string {
  const e: CodexEntry | undefined = w.codex?.[key];
  if (!e) return "図鑑にない料理";
  if (e.publicId) return "もう公開している";
  if (e.timesCooked < 1) return "自分で作った料理しか公開できない";
  if (w.chef.money < PUBLISH_FEE) return "登録料が足りない";
  const reg = w.publicRegistry ?? [];
  const parentPublicIds = e.parentKeys.map((k) => w.codex?.[k]?.publicId).filter((x): x is string => !!x);
  const record: PublicDishRecord = {
    id: `pub-${key}-${reg.length + 1}`,
    codexKey: key,
    name: e.name,
    recipeId: e.recipeId,
    author: w.chef.name,
    stage: "guild",
    absolute: e.bestTotal,
    reviews: [...e.reviews],
    publishedDay: Math.floor(w.day) + 1,
    reproductions: 0,
    parentPublicIds,
  };
  return {
    world: {
      ...w,
      chef: { ...w.chef, money: w.chef.money - PUBLISH_FEE },
      codex: { ...w.codex, [key]: { ...e, publicId: record.id } },
      publicRegistry: [...reg, record],
    },
    record,
  };
}

export function promote(w: World, publicId: string): { world: World; record: PublicDishRecord } | string {
  const r = (w.publicRegistry ?? []).find((x) => x.id === publicId);
  if (!r) return "公開記録がない";
  const block = promotionBlock(r);
  if (block) return block;
  const record = { ...r, stage: nextStage(r.stage)! };
  const p = w.progression;
  return {
    world: {
      ...w,
      publicRegistry: w.publicRegistry.map((x) => (x.id === publicId ? record : x)),
      fame: { ...w.fame, village: (w.fame.village ?? 0) + 2 },
      progression: p ? { ...p, reputation: p.reputation + 2 } : p,
    },
    record,
  };
}

/** Better existing records keep the guild interesting before the player's first publish. */
const npcReview = (name: string, fame: number, score: number, comment: string): ThirdPartyReview => ({
  reviewerId: `npc-${name}`, reviewerName: name, reviewerLevel: 10, reviewerFame: fame, weight: fame >= 50 ? 3 : 1.5,
  context: "公開審査", score, good: comment, bad: "特になし", forWhom: "誰にでも", impression: comment, day: 1, source: "publicReview",
});

export const NPC_PUBLIC: PublicDishRecord[] = [
  { id: "pub-npc-smoked", codexKey: "smoked-boar", name: "燻製猪肉", recipeId: "smoked-boar", author: "北方の猟師シグルド", stage: "nation", absolute: 62, reviews: [npcReview("食レポ屋ノーラ", 32, 66, "煙の香りが深い")], publishedDay: 1, reproductions: 4, parentPublicIds: [] },
  { id: "pub-npc-stew", codexKey: "rabbit-stew", name: "兎の煮込み", recipeId: "rabbit-stew", author: "宿屋の女将", stage: "guild", absolute: 54, reviews: [], publishedDay: 1, reproductions: 9, parentPublicIds: [] },
  { id: "pub-npc-porridge", codexKey: "mushroom-porridge", name: "茸の麦粥", recipeId: "mushroom-porridge", author: "修道院の厨房", stage: "region", absolute: 66, reviews: [npcReview("鉄胃のガルム", 85, 70, "滋味が腹に落ちる"), npcReview("食レポ屋ノーラ", 32, 68, "やさしい")], publishedDay: 1, reproductions: 12, parentPublicIds: [] },
];

export interface RankingRow {
  record: PublicDishRecord;
  score: number;
  representative: ThirdPartyReview | null;
  mine: boolean;
}

export function ranking(w: World): RankingRow[] {
  return [...NPC_PUBLIC, ...(w.publicRegistry ?? [])]
    .map((record) => ({
      record,
      score: publicScore(record),
      representative: [...record.reviews].sort((a, b) => b.weight * b.reviewerFame - a.weight * a.reviewerFame)[0] ?? null,
      mine: !record.id.startsWith("pub-npc-"),
    }))
    .sort((a, b) => b.score - a.score || STAGES.indexOf(b.record.stage) - STAGES.indexOf(a.record.stage));
}
