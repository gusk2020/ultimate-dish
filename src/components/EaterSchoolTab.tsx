import { EATER_SCHOOLS, EATER_SKILLS } from "../data/eaterSchools";
import { progressionOf } from "../game/codex/codex";
import { eaterSchoolOf, eaterSkillLevel } from "../game/eater/skills";
import { useGame } from "../state/GameContext";
import { STAT_KEYS } from "../types/world";
import { STAT_NAMES } from "../game/roleView";
import { APPRAISAL_MAP } from "../data/eaterTools";
import { eaterXpForLevel } from "../game/eater/progression";
import { comfortSHU, eatingCapacity } from "../game/eater/challenges";
import { IdentityCard } from "./IdentityCard";
import { PalateCard } from "./FoodStoryForm";

/** 食べ手の流派・スキル: the eater's mirror of the cooks' schools and skills. */
export function EaterSkillsCard() {
  const { state } = useGame();
  const p = progressionOf(state.world);
  return (
    <div className="card space-y-1 text-sm" data-testid="eater-skills">
      <h2 className="section-title mb-0">🍴 食べ手スキル</h2>
      <p className="text-[11px] text-stone-500">料理人のスキルの裏返し。実食した料理の技法・食材から育つ（日常食では育たない）。</p>
      <ul className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-xs">
        {EATER_SKILLS.map((s) => (
          <li key={s.id} className="flex justify-between gap-1">
            <span className="truncate">{s.name}</span>
            <span className="shrink-0 tabular-nums text-stone-500">Lv{eaterSkillLevel(p, s.id)}・{p.eaterSkills?.[s.id] ?? 0}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function EaterSchoolTab() {
  const { state, dispatch } = useGame();
  const w = state.world;
  const p = progressionOf(w);
  const active = eaterSchoolOf(p);
  return (
    <div className="space-y-2">
      <p className="text-xs text-stone-500">食べる側の流派。料理人の流派が技法を磨いて「作る」なら、こちらは感覚と食べ方を磨いて「見抜く」。</p>
      {EATER_SCHOOLS.map((s) => (
        <div key={s.id} className={`card space-y-1 text-sm ${s.id === active.id ? "border-amber-500 bg-amber-50" : ""}`} data-eater-school={s.id}>
          <div className="flex justify-between gap-2">
            <span className="font-bold">{s.name}</span>
            {s.id === active.id && <span className="shrink-0 text-xs text-amber-800">所属中</span>}
          </div>
          <div className="text-xs text-stone-600">「{s.philosophy}」・得意：{s.specialty}</div>
          <div className="text-[11px] text-stone-500">伸びやすい：{Object.keys(s.skillXpMult).map((k) => EATER_SKILLS.find((x) => x.id === k)?.name).join("・")}</div>
          {s.id !== active.id && (
            <button className="btn-secondary w-full text-xs" onClick={() => dispatch({ type: "setWorld", world: { ...w, progression: { ...p, eaterSchoolId: s.id } } })}>
              この流派に移る
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

/** 食べ手のステータス: the eater's own numbers only (no cook level, no cook skills, no pantry). */
export function EaterStatusTab() {
  const { state } = useGame();
  const w = state.world;
  const p = progressionOf(w);
  const names = STAT_NAMES.eater;
  return (
    <div className="space-y-3">
      <IdentityCard />
      <PalateCard />
      <div className="card text-sm" data-testid="eater-status">
        <div className="flex items-baseline justify-between">
          <span className="text-lg font-bold">フードファイターLv {p.eaterLevel}</span>
          <span className="text-sm text-stone-600">所持金 {Math.floor(w.chef.money)} G</span>
        </div>
        <div className="mt-1 text-xs text-stone-500">経験 {p.eaterXp} / {eaterXpForLevel(p.eaterLevel + 1)}・評判 {p.reputation}</div>
        <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-0.5 text-xs">
          {STAT_KEYS.map((k) => (
            <div key={k} className="flex justify-between gap-1"><span>{names[k]}</span><span className="tabular-nums">{w.chef.stats[k] + (k === "strength" ? eaterSkillLevel(p, "body") : 0)}</span></div>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-2 gap-1 text-xs">
          <div>食容量：約{eatingCapacity(w)}杯</div>
          <div>刺激耐性：{comfortSHU(w).toLocaleString("ja-JP")} SHUまで平気</div>
          <div>自己最多：{p.maxPortions ?? 0}杯</div>
          <div>完食最高：{(p.maxSHU ?? 0).toLocaleString("ja-JP")} SHU</div>
        </div>
      </div>
      <EaterSkillsCard />
    </div>
  );
}

/** 鑑定具: the eater's appraisal tools (never cooking tools). */
export function AppraisalToolsTab() {
  const { state } = useGame();
  const p = progressionOf(state.world);
  const owned = (p.eaterTools ?? []).map((id) => APPRAISAL_MAP[id]).filter(Boolean);
  return (
    <div className="space-y-2" data-testid="appraisal-tools">
      <p className="text-xs text-stone-500">料理を見抜くための鑑定魔導具。判定を助けるが、リスクを消しはしない。</p>
      {owned.length === 0 && <p className="card text-sm text-stone-500">鑑定具はまだ持っていない</p>}
      {owned.map((t) => (
        <div key={t.id} className="card text-sm">
          <div className="font-semibold">{t.emoji} {t.name}</div>
          <div className="text-xs text-stone-600">{t.description}</div>
          <div className="text-xs text-emerald-800">{t.good}</div>
        </div>
      ))}
    </div>
  );
}
