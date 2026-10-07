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
];

export const QUEST_MAP: Record<string, Quest> = Object.fromEntries(QUESTS.map((q) => [q.id, q]));
