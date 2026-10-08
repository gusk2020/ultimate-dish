import { SEGMENTS } from "../data/commerce";
import type { ListingResult } from "../game/commerce/sales";

// 客の声 service. Template-based now; a future food-review (食リポ) AI can implement the same
// interface. Synchronous on purpose: the day-end report is computed in one pure step.

export interface CustomerVoice {
  comments(results: ListingResult[], seed: number): string[];
}

const pick = <T,>(xs: T[], n: number) => xs[Math.abs(n) % xs.length];

const templateVoice: CustomerVoice = {
  comments(results, seed) {
    const out: string[] = [];
    results.forEach((r, i) => {
      const n = seed + i * 7;
      const who = SEGMENTS[r.topSegment].label;
      if (r.sold === 0) return out.push(`「${r.name}…今日はやめておこう」`);
      if (r.priceRatio > 1.4) out.push(pick([`「${r.name}、少し高いけどまた食べたい」`, `「うまいが、この値段は毎日は無理だな」`], n));
      else if (r.priceRatio < 0.75) out.push(pick([`「こんなに安くていいのかい？」`, `「安い！家族の分も買っていこう」`], n));
      if (r.slots[1]?.sold > 0) out.push(pick([`「昼にちょうどいい」（${who}）`, `「腹持ちがいい」（${who}）`], n + 1));
      if (r.slots[0]?.comment.includes("重い")) out.push("「朝からこれはちょっと重いな」");
      if (r.leftover === 0) out.push(pick(["「もう売り切れ？明日は早く来よう」", "「最後の一つだった、運がいい」"], n + 2));
    });
    return out.slice(0, 4);
  },
};

export const customerVoice: CustomerVoice = templateVoice;
