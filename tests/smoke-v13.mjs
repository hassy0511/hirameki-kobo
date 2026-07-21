import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const rootUrl = new URL('../', import.meta.url);
const coreSource = fs.readFileSync(new URL('game-core.js', rootUrl), 'utf8');
const appSource = fs.readFileSync(new URL('app.js', rootUrl), 'utf8');
const html = fs.readFileSync(new URL('index.html', rootUrl), 'utf8');
const css = fs.readFileSync(new URL('styles.css', rootUrl), 'utf8');

new vm.Script(coreSource, { filename: 'game-core.js' });
new vm.Script(appSource, { filename: 'app.js' });

function createCore() {
  const sandbox = {};
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  new vm.Script(coreSource, { filename: 'game-core.js' }).runInContext(sandbox);
  return sandbox.HiramekiCore;
}

const core = createCore();
assert(core, 'HiramekiCoreが公開されませんでした');
assert.equal(core.STATE_VERSION, 3, '保存データのversionは3である必要があります');
assert.equal(core.LINE_ORDER.length, 6, '学習ラインは6本必要です');
assert.deepEqual(Array.from(core.LINE_ORDER), ['number', 'addition', 'subtraction', 'measure', 'shape', 'solve'], '学習ラインの順序が不正です');

const allStages = core.LINE_ORDER.flatMap(lineId => Array.from(core.LINES[lineId].stages));
assert.equal(allStages.length, 66, '全ステージ数は66である必要があります');
assert.equal(new Set(allStages.map(stage => stage.id)).size, 66, 'ステージIDが重複しています');
assert(allStages.every(stage => stage.canonicalSkillId && stage.action && stage.part), 'ステージ定義に学習ID・操作・パーツが必要です');
for (const lineId of core.LINE_ORDER) {
  assert.equal(core.LINES[lineId].stages.length, 11, lineId + ': 11ステージ必要です');
}
assert.deepEqual(
  Array.from(core.ADDITION_STAGES, stage => stage.id),
  ['garden', 'pairs', 'delivery', 'numbers', 'gate', 'lanterns', 'blocks', 'kitchen', 'circuit', 'lift', 'core'],
  '既存の足し算進捗IDが変わっています'
);
assert.deepEqual(
  Array.from(core.SUBTRACTION_STAGES, stage => stage.id),
  ['sub_bonds', 'sub_remove', 'sub_zero', 'sub_gear', 'sub_gate', 'sub_teens', 'sub_sequence', 'sub_bridge', 'sub_route', 'sub_meter', 'sub_core'],
  '既存の引き算進捗IDが変わっています'
);

const knownKinds = new Set(['choice', 'sort', 'tap', 'remove', 'slider', 'route', 'order', 'clock', 'select', 'keypad', 'input']);
let generated = 0;
const kindsByLine = {};
const storyByLine = {};

function validateMath(question, label) {
  if (!question.math) return;
  const math = question.math;
  if (math.kind === 'add') {
    assert.equal(math.result, math.a + math.b, label + ': 足し算メタデータが不正です');
  } else if (math.kind === 'subtract') {
    assert(math.a >= math.b, label + ': 負の答えになる引き算です');
    assert.equal(math.result, math.a - math.b, label + ': 引き算メタデータが不正です');
  } else if (math.kind === 'bond') {
    assert.equal(math.result, math.target - math.known, label + ': 数の分解が不正です');
  } else if (math.kind === 'sequence') {
    let value = math.values[0];
    math.ops.forEach((op, index) => {
      value = op === '+' ? value + math.values[index + 1] : value - math.values[index + 1];
      assert(value >= 0 && value <= 20, label + ': 3数計算の途中値が範囲外です');
    });
    assert.equal(math.result, value, label + ': 3数計算の答えが不正です');
  } else {
    assert.fail(label + ': 未知の計算メタデータです ' + math.kind);
  }
}

