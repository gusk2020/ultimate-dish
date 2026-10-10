import type { CompanionPresentation, GenderExpression, StartChoice } from "../types/identity";
import type { Lean } from "../types/social";

// キャラクター作成の文言。性別表現・年齢は文章にだけ使う（能力には一切関わらない）。

export const AGE_MIN = 15;
export const AGE_MAX = 35;
export const AGE_DEFAULT = 20;

export const LEAN_CHOICES: { id: Lean; label: string; hint: string }[] = [
  { id: "maker", label: "作る側", hint: "鍋を握り、皿を差し出す" },
  { id: "eater", label: "食べる側", hint: "皿を受け取り、味を確かめる" },
];

/** The diamond: top / left / right / bottom around the centre. */
export const GENDER_CHOICES: { id: GenderExpression; label: string; pos: "top" | "left" | "right" | "bottom" }[] = [
  { id: "androgynous", label: "両性", pos: "top" },
  { id: "masculine", label: "男性", pos: "left" },
  { id: "feminine", label: "女性", pos: "right" },
  { id: "neutral", label: "無性", pos: "bottom" },
];
export const GENDER_LABEL: Record<GenderExpression, string> = { masculine: "男性", feminine: "女性", androgynous: "両性", neutral: "無性" };

export const START_CHOICES: { id: StartChoice; label: string; hint: string }[] = [
  { id: "companion", label: "相棒を迎える", hint: "あなたと正反対の、人ならぬ道連れ" },
  { id: "tool", label: "魔導具をひとつ選ぶ", hint: "ひとりで歩く代わりに、頼れる道具を" },
];

export const PRESENTATION_CHOICES: { id: CompanionPresentation; label: string }[] = [
  { id: "boy", label: "男の子" },
  { id: "girl", label: "女の子" },
];

/** The starting magic tools, as cards: one line, and what each is good at. */
export const TOOL_INTRO: Record<string, { line: string; good: string }> = {
  stone: { line: "火の魔石を抱いた小さな炉。", good: "焼く・煮るが速く、失敗しにくい" },
  jar: { line: "中の時間だけを早める壺。", good: "漬け・干し・発酵・燻製が一晩で済む" },
  pot: { line: "香りを閉じ込める蓋つきの鍋。", good: "香りが飛ぶ失敗を防ぐ" },
};

/** The two temperament questions the companion route needs (the other two are inferred). */
export const TEMPERAMENT_QUESTIONS: { axis: "pace" | "talk"; question: string; low: string; high: string }[] = [
  { axis: "pace", question: "鍋の前でのあなたは", low: "慎重", high: "即断" },
  { axis: "talk", question: "厨房でのあなたは", low: "寡黙", high: "おしゃべり" },
];
