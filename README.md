# Ultimate Dish

中世風異世界の農村を舞台にした「料理で攻略する」RPG／料理／シミュレーションの縦切り試作。
戦闘の代わりに **料理を作る → 数値評価 → クエストで使う → 図鑑に登録** のループを検証する。

## 動かす

```
npm install
npm run dev      # 開発サーバ
npm test         # 評価ロジックのユニットテスト
npm run build    # 型チェック + 本番ビルド
```

## 構成

| 場所 | 役割 |
| --- | --- |
| `src/data/` | 食材21種・調理法10種・異世界スパイス6種・特殊器具3種・食べ手・クエスト・村の施設 |
| `src/game/cooking/` | レシピ → 料理状態（`cook.ts`）、料理名（`naming.ts`）、生成キー（`generationKey.ts`）、料理データ組み立て（`buildDish.ts`） |
| `src/game/evaluation/` | 8軸の絶対評価（`absolute.ts`、美味しさは `deliciousness.ts`）と食べ手ごとの体験評価（`experience.ts`） |
| `src/game/quest/` | クエスト判定 |
| `src/services/` | 文章・画像生成のサービス層（現在はmock。AI接続時はここだけ差し替え） |
| `src/state/` | `useReducer` + Context の単一ストア（メモリのみ。再読み込みで消える） |
| `src/pages/`, `src/components/` | UI |

ゲームロジック（`src/game`）は純関数でReactに依存しない。

## 主な仕様メモ

- **生成キー** `UD1|食材(ソート済)|工程(順序付き)|チェックサム`。同じキーから同じレシピ・同じ評価が再現される。チェックサムは名前の言い回しやプレースホルダー画像のシードにも使う（将来のAI画像シード候補）。
- **派生料理** 各料理は `id` と `parentDishId` を持つ。図鑑の「派生を作る」で元レシピを引き継いで作り直せる。
- **将来の料理ギルド用** `isPublic`, `generationKey`, `parentDishId`, `guild.{favorites,reproductions}`。系統樹の太さ = 再現成功数 + 派生数（`parentDishId` から集計）。
- **器具は次の調理法に効く**：魔石炉=加熱の精密制御（低温調理はこれが無いと生焼け扱い）、時熟壺=時間系工程を1.5倍、香封鍋=香りを逃さない。
- **香りのスパイスは加熱で半減**するため、入れる順番に意味がある。
- **解放**：依頼1達成で焔胡椒・清霊ミント・時熟壺、依頼2達成で鈴音草の実・蒼晶花・香封鍋。
