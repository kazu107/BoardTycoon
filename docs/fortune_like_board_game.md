# Fortune‑like Board Game – 完全仕様書 v1.0

> 本書は、キャンバス「Fortune‑like Board Game (html/js, Single File)」の**実装仕様**と**テスト仕様**を統一的に定義します。対象は純粋な HTML/CSS/JavaScript（依存なし）。

---

## 0. 目的 / スコープ

- 学内外の配布や保守を想定した**完全オリジナル実装**（IP侵害回避）。
- ご指定マップ（7×13）/ 分岐マス（`*`）/ 銀行強制停止 / 「同ターンもう一度」カード / 総資産（現金＋株＋物件）での**銀行到着時勝利**を仕様化。

---

## 1. 用語

- **ノード(Node)**: MAP 上の `#` または `*`。
- **タイル(Tile)**: Node に紐づくゲーム上のマス情報（type/name/price 等）。
- **分岐(Fork)**: `*` ノード。選択 UI を伴う。
- **隣接(Adjacency)**: 上下左右 4 近傍。
- **前ノード(prev)**: 直前に居たノード（U ターン抑止に利用）。
- **総資産(Net Worth)**: 現金 + Σ(各地区株価×保有株数) + Σ(所有物件の価値)。

---

## 2. 盤面仕様（MAP → グラフ）

### 2.1 マップ（固定）

```
######*######
#.....#.....#
#.....#.....#
#.....#.....#
#.....#.....#
#.....#.....#
######*######
```

- 行数: 7、列数: 13
- `#`/`*` は**通行可能ノード**、`.` は空白（ノードなし）
- **銀行**は `(r=0,c=0)`、すなわち左上 `#` を `bank` とする（**変更可**）。

### 2.2 ノード生成

- `indexAt[r][c]` にノードインデックス（存在しなければ `-1`）。
- `nodes[ix] = { r, c, kind: '#|*' }`
- `tiles[ix]` は初期 `{ ix, r, c, fork, type:'free', ... }` を生成。
- `adj[ix]` は上下左右の通行可能ノードインデックス配列。

### 2.3 タイル種別割当（初期）

- `bank` は `indexAt[0][0]`。
- その他は**行優先**で以下を順に割当：
  - `suit` ×4（♠♥♦♣ を均等散布）
  - `prop` ×12（地区 A/B/C/D をラウンドロビン、`price`=220/260/300/340）
  - `chance` ×5（❓）
  - `tax` ×2（💸、`tax`=120）
  - `rest` ×1（◎）
- `fork` 視覚は `t.fork = (kind==='*')` で表現（type は上記割当を優先）。

---

## 3. ゲームルール

### 3.1 プレイヤー

- 2〜4 人、開始所持金 2000G、開始位置は `bank`。
- 追加状態：`suits:Set` / `stocks:{A,B,C,D}` / `level` 初期 1 / `halfToll` / `bonusDivTimes` / `nextRoll` / `pendingFork`（次ターン進行予約）。

### 3.2 ターンフェーズ

1. **待機**（Roll 可）
2. **移動**（d6 ステップ。途中の**分岐**や**銀行強制停止**を処理）
3. **選択**（着地タイル効果：購入/投資/通行料/カード 等）
4. **追加ロール**（該当時のみ, 同ターン 1 回）
5. **ターン終了** → 次プレイヤー

### 3.3 ダイス

- 通常は**各ターン 1 回のみ**。
- ベンチャーカード「**ダイスもう一度！**」で**同ターン中に 1 回だけ**追加ロール可。
- フラグ：`rolledThisTurn`, `extraRollAvailable`, `extraRollConsumed`。
- 判定: `canRoll()` = `phase==='待機' && (!rolledThisTurn || (extraRollAvailable && !extraRollConsumed))`。

### 3.4 移動

