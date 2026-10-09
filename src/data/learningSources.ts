// Where new recipes come from in the village (besides battles and derivation).

export interface RecipeTeacher {
  id: string;
  name: string;
  emoji: string;
  greeting: string;
  teachLine: string;
  afterLine: string;
  recipeId: string;
}

export interface RecipeBook {
  id: string;
  title: string;
  excerpt: string;
  recipeId: string;
}

export const TEACHERS: RecipeTeacher[] = [
  {
    id: "hanna",
    name: "宿屋の女将ハンナ",
    emoji: "👩‍🍳",
    greeting: "あら、新しい料理人さん。煮込みは得意かい？",
    teachLine: "冬を越すための酢漬けを教えてあげる。ただし、鍋で煮る手つきが身についてからね。",
    afterLine: "酢漬けは焦らないこと。うまくできたら食べさせておくれ。",
    recipeId: "hanna-pickled-cabbage",
  },
];

export const BOOKS: RecipeBook[] = [
  {
    id: "old-preserves",
    title: "古い保存食の記録",
    excerpt: "「猪の肉は塩をたっぷりとすり込み、香草とともに風に当てて干すべし。猟の季節を越えても腐らず……」",
    recipeId: "archive-dried-boar",
  },
];
