import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const rootUrl = new URL('../', import.meta.url);
const sourceFiles = [
  'game-core.js',
  'grade2-curriculum.js',
  'grade2-runtime-arithmetic.js',
  'grade2-runtime-world.js',
  'course-core.js',
  'story-core.js',
  'audio-core.js',
  'app.js'
];
const sources = {};

for (const filename of sourceFiles) {
  const url = new URL(filename, rootUrl);
  assert(fs.existsSync(url), filename + ' がありません。G2統合物をすべて配置してください');
  sources[filename] = fs.readFileSync(url, 'utf8');
  new vm.Script(sources[filename], { filename });
}

const html = fs.readFileSync(new URL('index.html', rootUrl), 'utf8');
const sw = fs.readFileSync(new URL('sw.js', rootUrl), 'utf8');
const manifest = JSON.parse(fs.readFileSync(new URL('manifest.json', rootUrl), 'utf8'));

function loadRuntime() {
  const sandbox = { console };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  for (const filename of sourceFiles.slice(0, -1)) {
    new vm.Script(sources[filename], { filename }).runInContext(sandbox);
  }
  return sandbox;
}

const runtime = loadRuntime();
const g1 = runtime.HiramekiCore;
const g2 = runtime.HiramekiGrade2Curriculum;
const arithmetic = runtime.HiramekiGrade2ArithmeticRuntime;
const world = runtime.HiramekiGrade2WorldRuntime;
const courses = runtime.HiramekiCourses;
const story = runtime.HiramekiStory;

assert(g1, 'HiramekiCore が公開されませんでした');
assert(g2, 'HiramekiGrade2Curriculum が公開されませんでした');
assert(arithmetic, 'HiramekiGrade2ArithmeticRuntime が公開されませんでした');
assert(world, 'HiramekiGrade2WorldRuntime が公開されませんでした');
assert(courses, 'HiramekiCourses が公開されませんでした');
assert(story, 'HiramekiStory が公開されませんでした');
assert.equal(courses.STATE_VERSION, 4, '統合保存データは version 4 である必要があります');
assert.deepEqual(Array.from(courses.COURSE_ORDER), ['g1', 'g2'], '公開コースはG1・G2の順である必要があります');
assert.equal(courses.validate().ok, true, courses.validate().errors.join('\n'));
assert.equal(g2.validate().ok, true, g2.validate().errors.join('\n'));
assert.equal(arithmetic.validate().ok, true, arithmetic.validate().errors.join('\n'));
assert.equal(world.validate().ok, true, world.validate().errors.join('\n'));
assert.equal(story.validate(courses.COURSES).ok, true, story.validate(courses.COURSES).errors.join('\n'));

const stagesByCourse = {};
for (const courseId of courses.COURSE_ORDER) {
  const course = courses.courseFor(courseId);
  assert.equal(course.lineOrder.length, 6, courseId + ': 学習ラインは6本必要です');
  stagesByCourse[courseId] = course.lineOrder.flatMap(lineId => Array.from(course.lines[lineId].stages));
  assert.equal(stagesByCourse[courseId].length, 66, courseId + ': 66ステージ必要です');
  assert.equal(new Set(stagesByCourse[courseId].map(stage => stage.id)).size, 66, courseId + ': ステージIDが重複しています');
  for (const lineId of course.lineOrder) {
    assert.equal(course.lines[lineId].stages.length, 11, courseId + '/' + lineId + ': 11ステージ必要です');
  }
}
assert.equal(stagesByCourse.g1.length + stagesByCourse.g2.length, 132, 'G1/G2の合計は132ステージ必要です');
assert.equal(new Set(stagesByCourse.g1.concat(stagesByCourse.g2).map(stage => stage.id)).size, 132, '学年をまたいでステージIDが重複しています');

const appKinds = new Set(['choice', 'route', 'sort', 'tap', 'remove', 'select', 'order', 'slider', 'clock', 'input', 'keypad']);
const optionKinds = new Set(['choice', 'route', 'sort']);
const generationSeeds = [14001, 28002, 42003, 56004];
let generatedQuestions = 0;

function optionValue(option) {
  return g1.optionValue(option);
}

