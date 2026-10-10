import { useState } from "react";
import { useGame } from "../state/GameContext";
import { canCreate, deleteSlot, formatUpdated, loadStore, MAX_SLOTS, persistStore, slotState, type SaveStore } from "../state/saves";

// 起動画面: start a new character, or continue one of up to four saved characters.

export function TitleScreen() {
  const { dispatch } = useGame();
  const [store, setStore] = useState<SaveStore>(() => loadStore());
  const [listing, setListing] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const full = !canCreate(store);

  const remove = (id: string) => {
    const next = deleteSlot(store, id);
    const err = persistStore(next);
    setStore(next);
    setConfirmId(null);
    setMessage(err ?? "削除した");
    if (next.slots.length === 0) setListing(false);
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-black px-5 py-10 text-stone-200">
      <div className="mb-10 mt-6 text-center">
        <h1 className="text-2xl font-bold tracking-widest text-stone-100">Ultimate Dish</h1>
        <p className="mt-2 text-xs text-stone-500">剣と魔法と、一皿の物語</p>
      </div>

      {!listing ? (
        <div className="space-y-3">
          <button
            className="w-full rounded-xl border border-stone-600 px-4 py-4 text-base text-stone-100 active:bg-stone-900 disabled:opacity-40"
            disabled={full}
            onClick={() => dispatch({ type: "newGame" })}
          >
            新しくキャラクターを作る
          </button>
          {full && <p className="text-center text-xs text-amber-300">セーブ枠は{MAX_SLOTS}つまで。新しく作るには、どれかを削除してください</p>}
          <button
            className="w-full rounded-xl border border-stone-600 px-4 py-4 text-base text-stone-100 active:bg-stone-900 disabled:opacity-40"
            disabled={store.slots.length === 0}
            onClick={() => setListing(true)}
          >
            既存キャラクターで始める
          </button>
          <p className="text-center text-[11px] text-stone-600">保存済み {store.slots.length}/{MAX_SLOTS}</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <button className="text-sm text-stone-400 underline" onClick={() => { setListing(false); setConfirmId(null); }}>← 戻る</button>
            <span className="text-[11px] text-stone-500">{store.slots.length}/{MAX_SLOTS}</span>
          </div>
          {[...store.slots].sort((a, b) => b.updatedAt - a.updatedAt).map((s) => (
            <div key={s.id} data-slot={s.summary.name} className="rounded-xl border border-stone-700 p-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-base font-semibold text-stone-100">{s.summary.name}</span>
                <span className="shrink-0 text-[11px] text-stone-500">{formatUpdated(s.updatedAt)}</span>
              </div>
              <div className="mt-1 text-xs text-stone-400">
                {s.summary.roleLabel}・{s.summary.gender}・{s.summary.age ?? "—"}歳・{s.summary.levelLabel}
              </div>
              <div className="text-xs text-stone-400">📍{s.summary.location}・{s.summary.day}日目・{s.summary.partner}</div>
              {confirmId === s.id ? (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button className="rounded-lg border border-rose-700 py-2 text-sm text-rose-300" onClick={() => remove(s.id)}>本当に削除する</button>
                  <button className="rounded-lg border border-stone-700 py-2 text-sm text-stone-300" onClick={() => setConfirmId(null)}>やめる</button>
                </div>
              ) : (
                <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
                  <button className="rounded-lg border border-stone-500 py-2 text-sm text-stone-100 active:bg-stone-900" onClick={() => dispatch({ type: "loadSlot", slotId: s.id, state: slotState(s) })}>
                    続きから
                  </button>
                  <button className="rounded-lg border border-stone-800 px-3 py-2 text-xs text-stone-500" onClick={() => setConfirmId(s.id)}>削除</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {message && <p className="mt-4 text-center text-xs text-stone-500">{message}</p>}
    </div>
  );
}
