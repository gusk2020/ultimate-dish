import { FUSION_DIRECTIONS, FUSION_MASTERY, SCHOOLS } from "../../data/phase2";
import type { AxisScores } from "../../types";
import type { Chef, FusionDirection, School } from "../../types/world";

export function findSchool(id: string, custom: School[] = []): School {
  return [...SCHOOLS, ...custom].find((s) => s.id === id) ?? SCHOOLS[0];
}

/** Only learned schools can be active; switching is free and instant. */
export function switchSchool(chef: Chef, schoolId: string): Chef {
  if (!chef.learnedSchoolIds.includes(schoolId)) return chef;
  return { ...chef, activeSchoolId: schoolId };
}

export function canFuse(chef: Chef, a: string, b: string): { ok: boolean; reason?: string } {
  if (a === b) return { ok: false, reason: "別々の流派を選ぶ" };
  const ma = chef.records.schoolMastery[a] ?? 0;
  const mb = chef.records.schoolMastery[b] ?? 0;
  if (ma < FUSION_MASTERY || mb < FUSION_MASTERY) {
    return { ok: false, reason: `両流派の熟練度${FUSION_MASTERY}以上が必要（現在 ${ma} / ${mb}）` };
  }
  return { ok: true };
}

function mergeNumbers<K extends string>(x: Partial<Record<K, number>>, y: Partial<Record<K, number>>, scale = 0.7) {
  const out: Partial<Record<K, number>> = {};
  for (const [k, v] of [...Object.entries(x), ...Object.entries(y)] as [K, number][]) {
    out[k] = Math.round(((out[k] ?? 0) + v * scale) * 100) / 100;
  }
  return out;
}

/**
 * 流派合成: parents stay; a new school is added. The result depends on the chosen direction
 * and on the chef's history (the technique used most gets an extra success bonus).
 */
export function fuseSchools(chef: Chef, a: School, b: School, direction: FusionDirection): School {
  const dir = FUSION_DIRECTIONS[direction];
  const signature = Object.entries(chef.records.techniqueCounts).sort((x, y) => y[1] - x[1])[0]?.[0];
  const methodSuccess = mergeNumbers(a.methodSuccess, b.methodSuccess) as Record<string, number>;
  if (signature) methodSuccess[signature] = (methodSuccess[signature] ?? 0) + 0.05;
  const axisBonus = mergeNumbers<keyof AxisScores>(a.axisBonus, b.axisBonus, 0.5);
  for (const [k, v] of Object.entries(dir.axes)) {
    const key = k as keyof AxisScores;
    axisBonus[key] = (axisBonus[key] ?? 0) + v;
  }
  return {
    id: `fusion-${a.id}-${b.id}-${direction}`,
    name: `${a.name.replace("料理", "")}×${b.name.replace("料理", "")}（${dir.label}）`,
    region: `${a.region}・${b.region}`,
    philosophy: dir.label,
    specialty: signature ? `${a.specialty}・${b.specialty}・得意:${signature}` : `${a.specialty}・${b.specialty}`,
    methodSuccess,
    methodVariant: { ...b.methodVariant, ...a.methodVariant },
    axisBonus,
    skillXpMult: mergeNumbers(a.skillXpMult, b.skillXpMult, 0.6),
    parents: [a.id, b.id],
    direction,
  };
}