function validateQuestion(question, lineId, stage, stageIndex, label, expectedCheckpoint = stageIndex === 4 || stageIndex === 10) {
  assert(appKinds.has(question.kind), label + ': アプリ未対応の操作種別です ' + question.kind);
  assert.equal(question.gradeId, 'g2', label + ': gradeId が不正です');
  assert.equal(question.courseId, 'g2', label + ': courseId が不正です');
  assert.equal(question.lineId, lineId, label + ': lineId が不正です');
  assert.equal(question.stageId, stage.id, label + ': stageId が不正です');
  assert.equal(question.canonicalSkillId, stage.canonicalSkillId, label + ': canonicalSkillId が不正です');
  assert.equal(question.checkpoint, expectedCheckpoint, label + ': 確認ステージタグが不正です');
  assert(question.prompt && question.instruction && question.hint && question.explain, label + ': 問題文・操作指示・ヒント・解説が不足しています');
  assert(question.visual && question.visual.type, label + ': アクション用の visual がありません');
  assert(question.signature && typeof question.signature === 'string', label + ': semantic signature がありません');
  assert.notEqual(question.correct, undefined, label + ': 正解値がありません');

  if (optionKinds.has(question.kind)) {
    assert(Array.isArray(question.options) && question.options.length >= 2, label + ': 選択肢が不足しています');
    assert(
      question.options.some(option => g1.answerEquals(question.correct, optionValue(option))),
      label + ': 選択肢に正解がありません'
    );
    assert.equal(
      new Set(question.options.map(option => String(optionValue(option)))).size,
      question.options.length,
      label + ': 選択肢が重複しています'
    );
  }
  if (question.kind === 'order') {
    assert(Array.isArray(question.options) && question.options.length >= 2, label + ': 並べ替え候補が不足しています');
    assert.equal(typeof question.correct, 'string', label + ': 並べ替えの正解は文字列である必要があります');
  }
  if (question.kind === 'clock') {
    assert(/^(?:[1-9]|1[0-2]):[0-5][0-9]$/.test(String(question.correct)), label + ': 時計の正解形式が不正です');
  }
}

const g2Course = courses.courseFor('g2');
for (const lineId of g2Course.lineOrder) {
  const line = g2Course.lines[lineId];
  for (let stageIndex = 0; stageIndex < line.stages.length; stageIndex += 1) {
    const stage = line.stages[stageIndex];
    const signaturePacks = [];
    for (const seed of generationSeeds) {
      const pack = courses.makeStageQuestions('g2', lineId, stageIndex, { seed: seed + stageIndex * 101 });
      const prefix = 'g2/' + lineId + '/' + stage.id + '/seed-' + seed;
      assert.equal(pack.gradeId, 'g2', prefix + ': packのgradeIdが不正です');
      assert.equal(pack.lineId, lineId, prefix + ': packのlineIdが不正です');
      assert.equal(pack.stageId, stage.id, prefix + ': packのstageIdが不正です');
      assert.equal(pack.questions.length, 8, prefix + ': 通常ステージは8問必要です');
      assert.equal(new Set(pack.questions.map(question => question.signature)).size, 8, prefix + ': 同一プレイ内で問題が重複しています');
      const storyCount = pack.questions.filter(question => question.story).length;
      const bareCount = pack.questions.filter(question => question.bareCalculation || question.formulaOnly).length;
      assert(storyCount >= 1 && storyCount <= 2, prefix + ': おはなし問題は1〜2問必要です（実際 ' + storyCount + '問）');
      assert(bareCount <= 1, prefix + ': 式だけの問題は最大1問です（実際 ' + bareCount + '問）');
      pack.questions.forEach((question, questionIndex) => {
        generatedQuestions += 1;
        validateQuestion(question, lineId, stage, stageIndex, prefix + '/q' + (questionIndex + 1));
      });
      signaturePacks.push(pack.questions.map(question => question.signature));
    }
    assert.notDeepEqual(signaturePacks[0], signaturePacks[1], 'g2/' + lineId + '/' + stage.id + ': seedが変わっても問題セットが同じです');
    assert(
      signaturePacks[0].filter((signature, index) => signature !== signaturePacks[1][index]).length >= 2,
      'g2/' + lineId + '/' + stage.id + ': ランダム差分が少なすぎます'
    );
    const excluded = courses.makeStageQuestions('g2', lineId, stageIndex, {
      seed: 990000 + stageIndex,
      exclude: signaturePacks[0]
    }).questions.map(question => question.signature);
    assert.equal(excluded.filter(signature => signaturePacks[0].includes(signature)).length, 0, 'g2/' + lineId + '/' + stage.id + ': 直近問題が再出題されています');
  }
}
assert.equal(generatedQuestions, 66 * generationSeeds.length * 8, 'G2大量生成テストの問題数が想定と違います');