for (const lineId of core.LINE_ORDER) {
  kindsByLine[lineId] = new Set();
  storyByLine[lineId] = 0;
  for (let stageIndex = 0; stageIndex < 11; stageIndex += 1) {
    for (let sample = 0; sample < 12; sample += 1) {
      const pack = core.makeStageQuestions(lineId, stageIndex, { seed: 100000 + stageIndex * 100 + sample });
      assert.equal(pack.questions.length, 8, lineId + ' stage ' + (stageIndex + 1) + ': 8問必要です');
      assert.equal(new Set(pack.questions.map(question => question.signature)).size, 8, lineId + ' stage ' + (stageIndex + 1) + ': 同一プレイ内で問題が重複しています');
      for (const question of pack.questions) {
        const label = lineId + ' stage ' + (stageIndex + 1);
        generated += 1;
        kindsByLine[lineId].add(question.kind);
        if (question.story) storyByLine[lineId] += 1;
        assert(knownKinds.has(question.kind), label + ': 未知の操作種別です ' + question.kind);
        assert(question.prompt && question.hint && question.explain, label + ': 問題文・ヒント・解説が不足しています');
        assert(question.canonicalSkillId, label + ': canonicalSkillIdがありません');
        assert(question.signature && typeof question.signature === 'string', label + ': semantic signatureがありません');
        if (['choice', 'route', 'sort'].includes(question.kind)) {
          assert(question.options.length >= 2, label + ': 選択肢が不足しています');
          assert(question.options.some(option => core.answerEquals(question.correct, core.optionValue(option))), label + ': 選択肢に正解がありません');
          assert.equal(new Set(question.options.map(option => String(core.optionValue(option)))).size, question.options.length, label + ': 選択肢が重複しています');
        }
        if (question.kind === 'clock') assert(/^(?:[1-9]|1[0-2]):[0-5][0-9]$/.test(question.correct), label + ': 時計の答え形式が不正です');
        if (stageIndex === 4 || stageIndex === 10) assert.equal(question.checkpoint, true, label + ': 確認ステージのタグがありません');
        validateMath(question, label);
      }
    }
  }
  assert(kindsByLine[lineId].size >= 3, lineId + ': 操作形式が少なすぎます');
}
assert.equal(generated, 6336, '大量生成テストの問題数が想定と違います');
assert(storyByLine.addition > 0 && storyByLine.subtraction > 0 && storyByLine.solve > 0, '文章・場面問題が不足しています');

const randomA = core.makeStageQuestions('addition', 9, { seed: 111 }).questions.map(question => question.signature);
const randomB = core.makeStageQuestions('addition', 9, { seed: 222 }).questions.map(question => question.signature);
assert.notDeepEqual(randomA, randomB, 'seedが変わっても問題セットが同じです');
const randomC = core.makeStageQuestions('addition', 9, { seed: 333, exclude: randomA }).questions.map(question => question.signature);
assert.equal(randomC.filter(signature => randomA.includes(signature)).length, 0, '直近問題が再出題されています');

for (const lineId of core.LINE_ORDER) {
  const rushA = core.makeTimeAttackQuestions(lineId, { seed: 5000 }).questions;
  const rushB = core.makeTimeAttackQuestions(lineId, { seed: 6000 }).questions;
  assert.equal(rushA.length, 12, lineId + ': タイムアタックは12問必要です');
  assert(rushA.every(question => question.rush), lineId + ': タイムアタックタグがありません');
  assert.notDeepEqual(
    rushA.map(question => question.signature),
    rushB.map(question => question.signature),
    lineId + ': タイムアタックが毎回同じです'
  );
}

const initialState = core.createDefaultState();
assert.equal(Object.keys(initialState.lineStats).length, 6, '6ライン分の統計初期値が必要です');
assert.equal(Object.keys(initialState.timeAttack).length, 6, '6ライン分のタイムアタック記録が必要です');
for (const lineId of core.LINE_ORDER) {
  assert(core.isUnlocked(initialState, 0, lineId), lineId + ': 最初のステージが開いていません');
  assert(!core.isUnlocked(initialState, 1, lineId), lineId + ': 2番目のステージが早く開いています');
  assert(!core.isLineComplete(initialState, lineId), lineId + ': 未プレイなのにライン完了扱いです');
}

const legacyV1 = {
  version: 1,
  introSeen: true,
  workshopName: 'テスト',
  progress: { garden: { cleared: true, stars: 2, bestScore: 7 } },
  parts: { garden: true },
  moods: { garden: 'fun' },
  settings: { sound: false, motion: true },
  stats: { totalAnswers: 12, correctAnswers: 10, totalSeconds: 45, bestChain: 4 },
  history: [{ stage: 'garden', score: 7, stars: 2, cleared: true, seconds: 20, at: '2026-01-01T00:00:00.000Z' }]
};
const migratedV1 = core.migrateState(legacyV1);
assert.equal(migratedV1.version, 3, 'v1からv3へ移行されません');
assert.equal(migratedV1.lastLine, 'addition', '旧データの開始ラインは足し算である必要があります');
assert.equal(migratedV1.progress.garden.stars, 2, '旧足し算進捗が移行されません');
assert.equal(migratedV1.lineStats.addition.totalAnswers, 12, '旧統計が足し算へ移行されません');
assert.equal(migratedV1.history[0].lineId, 'addition', '旧履歴へラインIDが補完されません');

