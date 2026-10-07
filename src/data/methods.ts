import type { CookingMethod } from "../types";

// Deltas are grounded in ordinary kitchen science: dry heat browns (umami/aroma up),
// wet heat softens and leaches aroma, preservation methods dry/acidify/salt.
// `fit` scores how sensible the method is for the dish's state at that moment.

export const METHODS: CookingMethod[] = [
  {
    id: "grill", name: "焼く", verb: "焼き", systems: ["heat"],
    tasteDelta: { umami: 1.5, aroma: 2, sweet: 0.5 },
    physicalDelta: { water: -1.5, hardness: 0.5 },
    microRetention: 0.85, safe: true, preserves: false, traditional: true, energyCost: 1,
    fit: ({ physical: p }) => (p.protein >= 5 ? 20 : -5) + (p.water <= 7 ? 5 : -15),
    hint: "焼き色で香りとうま味。タンパク質の多い素材向き",
  },
  {
    id: "boil", name: "煮る", verb: "煮込み", systems: ["heat"],
    tasteDelta: { umami: 1, aroma: -1.5 },
    physicalDelta: { water: 2, hardness: -3 },
    microRetention: 0.7, safe: true, preserves: false, traditional: true, energyCost: 1,
    fit: ({ physical: p }) => (p.hardness >= 5 ? 20 : -5) + (p.water <= 6 ? 5 : -10),
    hint: "硬い素材を柔らかく。香りとビタミンは逃げやすい",
  },
  {
    id: "steam", name: "蒸す", verb: "蒸し", systems: ["heat"],
    tasteDelta: { aroma: -0.5 },
    physicalDelta: { water: 1, hardness: -2 },
    microRetention: 0.95, safe: true, preserves: false, traditional: false, energyCost: 1,
    fit: ({ physical: p }) => (p.hardness <= 6 ? 15 : -10) + (p.water >= 4 ? 10 : -5),
    hint: "栄養を逃しにくい。柔らかい素材向き",
  },
  {
    id: "fry", name: "揚げる", verb: "揚げ", systems: ["heat"],
    tasteDelta: { aroma: 1.5, umami: 0.5 },
    physicalDelta: { fat: 3, water: -2, hardness: 1 },
    setsTexture: "crisp",
    microRetention: 0.8, safe: true, preserves: false, traditional: false, energyCost: 2,
    fit: ({ physical: p }) => (p.fat <= 5 ? 15 : -20) + (p.water >= 3 ? 5 : -10),
    hint: "カリッと香ばしい。脂の多い素材だとくどい",
  },
  {
    id: "smoke", name: "燻す", verb: "燻製", systems: ["heat", "time"],
    tasteDelta: { aroma: 3, salty: 0.5, bitter: 0.5 },
    physicalDelta: { water: -2, hardness: 1.5 },
    microRetention: 0.85, safe: true, preserves: true, traditional: true, energyCost: 1,
    fit: ({ physical: p }) => (p.protein >= 5 || p.fat >= 4 ? 20 : -10),
    hint: "強い香りと保存性。肉や魚向き",
  },
  {
    id: "pickle", name: "漬ける", verb: "漬け", systems: ["time"],
    tasteDelta: { sour: 3, salty: 2 },
    physicalDelta: { water: 0.5, hardness: -0.5 },
    microRetention: 0.9, safe: false, preserves: true, traditional: true, energyCost: 0,
    fit: ({ physical: p }) => (p.water >= 6 ? 20 : -5) + (p.protein >= 7 ? -10 : 0),
    hint: "酸味と塩味。水分の多い野菜向き",
  },
  {
    id: "dry", name: "乾燥", verb: "干し", systems: ["time"],
    tasteDelta: { umami: 1.5, sweet: 1 },
    physicalDelta: { water: -4, hardness: 3 },
    setsTexture: "firm",
    microRetention: 0.8, safe: false, preserves: true, traditional: true, energyCost: 0,
    fit: ({ physical: p }) => (p.water >= 5 ? 20 : -15),
    hint: "うま味と甘みが凝縮。硬くなる",
  },
  {
    id: "ferment", name: "発酵", verb: "発酵", systems: ["time"],
    tasteDelta: { umami: 3, sour: 2, aroma: 1.5 },
    physicalDelta: { hardness: -1 },
    microRetention: 1.1, safe: false, preserves: true, traditional: true, energyCost: 0,
    fit: ({ taste: t, physical: p }) => (t.sweet >= 3 || p.protein >= 5 ? 20 : 0) + (t.bitter >= 5 ? -10 : 0),
    hint: "うま味・酸味・香りが増す。ビタミンも増える",
  },
  {
    id: "sousvide", name: "低温調理", verb: "低温仕立て", systems: ["heat"],
    tasteDelta: { aroma: -0.5 },
    physicalDelta: { hardness: -2, water: 0.5 },
    setsTexture: "tender",
    microRetention: 0.95, safe: true, preserves: false, traditional: false, energyCost: 1,
    needsPrecision: true,
    fit: ({ physical: p }) => (p.protein >= 6 ? 25 : -10),
    hint: "肉がしっとり。温度管理が甘いと危険（魔石炉推奨）",
  },
  {
    id: "pressure", name: "圧力調理", verb: "圧力煮", systems: ["heat"],
    tasteDelta: { umami: 1.5, aroma: -1 },
    physicalDelta: { hardness: -5, water: 1 },
    setsTexture: "tender",
    microRetention: 0.8, safe: true, preserves: false, traditional: false, energyCost: 2,
    fit: ({ physical: p }) => (p.hardness >= 7 ? 30 : p.hardness >= 5 ? 10 : -20),
    hint: "とても硬い肉や豆を短時間でほろほろに",
  },
];

export const METHOD_MAP: Record<string, CookingMethod> = Object.fromEntries(
  METHODS.map((m) => [m.id, m]),
);
