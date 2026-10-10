import type { GenderExpression, PlayerIdentity } from "../../types/identity";

// 性別表現・年齢の使い道は文章だけ: NPC からの呼ばれ方、一人称の候補、台詞の差分。
// 能力・成功率・成長・料理の計算からは決して参照しない。

/** How villagers might address the player. */
export function addressFor(id: Pick<PlayerIdentity, "genderExpression" | "age">): string {
  const age = id.age ?? 20;
  switch (id.genderExpression) {
    case "masculine": return age < 20 ? "坊や" : age < 30 ? "兄さん" : "旦那";
    case "feminine": return age < 20 ? "お嬢ちゃん" : age < 30 ? "姉さん" : "姐さん";
    default: return age < 20 ? "若いの" : "料理人さん";
  }
}

const FIRST_PERSON: Record<GenderExpression, string[]> = {
  masculine: ["俺", "僕", "私"],
  feminine: ["私", "あたし", "うち"],
  androgynous: ["私", "僕", "自分"],
  neutral: ["私", "自分", "わたくし"],
};

/** First-person pronoun candidates for future dialogue. */
export function firstPersonCandidates(g: GenderExpression | null): string[] {
  return g ? FIRST_PERSON[g] : FIRST_PERSON.neutral;
}