- 1 ステップごとに `adj[cur]` から次ノードを選ぶ：
  - `prev` が存在し、かつ選択肢が 2 以上なら **U ターンを除外**。
  - 候補が 1 つなら自動前進。
  - 候補が 2 つなら **分岐**：
    - **通過時**: ステップ進行中に選択ダイアログを表示→選んだ方向に即進行（残りステップを続行）。
    - **停止時**: 停止直後にダイアログで選択→`pendingFork={nodeIx,nextIx}` を保存（**次ターンの最初の 1 歩**で自動消費）。
- **銀行強制停止**: 残りステップがあっても、銀行に到達した瞬間に移動を打ち切る。

### 3.5 勝利条件

- **銀行着地時のみ**チェック：`netWorth(p) >= winTarget` で即勝利。
- `netWorth(p) = cash + Σ(stock[d]*price[d]) + Σ(ownedProp.price)`

### 3.6 レベルアップ（銀行）

- 4 スート（♠♥♦♣）が揃っていれば、銀行到着で昇格：
  - 給与 = `300 + 50*(level-1) + 10*(所有物件数)`
  - 配当 = `floor(Σ(price[d]*stocks[d]*0.5) * bonusDivTimes)`
  - `bonusDivTimes` は消費して `1.0` に戻す。`suits` はリセット。

### 3.7 物件 / 通行料 / 投資

- **購入**: 空き物件に停止時、価格ちょうどで購入可。
- **通行料**: `max(10, round(price/5))`。`halfToll` 持ちなら 1 回だけ半額。
- **投資**: 自己所有に 50〜500G（50 刻み）。物件価値 `+round(0.8*投資額)`、地区株価 `+max(1,floor(投資額/100))`。

### 3.8 株（地区 A/B/C/D）

- 初期株価 10、発行枚数は会計上のみ。
- 10 株単位で売買（UI 上は ±10）とし、価格インパクト = `±floor(qty/10)`。

### 3.9 ベンチャーカード（抜粋）

- `+200G/-150G` / **ダイスもう一度**（同ターン 1 回）/ **銀行ワープ** / **全地区 ±1** / **無料投資 200G** / **税還付 +100G** / **全員から +50G** / **通行料半額 1 回** / **次昇格の配当 1.5x** / **次出目=6**。

### 3.10 破産

- 負残高時に自動清算：高株価順に株売却→安物件から 50% で売却→なおマイナスなら**脱落**。

---

## 4. UI/UX 仕様

### 4.1 サイドバー（メニュー > ボタン）

- **🎲 ダイス**: `待機` かつ `canRoll()` のときのみ有効。
- **🏬 購入**: 現在タイルが空き物件かつ所持金 ≥ 価格。
- **📈 投資**: 現在タイルが自物件。
- **🏦 株**: 銀行タイルに居るとき。
- **⏭️ ターン終了**: 常時可（勝利後は不可）。
- **勝利総資産(G)**: `winTarget`。変更でログ表示＆即反映。

### 4.2 ダイアログ

- **Buy/Invest/Market/Card/Fork** を用意。
- **Fork**: 候補 2 方向を \*\*矢印（←→↑↓）\*\*で表示。

### 4.3 表示

- プレイヤーカード：現金 / 総資産 / 位置 / レベル / スート / 株 / 所有物件一覧。
- 盤面：タイル中央に名称・エンブレム。所有者ラベル/価格/地区をバッジ表示。コマは**タイル DOM 中心**。

---

## 5. データモデル（Type 定義）

```ts
// Node/Tile graph
interface Node { r:number; c:number; kind:'#'|'*' }
interface Tile {
  ix:number; r:number; c:number; fork:boolean;
  type:'free'|'bank'|'prop'|'suit'|'chance'|'tax'|'rest';
  name:string; em?:string; owner:number|null; price:number; district?:'A'|'B'|'C'|'D';
  suit?: '♠'|'♥'|'♦'|'♣'; tax?:number;
}

// Stocks
interface StockEntry { price:number; issued:number }

// Player
interface Player {
  id:number; name:string; color:string;
  cash:number; pos:number; lastPos:number|null; level:number;
  suits:Set<'♠'|'♥'|'♦'|'♣'>; stocks:{A:number;B:number;C:number;D:number};
  halfToll:boolean; bonusDivTimes:number; nextRoll:number|null;
  pendingFork: {nodeIx:number; nextIx:number} | null; out:boolean;
}

// Game (主要プロパティのみ)
interface Game {
  players:Player[]; cur:number; turn:number; phase:'待機'|'移動'|'選択'|'終了';
  tiles:Tile[]; adj:number[][]; stocks:Record<'A'|'B'|'C'|'D', StockEntry>;
  rolledThisTurn:boolean; extraRollAvailable:boolean; extraRollConsumed:boolean;
  winTarget:number; winner:number|null;
}
```

