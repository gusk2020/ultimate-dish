import { useState } from "react";
import { ALLIES } from "../data/allies";
import { getCharacter, hasCompanion, line, personalityWords } from "../game/social/companion";
import { allyStatus, ALLY_STATUS_LABEL, inviteAlly, joinChecks, partyMembers } from "../game/social/allies";
import { getRelation, PLAYER } from "../game/social/relations";
import { useGame } from "../state/GameContext";
import { TOOL_MAP } from "../data/magic";
import {
  facilityName, nameOf, RelationDetail, RelationLine, ShareMealPanel, TalkButton,
} from "../components/SocialParts";

/** 仲間: the special companion, ordinary allies and how everyone gets on. */
export function PeoplePage() {
  const { state, dispatch } = useGame();
  const w = state.world;
  const ctx = { clearedQuestIds: state.clearedQuestIds };
  const [pair, setPair] = useState<[string, string] | null>(null);
  const [sharing, setSharing] = useState<string | null>(null);
  const [said, setSaid] = useState<Record<string, string>>({});
  const comp = hasCompanion(w) ? w.social.companion! : null;

  if (pair) return <div className="p-4"><RelationDetail a={pair[0]} b={pair[1]} onBack={() => setPair(null)} /></div>;

  const party = partyMembers(w);
  const people = [PLAYER, ...party.map((c) => c.id)];
  const pairs: [string, string][] = [];
  for (let i = 0; i < people.length; i++) for (let j = i + 1; j < people.length; j++) pairs.push([people[i], people[j]]);

  const speak = (id: string) => (t: string) => setSaid({ ...said, [id]: t });

  return (
    <div className="space-y-3 p-4">
      {/* ---- special companion ---- */}
      {/* The companion is chosen (or not) in character creation; this page never asks again. */}
      {w.social.companionChoice === "declined" && (
        <div className="card text-xs text-stone-600">
          相棒なしで進んでいる。村の人との関係と駆け引きが中心になる。
          {w.identity?.startingToolId && `（旅立ちに魔導具「${TOOL_MAP[w.identity.startingToolId]?.name}」を選んだ）`}
        </div>
      )}
      {comp && (
        <div className="card space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-3xl">{comp.emoji}</span>
            <div className="min-w-0 flex-1">
              <div className="font-bold">{comp.name}<span className="ml-1 rounded bg-violet-100 px-1.5 text-[11px] font-normal text-violet-800">特殊相棒</span></div>
              <div className="text-xs text-stone-600">{comp.species}・{comp.role}</div>
            </div>
          </div>
          <div className="text-xs"><RelationLine r={getRelation(w, PLAYER, comp.id)} />・{personalityWords(comp.personality).join("・")}</div>
          <p className="rounded-lg bg-stone-100 p-1.5 text-xs">「{said[comp.id] ?? line(comp, "talk", Math.floor(w.day))}」</p>
          <details className="text-xs">
            <summary className="cursor-pointer text-stone-500">あなたとの凸凹</summary>
            <ul className="list-inside list-disc text-violet-800">{comp.complement?.map((r) => <li key={r}>{r}</li>)}</ul>
          </details>
          <div className="grid grid-cols-3 gap-1.5">
            <TalkButton id={comp.id} onText={speak(comp.id)} />
            <button className="btn-secondary px-1 text-sm" onClick={() => setSharing(comp.id)}>🍽 ふるまう</button>
            <button className="btn-secondary px-1 text-sm" onClick={() => setPair([PLAYER, comp.id])}>詳しく</button>
          </div>
          {sharing === comp.id && <ShareMealPanel initialEaters={[comp.id]} onClose={() => setSharing(null)} />}
        </div>
      )}

      {/* ---- ordinary allies ---- */}
      <h2 className="section-title mb-0">村の人・仲間候補</h2>
      {ALLIES.map((a) => {
        const status = allyStatus(w, a.id, ctx);
        const checks = joinChecks(w, a.id, ctx);
        const done = checks.checks.filter((c) => c.ok).length;
        return (
          <div key={a.id} className="card space-y-1.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-bold">{a.emoji}{a.name}</div>
                <div className="text-xs text-stone-600">{a.role}</div>
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${status === "joined" ? "bg-amber-200 text-amber-900" : status === "candidate" ? "bg-emerald-100 text-emerald-800" : "bg-stone-100 text-stone-700"}`}>
                {ALLY_STATUS_LABEL[status]}
              </span>
            </div>
            {status === "unmet" ? (
              <div className="text-xs text-stone-500">{a.blurb}（{facilityName(a.homeFacilityId)}で会える）</div>
            ) : (
              <>
                <div className="text-xs"><RelationLine r={getRelation(w, PLAYER, a.id)} />{status !== "joined" && `・加入条件 ${done}/${checks.checks.length}`}</div>
                {said[a.id] && <p className="rounded-lg bg-stone-100 p-1.5 text-xs">{said[a.id]}</p>}
                <div className="grid grid-cols-3 gap-1.5">
                  <TalkButton id={a.id} onText={speak(a.id)} />
                  <button className="btn-secondary px-1 text-sm" onClick={() => setSharing(a.id)}>🍽 ふるまう</button>
                  <button className="btn-secondary px-1 text-sm" onClick={() => setPair([PLAYER, a.id])}>詳しく</button>
                </div>
                {status === "candidate" && (
                  <button
                    className="btn-primary w-full"
                    onClick={() => {
                      const r = inviteAlly(w, a.id, ctx);
                      if (typeof r === "string") return speak(a.id)(r);
                      dispatch({ type: "setWorld", world: r.world });
                      speak(a.id)(`🎉 ${a.name}が仲間になった！「${r.text}」`);
                    }}
                  >
                    🤝 仲間に誘う
                  </button>
                )}
                {sharing === a.id && <ShareMealPanel initialEaters={[a.id]} onClose={() => setSharing(null)} />}
              </>
            )}
          </div>
        );
      })}

      {/* ---- everyone's relations ---- */}
      {pairs.length > 0 && (
        <div className="card space-y-1">
          <div className="text-sm font-semibold">みんなの関係</div>
          {pairs.map(([x, y]) => (
            <button key={`${x}|${y}`} className="flex w-full items-center justify-between gap-2 rounded-lg border border-stone-200 p-1.5 text-left" onClick={() => setPair([x, y])}>
              <span className="min-w-0 truncate text-xs">{x === PLAYER ? "🧑‍🍳" : getCharacter(w, x)?.emoji}{nameOf(w, x)} ⇄ {getCharacter(w, y)?.emoji}{nameOf(w, y)}</span>
              <span className="shrink-0"><RelationLine r={getRelation(w, x, y)} /></span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
