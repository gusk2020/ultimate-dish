import type { TextureTag } from "../types";
import type { BaseTaste } from "../types/eating";

// 食遍歴: about five questions about what the player has actually eaten, not "do you like X".
// Each answer nudges internal tendencies and leaves a memory line for profiles / reports.

export interface StoryEffect {
  taste?: Partial<Record<BaseTaste, number>>;
  aroma?: number;
  texture?: Partial<Record<TextureTag, number>>;
  familiar?: Partial<Record<string, number>>;
  schools?: Partial<Record<string, number>>;
  adventurous?: number;
}

export interface StoryOption {
  id: string;
  label: string;
  memory: string;
  effect: StoryEffect;
}

export interface StoryQuestion {
  id: string;
  question: string;
  options: StoryOption[];
}

export const FOOD_STORY: StoryQuestion[] = [
  {
    id: "childhood",
    question: "子どもの頃、よく食卓に並んでいたのは？",
    options: [
      { id: "porridge", label: "麦粥と野菜の煮物", memory: "麦粥と野菜の煮物で育った", effect: { familiar: { plant: 0.4 }, schools: { village: 0.4 }, taste: { sweet: 0.1, umami: 0.1 }, texture: { soft: 0.2 } } },
      { id: "game", label: "父が獲ってきた獣の肉", memory: "獲れたての獣肉の匂いが家の匂いだった", effect: { familiar: { animal: 0.4 }, schools: { north: 0.4 }, taste: { umami: 0.2, salty: 0.1 }, texture: { chewy: 0.2 } } },
      { id: "dried-fish", label: "港町の干し魚", memory: "干し魚をかじりながら育った", effect: { familiar: { animal: 0.3, seasoning: 0.2 }, schools: { north: 0.2 }, taste: { salty: 0.3 }, aroma: 0.1, texture: { firm: 0.2 } } },
      { id: "pastry", label: "屋敷の甘い焼き菓子", memory: "甘い焼き菓子の香りを覚えている", effect: { familiar: { dairy: 0.4 }, schools: { court: 0.4 }, taste: { sweet: 0.3 }, texture: { crisp: 0.2 } } },
    ],
  },
  {
    id: "feast",
    question: "「ごちそう」として記憶に残っているのは？",
    options: [
      { id: "roast", label: "祭りの日の丸焼き", memory: "祭りの丸焼きが一番のごちそうだった", effect: { taste: { umami: 0.2 }, aroma: 0.2, familiar: { animal: 0.2 } } },
      { id: "stew", label: "冬の夜の熱いシチュー", memory: "冬の夜のシチューが忘れられない", effect: { taste: { umami: 0.1, salty: 0.1 }, texture: { tender: 0.3 }, schools: { village: 0.2 } } },
      { id: "honey-fruit", label: "蜂蜜をかけた果物", memory: "蜂蜜がけの果物が特別な日の味だった", effect: { taste: { sweet: 0.3, sour: 0.1 }, familiar: { plant: 0.2 } } },
      { id: "smoked", label: "香草たっぷりの燻製", memory: "香草の燻製の香りに胸が躍った", effect: { aroma: 0.3, taste: { bitter: 0.1 }, adventurous: 0.1, schools: { north: 0.2 } } },
    ],
  },
  {
    id: "disliked",
    question: "苦手だった味や料理は？",
    options: [
      { id: "bitter-greens", label: "苦い野草のおひたし", memory: "苦い野草は今でも少し苦手", effect: { taste: { bitter: -0.4 } } },
      { id: "pickles", label: "酸っぱすぎる漬物", memory: "酸っぱい漬物には顔をしかめた", effect: { taste: { sour: -0.4 } } },
      { id: "gristle", label: "噛み切れない筋肉", memory: "噛み切れない肉に泣いたことがある", effect: { texture: { chewy: -0.4 } } },
      { id: "none", label: "特に思い当たらない", memory: "好き嫌いはあまりなかった", effect: { adventurous: 0.15 } },
    ],
  },
  {
    id: "journey",
    question: "旅や特別な日に、印象に残った食事は？",
    options: [
      { id: "spice", label: "異国の香辛料の料理", memory: "旅先の香辛料に世界の広さを知った", effect: { aroma: 0.2, adventurous: 0.25 } },
      { id: "hut-soup", label: "山小屋の素朴なスープ", memory: "山小屋のスープに救われた", effect: { texture: { soft: 0.2 }, schools: { village: 0.2 }, adventurous: -0.05 } },
      { id: "banquet", label: "王都の宴の料理", memory: "王都の宴で見た皿の美しさを覚えている", effect: { schools: { court: 0.3 }, taste: { sweet: 0.1 }, adventurous: 0.1 } },
      { id: "never", label: "旅はほとんどしたことがない", memory: "村の外の味はほとんど知らない", effect: { adventurous: -0.15 } },
    ],
  },
  {
    id: "tired",
    question: "疲れた時に食べたくなるのは？",
    options: [
      { id: "salty-meat", label: "塩気の効いた肉", memory: "疲れた日は塩気の効いた肉に限る", effect: { taste: { salty: 0.2, umami: 0.2 } } },
      { id: "sweets", label: "甘いもの", memory: "疲れると甘いものに手が伸びる", effect: { taste: { sweet: 0.3 } } },
      { id: "warm-soup", label: "温かいスープ", memory: "疲れた時は温かいスープが一番", effect: { texture: { soft: 0.2 }, taste: { umami: 0.1 } } },
      { id: "sour-fruit", label: "酸っぱい果物", memory: "疲れた時は酸っぱい果物で目を覚ます", effect: { taste: { sour: 0.2 }, aroma: 0.1 } },
    ],
  },
];

/** Light keyword reading of the optional free text. */
export const FREE_TEXT_HINTS: { words: string[]; effect: StoryEffect }[] = [
  { words: ["甘", "蜂蜜", "菓子"], effect: { taste: { sweet: 0.1 } } },
  { words: ["しょっぱ", "塩"], effect: { taste: { salty: 0.1 } } },
  { words: ["酸っぱ", "酢"], effect: { taste: { sour: 0.1 } } },
  { words: ["旨", "うま味", "出汁"], effect: { taste: { umami: 0.1 } } },
  { words: ["香り", "香草", "スパイス", "香辛料"], effect: { aroma: 0.1 } },
  { words: ["肉"], effect: { familiar: { animal: 0.1 } } },
  { words: ["野菜", "豆", "麦"], effect: { familiar: { plant: 0.1 } } },
  { words: ["カリカリ", "サクサク"], effect: { texture: { crisp: 0.1 } } },
  { words: ["とろとろ", "やわらか", "柔らか"], effect: { texture: { tender: 0.1 } } },
];

/** The player's own short tasting report (Q&A + optional free text). */
export const TASTING_QUESTIONS: { id: string; question: string; options: { id: string; label: string; liking?: number }[] }[] = [
  { id: "liked", question: "どうだった？", options: [{ id: "love", label: "最高", liking: 1 }, { id: "good", label: "おいしい", liking: 0.5 }, { id: "meh", label: "ふつう", liking: 0 }, { id: "bad", label: "いまひとつ", liking: -0.7 }] },
  { id: "highlight", question: "一番印象に残ったのは？", options: [{ id: "aroma", label: "香り" }, { id: "texture", label: "食感" }, { id: "taste", label: "味" }, { id: "after", label: "後味" }] },
  { id: "again", question: "また食べたい？", options: [{ id: "yes", label: "毎日でも", liking: 0.3 }, { id: "sometimes", label: "たまに", liking: 0 }, { id: "no", label: "もういい", liking: -0.3 }] },
];
