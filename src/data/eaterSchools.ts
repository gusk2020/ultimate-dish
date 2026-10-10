// 食べる側の流派とスキル (Phase 10): the mirror image of the cooks' schools and skills.
// A cook's school polishes technique to MAKE a dish; an eater's school polishes the senses to SEE
// through one. Skills grow from what is actually eaten (its methods and ingredients).

export type EaterSkillId =
  | "judgeGrill" | "judgeStew" | "judgeFerment" | "judgeHeat" | "judgePrep"
  | "palate" | "smell" | "texture" | "ingredients" | "seafood" | "culture" | "capacity" | "spice" | "report";

export interface EaterSkillDef {
  id: EaterSkillId;
  name: string;
  /** The cook's skill / method this one mirrors (for the player). */
  mirrors: string;
  effect: string;
}

export const EATER_SKILLS: EaterSkillDef[] = [
  { id: "judgeGrill", name: "焼き加減を見抜く", mirrors: "焼く・炒める", effect: "焼き物の火入れ判定" },
  { id: "judgeStew", name: "煮込みを見抜く", mirrors: "煮る・煮詰める", effect: "煮込みの火入れ判定" },
  { id: "judgeFerment", name: "発酵・燻製を見抜く", mirrors: "発酵・漬け・干し・燻し", effect: "保存の出来の判定" },
  { id: "judgeHeat", name: "火入れ判定", mirrors: "火入れ", effect: "審査の火入れ判定" },
  { id: "judgePrep", name: "下処理判定", mirrors: "包丁", effect: "審査の下処理判定" },
  { id: "palate", name: "味覚", mirrors: "味付け", effect: "味の構成・テーマの判定" },
  { id: "smell", name: "嗅覚", mirrors: "香りの演出", effect: "審査の香り判定" },
  { id: "texture", name: "食感分析", mirrors: "仕上げ", effect: "食べ比べの見立て" },
  { id: "ingredients", name: "食材識別", mirrors: "食材の扱い", effect: "未知の食材を見抜く" },
  { id: "seafood", name: "魚介", mirrors: "川魚・海魚", effect: "魚介料理の見立て" },
  { id: "culture", name: "文化理解", mirrors: "流派", effect: "テーマ・地域性の判定" },
  { id: "capacity", name: "食容量", mirrors: "工程数", effect: "大食いの限界が伸びる" },
  { id: "spice", name: "刺激耐性", mirrors: "強靭", effect: "激辛に強くなる" },
  { id: "report", name: "食レポ", mirrors: "盛り付け", effect: "食レポ執筆料が増える" },
];

export const EATER_SKILL_MAP: Record<EaterSkillId, EaterSkillDef> = Object.fromEntries(EATER_SKILLS.map((s) => [s.id, s])) as Record<EaterSkillId, EaterSkillDef>;

export interface EaterSchool {
  id: string;
  name: string;
  philosophy: string;
  specialty: string;
  /** Skill xp multipliers while this school is active. */
  skillXpMult: Partial<Record<EaterSkillId, number>>;
  /** Flat bonus to judging accuracy for these judge items. */
  judgeBonus: Partial<Record<"heat" | "prep" | "aroma" | "theme" | "preserve", number>>;
  capacityBonus: number;
  spiceBonus: number;
}

export const EATER_SCHOOLS: EaterSchool[] = [
  {
    id: "taste-analysis", name: "舌読みの会", philosophy: "味は分解できる", specialty: "味覚分析・火入れ判定",
    skillXpMult: { palate: 1.5, judgeHeat: 1.5, judgeGrill: 1.3, judgeStew: 1.3 },
    judgeBonus: { heat: 0.08, theme: 0.04 }, capacityBonus: 0, spiceBonus: 0,
  },
  {
    id: "aroma-culture", name: "香味探訪派", philosophy: "皿の向こうに土地がある", specialty: "香り・地域文化・保存",
    skillXpMult: { smell: 1.5, culture: 1.5, judgeFerment: 1.3, ingredients: 1.2 },
    judgeBonus: { aroma: 0.08, preserve: 0.08, theme: 0.03 }, capacityBonus: 0, spiceBonus: 0,
  },
  {
    id: "iron-stomach", name: "鉄胃道", philosophy: "食べきってこそ分かる", specialty: "大食い・激辛・未知食材",
    skillXpMult: { capacity: 1.6, spice: 1.6, ingredients: 1.3 },
    judgeBonus: { prep: 0.03 }, capacityBonus: 1, spiceBonus: 1,
  },
];

export const EATER_SCHOOL_MAP: Record<string, EaterSchool> = Object.fromEntries(EATER_SCHOOLS.map((s) => [s.id, s]));
export const DEFAULT_EATER_SCHOOL = "taste-analysis";
