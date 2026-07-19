# 小学2年生を安全に追加する実装計画

## 結論

小学2年生を現行の `LINES` へ直接追加してはならない。現在の保存形式はステージIDとラインIDを学年なしで保存しているため、進捗、最近問、履歴、タイムアタックが小学1年生と衝突する。

先に学年レジストリとstate v4を導入し、小学1年生の既存記録を `grades.g1` へ無変更で移す。その後、`grade2-curriculum.js` の66ステージを `CURRICULA.g2` として有効化する。

## カリキュラムの正本

- 小学1年生：現行 `game-core.js` の6ライン・66ステージ
- 小学2年生：`grade2-curriculum.js` の6ライン・66ステージ
- 二年生の調査・設計根拠：`docs/curriculum_math_g2_overview.md`

`grade2-curriculum.js` は現在メタデータだけを公開し、`index.html`、`sw.js` からは読み込まない。これにより、ユーザーが確認中の小学1年生版へ表示・保存形式の変更を混ぜない。

## 目標データモデル

```js
const CURRICULA = {
  g1: {
    id: 'g1',
    label: '1ねんせい',
    lines: G1_LINES,
    lineOrder: G1_LINE_ORDER,
    recommendedPath: G1_RECOMMENDED_PATH
  },
  g2: {
    id: 'g2',
    label: '2ねんせい',
    lines: G2_LINES,
    lineOrder: G2_LINE_ORDER,
    recommendedPath: G2_RECOMMENDED_PATH
  }
};
```

互換期間中は、現在の `LINES`、`ISLANDS`、`LINE_ORDER` を `CURRICULA.g1` のaliasとして残す。既存の小学1年生テストと保存データを一度に壊さないためである。

正式APIは学年を必須にする。

```js
curriculumFor(gradeId)
lineFor(gradeId, lineId)
stageFor(gradeId, lineId, stageId)
makeStageQuestions(gradeId, lineId, stageId, options)
makeTimeAttackQuestions(gradeId, lineId, options)
isUnlocked(state, gradeId, lineId, stageId)
```

不明なIDは例外または明示的なエラーにする。現在のように未知のラインを小学1年生の `number` へ黙って置き換えると、二年生の定義漏れが一年生問題として表示される。

## state v4

```js
{
  version: 4,
  introSeen: true,
  workshopName: '',
  settings: {},
  currentGrade: 'g1',
  grades: {
    g1: {
      lastLine: 'number',
      progress: {},
      parts: {},
      moods: {},
      stats: {},
      lineStats: {},
      lineIntros: {},
      timeAttack: {},
      recentQuestions: {},
      recentRush: {},
      history: []
    },
    g2: {
      lastLine: 'number',
      progress: {},
      parts: {},
      moods: {},
      stats: {},
      lineStats: {},
      lineIntros: {},
      timeAttack: {},
      recentQuestions: {},
      recentRush: {},
      history: []
    }
  }
}
```

### v1〜v3からの移行

1. 保存キー `lumina_state_v1` は維持する。
2. 既存のv1・v2は現行ロジックで一度v3相当へ正規化する。
3. v3の `progress`、`parts`、`moods`、`stats`、`lineStats`、`lineIntros`、`timeAttack`、`recentQuestions`、`recentRush`、`history` をそのまま `grades.g1` へ移す。
4. 旧履歴に `gradeId: 'g1'` を補完し、既存のstage ID、line ID、時刻、成績は変更しない。
5. `currentGrade: 'g1'` とし、`grades.g2` は空の初期値で作る。
6. 同じv4データへ複数回 `migrateState` を行っても値が変わらないようにする。
7. 保存データのversionがアプリより新しい場合は上書き保存せず、「アプリの更新が必要」と扱う。
8. 初回v4移行時は、生のv3を一度だけ別キーへバックアップする。

## セッションと履歴

次へ必ず `gradeId` を追加する。

- 通常ステージのsession
- タイムアタックのsession
- 問題オブジェクト
- 結果画面のresult
- 学習履歴
- semantic signatureの保存先

学年切替後に同じ `lineId: 'number'` を使っても、`g1/number` と `g2/number` は別物として保存する。

## 学年選択画面

- ホーム上部に `1ねんせい | 2ねんせい` の切替を置く
- 初回と既存ユーザーの初期値は小学1年生
- 前回選んだ学年と、その学年内の `lastLine` を復元する
- プレイ中は学年切替を隠すか、中断確認を出す
- ホーム、設計図、図鑑、保護者画面は選択学年のライン数・ステージ数から動的に描画する
- 「6ライン」「66ステージ」「11/11」「198印」などを文字列へ焼き込まない
- 保護者画面では学年別表示を基本にし、必要なら全学年集計を追加する

