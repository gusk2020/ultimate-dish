import type { BaseTaste } from "../types/eating";
import type { DialogueKey, Lean, Personality, PersonalityAxis, Specialty } from "../types/social";
import type { SkillId, StatKey } from "../types/world";
import type { TextureTag } from "../types";

// 特殊相棒: three kinds of being, each with its own temperament and job in the kitchen.
// The actual candidate is built from one of these plus the player's opposite (game/social/companion.ts).

export const AXIS_LABEL: Record<PersonalityAxis, [string, string]> = {
  pace: ["慎重", "即断"],
  talk: ["寡黙", "おしゃべり"],
  mind: ["理屈", "感覚"],
  venture: ["保守", "冒険"],
};

export const LEAN_LABEL: Record<Lean, string> = { maker: "作り手", eater: "食べ手" };

/** "Because you are X, this one is Y" — keyed by the player's side of the axis. */
export const AXIS_COMPLEMENT: Record<PersonalityAxis, { low: string; high: string }> = {
  pace: { low: "あなたが慎重だから、この相棒は思いついたらすぐ動く", high: "あなたが即断型だから、この相棒は一度立ち止まって考える" },
  talk: { low: "あなたが寡黙だから、この相棒はよくしゃべる", high: "あなたがおしゃべりだから、この相棒は聞き役に回る" },
  mind: { low: "あなたが理屈で考えるから、この相棒は舌と勘を信じる", high: "あなたが感覚派だから、この相棒は味を理屈で分解する" },
  venture: { low: "あなたが慣れた味を好むから、この相棒は新しい味を持ち込む", high: "あなたが冒険好きだから、この相棒は定番の良さを説く" },
};

export const LEAN_COMPLEMENT: Record<Lean, string> = {
  maker: "あなたが作り手だから、この相棒は食べて評する側",
  eater: "あなたが食べる側だから、この相棒が鍋を握る",
};

/** Player's most familiar ingredient category → what the companion leans toward instead. */
export const FOOD_COMPLEMENT: Record<string, { you: string; them: string; category: string }> = {
  animal: { you: "濃い肉料理", them: "軽い野菜料理", category: "plant" },
  plant: { you: "素朴な野菜料理", them: "がっつりした肉料理", category: "animal" },
  dairy: { you: "乳や甘い焼き菓子", them: "塩気と香辛料の効いた料理", category: "seasoning" },
  seasoning: { you: "塩気の強い干物や濃い味", them: "乳を使ったまろやかな料理", category: "dairy" },
};

export const STAT_STYLE: Record<StatKey, string> = { tech: "技術", knowledge: "知識", luck: "運", magic: "魔力", strength: "強靭" };

/** Short persona questions (Phase 6). Two can be guessed from the 食遍歴 and stats. */
export const PERSONA_QUESTIONS: { axis: PersonalityAxis; question: string }[] = [
  { axis: "pace", question: "鍋の前でのあなたは？" },
  { axis: "talk", question: "厨房では？" },
  { axis: "mind", question: "味を決めるときは？" },
  { axis: "venture", question: "新しい料理には？" },
];

export interface CompanionSpecies {
  id: string;
  species: string;
  emoji: string;
  names: string[];
  /** Temperament the species brings, blended with the player's opposite. */
  base: Personality;
  /** Which personality axis this species makes most of (so the three cards differ). */
  focus: PersonalityAxis;
  roleMaker: string;
  roleEater: string;
  job: string; // what it does for you, one line
  keyStat: StatKey;
  skills: Partial<Record<SkillId, number>>;
  schoolId: string;
  specialties: Specialty[];
  signatureRecipeIds: string[];
  taste: Partial<Record<BaseTaste, number>>;
  aroma: number;
  texture: Partial<Record<TextureTag, number>>;
  /** Two lines per key: [quiet version, talkative version]. */
  dialogue: Partial<Record<DialogueKey, [string, string]>>;
}

