import { useState } from "react";
import { FACILITIES, type Facility } from "../data/facilities";
import { INGREDIENTS } from "../data/ingredients";
import { BOOKS, TEACHERS } from "../data/learningSources";
import { getRecipe, learnFromTeacher, readBook, recipeStatus } from "../game/learning/recipeBook";
import { useGame } from "../state/GameContext";
import { ALLY_MAP } from "../data/allies";
import { allyStatus, ALLY_STATUS_LABEL, talkTo } from "../game/social/allies";
import { getRelation, PLAYER } from "../game/social/relations";
import { RelationLine } from "../components/SocialParts";

/** 村の人: an ordinary ally can be met and talked to where they live. */
function PersonSpot({ id, onPeople }: { id: string; onPeople: () => void }) {
  const { state, dispatch } = useGame();
  const w = state.world;
  const a = ALLY_MAP[id];
  const [said, setSaid] = useState("");
  if (!a) return null;
  const status = allyStatus(w, id, { clearedQuestIds: state.clearedQuestIds });
  return (
    <div className="mb-3 space-y-2 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold">{a.emoji} {a.name}</span>
        <span className="text-xs text-stone-500">{ALLY_STATUS_LABEL[status]}</span>
      </div>
      <p className="text-xs text-stone-600">{a.blurb}</p>
      {said && <p className="rounded-lg bg-amber-50 p-2">{said}</p>}
      {status !== "unmet" && <div><RelationLine r={getRelation(w, PLAYER, id)} /></div>}
      <div className="grid grid-cols-2 gap-2">
        <button
          className="btn-primary"
          onClick={() => {
            const r = talkTo(w, id);
            if (typeof r === "string") return setSaid(r);
            dispatch({ type: "setWorld", world: r.world });
            setSaid(`「${r.text}」${r.firstMeeting ? "（知り合いになった）" : ""}`);
          }}
        >
          💬 話しかける
        </button>
        <button className="btn-secondary" onClick={onPeople}>🤝 仲間画面へ</button>
      </div>
    </div>
  );
}

/** 村の人・書庫: where a recipe can be learned (known, not yet mastered). */
function LearnSpot({ f, onKitchen }: { f: Facility; onKitchen: () => void }) {
  const { state, dispatch } = useGame();
  const w = state.world;
  const teacher = TEACHERS.find((t) => t.id === f.teacherId);
  const book = BOOKS.find((b) => b.id === f.bookId);
  const recipeId = teacher?.recipeId ?? book?.recipeId;
  if (!recipeId) return null;
  const recipe = getRecipe(w, recipeId);
  const status = recipeStatus(w, recipeId);
  const known = status !== "unknown";
  const learn = () => {
    const r = teacher ? learnFromTeacher(w, teacher.id, recipeId) : readBook(w, book!.id, recipeId);
    dispatch({ type: "setWorld", world: r.world });
  };
  return (
    <div className="mb-3 space-y-2 text-sm">
      {teacher && (
        <>
          <div className="font-semibold">{teacher.emoji} {teacher.name}</div>
          <p className="rounded-lg bg-amber-50 p-2">「{known ? teacher.afterLine : teacher.greeting}」</p>
          {!known && <button className="btn-primary w-full" onClick={learn}>💬 話を聞く</button>}
          {known && w.learning.talkedTo.includes(teacher.id) && <p className="rounded-lg bg-amber-50 p-2">「{teacher.teachLine}」</p>}
        </>
      )}
      {book && (
        <>
          <div className="font-semibold">📜 {book.title}</div>
          {known ? <p className="rounded-lg bg-stone-100 p-2 text-xs">{book.excerpt}</p> : <button className="btn-primary w-full" onClick={learn}>📖 記録を読む</button>}
        </>
      )}
      {known && recipe && (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-2">
          <div className="font-semibold">📕 レシピ「{recipe.name}」を知った</div>
          <div className="text-xs text-stone-600">
            {status === "mastered" ? "習得済み" : status === "trialAvailable" ? "条件を満たしている。厨房で試作できる" : "まだ条件を満たしていない。厨房のレシピ帳で条件を確認"}
          </div>
          <button className="btn-secondary mt-1 w-full" onClick={onKitchen}>🍳 厨房のレシピ帳へ</button>
        </div>
      )}
    </div>
  );
}

// 2D top-down village: a 4x6 grid with a dirt-road cross. Facilities are tap targets.
export function VillageMap() {
  const { dispatch } = useGame();
  const [info, setInfo] = useState<Facility | null>(null);

  const tap = (f: Facility) => {
    if (f.screen) dispatch({ type: "navigate", screen: f.screen });
    else setInfo(f);
  };

  return (
    <div className="p-4">
      <div className="relative aspect-[4/6] w-full overflow-hidden rounded-2xl bg-lime-200 shadow-inner">
        {/* roads */}
        <div className="absolute inset-y-0 left-1/2 w-8 -translate-x-1/2 bg-amber-200/80" />
        <div className="absolute inset-x-0 top-1/2 h-8 -translate-y-1/2 bg-amber-200/80" />
        <div className="absolute right-3 bottom-[18%] text-3xl opacity-60">🌳</div>
        <div className="absolute top-[28%] left-[30%] text-2xl opacity-60">🌳</div>
        <div className="absolute top-[70%] left-[35%] text-2xl opacity-60">⛲</div>

        <div className="absolute inset-0 grid grid-cols-4 grid-rows-6 p-2">
          {FACILITIES.map((f) => (
            <button
              key={f.id}
              onClick={() => tap(f)}
              style={{ gridColumn: `${f.col + 1}`, gridRow: `${f.row + 1} / span 2` }}
              className="m-1 flex flex-col items-center justify-center rounded-xl bg-white/90 p-1 shadow active:scale-95"
            >
              <span className="text-3xl leading-none">{f.emoji}</span>
              <span className="mt-1 text-center text-[11px] leading-tight font-semibold">{f.name}</span>
            </button>
          ))}
        </div>
      </div>
      <p className="mt-2 text-center text-xs text-stone-500">施設をタップして移動</p>

      {info && (
        <div className="fixed inset-0 z-20 flex items-end bg-black/30" onClick={() => setInfo(null)}>
          <div className="mx-auto w-full max-h-[85vh] max-w-md overflow-y-auto rounded-t-2xl bg-white p-4 pb-8" onClick={(e) => e.stopPropagation()}>
            <div className="mb-1 text-lg font-bold">
              {info.emoji} {info.name}
            </div>
            <p className="mb-2 text-sm text-stone-600">{info.description}</p>
            {info.personId && <PersonSpot id={info.personId} onPeople={() => { setInfo(null); dispatch({ type: "navigate", screen: "people" }); }} />}
            {(info.teacherId || info.bookId) && (
              <LearnSpot f={info} onKitchen={() => { setInfo(null); dispatch({ type: "navigate", screen: "kitchen" }); }} />
            )}
            <div className="mb-3 flex flex-wrap gap-1.5 text-sm">
              {INGREDIENTS.filter((i) => info.source && i.source === info.source).map((i) => (
                <span key={i.id} className="rounded-full bg-stone-100 px-2 py-1">
                  {i.emoji}
                  {i.name}
                </span>
              ))}
            </div>
            <button className="btn-secondary w-full" onClick={() => setInfo(null)}>
              閉じる
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
