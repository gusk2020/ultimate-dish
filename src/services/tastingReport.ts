import type { EaterProfile, StageScore, TastingResult, TastingStage } from "../types/eating";

// 食リポ service. Template lines now; a future AI writer implements the same interface and
// receives the same context (dish, eater profile, condition, evaluation).

export interface TastingContext {
  dishName: string;
  eater: EaterProfile;
  result: TastingResult;
  plating?: string;
  vessel?: string;
}

export interface TastingLine {
  stage: TastingStage;
  label: string;
  text: string;
  tone: StageScore["tone"];
}

export interface TastingReporter {
  /** All seven stages (the player's own meal). */
  full(ctx: TastingContext): TastingLine[];
  /** A judge's short comment in a battle. */
  brief(ctx: TastingContext): string;
}

export const STAGE_LABEL: Record<TastingStage, string> = {
  look: "見た目", aroma: "香り", firstBite: "最初の一口", texture: "食感", spread: "味の広がり", aftertaste: "後味", satisfaction: "満足感",
};

const LINES: Record<TastingStage, Record<StageScore["tone"], string>> = {
  look: { good: "器の上で湯気が立ち、思わず手が伸びる。", neutral: "素朴な見た目だ。", bad: "見た目は少し寂しい。" },
  aroma: { good: "立ちのぼる香りに食欲がわく。", neutral: "ほのかに香る。", bad: "香りはあまり感じない。" },
  firstBite: { good: "一口目から、ぐっと来る。", neutral: "まずまずの一口目。", bad: "一口目で首をかしげた。" },
  texture: { good: "食感が心地いい。", neutral: "食感はふつう。", bad: "食感がどうも気になる。" },
  spread: { good: "噛むほど味が広がっていく。", neutral: "味はまとまっている。", bad: "味がぼやけている。" },
  aftertaste: { good: "後味がすっきりして、もう一口ほしくなる。", neutral: "後味は穏やか。", bad: "後味に引っかかりが残る。" },
  satisfaction: { good: "大満足の一皿だ。", neutral: "それなりに満たされた。", bad: "満足とは言いにくい。" },
};

const templateReporter: TastingReporter = {
  full(ctx) {
    return ctx.result.stages.map((s) => {
      let text = LINES[s.stage][s.tone];
      if (s.stage === "look" && ctx.vessel && s.tone !== "bad") text = `${ctx.vessel}に盛られている。${text}`;
      if (s.stage === "firstBite" && ctx.result.likes.length) text += `${ctx.result.likes[0]}がうれしい。`;
      if (s.stage === "firstBite" && ctx.result.dislikes.length) text += `${ctx.result.dislikes[0]}は少し苦手だ。`;
      if (s.stage === "satisfaction" && s.tone === "good" && ctx.eater.memories?.length && ctx.result.familiarity >= 0.4) {
        text += `ふと「${ctx.eater.memories[0]}」ことを思い出す。`;
      }
      return { stage: s.stage, label: STAGE_LABEL[s.stage], text, tone: s.tone };
    });
  },
  brief(ctx) {
    const r = ctx.result;
    const first = r.stages.find((s) => s.stage === "firstBite")!;
    const parts = [LINES.firstBite[first.tone]];
    if (r.likes.length) parts.push(`${r.likes[0]}が好みだ。`);
    else if (r.dislikes.length) parts.push(`${r.dislikes[0]}が気になる。`);
    parts.push(LINES.satisfaction[r.stages[6].tone]);
    return parts.join("");
  },
};

export const tastingReporter: TastingReporter = templateReporter;