---

## 6. 関数仕様（抜粋・確定）

> それぞれ副作用・前提・失敗条件を明記します。

- `init(numPlayers=2)`
  - **副作用**: 盤面/株/プレイヤー/UI 初期化、ログに「ゲーム開始！」
- `canRoll(): boolean`
  - **真**: `phase==='待機' && (!rolledThisTurn || (extraRollAvailable && !extraRollConsumed))`
- `rollDice(): 1..6`
  - `player.nextRoll` があればそれを消費、なければ乱数 1..6。
- `moveBy(p, steps)`
  - **分岐**: 通過時/停止時の選択ロジック（§3.4）。
  - **銀行強制停止**: `bank` 到達時に残歩数を破棄。
- `onBank(p)`
  - **昇格＆配当**（§3.6）、**勝利判定**（§3.5）。
- `netWorth(p)`
  - 現金＋株評価＋物件価値合算（§3.5）。
- `propToll(prop)`
  - `max(10, round(price/5))`。
- `investProperty(p, prop, amount, free=false)`
  - **成功条件**: 50〜500, 50 刻み, 残高十分 or `free`。
  - **効果**: 価値 +0.8×、地区株価 +max(1, floor(amount/100))。
- `buyStock/sellStock`
  - 10 株単位、価格に連動。**手数料なし**。
- `tryLiquidate(p)`
  - 株売却→物件 50% 売却→なおマイナスで `out=true`。
- `askFork(curIx, options)`
  - UI ダイアログ（矢印ボタン）。**テストモード**では `options[0]` 自動選択。

---

## 7. 状態遷移（テキスト図）

```
[待機] --roll--> [移動] --到着--> [選択] --(追加ロール可?)--> [待機] --end--> 次プレイヤー
                 |--銀行到達途中--> [選択(銀行)]
```

- 追加ロール可は「同ターン中に未消費の extraRollAvailable=true」が条件。

---

## 8. 永続化（Save/Load）

- **形式**: JSON（localStorage `bt_save`）。
- **内容**: `players(※suits は配列に変換) / cur / turn / phase / stocks / tiles / rolledThisTurn / extraRoll*`。
- **互換**: 既存キーが無い場合は初期値を採用する（前方互換）。

---

## 9. 定数・係数（v1.0）

| 項目    | 値                                                  |
| ----- | -------------------------------------------------- |
| 初期現金  | 2000 G                                             |
| 株価初期値 | 10                                                 |
| 投資受付  | 50〜500 G（50 刻み）                                    |
| 投資効き率 | +0.8 × 投資額                                         |
| 通行料   | max(10, round(物件価値/5))                             |
| 税金    | 120 G                                              |
| 給与    | 300 + 50×(Lv-1) + 10×所有物件数                         |
| 配当    | floor(Σ(price[d]\*stocks[d]\*0.5) × bonusDivTimes) |

---

## 10. 受入テスト（Acceptance Tests）

> UI 左「🧪テスト」相当（T1〜T4）＋本書で追加（T5〜T12）。

