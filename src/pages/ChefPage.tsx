import { useState } from "react";
import { STAT_KEYS, type FusionDirection, type Stats } from "../types/world";
import { itemInfo, STORAGES } from "../data/items";
import { FUSION_DIRECTIONS, SCHOOLS, SKILLS, TOOL_RULES } from "../data/phase2";
import { TOOL_MAP } from "../data/magic";
import { METHOD_MAP } from "../data/methods";
import {
  checkAllocation, ingredientCapacity, INITIAL_MAX, maxMP, maxSteps, skillLevel, skillStage, STAT_LABEL, STAT_MIN, toolSlots,
} from "../game/chef/stats";
import { xpToNext } from "../game/chef/leveling";
import { STATE_LABEL, storageLoad, upkeepPerDay } from "../game/inventory/inventory";
import { canFuse, findSchool, fuseSchools, switchSchool } from "../game/school/school";
import { advanceTime, rest } from "../game/world";
import { formatDays } from "../game/process/simulate";
import { useGame } from "../state/GameContext";
import { Meter } from "../components/DishParts";
import { PalateCard } from "../components/FoodStoryForm";
import { MarketList } from "../components/MarketList";
import { FoundingCard } from "../components/FoundingCard";

type Tab = "status" | "inventory" | "school";

const STAT_HINT = {
  tech: "工程成功率・複雑さへの強さ",
  knowledge: "食材容量・理解",
  luck: "大成功・救済・追加成長",
  magic: "MP・魔導具の同時使用",
  strength: "工程数の上限",
};

function StatusTab() {
  const { state, dispatch } = useGame();
  const { chef } = state.world;
  const [draft, setDraft] = useState<Stats>(chef.stats);
  const [detail, setDetail] = useState(false);
  const check = checkAllocation(draft);
  const editing = !chef.allocationLocked;
  const shown = editing ? { ...chef, stats: draft } : chef;
  const next = xpToNext(chef.level);

  const bump = (k: keyof Stats, d: number) => {
    const v = draft[k] + d;
    if (v < STAT_MIN || v > INITIAL_MAX) return;
    setDraft({ ...draft, [k]: v });
  };
  const confirm = () => {
    if (!check.ok) return;
    const c = { ...chef, stats: draft, allocationLocked: true };
    dispatch({ type: "setWorld", world: { ...state.world, chef: { ...c, mp: maxMP(c) } } });
  };

  return (
    <div className="space-y-3">
      <PalateCard />
      <div className="card">
        <div className="flex items-baseline justify-between">
          <span className="text-lg font-bold">Lv {chef.level}</span>
          <span className="text-sm text-stone-600">所持金 {Math.floor(chef.money)} G</span>
        </div>
        <div className="mt-1 text-xs text-stone-500">経験値 {chef.xp} / {next}</div>
        <div className="h-2 rounded-full bg-stone-200">
          <div className="h-2 rounded-full bg-amber-500" style={{ width: `${Math.min(100, (chef.xp / next) * 100)}%` }} />
        </div>
        <div className="mt-2 text-sm">MP {chef.mp} / {maxMP(chef)}</div>
      </div>

      <div className="card">
        <h2 className="section-title">
          能力 {editing && <span className="text-sm font-normal text-amber-700">振り分け中：残り{check.remaining}</span>}
        </h2>
        {editing && <p className="mb-2 text-xs text-stone-500">各5＋自由25。最大15・最低1。5未満に2下げると他へ+1。初回の料理で確定。</p>}
        <div className="space-y-1.5">
          {STAT_KEYS.map((k) => (
            <div key={k} className="flex items-center gap-2">
              <div className="w-12 font-semibold">{STAT_LABEL[k]}</div>
              {editing && <button className="icon-btn border border-stone-200" onClick={() => bump(k, -1)}>−</button>}
              <div className="w-8 text-center text-lg font-bold tabular-nums">{shown.stats[k]}</div>
              {editing && <button className="icon-btn border border-stone-200" onClick={() => bump(k, 1)}>＋</button>}
              <div className="flex-1 text-[11px] leading-tight text-stone-500">{STAT_HINT[k]}</div>
            </div>
          ))}
        </div>
        {editing && (
          <>
            {check.errors.length > 0 && <p className="mt-2 text-xs text-red-700">{check.errors.join("、")}</p>}
            <button className="btn-primary mt-2 w-full" disabled={!check.ok} onClick={confirm}>この配分で確定</button>
          </>
        )}
        <div className="mt-3 grid grid-cols-2 gap-1 text-xs">
          <div>食材容量：{ingredientCapacity(shown)}</div>
          <div>工程上限：{maxSteps(shown)}</div>
          <div>最大MP：{maxMP(shown)}</div>
          <div>魔導具同時：{toolSlots(shown)}種</div>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between">
          <h2 className="section-title">スキル</h2>
          <button className="text-xs text-stone-500 underline" onClick={() => setDetail(!detail)}>{detail ? "段階表示" : "数値を見る"}</button>
        </div>
        <ul className="space-y-1 text-sm">
          {SKILLS.map((s) => {
            const lv = skillLevel(chef, s.id);
            const locked = s.requires && skillLevel(chef, s.requires.skill) < s.requires.level;
            return (
              <li key={s.id} className={`flex justify-between gap-2 ${locked ? "text-stone-400" : ""}`}>
                <span>
                  {s.requires ? "└ " : ""}{s.name}
                  <span className="ml-1 text-[11px] text-stone-500">{locked ? `（${SKILLS.find((x) => x.id === s.requires!.skill)?.name}Lv${s.requires!.level}で解放）` : s.effect}</span>
                </span>
                <span className="shrink-0 tabular-nums">
                  {detail ? `Lv${lv}（${chef.records.skillXp[s.id] ?? 0}）` : skillStage(lv)}
                </span>
              </li>
            );
          })}
        </ul>
        {detail && (
          <div className="mt-2 rounded-lg bg-stone-100 p-2 text-[11px] text-stone-600">
            <div>料理数：{chef.records.dishesCooked}</div>
            <div>流派熟練：{Object.entries(chef.records.schoolMastery).map(([k, v]) => `${findSchool(k, state.world.customSchools).name} ${v}`).join("、") || "なし"}</div>
            <div>技法実績：{Object.entries(chef.records.techniqueCounts).map(([k, v]) => `${METHOD_MAP[k]?.name ?? k}×${v}`).join("、") || "なし"}</div>
            <div>ジャンル実績：{Object.entries(chef.records.genreCounts).map(([k, v]) => `${k}×${v}`).join("、") || "なし"}</div>
            <div>達成：{chef.records.achievements.join("、") || "なし"}</div>
          </div>
        )}
      </div>
    </div>
  );
}