for (const lineId of g2Course.lineOrder) {
  const first = courses.makeTimeAttackQuestions('g2', lineId, { seed: 77101 });
  const second = courses.makeTimeAttackQuestions('g2', lineId, { seed: 88202 });
  assert.equal(first.questions.length, 12, 'g2/' + lineId + ': タイムアタックは12問必要です');
  assert.equal(new Set(first.questions.map(question => question.signature)).size, 12, 'g2/' + lineId + ': タイムアタック内で問題が重複しています');
  assert(first.questions.every(question => question.rush && !question.checkpoint && !question.story), 'g2/' + lineId + ': タイムアタック用タグが不正です');
  first.questions.forEach((question, index) => {
    const stage = g2Course.lines[lineId].stages.find(item => item.id === question.stageId);
    assert(stage, 'g2/' + lineId + '/rush-' + index + ': 未知のstageIdです');
    validateQuestion(question, lineId, stage, stage.n - 1, 'g2/' + lineId + '/rush-' + index, false);
  });
  assert.notDeepEqual(
    first.questions.map(question => question.signature),
    second.questions.map(question => question.signature),
    'g2/' + lineId + ': タイムアタックが毎回同じです'
  );
}

function createAppHarness(options = {}) {
  const appElement = { innerHTML: '' };
  const toastElement = { textContent: '', classList: { add() {}, remove() {} } };
  const storage = options.storage || new Map();
  const writes = [];
  const clickListeners = [];
  if (Object.prototype.hasOwnProperty.call(options, 'savedRaw')) {
    storage.set(g1.STORE_KEY, typeof options.savedRaw === 'string' ? options.savedRaw : JSON.stringify(options.savedRaw));
  }
  let seedCounter = options.seedStart || 700000;
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
    requestAnimationFrame(callback) { callback(); return 1; },
    Blob: class BlobMock {},
    URL: { createObjectURL() { return 'blob:test'; }, revokeObjectURL() {} },
    localStorage: {
      getItem(key) { return storage.has(key) ? storage.get(key) : null; },
      setItem(key, value) { storage.set(key, String(value)); writes.push([key, String(value)]); },
      removeItem(key) { storage.delete(key); }
    },
    document: {
      body: { classList: { toggle() {} } },
      visibilityState: 'visible',
      getElementById(id) {
        if (id === 'app') return appElement;
        if (id === 'toast') return toastElement;
        return null;
      },
      querySelector() { return null; },
      createElement() { return { click() {}, href: '', download: '' }; },
      addEventListener(type, callback) { if (type === 'click') clickListeners.push(callback); }
    },
    navigator: {},
    location: { protocol: 'file:', reload() {} },
    scrollTo() {},
    matchMedia() { return { matches: false }; },
    addEventListener() {},
    crypto: {
      getRandomValues(values) {
        values[0] = seedCounter;
        seedCounter += 1;
        return values;
      }
    }
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  for (const filename of sourceFiles) new vm.Script(sources[filename], { filename }).runInContext(sandbox);

  function dispatchAction(action, dataset = {}) {
    const node = { dataset: Object.assign({ action }, dataset), disabled: false };
    const target = {
      closest(selector) { return selector === '[data-action]' ? node : null; }
    };
    assert(clickListeners.length, 'アプリのclickハンドラーが登録されていません');
    clickListeners[0]({ target });
  }

  return { app: sandbox.HiramekiApp, appElement, toastElement, storage, writes, dispatchAction };
}

const firstVisit = createAppHarness();
assert.equal(firstVisit.app.getUi().screen, 'courses', '初回はコース選択画面を土台にする必要があります');
assert(firstVisit.appElement.innerHTML.includes('小学1年生 算数'), '初回画面にG1コースがありません');
assert(firstVisit.appElement.innerHTML.includes('小学2年生 算数'), '初回画面にG2コースがありません');
assert(/data-course="g2"/.test(firstVisit.appElement.innerHTML), 'G2を直接選ぶUIがありません');
assert(firstVisit.appElement.innerHTML.includes('ルミナが とまった'), '初回ストーリー導入がありません');

