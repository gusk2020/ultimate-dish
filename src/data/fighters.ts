import type { EaterProfile } from "../types/eating";
import { blankProfile } from "../game/eating/profile";

// フードファイター（雇える食べ手）: three tiers. Fame makes a review count more in public,
// but nobody is an expert in everything — outside their specialty a review counts for less.

export interface FoodFighter {
  id: string;
  name: string;
  emoji: string;
  title: string;
  level: number;
  fame: number;
  fee: number;
  /** Sales tags they really know. */
  specialty: string[];
  reviewWeight: number;
  /** 0 brief … 2 detailed. */
  detail: number;
  eater: EaterProfile;
}

function eater(id: string, name: string, emoji: string, base: Partial<EaterProfile>): EaterProfile {
  const b = blankProfile(id, name, emoji, "フードファイター");
  return { ...b, ...base, culture: { ...b.culture, ...base.culture, familiar: { ...b.culture.familiar, ...base.culture?.familiar } } };
}

export const FOOD_FIGHTERS: FoodFighter[] = [
  {
    id: "ff-pip", name: "無名の食べ手ピップ", emoji: "🧒", title: "無名の食べ手", level: 3, fame: 5, fee: 5,
    specialty: ["family", "staple", "deli"], reviewWeight: 1, detail: 0,
    eater: eater("ff-pip", "ピップ", "🧒", { taste: { sweet: 0.3, umami: 0.2 }, culture: { familiar: { plant: 0.6 }, schools: { village: 0.6 }, adventurous: 0.5 } }),
  },
  {
    id: "ff-nora", name: "食レポ屋ノーラ", emoji: "📝", title: "経験ある食レポ屋", level: 14, fame: 32, fee: 20,
    specialty: ["soup", "healthy", "light", "preserved"], reviewWeight: 2, detail: 1,
    eater: eater("ff-nora", "ノーラ", "📝", { taste: { umami: 0.4, sour: 0.2 }, aroma: 0.3, culture: { familiar: { plant: 0.7, dairy: 0.5 }, schools: { village: 0.5, north: 0.5 }, adventurous: 0.6 } }),
  },
  {
    id: "ff-garm", name: "鉄胃のガルム", emoji: "🏆", title: "高名なフードファイター", level: 38, fame: 85, fee: 60,
    specialty: ["meat", "luxury", "snack", "worker"], reviewWeight: 3.5, detail: 2,
    eater: eater("ff-garm", "ガルム", "🏆", { taste: { umami: 0.6, salty: 0.4 }, texture: { chewy: 0.3 }, culture: { familiar: { animal: 0.9 }, schools: { north: 0.6, court: 0.5 }, adventurous: 0.7 } }),
  },
];

export const FIGHTER_MAP: Record<string, FoodFighter> = Object.fromEntries(FOOD_FIGHTERS.map((f) => [f.id, f]));
