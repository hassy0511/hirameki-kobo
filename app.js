(function (global) {
  'use strict';

  const C = global.HiramekiCore;
  if (!C) throw new Error('HiramekiCore is required');
  const K = global.HiramekiCourses || null;
  const S = global.HiramekiStory || null;
  const A = global.HiramekiAudio || null;

  const {
    STAGE_ROUNDS,
    TIME_ATTACK_ROUNDS,
    TIME_ATTACK_PENALTY_MS,
    ISLANDS,
    NUMBER_STAGES,
    ADDITION_STAGES,
    SUBTRACTION_STAGES,
    MEASURE_STAGES,
    SHAPE_STAGES,
    SOLVE_STAGES
  } = C;

  const STORE_KEY = K ? K.STORE_KEY : C.STORE_KEY;
  const PRE_V4_BACKUP_KEY = STORE_KEY + '_pre_v4';
  const defaultState = K ? K.createDefaultState : C.createDefaultState;
  const buildQuestion = C.buildQuestion;
  let storageReadOnly = false;
  let stateLoadError = null;
  let rootState = loadRootState();
  let activeCourseId = K && K.COURSES[rootState.activeCourseId] ? rootState.activeCourseId : 'g1';
  let course = K ? K.courseFor(activeCourseId) : { id: 'g1', label: '小学1年生 算数', short: '1年生', chapter: 'はじまり区画', chapterNo: 'CHAPTER 1', premise: '', lines: C.LINES, lineOrder: C.LINE_ORDER, recommendedPath: [] };
  let LINES = course.lines;
  let LINE_ORDER = course.lineOrder;
  let state = K ? K.courseState(rootState, activeCourseId) : rootState;
  syncStateShell();
  const storyRefreshNeeded = Boolean(S && Number(rootState.settings && rootState.settings.storyRevision || 0) < S.STORY_VERSION);
  const returningForStoryRefresh = Boolean(rootState.introSeen && storyRefreshNeeded);
  let ui = {
    screen: K && !rootState.courseChosen ? 'courses' : 'home',
    modal: null,
    openingStep: rootState.introSeen && !storyRefreshNeeded ? null : 0,
    courseIntroStep: null,
    lineIntroStep: null,
    lineIntroId: null,
    stageIntro: null,
    courseFinaleStep: null,
    lineId: LINES[state.lastLine] ? state.lastLine : 'number',
    islandId: LINES[state.lastLine] ? state.lastLine : 'number',
    result: null
  };
  let session = null;
  const audioEngine = A && typeof A.create === 'function' ? A.create() : null;
  let toastTimer = null;
  let rushTimerId = null;
  let deferredInstallPrompt = null;
  let waitingWorker = null;
  let reloadingForUpdate = false;

  function loadRootState() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      if (K && Number(parsed.version || 1) < K.STATE_VERSION && !localStorage.getItem(PRE_V4_BACKUP_KEY)) {
        localStorage.setItem(PRE_V4_BACKUP_KEY, raw);
        if (localStorage.getItem(PRE_V4_BACKUP_KEY) !== raw) throw new Error('backup verification failed');
      }
      const migrated = K ? K.migrateState(parsed) : C.migrateState(parsed);
      localStorage.setItem(STORE_KEY, JSON.stringify(migrated));
      return migrated;
    } catch (error) {
      storageReadOnly = true;
      stateLoadError = error && error.code === 'FUTURE_STATE_VERSION' ? 'future' : 'migration';
      return defaultState();
    }
  }

  function loadState() {
    const loaded = loadRootState();
    return K ? K.courseState(loaded, loaded.activeCourseId) : loaded;
  }

  function syncStateShell() {
    if (!K || !state) return;
    state.version = rootState.version;
    state.workshopName = rootState.workshopName;
    state.settings = rootState.settings;
  }

  function activateCourse(courseId) {
    if (!K || !K.COURSES[courseId]) return false;
    activeCourseId = courseId;
    rootState.activeCourseId = courseId;
    rootState.courseChosen = true;
    course = K.courseFor(courseId);
    LINES = course.lines;
    LINE_ORDER = course.lineOrder;
    state = K.courseState(rootState, courseId);
    syncStateShell();
    ui.lineId = LINES[state.lastLine] ? state.lastLine : LINE_ORDER[0];
    ui.islandId = ui.lineId;
    ui.lineIntroStep = null;
    ui.lineIntroId = null;
    ui.stageIntro = null;
    ui.courseFinaleStep = null;
    return true;
  }

  function saveState() {
    state.lastLine = ui.lineId;
    state.lastIsland = ui.lineId;
    state.islandStats = state.lineStats;
    state.islandIntros = state.lineIntros;
    if (K) {
      rootState.workshopName = state.workshopName;
      rootState.settings = state.settings;
      rootState.activeCourseId = activeCourseId;
      rootState.courses[activeCourseId] = state;
    }
    if (storageReadOnly) return;
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(K ? rootState : state));
    } catch (error) {
      showToast('きろくを ほぞんできませんでした');
    }
  }

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function attr(value) {
    return esc(value);
  }

  function randomSeed() {
    try {
      if (global.crypto && global.crypto.getRandomValues) {
        const values = new Uint32Array(1);
        global.crypto.getRandomValues(values);
        return values[0];
      }
    } catch (error) {
      // Date fallback below.
    }
    return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
  }

  function lineFor(lineId) {
    const id = lineId || ui.lineId;
    if (LINES[id]) return LINES[id];
    if (K) throw new Error('Unknown line: ' + activeCourseId + '/' + id);
    return LINES[LINE_ORDER[0]];
  }

  function stagesFor(lineId) {
    return lineFor(lineId).stages;
  }

  function clearedCount(lineId) {
    return K ? K.clearedCount(state, activeCourseId, lineId || ui.lineId) : C.clearedCount(state, lineId || ui.lineId);
  }

  function totalMarks(lineId) {
    return K ? K.totalMarks(state, activeCourseId, lineId) : C.totalMarks(state, lineId);
  }

  function isUnlocked(index, lineId) {
    if (activeCourseId === 'g1' && state.settings && state.settings.adminUnlockG1) return true;
    return K ? K.isUnlocked(state, activeCourseId, index, lineId || ui.lineId) : C.isUnlocked(state, index, lineId || ui.lineId);
  }

  function adminUnlockActive() {
    return Boolean(activeCourseId === 'g1' && state.settings && state.settings.adminUnlockG1);
  }

  function nextStageIndex(lineId) {
    return K ? K.nextStageIndex(state, activeCourseId, lineId || ui.lineId) : C.nextStageIndex(state, lineId || ui.lineId);
  }

  function lineComplete(lineId) {
    return K ? K.isLineComplete(state, activeCourseId, lineId || ui.lineId) : C.isLineComplete(state, lineId || ui.lineId);
  }

  function isStandalone() {
    return Boolean(global.navigator && global.navigator.standalone) ||
      Boolean(global.matchMedia && global.matchMedia('(display-mode: standalone)').matches);
  }

  function marksText(stars) {
    return '●'.repeat(Number(stars || 0)) + '○'.repeat(Math.max(0, 3 - Number(stars || 0)));
  }

  function lineStyle(line) {
    return '--accent:' + line.accent + ';--line-pale:' + line.pale + ';';
  }

  function storyKey(kind, id, courseId) {
    return S ? S.storyKey(kind, courseId || activeCourseId, id) : String(id || kind);
  }

  function hasStoryBeat(kind, id, courseId) {
    if (!state.storySeen) return false;
    return Boolean(state.storySeen[storyKey(kind, id, courseId)]);
  }

  function markStoryBeat(kind, id, courseId) {
    state.storySeen = state.storySeen || {};
    state.storySeen[storyKey(kind, id, courseId)] = true;
  }

  function activeCourseStory() {
    return S ? S.courseStory(activeCourseId) : null;
  }

  function activeLineStory(lineId) {
    return S ? S.lineStory(activeCourseId, lineId || ui.lineId) : null;
  }

  function storyText(value) {
    return storyTextFor(activeCourseId, value);
  }

  function storyTextFor(courseId, value) {
    return S && S.childCopy ? S.childCopy(courseId, value) : String(value == null ? '' : value);
  }

  function completedLineCount() {
    return LINE_ORDER.filter(function (lineId) { return lineComplete(lineId); }).length;
  }

  function courseComplete() {
    return completedLineCount() === LINE_ORDER.length;
  }

  if (S && ui.openingStep == null && courseComplete() && activeCourseStory() && activeCourseStory().finale && !hasStoryBeat('course-complete', 'main', activeCourseId)) {
    ui.courseFinaleStep = 0;
  }

  function normalizedBgmVolume() {
    const value = Number(state.settings && state.settings.bgmVolume);
    return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0.7;
  }

  function syncAudio() {
    if (!audioEngine) return;
    audioEngine.configure({
      master: Boolean(state.settings && state.settings.sound),
      bgm: Boolean(state.settings && state.settings.bgm),
      bgmVolume: normalizedBgmVolume(),
      visible: document.visibilityState !== 'hidden',
      mode: session && session.mode === 'timeAttack' && session.startedAt ? 'rush' : 'normal'
    });
  }

  function bgmStatusText() {
    if (!audioEngine) return 'この たんまつでは つかえません';
    const status = audioEngine.snapshot();
    if (!status.supported) return 'この たんまつでは つかえません';
    if (!state.settings.sound) return '「おと」が オフです';
    if (!state.settings.bgm || normalizedBgmVolume() <= 0) return 'オフです';
    if (status.contextState === 'running' && status.schedulerRunning) return 'さいせい中';
    return '「ためしに きく」を おしてください';
  }

  function playTone(kind) {
    if (!audioEngine) return;
    syncAudio();
    audioEngine.playTone(kind);
  }

  function showToast(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove('show'); }, 2200);
  }

  function lineNumber(lineId) {
    const index = LINE_ORDER.indexOf(lineId);
    return index >= 0 ? index + 1 : 1;
  }

  function lineBadgeHtml(line, className) {
    return '<span class="' + (className || 'line-badge') + '"><small>LINE</small><b>' + lineNumber(line.id) + '</b></span>';
  }

  function storyArtHtml(label) {
    return '<div class="story-art" role="img" aria-label="' + attr(label || 'トトとモクモが作業台で案内している') + '"></div>';
  }

  function childUi(g1Value, otherValue) {
    return activeCourseId === 'g1' ? g1Value : otherValue;
  }

  const G1_UI_READINGS = [
    ['一年生', '1ねんせい'], ['一つずつ', 'ひとつずつ'], ['一つ', 'ひとつ'], ['二つ', 'ふたつ'], ['三つ', '3つ'], ['四つ', '4つ'], ['六つ', '6つ'],
    ['一人', 'ひとり'], ['一列', 'いちれつ'], ['一れつ', 'いちれつ'], ['一台', '1だい'], ['一本', '1ほん'], ['一段', '1だん'], ['二本', '2ほん'],
    ['十の位', '10の くらい'], ['一の位', '1の くらい'], ['十の束', '10の まとまり'], ['両方', 'りょうほう'], ['片方', 'かたほう'],
    ['足し算', 'たしざん'], ['引き算', 'ひきざん'], ['計算', 'けいさん'], ['数字', 'すうじ'], ['数える', 'かぞえる'], ['数え', 'かぞえ'],
    ['同じ', 'おなじ'], ['仲間', 'なかま'], ['位置', 'ばしょ'], ['順番', 'じゅんばん'], ['場所', 'ばしょ'], ['場面', 'ばめん'], ['方法', 'やりかた'],
    ['答える', 'こたえる'], ['答え', 'こたえ'], ['正解', 'せいかい'], ['問題', 'もんだい'], ['最初', 'さいしょ'], ['見本', 'みほん'],
    ['小さい', 'ちいさい'], ['大きい', 'おおきい'], ['小さく', 'ちいさく'], ['大きく', 'おおきく'], ['多い', 'おおい'], ['少ない', 'すくない'],
    ['作って', 'つくって'], ['作った', 'つくった'], ['作ろう', 'つくろう'], ['作る', 'つくる'], ['見方', 'みかた'], ['見る', 'みる'], ['見て', 'みて'],
    ['考える', 'かんがえる'], ['考えて', 'かんがえて'], ['考え', 'かんがえ'], ['必要', 'ひつよう'], ['全体', 'ぜんぶ'], ['全部', 'ぜんぶ'],
    ['取り出す', 'とりだす'], ['取り出し', 'とりだし'], ['出して', 'だして'], ['出す', 'だす'], ['出る', 'でる'], ['出た', 'でた'],
    ['入れる', 'いれる'], ['合わせる', 'あわせる'], ['合わせ', 'あわせ'], ['合う', 'あう'], ['分けた', 'わけた'], ['分けて', 'わけて'], ['分ける', 'わける'],
    ['足して', 'たして'], ['足す', 'たす'], ['引いて', 'ひいて'], ['引く', 'ひく'], ['減らす', 'へらす'], ['残り', 'のこり'],
    ['長さ', 'ながさ'], ['長い', 'ながい'], ['短い', 'みじかい'], ['広さ', 'ひろさ'], ['広い', 'ひろい'], ['平ら', 'たいら'],
    ['時計', 'とけい'], ['時刻', 'じこく'], ['時間', 'じかん'], ['何時', 'なんじ'], ['何分', 'なんぷん'], ['目盛', 'めもり'],
    ['三角', 'さんかく'], ['四角', 'しかく'], ['想像', 'そうぞう'], ['整理', 'せいり'], ['表せる', 'あらわせる'], ['表す', 'あらわす'],
    ['車両', 'すうじ'], ['点灯できた', 'えらべた'], ['点灯', 'ひからせる'],
    ['回して', 'まわして'], ['回す', 'まわす'], ['回る', 'まわる'], ['動かす', 'うごかす'], ['動かし', 'うごかし'], ['積む', 'つむ'],
    ['読む', 'よむ'], ['使う', 'つかう'], ['使って', 'つかって'], ['違い', 'ちがい'], ['違う', 'ちがう'],
    ['数', 'かず'], ['順', 'じゅん'], ['左', 'ひだり'], ['右', 'みぎ'], ['上', 'うえ'], ['下', 'した'], ['前', 'まえ'], ['後ろ', 'うしろ'],
    ['絵', 'え'], ['式', 'しき'], ['図', 'ず'], ['表', 'ひょう'], ['何', 'なん']
  ];

  const G1_KANJI_FALLBACK = {
    一: '1', 二: '2', 三: '3', 四: '4', 上: 'うえ', 下: 'した', 丸: 'まる', 人: 'ひと', 仲: 'なか', 位: 'くらい', 低: 'ひく', 体: 'からだ',
    作: 'つく', 使: 'つか', 像: 'ぞう', 先: 'さき', 入: 'はい', 全: 'ぜん', 出: 'で', 分: 'ぶん', 切: 'き', 列: 'れつ', 初: 'はじ', 前: 'まえ',
    動: 'うご', 十: '10', 取: 'と', 台: 'だい', 右: 'みぎ', 合: 'あ', 同: 'おな', 向: 'む', 回: 'かい', 囲: 'かこ', 場: 'ば', 増: 'ふ',
    多: 'おお', 大: 'おお', 字: 'じ', 対: 'たい', 小: 'ちい', 少: 'すく', 左: 'ひだり', 平: 'たい', 広: 'ひろ', 底: 'そこ', 式: 'しき', 引: 'ひ',
    形: 'かたち', 後: 'あと', 想: 'そう', 所: 'ところ', 手: 'て', 整: 'せい', 方: 'かた', 時: 'じ', 最: 'さい', 本: 'ほん', 机: 'つくえ', 束: 'たば',
    板: 'いた', 棒: 'ぼう', 棚: 'たな', 横: 'よこ', 次: 'つぎ', 残: 'のこ', 段: 'だん', 法: 'ほう', 減: 'へ', 灯: 'ひかり', 点: 'てん', 片: 'かた',
    玉: 'たま', 理: 'り', 番: 'ばん', 盛: 'も', 目: 'め', 着: 'つ', 短: 'みじか', 空: 'から', 答: 'こたえ', 紙: 'かみ', 絵: 'え', 置: 'お',
    考: 'かんが', 自: 'じ', 行: 'い', 表: 'ひょう', 見: 'み', 角: 'かど', 計: 'けい', 話: 'はなし', 足: 'あし', 車: 'くるま', 辺: 'へん',
    進: 'すす', 部: 'ぶ', 配: 'くば', 針: 'はり', 長: 'なが', 間: 'あいだ', 面: 'めん', 順: 'じゅん', 駅: 'えき', 高: 'たか', 水: 'みず'
  };

  function gradeOneReading(value) {
    let text = String(value == null ? '' : value);
    if (activeCourseId !== 'g1') return text;
    G1_UI_READINGS.forEach(function (entry) { text = text.split(entry[0]).join(entry[1]); });
    return text.replace(/[一-龯々]/g, function (character) { return G1_KANJI_FALLBACK[character] || character; });
  }

  function childText(value) {
    return esc(gradeOneReading(value));
  }

  function header(active) {
    const gradeOne = activeCourseId === 'g1';
    return [
      '<header class="topbar">',
      '<button class="brand-button" data-nav="home" aria-label="ホームへ">',
      '<span class="brand-mark" aria-hidden="true"><span class="brand-core"></span></span>',
      '<span class="brand-copy"><strong>', gradeOne ? 'ひらめきこうぼう' : 'ひらめき工房', '</strong><small>HIRAMEKI WORKSHOP</small></span>',
      '</button>',
      adminUnlockActive() ? '<span class="admin-mode-badge">かんりモード</span>' : '',
      '<nav class="main-nav" aria-label="メインメニュー">',
      K ? navButton('courses', gradeOne ? '1ねん' : course.short, active) : '',
      navButton('home', gradeOne ? 'ホーム' : '工房', active),
      navButton('map', gradeOne ? 'ステージ' : '設計図', active),
      navButton('atelier', 'ずかん', active),
      navButton('parent', gradeOne ? 'おとな' : '記録', active),
      '<button class="icon-button" data-action="open-settings" aria-label="せってい">せってい</button>',
      '</nav>',
      '</header>'
    ].join('');
  }

  function navButton(screen, label, active) {
    return '<button class="nav-button ' + (active === screen ? 'active' : '') + '" data-nav="' + screen + '">' + label + '</button>';
  }

  function shell(content, active) {
    return '<div class="app-shell">' + header(active) + content + renderOverlay() + renderUpdateBanner() + '</div>';
  }

  const RECOMMENDED_PATH = [
    ['number', 0], ['number', 1], ['number', 2], ['number', 3], ['number', 4], ['number', 5], ['number', 6], ['number', 7],
    ['addition', 0], ['addition', 1], ['addition', 2], ['addition', 3], ['addition', 4],
    ['subtraction', 0], ['subtraction', 1], ['subtraction', 2], ['subtraction', 3], ['subtraction', 4],
    ['solve', 0], ['solve', 1], ['solve', 2], ['solve', 3], ['solve', 4],
    ['measure', 0], ['measure', 1], ['measure', 2], ['measure', 3], ['measure', 4],
    ['number', 8], ['addition', 5], ['addition', 6], ['addition', 7], ['addition', 8],
    ['measure', 5], ['measure', 6], ['measure', 7], ['measure', 8],
    ['addition', 9], ['shape', 0], ['shape', 1], ['shape', 2], ['shape', 3], ['shape', 4], ['shape', 5], ['shape', 6], ['shape', 7], ['shape', 8],
    ['subtraction', 5], ['subtraction', 6], ['subtraction', 7], ['subtraction', 8],
    ['number', 9], ['subtraction', 9], ['measure', 9],
    ['number', 10], ['addition', 10], ['subtraction', 10], ['measure', 10], ['shape', 9], ['shape', 10],
    ['solve', 5], ['solve', 6], ['solve', 7], ['solve', 8], ['solve', 9], ['solve', 10]
  ];

  function recommendedMission() {
    const path = K ? course.recommendedPath : RECOMMENDED_PATH;
    for (let i = 0; i < path.length; i += 1) {
      const item = path[i];
      const line = lineFor(item[0]);
      const stage = line.stages[item[1]];
      if (isUnlocked(item[1], line.id) && !(state.progress[stage.id] && state.progress[stage.id].cleared)) {
        return { line, stage, stageIndex: item[1] };
      }
    }
    const line = lineFor(ui.lineId);
    const stageIndex = nextStageIndex(line.id);
    return { line, stage: line.stages[stageIndex], stageIndex, completed: courseComplete() };
  }

  function renderCourses() {
    if (!K) return renderHome();
    const cards = K.COURSE_ORDER.map(function (courseId) {
      const item = K.courseFor(courseId);
      const gradeOneCard = courseId === 'g1';
      const saved = K.courseState(rootState, courseId);
      const total = item.lineOrder.reduce(function (sum, lineId) { return sum + item.lines[lineId].stages.length; }, 0);
      const cleared = item.lineOrder.reduce(function (sum, lineId) { return sum + K.clearedCount(saved, courseId, lineId); }, 0);
      const courseStory = S ? S.courseStory(courseId) : null;
      const statusNames = gradeOneCard ? ['まだ これから', 'とちゅう', 'ぜんぶ できた'] : courseStory && courseStory.statusNames || ['まだ暗い', '修理中', '区画復旧'];
      const status = cleared === 0 ? statusNames[0] : cleared === total ? statusNames[2] : statusNames[1];
      return [
        '<article class="course-card ', activeCourseId === courseId && rootState.courseChosen ? 'active' : '', '" style="--accent:', item.accent, ';--line-pale:', item.pale, '">',
        '<div class="course-number">', item.symbol, '</div><div class="eyebrow">', gradeOneCard ? '1ねんせい' : esc(item.chapterNo), '</div>',
        '<h2>', gradeOneCard ? '1ねんせい さんすう' : esc(item.label), '</h2><h3>', gradeOneCard ? 'かず・たしざん・ひきざん など' : esc(storyTextFor(courseId, item.chapter)), '</h3><p>', gradeOneCard ? '1ねんせいの さんすうで、ルミナを げんきにしよう。' : esc(storyTextFor(courseId, courseStory && courseStory.mission || item.premise)), '</p>',
        '<div class="story-status"><span class="story-status-dot"></span><strong>', gradeOneCard ? esc(status) : esc(storyTextFor(courseId, status)), '</strong></div>',
        '<div class="progress-track"><div class="progress-fill" style="--progress:', Math.round(cleared / total * 100), '%"></div></div>',
        '<div class="line-progress-copy"><span>', cleared, ' / ', total, gradeOneCard ? ' できた' : ' しゅうり', '</span><span>', item.lineOrder.length, gradeOneCard ? 'つの べんきょう' : 'ライン', '</span></div>',
        '<button class="primary-button" data-action="choose-course" data-course="', courseId, '">', gradeOneCard ? (cleared ? 'つづきから' : '1ねんせいを はじめる') : (cleared ? 'このコースを つづける' : 'このコースを はじめる'), ' →</button>',
        '</article>'
      ].join('');
    }).join('');
    return shell([
      '<main class="page course-page"><section class="course-heading"><div class="eyebrow">CHOOSE YOUR COURSE</div>',
      '<h1>どの がくねんを やってみる？</h1><p>がくねんは いつでも かえられるよ。2ねんせいからでも だいじょうぶ。</p></section>',
      '<section class="course-grid">', cards, '</section></main>'
    ].join(''), 'courses');
  }

  function renderHome() {
    const gradeOne = activeCourseId === 'g1';
    const mission = recommendedMission();
    const totalCleared = LINE_ORDER.reduce(function (sum, lineId) { return sum + clearedCount(lineId); }, 0);
    const totalStages = LINE_ORDER.reduce(function (sum, lineId) { return sum + lineFor(lineId).stages.length; }, 0);
    const completedLines = completedLineCount();
    const progressStory = S ? S.progressStory(activeCourseId, totalCleared, totalStages, completedLines) : null;
    const currentCourseStory = activeCourseStory();
    const lamps = Array.from({ length: 12 }, function (_, index) {
      return '<span class="machine-lamp ' + (index < Math.round(totalCleared / totalStages * 12) ? 'on' : '') + '"></span>';
    }).join('');
    const lineCards = LINE_ORDER.map(function (lineId) {
      const line = lineFor(lineId);
      const count = clearedCount(lineId);
      const complete = lineComplete(lineId);
      const nextIndex = nextStageIndex(lineId);
      const next = line.stages[nextIndex];
      const rush = state.timeAttack[lineId] || {};
      const lineStory = activeLineStory(lineId);
      return [
        '<article class="line-card" style="', lineStyle(line), '">',
        '<div class="line-card-top">', lineBadgeHtml(line), '<div><div class="eyebrow">', gradeOne ? 'べんきょう' : 'LEARNING LINE', '</div><h3>', childText(line.name), '</h3></div></div>',
        lineStory ? (gradeOne ? '<div class="line-story-label"><span>ここで やること</span><strong>' + childText(line.short) + '</strong></div>' : '<div class="line-story-label"><span>' + esc(storyText(lineStory.system)) + '</span><strong>' + esc(storyText(lineStory.power)) + '</strong></div>') : '',
        '<p>', gradeOne ? childText(line.description) : esc(storyText(lineStory && lineStory.mission || line.description)), '</p>',
        '<div class="progress-track"><div class="progress-fill" style="--progress:', Math.round(count / line.stages.length * 100), '%"></div></div>',
        '<div class="line-progress-copy"><span>', count, ' / ', line.stages.length, gradeOne ? ' できた' : ' しゅうり', '</span><span>', totalMarks(lineId), ' / ', line.stages.length * 3, gradeOne ? ' しるし' : ' ひらめき印', '</span></div>',
        '<div class="line-card-actions">',
        '<button class="primary-button compact-button" style="', lineStyle(line), '" data-action="open-line" data-line="', lineId, '">', complete ? (gradeOne ? 'ステージを みる' : '設計図を見る') : 'つぎ：' + childText(next.name), '</button>',
        complete || adminUnlockActive() ? '<button class="secondary-button compact-button" data-action="start-rush" data-line="' + lineId + '">タイムアタック</button>' : '<button class="soft-button compact-button" data-action="open-line" data-line="' + lineId + '">いちらん</button>',
        '</div>',
        complete ? '<div class="rush-unlock">タイムアタック ' + (gradeOne ? 'オープン' : '解放済み') + '　ベスト ' + C.formatTimeMs(rush.bestMs) + '</div>' : '',
        '</article>'
      ].join('');
    }).join('');
    return shell([
      '<main class="page">',
      '<section class="hero" style="', lineStyle(mission.line), '">',
      '<div class="hero-copy"><div class="eyebrow">', gradeOne ? '1ねんせい・さんすう' : esc(course.chapterNo) + '・' + esc(course.label), '</div><h1>', gradeOne ? esc(state.workshopName || 'ひらめき') + 'こうぼうへ<br>ようこそ！' : esc(state.workshopName || 'ひらめき') + '工房、<br>' + esc(storyText(course.chapter)) + 'へ。', '</h1>',
      '<p>', esc(gradeOne ? 'さんすうの ステージを クリアして、ルミナを げんきにしよう。' : storyText(currentCourseStory && currentCourseStory.mission || course.premise)), '</p>',
      progressStory ? (gradeOne ? '<div class="story-progress-copy"><small>いまの きろく</small><strong>' + totalCleared + 'こ できた！</strong><span>できることが ふえると、ルミナも げんきになるよ。</span></div>' : '<div class="story-progress-copy"><small>' + esc(storyText(progressStory.label)) + '</small><strong>' + esc(storyText(progressStory.title)) + '</strong><span>' + esc(storyText(progressStory.text)) + '</span></div>') : '',
      '<div class="hero-actions">', mission.completed && currentCourseStory && currentCourseStory.finale ? '<button class="primary-button" style="' + lineStyle(mission.line) + '" data-action="show-course-finale">さいごの おはなしを みる →</button>' : '<button class="primary-button" style="' + lineStyle(mission.line) + '" data-action="start-recommended" data-line="' + mission.line.id + '" data-stage="' + mission.stageIndex + '">' + childText(mission.stage.name) + 'を はじめる →</button>',
      '<button class="soft-button" data-nav="map">', LINE_ORDER.length, gradeOne ? 'つの べんきょうを みる' : 'つのラインを見る', '</button></div></div>',
      '<div class="hero-machine"><div class="machine-title"><span>', gradeOne ? 'ルミナの げんき' : 'ルミナ復旧パネル', '</span><b>', totalCleared, ' / ', totalStages, '</b></div><div class="machine-lamps">', lamps, '</div><div class="lumina-cores">', LINE_ORDER.map(function (lineId) {
        const line = lineFor(lineId);
        const story = activeLineStory(lineId);
        return '<div class="lumina-core ' + (lineComplete(lineId) ? 'on' : clearedCount(lineId) ? 'working' : '') + '" style="' + lineStyle(line) + '"><span>' + lineNumber(lineId) + '</span><small>' + (gradeOne ? childText(line.short) : esc(storyText(story ? story.power : line.short))) + '</small></div>';
      }).join(''), '</div><div class="machine-conveyor"></div>',
      '<p class="muted">', gradeOne ? 'ステージが できるたびに、ルミナの ひかりが ふえるよ。' : '11個のパーツで一つのコアが完成。六つのコアをルミナへつなぎます。', '</p></div>',
      '</section>',
      '<div class="section-heading"><div><div class="eyebrow">', LINE_ORDER.length, gradeOne ? 'つの べんきょう' : ' LEARNING LINES', '</div><h2>', gradeOne ? 'べんきょうを えらぶ' : '学習ラインを えらぶ', '</h2></div><p>', gradeOne ? 'どこからでも、さいしょの ステージを はじめられるよ。' : 'どのラインもステージ1から始められます。', '</p></div>',
      '<section class="line-grid">', lineCards, '</section>',
      '</main>'
    ].join(''), 'home');
  }

  function lineTabs() {
    return '<div class="line-tabs" aria-label="' + (activeCourseId === 'g1' ? 'べんきょう' : '学習ライン') + '">' + LINE_ORDER.map(function (lineId) {
      const line = lineFor(lineId);
      return '<button class="line-tab ' + (ui.lineId === lineId ? 'active' : '') + '" style="' + lineStyle(line) + '" data-line-tab="' + lineId + '"><span>LINE ' + lineNumber(lineId) + '</span>' + childText(line.short) + ' <small>' + clearedCount(lineId) + '/' + line.stages.length + '</small></button>';
    }).join('') + '</div>';
  }

  function renderMap() {
    const gradeOne = activeCourseId === 'g1';
    const line = lineFor();
    const count = clearedCount(line.id);
    const complete = lineComplete(line.id);
    const lineStory = activeLineStory(line.id);
    const zones = line.zones.map(function (zone) {
      const cards = line.stages.slice(zone.range[0], zone.range[1] + 1).map(function (stage, localIndex) {
        const index = zone.range[0] + localIndex;
        const progress = state.progress[stage.id] || {};
        const unlocked = isUnlocked(index, line.id);
        return [
          '<button class="stage-card ', progress.cleared ? 'cleared' : '', '" style="', lineStyle(line), '" data-stage="', index, '" ', unlocked ? '' : 'disabled', '>',
          '<span class="stage-number">', stage.n, '</span>',
          '<h3>', unlocked ? childText(stage.name) : 'まだ ひみつ', '</h3>',
          '<p>', unlocked ? childText(stage.action) : (gradeOne ? 'まえの ステージが できると ひらくよ。' : '前のステージを修理すると開きます。'), '</p>',
          '<span class="stage-status">', progress.cleared ? marksText(progress.stars) : unlocked ? (gradeOne ? 'はじめる →' : 'START →') : (gradeOne ? 'まだ' : 'LOCK'), '</span>',
          '</button>'
        ].join('');
      }).join('');
      return '<section class="zone-panel" style="' + lineStyle(line) + '"><div class="zone-head"><span class="zone-letter">' + zone.n + '</span><div><h2>' + esc(gradeOne ? 'その ' + (line.zones.indexOf(zone) + 1) : zone.name) + '</h2><small>' + esc(gradeOne ? 'できる ことを すこしずつ ふやそう' : zone.note) + '</small></div></div><div class="stage-grid">' + cards + '</div></section>';
    }).join('');
    const rushAction = complete || adminUnlockActive()
      ? '<button class="secondary-button heading-action" data-action="start-rush" data-line="' + line.id + '">タイムアタック</button>'
      : '<button class="soft-button heading-action" disabled>' + line.stages.length + 'ステージ完了でタイムアタック</button>';
    return shell([
      '<main class="page">', lineTabs(),
      '<section class="page-heading-card" style="', lineStyle(line), '">', lineBadgeHtml(line, 'heading-symbol'), '<div><div class="eyebrow">', gradeOne ? 'ステージ' : 'REPAIR BLUEPRINT', '</div><h1>', childText(line.name), '</h1>',
      lineStory ? (gradeOne ? '<div class="line-story-label"><span>ここで やること</span><strong>' + childText(line.short) + '</strong></div>' : '<div class="line-story-label"><span>' + esc(storyText(lineStory.system)) + '</span><strong>' + esc(storyText(lineStory.power)) + '</strong></div>') : '',
      '<p>', gradeOne ? childText(line.description) : esc(storyText(lineStory && lineStory.mission || line.description)), '　', count, '/', line.stages.length, gradeOne ? ' できた' : ' 修理済み', '</p>', lineStory ? '<button class="story-link" data-action="replay-line-story" data-line="' + attr(line.id) + '">' + (gradeOne ? 'おはなしを みる' : 'トトとモクモの作戦をみる') + '</button>' : '', '</div>', rushAction, '</section>',
      '<div class="zones">', zones, '</div>',
      '</main>'
    ].join(''), 'map');
  }

  function startStage(index, lineId) {
    const targetLine = lineFor(lineId || ui.lineId);
    const stageIndex = Number(index);
    if (!isUnlocked(stageIndex, targetLine.id)) {
      showToast('前のステージから しゅうりしよう');
      return;
    }
    const stage = targetLine.stages[stageIndex];
    const seed = randomSeed();
    const recent = Array.isArray(state.recentQuestions[stage.id]) ? state.recentQuestions[stage.id] : [];
    const pack = K
      ? K.makeStageQuestions(activeCourseId, targetLine.id, stageIndex, { seed, exclude: recent })
      : C.makeStageQuestions(targetLine.id, stageIndex, { seed, exclude: recent });
    pack.questions.forEach(function (question) { question.initialInput = question.input; });
    state.recentQuestions[stage.id] = recent.concat(pack.questions.reduce(function (keys, question) {
      keys.push(question.signature);
      if (activeCourseId === 'g1' && question.contentSignature) keys.push(question.contentSignature);
      return keys;
    }, [])).slice(activeCourseId === 'g1' ? -16 : -32);
    session = {
      mode: 'standard',
      courseId: activeCourseId,
      gradeId: activeCourseId,
      lineId: targetLine.id,
      islandId: targetLine.id,
      stageIndex,
      seed,
      questions: pack.questions,
      cursor: 0,
      correct: 0,
      chain: 0,
      bestChain: 0,
      startedAt: Date.now()
    };
    ui.lineId = targetLine.id;
    ui.islandId = targetLine.id;
    ui.screen = 'game';
    ui.result = null;
    const stageBeat = storyKey('stage', stage.id, activeCourseId);
    ui.stageIntro = state.storySeen && !state.storySeen[stageBeat] ? stage.id : null;
    if (activeLineStory(targetLine.id) && !hasStoryBeat('line', targetLine.id, activeCourseId)) {
      ui.lineIntroId = targetLine.id;
      ui.lineIntroStep = 0;
    }
    saveState();
    playTone('tap');
    render();
    global.scrollTo(0, 0);
  }

  function machinePanel(line, stage, completed) {
    const lineStory = activeLineStory(line.id);
    const energy = Array.from({ length: 5 }, function (_, index) {
      return '<span class="energy-cell ' + (index < Math.ceil(completed / STAGE_ROUNDS * 5) ? 'on' : '') + '"></span>';
    }).join('');
    if (activeCourseId === 'g1') {
      return '<aside class="mission-machine simple-progress" style="' + lineStyle(line) + '"><div><small>いまの すすみ</small><strong>' + completed + ' / ' + STAGE_ROUNDS + 'もん</strong></div><div class="energy-row">' + energy + '</div><p class="muted">1もんずつ、ゆっくり かんがえよう。</p></aside>';
    }
    return [
      '<aside class="mission-machine" style="', lineStyle(line), '"><div class="machine-face">',
      '<div class="machine-screen"><div><small>', esc(storyText(lineStory ? lineStory.system : 'REPAIR PART')), '</small><strong><span class="machine-stage-number">', stage.n, '</span>', esc(stage.part), '</strong></div></div>',
      '<div class="energy-row">', energy, '</div><div class="machine-gears" aria-hidden="true"><span class="css-gear"></span><span class="css-gear small"></span></div>',
      '<p class="muted">正解すると、', esc(storyText(lineStory ? lineStory.power : '装置')), 'の回路へエネルギーが届きます。</p>',
      '</div></aside>'
    ].join('');
  }

  function roundDots(total, cursor) {
    return Array.from({ length: total }, function (_, index) {
      return '<span class="round-dot ' + (index < cursor ? 'done' : index === cursor ? 'current' : '') + '"></span>';
    }).join('');
  }

  function renderGame() {
    if (!session) return renderHome();
    const line = lineFor(session.lineId);
    const stage = line.stages[session.stageIndex];
    const question = session.questions[session.cursor];
    return [
      '<div class="game-page" style="', lineStyle(line), '">',
      '<div class="game-toolbar"><div class="game-stage-copy"><strong>', stage.n, '. ', childText(stage.name), '</strong><small>', activeCourseId === 'g1' ? childText(stage.action) : esc(stage.skill), '</small></div>',
      '<div class="round-dots" aria-label="', session.cursor + 1, activeCourseId === 'g1' ? 'もんめ' : '問目', '">', roundDots(STAGE_ROUNDS, session.cursor), '</div>',
      '<div class="game-toolbar-actions"><button class="nav-button" data-action="ask-quit">× ちゅうだん</button></div></div>',
      '<main class="game-main">', machinePanel(line, stage, session.cursor), renderQuestionCard(question, line, false), '</main>',
      renderOverlay(), renderUpdateBanner(), '</div>'
    ].join('');
  }

  function repeat(count, renderItem) {
    return Array.from({ length: Math.max(0, Number(count) || 0) }, function (_, index) { return renderItem(index); }).join('');
  }

  function miniParts(count) {
    return repeat(count, function () { return '<span class="mini-part"></span>'; });
  }

  function tenFrame(filled) {
    return '<div class="ten-frame">' + repeat(10, function (index) {
      return '<span class="ten-cell ' + (index < filled ? 'filled' : '') + '"></span>';
    }) + '</div>';
  }

  function fiveFrame(filled) {
    return '<div class="five-frame" aria-label="まる ' + Number(filled) + 'こ">' + repeat(5, function (index) {
      return '<span class="five-cell ' + (index < filled ? 'filled' : '') + '"></span>';
    }) + '</div>';
  }

  function graphHtml(labels, counts) {
    return '<div class="graph">' + labels.map(function (label, index) {
      return '<div class="graph-column"><div class="graph-bar" style="--count:' + counts[index] + '"></div><span>' + childText(label) + '<br>' + counts[index] + '</span></div>';
    }).join('') + '</div>';
  }

  const VISUAL_TOKEN_META = {
    'count-dot': { className: 'count-dot', label: 'まる' },
    '🔩': { className: 'bolt', label: 'ねじ' },
    '⚙': { className: 'gear', label: 'はぐるま' },
    '⚙️': { className: 'gear', label: 'はぐるま' },
    '💡': { className: 'lamp', label: 'ランプ' },
    '🔋': { className: 'battery', label: 'でんち' },
    '🔧': { className: 'wrench', label: 'レンチ' },
    '🟦': { className: 'block-blue', label: 'あおい ブロック' },
    '🟡': { className: 'block-yellow', label: 'きいろい ブロック' },
    '🟢': { className: 'block-green', label: 'みどりの ブロック' },
    '■': { className: 'cube', label: 'しかくい ブロック' },
    '◆': { className: 'cube', label: 'かたち' },
    '┃': { className: 'stick', label: 'ぼう' },
    '▤': { className: 'record', label: 'きろくカード' },
    '✓': { className: 'check', label: 'チェック印' },
    '▰': { className: 'fraction-piece', label: '同じ大きさの 一つ分' },
    '▣': { className: 'box', label: 'はこ' },
    '▦': { className: 'dice', label: 'さいころ' },
    '▥': { className: 'cylinder', label: 'つつ' },
    '●': { className: 'ball', label: 'ボール' }
  };

  const METHOD_META = {
    direct: { label: 'はしを そろえて ならべる', scene: '2ほんの ぼうを うごかし、はしを そろえて くらべる' },
    transfer: { label: 'テープに うつして くらべる', scene: 'うごかせない ものの ながさを テープへ うつして くらべる' },
    unit: { label: 'おなじ ブロックで なんこぶんか はかる', scene: 'おなじ おおきさの ブロックを ならべて、ながさを かずで あらわす' }
  };

  function tokenMeta(value) {
    const key = String(value == null ? '' : value);
    return VISUAL_TOKEN_META[key] || VISUAL_TOKEN_META[key.replace(/\uFE0F/g, '')] || { className: 'text', label: key || 'もの' };
  }

  function visualTokenHtml(value, extraClass, visibleLabel) {
    const meta = tokenMeta(value);
    const label = gradeOneReading(visibleLabel || meta.label);
    const object = meta.className === 'text'
      ? '<span class="visual-token-text">' + esc(value || label) + '</span>'
      : '<span class="learning-object learning-object--' + meta.className + '" aria-hidden="true"></span>';
    return '<span class="visual-token ' + (extraClass || '') + '" role="img" aria-label="' + attr(label) + '">' + object + (visibleLabel ? '<small>' + esc(label) + '</small>' : '<span class="sr-only">' + esc(label) + '</span>') + '</span>';
  }

  function methodSceneHtml(sceneId, compact) {
    const id = METHOD_META[sceneId] ? sceneId : 'direct';
    const meta = METHOD_META[id];
    return '<span class="method-scene-image method-scene-image--' + id + (compact ? ' compact' : '') + '" role="img" aria-label="' + attr(gradeOneReading(meta.scene)) + '"></span>';
  }

  function interactivePieces(question, line) {
    const visual = question.visual || {};
    let total = visual.total || visual.target || visual.count || visual.b || question.max || 10;
    if (visual.type === 'merge') total = Number(question.correct);
    if (visual.type === 'bond') total = visual.target;
    if (visual.type === 'make-ten' || visual.type === 'break-ten') total = visual.b;
    if (visual.type === 'ten-bundle-remove') total = visual.a;
    if (visual.type === 'unit-length') total = visual.count;
    total = Math.max(Number(question.correct) || 0, Math.min(20, Number(total) || 10));
    const selected = new Set(question.selected || []);
    const targetGuide = visual.type === 'sticks' ? '<div class="stick-target"><small>つくる かたち</small><strong>' + childText(visual.diagram || visual.target) + '</strong><span>' + childText(visual.target) + '</span></div>' : '';
    return targetGuide + '<div class="selectable-grid" style="' + lineStyle(line) + '">' + repeat(total, function (index) {
      const icon = visual.icons && visual.icons.length ? visual.icons[index % visual.icons.length] : visual.type === 'sticks' ? '┃' : visual.type === 'graph-build' ? '✓' : activeCourseId === 'g1' ? 'count-dot' : '■';
      const label = tokenMeta(icon).label + ' ' + (index + 1);
      return '<button class="tap-piece ' + (selected.has(index) ? 'selected' : '') + '" data-piece="' + index + '" aria-label="' + attr(label) + '" aria-pressed="' + selected.has(index) + '">' + visualTokenHtml(icon) + '</button>';
    }) + '</div>';
  }

  function gridPanel(size, active, interactive, selected, variant) {
    const activeSet = new Set(active || []);
    const selectedSet = new Set(selected || []);
    const isDot = variant === 'dot';
    return '<div class="grid-panel ' + (isDot ? 'dot-panel' : '') + '">' + repeat(size * size, function (index) {
      if (interactive) {
        return '<button class="grid-cell ' + (selectedSet.has(index) ? 'selected' : '') + '" data-piece="' + index + '" aria-label="' + (isDot ? 'てん ' : 'マス ') + (index + 1) + '" aria-pressed="' + selectedSet.has(index) + '"></button>';
      }
      return '<span class="grid-cell ' + (activeSet.has(index) ? 'target' : '') + '"></span>';
    }) + '</div>';
  }

  function parseClock(value) {
    const parts = String(value || '12:00').split(':');
    return { hour: Math.max(1, Math.min(12, Number(parts[0]) || 12)), minute: Math.max(0, Math.min(55, Number(parts[1]) || 0)) };
  }

  function clockHtml(value) {
    const clock = parseClock(value);
    const hourRotation = clock.hour * 30 + clock.minute * .5;
    const minuteRotation = clock.minute * 6;
    return '<div class="clock-board"><div class="clock-face"><span class="clock-number n12">12</span><span class="clock-number n3">3</span><span class="clock-number n6">6</span><span class="clock-number n9">9</span><span class="clock-hand hour" style="--rotation:' + hourRotation + 'deg"></span><span class="clock-hand minute" style="--rotation:' + minuteRotation + 'deg"></span><span class="clock-pin"></span></div></div>';
  }

  function unitLengthHtml(question, line, interactive) {
    const visual = question.visual || {};
    const targetUnits = Math.max(1, Math.min(10, Number(visual.targetUnits) || 1));
    const maxUnits = Math.max(targetUnits, Math.min(10, Number(visual.maxUnits) || 10));
    const selected = new Set(question.selected || []);
    const gridStyle = 'grid-template-columns:repeat(' + maxUnits + ',minmax(18px,44px))';
    const blocks = repeat(maxUnits, function (index) {
      const active = interactive ? selected.has(index) : index < targetUnits;
      if (!interactive) return '<span class="unit-measure-block ' + (active ? 'selected' : 'ghost') + '"></span>';
      return '<button class="unit-measure-block ' + (active ? 'selected' : '') + '" data-piece="' + index + '" aria-label="ここまでで' + (index + 1) + 'こ分" aria-pressed="' + active + '"></button>';
    });
    return '<div class="visual-board" style="' + lineStyle(line) + '"><div class="unit-measure-board"><strong>この ぼうの ながさ</strong><div class="unit-target-grid" style="' + gridStyle + '"><span class="unit-target-bar" style="grid-column:1 / span ' + targetUnits + '"></span></div><strong>' + (interactive ? 'ブロックの 右はしを タップ' : 'ブロック1こ分ずつ かぞえる') + '</strong><div class="unit-measure-grid" style="' + gridStyle + '">' + blocks + '</div></div></div>';
  }

  function visualHtml(question, line) {
    const visual = question.visual || {};
    if (visual.type === 'unit-length-builder') return unitLengthHtml(question, line, true);
    if (visual.type === 'unit-length-count') return unitLengthHtml(question, line, false);
    if (question.kind === 'tap' || question.kind === 'remove') {
      return '<div class="visual-board" style="' + lineStyle(line) + '">' + interactivePieces(question, line) + '</div>';
    }
    if (question.kind === 'select') {
      if (visual.type === 'grid-copy' || visual.type === 'dot-copy') {
        const dotVariant = visual.type === 'dot-copy' ? 'dot' : '';
        return '<div class="visual-board" style="' + lineStyle(line) + '"><div class="grid-copy"><div><strong>みほん</strong>' + gridPanel(visual.size || 3, visual.target, false, [], dotVariant) + '</div><div><strong>つくるところ</strong>' + gridPanel(visual.size || 3, [], true, question.selected, dotVariant) + '</div></div></div>';
      }
      const target = visual.start == null ? [] : [visual.start];
      return '<div class="visual-board" style="' + lineStyle(line) + '"><div class="grid-copy"><div><strong>いまの ばしょ</strong>' + gridPanel(visual.size || 3, target, false) + '</div><div><strong>コピーする ところ</strong>' + gridPanel(visual.size || 3, [], true, question.selected) + '</div></div></div>';
    }
    if (visual.type === 'clock-read') {
      return '<div class="visual-board" style="' + lineStyle(line) + '">' + clockHtml(visual.value) + '</div>';
    }
    if (question.kind === 'clock') {
      return '<div class="visual-board" style="' + lineStyle(line) + '">' + clockHtml(question.input) + '</div>';
    }
    if (visual.type === 'objects') {
      return '<div class="visual-board" style="' + lineStyle(line) + '"><div class="object-grid">' + repeat(visual.count, function () { return '<span class="object-chip">' + visualTokenHtml(visual.icon || '■') + '</span>'; }) + '</div></div>';
    }
    if (visual.type === 'five-frame') {
      return '<div class="visual-board" style="' + lineStyle(line) + '">' + fiveFrame(visual.count) + '</div>';
    }
    if (visual.type === 'compare-groups') {
      return '<div class="visual-board" style="' + lineStyle(line) + '"><div class="group-compare"><div class="compare-side"><span class="axis-label">ひだり</span><div class="group-box">' + miniParts(visual.left) + '</div></div><span class="compare-divider">くらべる</span><div class="compare-side"><span class="axis-label">みぎ</span><div class="group-box">' + miniParts(visual.right) + '</div></div></div></div>';
    }
    if (visual.type === 'bond') {
      return '<div class="visual-board" style="' + lineStyle(line) + '"><div class="ten-frame-wrap">' + tenFrame(visual.known) + '<span class="operation-symbol">?</span><strong>' + visual.target + 'こにする</strong></div></div>';
    }
    if (visual.type === 'number-line' || visual.type === 'rail') {
      const values = visual.values || [visual.min, visual.min + 1, visual.min + 2, visual.max];
      return '<div class="visual-board" style="' + lineStyle(line) + '"><div class="number-rail">' + values.map(function (value, index) {
        return (index ? '<span class="rail-link"></span>' : '') + '<span class="rail-stop">' + esc(value) + '</span>';
      }).join('') + '</div></div>';
    }
    if (visual.type === 'number-line-back') {
      const values = [visual.start, visual.start - visual.steps, visual.target];
      return '<div class="visual-board" style="' + lineStyle(line) + '"><div class="number-rail"><span class="rail-stop">' + visual.start + '</span><span class="rail-link"></span><span class="operation-symbol">−' + visual.steps + '</span><span class="rail-link"></span><span class="rail-stop">?</span></div></div>';
    }
    if (visual.type === 'row') {
      return '<div class="visual-board" style="' + lineStyle(line) + '"><div class="object-grid">' + visual.items.map(function (item) { return '<span class="object-chip">' + visualTokenHtml(item) + '</span>'; }).join('') + '</div><p class="direction-guide">' + (visual.direction === 'right' ? '<b>みぎから</b> ひとつずつ かぞえる' : '<b>ひだりから</b> ひとつずつ かぞえる') + '</p></div>';
    }
    if (visual.type === 'ten-bundle' || visual.type === 'ten-bundle-remove') {
      const number = visual.type === 'ten-bundle' ? visual.tens * 10 + visual.ones : visual.a;
      return '<div class="visual-board" style="' + lineStyle(line) + '"><div class="ten-frame-wrap">' + tenFrame(Math.min(10, number)) + '<div class="loose-parts">' + miniParts(Math.max(0, number - 10)) + '</div></div></div>';
    }
    if (visual.type === 'place-value' || visual.type === 'place-value-remove') {
      const number = visual.type === 'place-value' ? visual.tens * 10 + visual.ones : visual.a;
      const tens = Math.floor(number / 10);
      const ones = number % 10;
      return '<div class="visual-board" style="' + lineStyle(line) + '"><div class="place-value-board"><div class="place-column"><strong>' + (activeCourseId === 'g1' ? '10の くらい' : '十の位') + '</strong><div class="bundle-stack">' + repeat(tens, function () { return '<span class="ten-stick"></span>'; }) + '</div></div><div class="place-column"><strong>' + (activeCourseId === 'g1' ? '1の くらい' : '一の位') + '</strong><div class="bundle-stack">' + repeat(ones, function () { return '<span class="one-cube"></span>'; }) + '</div></div></div></div>';
    }
    if (visual.type === 'place-value-compare') {
      return '<div class="visual-board" style="' + lineStyle(line) + '"><div class="relation-board"><span class="relation-node">' + visual.left + '</span><span class="operation-symbol">?</span><span class="relation-node">' + visual.right + '</span></div></div>';
    }
    if (visual.type === 'merge' || visual.type === 'crane' || visual.type === 'story') {
      const counts = visual.counts || [0, 0];
      return '<div class="visual-board" style="' + lineStyle(line) + '"><div class="merge-board"><div class="belt-box"><strong>' + counts[0] + '</strong>' + (activeCourseId === 'g1' ? 'こ' : '部品') + '</div><span class="operation-symbol">' + esc(visual.operation || '+') + '</span><div class="belt-box"><strong>' + counts[1] + '</strong>' + (activeCourseId === 'g1' ? 'こ' : '部品') + '</div></div></div>';
    }
    if (visual.type === 'dial') {
      return '<div class="visual-board" style="' + lineStyle(line) + '"><div class="relation-board"><span class="relation-node">' + visual.counts[0] + '</span><span class="operation-symbol">' + esc(visual.operation) + '</span><span class="relation-node">' + visual.counts[1] + '</span></div></div>';
    }
    if (visual.type === 'three-step') {
      return '<div class="visual-board" style="' + lineStyle(line) + '"><div class="number-rail"><span class="rail-stop">' + visual.values[0] + '</span><span class="rail-link"></span><span class="operation-symbol">' + visual.ops[0] + visual.values[1] + '</span><span class="rail-link"></span><span class="operation-symbol">' + visual.ops[1] + visual.values[2] + '</span><span class="rail-link"></span><span class="rail-stop">?</span></div></div>';
    }
    if (visual.type === 'circuit') {
      if (activeCourseId === 'g1') return '<div class="visual-board" style="' + lineStyle(line) + '"><div class="work-order-card"><small>しき・おはなし</small><strong>' + childText(visual.equation || 'こたえを えらぼう') + '</strong></div></div>';
      return '<div class="visual-board" style="' + lineStyle(line) + '"><div class="circuit-board"><span class="circuit-node"></span><span class="circuit-wire"></span><span class="circuit-node"></span><div><small>けいさんモニター</small><strong>' + esc(visual.equation || '正しい回路をえらぶ') + '</strong></div></div></div>';
    }
    if (visual.type === 'make-ten' || visual.type === 'break-ten') {
      const a = visual.a;
      return '<div class="visual-board" style="' + lineStyle(line) + '"><div class="ten-frame-wrap">' + tenFrame(Math.min(10, a)) + '<div><strong>' + a + (visual.type === 'make-ten' ? ' ＋ ' : ' − ') + visual.b + '</strong><p class="muted">10の まとまりを つかう</p></div></div></div>';
    }
    if (visual.type === 'remove' || visual.type === 'switch') {
      const total = visual.total;
      return '<div class="visual-board" style="' + lineStyle(line) + '"><div class="object-grid">' + repeat(total, function () { return '<span class="object-chip">' + visualTokenHtml(activeCourseId === 'g1' ? 'count-dot' : '■') + '</span>'; }) + '</div><p class="direction-guide">' + (visual.mode === 'none' ? 'ひとつも とらない' : visual.mode === 'all' ? 'ぜんぶ とる' : 'とる かずを かんがえよう') + '</p></div>';
    }
    if (visual.type === 'length-position-compare') {
      const method = visual.method === 'indirect' ? '<div class="length-method-chip"><small>くらべる じゅんび</small><strong>テープに うつして、はじまりを そろえたよ</strong></div>' : '<div class="length-method-chip"><small>くらべる じゅんび</small><strong>2ほんの はじまりを そろえたよ</strong></div>';
      return '<div class="visual-board" style="' + lineStyle(line) + '"><div class="length-position-board">' + method + '<div class="length-position-pair"><div class="length-position-item" data-length-side="left"><div class="length-upright"><span class="length-stick" style="--length:' + visual.left + ';--bar-color:' + line.accent + '"></span></div><strong>ひだり</strong></div><div class="length-position-item" data-length-side="right"><div class="length-upright"><span class="length-stick" style="--length:' + visual.right + ';--bar-color:#ffd45c"></span></div><strong>みぎ</strong></div></div><div class="length-baseline">▲ 二本の はじまり</div></div></div>';
    }
    if (visual.type === 'length') {
      return '<div class="visual-board" style="' + lineStyle(line) + '"><div class="length-board"><span class="length-bar" style="--length:' + visual.left + ';--bar-color:' + line.accent + '"></span><span class="length-bar ' + (visual.aligned ? '' : 'offset') + '" style="--length:' + visual.right + ';--bar-color:#ffd45c"></span></div></div>';
    }
    if (visual.type === 'unit-length') {
      return '<div class="visual-board" style="' + lineStyle(line) + '"><div class="unit-strip">' + repeat(visual.count, function () { return '<span class="unit-block"></span>'; }) + '</div></div>';
    }
    if (visual.type === 'tools') {
      return '<div class="visual-board" style="' + lineStyle(line) + '"><div class="work-order-card"><small>しらべたいこと</small><strong>' + childText(visual.scene) + '</strong><span>' + (activeCourseId === 'g1' ? 'ぴったりの やりかたを えらぼう' : 'この場面に合う道具や方法を考えよう') + '</span></div></div>';
    }
    if (visual.type === 'measure-method') {
      return '<div class="visual-board" style="' + lineStyle(line) + '"><div class="measure-method-scene" data-method-scene="' + attr(visual.sceneId) + '">' + methodSceneHtml(visual.sceneId, false) + '<div><small>' + (activeCourseId === 'g1' ? 'いまの ばめん' : 'いまの場面') + '</small><strong>' + childText(visual.title) + '</strong><p>' + childText(visual.detail) + '</p></div></div></div>';
    }
    if (visual.type === 'capacity') {
      return '<div class="visual-board" style="' + lineStyle(line) + '"><div class="tank-board"><div class="compare-side"><span class="axis-label">ひだり</span><div class="tank"><span class="tank-fill" style="--fill:' + visual.left + '"></span></div></div><div class="compare-side"><span class="axis-label">みぎ</span><div class="tank"><span class="tank-fill" style="--fill:' + visual.right + '"></span></div></div></div></div>';
    }
    if (visual.type === 'area') {
      return '<div class="visual-board" style="' + lineStyle(line) + '"><div class="area-board"><div class="compare-side"><span class="axis-label">ひだり</span><div class="area-grid">' + repeat(12, function (index) { return '<span class="area-cell ' + (index < visual.left ? 'filled' : '') + '"></span>'; }) + '</div></div><div class="compare-side"><span class="axis-label">みぎ</span><div class="area-grid">' + repeat(12, function (index) { return '<span class="area-cell ' + (index < visual.right ? 'filled' : '') + '"></span>'; }) + '</div></div></div></div>';
    }
    if (visual.type === 'solid-scan' || visual.type === 'solid-action' || visual.type === 'stamp') {
      const solidValue = visual.icon || visual.solid;
      const solidLabel = visual.object || tokenMeta(solidValue).label;
      return '<div class="visual-board" style="' + lineStyle(line) + '"><div class="solid-board"><div class="solid-focus"><small>しらべる かたち</small>' + visualTokenHtml(solidValue, 'solid-token-visual', solidLabel) + '</div>' + (visual.face ? '<span class="operation-symbol">→</span><div class="face-card"><small>うつした めん</small><strong>' + childText(visual.face) + '</strong></div>' : '') + '</div></div>';
    }
    if (visual.type === 'sort') {
      const itemKnown = tokenMeta(visual.item).className !== 'text';
      const itemLabel = visual.itemLabel || tokenMeta(visual.item).label;
      const itemHtml = itemKnown ? visualTokenHtml(visual.item, 'sort-visual-item', itemLabel) : '<strong class="sort-text-item">' + childText(itemLabel) + '</strong>';
      return '<div class="visual-board" style="' + lineStyle(line) + '"><div class="sort-board"><div class="sort-focus"><small>わけるもの</small>' + itemHtml + '</div><div class="sort-guide">どの なかまかな？</div><div class="sort-bins">' + visual.bins.map(function (bin) { return '<span class="sort-bin"><small>なかま</small><strong>' + childText(bin) + '</strong></span>'; }).join('') + '</div></div></div>';
    }
    if (visual.type === 'transform') {
      return '<div class="visual-board" style="' + lineStyle(line) + '"><div class="shape-workbench"><div class="tangram-pieces">' + repeat(visual.pieces, function (index) { return '<span class="tangram-piece piece-' + (index % 4) + '"></span>'; }) + '</div><div class="turn-card"><small>うごかし かた</small><strong>まわす・うらがえす・つなぐ</strong></div></div></div>';
    }
    if (visual.type === 'aligned-data' || visual.type === 'graph') {
      return '<div class="visual-board" style="' + lineStyle(line) + '">' + graphHtml(visual.labels, visual.counts) + '</div>';
    }
    if (visual.type === 'operation-choice') {
      return '<div class="visual-board" style="' + lineStyle(line) + '"><div class="relation-board"><span class="relation-node">ばめん</span><span class="operation-symbol">?</span><span class="relation-node">＋ / −</span></div></div>';
    }
    if (visual.type === 'story-model' || visual.type === 'relation') {
      const math = visual.math || question.math || {};
      return '<div class="visual-board" style="' + lineStyle(line) + '"><div class="relation-board"><span class="relation-node">' + esc(math.a == null ? 'お話' : math.a) + '</span><span class="operation-symbol">' + (math.kind === 'subtract' ? '−' : '+') + '</span><span class="relation-node">' + esc(math.b == null ? '?' : math.b) + '</span></div></div>';
    }
    if (visual.type === 'equal-groups') {
      return '<div class="visual-board" style="' + lineStyle(line) + '"><div class="object-grid">' + repeat(visual.groups, function () { return '<span class="object-chip">' + visual.perGroup + 'こ</span>'; }) + '</div><p class="muted">おなじ かずずつの グループ</p></div>';
    }
    return '<div class="visual-board" style="' + lineStyle(line) + '"><div class="machine-screen"><strong>' + (activeCourseId === 'g1' ? 'もんだい' : 'ひらめき装置') + '</strong><span>' + (activeCourseId === 'g1' ? 'よく みて こたえよう' : '操作して答えを見つけよう') + '</span></div></div>';
  }

  function optionLabel(option) {
    return typeof option === 'object' && option !== null ? option.label : option;
  }

  function optionValue(option) {
    return C.optionValue(option);
  }

  function answerLayoutClass(question) {
    const allowed = ['horizontal-axis', 'vertical-axis', 'depth-axis', 'relation'];
    const layout = allowed.includes(question.optionLayout) ? question.optionLayout : 'neutral';
    const count = Math.max(1, Math.min(4, (question.options || []).length));
    return 'answers answers--' + layout + ' answers--count-' + count + (question.visual && question.visual.type === 'measure-method' ? ' method-options' : '');
  }

  function answerButtonContent(option, question) {
    const label = String(optionLabel(option));
    const displayLabel = gradeOneReading(label);
    const icon = typeof option === 'object' && option !== null ? option.icon : '';
    if (question.visual && question.visual.type === 'measure-method' && typeof option === 'object' && option !== null) {
      return methodSceneHtml(String(option.value), true) + '<span>' + esc(displayLabel) + '</span>';
    }
    const arrow = question.optionLayout === 'horizontal-axis' && label === 'ひだり' ? '←' : question.optionLayout === 'horizontal-axis' && label === 'みぎ' ? '→' : '';
    const iconHtml = icon ? (tokenMeta(icon).className === 'text' ? '' : visualTokenHtml(icon, 'answer-visual-token')) : '';
    return iconHtml + '<span>' + (arrow && label === 'ひだり' ? esc(arrow + ' ' + displayLabel) : arrow ? esc(displayLabel + ' ' + arrow) : esc(displayLabel)) + '</span>';
  }

  function actionHtml(question, line) {
    if (question.feedback) return feedbackHtml(question);
    if (question.kind === 'choice' || question.kind === 'route' || question.kind === 'sort') {
      return '<div class="' + answerLayoutClass(question) + '">' + (question.options || []).map(function (option) {
        return '<button class="answer-button' + (question.visual && question.visual.type === 'measure-method' ? ' method-answer' : '') + '" style="' + lineStyle(line) + '" data-answer="' + attr(optionValue(option)) + '">' + answerButtonContent(option, question) + '</button>';
      }).join('') + '</div>';
    }
    if (question.kind === 'tap' || question.kind === 'remove' || question.kind === 'select') {
      if (question.visual && question.visual.type === 'unit-length-builder') {
        const units = (question.selected || []).length;
        return '<div class="operation-panel unit-length-operation"><div class="operation-readout">いま：ブロック ' + units + 'こぶん</div><div class="submit-row"><button class="soft-button" data-action="reset-operation">やりなおす</button><button class="primary-button" style="' + lineStyle(line) + '" data-action="submit-operation">この ながさで けってい</button></div></div>';
      }
      const countUnit = question.visual && question.visual.type === 'sticks' ? 'ほん' : 'こ';
      const current = question.kind === 'select' ? (question.selected || []).length + 'マス' : (question.selected || []).length + countUnit;
      return '<div class="operation-panel"><div class="operation-readout">' + current + ' えらんだ</div><div class="submit-row"><button class="soft-button" data-action="reset-operation">やりなおす</button><button class="primary-button" style="' + lineStyle(line) + '" data-action="submit-operation">けってい</button></div></div>';
    }
    if (question.kind === 'order') {
      const selected = question.orderSelected || [];
      return '<div class="operation-panel"><div class="order-workbench"><div class="order-source">' + question.options.map(function (value) {
        return '<button class="order-chip" data-order-value="' + attr(value) + '" ' + (selected.map(String).includes(String(value)) ? 'disabled' : '') + '>' + childText(value) + '</button>';
      }).join('') + '</div><div class="order-target">' + (selected.length ? selected.map(function (value) { return '<span class="order-chip">' + childText(value) + '</span>'; }).join('') : '<span class="muted">ここへ じゅんばんに ならぶよ</span>') + '</div></div><div class="submit-row"><button class="soft-button" data-action="reset-operation">やりなおす</button><button class="primary-button" style="' + lineStyle(line) + '" data-action="submit-operation">けってい</button></div></div>';
    }
    if (question.kind === 'slider') {
      const value = question.input === '' ? question.min : question.input;
      return '<div class="operation-panel"><div class="operation-readout">' + esc(value) + '</div><div class="adjuster"><button class="adjust-button" style="' + lineStyle(line) + '" data-adjust="-1" aria-label="かずを 1へらす">−</button><div class="adjust-value">−と＋で かずを かえる</div><button class="adjust-button" style="' + lineStyle(line) + '" data-adjust="1" aria-label="かずを 1ふやす">＋</button></div><div class="submit-row"><button class="primary-button" style="' + lineStyle(line) + '" data-action="submit-operation">この かずに する</button></div></div>';
    }
    if (question.kind === 'clock') {
      const clock = parseClock(question.input);
      return '<div class="operation-panel"><div class="operation-readout">' + clock.hour + ':' + String(clock.minute).padStart(2, '0') + '</div><div class="clock-controls"><div class="clock-control"><strong>みじかい はり</strong><div class="clock-button-row"><button class="adjust-button" style="' + lineStyle(line) + '" data-clock-part="hour" data-clock-delta="-1">−</button><button class="adjust-button" style="' + lineStyle(line) + '" data-clock-part="hour" data-clock-delta="1">＋</button></div></div><div class="clock-control"><strong>ながい はり</strong><div class="clock-button-row"><button class="adjust-button" style="' + lineStyle(line) + '" data-clock-part="minute" data-clock-delta="-1">−</button><button class="adjust-button" style="' + lineStyle(line) + '" data-clock-part="minute" data-clock-delta="1">＋</button></div></div></div><div class="submit-row"><button class="primary-button" style="' + lineStyle(line) + '" data-action="submit-operation">この じこくで けってい</button></div></div>';
    }
    return '<div class="operation-panel"><div class="operation-readout">' + esc(question.input || '？') + '</div><div class="keypad">' + [1, 2, 3, 4, 5, 6, 7, 8, 9, 'けす', 0, 'けってい'].map(function (key) { return '<button class="key-button" data-key="' + key + '">' + key + '</button>'; }).join('') + '</div></div>';
  }

  function feedbackHtml(question) {
    const feedback = question.feedback;
    const good = feedback.kind === 'good' || feedback.kind === 'recovered';
    const buttonLabel = feedback.action === 'retry' ? (session && session.mode === 'timeAttack' ? 'もういちど' : 'ヒントを みて もういちど') : 'つぎへ';
    return '<div class="feedback-panel ' + (good ? 'good' : 'hint') + '"><h3>' + childText(feedback.title) + '</h3><p>' + childText(feedback.text) + '</p><button class="' + (good ? 'primary-button' : 'secondary-button') + '" data-action="' + (feedback.action === 'retry' ? 'retry-question' : 'next-question') + '">' + buttonLabel + ' →</button></div>';
  }

  function renderQuestionCard(question, line, rush) {
    const interactionLabels = activeCourseId === 'g1' ? {
      choice: 'ひとつ えらぶ', route: 'こたえを えらぶ', sort: 'なかまを えらぶ',
      tap: 'まるを タップ', remove: 'まるを とる', select: 'マスを タップ',
      order: 'じゅんに ならべる', slider: 'かずを かえる', clock: 'はりを うごかす', input: 'すうじを いれる'
    } : {
      choice: '一つ えらぶ', route: '道を えらぶ', sort: 'トレイを えらぶ',
      tap: '部品を タップ', remove: '部品を 取り出す', select: 'マスを タップ',
      order: '順番に ならべる', slider: '数を あわせる', clock: '針を うごかす', input: '数字を 入れる'
    };
    let interactionLabel = interactionLabels[question.kind] || interactionLabels.input;
    if (activeCourseId === 'g1' && question.visual) {
      if (question.visual.type === 'unit-length-builder') interactionLabel = 'ブロックを タップ';
      if (question.visual.type === 'sticks') interactionLabel = 'ぼうを タップ';
      if (question.visual.type === 'graph-build') interactionLabel = 'しるしを タップ';
      if (question.visual.type === 'dot-copy') interactionLabel = 'てんを タップ';
    }
    const tags = [
      '<span class="question-tag action">' + interactionLabel + '</span>',
      question.story ? '<span class="question-tag story">おはなし</span>' : '',
      question.checkpoint ? '<span class="question-tag check">かくにん</span>' : '',
      rush ? '<span class="question-tag check">TIME ATTACK</span>' : ''
    ].join('');
    const hint = question.showHint && !rush && !question.feedback ? '<div class="inline-hint"><strong>トトの ヒント：</strong>' + childText(question.hint) + '</div>' : '';
    return [
      '<section class="', rush ? 'rush-question' : 'question-card', '" style="', lineStyle(line), '">',
      '<div class="question-tags">', tags, '</div>',
      '<h1 class="question-title">', childText(question.prompt), '</h1>',
      '<div class="question-instruction"><small>やること</small><strong>', childText(question.instruction), '</strong></div>',
      visualHtml(question, line),
      actionHtml(question, line),
      hint,
      '</section>'
    ].join('');
  }

  function currentQuestion() {
    return session && session.questions[session.cursor];
  }

  function normalizeQuestionInput(question) {
    if (question.kind === 'tap' || question.kind === 'remove') return (question.selected || []).length;
    if (question.kind === 'select') return (question.selected || []).slice().sort(function (a, b) { return a - b; }).join(',');
    if (question.kind === 'order') return (question.orderSelected || []).join(',');
    return question.input;
  }

  function handleAnswer(value) {
    const question = currentQuestion();
    if (!question || question.feedback) return;
    const answer = value == null ? normalizeQuestionInput(question) : value;
    question.attempts += 1;
    const correct = C.answerEquals(question.correct, answer);
    if (session.mode === 'timeAttack') {
      if (correct) {
        session.correct += 1;
        session.chain += 1;
        session.bestChain = Math.max(session.bestChain, session.chain);
        question.feedback = { kind: 'good', title: 'せいかい！', text: question.explain, action: 'next' };
        playTone('good');
      } else {
        session.mistakes += 1;
        session.chain = 0;
        session.timer.penaltyMs += TIME_ATTACK_PENALTY_MS;
        question.feedback = { kind: 'hint', title: '＋3びょう', text: 'おなじ もんだいを もういちど。', action: 'retry' };
        playTone('hint');
      }
      render();
      updateRushTimer();
      return;
    }
    const first = question.attempts === 1;
    state.stats.totalAnswers += 1;
    state.lineStats[session.lineId].totalAnswers += 1;
    if (correct) {
      state.stats.correctAnswers += 1;
      state.lineStats[session.lineId].correctAnswers += 1;
      if (first) {
        session.correct += 1;
        session.chain += 1;
        session.bestChain = Math.max(session.bestChain, session.chain);
        question.feedback = { kind: 'good', title: 'せいかい！', text: question.explain, action: 'next' };
      } else {
        question.feedback = { kind: 'recovered', title: 'ひらめいた！', text: question.explain, action: 'next' };
      }
      playTone('good');
    } else {
      session.chain = 0;
      question.showHint = true;
      question.feedback = { kind: 'hint', title: 'ここを 見てみよう', text: question.hint, action: 'retry' };
      playTone('hint');
    }
    saveState();
    render();
  }

  function resetQuestionInteraction(question) {
    question.selected = [];
    question.orderSelected = [];
    question.input = question.initialInput == null ? '' : question.initialInput;
  }

  function retryQuestion() {
    const question = currentQuestion();
    if (!question) return;
    question.feedback = null;
    resetQuestionInteraction(question);
    render();
  }

  function nextQuestion() {
    if (!session) return;
    if (session.cursor >= session.questions.length - 1) {
      if (session.mode === 'timeAttack') finishTimeAttack();
      else finishStage();
      return;
    }
    session.cursor += 1;
    playTone('tap');
    render();
    if (session.mode === 'timeAttack') updateRushTimer();
  }

  function finishStage() {
    const line = lineFor(session.lineId);
    const stage = line.stages[session.stageIndex];
    const elapsed = Math.max(1, Math.round((Date.now() - session.startedAt) / 1000));
    const score = session.correct;
    const cleared = score >= 5;
    const stars = score === 8 ? 3 : score >= 7 ? 2 : score >= 5 ? 1 : 0;
    const old = state.progress[stage.id] || { attempts: 0, bestScore: 0, stars: 0, seconds: 0 };
    const firstClear = cleared && !old.cleared;
    state.progress[stage.id] = {
      cleared: Boolean(old.cleared || cleared),
      attempts: Number(old.attempts || 0) + 1,
      bestScore: Math.max(Number(old.bestScore || 0), score),
      stars: Math.max(Number(old.stars || 0), stars),
      seconds: !old.seconds || elapsed < old.seconds ? elapsed : old.seconds,
      lastSeed: session.seed
    };
    if (firstClear) state.parts[stage.id] = true;
    state.stats.totalSeconds += elapsed;
    state.lineStats[line.id].totalSeconds += elapsed;
    state.stats.bestChain = Math.max(state.stats.bestChain, session.bestChain);
    state.lineStats[line.id].bestChain = Math.max(state.lineStats[line.id].bestChain, session.bestChain);
    state.history.push({
      mode: 'standard',
      courseId: activeCourseId,
      gradeId: activeCourseId,
      lineId: line.id,
      islandId: line.id,
      stage: stage.id,
      score,
      stars,
      cleared,
      seconds: elapsed,
      seed: session.seed,
      at: new Date().toISOString()
    });
    state.history = state.history.slice(-240);
    const firstLineComplete = firstClear && lineComplete(line.id);
    const completedLines = completedLineCount();
    const courseCompleted = completedLines === LINE_ORDER.length;
    if (firstLineComplete) markStoryBeat('line-complete', line.id, activeCourseId);
    ui.result = {
      mode: 'standard',
      courseId: activeCourseId,
      gradeId: activeCourseId,
      lineId: line.id,
      islandId: line.id,
      stageIndex: session.stageIndex,
      score,
      stars,
      cleared,
      elapsed,
      firstClear,
      lineCompleted: lineComplete(line.id),
      firstLineComplete,
      completedLines,
      courseCompleted,
      firstCourseComplete: firstClear && courseCompleted
    };
    ui.screen = 'result';
    session = null;
    saveState();
    playTone(cleared ? 'finish' : 'hint');
    render();
    global.scrollTo(0, 0);
  }

  function renderResult() {
    const result = ui.result;
    if (!result) return renderHome();
    const gradeOne = activeCourseId === 'g1';
    const line = lineFor(result.lineId);
    const stage = line.stages[result.stageIndex];
    const lineStory = activeLineStory(line.id);
    const stageStory = S ? S.stageStory(activeCourseId, line.id, result.stageIndex, stage) : null;
    const zoneIndex = line.zones.findIndex(function (zone) { return Number(zone.range[1]) === result.stageIndex; });
    const next = result.stageIndex + 1;
    const nextButton = result.cleared && next < line.stages.length
      ? '<button class="primary-button" style="' + lineStyle(line) + '" data-stage="' + next + '">つぎのステージ →</button>'
      : '<button class="primary-button" style="' + lineStyle(line) + '" data-nav="map">' + (gradeOne ? 'ステージへ もどる' : '設計図へ もどる') + '</button>';
    return shell([
      '<main class="result-card" style="', lineStyle(line), '"><div class="result-burst"><small>', result.cleared ? 'STAGE' : 'RETRY', '</small><b>', result.cleared ? stage.n : '↻', '</b></div>',
      '<div class="eyebrow">', gradeOne ? 'ステージ ' + stage.n : 'REPAIR REPORT', '</div><h1>', result.cleared ? (gradeOne ? 'できた！' : 'しゅうり かんりょう！') : 'もういちど ためそう', '</h1>',
      '<p>', gradeOne ? (result.cleared ? 'さいごまで よく かんがえたね。' : 'トトの ヒントを みて、もういちど やってみよう。') : (result.cleared ? esc(stage.part) + 'を取り付けました。考えたことが装置の動きになったね。' : '装置はまだ点滅中。5問正解すると修理できます。トトのヒントでもう一度見てみよう。'), '</p>',
      result.firstClear && stageStory ? (gradeOne ? '<section class="world-change-card"><div class="eyebrow">ルミナ</div><h2>ひかりが ひとつ ふえた！</h2><p>「' + childText(stage.name) + '」が できるように なったね。</p></section>' : '<section class="world-change-card"><div class="eyebrow">WORKSHOP UPDATE</div><h2>' + esc(stage.name) + 'が動いた！</h2><p>' + esc(storyText(stageStory.effect)) + '</p></section>') : result.cleared ? '<div class="adjustment-note">' + (gradeOne ? 'まえより じょうずに できた！' : '調整完了。前よりなめらかに動いた！') + '</div>' : '',
      result.firstClear && zoneIndex >= 0 && lineStory ? (gradeOne ? '<div class="zone-story-update"><strong>ここまで できた！</strong><span>つぎの ステージも やってみよう。</span></div>' : '<div class="zone-story-update"><strong>さぎょうくかく クリア</strong><span>' + esc(storyText(lineStory.zoneEffects[zoneIndex])) + '</span></div>') : '',
      '<div class="score-grid"><div class="score-box"><strong>', result.score, ' / 8</strong><small>', gradeOne ? '1かいで できた' : 'さいしょの正解', '</small></div><div class="score-box"><strong>', marksText(result.stars), '</strong><small>', gradeOne ? 'しるし' : 'ひらめき印', '</small></div><div class="score-box"><strong>', result.elapsed, gradeOne ? 'びょう' : '秒', '</strong><small>', gradeOne ? 'かかった じかん' : 'しゅうり時間', '</small></div></div>',
      result.firstLineComplete ? (gradeOne ? '<section class="line-complete-story"><div><div class="eyebrow">11 / 11 できた</div><h2>' + childText(line.short) + 'を ぜんぶ クリア！</h2><p>ルミナが もっと げんきに なったよ。</p><small>タイムアタックも できるように なりました。</small></div></section>' : (lineStory ? '<section class="line-complete-story"><div class="core-assembly"><span class="line-core-badge"><small>LINE</small><b>' + lineNumber(line.id) + '</b></span><span class="core-connector"></span><b class="lumina-word">CORE</b></div><div><div class="eyebrow">LINE RESTORED・11 / 11</div><h2>' + esc(storyText(lineStory.completeTitle)) + '</h2><p>' + esc(storyText(lineStory.completeText)) + '</p><small>修理後の高速点検「タイムアタック」がひらきました。</small></div></section>' : '<div class="rush-unlock">' + esc(line.name) + 'の タイムアタックが ひらきました！</div>')) : '',
      result.firstCourseComplete && activeCourseStory() && activeCourseStory().finale ? '<section class="course-complete-teaser"><strong>' + (gradeOne ? '1ねんせいを ぜんぶ クリア！' : '六つのコアがそろった！') + '</strong><span>' + (gradeOne ? 'ルミナが げんきに なったよ。' : 'ルミナを さいごまで うごかそう。') + '</span><button class="secondary-button" data-action="show-course-finale">' + (gradeOne ? 'おはなしを みる' : 'くかくの かんせいを みる') + ' →</button></section>' : '',
      '<div class="button-row" style="justify-content:center;margin-top:22px"><button class="soft-button" data-action="retry-stage" data-stage="', result.stageIndex, '">もういちど</button>', nextButton,
      result.lineCompleted ? '<button class="secondary-button" data-action="start-rush" data-line="' + line.id + '">タイムアタック</button>' : '', '</div>',
      '<div class="button-row" style="justify-content:center;margin-top:16px"><span class="muted">どんな きもち？</span><button class="soft-button compact-button" data-mood="fun" data-stage-id="', stage.id, '">たのしい</button><button class="soft-button compact-button" data-mood="okay" data-stage-id="', stage.id, '">できた</button><button class="soft-button compact-button" data-mood="hard" data-stage-id="', stage.id, '">むずかしい</button></div>',
      '</main>'
    ].join(''), '');
  }

  function startTimeAttack(lineId) {
    const line = lineFor(lineId);
    if (!lineComplete(line.id) && !adminUnlockActive()) {
      showToast(activeCourseId === 'g1' ? '11この ステージが できると ひらくよ' : '11ステージを しゅうりすると ひらきます');
      return;
    }
    const seed = randomSeed();
    const recent = Array.isArray(state.recentRush[line.id]) ? state.recentRush[line.id] : [];
    const pack = K
      ? K.makeTimeAttackQuestions(activeCourseId, line.id, { seed, exclude: recent })
      : C.makeTimeAttackQuestions(line.id, { seed, exclude: recent });
    pack.questions.forEach(function (question) { question.initialInput = question.input; });
    state.recentRush[line.id] = recent.concat(pack.questions.reduce(function (keys, question) {
      keys.push(question.signature);
      if (activeCourseId === 'g1' && question.contentSignature) keys.push(question.contentSignature);
      return keys;
    }, [])).slice(activeCourseId === 'g1' ? -24 : -36);
    session = {
      mode: 'timeAttack',
      courseId: activeCourseId,
      gradeId: activeCourseId,
      lineId: line.id,
      islandId: line.id,
      seed,
      questions: pack.questions,
      cursor: 0,
      correct: 0,
      chain: 0,
      bestChain: 0,
      mistakes: 0,
      startedAt: null,
      timer: { penaltyMs: 0, pausedMs: 0, pausedAt: null }
    };
    ui.lineId = line.id;
    ui.islandId = line.id;
    ui.screen = 'rush';
    ui.result = null;
    saveState();
    render();
    global.scrollTo(0, 0);
  }

  function beginTimeAttack() {
    if (!session || session.mode !== 'timeAttack' || session.startedAt) return;
    session.startedAt = Date.now();
    startRushTimer();
    playTone('finish');
    render();
    updateRushTimer();
  }

  function elapsedRushMs(now) {
    if (!session || !session.startedAt) return 0;
    const current = now == null ? Date.now() : now;
    const activePause = session.timer.pausedAt ? current - session.timer.pausedAt : 0;
    return Math.max(0, current - session.startedAt - session.timer.pausedMs - activePause);
  }

  function startRushTimer() {
    clearInterval(rushTimerId);
    rushTimerId = setInterval(updateRushTimer, 100);
  }

  function stopRushTimer() {
    clearInterval(rushTimerId);
    rushTimerId = null;
  }

  function updateRushTimer() {
    if (!session || session.mode !== 'timeAttack' || !session.startedAt) return;
    const timer = document.querySelector('.live-timer');
    const penalty = document.querySelector('[data-rush-penalty]');
    if (timer) timer.textContent = C.formatTimeMs(elapsedRushMs());
    if (penalty) penalty.textContent = session.timer.penaltyMs ? '＋' + Math.round(session.timer.penaltyMs / 1000) + (activeCourseId === 'g1' ? 'びょう' : '秒') : (activeCourseId === 'g1' ? 'ミスなし' : 'ノーミス');
  }

  function finishTimeAttack() {
    if (!session || session.mode !== 'timeAttack') return;
    const rawMs = elapsedRushMs();
    const officialMs = rawMs + session.timer.penaltyMs;
    const record = state.timeAttack[session.lineId];
    const isBest = record.bestMs == null || officialMs < record.bestMs;
    record.runs += 1;
    record.lastMs = officialMs;
    record.lastMistakes = session.mistakes;
    record.lastPlayed = new Date().toISOString();
    if (isBest) {
      record.bestMs = officialMs;
      record.bestRawMs = rawMs;
      record.bestMistakes = session.mistakes;
      record.bestSeed = session.seed;
    }
    state.history.push({
      mode: 'timeAttack',
      courseId: activeCourseId,
      gradeId: activeCourseId,
      lineId: session.lineId,
      islandId: session.lineId,
      score: session.correct,
      rawMs,
      penaltyMs: session.timer.penaltyMs,
      officialMs,
      mistakes: session.mistakes,
      seed: session.seed,
      at: new Date().toISOString()
    });
    state.history = state.history.slice(-240);
    ui.result = {
      mode: 'timeAttack',
      courseId: activeCourseId,
      lineId: session.lineId,
      rawMs,
      officialMs,
      mistakes: session.mistakes,
      seed: session.seed,
      isBest,
      bestMs: record.bestMs
    };
    ui.screen = 'rush-result';
    stopRushTimer();
    session = null;
    saveState();
    playTone('finish');
    render();
  }

  function renderRush() {
    if (!session || session.mode !== 'timeAttack') return renderHome();
    const line = lineFor(session.lineId);
    const lineStory = activeLineStory(line.id);
    if (!session.startedAt) {
      if (activeCourseId === 'g1') {
        return '<main class="rush-shell" style="' + lineStyle(line) + '"><section class="rush-ready"><div class="rush-ready-inner"><div class="result-burst"><small>TIME</small><b>TA</b></div><div class="eyebrow">タイムアタック</div><h1>' + childText(line.name) + '</h1><p style="color:#dfe8ff">12もんに つづけて こたえよう。まちがえると 3びょう ふえるよ。なんどでも ためせます。</p><div class="score-grid"><div class="score-box"><strong>12もん</strong><small>まいかい かわる</small></div><div class="score-box"><strong>＋3びょう</strong><small>ミス 1かい</small></div><div class="score-box"><strong>' + C.formatTimeMs(state.timeAttack[line.id].bestMs) + '</strong><small>いちばん はやい</small></div></div><div class="button-row" style="justify-content:center"><button class="soft-button" data-action="cancel-rush">もどる</button><button class="secondary-button" data-action="begin-rush">スタート！</button></div></div></section></main>';
      }
      return '<main class="rush-shell" style="' + lineStyle(line) + '"><section class="rush-ready"><div class="rush-ready-inner"><div class="result-burst"><small>TIME</small><b>TA</b></div><div class="eyebrow">RESTORED LINE CHECK・HIRAMEKI TIME ATTACK</div><h1>' + esc(line.name) + ' 高速点検</h1><p style="color:#dfe8ff">' + esc(storyText(lineStory ? lineStory.rushMission : '修理した装置を12ミッションで点検しよう。')) + ' ミスは3秒加算。自分の記録へ何度でも挑戦できます。</p><div class="score-grid"><div class="score-box"><strong>12問</strong><small>ランダム点検</small></div><div class="score-box"><strong>＋3秒</strong><small>ミス1回</small></div><div class="score-box"><strong>' + C.formatTimeMs(state.timeAttack[line.id].bestMs) + '</strong><small>自己ベスト</small></div></div><div class="button-row" style="justify-content:center"><button class="soft-button" data-action="cancel-rush">もどる</button><button class="secondary-button" data-action="begin-rush">点検スタート！</button></div></div></section></main>';
    }
    const question = currentQuestion();
    return [
      '<main class="rush-shell" style="', lineStyle(line), '"><header class="rush-head"><button class="nav-button" data-action="ask-quit">× ', activeCourseId === 'g1' ? 'ちゅうだん' : '中断', '</button>',
      '<div class="rush-timer"><small>TIME</small><span class="live-timer">', C.formatTimeMs(elapsedRushMs()), '</span><small data-rush-penalty>', session.timer.penaltyMs ? '＋' + Math.round(session.timer.penaltyMs / 1000) + (activeCourseId === 'g1' ? 'びょう' : '秒') : (activeCourseId === 'g1' ? 'ミスなし' : 'ノーミス'), '</small></div>',
      '<div class="rush-progress"><strong>', session.cursor + 1, ' / ', TIME_ATTACK_ROUNDS, '</strong></div></header>',
      renderQuestionCard(question, line, true), renderOverlay(), '</main>'
    ].join('');
  }

  function renderRushResult() {
    const result = ui.result;
    if (!result || result.mode !== 'timeAttack') return renderHome();
    const line = lineFor(result.lineId);
    const lineStory = activeLineStory(line.id);
    if (activeCourseId === 'g1') {
      return shell([
        '<main class="result-card" style="', lineStyle(line), '"><div class="result-burst"><small>TIME</small><b>TA</b></div><div class="eyebrow">タイムアタック</div>',
        '<h1>', result.isBest ? 'じこベスト！' : '12もん できた！', '</h1><p>', childText(line.name), 'の タイムアタックが おわったよ。</p>',
        '<div class="score-grid"><div class="score-box"><strong>', C.formatTimeMs(result.rawMs), '</strong><small>こたえた じかん</small></div><div class="score-box"><strong>＋', Math.round(result.mistakes * 3), 'びょう</strong><small>ミス ', result.mistakes, 'かい</small></div><div class="score-box"><strong>', C.formatTimeMs(result.officialMs), '</strong><small>きろく</small></div></div>',
        '<div class="rush-unlock">いちばん はやい　', C.formatTimeMs(result.bestMs), '</div>',
        '<div class="button-row" style="justify-content:center;margin-top:22px"><button class="soft-button" data-nav="home">ホームへ</button><button class="secondary-button" data-action="start-rush" data-line="', line.id, '">もういちど</button></div></main>'
      ].join(''), '');
    }
    return shell([
      '<main class="result-card" style="', lineStyle(line), '"><div class="result-burst"><small>TIME</small><b>TA</b></div><div class="eyebrow">TIME ATTACK COMPLETE</div>',
      '<h1>', result.isBest ? 'じこベスト！' : '12ミッション かんりょう！', '</h1><p>', esc(line.name), 'の高速点検が完了。', esc(storyText(lineStory ? lineStory.system : '装置')), 'は安定して動いています。</p>',
      '<div class="score-grid"><div class="score-box"><strong>', C.formatTimeMs(result.rawMs), '</strong><small>操作タイム</small></div><div class="score-box"><strong>＋', Math.round(result.mistakes * 3), '秒</strong><small>ミス ', result.mistakes, '回</small></div><div class="score-box"><strong>', C.formatTimeMs(result.officialMs), '</strong><small>公式タイム</small></div></div>',
      '<div class="rush-unlock">自己ベスト　', C.formatTimeMs(result.bestMs), '</div>',
      '<div class="button-row" style="justify-content:center;margin-top:22px"><button class="soft-button" data-nav="home">工房へ</button><button class="secondary-button" data-action="start-rush" data-line="', line.id, '">もういちど 挑戦</button></div></main>'
    ].join(''), '');
  }

  function renderAtelier() {
    const totalStages = LINE_ORDER.reduce(function (sum, lineId) { return sum + lineFor(lineId).stages.length; }, 0);
    if (activeCourseId === 'g1') {
      const gradeOneCards = LINE_ORDER.map(function (lineId) {
        const line = lineFor(lineId);
        const count = clearedCount(lineId);
        return '<article class="collection-card" style="' + lineStyle(line) + '"><div class="line-card-top">' + lineBadgeHtml(line) + '<div><h3>' + childText(line.name) + '</h3><small>' + count + ' / ' + line.stages.length + ' できた</small></div></div><div class="parts-grid">' + line.stages.map(function (stage) {
          const on = Boolean(state.progress[stage.id] && state.progress[stage.id].cleared);
          return '<div class="part-chip ' + (on ? 'on' : '') + '"><b>' + stage.n + '</b>' + (on ? childText(stage.name) : 'まだ') + '</div>';
        }).join('') + '</div></article>';
      }).join('');
      return shell('<main class="page"><div class="section-heading"><div><div class="eyebrow">できた きろく</div><h1>ステージ ずかん</h1></div><p>' + LINE_ORDER.reduce(function (sum, id) { return sum + clearedCount(id); }, 0) + ' / ' + totalStages + ' できた</p></div><section class="collection-grid">' + gradeOneCards + '</section></main>', 'atelier');
    }
    const cards = LINE_ORDER.map(function (lineId) {
      const line = lineFor(lineId);
      const count = clearedCount(lineId);
      const lineStory = activeLineStory(lineId);
        return '<article class="collection-card" style="' + lineStyle(line) + '"><div class="line-card-top">' + lineBadgeHtml(line) + '<div><h3>' + esc(line.name) + '</h3><small>' + count + ' / ' + line.stages.length + ' パーツ</small></div></div>' + (lineStory ? '<div class="collection-core ' + (count === line.stages.length ? 'on' : '') + '"><span><small>CORE</small><b>' + (count === line.stages.length ? '完成' : count + '/11') + '</b></span><div><small>' + esc(storyText(lineStory.system)) + '</small><strong>' + (count === line.stages.length ? esc(storyText(lineStory.completeTitle)) : 'パーツをつないでいるところ') + '</strong></div></div>' : '') + '<div class="parts-grid">' + line.stages.map(function (stage) {
        const on = Boolean(state.parts[stage.id]);
        return '<div class="part-chip ' + (on ? 'on' : '') + '"><b>' + (on ? stage.n : '?') + '</b>' + (on ? esc(stage.part) : 'まだ ひみつ') + '</div>';
      }).join('') + '</div></article>';
    }).join('');
    return shell('<main class="page"><div class="section-heading"><div><div class="eyebrow">WORKSHOP ARCHIVE・' + esc(course.label) + '</div><h1>しゅうり パーツ図鑑</h1></div><p>' + LINE_ORDER.reduce(function (sum, id) { return sum + clearedCount(id); }, 0) + ' / ' + totalStages + ' パーツ</p></div><section class="collection-grid">' + cards + '</section></main>', 'atelier');
  }

  function renderParent() {
    const attempts = Object.values(state.progress).reduce(function (sum, item) { return sum + Number(item.attempts || 0); }, 0);
    const accuracy = state.stats.totalAnswers ? Math.round(state.stats.correctAnswers / state.stats.totalAnswers * 100) : 0;
    const rows = LINE_ORDER.map(function (lineId) {
      const line = lineFor(lineId);
      const stats = state.lineStats[lineId];
      const rush = state.timeAttack[lineId];
      return '<tr><td>' + esc(line.short) + '</td><td>' + clearedCount(lineId) + '/' + line.stages.length + '</td><td>' + (stats.totalAnswers ? Math.round(stats.correctAnswers / stats.totalAnswers * 100) : 0) + '%</td><td>' + C.formatTimeMs(rush.bestMs) + '</td></tr>';
    }).join('');
    return shell([
      '<main class="page"><div class="section-heading"><div><div class="eyebrow">FOR GROWN-UPS・', esc(course.label), '</div><h1>おうちの方へ</h1></div><p>初回回答の記録を中心に集計しています。</p></div>',
      '<section class="parent-grid"><article class="parent-card"><h2>全体の記録</h2><div class="score-grid"><div class="score-box"><strong>', attempts, '</strong><small>ステージ挑戦</small></div><div class="score-box"><strong>', accuracy, '%</strong><small>全回答の正答率</small></div><div class="score-box"><strong>', totalMarks(), '</strong><small>ひらめき印</small></div></div><p class="muted">不正解後の再挑戦は学びとして残しますが、ステージの得点には加えません。</p></article>',
      '<article class="parent-card"><h2>ライン別</h2><table class="stats-table"><thead><tr><th>ライン</th><th>修理</th><th>正答率</th><th>タイム</th></tr></thead><tbody>', rows, '</tbody></table></article>',
      '<article class="parent-card"><h2>この教材の構成</h2><p>現行の学習指導要領と複数社の', esc(course.label), '教科書に共通する内容を、', LINE_ORDER.length, 'ライン・', LINE_ORDER.reduce(function (sum, id) { return sum + lineFor(id).stages.length; }, 0), 'ステージへ整理しています。確認ステージは5番と11番です。</p></article>',
      '<article class="parent-card"><h2>データ</h2><p>進捗はこの端末のブラウザ内に保存されます。</p><div class="button-row"><button class="soft-button" data-action="export-data">記録を書き出す</button><button class="danger-button" data-action="confirm-reset">記録を消す</button></div></article>',
      '</section></main>'
    ].join(''), 'parent');
  }

  function renderOpening() {
    if (ui.openingStep == null) return '';
    const firstVisitScenes = [
      { speaker: 'トト', title: 'ルミナが ねむっているよ。', text: 'ルミナは、ひらめきこうぼうを あかるくする なかまです。' },
      { speaker: 'モクモ', title: 'さんすうで げんきにしよう。', text: 'かずや かたちの もんだいが できると、ルミナの ひかりが ふえていきます。' },
      { speaker: 'トト', title: 'きみの でばん！', text: 'わかる ところからで だいじょうぶ。いっしょに はじめよう！' }
    ];
    const returnScenes = [
      { speaker: 'トト', title: 'おかえり！', text: 'ルミナが まっていたよ。' },
      { speaker: 'モクモ', title: 'きろくは そのままです。', text: 'まえに できた ステージも、ちゃんと のこっています。' },
      { speaker: 'トト', title: 'また つづきから はじめよう！', text: 'すきな べんきょうを えらんでね。' }
    ];
    const scenes = returningForStoryRefresh ? returnScenes : firstVisitScenes;
    if (ui.openingStep < scenes.length) {
      const scene = scenes[ui.openingStep];
      return '<div class="overlay"><section class="opening-card" role="dialog" aria-modal="true">' + storyArtHtml('トトとモクモが ルミナを あんないしている') + '<div><div class="eyebrow">' + esc(scene.speaker) + '</div><h2>' + esc(scene.title) + '</h2><p>' + esc(scene.text) + '</p><button class="primary-button" data-action="opening-next">つぎへ →</button></div></section></div>';
    }
    if (returningForStoryRefresh) {
      return '<div class="overlay"><section class="opening-card" role="dialog" aria-modal="true">' + storyArtHtml('トトとモクモが こうぼうへ もどった ひとを むかえている') + '<div><div class="eyebrow">きろくは そのまま</div><h2>' + esc(state.workshopName || 'ひらめき') + 'こうぼうへ おかえり！</h2><p>こうぼうの なまえも、これまでの きろくも、そのままです。</p><button class="primary-button" data-action="finish-opening">このまま つづける →</button></div></section></div>';
    }
    return '<div class="overlay"><section class="opening-card" role="dialog" aria-modal="true">' + storyArtHtml('トトとモクモが こうぼうを あんないしている') + '<div><div class="eyebrow">さいしょの じゅんび</div><h2>こうぼうに なまえを つけよう。</h2><p>すきな なまえで いいよ。</p><label for="workshopNameInput">8もじまで</label><input id="workshopNameInput" class="name-input" maxlength="8" placeholder="ひらめき" value="' + esc(state.workshopName) + '"><button class="primary-button" data-action="finish-opening">この なまえで はじめる</button></div></section></div>';
  }

  function renderCourseIntro() {
    if (ui.courseIntroStep == null || !K) return '';
    const courseStory = activeCourseStory();
    if (activeCourseId === 'g1') {
      const scenes = [
        { speaker: 'トト', title: '1ねんせいの さんすうへ！', text: 'かず・たしざん・ひきざん・くらべる・かたち・おはなしを べんきょうするよ。' },
        { speaker: 'モクモ', title: 'すきな ところから はじめよう。', text: 'どの べんきょうも、さいしょの ステージから はじめられます。' }
      ];
      const scene = scenes[Math.min(ui.courseIntroStep, scenes.length - 1)];
      const last = ui.courseIntroStep >= scenes.length - 1;
      return '<div class="overlay"><section class="opening-card" role="dialog" aria-modal="true">' + storyArtHtml('トトとモクモが 1ねんせいの さんすうを あんないしている') + '<div><div class="eyebrow">' + esc(scene.speaker) + '・1ねんせい</div><h2>' + esc(scene.title) + '</h2><p>' + esc(scene.text) + '</p><button class="primary-button" data-action="' + (last ? 'finish-course-intro' : 'course-intro-next') + '">' + (last ? 'はじめる' : 'つぎへ') + ' →</button></div></section></div>';
    }
    const scenes = courseStory && courseStory.intro || [
      { icon: activeCourseId === 'g2' ? '🏗️' : '💡', speaker: 'トト', title: course.chapter + 'を たんとうしよう。', text: course.premise },
      { icon: '🤖', speaker: 'モクモ', title: LINE_ORDER.length + 'つの しゅうりラインを ひらきました。', text: 'どのラインも1番から始められます。まずは気になる装置を選んでください。' }
    ];
    const scene = scenes[Math.min(ui.courseIntroStep, scenes.length - 1)];
    const last = ui.courseIntroStep >= scenes.length - 1;
    return '<div class="overlay"><section class="opening-card" role="dialog" aria-modal="true">' + storyArtHtml('トトとモクモが' + course.label + 'の区画を案内している') + '<div><div class="eyebrow">' + esc(scene.speaker) + '・' + esc(course.label) + '</div><h2>' + esc(storyText(scene.title)) + '</h2><p>' + esc(storyText(scene.text)) + '</p><button class="primary-button" data-action="' + (last ? 'finish-course-intro' : 'course-intro-next') + '">' + (last ? 'くかくへ はいる' : 'つぎへ') + ' →</button></div></section></div>';
  }

  function renderLineIntro() {
    if (ui.lineIntroStep == null || !ui.lineIntroId) return '';
    const line = lineFor(ui.lineIntroId);
    const story = activeLineStory(line.id);
    if (!story || !story.intro.length) return '';
    if (activeCourseId === 'g1') {
      const first = ui.lineIntroStep === 0;
      return '<div class="overlay"><section class="opening-card line-opening" style="' + lineStyle(line) + '" role="dialog" aria-modal="true">' + storyArtHtml('トトとモクモが ' + gradeOneReading(line.short) + 'を あんないしている') + '<div><div class="eyebrow">' + (first ? 'トト' : 'モクモ') + '・' + childText(line.short) + '</div><h2>' + (first ? childText(line.short) + 'を やってみよう！' : 'ステージは 11こ。') + '</h2><p>' + (first ? childText(line.description) : 'さいしょは やさしく、すこしずつ むずかしくなるよ。') + '</p><button class="primary-button" style="' + lineStyle(line) + '" data-action="' + (first ? 'line-intro-next' : 'finish-line-intro') + '">' + (first ? 'つぎへ' : 'ステージを みる') + ' →</button></div></section></div>';
    }
    const scene = story.intro[Math.min(ui.lineIntroStep, story.intro.length - 1)];
    const last = ui.lineIntroStep >= story.intro.length - 1;
    return '<div class="overlay"><section class="opening-card line-opening" style="' + lineStyle(line) + '" role="dialog" aria-modal="true">' + storyArtHtml('トトとモクモが' + storyText(story.system) + 'の作戦を説明している') + '<div><div class="eyebrow">' + esc(scene.speaker) + '・' + esc(storyText(story.system)) + '</div><h2>' + esc(storyText(scene.title)) + '</h2><p>' + esc(storyText(scene.text)) + '</p><div class="line-mission-chip"><small>このラインで もどす力</small><strong>' + esc(storyText(story.power)) + '</strong></div><button class="primary-button" style="' + lineStyle(line) + '" data-action="' + (last ? 'finish-line-intro' : 'line-intro-next') + '">' + (last ? 'せっけいずを ひらく' : 'つぎへ') + ' →</button></div></section></div>';
  }

  function renderStageIntro() {
    if (!ui.stageIntro || !session || session.mode !== 'standard') return '';
    const line = lineFor(session.lineId);
    const stage = line.stages[session.stageIndex];
    const lineStory = activeLineStory(line.id);
    const stageStory = S ? S.stageStory(activeCourseId, line.id, session.stageIndex, stage) : null;
    const actionCopy = /[。！？]$/.test(stage.action) ? stage.action : stage.action + '。';
    if (activeCourseId === 'g1') {
      return '<div class="overlay"><section class="opening-card mission-opening" style="' + lineStyle(line) + '" role="dialog" aria-modal="true">' + storyArtHtml('トトが ステージの やりかたを あんないしている') + '<div><div class="eyebrow">ステージ ' + stage.n + '・' + childText(line.short) + '</div><h2>' + childText(stage.name) + '</h2><div class="stage-diagnosis"><strong>この ステージで やること</strong><span>' + childText(actionCopy) + '</span></div><p class="muted">できると、ルミナが すこし げんきになるよ。</p><button class="primary-button" style="' + lineStyle(line) + '" data-action="begin-stage">もんだいを はじめる →</button></div></section></div>';
    }
    return '<div class="overlay"><section class="opening-card mission-opening" style="' + lineStyle(line) + '" role="dialog" aria-modal="true">' + storyArtHtml('トトが作業を示し、モクモが診断結果を見せている') + '<div><div class="eyebrow">REPAIR MISSION ' + stage.n + '・' + esc(storyText(lineStory ? lineStory.system : 'トト')) + '</div><h2>' + esc(stage.name) + 'を なおそう！</h2>' + (stageStory ? '<div class="stage-diagnosis"><strong>モクモの しらべたこと</strong><span>' + esc(storyText(stageStory.briefing)) + '</span></div>' : '') + '<p><strong>おやかたの さぎょう：</strong>' + esc(storyText(actionCopy)) + '</p><p class="muted">' + esc(storyText(lineStory ? 'このパーツで「' + lineStory.power + '」の回路を一つつなぎます。' : 'この装置を直して、工房へ明かりを戻そう。')) + '</p><button class="primary-button" style="' + lineStyle(line) + '" data-action="begin-stage">しゅうりを はじめる →</button></div></section></div>';
  }

  function renderCourseFinale() {
    if (ui.courseFinaleStep == null) return '';
    const story = activeCourseStory();
    if (!story || !story.finale || !story.finale.length) return '';
    if (activeCourseId === 'g1') {
      const scenes = [
        { speaker: 'トト', title: 'ルミナが げんきに なった！', text: 'かずも、しきも、かたちも、みんなの ひかりに なったよ。' },
        { speaker: 'モクモ', title: '1ねんせいの さんすう、ぜんぶ できた！', text: 'なんどでも あそべるよ。タイムアタックにも ちょうせんしてね。' }
      ];
      const scene = scenes[Math.min(ui.courseFinaleStep, scenes.length - 1)];
      const last = ui.courseFinaleStep >= scenes.length - 1;
      return '<div class="overlay"><section class="opening-card course-finale" role="dialog" aria-modal="true">' + storyArtHtml('げんきに なった ルミナと トトとモクモ') + '<div><div class="eyebrow">' + esc(scene.speaker) + '・おめでとう</div><h2>' + esc(scene.title) + '</h2><p>' + esc(scene.text) + '</p><button class="primary-button" data-action="' + (last ? 'finish-course-finale' : 'course-finale-next') + '">' + (last ? 'ホームへ もどる' : 'つぎへ') + ' →</button></div></section></div>';
    }
    const scene = story.finale[Math.min(ui.courseFinaleStep, story.finale.length - 1)];
    const last = ui.courseFinaleStep >= story.finale.length - 1;
    return '<div class="overlay"><section class="opening-card course-finale" role="dialog" aria-modal="true">' + storyArtHtml('光を取り戻した工房でトトとモクモが完成を祝っている') + '<div><div class="eyebrow">COURSE RESTORED・' + esc(scene.speaker) + '</div><h2>' + esc(storyText(scene.title)) + '</h2><p>' + esc(storyText(scene.text)) + '</p>' + (last ? '<div class="finale-emblem"><span class="lumina-gem" aria-hidden="true"></span><div><small>RESTORE EMBLEM</small><strong>' + esc(storyText(story.finaleTitle)) + '</strong><p>' + esc(storyText(story.finaleText)) + '</p></div></div>' : '') + '<button class="primary-button" data-action="' + (last ? 'finish-course-finale' : 'course-finale-next') + '">' + (last ? 'こうぼうへ もどる' : 'ルミナを うごかす') + ' →</button></div></section></div>';
  }

  function renderOverlay() {
    if (stateLoadError) {
      const text = stateLoadError === 'future'
        ? 'この端末の記録は、もっと新しい版で作られています。記録を守るため、この版では上書きしません。'
        : 'これまでの記録を安全に移す準備ができませんでした。記録は上書きしていません。';
      return '<div class="overlay"><section class="modal-card" role="dialog" aria-modal="true"><h2>きろくを まもっています</h2><p>' + text + '</p><p>通信できる状態で最新版へ更新してください。</p></section></div>';
    }
    if (ui.openingStep != null) return renderOpening();
    if (ui.courseIntroStep != null) return renderCourseIntro();
    if (ui.lineIntroStep != null) return renderLineIntro();
    if (ui.stageIntro) return renderStageIntro();
    if (ui.courseFinaleStep != null) return renderCourseFinale();
    if (!ui.modal) return '';
    if (ui.modal === 'settings') {
      const volumePercent = Math.round(normalizedBgmVolume() * 100);
      return [
        '<div class="overlay"><section class="modal-card" role="dialog" aria-modal="true" aria-label="せってい"><h2>せってい</h2>',
        '<div class="setting-row"><span>おと（ぜんぶ）</span><button class="toggle ', state.settings.sound ? 'on' : '', '" aria-label="おと（ぜんぶ） ', state.settings.sound ? 'オン' : 'オフ', '" aria-pressed="', state.settings.sound ? 'true' : 'false', '" data-action="toggle-sound">', state.settings.sound ? 'オン' : 'オフ', '</button></div>',
        '<div class="setting-row"><span>BGM</span><button class="toggle ', state.settings.bgm ? 'on' : '', '" aria-label="BGM ', state.settings.bgm ? 'オン' : 'オフ', '" aria-pressed="', state.settings.bgm ? 'true' : 'false', '" data-action="toggle-bgm">', state.settings.bgm ? 'オン' : 'オフ', '</button></div>',
        '<div class="setting-row setting-volume"><label for="bgmVolume">BGMの おおきさ <output id="bgmVolumeOutput">', volumePercent, '%</output></label><input id="bgmVolume" type="range" min="0" max="100" step="5" value="', volumePercent, '" data-bgm-volume aria-label="BGMの おおきさ"></div>',
        '<div class="audio-check"><div><strong>BGM：', esc(bgmStatusText()), '</strong><small>おんがく：やさしい メロディー</small></div><button class="secondary-button compact-button" data-action="test-bgm">ためしに きく</button></div>',
        '<div class="setting-row"><span>うごき</span><button class="toggle ', state.settings.motion ? 'on' : '', '" aria-label="うごき ', state.settings.motion ? 'オン' : 'オフ', '" aria-pressed="', state.settings.motion ? 'true' : 'false', '" data-action="toggle-motion">', state.settings.motion ? 'オン' : 'オフ', '</button></div>',
        '<div class="setting-row" style="display:block"><label for="renameInput">こうぼうの なまえ</label><input id="renameInput" class="name-input" maxlength="8" value="', esc(state.workshopName), '"></div>',
        activeCourseId === 'g1' ? '<hr><section class="admin-settings"><div><h3>かんりの きのう</h3><p>きろくは かえずに、1ねんせいの ステージだけを ぜんぶ ためせます。</p></div><button class="' + (adminUnlockActive() ? 'danger-button' : 'secondary-button') + '" data-action="toggle-admin-unlock">' + (adminUnlockActive() ? 'ぜんぶ ひらくのを やめる' : '1ねんせいを ぜんぶ ひらく') + '</button></section>' : '',
        '<div class="button-row" style="margin-top:18px"><button class="soft-button" data-action="close-modal">とじる</button><button class="primary-button" data-action="save-settings">ほぞん</button></div>',
        !isStandalone() ? '<hr><button class="secondary-button" data-action="install-app">ホーム画面に追加</button>' : '',
        '</section></div>'
      ].join('');
    }
    if (ui.modal === 'quit') {
      const quitText = activeCourseId === 'g1'
        ? (session && session.mode === 'timeAttack' ? 'いまの タイムは のこらないよ。' : 'いまの ステージは さいしょからに なるよ。')
        : (session && session.mode === 'timeAttack' ? '今回のタイムは記録されません。' : 'いまのステージの記録は残りません。');
      return '<div class="overlay"><section class="modal-card" role="dialog" aria-modal="true"><h2>ここで ちゅうだんする？</h2><p>' + quitText + '</p><div class="button-row"><button class="soft-button" data-action="close-modal">つづける</button><button class="danger-button" data-action="quit-session">ちゅうだんする</button></div></section></div>';
    }
    if (ui.modal === 'reset') {
      const allStages = K ? K.COURSE_ORDER.reduce(function (sum, courseId) {
        const item = K.courseFor(courseId);
        return sum + item.lineOrder.reduce(function (lineSum, lineId) { return lineSum + item.lines[lineId].stages.length; }, 0);
      }, 0) : LINE_ORDER.reduce(function (sum, lineId) { return sum + lineFor(lineId).stages.length; }, 0);
      return '<div class="overlay"><section class="modal-card" role="dialog" aria-modal="true"><h2>すべての きろくを消す？</h2><p>' + allStages + 'ステージの進捗とタイムアタック記録が消えます。この操作は元に戻せません。</p><div class="button-row"><button class="soft-button" data-action="close-modal">やめる</button><button class="danger-button" data-action="reset-data">ぜんぶ消す</button></div></section></div>';
    }
    if (ui.modal === 'install') {
      return '<div class="overlay"><section class="modal-card" role="dialog" aria-modal="true"><h2>ホーム画面に追加</h2><p>Safariの共有ボタンから「ホーム画面に追加」を選ぶと、アプリのように遊べます。</p><div class="button-row"><button class="primary-button" data-action="close-modal">わかった</button></div></section></div>';
    }
    return '';
  }

  function renderUpdateBanner() {
    if (!waitingWorker || (session && (ui.screen === 'game' || ui.screen === 'rush'))) return '';
    return '<div class="update-banner"><span>新しい工房が届きました</span><button class="primary-button compact-button" data-action="apply-update">更新する</button></div>';
  }

  function render(preferredFocusSelector) {
    document.body.classList.toggle('no-motion', !state.settings.motion);
    syncAudio();
    const app = document.getElementById('app');
    if (!app) return;
    const screens = {
      courses: renderCourses,
      home: renderHome,
      map: renderMap,
      game: renderGame,
      result: renderResult,
      rush: renderRush,
      'rush-result': renderRushResult,
      atelier: renderAtelier,
      parent: renderParent
    };
    app.innerHTML = (screens[ui.screen] || renderHome)();
    requestAnimationFrame(function () {
      const preferredControl = preferredFocusSelector ? document.querySelector('.overlay ' + preferredFocusSelector) : null;
      const dialogControl = preferredControl || document.querySelector('.overlay button, .overlay input');
      if (dialogControl) dialogControl.focus();
    });
  }

  function navigate(screen) {
    if (K && !rootState.courseChosen && screen !== 'courses') {
      ui.screen = 'courses';
      render();
      return;
    }
    if (session && (ui.screen === 'game' || ui.screen === 'rush')) {
      ui.modal = 'quit';
      render();
      return;
    }
    ui.screen = screen;
    ui.modal = null;
    saveState();
    playTone('tap');
    render();
    global.scrollTo(0, 0);
  }

  function switchLine(lineId, goToMap, forceStory) {
    if (!LINES[lineId]) return;
    ui.lineId = lineId;
    ui.islandId = lineId;
    state.lastLine = lineId;
    state.lastIsland = lineId;
    if (goToMap) ui.screen = 'map';
    if (activeLineStory(lineId) && (forceStory || !hasStoryBeat('line', lineId, activeCourseId))) {
      ui.lineIntroId = lineId;
      ui.lineIntroStep = 0;
    }
    saveState();
    playTone('tap');
    render();
  }

  function adjustQuestion(delta) {
    const question = currentQuestion();
    if (!question) return;
    const step = Number(question.step || 1);
    const current = question.input === '' ? Number(question.min || 0) : Number(question.input);
    question.input = Math.max(Number(question.min || 0), Math.min(Number(question.max || 100), current + Number(delta) * step));
    render();
    if (session && session.mode === 'timeAttack') updateRushTimer();
  }

  function adjustClock(part, delta) {
    const question = currentQuestion();
    if (!question) return;
    const clock = parseClock(question.input);
    if (part === 'hour') {
      clock.hour += Number(delta);
      if (clock.hour < 1) clock.hour = 12;
      if (clock.hour > 12) clock.hour = 1;
    } else {
      const step = Number(question.clockStep || 5);
      clock.minute += Number(delta) * step;
      if (clock.minute < 0) clock.minute = 60 - step;
      if (clock.minute >= 60) clock.minute = 0;
    }
    question.input = clock.hour + ':' + String(clock.minute).padStart(2, '0');
    render();
    if (session && session.mode === 'timeAttack') updateRushTimer();
  }

  function togglePiece(index) {
    const question = currentQuestion();
    if (!question) return;
    const value = Number(index);
    if (question.visual && question.visual.type === 'unit-length-builder') {
      question.selected = Array.from({ length: value + 1 }, function (_, itemIndex) { return itemIndex; });
      question.input = normalizeQuestionInput(question);
      playTone('tap');
      render();
      if (session && session.mode === 'timeAttack') updateRushTimer();
      return;
    }
    question.selected = question.selected || [];
    const position = question.selected.indexOf(value);
    if (position >= 0) question.selected.splice(position, 1);
    else question.selected.push(value);
    question.input = normalizeQuestionInput(question);
    render();
    if (session && session.mode === 'timeAttack') updateRushTimer();
  }

  function addOrderValue(value) {
    const question = currentQuestion();
    if (!question) return;
    question.orderSelected = question.orderSelected || [];
    if (!question.orderSelected.map(String).includes(String(value))) question.orderSelected.push(value);
    question.input = question.orderSelected.join(',');
    render();
    if (session && session.mode === 'timeAttack') updateRushTimer();
  }

  function exportData() {
    const payload = K ? Object.assign({}, rootState, {
      title: 'ひらめき工房',
      exportedAt: new Date().toISOString()
    }) : {
      title: 'ひらめき工房',
      version: state.version,
      workshopName: state.workshopName,
      exportedAt: new Date().toISOString(),
      progress: state.progress,
      stats: state.stats,
      lineStats: state.lineStats,
      timeAttack: state.timeAttack,
      history: state.history
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'hirameki-kobo-' + new Date().toISOString().slice(0, 10) + '.json';
    anchor.click();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function quitSession() {
    stopRushTimer();
    session = null;
    ui.modal = null;
    ui.screen = 'map';
    render();
  }

  document.addEventListener('click', function (event) {
    if (audioEngine) audioEngine.unlock();
    const nav = event.target.closest('[data-nav]');
    if (nav) {
      navigate(nav.dataset.nav);
      return;
    }
    const tab = event.target.closest('[data-line-tab]');
    if (tab) {
      switchLine(tab.dataset.lineTab, false);
      return;
    }
    const stageButton = event.target.closest('[data-stage]');
    if (stageButton && !stageButton.disabled && !stageButton.dataset.action) {
      startStage(Number(stageButton.dataset.stage), ui.lineId);
      return;
    }
    const answer = event.target.closest('[data-answer]');
    if (answer) {
      handleAnswer(answer.dataset.answer);
      return;
    }
    const piece = event.target.closest('[data-piece]');
    if (piece) {
      togglePiece(piece.dataset.piece);
      return;
    }
    const order = event.target.closest('[data-order-value]');
    if (order) {
      addOrderValue(order.dataset.orderValue);
      return;
    }
    const adjust = event.target.closest('[data-adjust]');
    if (adjust) {
      adjustQuestion(adjust.dataset.adjust);
      return;
    }
    const clock = event.target.closest('[data-clock-part]');
    if (clock) {
      adjustClock(clock.dataset.clockPart, clock.dataset.clockDelta);
      return;
    }
    const key = event.target.closest('[data-key]');
    if (key) {
      const question = currentQuestion();
      if (!question) return;
      const value = key.dataset.key;
      if (value === 'けす') question.input = '';
      else if (value === 'けってい') handleAnswer(question.input);
      else {
        const maxDigits = Number(question.maxDigits || (question.max != null ? String(Math.floor(Math.abs(Number(question.max)))).length : activeCourseId === 'g2' ? 5 : 3));
        if (String(question.input).replace(/[^0-9]/g, '').length < maxDigits) question.input = String(question.input || '') + value;
      }
      render();
      return;
    }
    const mood = event.target.closest('[data-mood]');
    if (mood) {
      state.moods[mood.dataset.stageId] = mood.dataset.mood;
      saveState();
      showToast('きもちを きろくしました');
      return;
    }
    const actionNode = event.target.closest('[data-action]');
    if (!actionNode) return;
    const action = actionNode.dataset.action;
    if (action === 'open-settings') { ui.modal = 'settings'; render(); }
    else if (action === 'close-modal') { ui.modal = null; render(); }
    else if (action === 'opening-next') { ui.openingStep += 1; playTone('tap'); render(); }
    else if (action === 'finish-opening') {
      const input = document.getElementById('workshopNameInput');
      const existingName = state.workshopName || rootState.workshopName || 'ひらめき';
      state.workshopName = (input && input.value.trim() || existingName).slice(0, 8);
      if (K) {
        rootState.workshopName = state.workshopName;
        rootState.introSeen = true;
        rootState.courseChosen = false;
        if (S) rootState.settings.storyRevision = S.STORY_VERSION;
        ui.screen = 'courses';
      } else {
        state.introSeen = true;
        if (S) state.settings.storyRevision = S.STORY_VERSION;
      }
      ui.openingStep = null;
      saveState();
      playTone('finish');
      render();
      showToast(state.workshopName + (activeCourseId === 'g1' ? 'こうぼう' : '工房') + '、オープン！');
    }
    else if (action === 'choose-course') {
      if (!activateCourse(actionNode.dataset.course)) return;
      ui.screen = 'home';
      ui.result = null;
      ui.courseIntroStep = S ? (hasStoryBeat('course', 'main', activeCourseId) ? null : 0) : (state.introSeen ? null : 0);
      saveState();
      playTone('finish');
      render();
      global.scrollTo(0, 0);
    }
    else if (action === 'course-intro-next') { ui.courseIntroStep += 1; playTone('tap'); render(); }
    else if (action === 'finish-course-intro') {
      state.introSeen = true;
      if (S) markStoryBeat('course', 'main', activeCourseId);
      ui.courseIntroStep = null;
      if (courseComplete() && activeCourseStory() && activeCourseStory().finale && !hasStoryBeat('course-complete', 'main', activeCourseId)) ui.courseFinaleStep = 0;
      saveState();
      playTone('finish');
      render();
    }
    else if (action === 'line-intro-next') { ui.lineIntroStep += 1; playTone('tap'); render(); }
    else if (action === 'finish-line-intro') {
      const lineId = ui.lineIntroId;
      if (lineId) {
        state.lineIntros[lineId] = true;
        markStoryBeat('line', lineId, activeCourseId);
      }
      ui.lineIntroStep = null;
      ui.lineIntroId = null;
      saveState();
      playTone('finish');
      render();
    }
    else if (action === 'begin-stage') {
      if (session) {
        const activeStage = lineFor(session.lineId).stages[session.stageIndex];
        state.storySeen[activeStage.id] = true;
        markStoryBeat('stage', activeStage.id, activeCourseId);
        session.startedAt = Date.now();
      }
      ui.stageIntro = null;
      saveState();
      playTone('finish');
      render();
    }
    else if (action === 'open-line') switchLine(actionNode.dataset.line, true);
    else if (action === 'replay-line-story') switchLine(actionNode.dataset.line, true, true);
    else if (action === 'show-course-finale') {
      if (activeCourseStory() && activeCourseStory().finale) {
        ui.courseFinaleStep = 0;
        playTone('finish');
        render();
      }
    }
    else if (action === 'course-finale-next') { ui.courseFinaleStep += 1; playTone('finish'); render(); }
    else if (action === 'finish-course-finale') {
      markStoryBeat('course-complete', 'main', activeCourseId);
      ui.courseFinaleStep = null;
      ui.screen = 'home';
      saveState();
      playTone('finish');
      render();
      global.scrollTo(0, 0);
    }
    else if (action === 'start-recommended') {
      switchLine(actionNode.dataset.line, false);
      startStage(Number(actionNode.dataset.stage), actionNode.dataset.line);
    }
    else if (action === 'submit-operation') handleAnswer(normalizeQuestionInput(currentQuestion()));
    else if (action === 'reset-operation') { resetQuestionInteraction(currentQuestion()); render(); }
    else if (action === 'retry-question') retryQuestion();
    else if (action === 'next-question') nextQuestion();
    else if (action === 'retry-stage') startStage(Number(actionNode.dataset.stage), ui.result.lineId);
    else if (action === 'ask-quit') { ui.modal = 'quit'; render(); }
    else if (action === 'quit-session') quitSession();
    else if (action === 'start-rush') startTimeAttack(actionNode.dataset.line);
    else if (action === 'begin-rush') beginTimeAttack();
    else if (action === 'cancel-rush') { session = null; ui.screen = 'home'; render(); }
    else if (action === 'toggle-sound') { state.settings.sound = !state.settings.sound; saveState(); syncAudio(); render('[data-action="toggle-sound"]'); }
    else if (action === 'toggle-bgm') {
      state.settings.bgm = !state.settings.bgm;
      saveState();
      syncAudio();
      render('[data-action="toggle-bgm"]');
    }
    else if (action === 'test-bgm') {
      state.settings.sound = true;
      state.settings.bgm = true;
      if (normalizedBgmVolume() < 0.5) state.settings.bgmVolume = 0.7;
      saveState();
      syncAudio();
      const preview = audioEngine && typeof audioEngine.previewBgm === 'function' ? audioEngine.previewBgm() : Promise.resolve(false);
      preview.then(function (played) {
        render('[data-action="test-bgm"]');
        showToast(played ? 'BGMを さいせい中です' : 'BGMを さいせいできませんでした');
      });
    }
    else if (action === 'toggle-admin-unlock') {
      if (activeCourseId !== 'g1') return;
      state.settings.adminUnlockG1 = !adminUnlockActive();
      saveState();
      render('[data-action="toggle-admin-unlock"]');
      showToast(state.settings.adminUnlockG1 ? '1ねんせいの ステージを ぜんぶ ひらきました' : 'いつもの じゅんばんに もどしました');
    }
    else if (action === 'toggle-motion') { state.settings.motion = !state.settings.motion; saveState(); render('[data-action="toggle-motion"]'); }
    else if (action === 'save-settings') {
      const rename = document.getElementById('renameInput');
      const bgmVolume = document.getElementById('bgmVolume');
      if (bgmVolume) state.settings.bgmVolume = Math.max(0, Math.min(1, Number(bgmVolume.value) / 100));
      state.workshopName = (rename && rename.value.trim() || 'ひらめき').slice(0, 8);
      ui.modal = null;
      saveState();
      render();
      showToast('せっていを ほぞんしました');
    }
    else if (action === 'export-data') exportData();
    else if (action === 'confirm-reset') { ui.modal = 'reset'; render(); }
    else if (action === 'reset-data') {
      localStorage.removeItem(STORE_KEY);
      localStorage.removeItem(PRE_V4_BACKUP_KEY);
      rootState = defaultState();
      activeCourseId = 'g1';
      course = K ? K.courseFor('g1') : course;
      LINES = course.lines;
      LINE_ORDER = course.lineOrder;
      state = K ? K.courseState(rootState, 'g1') : rootState;
      syncStateShell();
      session = null;
      ui = { screen: K ? 'courses' : 'home', modal: null, openingStep: 0, courseIntroStep: null, lineIntroStep: null, lineIntroId: null, stageIntro: null, courseFinaleStep: null, lineId: LINE_ORDER[0], islandId: LINE_ORDER[0], result: null };
      render();
    }
    else if (action === 'install-app') requestInstall();
    else if (action === 'apply-update' && waitingWorker) waitingWorker.postMessage({ type: 'SKIP_WAITING' });
  });

  document.addEventListener('input', function (event) {
    const volume = event.target.closest && event.target.closest('[data-bgm-volume]');
    if (!volume) return;
    state.settings.bgmVolume = Math.max(0, Math.min(1, Number(volume.value) / 100));
    const output = document.getElementById('bgmVolumeOutput');
    if (output) output.textContent = Math.round(state.settings.bgmVolume * 100) + '%';
    saveState();
    syncAudio();
  });

  document.addEventListener('visibilitychange', function () {
    if (audioEngine) audioEngine.setVisible(document.visibilityState !== 'hidden');
    if (!session || session.mode !== 'timeAttack' || !session.startedAt) return;
    if (document.visibilityState === 'hidden' && !session.timer.pausedAt) {
      session.timer.pausedAt = Date.now();
    } else if (document.visibilityState === 'visible' && session.timer.pausedAt) {
      session.timer.pausedMs += Date.now() - session.timer.pausedAt;
      session.timer.pausedAt = null;
      updateRushTimer();
    }
  });

  global.addEventListener('pagehide', function () {
    if (audioEngine) audioEngine.setVisible(false);
  });

  global.addEventListener('pageshow', function () {
    if (audioEngine) audioEngine.setVisible(true);
  });

  global.addEventListener('beforeinstallprompt', function (event) {
    event.preventDefault();
    deferredInstallPrompt = event;
  });

  global.addEventListener('appinstalled', function () {
    deferredInstallPrompt = null;
    showToast('ホーム画面に 追加しました');
  });

  async function requestInstall() {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice.catch(function () { return null; });
      deferredInstallPrompt = null;
      ui.modal = null;
      render();
      return;
    }
    ui.modal = 'install';
    render();
  }

  function watchServiceWorker(registration) {
    if (registration.waiting) waitingWorker = registration.waiting;
    registration.addEventListener('updatefound', function () {
      const worker = registration.installing;
      if (!worker) return;
      worker.addEventListener('statechange', function () {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) {
          waitingWorker = worker;
          render();
        }
      });
    });
  }

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    global.addEventListener('load', function () {
      navigator.serviceWorker.register('./sw.js').then(watchServiceWorker).catch(function () {});
    });
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (reloadingForUpdate) return;
      reloadingForUpdate = true;
      global.location.reload();
    });
  }

  global.HiramekiApp = {
    ISLANDS,
    LINES,
    COURSES: K ? K.COURSES : { g1: course },
    NUMBER_STAGES,
    ADDITION_STAGES,
    SUBTRACTION_STAGES,
    MEASURE_STAGES,
    SHAPE_STAGES,
    SOLVE_STAGES,
    defaultState,
    loadState,
    buildQuestion,
    startStage,
    startTimeAttack,
    beginTimeAttack,
    finishTimeAttack,
    handleAnswer,
    nextQuestion,
    clearedCount,
    totalMarks,
    isUnlocked,
    isStandalone,
    renderHome,
    renderCourses,
    activateCourse,
    getRootState: function () { return K ? rootState : state; },
    getActiveCourseId: function () { return activeCourseId; },
    getCourse: function () { return course; },
    getLines: function () { return LINES; },
    getState: function () { return state; },
    getSession: function () { return session; },
    getUi: function () { return ui; },
    getAudioSnapshot: function () {
      return audioEngine && typeof audioEngine.snapshot === 'function'
        ? audioEngine.snapshot()
        : null;
    }
  };

  /* TEST_HOOK */
  render();
}(typeof globalThis !== 'undefined' ? globalThis : window));