## 問題生成

二年生も通常8問、タイムアタック12問を維持する。

問題ビルダーは `gradeId + lineId + stageId` で解決する。配列indexは画面上の順番表示だけに使い、問題生成、年間おすすめ順、タイムアタック配分はstage IDを参照する。

```js
const BUILDERS = {
  g1: { /* 現行ビルダー */ },
  g2: {
    number: { g2_num_group_count: buildG2GroupCount, /* ... */ },
    written: { g2_calc_add_no_carry: buildG2AddNoCarry, /* ... */ },
    multiplication: { /* ... */ },
    measure: { /* ... */ },
    shape: { /* ... */ },
    solve: { /* ... */ }
  }
};
```

二年生用の新しい中心操作は次を優先する。

- 位取りブロックの10個交換・両替
- 筆算の途中工程の修理
- アレイの行・列の点灯、分割、合流
- 九九表の行・列・対称位置のスキャン
- ものさしの移動、目盛り拡大、直線作図
- L・dL・mLの注水と容器表示
- 開始時刻から時計を進める経過時間操作
- 直角ゲージの回転・重ね合わせ
- 面・辺・頂点からの箱の組立
- 表・グラフの作成と誤り修正
- テープ図への量の配置と逆算回路

## 実装順

### 1. 学年レジストリと回帰の固定

- 現行G1を `CURRICULA.g1` へ包む
- 既存 `LINES` / `LINE_ORDER` は互換aliasとして維持
- G1の66 stage ID、6,336問生成、全完走、198印、6ラインのタイムアタックを固定テストする

### 2. state v4と学年間分離

- v1・v2・v3からの移行
- 学年別progress、統計、履歴、最近問、タイムアタック
- 移行の冪等性と将来version保護

### 3. 学年選択と動的UI

- 学年切替
- ホーム、設計図、図鑑、保護者画面の総数を動的化
- G1へ戻ったときの表示・記録回帰

### 4. 二年生問題ビルダー

- まず大きな数、筆算、かけ算のA領域3ライン
- 次に計測、図形、調査・問題解決
- 各ステージの通常8問、文章場面、確認、semantic signature

### 5. 二年生タイムアタック

- `grade2-curriculum.js` の12技能枠を使う
- 各ライン完了後だけ解放
- 3秒加算、自己ベスト、履歴を学年別保存

### 6. PWA更新

- `grade2-curriculum.js` を実行時に統合する段階でキャッシュ対象へ追加
- Service Workerのキャッシュ名を更新
- manifestとホーム文言を「小学1・2年生」へ更新
- HTTPSで更新切替とオフライン起動を確認

## 必須テスト

| テスト | 完了条件 |
|---|---|
| G1回帰 | 現行66 stage ID、6ライン、6,336問、全完走、198印、タイムアタックが一致 |
| state v4移行 | v1・v2・v3を移行し、G1記録が欠けず、2回移行しても変化しない |
| 学年間分離 | G2のクリア・最近問・履歴・ベスト更新がG1を一切変更しない |
| G2定義 | 6ライン・66ステージ・ID一意・技能ID一意・確認ステージ5/11 |
| G2大量生成 | 全ステージを多数seedで生成し、範囲・正解・操作・文章・解説・重複回避を検査 |
| G2全完走 | 66ステージを自動完走し、各ラインのタイムアタックを解放できる |
| 学年UI | 切替、前回位置、動的総数、図鑑、保護者表示が正しい |
| PWA | 新規資産、キャッシュ切替、オフライン起動、旧キャッシュ限定削除が正しい |

## 今回できているところ

- 文科省と令和6年度版教科書3社の集約
- 二年生6ライン・66ステージの正規化
- 全stage ID、canonicalSkillId、学習目標、中心操作、前提技能、学習指導要領対応
- ステージ5・11の確認テスト指定
- 各ライン12枠のタイムアタック配分
- 年間おすすめ順
- メタデータ単体検査 `tests/grade2-curriculum-smoke.mjs`

まだ公開版へ入れていないものは、state v4、学年選択UI、二年生の実問題ビルダーである。小学1年生を確認中の段階では、ここを一度に混ぜず、回帰テストを先に固定してから進める。
