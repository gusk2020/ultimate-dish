import type { Eater } from "../../types";
import type { FinishInput, FinishReview } from "../../types/world";

// 仕上げ・盛り付け: the "user prompt" at the end of cooking. It nudges a few axes a little;
// it must never overturn the dish's base performance (each axis is capped at ±6).

export const EMPTY_FINISH: FinishInput = {
  mode: "qa", plating: "", vessel: "", aroma: "", temperature: "", howToEat: "", freeText: "",
};

export const FINISH_OPTIONS = {
  plating: ["山盛りに豪快に", "中央に高く重ねる", "素朴に並べる", "ソースで線を描く"],
  vessel: ["木の椀", "素焼きの皿", "白い陶器", "鉄板"],
  aroma: ["ハーブを添える", "燻香をまとわせる", "焼き立てを出す", "特になし"],
  temperature: [["hot", "熱々"], ["warm", "温かい"], ["cold", "冷やして"]] as const,
  howToEat: ["パンに挟んで", "匙ですくって", "手づかみで", "取り分けて"],
};

const HOT_WORDS = ["熱々", "湯気", "焼き立て", "アツアツ"];
const COLD_WORDS = ["冷た", "冷や", "ひんやり", "氷"];
const VESSEL_WORDS: [string, string][] = [["椀", "木の椀"], ["鉄板", "鉄板"], ["陶器", "白い陶器"], ["素焼", "素焼きの皿"]];

const LOCAL = new Set(["木の椀", "素焼きの皿", "素朴に並べる", "手づかみで", "パンに挟んで"]);

export function reviewFinish(input: FinishInput): FinishReview {
  const n: FinishInput = { ...input };
  const corrections: string[] = [];
  const warnings: string[] = [];
  const text = input.freeText;

  // 温度: free text vs selected temperature. Unset → auto-fill (light); clash → warning (serious).
  const saysHot = HOT_WORDS.some((w) => text.includes(w));
  const saysCold = COLD_WORDS.some((w) => text.includes(w));
  if (saysHot && saysCold) warnings.push("自由記述に「熱い」と「冷たい」が両方ある");
  else if (saysHot && n.temperature === "cold") warnings.push("提供温度は「冷やして」なのに、自由記述は熱々");
  else if (saysCold && n.temperature === "hot") warnings.push("提供温度は「熱々」なのに、自由記述は冷たい");
  else if (saysHot && !n.temperature) {
    n.temperature = "hot";
    corrections.push("提供温度を「熱々」に補正");
  } else if (saysCold && !n.temperature) {
    n.temperature = "cold";
    corrections.push("提供温度を「冷やして」に補正");
  }

  // 器: free text names a different vessel → follow the text (light).
  const named = VESSEL_WORDS.find(([w]) => text.includes(w));
  if (named && n.vessel && n.vessel !== named[1]) {
    corrections.push(`器を自由記述に合わせて「${named[1]}」に補正`);
    n.vessel = named[1];
  } else if (named && !n.vessel) n.vessel = named[1];

  // Small axis nudges.
  const filled = [n.plating, n.vessel, n.aroma, n.temperature, n.howToEat].filter(Boolean).length;
  const words = new Set(text.replace(/[、。\s]/g, " ").split(" ").filter(Boolean)).size;
  const localCount = [n.plating, n.vessel, n.howToEat].filter((x) => LOCAL.has(x)).length;
  const axes: FinishReview["axes"] = {
    originality: Math.min(6, Math.floor(text.length / 25) + (n.plating === "ソースで線を描く" ? 2 : 0)),
    culture: Math.min(6, localCount * 2),
    craveability: Math.min(6, (n.aroma && n.aroma !== "特になし" ? 3 : 0) + (n.temperature === "hot" ? 2 : 0)),
    deliciousness: Math.min(3, Math.floor(filled / 2)) - (warnings.length ? 3 : 0),
  };
  if (words === 0 && filled === 0) axes.originality = 0;
  return { corrections, warnings, axes, normalized: n };
}

/** 体験評価への仕上げ補正: conservative eaters like local presentation; hungry ones like hot food. */
export function finishExperienceBonus(finish: FinishInput | undefined, eater: Eater): number {
  if (!finish) return 0;
  let v = 0;
  const local = [finish.plating, finish.vessel, finish.howToEat].filter((x) => LOCAL.has(x)).length;
  v += local * 2 * (1 - eater.adventurous);
  if (finish.plating === "ソースで線を描く") v += 4 * (eater.adventurous - 0.5);
  if (finish.temperature === "hot") v += 3 * eater.hunger;
  return Math.round(Math.max(-5, Math.min(6, v)));
}
