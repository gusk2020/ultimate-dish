// 同じ事件を表裏で遊ぶ (Phase 10): one story, one place, the same people — a cook plays one side
// (makes and submits), an eater the other (tastes, compares, judges).

export interface QuestStory {
  storyId: string;
  locationId: string;
  title: string;
  /** A request (QUESTS) or a battle (BATTLES) for the cook. */
  makerQuestId: string;
  /** An eater request or contest (EATER_QUESTS). */
  eaterQuestId: string;
  sharedNPCs: string[];
  sharedTheme: string;
}

export const QUEST_STORIES: QuestStory[] = [
  { storyId: "pest", locationId: "village", title: "畑を荒らす獣", makerQuestId: "q1", eaterQuestId: "eq-pest", sharedNPCs: ["ヨハン村長", "農夫ガルド"], sharedTheme: "猪と兎を村の料理に" },
  { storyId: "nutrition", locationId: "village", title: "村の栄養改善", makerQuestId: "q2", eaterQuestId: "eq-nutrition", sharedNPCs: ["ヨハン村長", "エルザ婆さん"], sharedTheme: "体を養う一皿" },
  { storyId: "meibutsu", locationId: "village", title: "村の名物を決める", makerQuestId: "q3", eaterQuestId: "eq-meibutsu", sharedNPCs: ["ヨハン村長"], sharedTheme: "旅人に出せる村の名物" },
  { storyId: "trial", locationId: "village", title: "ガルドとの腕試し", makerQuestId: "tutorial", eaterQuestId: "eq-judge-trial", sharedNPCs: ["農夫ガルド", "ヨハン村長"], sharedTheme: "村の家庭の味" },
  { storyId: "harvest", locationId: "village", title: "収穫祭", makerQuestId: "harvest", eaterQuestId: "eq-judge-harvest", sharedNPCs: ["北方の猟師シグルド"], sharedTheme: "冬と収穫の一皿" },
  { storyId: "inn", locationId: "village", title: "宿の看板料理", makerQuestId: "berta-duel", eaterQuestId: "eq-judge-berta", sharedNPCs: ["宿の料理番ベルタ"], sharedTheme: "宿の看板になる一皿" },
  { storyId: "river-fish", locationId: "rivertown", title: "渡し場の川魚", makerQuestId: "rq-river-fish", eaterQuestId: "eq-river-compare", sharedNPCs: ["渡し守ハンス", "渡し場の料理人ミロ"], sharedTheme: "旅人の川魚料理" },
  { storyId: "river-market", locationId: "rivertown", title: "市場の早仕事", makerQuestId: "river-duel", eaterQuestId: "eq-river-judge", sharedNPCs: ["渡し場の料理人ミロ"], sharedTheme: "旅人の早い一皿" },
  { storyId: "harbor-catch", locationId: "harbor", title: "今朝の水揚げ", makerQuestId: "rq-harbor-seafood", eaterQuestId: "eq-harbor-taste", sharedNPCs: ["漁師頭マレ", "港の料理長カルメ"], sharedTheme: "港の魚介" },
  { storyId: "harbor-duel", locationId: "harbor", title: "港の魚介勝負", makerQuestId: "harbor-duel", eaterQuestId: "eq-harbor-judge", sharedNPCs: ["港の料理長カルメ"], sharedTheme: "港の魚介" },
  { storyId: "highland-winter", locationId: "highland", title: "冬の子供の食卓", makerQuestId: "rq-highland-dairy", eaterQuestId: "eq-highland-compare", sharedNPCs: ["山羊飼いイルゼ", "燻製師オルガ"], sharedTheme: "乳と燻製" },
  { storyId: "highland-duel", locationId: "highland", title: "冬越しの勝負", makerQuestId: "highland-duel", eaterQuestId: "eq-highland-judge", sharedNPCs: ["燻製師オルガ"], sharedTheme: "冬を越す滋養" },
];

export function storyOfMaker(id: string): QuestStory | undefined {
  return QUEST_STORIES.find((s) => s.makerQuestId === id);
}
export function storyOfEater(id: string): QuestStory | undefined {
  return QUEST_STORIES.find((s) => s.eaterQuestId === id);
}