const selectorState = courses.createDefaultState();
selectorState.introSeen = true;
selectorState.courseChosen = false;
selectorState.workshopName = '統合テスト';
selectorState.settings.storyRevision = story.STORY_VERSION;
const selector = createAppHarness({ savedRaw: selectorState, seedStart: 800000 });
assert.equal(selector.app.getUi().screen, 'courses', '導入後・未選択時はコース選択画面である必要があります');
selector.dispatchAction('choose-course', { course: 'g2' });
assert.equal(selector.app.getActiveCourseId(), 'g2', 'G2コースを直接選択できません');
assert.equal(selector.app.getUi().screen, 'home', 'G2選択後にG2ホームへ進めません');
assert.equal(selector.app.getUi().courseIntroStep, 0, 'G2初回の区画ストーリーが始まりません');
assert(selector.appElement.innerHTML.includes('ひろがり区画'), 'G2区画の目的が画面に表示されません');
selector.app.startStage(0, 'number');
assert.equal(selector.app.getSession().courseId, 'g2', 'G1を経由せずG2ステージを開始できません');
assert.equal(selector.app.getSession().questions.length, 8, 'G2直接開始時に8問生成されません');

const g2StoryState = courses.createDefaultState();
g2StoryState.introSeen = true;
g2StoryState.courseChosen = true;
g2StoryState.activeCourseId = 'g2';
g2StoryState.settings.storyRevision = story.STORY_VERSION;
g2StoryState.courses.g2.introSeen = true;
g2StoryState.courses.g2.storySeen[story.storyKey('course', 'g2', 'main')] = true;
for (const stage of g2Course.lines.number.stages.slice(0, 10)) {
  g2StoryState.courses.g2.progress[stage.id] = { cleared: true, stars: 3, bestScore: 8 };
  g2StoryState.courses.g2.parts[stage.id] = true;
}
const g2StoryHarness = createAppHarness({ savedRaw: g2StoryState, seedStart: 850000 });
g2StoryHarness.dispatchAction('open-line', { line: 'number' });
assert(!g2StoryHarness.appElement.innerHTML.includes('data-action="replay-line-story"'), 'G2設計図に未実装のライン物語ボタンが出ています');
g2StoryHarness.app.startStage(10, 'number');
for (let round = 0; round < 8; round += 1) {
  const question = g2StoryHarness.app.getSession().questions[g2StoryHarness.app.getSession().cursor];
  g2StoryHarness.app.handleAnswer(question.correct);
  g2StoryHarness.app.nextQuestion();
}
assert(g2StoryHarness.appElement.innerHTML.includes('タイムアタックが ひらきました'), 'G2ライン初完走でタイムアタック解放が伝わりません');

const playableState = courses.createDefaultState();
playableState.introSeen = true;
playableState.courseChosen = true;
playableState.activeCourseId = 'g2';
playableState.workshopName = '完走テスト';
playableState.settings.storyRevision = story.STORY_VERSION;
playableState.courses.g2.introSeen = true;
const completion = createAppHarness({ savedRaw: playableState, seedStart: 900000 });
assert.equal(completion.app.getActiveCourseId(), 'g2', '保存済みのG2選択が復元されません');

for (const lineId of g2Course.lineOrder) {
  for (let stageIndex = 0; stageIndex < 11; stageIndex += 1) {
    assert(completion.app.isUnlocked(stageIndex, lineId), 'g2/' + lineId + '/stage-' + (stageIndex + 1) + ': 順次解放されません');
    completion.app.startStage(stageIndex, lineId);
    const started = completion.app.getSession();
    assert(started, 'g2/' + lineId + '/stage-' + (stageIndex + 1) + ': セッションが開始されません');
    assert.equal(started.courseId, 'g2', 'g2/' + lineId + ': セッションのcourseIdが不正です');
    assert.equal(started.questions.length, 8, 'g2/' + lineId + ': 通常ステージは8問必要です');
    for (let round = 0; round < 8; round += 1) {
      const question = completion.app.getSession().questions[completion.app.getSession().cursor];
      completion.app.handleAnswer(question.correct);
      completion.app.nextQuestion();
    }
  }
  assert.equal(completion.app.clearedCount(lineId), 11, 'g2/' + lineId + ': 11ステージを完走できません');
  assert(courses.isLineComplete(completion.app.getState(), 'g2', lineId), 'g2/' + lineId + ': 完走後にライン完了になりません');
}