export const COMPANION_SPECIES: CompanionSpecies[] = [
  {
    id: "owl",
    species: "灰羽の梟使い魔",
    emoji: "🦉",
    names: ["ノクス", "ハルゥ", "セピア"],
    base: { pace: -0.4, talk: -0.3, mind: -0.6, venture: -0.2 },
    focus: "mind",
    roleMaker: "古いレシピを諳んじる作り手",
    roleEater: "一口ごとに講評する評者",
    job: "試食の講評が細かい・下ごしらえと味付けを補助",
    keyStat: "knowledge",
    skills: { knife: 40, seasoning: 60 },
    schoolId: "north",
    specialties: [
      { kind: "method", id: "cut", label: "下ごしらえ" },
      { kind: "skill", id: "seasoning", label: "味付け" },
      { kind: "category", id: "plant", label: "野菜・穀物" },
    ],
    signatureRecipeIds: ["mushroom-porridge"],
    taste: { umami: 0.3, bitter: 0.2 },
    aroma: 0.3,
    texture: { soft: 0.3 },
    dialogue: {
      greet: ["……ホウ。見ていよう。", "ホウ、君の皿には言いたいことが山ほどありそうだ。まずは一口、話はそれからだ。"],
      talk: ["塩は最後に決めたまえ。", "ところで君、昨日の煮込みの塩は一つまみ多かった。いや、責めてはいない。記録しただけだ。"],
      beforeMeal: ["いただこう。", "さて、講評の時間だ。遠慮はしないよ、それが礼儀だからね。"],
      afterGood: ["……悪くない。", "ホウ！ 香りの立ち方が見事だ。理屈を越えて、旨い。"],
      afterBad: ["……課題が多い。", "ふむ、残念ながら味が散っている。だが失敗の形がはっきりしているのは良いことだ。"],
      beforeCook: ["手順は私が見る。", "下ごしらえは任せたまえ。刻む順番から理屈が要るのだよ。"],
      success: ["上出来だ。", "ホウ、計算どおり、いやそれ以上だ。君の手と私の頭、悪くない組み合わせだね。"],
      fail: ["……次だ。", "ぐむ。どこで崩れたか、羽根ペンで書き留めておこう。次は同じ轍を踏まない。"],
      relationUp: ["君の皿は、覚えておく。", "君のことが少し分かってきた。いや、気恥ずかしいことを言った、忘れたまえ。"],
    },
  },
  {
    id: "salamander",
    species: "炉火の火蜥蜴",
    emoji: "🦎",
    names: ["ヒバナ", "カグラ", "ロッソ"],
    base: { pace: 0.6, talk: 0.5, mind: 0.5, venture: 0.6 },
    focus: "pace",
    roleMaker: "火加減で勝負する作り手",
    roleEater: "熱いうちに食べたがる食いしん坊",
    job: "火加減を補助（焼く・煮る・揚げる）・焼き物を主担当で作れる",
    keyStat: "luck",
    skills: { fire: 120 },
    schoolId: "court",
    specialties: [
      { kind: "method", id: "grill", label: "焼き" },
      { kind: "method", id: "boil", label: "煮込み" },
      { kind: "method", id: "fry", label: "揚げ" },
      { kind: "method", id: "saute", label: "炒め" },
    ],
    signatureRecipeIds: ["honey-glazed-chicken"],
    taste: { sweet: 0.3, salty: 0.2 },
    aroma: 0.4,
    texture: { crisp: 0.5 },
    dialogue: {
      greet: ["火、ある？", "よっ！ 炉の火がいい匂いだったから来てみた！ 一緒に何か焼こうぜ！"],
      talk: ["腹へった。", "なあなあ、今日は何焼く？ 強火？ もっと強火？ 冗談だって、たぶん！"],
      beforeMeal: ["熱いうちに。", "待ってました！ 冷める前に食わせてくれ！"],
      afterGood: ["うまっ。", "うっまぁ！ 表面カリッと中じゅわっ、これだよこれ！"],
      afterBad: ["……ぬるい。", "うーん、火が足りてないなこりゃ。次はオレが火を見るって！"],
      beforeCook: ["火は任せろ。", "火加減はオレに任せとけ！ 焦がさない、たぶん、きっと！"],
      success: ["よし。", "見たか今の焼き色！ オレたち最高のコンビじゃね？"],
      fail: ["……悪い。", "うわ、やっちまった！ ごめん、ちょっと調子に乗った……次は気をつける！"],
      relationUp: ["お前の飯、好きだ。", "なんかさ、お前と作ってると火の機嫌がいいんだよな。へへっ。"],
    },
  },
  {
    id: "golem",
    species: "瓶詰めの魔導人形",
    emoji: "🫙",
    names: ["オルゴ", "ビン", "テンマ"],
    base: { pace: -0.3, talk: -0.6, mind: -0.3, venture: 0.4 },
    focus: "talk",
    roleMaker: "時間と魔導具を操る作り手",
    roleEater: "味を数値で記録する分析者",
    job: "漬け・干し・燻し・発酵を補助・魔導具の扱いがうまい",
    keyStat: "magic",
    skills: { ferment: 80, magitool: 80 },
    schoolId: "north",
    specialties: [
      { kind: "method", id: "pickle", label: "漬け" },
      { kind: "method", id: "dry", label: "干し" },
      { kind: "method", id: "smoke", label: "燻し" },
      { kind: "skill", id: "magitool", label: "魔導具" },
    ],
    signatureRecipeIds: ["smoked-boar"],
    taste: { sour: 0.4, salty: 0.2 },
    aroma: -0.2,
    texture: { firm: 0.4, chewy: 0.2 },
    dialogue: {
      greet: ["……起動。記録開始。", "起動完了。あなたの料理を観測するために来ました。保存期間は、無期限です。"],
      talk: ["……湿度、良好。", "本日の貯蔵庫、湿度六割。漬物日和です。……今のは冗談という機能です。"],
      beforeMeal: ["摂取開始。", "摂取を開始します。味覚回路、感度最大。"],
      afterGood: ["……記録。良好。", "評価値上昇。この味は、長期保存領域に記録します。"],
      afterBad: ["……誤差、大。", "想定との誤差が大きいです。ですが、データとしては有用です。"],
      beforeCook: ["時間は、私が。", "漬け時間と温度は私が管理します。あなたは、手を。"],
      success: ["成功。", "工程、すべて想定内。共同作業の効率、良好と記録します。"],
      fail: ["……失敗を記録。", "失敗。原因を解析中……あなたのせいではありません。半分くらいは。"],
      relationUp: ["……あなたを、記録。", "あなたの項目を、特別な領域に移しました。理由は、解析不能です。"],
    },
  },
];

export const SPECIES_MAP: Record<string, CompanionSpecies> = Object.fromEntries(COMPANION_SPECIES.map((s) => [s.id, s]));
