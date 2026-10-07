import { useState } from "react";
import type { Dish } from "../types";
import { INGREDIENT_MAP } from "../data/ingredients";
import { BODY_LABEL } from "../game/labels";
import { stepLabel } from "./stepLabel";
import { DishImageView, RankBadge, ScoreBars } from "./DishParts";

interface Props {
  dish: Dish;
  onRename?: (name: string) => void;
  onTogglePublic?: () => void;
  onDerive?: () => void;
  showMeta?: boolean;
}

export function DishDetail({ dish, onRename, onTogglePublic, onDerive, showMeta = true }: Props) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(dish.name);
  const body = Object.entries(dish.profile.body).filter(([, v]) => v > 0) as [keyof typeof BODY_LABEL, number][];

  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        <DishImageView image={dish.image} size={88} />
        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="flex gap-1">
              <input
                className="min-w-0 flex-1 rounded-lg border border-stone-300 px-2 py-1.5 text-base"
                value={name}
                maxLength={30}
                onChange={(e) => setName(e.target.value)}
              />
              <button
                className="btn-primary px-3"
                onClick={() => {
                  if (name.trim()) onRename?.(name.trim());
                  setEditing(false);
                }}
              >
                OK
              </button>
            </div>
          ) : (
            <h3 className="text-lg leading-snug font-bold break-words">
              {dish.name}
              {onRename && (
                <button className="ml-1 text-sm text-stone-500" onClick={() => setEditing(true)} aria-label="名前を変更">
                  ✏️
                </button>
              )}
            </h3>
          )}
          <div className="mt-1 flex items-center gap-2">
            <RankBadge rank={dish.rank} />
            <span className="text-2xl font-bold tabular-nums">{dish.total}</span>
            <span className="text-xs text-stone-500">総合点</span>
          </div>
        </div>
      </div>

      {dish.profile.undercooked && (
        <p className="rounded-lg bg-red-100 px-3 py-2 text-sm text-red-800">
          ⚠ 生のままでは危ない素材があります。加熱工程を入れましょう。
        </p>
      )}

      <ScoreBars scores={dish.scores} />

      <p className="text-sm text-stone-600">{dish.description}</p>

      <div className="text-sm">
        <div>
          <span className="text-stone-500">素材：</span>
          {dish.recipe.ingredientIds.map((id) => `${INGREDIENT_MAP[id]?.emoji}${INGREDIENT_MAP[id]?.name}`).join("、")}
        </div>
        <div>
          <span className="text-stone-500">工程：</span>
          {dish.recipe.steps.length ? dish.recipe.steps.map(stepLabel).join(" → ") : "なし"}
        </div>
        {body.length > 0 && (
          <div>
            <span className="text-stone-500">効果：</span>
            {body.map(([k, v]) => `${BODY_LABEL[k]}+${v}`).join("、")}
          </div>
        )}
      </div>

      {showMeta && (
        <div className="space-y-1 rounded-lg bg-stone-100 p-2 text-xs text-stone-600">
          <div className="break-all">生成キー：{dish.generationKey}</div>
          <div className="break-all">ID：{dish.id}</div>
          <div className="break-all">親料理ID：{dish.parentDishId ?? "なし（オリジナル）"}</div>
          <div>公開状態：{dish.isPublic ? "公開" : "非公開"}</div>
        </div>
      )}

      {(onTogglePublic || onDerive) && (
        <div className="grid grid-cols-2 gap-2">
          {onTogglePublic && (
            <button className="btn-secondary" onClick={onTogglePublic}>
              {dish.isPublic ? "非公開にする" : "公開にする"}
            </button>
          )}
          {onDerive && (
            <button className="btn-secondary" onClick={onDerive}>
              🌱 派生を作る
            </button>
          )}
        </div>
      )}
    </div>
  );
}