const completedG2 = completion.app.getState();
assert.equal(Object.keys(completedG2.progress).length, 66, 'G2全66ステージの進捗が保存されません');
assert.equal(Object.keys(completedG2.parts).length, 66, 'G2全66パーツを獲得できません');
assert.equal(completion.app.totalMarks(), 198, 'G2全66ステージ満点時は198印必要です');
assert(completedG2.history.every(item => item.gradeId === 'g2' && item.courseId === 'g2'), 'G2履歴に学年タグがありません');
assert.equal(Object.keys(completion.app.getRootState().courses.g1.progress).length, 0, 'G2完走でG1進捗が変化しました');

for (const lineId of g2Course.lineOrder) {
  completion.app.startTimeAttack(lineId);
  assert.equal(completion.app.getSession().questions.length, 12, 'g2/' + lineId + ': TAは12問必要です');
  assert(completion.app.getSession().questions.every(question => question.gradeId === 'g2' && question.courseId === 'g2' && question.rush), 'g2/' + lineId + ': TAタグが不正です');
  completion.app.beginTimeAttack();
  for (let round = 0; round < 12; round += 1) {
    const question = completion.app.getSession().questions[completion.app.getSession().cursor];
    completion.app.handleAnswer(question.correct);
    completion.app.nextQuestion();
  }
  assert.equal(completion.app.getState().timeAttack[lineId].runs, 1, 'g2/' + lineId + ': TA記録が保存されません');
  assert.notEqual(completion.app.getState().timeAttack[lineId].bestMs, null, 'g2/' + lineId + ': TAベストが保存されません');
}

const g2ProgressBeforeSwitch = JSON.stringify(completion.app.getRootState().courses.g2.progress);
assert(completion.app.activateCourse('g1'), 'G1へ切り替えられません');
assert.equal(completion.app.getActiveCourseId(), 'g1', 'G1切替が反映されません');
assert.equal(Object.keys(completion.app.getState().progress).length, 0, 'G2の進捗がG1へ混入しました');
completion.app.startStage(0, 'number');
for (let round = 0; round < 8; round += 1) {
  const question = completion.app.getSession().questions[completion.app.getSession().cursor];
  completion.app.handleAnswer(question.correct);
  completion.app.nextQuestion();
}
assert.equal(Object.keys(completion.app.getState().progress).length, 1, 'G1の進捗が記録されません');
assert(completion.app.getState().history.every(item => item.gradeId === 'g1' && item.courseId === 'g1'), 'G1履歴に学年タグがありません');
assert(completion.app.activateCourse('g2'), 'G2へ戻れません');
assert.equal(JSON.stringify(completion.app.getState().progress), g2ProgressBeforeSwitch, 'G2へ戻ったとき進捗が復元されません');
assert.equal(completion.app.totalMarks(), 198, 'G2へ戻ったとき印が復元されません');
completion.app.startStage(0, 'number');
const restarted = createAppHarness({ storage: completion.storage, seedStart: 950000 });
assert.equal(restarted.app.getActiveCourseId(), 'g2', '再起動後に最後のG2コースが復元されません');
assert.equal(Object.keys(restarted.app.getRootState().courses.g2.progress).length, 66, '再起動後にG2進捗が復元されません');
assert.equal(Object.keys(restarted.app.getRootState().courses.g1.progress).length, 1, '再起動後にG1進捗が復元されません');

const legacyV1 = {
  version: 1,
  introSeen: true,
  workshopName: '旧工房1',
  progress: { garden: { cleared: true, stars: 2, bestScore: 7 } },
  parts: { garden: true },
  settings: { sound: false, motion: true },
  stats: { totalAnswers: 12, correctAnswers: 10, totalSeconds: 45, bestChain: 4 },
  history: [{ stage: 'garden', score: 7, at: '2026-01-01T00:00:00.000Z' }]
};
const legacyV2 = {
  version: 2,
  introSeen: true,
  workshopName: '旧工房2',
  lastIsland: 'subtraction',
  progress: { sub_bonds: { cleared: true, stars: 3 } },
  islandStats: { subtraction: { totalAnswers: 8, correctAnswers: 8, totalSeconds: 20, bestChain: 8 } },
  islandIntros: { subtraction: true },
  history: [{ stage: 'sub_bonds', islandId: 'subtraction' }]
};
const legacyV3 = g1.createDefaultState();
const legacyG1Stage = g1.LINES.number.stages[0].id;
legacyV3.introSeen = true;
legacyV3.workshopName = '旧工房3';
legacyV3.progress[legacyG1Stage] = { cleared: true, stars: 1, bestScore: 6 };
legacyV3.parts[legacyG1Stage] = true;
legacyV3.history.push({ stage: legacyG1Stage, lineId: 'number' });