function InventoryTab() {
  const { state, dispatch } = useGame();
  const w = state.world;

  return (
    <div className="space-y-3">
      <div className="card space-y-2">
        <div className="text-sm">
          {formatDays(w.day % 1)} 経過（{Math.floor(w.day) + 1}日目）・維持費 {upkeepPerDay(w.inventory)} G/日・所持金 {Math.floor(w.chef.money)} G
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button className="btn-secondary" onClick={() => dispatch({ type: "setWorld", world: rest(w) })}>😴 休息（6時間）</button>
          <button className="btn-secondary" onClick={() => dispatch({ type: "setWorld", world: advanceTime(w, 1) })}>⏩ 1日進める</button>
        </div>
      </div>

      {STORAGES.map((st) => {
        const stacks = w.inventory.filter((s) => s.storageId === st.id);
        return (
          <div key={st.id} className="card">
            <div className="mb-1 flex justify-between text-sm font-bold">
              <span>{st.name}</span>
              <span className="font-normal text-stone-500">{storageLoad(w.inventory, st.id)}/{st.capacity}・劣化×{st.decayRate}・{st.upkeepPerDay}G/日</span>
            </div>
            {stacks.length === 0 ? <p className="text-xs text-stone-400">空</p> : (
              <ul className="space-y-1.5">
                {stacks.map((s) => {
                  const info = itemInfo(s.itemId);
                  const left = s.useByDay - w.day;
                  return (
                    <li key={s.id} className={`text-sm ${s.state === "spoiled" ? "text-stone-400" : ""}`}>
                      <div className="flex justify-between">
                        <span>{info?.emoji}{info?.name} ×{s.quantity}</span>
                        <span className="text-xs">{STATE_LABEL[s.state]}・期限{left > 0 ? `あと${Math.ceil(left)}日` : "切れ"}</span>
                      </div>
                      <Meter label={`鮮度 品質${Math.round(s.quality * 100)}`} value={s.freshness} />
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}

      <MarketList />
    </div>
  );
}

function SchoolTab() {
  const { state, dispatch } = useGame();
  const w = state.world;
  const { chef } = w;
  const schools = chef.learnedSchoolIds.map((id) => findSchool(id, w.customSchools));
  const [a, setA] = useState(SCHOOLS[1].id);
  const [b, setB] = useState(SCHOOLS[2].id);
  const [dir, setDir] = useState<FusionDirection>("preserve");
  const fusion = canFuse(chef, a, b);

  const fuse = () => {
    const s = fuseSchools(chef, findSchool(a, w.customSchools), findSchool(b, w.customSchools), dir);
    if (chef.learnedSchoolIds.includes(s.id)) return;
    dispatch({
      type: "setWorld",
      world: { ...w, customSchools: [...w.customSchools, s], chef: { ...chef, learnedSchoolIds: [...chef.learnedSchoolIds, s.id] } },
    });
  };

  return (
    <div className="space-y-3">
      <FoundingCard />
      <div className="card">
        <h2 className="section-title">流派（有効なのは1つ）</h2>
        <div className="space-y-1.5">
          {schools.map((s) => {
            const on = chef.activeSchoolId === s.id;
            return (
              <button
                key={s.id}
                className={`w-full rounded-xl border p-2 text-left ${on ? "border-amber-500 bg-amber-50" : "border-stone-200 bg-white"}`}
                onClick={() => dispatch({ type: "setWorld", world: { ...w, chef: switchSchool(chef, s.id) } })}
              >
                <div className="font-semibold">{on ? "✅ " : ""}{s.name}</div>
                <div className="text-[11px] text-stone-500">{s.region} × {s.philosophy} × {s.specialty}・熟練{chef.records.schoolMastery[s.id] ?? 0}</div>
                <div className="text-[11px] text-stone-600">
                  {Object.entries(s.methodSuccess).map(([m, v]) => `${METHOD_MAP[m]?.name ?? m}+${Math.round(v * 100)}%`).join(" ")}
                  {Object.values(s.methodVariant).map((v) => ` / ${v.label}`).join("")}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="card space-y-2">
        <h2 className="section-title">流派合成（試作）</h2>
        <div className="grid grid-cols-2 gap-2">
          {[[a, setA], [b, setB]].map(([val, set], i) => (
            <select key={i} className="rounded-lg border border-stone-300 p-2 text-sm" value={val as string} onChange={(e) => (set as (v: string) => void)(e.target.value)}>
              {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {(Object.keys(FUSION_DIRECTIONS) as FusionDirection[]).map((d) => (
            <button key={d} className={`chip ${dir === d ? "chip-on" : ""}`} onClick={() => setDir(d)}>{FUSION_DIRECTIONS[d].label}</button>
          ))}
        </div>
        {!fusion.ok && <p className="text-xs text-stone-500">{fusion.reason}</p>}
        <button className="btn-primary w-full" disabled={!fusion.ok} onClick={fuse}>合成して新流派を得る</button>
      </div>

      <div className="card">
        <h2 className="section-title">魔導具</h2>
        <ul className="space-y-1.5 text-sm">
          {w.tools.map((t) => (
            <li key={t.toolId}>
              <div className="font-semibold">{TOOL_MAP[t.toolId]?.emoji}{TOOL_MAP[t.toolId]?.name}　<span className="text-xs font-normal">耐久 {t.durability}/{t.maxDurability}</span></div>
              <div className="text-[11px] text-stone-600">{TOOL_RULES[t.toolId].effect}／{TOOL_RULES[t.toolId].mpRule}</div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function ChefPage() {
  const [tab, setTab] = useState<Tab>("status");
  const TABS: [Tab, string][] = [["status", "ステータス"], ["inventory", "在庫"], ["school", "流派・魔導具"]];
  return (
    <div className="space-y-3 p-4">
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-stone-200 p-1">
        {TABS.map(([id, label]) => (
          <button key={id} className={`min-h-10 rounded-lg text-sm ${tab === id ? "bg-white font-bold shadow" : "text-stone-600"}`} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>
      {tab === "status" && <StatusTab />}
      {tab === "inventory" && <InventoryTab />}
      {tab === "school" && <SchoolTab />}
    </div>
  );
}
