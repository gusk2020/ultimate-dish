import { AXIS_LABEL } from "../labels";
import type { Dish, Eater, Quest, QuestResult } from "../../types";
import { experienceOf } from "../evaluation/experience";

/** Weighted score over the quest's focus axes. */
export function questScore(quest: Quest, dish: Pick<Dish, "scores">): number {
  const wsum = quest.conditions.reduce((a, c) => a + c.weight, 0) || 1;
  return Math.round(quest.conditions.reduce((a, c) => a + dish.scores[c.axis] * c.weight, 0) / wsum);
}

export function judgeQuest(quest: Quest, dish: Dish, eater: Eater): QuestResult {
  const score = questScore(quest, dish);
  const exp = experienceOf(dish, eater);
  const requirementMet = quest.requirement ? quest.requirement.test(dish.recipe) : true;
  const checks = quest.conditions.map((c) => ({
    axis: c.axis,
    value: dish.scores[c.axis],
    min: c.min,
    ok: c.min === undefined || dish.scores[c.axis] >= c.min,
  }));

  const reasons: string[] = [];
  if (!requirementMet && quest.requirement) reasons.push(`条件未達：${quest.requirement.label}`);
  for (const c of checks) {
    if (!c.ok) reasons.push(`${AXIS_LABEL[c.axis]}が足りない（${c.value} / 必要${c.min}）`);
  }
  if (score < quest.passScore) reasons.push(`依頼評価が足りない（${score} / 必要${quest.passScore}）`);
  if (exp.score < quest.minExperience) {
    reasons.push(`${eater.name}の満足度が足りない（${exp.score} / 必要${quest.minExperience}）`);
  }
  reasons.push(...exp.comments.map((c) => `${eater.name}：「${c}」`));

  const success =
    requirementMet && checks.every((c) => c.ok) && score >= quest.passScore && exp.score >= quest.minExperience;

  return {
    questId: quest.id,
    dishId: dish.id,
    success,
    questScore: score,
    experience: exp.score,
    requirementMet,
    checks,
    reasons,
  };
}
