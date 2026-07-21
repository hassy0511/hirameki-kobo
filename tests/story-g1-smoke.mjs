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
const sources = Object.fromEntries(sourceFiles.map(filename => [
  filename,
  fs.readFileSync(new URL(filename, rootUrl), 'utf8')
]));
sourceFiles.forEach(filename => new vm.Script(sources[filename], { filename }));

function loadDataRuntime() {
  const sandbox = { console };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  sourceFiles.slice(0, -1).forEach(filename => new vm.Script(sources[filename], { filename }).runInContext(sandbox));
  return sandbox;
}

const runtime = loadDataRuntime();
const core = runtime.HiramekiCore;
const courses = runtime.HiramekiCourses;
const story = runtime.HiramekiStory;
assert(story, '物語レジストリが公開されていません');
assert.equal(story.STORY_VERSION, 2, '物語改訂番号が不正です');
assert.equal(story.validate(courses.COURSES).ok, true, story.validate(courses.COURSES).errors.join('\n'));
assert.equal(story.OPENING.length, 3, '全体導入は3場面必要です');
assert.equal(story.RETURNING_OPENING.length, 3, '既存利用者向け再導入は3場面必要です');

const g1 = courses.courseFor('g1');
const allEffects = [];
for (const lineId of g1.lineOrder) {
  const lineStory = story.lineStory('g1', lineId);
  assert(lineStory, 'G1ライン物語がありません: ' + lineId);
  assert.equal(lineStory.intro.length, 2, lineId + ': ライン導入は2場面必要です');
  assert.equal(lineStory.stageEffects.length, 11, lineId + ': 全11ステージの世界変化が必要です');
  assert.equal(lineStory.zoneEffects.length, 3, lineId + ': 3作業区画の変化が必要です');
  assert(lineStory.system && lineStory.power && lineStory.problem && lineStory.mission, lineId + ': 故障・目的・復旧機能が不足しています');
  assert(lineStory.completeTitle && lineStory.completeText && lineStory.rushMission, lineId + ': 完走・高速点検の物語が不足しています');
  allEffects.push(...lineStory.stageEffects);
}
assert.equal(allEffects.length, 66, 'G1全66ステージの世界変化が必要です');
assert.equal(new Set(allEffects).size, 66, 'ステージ固有の世界変化が重複しています');
assert(!/海賊|船長|宝探し|そらのまち|空島|かげじま/.test(JSON.stringify({ world: story.WORLD, opening: story.OPENING, courses: story.COURSES })), '旧世界観の語が物語本文に残っています');
assert(!/中枢装置|学習ライン|必要|表示|基礎回路|復旧|計測|情報|検査/.test(story.childCopy('g1', '中枢装置 学習ライン 必要 表示 基礎回路 復旧 計測 情報 検査')), '一年生向け読み替えが不足しています');

const indexHtml = fs.readFileSync(new URL('index.html', rootUrl), 'utf8');
const sw = fs.readFileSync(new URL('sw.js', rootUrl), 'utf8');
assert(indexHtml.indexOf('course-core.js') < indexHtml.indexOf('story-core.js'), 'story-core.js はコース定義の後に読み込む必要があります');
assert(indexHtml.indexOf('story-core.js') < indexHtml.indexOf('app.js'), 'story-core.js はapp.jsより先に読み込む必要があります');
assert(indexHtml.indexOf('audio-core.js') < indexHtml.indexOf('app.js'), 'audio-core.js はapp.jsより先に読み込む必要があります');
assert(sw.includes('./story-core.js'), 'Service Workerにstory-core.jsがありません');
assert(sw.includes('./audio-core.js'), 'Service Workerにaudio-core.jsがありません');
assert(sw.includes('hirameki-kobo-v8'), 'ビジュアル改善版のキャッシュ世代が不正です');

