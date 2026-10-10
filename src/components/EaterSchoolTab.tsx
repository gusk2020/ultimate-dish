import { EATER_SCHOOLS, EATER_SKILLS } from "../data/eaterSchools";
import { progressionOf } from "../game/codex/codex";
import { eaterSchoolOf, eaterSkillLevel } from "../game/eater/skills";
import { useGame } from "../state/GameContext";

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