- **T1**: `netWorth` が「現金＋株＋物件」を返す。
- **T2**: 「ダイスもう一度！」で**同ターン中**に 2 回目ロールが可能。
- **T3**: 銀行**強制停止**が動作する。
- **T4**: 分岐に**停止**したら**次ターン方向が予約**される。
- **T5**: 追加ロールを 1 回消費したら、**同ターン 3 回目は不可**。
- **T6**: `halfToll` が 1 回だけ有効。
- **T7**: 4 スート揃え→銀行で**昇格**（給与＋配当）。
- **T8**: 投資 200G → 物件価値 +160 / 地区株価 +2。
- **T9**: 税金で負残高 → 株/物件の**自動清算** → なお負なら `out=true`。
- **T10**: Market 売買で株価が `±floor(qty/10)` 変化。
- **T11**: ウィンドウリサイズ後も**コマがタイル中心**に再配置。
- **T12**: Save→Reset→Load でゲーム状態が復元。

各テストは**前提／操作／期待結果**を明記し、スナップショットで副作用を戻す。

---

## 11. エラー処理 / ガード

- 無効操作（資金不足/対象外タイル/ダイス不可）時は**何もしない**＋ログ出力。
- 分岐選択のキャンセルは**許可しない**（選択必須）。
- グラフ不整合（理論上発生しない）は最初の候補にフォールバック。

---

## 12. 非機能要件

- **依存なし**：オフラインで `index.html` 単体動作。
- **互換**：Chrome/Edge/Firefox 最新、モバイル幅でも可読。
- **パフォーマンス**：ノード数 \~100 未満、DOM 再描画は差分で軽量。
- **アクセシビリティ**：ボタンはラベル＋アイコン、ダイアログは `dialog`。

---

## 13. 拡張余地（Backlog）

- 物件セットボーナス、地区独自効果、カード追加、AI、オンライン対戦、アニメ強化、スマホ最適化（タップ領域拡大）、国際化（i18n）。
- タイル配置を**座標指定 YAML**で外部化。

---

## 14. 既知の制約

- 物件/カードの初期配置は**自動割当**（行優先）であり、厳密なバランス調整は未実施。必要に応じて座標固定に切替可能。
- `U` ターンは**抑止**（候補>1 のとき前ノードを除外）。仕様変更可。

---

## 15. 変更履歴

- **v1.0**: 初版。分岐/銀行強制停止/同ターン追加ロール/総資産=現金＋株＋物件/受入テスト拡張。

---

### 付録 A: 主要イベントシーケンス（擬似コード）

```text
onClick(🎲):
  if !canRoll() return
  isExtra := rolledThisTurn && extraRollAvailable && !extraRollConsumed
  if !isExtra then rolledThisTurn=true else extraRollConsumed=true
  steps := rollDice()
  moveBy(currentPlayer, steps)

moveBy(p, steps):
  phase='移動'
  for i=1..steps:
    candidates := adj[p.pos]
    if prev exists and |candidates|>1: candidates := candidates - {prev}
    next := (|candidates|==1) ? candidates[0]
            : (|candidates|==2) ?
                (p.pendingFork at this node ? consume it : askFork())
            : fallback
    step to next
    if next==bank and i<steps: break // 強制停止
  onLand()
  if landed on fork with two options:
    p.pendingFork := askFork() // 次ターン用
```

---

### 付録 B: 保存データ例

```json
{
  "players": [{
    "id":0,"name":"P1","color":"#ff5e5e","cash":2120,
    "pos":5,"lastPos":4,"level":1,
    "suits":["♠","♥"],
    "stocks":{"A":10,"B":0,"C":0,"D":0},
    "halfToll":false,"bonusDivTimes":1.0,"nextRoll":null,
    "pendingFork":null,"out":false
  }],
  "cur":0,"turn":7,"phase":"待機",
  "stocks":{"A":{"price":12,"issued":10},"B":{"price":10,"issued":0},"C":{"price":10,"issued":0},"D":{"price":10,"issued":0}},
  "tiles":[{"ix":0,"type":"bank", ...}]
}
```

---

## 最終確認のお願い（要件ブレ抑止）

- **銀行の座標**は `(0,0)` で確定で良いですか？ 別座標指定があればお知らせください。
- **U ターン可否**：現状は抑止（候補>1 で前ノード除外）。U ターン許可に変更しますか？
- **初期配置**：物件/カード/税/休憩の**座標を固定**したい場合は、`(r,c)` の一覧をご提示ください（即時反映可）。