function createAppHarness(options = {}) {
  const appElement = { innerHTML: '' };
  const toastElement = { textContent: '', classList: { add() {}, remove() {} } };
  const storage = options.storage || new Map();
  const clickListeners = [];
  if (Object.prototype.hasOwnProperty.call(options, 'savedRaw')) {
    storage.set(core.STORE_KEY, typeof options.savedRaw === 'string' ? options.savedRaw : JSON.stringify(options.savedRaw));
  }
  let seedCounter = options.seedStart || 510000;
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
      setItem(key, value) { storage.set(key, String(value)); },
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
  sourceFiles.forEach(filename => new vm.Script(sources[filename], { filename }).runInContext(sandbox));

  function dispatchAction(action, dataset = {}) {
    const node = { dataset: Object.assign({ action }, dataset), disabled: false };
    const target = { closest(selector) { return selector === '[data-action]' ? node : null; } };
    assert(clickListeners.length, 'clickハンドラーが登録されていません');
    clickListeners[0]({ target });
  }

  return { app: sandbox.HiramekiApp, appElement, storage, dispatchAction };
}

function storyReadyState() {
  const state = courses.createDefaultState();
  state.introSeen = true;
  state.courseChosen = true;
  state.activeCourseId = 'g1';
  state.workshopName = '物語テスト';
  state.settings.storyRevision = story.STORY_VERSION;
  state.courses.g1.introSeen = true;
  state.courses.g1.storySeen[story.storyKey('course', 'g1', 'main')] = true;
  return state;
}

function finishOpening(harness) {
  story.OPENING.forEach(() => harness.dispatchAction('opening-next'));
  harness.dispatchAction('finish-opening');
}

function finishCourseIntro(harness) {
  const scenes = story.courseStory(harness.app.getActiveCourseId()).intro;
  for (let index = 1; index < scenes.length; index += 1) harness.dispatchAction('course-intro-next');
  harness.dispatchAction('finish-course-intro');
}

function clearCurrentStage(harness) {
  for (let round = 0; round < 8; round += 1) {
    const session = harness.app.getSession();
    const question = session.questions[session.cursor];
    harness.app.handleAnswer(question.correct);
    harness.app.nextQuestion();
  }
}

const fresh = createAppHarness();
assert.equal(fresh.app.getUi().openingStep, 0, '新規利用者に全体導入が出ません');
assert(fresh.appElement.innerHTML.includes('ルミナが とまった'), 'ルミナ停止の目的が伝わりません');
finishOpening(fresh);
assert.equal(fresh.app.getRootState().settings.storyRevision, story.STORY_VERSION, '全体導入の改訂番号が保存されません');
assert.equal(fresh.app.getUi().screen, 'courses', '全体導入後に修理区画を選べません');

const oldV4 = courses.createDefaultState();
oldV4.introSeen = true;
oldV4.courseChosen = true;
oldV4.workshopName = '既存工房';
delete oldV4.settings.storyRevision;
const keptStageId = g1.lines.number.stages[0].id;
oldV4.courses.g1.progress[keptStageId] = { cleared: true, stars: 2, bestScore: 7 };
const refreshed = createAppHarness({ savedRaw: oldV4 });
assert.equal(refreshed.app.getUi().openingStep, 0, '既存利用者に改訂ストーリーが届きません');
assert(refreshed.appElement.innerHTML.includes('おかえり'), '既存利用者が新規の親方として扱われています');
finishOpening(refreshed);
assert(refreshed.app.getRootState().courses.g1.progress[keptStageId].cleared, '物語更新で既存進捗が失われました');
assert.equal(refreshed.app.getRootState().workshopName, '既存工房', '物語更新で工房名が変わりました');

const courseState = courses.createDefaultState();
courseState.introSeen = true;
courseState.courseChosen = false;
courseState.settings.storyRevision = story.STORY_VERSION;
const courseHarness = createAppHarness({ savedRaw: courseState });
courseHarness.dispatchAction('choose-course', { course: 'g1' });
assert.equal(courseHarness.app.getUi().courseIntroStep, 0, 'G1初回の章導入が始まりません');
assert(courseHarness.appElement.innerHTML.includes('きそひかりのみち'), 'G1の章目的が一年生向けの読み方で表示されません');
finishCourseIntro(courseHarness);
assert(courseHarness.app.getState().storySeen[story.storyKey('course', 'g1', 'main')], 'G1章導入の既読が保存されません');
courseHarness.dispatchAction('choose-course', { course: 'g2' });
courseHarness.dispatchAction('choose-course', { course: 'g1' });
assert.equal(courseHarness.app.getUi().courseIntroStep, null, 'G1章導入が再訪時に繰り返されました');

