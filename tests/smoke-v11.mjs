import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const htmlUrl = new URL('../index.html', import.meta.url);
const html = fs.readFileSync(htmlUrl, 'utf8');
const scriptMatch = html.match(/<script>\s*([\s\S]*?)<\/script>/);
assert(scriptMatch, 'index.html にアプリ本体の script が必要です');
assert(scriptMatch[1].includes('/* TEST_HOOK */'), 'テスト用の注入位置が見つかりません');

const injectedScript = scriptMatch[1].replace('/* TEST_HOOK */', `
    globalThis.__LUMINA_TEST__ = {
      ISLANDS,
      ADDITION_STAGES,
      SUBTRACTION_STAGES,
      defaultState,
      loadState,
      buildQuestion,
      startStage,
      handleAnswer,
      nextQuestion,
      clearedCount,
      totalMarks,
      isUnlocked,
      isStandalone,
      renderHome,
      getState: () => state,
      getSession: () => session,
      getUi: () => ui
    };
    /* TEST_HOOK */`);

function createHarness({ savedRaw = null, standalone = false, displayMode = false } = {}) {
  const appElement = { innerHTML: '', addEventListener() {} };
  const toastElement = { textContent: '', classList: { add() {}, remove() {} } };
  const bodyClasses = new Set();
  const classList = {
    add(name) { bodyClasses.add(name); },
    remove(name) { bodyClasses.delete(name); },
    toggle(name, force) {
      const on = force === undefined ? !bodyClasses.has(name) : !!force;
      if (on) bodyClasses.add(name); else bodyClasses.delete(name);
      return on;
    }
  };
  const storage = new Map();
  if (savedRaw !== null) storage.set('lumina_state_v1', typeof savedRaw === 'string' ? savedRaw : JSON.stringify(savedRaw));
  const localStorage = {
    getItem(key) { return storage.has(key) ? storage.get(key) : null; },
    setItem(key, value) { storage.set(key, String(value)); },
    removeItem(key) { storage.delete(key); }
  };
  const document = {
    body: { classList },
    visibilityState: 'visible',
    getElementById(id) { return id === 'app' ? appElement : id === 'toast' ? toastElement : null; },
    querySelector() { return null; },
    createElement() { return { click() {}, style: {}, setAttribute() {} }; },
    addEventListener() {}
  };
  const windowObject = {
    scrollTo() {},
    addEventListener() {},
    matchMedia() { return { matches: displayMode, addEventListener() {}, removeEventListener() {} }; },
    location: { reload() {} },
    AudioContext: undefined,
    webkitAudioContext: undefined
  };
  const navigator = { standalone };
  const sandbox = {
    console,
    document,
    window: windowObject,
    navigator,
    location: { protocol: 'file:' },
    localStorage,
    requestAnimationFrame(callback) { callback(); },
    setTimeout,
    clearTimeout,
    Date,
    Math,
    JSON,
    Number,
    String,
    Array,
    Object,
    Set,
    Map,
    Blob,
    URL
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  new vm.Script(injectedScript, { filename: 'index.html:inline-script' }).runInContext(sandbox);
  return { game: sandbox.__LUMINA_TEST__, appElement, bodyClasses, storage };
}

function assertBaseQuestion(question, label, max = 100) {
  assert(Number.isInteger(question.correct), `${label}: 正解は整数である必要があります`);
  assert(question.correct >= 0 && question.correct <= max, `${label}: 正解が範囲外です`);
  assert(question.prompt.length > 0, `${label}: 問題文が空です`);
  assert(question.hint.length > 0, `${label}: ヒントが空です`);
  assert(question.explain.length > 0, `${label}: 解説が空です`);
  if (['choice', 'circuit', 'landing'].includes(question.kind)) {
    assert(question.answers.includes(question.correct), `${label}: 選択肢に正解がありません`);
    assert.equal(new Set(question.answers).size, question.answers.length, `${label}: 選択肢が重複しています`);
  }
  if (question.kind === 'landing') assert.equal(question.answers.length, 3, `${label}: 着地点は3択である必要があります`);
}

function assertSubtractionMath(question, label) {
  const math = question.math;
  assert(math, `${label}: 計算メタデータがありません`);
  if (math.kind === 'subtract') {
    assert(Number.isInteger(math.a) && Number.isInteger(math.b), `${label}: 引き算の値が整数ではありません`);
    assert(math.a >= math.b && math.b >= 0, `${label}: 負の答えになる引き算です`);
    assert.equal(question.correct, math.a - math.b, `${label}: 引き算の正解が一致しません`);
    return;
  }
  if (math.kind === 'bond') {
    assert([5, 7, 10].includes(math.target), `${label}: 数の分解の目標が不正です`);
    assert.equal(question.correct, math.target - math.known, `${label}: 数の分解の正解が一致しません`);
    return;
  }
  assert.equal(math.kind, 'sequence', `${label}: 未知の計算種別です`);
  let value = math.values[0];
  math.ops.forEach((op, index) => {
    value = op === '-' ? value - math.values[index + 1] : value + math.values[index + 1];
    assert(value >= 0 && value <= 20, `${label}: 途中の答えが0〜20の外です`);
  });
  assert.equal(question.correct, value, `${label}: 3数計算の正解が一致しません`);
}

const { game, appElement } = createHarness();
assert(game, 'テスト用APIが公開されませんでした');
assert.deepEqual(Array.from(game.ADDITION_STAGES, stage => stage.id), ['garden','pairs','delivery','numbers','gate','lanterns','blocks','kitchen','circuit','lift','core'], '既存の足し算ステージIDが変わっています');
assert.equal(game.ADDITION_STAGES.length, 11, '足し算は11ステージ必要です');
assert.equal(game.SUBTRACTION_STAGES.length, 11, '引き算は11ステージ必要です');
assert.equal(new Set([...game.ADDITION_STAGES, ...game.SUBTRACTION_STAGES].map(stage => stage.id)).size, 22, 'ステージIDが重複しています');

let generated = 0;
for (const [islandId, island] of Object.entries(game.ISLANDS)) {
  const borrowStrategies = new Set();
  const hundredModes = new Set();
  for (let stageIndex = 0; stageIndex < island.stages.length; stageIndex++) {
    for (let sample = 0; sample < 40; sample++) {
      for (let round = 0; round < 8; round++) {
        const question = game.buildQuestion(islandId, stageIndex, round);
        const label = `${islandId} stage ${stageIndex + 1}`;
        assertBaseQuestion(question, label, islandId === 'addition' ? 20 : 100);
        generated++;
        if (islandId === 'addition') {
          if ([0, 2, 3, 4].includes(stageIndex)) assert(question.correct <= 10, `${label}: 10を超えています`);
          if (stageIndex === 5) assert(question.correct >= 11 && question.correct <= 20, `${label}: 11〜20の外です`);
          if ([6, 7, 8].includes(stageIndex)) assert(question.correct <= 20, `${label}: 20を超えています`);
          if (stageIndex === 9) assert(question.correct <= 18, `${label}: 18を超えています`);
          continue;
        }

        assertSubtractionMath(question, label);
        if (stageIndex === 0) assert.equal(question.math.kind, 'bond', `${label}: 数の分解ではありません`);
        if (stageIndex === 1) assert.equal(question.visual?.type, 'remove', `${label}: 取り去る絵がありません`);
        if (stageIndex === 2) assert(question.math.b === 0 || question.math.b === question.math.a, `${label}: 0または全部を引く問題ではありません`);
        if (stageIndex === 3) assert(question.math.kind === 'subtract' && question.math.a <= 10, `${label}: 10までの引き算ではありません`);
        if (stageIndex === 5 && question.math.mode === 'no-borrow-20') {
          assert(question.math.a >= 11 && question.math.a <= 19, `${label}: 20までの値が不正です`);
          assert(question.math.b <= question.math.a % 10, `${label}: この段階で繰り下がっています`);
        }
        if (stageIndex === 6) assert.equal(question.math.kind, 'sequence', `${label}: 3数計算ではありません`);
        if (stageIndex === 7) {
          assert.equal(question.math.mode, 'borrow', `${label}: 繰り下がりではありません`);
          assert(question.math.b > question.math.a % 10, `${label}: 10をまたいでいません`);
          assert.equal(question.visual?.type, 'breakten', `${label}: 10の分解図がありません`);
          borrowStrategies.add(question.math.strategy);
        }
        if (stageIndex === 8) {
          assert.equal(question.kind, 'landing', `${label}: 着地操作ではありません`);
          assert.equal(question.visual?.type, 'backtrack', `${label}: 戻る数直線がありません`);
        }
        if (stageIndex === 9) {
          hundredModes.add(question.math.mode);
          if (question.math.mode === 'tens') {
            assert.equal(question.math.a % 10, 0, `${label}: 引かれる数が10の倍数ではありません`);
            assert.equal(question.math.b % 10, 0, `${label}: 引く数が10の倍数ではありません`);
          } else {
            assert.equal(question.math.mode, 'no-borrow-100', `${label}: 100までの出題種別が不正です`);
            assert(question.math.b <= question.math.a % 10, `${label}: 100までの段階で意図せず繰り下がっています`);
          }
        }
      }
    }
  }
  if (islandId === 'subtraction') {
    assert.deepEqual([...borrowStrategies].sort(), ['make-ten', 'ten-first'], '繰り下がりの2つの考え方が両方出題されません');
    assert.deepEqual([...hundredModes].sort(), ['no-borrow-100', 'tens'], '100までの2種類の問題が両方出題されません');
  }
}
assert.equal(generated, 7040, '生成問題数が想定と違います');

function clearIsland(islandId) {
  const harness = createHarness();
  const g = harness.game;
  const stages = g.ISLANDS[islandId].stages;
  for (let stageIndex = 0; stageIndex < stages.length; stageIndex++) {
    assert(g.isUnlocked(stageIndex, islandId), `${islandId} stage ${stageIndex + 1}: 前ステージ完了後に解放されません`);
    if (stageIndex + 1 < stages.length) assert(!g.isUnlocked(stageIndex + 1, islandId), `${islandId} stage ${stageIndex + 2}: 早く解放されています`);
    g.startStage(stageIndex, islandId);
    assert.equal(g.getSession().islandId, islandId, 'セッションの島が一致しません');
    assert.equal(g.getSession().questions.length, 8, '問題数が8ではありません');
    for (let round = 0; round < 8; round++) {
      const current = g.getSession().questions[g.getSession().cursor];
      g.handleAnswer(current.correct);
      assert.equal(current.feedback?.action, 'next', '正解後に次へ進めません');
      g.nextQuestion();
    }
    assert.equal(g.getUi().result.islandId, islandId, '結果画面の島が一致しません');
    assert.equal(g.getUi().result.cleared, true, '8問正解でクリアになりません');
  }
  assert.equal(g.clearedCount(islandId), 11, `${islandId}: 全ステージを完了できません`);
  assert.equal(stages.filter(stage => g.getState().parts[stage.id]).length, 11, `${islandId}: 全パーツを獲得できません`);
  assert.equal(g.totalMarks(islandId), 33, `${islandId}: 満点の印が33個になりません`);
  assert(g.getState().history.every(item => item.islandId === islandId), `${islandId}: 履歴の島が不正です`);
  return harness;
}

const additionClear = clearIsland('addition');
const subtractionClear = clearIsland('subtraction');
assert.equal(additionClear.game.clearedCount('subtraction'), 0, '足し算の進捗が引き算へ混ざっています');
assert.equal(subtractionClear.game.clearedCount('addition'), 0, '引き算の進捗が足し算へ混ざっています');

const retryHarness = createHarness();
retryHarness.game.startStage(0, 'addition');
const retrySession = retryHarness.game.getSession();
const retryQuestion = retrySession.questions[0];
const wrongAnswer = retryQuestion.correct === 10 ? 9 : retryQuestion.correct + 1;
retryHarness.game.handleAnswer(wrongAnswer);
assert.equal(retryQuestion.feedback?.kind, 'hint', '最初の不正解でヒントが表示されません');
retryQuestion.feedback = null;
retryQuestion.showHint = true;
retryHarness.game.handleAnswer(retryQuestion.correct);
assert.equal(retryQuestion.feedback?.kind, 'recovered', 'ヒント後の正解が再挑戦として扱われません');
assert.equal(retrySession.correct, 0, '再回答の正解が最初の正解数に加算されています');

const crossHarness = createHarness();
assert(crossHarness.game.isUnlocked(0, 'addition') && crossHarness.game.isUnlocked(0, 'subtraction'), '両島の最初のステージが開いていません');
assert(!crossHarness.game.isUnlocked(1, 'addition') && !crossHarness.game.isUnlocked(1, 'subtraction'), '2番目のステージが早く開いています');
crossHarness.game.startStage(0, 'addition');
for (let i = 0; i < 8; i++) { const q=crossHarness.game.getSession().questions[crossHarness.game.getSession().cursor]; crossHarness.game.handleAnswer(q.correct); crossHarness.game.nextQuestion(); }
assert(crossHarness.game.isUnlocked(1, 'addition'), '足し算の次ステージが開きません');
assert(!crossHarness.game.isUnlocked(1, 'subtraction'), '足し算の完了で引き算が開いています');

const legacyState = {
  version: 1,
  introSeen: true,
  workshopName: 'テスト',
  progress: { garden:{ cleared:true, stars:2, bestScore:7 } },
  parts: { garden:true },
  moods: { garden:'fun' },
  settings: { sound:false, motion:true },
  stats: { totalAnswers:12, correctAnswers:10, totalSeconds:45, bestChain:4 },
  history: [{ stage:'garden', score:7, stars:2, cleared:true, seconds:20, at:'2026-01-01T00:00:00.000Z' }]
};
const migrated = createHarness({ savedRaw: legacyState });
const migratedState = migrated.game.getState();
assert.equal(migratedState.version, 2, '旧データがversion 2へ移行されません');
assert.equal(migratedState.lastIsland, 'addition', '旧データの開始島が足し算ではありません');
assert.equal(migratedState.workshopName, 'テスト', '工房名が移行されません');
assert.equal(migratedState.progress.garden.stars, 2, '足し算の進捗が移行されません');
assert.equal(migratedState.islandStats.addition.totalAnswers, 12, '旧統計が足し算へ移行されません');
assert.equal(migratedState.islandStats.subtraction.totalAnswers, 0, '引き算の初期統計が不正です');
assert.equal(migratedState.history[0].islandId, 'addition', '旧履歴に島IDが補完されません');
assert(migrated.game.isUnlocked(1, 'addition'), '移行後に足し算の次ステージが開きません');
assert(!migrated.game.isUnlocked(1, 'subtraction'), '移行後に引き算の次ステージが開いています');
assert.equal(JSON.parse(migrated.storage.get('lumina_state_v1')).version, 2, '移行後のデータが保存されません');

const longHistory = { ...legacyState, history:Array.from({length:200},(_,i)=>({stage:'garden',score:i%9,at:String(i)})) };
assert.equal(createHarness({savedRaw:longHistory}).game.getState().history.length, 160, '履歴上限が160件ではありません');
assert.equal(createHarness({savedRaw:'{broken'}).game.getState().version, 2, '壊れた保存データから復旧できません');

assert(appElement.innerHTML.includes('data-action="install-app"'), '通常表示にiPad追加ボタンがありません');
assert(!createHarness({standalone:true}).appElement.innerHTML.includes('data-action="install-app"'), 'iPadアプリ表示でも追加ボタンが残っています');
assert(createHarness({displayMode:true}).game.isStandalone(), 'display-mode standaloneを検出できません');

for (const pattern of [
  /viewport-fit=cover/,
  /apple-mobile-web-app-capable" content="yes/,
  /apple-mobile-web-app-status-bar-style/,
  /apple-mobile-web-app-title/,
  /mobile-web-app-capable" content="yes/,
  /apple-touch-icon/,
  /safe-area-inset-top/,
  /safe-area-inset-right/,
  /safe-area-inset-bottom/,
  /safe-area-inset-left/,
  /100dvh/,
  /touch-action:\s*manipulation/,
  /overscroll-behavior-y/,
  /beforeinstallprompt/,
  /appinstalled/,
  /ホーム画面に追加/
]) assert(pattern.test(html), `iPad/PWA要件が不足しています: ${pattern}`);

const manifest = JSON.parse(fs.readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));
assert.equal(manifest.display, 'standalone', 'manifestがstandalone表示ではありません');
assert.equal(manifest.scope, './', 'manifestのscopeが不正です');
assert(!manifest.description.startsWith('足し算で'), 'manifestの説明が足し算限定のままです');
for (const size of [192,512]) {
  const icon = manifest.icons.find(item => item.src === `icon-${size}.png`);
  assert(icon, `${size}pxのPNGアイコンがありません`);
  const buffer = fs.readFileSync(new URL(`../icon-${size}.png`, import.meta.url));
  assert.equal(buffer.readUInt32BE(16), size, `${size}pxアイコンの横幅が不正です`);
  assert.equal(buffer.readUInt32BE(20), size, `${size}pxアイコンの高さが不正です`);
}

const sw = fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
assert(!/lumina-workshop-v1/.test(sw), 'Service Workerのキャッシュ名が旧版のままです');
assert(/event\.request\.mode\s*===\s*'navigate'/.test(sw), '画面遷移がnetwork-firstではありません');
assert(/SKIP_WAITING/.test(sw), '更新適用メッセージがありません');
const installSection = sw.slice(sw.indexOf("self.addEventListener('install'"), sw.indexOf("self.addEventListener('activate'"));
assert(!/self\.skipWaiting\(\)/.test(installSection), '更新確認なしでService Workerを切り替えています');
assert(/keys\.filter/.test(sw), '旧キャッシュの削除処理がありません');

console.log('v12 smoke test: 22 stages / 7,040 generated questions / addition+subtraction full clear / v1 migration / iPad PWA checks OK');
