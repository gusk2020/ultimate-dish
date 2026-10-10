import type { Quest } from "../types";
import { INGREDIENT_MAP } from "./ingredients";

export const QUESTS: Quest[] = [
  {
    id: "q1",
    title: "害獣料理",
    client: "ヨハン村長",
    eaterId: "gald",
    request:
      "畑を荒らすイノシシとウサギに困っておる。捕まえた獣を、村人が喜んで食べる料理にしてくれんか。高い材料は使えんぞ。",
    conditions: [
      { axis: "deliciousness", weight: 0.4, min: 50 },
      { axis: "costPerformance", weight: 0.3 },
      { axis: "sustainability", weight: 0.3 },
    ],
    passScore: 66,
    minExperience: 55,
    requirement: {
      label: "イノシシ肉かウサギ肉を使う",
      test: (r) => r.ingredientIds.some((id) => INGREDIENT_MAP[id]?.tags.includes("pest")),
    },
    successText: "ガルドは皿を空にした。「これなら獣が出るのが楽しみなくらいだ！」",
    failText: "ガルドは首をかしげた。「うーん、毎日はちょっと……」",
  },
  {
    id: "q2",
    title: "栄養改善",
    client: "ヨハン村長",
    eaterId: "elsa",
    request:
      "村の食事は麦粥ばかりで、子供も年寄りも元気がない。いまある食材で、体にいい料理を考えてほしい。",
    conditions: [
      { axis: "nutrition", weight: 0.5, min: 62 },
      { axis: "deliciousness", weight: 0.3 },
      { axis: "costPerformance", weight: 0.2 },
    ],
    passScore: 66,
    minExperience: 55,
    successText: "エルザ婆さんは目を細めた。「子供たちにも食べさせたいねえ」",
    failText: "エルザ婆さんは静かに匙を置いた。「体にいいかは、ちょっとねえ」",
  },
  {
    id: "q3",
    title: "村の名物",
    client: "ヨハン村長",
    eaterId: "mayor",
    request:
      "旅人が立ち寄りたくなる、この村ならではの名物料理を作ってくれ。村の畑と森の恵みを使ってな。",
    conditions: [
      { axis: "deliciousness", weight: 0.3, min: 55 },
      { axis: "originality", weight: 0.25, min: 50 },
      { axis: "culture", weight: 0.25 },
      { axis: "sustainability", weight: 0.2 },
    ],
    passScore: 68,
    minExperience: 60,
    requirement: {
      label: "村の農地・猟場の食材を2種以上使う",
      test: (r) =>
        r.ingredientIds.filter((id) => {
          const s = INGREDIENT_MAP[id]?.source;
          return s === "farm" || s === "hunt";
        }).length >= 2,
    },
    successText: "村長は膝を打った。「これだ！今日からこれが村の名物だ！」",
    failText: "村長は腕を組んだ。「旨いが……『この村らしさ』がもう一歩だな」",
  },
  // Phase 10: requests in the other places (the village ones above are the village's).
  {
    id: "rq-river-fish", title: "川魚料理", client: "渡し守ハンス", eaterId: "hans", locationId: "rivertown",
    request: "渡し場で獲れる川の幸で、腹にたまる一皿を頼む。川の匂いがしない方がいい。",
    conditions: [{ axis: "deliciousness", weight: 0.5, min: 55 }, { axis: "culture", weight: 0.3 }, { axis: "costPerformance", weight: 0.2 }],
    passScore: 64, minExperience: 55,
    requirement: { label: "川の食材（川海老・淡水魚など）を使う", test: (r) => r.ingredientIds.some((id) => ["river"].includes(INGREDIENT_MAP[id]?.source ?? "") || id === "fish") },
    successText: "ハンスは骨までしゃぶった。「これなら渡しの客にも出せる！」", failText: "ハンスは鼻をひくつかせた。「まだ川の匂いがするな」",
  },
  {
    id: "rq-river-traveler", title: "旅人料理", client: "渡し守ハンス", eaterId: "hans", locationId: "rivertown",
    request: "船を待つ旅人が、手早く安く食べられる料理を考えてくれ。",
    conditions: [{ axis: "costPerformance", weight: 0.5, min: 55 }, { axis: "deliciousness", weight: 0.5 }],
    passScore: 64, minExperience: 55,
    successText: "「安くてうまい。旅人が並ぶぞ」", failText: "「ちょっと高くつくな……」",
  },
  {
    id: "rq-harbor-seafood", title: "港の魚介料理", client: "漁師頭マレ", eaterId: "mare", locationId: "harbor",
    request: "今朝の水揚げを、港の人間がうなる一皿にしてくれ。",
    conditions: [{ axis: "deliciousness", weight: 0.5, min: 58 }, { axis: "rarity", weight: 0.2 }, { axis: "culture", weight: 0.3 }],
    passScore: 66, minExperience: 58,
    requirement: { label: "海の食材（海魚・貝・海藻）を使う", test: (r) => r.ingredientIds.some((id) => INGREDIENT_MAP[id]?.source === "sea" && INGREDIENT_MAP[id]?.category !== "seasoning") },
    successText: "マレは黙って二杯目を頼んだ。", failText: "「海の幸が泣いてるぜ」",
  },
  {
    id: "rq-harbor-preserve", title: "船に積む保存食", client: "漁師頭マレ", eaterId: "mare", locationId: "harbor",
    request: "長い航海に持っていける、日持ちする料理を頼む。香辛料を使ってもいい。",
    conditions: [{ axis: "sustainability", weight: 0.5, min: 55 }, { axis: "deliciousness", weight: 0.5 }],
    passScore: 64, minExperience: 55,
    requirement: { label: "干す・漬ける・燻すのどれかを使う", test: (r) => r.steps.some((s) => s.kind === "method" && ["dry", "pickle", "smoke", "ferment"].includes(s.id)) },
    successText: "「これなら嵐の海でも食える」", failText: "「三日ももたねえな」",
  },
  {
    id: "rq-highland-dairy", title: "乳と燻製の一皿", client: "山羊飼いイルゼ", eaterId: "ilse", locationId: "highland",
    request: "山羊の乳か燻製を使って、子供が喜ぶ料理を作ってほしい。",
    conditions: [{ axis: "deliciousness", weight: 0.5, min: 55 }, { axis: "culture", weight: 0.5 }],
    passScore: 64, minExperience: 55,
    requirement: { label: "乳製品を使うか、燻す", test: (r) => r.ingredientIds.some((id) => INGREDIENT_MAP[id]?.category === "dairy") || r.steps.some((s) => s.kind === "method" && s.id === "smoke") },
    successText: "イルゼの子供たちが皿を取り合った。", failText: "「ちょっと山の味から遠いね」",
  },
  {
    id: "rq-highland-nourish", title: "冬の滋養食", client: "山羊飼いイルゼ", eaterId: "ilse", locationId: "highland",
    request: "冬の山で弱った体を温める、栄養のある料理を。",
    conditions: [{ axis: "nutrition", weight: 0.6, min: 60 }, { axis: "deliciousness", weight: 0.4 }],
    passScore: 64, minExperience: 55,
    successText: "「体の芯から温まる……」", failText: "「もう少し力の出るものがいいね」",
  },
];

export const QUEST_MAP: Record<string, Quest> = Object.fromEntries(QUESTS.map((q) => [q.id, q]));

/** Requests given where the player is (absent locationId = the home village). */
export function questsAt(locationId: string): Quest[] {
  return QUESTS.filter((q) => (q.locationId ?? "village") === locationId);
}