const unseenState = storyReadyState();
const seenState = storyReadyState();
const numberStage = g1.lines.number.stages[0];
seenState.courses.g1.storySeen[story.storyKey('line', 'g1', 'number')] = true;
seenState.courses.g1.storySeen[story.storyKey('stage', 'g1', numberStage.id)] = true;
const unseen = createAppHarness({ savedRaw: unseenState, seedStart: 610000 });
const seen = createAppHarness({ savedRaw: seenState, seedStart: 610000 });
unseen.app.startStage(0, 'number');
seen.app.startStage(0, 'number');
assert.equal(unseen.app.getUi().lineIntroStep, 0, '初回ライン導入が始まりません');
assert.equal(unseen.app.getUi().stageIntro, numberStage.id, '初回ステージ導入が準備されません');
assert.equal(seen.app.getUi().lineIntroStep, null, '既読ライン導入が再表示されました');
assert.equal(seen.app.getUi().stageIntro, null, '既読ステージ導入が再表示されました');
assert.equal(
  JSON.stringify(unseen.app.getSession().questions.map(question => question.signature)),
  JSON.stringify(seen.app.getSession().questions.map(question => question.signature)),
  '物語の既読状態でランダム問題が変化しました'
);
assert.equal(unseen.app.getSession().cursor, 0, '物語導入で問題カーソルが進みました');
assert.equal(unseen.app.getState().stats.totalAnswers, 0, '物語導入で回答統計が変化しました');
unseen.dispatchAction('line-intro-next');
unseen.dispatchAction('finish-line-intro');
assert.equal(unseen.app.getUi().lineIntroStep, null, 'ライン導入を閉じられません');
assert.equal(unseen.app.getUi().stageIntro, numberStage.id, 'ライン導入後にステージ導入へ続きません');
assert(unseen.appElement.innerHTML.includes(story.childCopy('g1', numberStage.part)), 'ステージ固有パーツがモクモの診断にありません');
unseen.dispatchAction('begin-stage');
assert(unseen.app.getState().storySeen[story.storyKey('line', 'g1', 'number')], 'ライン導入の既読が保存されません');
assert(unseen.app.getState().storySeen[story.storyKey('stage', 'g1', numberStage.id)], 'ステージ導入の既読が保存されません');
const unseenRestarted = createAppHarness({ storage: unseen.storage, seedStart: 620000 });
unseenRestarted.app.startStage(0, 'number');
assert.equal(unseenRestarted.app.getUi().lineIntroStep, null, '再起動後にライン導入が繰り返されました');
assert.equal(unseenRestarted.app.getUi().stageIntro, null, '再起動後にステージ導入が繰り返されました');

const lineAlmostDone = storyReadyState();
for (const stage of g1.lines.number.stages.slice(0, 10)) {
  lineAlmostDone.courses.g1.progress[stage.id] = { cleared: true, stars: 3, bestScore: 8 };
  lineAlmostDone.courses.g1.parts[stage.id] = true;
}
lineAlmostDone.courses.g1.storySeen[story.storyKey('line', 'g1', 'number')] = true;
const lineHarness = createAppHarness({ savedRaw: lineAlmostDone, seedStart: 710000 });
lineHarness.app.startStage(10, 'number');
lineHarness.dispatchAction('begin-stage');
clearCurrentStage(lineHarness);
assert.equal(lineHarness.app.getUi().result.firstLineComplete, true, '11個目の初回クリアでライン完成になりません');
assert(lineHarness.appElement.innerHTML.includes('かずコア かんせい'), 'ライン完成の専用物語が表示されません');
assert(lineHarness.appElement.innerHTML.includes('高速点検'), 'タイムアタックが修理後の点検として説明されません');
assert(lineHarness.appElement.innerHTML.includes(story.childCopy('g1', story.lineStory('g1', 'number').zoneEffects[2])), '第3作業区画の世界変化が表示されません');
lineHarness.app.startStage(10, 'number');
clearCurrentStage(lineHarness);
assert.equal(lineHarness.app.getUi().result.firstLineComplete, false, '完走ライン再プレイで完成イベントが繰り返されました');
assert(!lineHarness.appElement.innerHTML.includes('LINE RESTORED'), '完走ライン再プレイで完成物語が再表示されました');

