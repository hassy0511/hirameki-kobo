# ひらめき工房 ビジュアル／問題UI設計 v1

## 目的

絵文字や抽象記号を「何の物か」「何を答えるか」の手掛かりとして使わない。子どもが問題内容に集中できるよう、問題文・教材図・操作・回答方法を一つの意味へそろえる。

## 画面の美術基準

- 濃紺の工房フレーム、生成りの紙、塗装した木製玩具を基本素材にする
- 差し色は学習ライン色、ルミナの黄、工房の青緑に限定する
- 汎用的なSaaSカードや絵文字タイルではなく、作業台・トレイ・モニター・レールとして見せる
- キャラクターは案内と診断の場面に使い、学習対象そのものの代用品にはしない
- 数直線、長さ、時計、位取り、グラフ、図形は数理的な正確さを優先し、HTML/CSSで描く

## Images 2.0を起点にした素材工程

組み込み画像生成を使い、最初に世界全体の美術基準を一枚絵で決める。その絵を参照してキャラクター場面、教材場面、部品アトラスを作る。アプリではアトラスをCSSで切り出し、同じ部品を一貫して再利用する。

生成画像はJPEGへ最適化し、1ファイル500KB未満にする。生成元は保持し、配信用素材は `assets/` に固定名で置く。

### 生成プロンプトセット

1. `workshop-hero-v1.jpg`
   - Wide premium children’s workshop illustration for a Japanese elementary math learning game. Deep navy structural frame, cut-paper and painted wooden-toy materials, warm cream work surfaces, a dormant luminous core named Lumina in the center, six tangible repair bays with trays, conveyors, clock, measuring and data equipment, Toto the fox assistant and Mokumo the small robot working nearby. Editorial children’s picture-book quality, cohesive lighting, readable large shapes, room for interface panels. No text, letters, numbers, logos, watermark, emoji, abstract UI icons, or clutter.
2. `story-guides-v1.jpg`
   - Square character scene matching the supplied workshop art direction. Toto, a friendly orange fox workshop assistant, points at the workbench while Mokumo, a compact cream-and-navy maintenance robot, holds a blank diagnosis board. Warm cooperative expressions, waist-up composition, painted wood and cut-paper picture-book style, deep navy framing, cream background. No text, letters, numbers, logos, watermark, or emoji.
3. `measure-methods-v1.jpg`
   - Exact three-panel horizontal atlas, three equal square scenes in one row, matching the workshop art direction. Left: two movable rods with one end carefully aligned. Middle: two fixed distant tables whose lengths are copied with paper tape. Right: a rod measured by identical touching blocks with no gaps. Clear elementary-math teaching diagrams, consistent scale, deep navy outlines, cream work surface. No text, letters, numbers, arrows, logos, watermark, emoji, or decorative clutter.
4. `workshop-objects-v1.jpg`
   - Exact 3 by 2 object atlas with six equal square cells, matching the workshop art direction. Top row: bolt and nut, gear, task lamp. Bottom row: battery, wrench, wooden cube. One large centered recognizable object per cell, identical warm cream card background and lighting, deep navy outline, painted wooden-toy and cut-paper finish. No text, letters, numbers, logos, watermark, emoji, or extra objects.

## アトラス切り出し

### `workshop-objects-v1.jpg`

`background-size: 300% 200%`

- 上段左 `0 0`：ねじ
- 上段中 `50% 0`：はぐるま
- 上段右 `100% 0`：ランプ
- 下段左 `0 100%`：でんち
- 下段中 `50% 100%`：レンチ
- 下段右 `100% 100%`：木のブロック

### `measure-methods-v1.jpg`

`background-size: 300% 100%`

- 左 `0 50%`：直接比較
- 中 `50% 50%`：テープへの写し取り
- 右 `100% 50%`：同じ単位による測定

## 問題UIの必須ルール

1. 問題上部に操作種別を日本語で表示する。「一つえらぶ」「部品をタップ」「数をあわせる」など、実操作と一致させる。
2. 操作説明には常に「やること」ラベルを付ける。
3. 左右・上下・前後・大小記号は意味順に固定し、ランダム配置しない。
4. 絵は内容理解を助けるために使う。絵がなくても問題文とラベルで対象が分かるようにする。
5. 仕分けは「わけるもの」「どのトレイに入るか」を同じ画面に表示する。
6. 画像と教材図にはアクセシブル名を付ける。
7. モバイルでもナビゲーションの文字を消さない。

## 完了条件

- ホーム、物語、問題、結果、図鑑に抽象記号だけで意味を伝える箇所がない
- 長さの三つの方法が、場面画像と説明文の両方で区別できる
- 部品の繰り返し表示は同じアトラスを使い、色・名称・触れる対象が一致する
- 320px幅とiPad幅で文字ラベル、回答ボタン、操作説明が欠けない
- Service Workerが全画像をキャッシュし、オフラインでも表示できる