const legacyV2 = {
  version: 2,
  introSeen: true,
  lastIsland: 'subtraction',
  progress: { sub_bonds: { cleared: true, stars: 3 } },
  islandStats: { subtraction: { totalAnswers: 8, correctAnswers: 8, totalSeconds: 20, bestChain: 8 } },
  islandIntros: { subtraction: true },
  history: [{ stage: 'sub_bonds', islandId: 'subtraction' }]
};
const migratedV2 = core.migrateState(legacyV2);
assert.equal(migratedV2.lastLine, 'subtraction', 'v2の選択ラインが移行されません');
assert.equal(migratedV2.progress.sub_bonds.stars, 3, 'v2の引き算進捗が移行されません');
assert.equal(migratedV2.lineStats.subtraction.correctAnswers, 8, 'v2のライン統計が移行されません');

function createAppHarness(savedRaw = null) {
  const appElement = { innerHTML: '' };
  const toastElement = { textContent: '', classList: { add() {}, remove() {} } };
  const storage = new Map();
  if (savedRaw !== null) storage.set(core.STORE_KEY, typeof savedRaw === 'string' ? savedRaw : JSON.stringify(savedRaw));
  let seedCounter = 700000;
  const sandbox = {
    console,
    Date,
    Math,
    JSON,
    Number,
    String,
    Array,
    Object,
    Set,
    Map,
    Uint32Array,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    requestAnimationFrame(callback) { callback(); },
    Blob: class BlobMock {},
    URL: { createObjectURL() { return 'blob:test'; }, revokeObjectURL() {} },
    localStorage: {
      getItem(key) { return storage.has(key) ? storage.get(key) : null; },
      setItem(key, value) { storage.set(key, String(value)); },
      removeItem(key) { storage.delete(key); }
    },
    document: {
      body: { classList: { toggle() {} } },
      visibilityState: 'visible',
      getElementById(id) { return id === 'app' ? appElement : id === 'toast' ? toastElement : null; },
      querySelector() { return null; },
      createElement() { return { click() {}, href: '', download: '' }; },
      addEventListener() {}
    },
    navigator: {},
    location: { protocol: 'file:', reload() {} },
    scrollTo() {},
    matchMedia() { return { matches: false }; },
    addEventListener() {},
    crypto: { getRandomValues(values) { values[0] = seedCounter; seedCounter += 1; return values; } }
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  new vm.Script(coreSource, { filename: 'game-core.js' }).runInContext(sandbox);
  new vm.Script(appSource, { filename: 'app.js' }).runInContext(sandbox);
  return { app: sandbox.HiramekiApp, appElement, storage };
}

const harness = createAppHarness();
assert(harness.appElement.innerHTML.includes('6つの べんきょう'), 'ホームに6つの学習内容の説明がありません');
assert(harness.appElement.innerHTML.includes('<h3>かず</h3>'), 'かずの学習がホームにありません');
assert(harness.appElement.innerHTML.includes('おはなし・グラフ'), 'おはなし・グラフの学習がホームにありません');
assert(harness.appElement.innerHTML.includes('全66ステージ') || harness.appElement.innerHTML.includes('66'), '全66ステージが表示されません');

for (const lineId of core.LINE_ORDER) {
  const line = harness.app.LINES[lineId];
  for (let stageIndex = 0; stageIndex < 11; stageIndex += 1) {
    assert(harness.app.isUnlocked(stageIndex, lineId), lineId + ' stage ' + (stageIndex + 1) + ': 順次解放されません');
    harness.app.startStage(stageIndex, lineId);
    assert.equal(harness.app.getSession().questions.length, 8, '通常ステージは8問必要です');
    for (let round = 0; round < 8; round += 1) {
      const question = harness.app.getSession().questions[harness.app.getSession().cursor];
      harness.app.handleAnswer(question.correct);
      harness.app.nextQuestion();
    }
  }
  assert.equal(harness.app.clearedCount(lineId), 11, lineId + ': 11ステージを完走できません');
  assert(core.isLineComplete(harness.app.getState(), lineId), lineId + ': 完走後にタイムアタックが解放されません');
}
assert.equal(Object.keys(harness.app.getState().progress).length, 66, '全66ステージの進捗が保存されません');
assert.equal(Object.keys(harness.app.getState().parts).length, 66, '全66パーツを獲得できません');
assert.equal(harness.app.totalMarks(), 198, '全66ステージ満点時は198印必要です');

harness.app.startTimeAttack('number');
assert.equal(harness.app.getSession().questions.length, 12, 'タイムアタックは12問必要です');
harness.app.beginTimeAttack();
for (let round = 0; round < 12; round += 1) {
  const question = harness.app.getSession().questions[harness.app.getSession().cursor];
  harness.app.handleAnswer(question.correct);
  harness.app.nextQuestion();
}
assert.equal(harness.app.getState().timeAttack.number.runs, 1, 'タイムアタック回数が保存されません');
assert(harness.app.getState().timeAttack.number.bestMs !== null, 'タイムアタックのベストが保存されません');

harness.app.startTimeAttack('number');
harness.app.beginTimeAttack();
let rushQuestion = harness.app.getSession().questions[0];
harness.app.handleAnswer('__wrong_answer__');
assert.equal(harness.app.getSession().timer.penaltyMs, 3000, 'ミス時に3秒加算されません');
rushQuestion.feedback = null;
harness.app.handleAnswer(rushQuestion.correct);
harness.app.nextQuestion();
for (let round = 1; round < 12; round += 1) {
  rushQuestion = harness.app.getSession().questions[harness.app.getSession().cursor];
  harness.app.handleAnswer(rushQuestion.correct);
  harness.app.nextQuestion();
}
assert.equal(harness.app.getState().timeAttack.number.runs, 2, '2回目のタイムアタックが保存されません');
assert.equal(harness.app.getState().timeAttack.number.lastMistakes, 1, 'タイムアタックのミス数が保存されません');
assert(harness.app.getState().timeAttack.number.lastMs >= 3000, '公式タイムに3秒加算されません');

for (const pattern of [
  /viewport-fit=cover/,
  /apple-mobile-web-app-capable" content="yes/,
  /apple-mobile-web-app-title/,
  /mobile-web-app-capable" content="yes/,
  /apple-touch-icon/,
  /styles\.css/,
  /game-core\.js/,
  /app\.js/
]) assert(pattern.test(html), 'index.htmlの要件が不足しています: ' + pattern);

for (const pattern of [
  /safe-area-inset-top/,
  /safe-area-inset-right/,
  /safe-area-inset-bottom/,
  /safe-area-inset-left/,
  /100dvh/,
  /touch-action:\s*manipulation/,
  /overscroll-behavior-y/,
  /prefers-reduced-motion/
]) assert(pattern.test(css), 'CSSのiPad・アクセシビリティ要件が不足しています: ' + pattern);

const manifest = JSON.parse(fs.readFileSync(new URL('manifest.json', rootUrl), 'utf8'));
assert.equal(manifest.display, 'standalone', 'manifestがstandalone表示ではありません');
assert.equal(manifest.scope, './', 'manifestのscopeが不正です');
assert(manifest.description.includes('132ステージ'), 'manifestに1・2年生の全132ステージが反映されていません');
for (const size of [192, 512]) {
  const icon = manifest.icons.find(item => item.src === 'icon-' + size + '.png');
  assert(icon, size + 'pxのPNGアイコンがありません');
  const buffer = fs.readFileSync(new URL('icon-' + size + '.png', rootUrl));
  assert.equal(buffer.readUInt32BE(16), size, size + 'pxアイコンの横幅が不正です');
  assert.equal(buffer.readUInt32BE(20), size, size + 'pxアイコンの高さが不正です');
}

const sw = fs.readFileSync(new URL('sw.js', rootUrl), 'utf8');
for (const asset of ['styles.css', 'game-core.js', 'audio-core.js', 'app.js']) assert(sw.includes(asset), 'Service Workerに' + asset + 'がありません');
assert(/event\.request\.mode\s*===\s*'navigate'/.test(sw), '画面遷移がnetwork-firstではありません');
assert(/SKIP_WAITING/.test(sw), '更新適用メッセージがありません');
assert(/startsWith\(CACHE_PREFIX\)/.test(sw), '旧キャッシュ削除が工房アプリだけに限定されていません');
const installSection = sw.slice(sw.indexOf("self.addEventListener('install'"), sw.indexOf("self.addEventListener('activate'"));
assert(!/self\.skipWaiting\(\)/.test(installSection), '確認なしでService Workerを切り替えています');

assert(!/たしざん島|ひきざん島|おなじ島|そらのくも|ダジャレ|だじゃれ/.test(html + appSource), '旧世界観の表示文言が残っています');

console.log('v13 smoke test: 6 lines / 66 stages / 6,336 generated questions / random history avoidance / all-stage clear / 12-question time attack / v1-v2 migration / PWA checks OK');