const zoneState = storyReadyState();
zoneState.courses.g1.storySeen[story.storyKey('line', 'g1', 'number')] = true;
const zoneHarness = createAppHarness({ savedRaw: zoneState, seedStart: 760000 });
for (let stageIndex = 0; stageIndex <= 7; stageIndex += 1) {
  zoneHarness.app.startStage(stageIndex, 'number');
  zoneHarness.dispatchAction('begin-stage');
  clearCurrentStage(zoneHarness);
  if (stageIndex === 3 || stageIndex === 7) {
    const effectIndex = stageIndex === 3 ? 0 : 1;
    assert(zoneHarness.appElement.innerHTML.includes(story.childCopy('g1', story.lineStory('g1', 'number').zoneEffects[effectIndex])), '第' + (effectIndex + 1) + '作業区画の世界変化が表示されません');
  }
}

const courseAlmostDone = storyReadyState();
for (const lineId of g1.lineOrder) {
  for (const stage of g1.lines[lineId].stages) {
    if (stage.id === g1.lines.solve.stages[10].id) continue;
    courseAlmostDone.courses.g1.progress[stage.id] = { cleared: true, stars: 3, bestScore: 8 };
    courseAlmostDone.courses.g1.parts[stage.id] = true;
  }
  courseAlmostDone.courses.g1.storySeen[story.storyKey('line', 'g1', lineId)] = true;
}
const finaleHarness = createAppHarness({ savedRaw: courseAlmostDone, seedStart: 810000 });
finaleHarness.app.startStage(10, 'solve');
finaleHarness.dispatchAction('begin-stage');
clearCurrentStage(finaleHarness);
assert.equal(finaleHarness.app.getUi().result.firstCourseComplete, true, '66個目の初回クリアで区画完成になりません');
assert(finaleHarness.appElement.innerHTML.includes('六つのコアがそろった'), 'G1完走の結末導線が表示されません');
const interruptedFinale = createAppHarness({ storage: finaleHarness.storage, seedStart: 815000 });
assert.equal(interruptedFinale.app.getUi().courseFinaleStep, 0, '完走直後に再読込すると未読の結末が失われます');
finaleHarness.dispatchAction('show-course-finale');
assert.equal(finaleHarness.app.getUi().courseFinaleStep, 0, 'G1完走シーンを開始できません');
assert(finaleHarness.appElement.innerHTML.includes('六つのコアが つながった'), 'G1完走シーンの内容が表示されません');
finaleHarness.dispatchAction('course-finale-next');
finaleHarness.dispatchAction('finish-course-finale');
assert(finaleHarness.app.getState().storySeen[story.storyKey('course-complete', 'g1', 'main')], 'G1完走シーンの既読が保存されません');
assert.equal(finaleHarness.app.getUi().screen, 'home', 'G1完走後に工房へ戻れません');
assert.equal(Object.keys(finaleHarness.app.getRootState().courses.g2.progress).length, 0, 'G1完走でG2進捗が変化しました');
const finaleRestarted = createAppHarness({ storage: finaleHarness.storage, seedStart: 820000 });
assert.equal(finaleRestarted.app.getUi().courseFinaleStep, null, 'G1完走シーンが再起動後に自動で繰り返されました');

const unsafe = storyReadyState();
unsafe.workshopName = '"><img src=x onerror=alert(1)>';
const unsafeHarness = createAppHarness({ savedRaw: unsafe });
assert(!unsafeHarness.appElement.innerHTML.includes('<img'), '工房名がHTMLとして挿入されました');
assert(unsafeHarness.appElement.innerHTML.includes('&lt;img'), '工房名が安全にエスケープされていません');

console.log('G1 story smoke: global refresh / 6 line arcs / 66 unique world changes / one-time intros / line restore / time-attack inspection / course finale / save isolation / HTML escaping OK');