for (const [version, legacy, stageId] of [
  [1, legacyV1, 'garden'],
  [2, legacyV2, 'sub_bonds'],
  [3, legacyV3, legacyG1Stage]
]) {
  const migrated = courses.migrateState(legacy);
  assert.equal(migrated.version, 4, 'v' + version + ' から v4 へ移行されません');
  assert.equal(migrated.activeCourseId, 'g1', 'v' + version + ': 旧記録の所属はG1である必要があります');
  assert.equal(migrated.courseChosen, false, 'v' + version + ': 移行後は一度コース選択を表示する必要があります');
  assert(migrated.courses.g1.progress[stageId], 'v' + version + ': G1進捗が移行されません');
  assert.equal(Object.keys(migrated.courses.g2.progress).length, 0, 'v' + version + ': G2へ旧進捗が混入しました');
  assert(migrated.courses.g1.history.every(item => item.gradeId === 'g1' && item.courseId === 'g1'), 'v' + version + ': 移行履歴にG1タグがありません');
}

const backupKey = g1.STORE_KEY + '_pre_v4';
const sharedLegacyStorage = new Map([[g1.STORE_KEY, JSON.stringify(legacyV1)]]);
createAppHarness({ storage: sharedLegacyStorage, seedStart: 970000 });
assert.equal(sharedLegacyStorage.get(backupKey), JSON.stringify(legacyV1), '移行前データのバックアップが作成されません');
sharedLegacyStorage.set(g1.STORE_KEY, JSON.stringify(legacyV2));
createAppHarness({ storage: sharedLegacyStorage, seedStart: 980000 });
assert.equal(sharedLegacyStorage.get(backupKey), JSON.stringify(legacyV1), '既存の移行前バックアップが上書きされました');

const futureRaw = JSON.stringify({ version: 999, activeCourseId: 'g2', courses: { g2: { progress: { irreplaceable: true } } } });
assert.throws(
  () => courses.migrateState(JSON.parse(futureRaw)),
  error => error && error.code === 'FUTURE_STATE_VERSION',
  '未来versionは移行せず保護する必要があります'
);
const futureStorage = new Map([[g1.STORE_KEY, futureRaw]]);
const futureHarness = createAppHarness({ storage: futureStorage, seedStart: 990000 });
assert.equal(futureStorage.get(g1.STORE_KEY), futureRaw, 'version 999 の保存データを上書きしました');
assert(!futureStorage.has(backupKey), 'version 999 を旧版バックアップ扱いしてはいけません');
assert(futureHarness.appElement.innerHTML.includes('もっと新しい版'), '未来versionを保護している案内が表示されません');

let previousScriptPosition = -1;
for (const filename of sourceFiles) {
  const pattern = new RegExp('<script[^>]+src=["\\\'](?:\\./)?' + filename.replace('.', '\\.') + '["\\\']');
  assert(pattern.test(html), 'index.html に ' + filename + ' がありません');
  const position = html.search(pattern);
  assert(position > previousScriptPosition, 'index.html のスクリプト順が不正です: ' + filename);
  previousScriptPosition = position;
  assert(sw.includes(filename), 'Service Worker のキャッシュ対象に ' + filename + ' がありません');
}
assert(/132\s*ステージ/.test(html), 'index.html にG1/G2全132ステージが反映されていません');
assert(manifest.description.includes('132ステージ'), 'manifest にG1/G2全132ステージが反映されていません');
assert(/hirameki-kobo-v7/.test(sw), 'BGM・問題UI改善版でService Workerのキャッシュ世代が更新されていません');

console.log(
  'v14 smoke test: G1/G2 132 stages / G2 ' + generatedQuestions +
  ' generated questions / 66-stage clear / 6 time attacks / isolated course state / v1-v4 migration and backup / future-version protection / selector and PWA registration OK'
);
