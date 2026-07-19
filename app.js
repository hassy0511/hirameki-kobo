(function (global) {
  'use strict';

  const C = global.HiramekiCore;
  if (!C) throw new Error('HiramekiCore is required');
  const K = global.HiramekiCourses || null;

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
  let ui = {
    screen: K && !rootState.courseChosen ? 'courses' : 'home',
    modal: null,
    openingStep: rootState.introSeen ? null : 0,
    courseIntroStep: null,
    stageIntro: null,
    lineId: LINES[state.lastLine] ? state.lastLine : 'number',
    islandId: LINES[state.lastLine] ? state.lastLine : 'number',
    result: null
  };
  let session = null;
  let audioContext = null;
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
    return K ? K.isUnlocked(state, activeCourseId, index, lineId || ui.lineId) : C.isUnlocked(state, index, lineId || ui.lineId);
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

  function playTone(kind) {
    if (!state.settings.sound) return;
    try {
      const Audio = global.AudioContext || global.webkitAudioContext;
      if (!Audio) return;
      audioContext = audioContext || new Audio();
      const now = audioContext.currentTime;
      const notes = kind === 'good' ? [523, 659, 784] : kind === 'hint' ? [330, 294] : kind === 'finish' ? [523, 659, 784, 1047] : [440];
      notes.forEach(function (frequency, index) {
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0.0001, now + index * .08);
        gain.gain.exponentialRampToValueAtTime(.09, now + index * .08 + .02);
        gain.gain.exponentialRampToValueAtTime(.0001, now + index * .08 + .17);
        oscillator.connect(gain).connect(audioContext.destination);
        oscillator.start(now + index * .08);
        oscillator.stop(now + index * .08 + .2);
      });
    } catch (error) {
      // Sound is optional.
    }
  }

  function showToast(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove('show'); }, 2200);
  }

  function header(active) {
    return [
      '<header class="topbar">',
      '<button class="brand-button" data-nav="home" aria-label="工房コントロール室へ">',
      '<span class="brand-mark">H</span>',
      '<span class="brand-copy"><strong>ひらめき工房</strong><small>HIRAMEKI WORKSHOP</small></span>',
      '</button>',
      '<nav class="main-nav" aria-label="メインメニュー">',
      K ? navButton('courses', '◎ ' + course.short, active) : '',
      navButton('home', '⌂ 工房', active),
      navButton('map', '▤ 設計図', active),
      navButton('atelier', '◆ パーツ', active),
      navButton('parent', '● おうち', active),
      '<button class="icon-button" data-action="open-settings" aria-label="設定">⚙</button>',
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
    return { line, stage: line.stages[stageIndex], stageIndex };
  }

  function renderCourses() {
    if (!K) return renderHome();
    const cards = K.COURSE_ORDER.map(function (courseId) {
      const item = K.courseFor(courseId);
      const saved = K.courseState(rootState, courseId);
      const total = item.lineOrder.reduce(function (sum, lineId) { return sum + item.lines[lineId].stages.length; }, 0);
      const cleared = item.lineOrder.reduce(function (sum, lineId) { return sum + K.clearedCount(saved, courseId, lineId); }, 0);
      return [
        '<article class="course-card ', activeCourseId === courseId && rootState.courseChosen ? 'active' : '', '" style="--accent:', item.accent, ';--line-pale:', item.pale, '">',
        '<div class="course-number">', item.symbol, '</div><div class="eyebrow">', esc(item.chapterNo), '</div>',
        '<h2>', esc(item.label), '</h2><h3>', esc(item.chapter), '</h3><p>', esc(item.premise), '</p>',
        '<div class="progress-track"><div class="progress-fill" style="--progress:', Math.round(cleared / total * 100), '%"></div></div>',
        '<div class="line-progress-copy"><span>', cleared, ' / ', total, ' しゅうり</span><span>', item.lineOrder.length, 'ライン</span></div>',
        '<button class="primary-button" data-action="choose-course" data-course="', courseId, '">', cleared ? 'このコースを つづける' : 'このコースを はじめる', ' →</button>',
        '</article>'
      ].join('');
    }).join('');
    return shell([
      '<main class="page course-page"><section class="course-heading"><div class="eyebrow">CHOOSE YOUR COURSE</div>',
      '<h1>どの区画を しゅうりする？</h1><p>学年はいつでも切り替えられます。二年生から始めても大丈夫です。</p></section>',
      '<section class="course-grid">', cards, '</section></main>'
    ].join(''), 'courses');
  }

  function renderHome() {
    const mission = recommendedMission();
    const totalCleared = LINE_ORDER.reduce(function (sum, lineId) { return sum + clearedCount(lineId); }, 0);
    const totalStages = LINE_ORDER.reduce(function (sum, lineId) { return sum + lineFor(lineId).stages.length; }, 0);
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
      return [
        '<article class="line-card" style="', lineStyle(line), '">',
        '<div class="line-card-top"><span class="line-symbol">', esc(line.symbol), '</span><div><div class="eyebrow">LEARNING LINE</div><h3>', esc(line.name), '</h3></div></div>',
        '<p>', esc(line.description), '</p>',
        '<div class="progress-track"><div class="progress-fill" style="--progress:', Math.round(count / line.stages.length * 100), '%"></div></div>',
        '<div class="line-progress-copy"><span>', count, ' / ', line.stages.length, ' しゅうり</span><span>', totalMarks(lineId), ' / ', line.stages.length * 3, ' ひらめき印</span></div>',
        '<div class="line-card-actions">',
        '<button class="primary-button compact-button" style="', lineStyle(line), '" data-action="open-line" data-line="', lineId, '">', complete ? '設計図を見る' : 'つぎ：' + esc(next.name), '</button>',
        complete ? '<button class="secondary-button compact-button" data-action="start-rush" data-line="' + lineId + '">⚡ タイム</button>' : '<button class="soft-button compact-button" data-action="open-line" data-line="' + lineId + '">一覧</button>',
        '</div>',
        complete ? '<div class="rush-unlock">タイムアタック解放済み　ベスト ' + C.formatTimeMs(rush.bestMs) + '</div>' : '',
        '</article>'
      ].join('');
    }).join('');
    return shell([
      '<main class="page">',
      '<section class="hero" style="', lineStyle(mission.line), '">',
      '<div class="hero-copy"><div class="eyebrow">', esc(course.chapterNo), '・', esc(course.label), '</div><h1>', esc(state.workshopName || 'ひらめき'), '工房、<br>', esc(course.chapter), 'へ。</h1>',
      '<p>', esc(course.premise), '</p>',
      '<div class="hero-actions"><button class="primary-button" style="', lineStyle(mission.line), '" data-action="start-recommended" data-line="', mission.line.id, '" data-stage="', mission.stageIndex, '">', esc(mission.stage.name), 'を はじめる →</button>',
      '<button class="soft-button" data-nav="map">', LINE_ORDER.length, 'つのラインを見る</button></div></div>',
      '<div class="hero-machine"><div class="machine-title"><span>ルミナ復旧パネル</span><b>', totalCleared, ' / ', totalStages, '</b></div><div class="machine-lamps">', lamps, '</div><div class="machine-conveyor"></div>',
      '<p class="muted">ラインを修理すると、ここへエネルギーが集まります。</p></div>',
      '</section>',
      '<div class="section-heading"><div><div class="eyebrow">', LINE_ORDER.length, ' LEARNING LINES</div><h2>学習ラインを えらぶ</h2></div><p>どのラインもステージ1から始められます。</p></div>',
      '<section class="line-grid">', lineCards, '</section>',
      '</main>'
    ].join(''), 'home');
  }

  function lineTabs() {
    return '<div class="line-tabs" aria-label="学習ライン">' + LINE_ORDER.map(function (lineId) {
      const line = lineFor(lineId);
      return '<button class="line-tab ' + (ui.lineId === lineId ? 'active' : '') + '" style="' + lineStyle(line) + '" data-line-tab="' + lineId + '"><span>' + esc(line.symbol) + '</span>' + esc(line.short) + ' <small>' + clearedCount(lineId) + '/' + line.stages.length + '</small></button>';
    }).join('') + '</div>';
  }

  function renderMap() {
    const line = lineFor();
    const count = clearedCount(line.id);
    const complete = lineComplete(line.id);
    const zones = line.zones.map(function (zone) {
      const cards = line.stages.slice(zone.range[0], zone.range[1] + 1).map(function (stage, localIndex) {
        const index = zone.range[0] + localIndex;
        const progress = state.progress[stage.id] || {};
        const unlocked = isUnlocked(index, line.id);
        return [
          '<button class="stage-card ', progress.cleared ? 'cleared' : '', '" style="', lineStyle(line), '" data-stage="', index, '" ', unlocked ? '' : 'disabled', '>',
          '<span class="stage-number">', stage.n, '</span>',
          '<h3>', unlocked ? esc(stage.name) : 'まだ ひみつ', '</h3>',
          '<p>', unlocked ? esc(stage.action) : '前のステージを修理すると開きます。', '</p>',
          '<span class="stage-status">', progress.cleared ? marksText(progress.stars) : unlocked ? 'START →' : 'LOCK', '</span>',
          '</button>'
        ].join('');
      }).join('');
      return '<section class="zone-panel" style="' + lineStyle(line) + '"><div class="zone-head"><span class="zone-letter">' + zone.n + '</span><div><h2>' + esc(zone.name) + '</h2><small>' + esc(zone.note) + '</small></div></div><div class="stage-grid">' + cards + '</div></section>';
    }).join('');
    const rushAction = complete
      ? '<button class="secondary-button heading-action" data-action="start-rush" data-line="' + line.id + '">⚡ タイムアタック</button>'
      : '<button class="soft-button heading-action" disabled>' + line.stages.length + 'ステージ完了でタイムアタック</button>';
    return shell([
      '<main class="page">', lineTabs(),
      '<section class="page-heading-card" style="', lineStyle(line), '"><span class="heading-symbol">', esc(line.symbol), '</span><div><div class="eyebrow">REPAIR BLUEPRINT</div><h1>', esc(line.name), '</h1><p>', esc(line.description), '　', count, '/', line.stages.length, ' 修理済み</p></div>', rushAction, '</section>',
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
    state.recentQuestions[stage.id] = recent.concat(pack.questions.map(function (question) { return question.signature; })).slice(-32);
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
    ui.stageIntro = state.storySeen && !state.storySeen[stage.id] ? stage.id : null;
    saveState();
    playTone('tap');
    render();
    global.scrollTo(0, 0);
  }

  function machinePanel(line, stage, completed) {
    const energy = Array.from({ length: 5 }, function (_, index) {
      return '<span class="energy-cell ' + (index < Math.ceil(completed / STAGE_ROUNDS * 5) ? 'on' : '') + '"></span>';
    }).join('');
    return [
      '<aside class="mission-machine" style="', lineStyle(line), '"><div class="machine-face">',
      '<div class="machine-screen"><div><small>REPAIR PART</small><strong>', esc(stage.symbol), ' ', esc(stage.part), '</strong></div></div>',
      '<div class="energy-row">', energy, '</div><div class="machine-gears"><span>⚙</span><span>⚙</span></div>',
      '<p class="muted">正解すると装置へエネルギーが届きます。</p>',
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
      '<div class="game-toolbar"><div class="game-stage-copy"><strong>', stage.n, '. ', esc(stage.name), '</strong><small>', esc(stage.skill), '</small></div>',
      '<div class="round-dots" aria-label="', session.cursor + 1, '問目">', roundDots(STAGE_ROUNDS, session.cursor), '</div>',
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

  function graphHtml(labels, counts) {
    return '<div class="graph">' + labels.map(function (label, index) {
      return '<div class="graph-column"><div class="graph-bar" style="--count:' + counts[index] + '"></div><span>' + esc(label) + '<br>' + counts[index] + '</span></div>';
    }).join('') + '</div>';
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
    return '<div class="selectable-grid" style="' + lineStyle(line) + '">' + repeat(total, function (index) {
      const icon = visual.icons && visual.icons.length ? visual.icons[index % visual.icons.length] : visual.type === 'sticks' ? '┃' : visual.type === 'graph-build' ? '▤' : '◆';
      return '<button class="tap-piece ' + (selected.has(index) ? 'selected' : '') + '" data-piece="' + index + '" aria-pressed="' + selected.has(index) + '">' + esc(icon) + '</button>';
    }) + '</div>';
  }

  function gridPanel(size, active, interactive, selected) {
    const activeSet = new Set(active || []);
    const selectedSet = new Set(selected || []);
    return '<div class="grid-panel">' + repeat(size * size, function (index) {
      if (interactive) {
        return '<button class="grid-cell ' + (selectedSet.has(index) ? 'selected' : '') + '" data-piece="' + index + '" aria-label="マス' + (index + 1) + '" aria-pressed="' + selectedSet.has(index) + '"></button>';
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

  function visualHtml(question, line) {
    const visual = question.visual || {};
    if (question.kind === 'tap' || question.kind === 'remove') {
      return '<div class="visual-board" style="' + lineStyle(line) + '">' + interactivePieces(question, line) + '</div>';
    }
    if (question.kind === 'select') {
      if (visual.type === 'grid-copy') {
        return '<div class="visual-board" style="' + lineStyle(line) + '"><div class="grid-copy"><div><strong>みほん</strong>' + gridPanel(visual.size || 3, visual.target, false) + '</div><div><strong>つくるところ</strong>' + gridPanel(visual.size || 3, [], true, question.selected) + '</div></div></div>';
      }
      const target = visual.start == null ? [] : [visual.start];
      return '<div class="visual-board" style="' + lineStyle(line) + '"><div class="grid-copy"><div><strong>いまの位置</strong>' + gridPanel(visual.size || 3, target, false) + '</div><div><strong>コピー先</strong>' + gridPanel(visual.size || 3, [], true, question.selected) + '</div></div></div>';
    }
    if (question.kind === 'clock') {
      return '<div class="visual-board" style="' + lineStyle(line) + '">' + clockHtml(question.input) + '</div>';
    }
    if (visual.type === 'objects') {
      return '<div class="visual-board" style="' + lineStyle(line) + '"><div class="object-grid">' + repeat(visual.count, function () { return '<span class="object-chip">' + esc(visual.icon || '◆') + '</span>'; }) + '</div></div>';
    }
    if (visual.type === 'compare-groups') {
      return '<div class="visual-board" style="' + lineStyle(line) + '"><div class="group-compare"><div class="group-box">' + miniParts(visual.left) + '</div><span class="compare-divider">くらべる</span><div class="group-box">' + miniParts(visual.right) + '</div></div></div>';
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
      return '<div class="visual-board" style="' + lineStyle(line) + '"><div class="object-grid">' + visual.items.map(function (item) { return '<span class="object-chip">' + esc(item) + '</span>'; }).join('') + '</div><p class="muted">' + (visual.direction === 'right' ? '← みぎから数える' : 'ひだりから数える →') + '</p></div>';
    }
    if (visual.type === 'ten-bundle' || visual.type === 'ten-bundle-remove') {
      const number = visual.type === 'ten-bundle' ? visual.tens * 10 + visual.ones : visual.a;
      return '<div class="visual-board" style="' + lineStyle(line) + '"><div class="ten-frame-wrap">' + tenFrame(Math.min(10, number)) + '<div class="loose-parts">' + miniParts(Math.max(0, number - 10)) + '</div></div></div>';
    }
    if (visual.type === 'place-value' || visual.type === 'place-value-remove') {
      const number = visual.type === 'place-value' ? visual.tens * 10 + visual.ones : visual.a;
      const tens = Math.floor(number / 10);
      const ones = number % 10;
      return '<div class="visual-board" style="' + lineStyle(line) + '"><div class="place-value-board"><div class="place-column"><strong>十の位</strong><div class="bundle-stack">' + repeat(tens, function () { return '<span class="ten-stick"></span>'; }) + '</div></div><div class="place-column"><strong>一の位</strong><div class="bundle-stack">' + repeat(ones, function () { return '<span class="one-cube"></span>'; }) + '</div></div></div></div>';
    }
    if (visual.type === 'place-value-compare') {
      return '<div class="visual-board" style="' + lineStyle(line) + '"><div class="relation-board"><span class="relation-node">' + visual.left + '</span><span class="operation-symbol">?</span><span class="relation-node">' + visual.right + '</span></div></div>';
    }
    if (visual.type === 'merge' || visual.type === 'crane' || visual.type === 'story') {
      const counts = visual.counts || [0, 0];
      return '<div class="visual-board" style="' + lineStyle(line) + '"><div class="merge-board"><div class="belt-box"><strong>' + counts[0] + '</strong>部品</div><span class="operation-symbol">' + esc(visual.operation || '+') + '</span><div class="belt-box"><strong>' + counts[1] + '</strong>部品</div></div></div>';
    }
    if (visual.type === 'dial') {
      return '<div class="visual-board" style="' + lineStyle(line) + '"><div class="relation-board"><span class="relation-node">' + visual.counts[0] + '</span><span class="operation-symbol">' + esc(visual.operation) + '</span><span class="relation-node">' + visual.counts[1] + '</span></div></div>';
    }
    if (visual.type === 'three-step') {
      return '<div class="visual-board" style="' + lineStyle(line) + '"><div class="number-rail"><span class="rail-stop">' + visual.values[0] + '</span><span class="rail-link"></span><span class="operation-symbol">' + visual.ops[0] + visual.values[1] + '</span><span class="rail-link"></span><span class="operation-symbol">' + visual.ops[1] + visual.values[2] + '</span><span class="rail-link"></span><span class="rail-stop">?</span></div></div>';
    }
    if (visual.type === 'circuit') {
      return '<div class="visual-board" style="' + lineStyle(line) + '"><div class="machine-screen"><strong>⌁　⌁　⌁</strong><span>' + esc(visual.equation || '正しい回路をえらぶ') + '</span></div><div class="machine-conveyor"></div></div>';
    }
    if (visual.type === 'make-ten' || visual.type === 'break-ten') {
      const a = visual.a;
      return '<div class="visual-board" style="' + lineStyle(line) + '"><div class="ten-frame-wrap">' + tenFrame(Math.min(10, a)) + '<div><strong>' + a + (visual.type === 'make-ten' ? ' ＋ ' : ' − ') + visual.b + '</strong><p class="muted">10のまとまりを使う</p></div></div></div>';
    }
    if (visual.type === 'remove' || visual.type === 'switch') {
      const total = visual.total;
      return '<div class="visual-board" style="' + lineStyle(line) + '"><div class="object-grid">' + repeat(total, function () { return '<span class="object-chip">◆</span>'; }) + '</div><p class="muted">' + (visual.mode === 'none' ? '何も取り出さない' : visual.mode === 'all' ? '全部取り出す' : '') + '</p></div>';
    }
    if (visual.type === 'length') {
      return '<div class="visual-board" style="' + lineStyle(line) + '"><div class="length-board"><span class="length-bar" style="--length:' + visual.left + ';--bar-color:' + line.accent + '"></span><span class="length-bar ' + (visual.aligned ? '' : 'offset') + '" style="--length:' + visual.right + ';--bar-color:#ffd45c"></span></div></div>';
    }
    if (visual.type === 'unit-length') {
      return '<div class="visual-board" style="' + lineStyle(line) + '"><div class="unit-strip">' + repeat(visual.count, function () { return '<span class="unit-block"></span>'; }) + '</div></div>';
    }
    if (visual.type === 'tools') {
      return '<div class="visual-board" style="' + lineStyle(line) + '"><div class="object-grid"><span class="object-chip">📏</span><span class="object-chip">〰</span><span class="object-chip">▥</span></div><p class="muted">' + esc(visual.scene) + '</p></div>';
    }
    if (visual.type === 'capacity') {
      return '<div class="visual-board" style="' + lineStyle(line) + '"><div class="tank-board"><div class="tank"><span class="tank-fill" style="--fill:' + visual.left + '"></span></div><div class="tank"><span class="tank-fill" style="--fill:' + visual.right + '"></span></div></div></div>';
    }
    if (visual.type === 'area') {
      return '<div class="visual-board" style="' + lineStyle(line) + '"><div class="area-board"><div class="area-grid">' + repeat(12, function (index) { return '<span class="area-cell ' + (index < visual.left ? 'filled' : '') + '"></span>'; }) + '</div><div class="area-grid">' + repeat(12, function (index) { return '<span class="area-cell ' + (index < visual.right ? 'filled' : '') + '"></span>'; }) + '</div></div></div>';
    }
    if (visual.type === 'solid-scan' || visual.type === 'solid-action' || visual.type === 'stamp') {
      return '<div class="visual-board" style="' + lineStyle(line) + '"><div class="solid-board"><span class="solid-token">' + esc(visual.icon || visual.solid) + '</span>' + (visual.face ? '<span class="operation-symbol">→</span><span class="solid-token">' + esc(visual.face) + '</span>' : '') + '</div></div>';
    }
    if (visual.type === 'sort') {
      return '<div class="visual-board" style="' + lineStyle(line) + '"><div class="sort-board"><span class="sort-item">' + esc(visual.item) + '</span><div class="sort-bins">' + visual.bins.map(function (bin) { return '<span class="sort-bin">' + esc(bin) + '</span>'; }).join('') + '</div></div></div>';
    }
    if (visual.type === 'transform') {
      return '<div class="visual-board" style="' + lineStyle(line) + '"><div class="solid-board">' + repeat(visual.pieces, function (index) { return '<span class="object-chip">' + (index % 2 ? '◩' : '◪') + '</span>'; }) + '<span class="operation-symbol">↻</span></div></div>';
    }
    if (visual.type === 'aligned-data' || visual.type === 'graph') {
      return '<div class="visual-board" style="' + lineStyle(line) + '">' + graphHtml(visual.labels, visual.counts) + '</div>';
    }
    if (visual.type === 'operation-choice') {
      return '<div class="visual-board" style="' + lineStyle(line) + '"><div class="relation-board"><span class="relation-node">場面</span><span class="operation-symbol">?</span><span class="relation-node">＋ / −</span></div></div>';
    }
    if (visual.type === 'story-model' || visual.type === 'relation') {
      const math = visual.math || question.math || {};
      return '<div class="visual-board" style="' + lineStyle(line) + '"><div class="relation-board"><span class="relation-node">' + esc(math.a == null ? 'お話' : math.a) + '</span><span class="operation-symbol">' + (math.kind === 'subtract' ? '−' : '+') + '</span><span class="relation-node">' + esc(math.b == null ? '?' : math.b) + '</span></div></div>';
    }
    if (visual.type === 'equal-groups') {
      return '<div class="visual-board" style="' + lineStyle(line) + '"><div class="object-grid">' + repeat(visual.groups, function () { return '<span class="object-chip">' + visual.perGroup + 'こ</span>'; }) + '</div><p class="muted">同じ数ずつのグループ</p></div>';
    }
    return '<div class="visual-board" style="' + lineStyle(line) + '"><div class="machine-screen"><strong>ひらめき装置</strong><span>操作して答えを見つけよう</span></div></div>';
  }

  function optionLabel(option) {
    return typeof option === 'object' && option !== null ? option.label : option;
  }

  function optionValue(option) {
    return C.optionValue(option);
  }

  function actionHtml(question, line) {
    if (question.feedback) return feedbackHtml(question);
    if (question.kind === 'choice' || question.kind === 'route' || question.kind === 'sort') {
      return '<div class="answers">' + (question.options || []).map(function (option) {
        return '<button class="answer-button" style="' + lineStyle(line) + '" data-answer="' + attr(optionValue(option)) + '">' + esc(optionLabel(option)) + '</button>';
      }).join('') + '</div>';
    }
    if (question.kind === 'tap' || question.kind === 'remove' || question.kind === 'select') {
      const current = question.kind === 'select' ? (question.selected || []).length + 'マス' : (question.selected || []).length + 'こ';
      return '<div class="operation-panel"><div class="operation-readout">' + current + ' えらんだ</div><div class="submit-row"><button class="soft-button" data-action="reset-operation">やりなおす</button><button class="primary-button" style="' + lineStyle(line) + '" data-action="submit-operation">けってい</button></div></div>';
    }
    if (question.kind === 'order') {
      const selected = question.orderSelected || [];
      return '<div class="operation-panel"><div class="order-workbench"><div class="order-source">' + question.options.map(function (value) {
        return '<button class="order-chip" data-order-value="' + attr(value) + '" ' + (selected.map(String).includes(String(value)) ? 'disabled' : '') + '>' + esc(value) + '</button>';
      }).join('') + '</div><div class="order-target">' + (selected.length ? selected.map(function (value) { return '<span class="order-chip">' + esc(value) + '</span>'; }).join('') : '<span class="muted">ここへ じゅんばんに ならぶよ</span>') + '</div></div><div class="submit-row"><button class="soft-button" data-action="reset-operation">やりなおす</button><button class="primary-button" style="' + lineStyle(line) + '" data-action="submit-operation">けってい</button></div></div>';
    }
    if (question.kind === 'slider') {
      const value = question.input === '' ? question.min : question.input;
      return '<div class="operation-panel"><div class="operation-readout">' + esc(value) + '</div><div class="adjuster"><button class="adjust-button" style="' + lineStyle(line) + '" data-adjust="-1">−</button><div class="adjust-value">ギアを まわす</div><button class="adjust-button" style="' + lineStyle(line) + '" data-adjust="1">＋</button></div><div class="submit-row"><button class="primary-button" style="' + lineStyle(line) + '" data-action="submit-operation">この数で けってい</button></div></div>';
    }
    if (question.kind === 'clock') {
      const clock = parseClock(question.input);
      return '<div class="operation-panel"><div class="operation-readout">' + clock.hour + ':' + String(clock.minute).padStart(2, '0') + '</div><div class="clock-controls"><div class="clock-control"><strong>短い針</strong><div class="clock-button-row"><button class="adjust-button" style="' + lineStyle(line) + '" data-clock-part="hour" data-clock-delta="-1">−</button><button class="adjust-button" style="' + lineStyle(line) + '" data-clock-part="hour" data-clock-delta="1">＋</button></div></div><div class="clock-control"><strong>長い針</strong><div class="clock-button-row"><button class="adjust-button" style="' + lineStyle(line) + '" data-clock-part="minute" data-clock-delta="-1">−</button><button class="adjust-button" style="' + lineStyle(line) + '" data-clock-part="minute" data-clock-delta="1">＋</button></div></div></div><div class="submit-row"><button class="primary-button" style="' + lineStyle(line) + '" data-action="submit-operation">この時刻で けってい</button></div></div>';
    }
    return '<div class="operation-panel"><div class="operation-readout">' + esc(question.input || '？') + '</div><div class="keypad">' + [1, 2, 3, 4, 5, 6, 7, 8, 9, 'けす', 0, 'けってい'].map(function (key) { return '<button class="key-button" data-key="' + key + '">' + key + '</button>'; }).join('') + '</div></div>';
  }

  function feedbackHtml(question) {
    const feedback = question.feedback;
    const good = feedback.kind === 'good' || feedback.kind === 'recovered';
    const buttonLabel = feedback.action === 'retry' ? (session && session.mode === 'timeAttack' ? 'もういちど' : 'ヒントを見て もういちど') : 'つぎへ';
    return '<div class="feedback-panel ' + (good ? 'good' : 'hint') + '"><h3>' + esc(feedback.title) + '</h3><p>' + esc(feedback.text) + '</p><button class="' + (good ? 'primary-button' : 'secondary-button') + '" data-action="' + (feedback.action === 'retry' ? 'retry-question' : 'next-question') + '">' + buttonLabel + ' →</button></div>';
  }

  function renderQuestionCard(question, line, rush) {
    const tags = [
      '<span class="question-tag action">ACTION</span>',
      question.story ? '<span class="question-tag story">おはなし</span>' : '',
      question.checkpoint ? '<span class="question-tag check">かくにん</span>' : '',
      rush ? '<span class="question-tag check">TIME ATTACK</span>' : ''
    ].join('');
    const hint = question.showHint && !rush && !question.feedback ? '<div class="inline-hint"><strong>トトの ヒント：</strong>' + esc(question.hint) + '</div>' : '';
    return [
      '<section class="', rush ? 'rush-question' : 'question-card', '" style="', lineStyle(line), '">',
      '<div class="question-tags">', tags, '</div>',
      '<h1 class="question-title">', esc(question.prompt), '</h1>',
      '<p class="question-instruction">', esc(question.instruction), '</p>',
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
        question.feedback = { kind: 'hint', title: '＋3びょう', text: '同じミッションを もういちど。', action: 'retry' };
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
      lineCompleted: lineComplete(line.id)
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
    const line = lineFor(result.lineId);
    const stage = line.stages[result.stageIndex];
    const next = result.stageIndex + 1;
    const nextButton = result.cleared && next < line.stages.length
      ? '<button class="primary-button" style="' + lineStyle(line) + '" data-stage="' + next + '">つぎのステージ →</button>'
      : '<button class="primary-button" style="' + lineStyle(line) + '" data-nav="map">設計図へ もどる</button>';
    return shell([
      '<main class="result-card" style="', lineStyle(line), '"><div class="result-burst">', result.cleared ? esc(stage.symbol) : '↻', '</div>',
      '<div class="eyebrow">REPAIR REPORT</div><h1>', result.cleared ? 'しゅうり かんりょう！' : 'もういちど ためそう', '</h1>',
      '<p>', result.cleared ? esc(stage.part) + 'を取り付けました。考えたことが装置の動きになったね。' : '5問正解で修理完了。ヒントを使って、もう一度動かしてみよう。', '</p>',
      result.firstClear ? '<div class="rush-unlock">✦ ' + esc(course.chapter) + 'の「' + esc(stage.name) + '」が動き出しました。ルミナの明かりが一つ戻った！</div>' : '',
      '<div class="score-grid"><div class="score-box"><strong>', result.score, ' / 8</strong><small>さいしょの正解</small></div><div class="score-box"><strong>', marksText(result.stars), '</strong><small>ひらめき印</small></div><div class="score-box"><strong>', result.elapsed, '秒</strong><small>しゅうり時間</small></div></div>',
      result.lineCompleted ? '<div class="rush-unlock">⚡ ' + esc(line.name) + 'の タイムアタックが ひらきました！</div>' : '',
      '<div class="button-row" style="justify-content:center;margin-top:22px"><button class="soft-button" data-action="retry-stage" data-stage="', result.stageIndex, '">もういちど</button>', nextButton,
      result.lineCompleted ? '<button class="secondary-button" data-action="start-rush" data-line="' + line.id + '">⚡ タイムアタック</button>' : '', '</div>',
      '<div class="button-row" style="justify-content:center;margin-top:16px"><span class="muted">どんな気分？</span><button class="soft-button compact-button" data-mood="fun" data-stage-id="', stage.id, '">たのしい</button><button class="soft-button compact-button" data-mood="okay" data-stage-id="', stage.id, '">できた</button><button class="soft-button compact-button" data-mood="hard" data-stage-id="', stage.id, '">むずかしい</button></div>',
      '</main>'
    ].join(''), '');
  }

  function startTimeAttack(lineId) {
    const line = lineFor(lineId);
    if (!lineComplete(line.id)) {
      showToast('11ステージを しゅうりすると ひらきます');
      return;
    }
    const seed = randomSeed();
    const recent = Array.isArray(state.recentRush[line.id]) ? state.recentRush[line.id] : [];
    const pack = K
      ? K.makeTimeAttackQuestions(activeCourseId, line.id, { seed, exclude: recent })
      : C.makeTimeAttackQuestions(line.id, { seed, exclude: recent });
    pack.questions.forEach(function (question) { question.initialInput = question.input; });
    state.recentRush[line.id] = recent.concat(pack.questions.map(function (question) { return question.signature; })).slice(-36);
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
    if (penalty) penalty.textContent = session.timer.penaltyMs ? '＋' + Math.round(session.timer.penaltyMs / 1000) + '秒' : 'ノーミス';
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
    if (!session.startedAt) {
      return '<main class="rush-shell" style="' + lineStyle(line) + '"><section class="rush-ready"><div class="rush-ready-inner"><div class="result-burst">⚡</div><div class="eyebrow">HIRAMEKI TIME ATTACK</div><h1>' + esc(line.name) + '</h1><p style="color:#dfe8ff">12ミッションの合計タイムに挑戦。ミスすると3秒加算されます。問題は毎回ランダムです。</p><div class="score-grid"><div class="score-box"><strong>12問</strong><small>ランダムミッション</small></div><div class="score-box"><strong>＋3秒</strong><small>ミス1回</small></div><div class="score-box"><strong>' + C.formatTimeMs(state.timeAttack[line.id].bestMs) + '</strong><small>自己ベスト</small></div></div><div class="button-row" style="justify-content:center"><button class="soft-button" data-action="cancel-rush">もどる</button><button class="secondary-button" data-action="begin-rush">スタート！</button></div></div></section></main>';
    }
    const question = currentQuestion();
    return [
      '<main class="rush-shell" style="', lineStyle(line), '"><header class="rush-head"><button class="nav-button" data-action="ask-quit">× 中断</button>',
      '<div class="rush-timer"><small>TIME</small><span class="live-timer">', C.formatTimeMs(elapsedRushMs()), '</span><small data-rush-penalty>', session.timer.penaltyMs ? '＋' + Math.round(session.timer.penaltyMs / 1000) + '秒' : 'ノーミス', '</small></div>',
      '<div class="rush-progress"><strong>', session.cursor + 1, ' / ', TIME_ATTACK_ROUNDS, '</strong></div></header>',
      renderQuestionCard(question, line, true), renderOverlay(), '</main>'
    ].join('');
  }

  function renderRushResult() {
    const result = ui.result;
    if (!result || result.mode !== 'timeAttack') return renderHome();
    const line = lineFor(result.lineId);
    return shell([
      '<main class="result-card" style="', lineStyle(line), '"><div class="result-burst">⚡</div><div class="eyebrow">TIME ATTACK COMPLETE</div>',
      '<h1>', result.isBest ? 'じこベスト！' : '12ミッション かんりょう！', '</h1><p>', esc(line.name), 'の装置を一気に動かしました。</p>',
      '<div class="score-grid"><div class="score-box"><strong>', C.formatTimeMs(result.rawMs), '</strong><small>操作タイム</small></div><div class="score-box"><strong>＋', Math.round(result.mistakes * 3), '秒</strong><small>ミス ', result.mistakes, '回</small></div><div class="score-box"><strong>', C.formatTimeMs(result.officialMs), '</strong><small>公式タイム</small></div></div>',
      '<div class="rush-unlock">自己ベスト　', C.formatTimeMs(result.bestMs), '</div>',
      '<div class="button-row" style="justify-content:center;margin-top:22px"><button class="soft-button" data-nav="home">工房へ</button><button class="secondary-button" data-action="start-rush" data-line="', line.id, '">もういちど 挑戦</button></div></main>'
    ].join(''), '');
  }

  function renderAtelier() {
    const totalStages = LINE_ORDER.reduce(function (sum, lineId) { return sum + lineFor(lineId).stages.length; }, 0);
    const cards = LINE_ORDER.map(function (lineId) {
      const line = lineFor(lineId);
      const count = clearedCount(lineId);
        return '<article class="collection-card" style="' + lineStyle(line) + '"><div class="line-card-top"><span class="line-symbol">' + esc(line.symbol) + '</span><div><h3>' + esc(line.name) + '</h3><small>' + count + ' / ' + line.stages.length + ' パーツ</small></div></div><div class="parts-grid">' + line.stages.map(function (stage) {
        const on = Boolean(state.parts[stage.id]);
        return '<div class="part-chip ' + (on ? 'on' : '') + '"><b>' + (on ? esc(stage.symbol) : '?') + '</b>' + (on ? esc(stage.part) : 'まだ ひみつ') + '</div>';
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
    const scenes = [
      { icon: '🦊', speaker: 'トト', title: 'ルミナの あかりが きえちゃった！', text: 'そらのまちの そうちが、あちこちで とまっているんだ。' },
      { icon: '🤖', speaker: 'モクモ', title: 'なおすボタンだけでは うごきません。', text: '見て、分けて、組み立てて。きみの ひらめきが エネルギーになります。' },
      { icon: '⚡', speaker: 'トト', title: 'ひらめき工房を ひらこう。', text: '担当する学年の区画を選んで、ルミナの機能を一つずつ取り戻そう！' }
    ];
    if (ui.openingStep < scenes.length) {
      const scene = scenes[ui.openingStep];
      return '<div class="overlay"><section class="opening-card" role="dialog" aria-modal="true"><div class="mascot">' + scene.icon + '</div><div><div class="eyebrow">' + scene.speaker + '</div><h2>' + scene.title + '</h2><p>' + scene.text + '</p><button class="primary-button" data-action="opening-next">つぎへ →</button></div></section></div>';
    }
    return '<div class="overlay"><section class="opening-card" role="dialog" aria-modal="true"><div class="mascot">🏭</div><div><div class="eyebrow">WORKSHOP NAME</div><h2>こうぼうの なまえを きめよう。</h2><label for="workshopNameInput">8もじまで</label><input id="workshopNameInput" class="name-input" maxlength="8" placeholder="ひらめき" value="' + esc(state.workshopName) + '"><button class="primary-button" data-action="finish-opening">この なまえで はじめる</button></div></section></div>';
  }

  function renderCourseIntro() {
    if (ui.courseIntroStep == null || !K) return '';
    const scenes = [
      { icon: activeCourseId === 'g2' ? '🏗️' : '💡', speaker: 'トト', title: course.chapter + 'を たんとうしよう。', text: course.premise },
      { icon: '🤖', speaker: 'モクモ', title: LINE_ORDER.length + 'つの しゅうりラインを ひらきました。', text: 'どのラインも1番から始められます。まずは気になる装置を選んでください。' }
    ];
    const scene = scenes[Math.min(ui.courseIntroStep, scenes.length - 1)];
    const last = ui.courseIntroStep >= scenes.length - 1;
    return '<div class="overlay"><section class="opening-card" role="dialog" aria-modal="true"><div class="mascot">' + scene.icon + '</div><div><div class="eyebrow">' + esc(scene.speaker) + '・' + esc(course.label) + '</div><h2>' + esc(scene.title) + '</h2><p>' + esc(scene.text) + '</p><button class="primary-button" data-action="' + (last ? 'finish-course-intro' : 'course-intro-next') + '">' + (last ? '区画へ はいる' : 'つぎへ') + ' →</button></div></section></div>';
  }

  function renderStageIntro() {
    if (!ui.stageIntro || !session || session.mode !== 'standard') return '';
    const line = lineFor(session.lineId);
    const stage = line.stages[session.stageIndex];
    const actionCopy = /[。！？]$/.test(stage.action) ? stage.action : stage.action + '。';
    return '<div class="overlay"><section class="opening-card mission-opening" role="dialog" aria-modal="true"><div class="mascot">' + esc(stage.symbol) + '</div><div><div class="eyebrow">REPAIR MISSION ' + stage.n + '・トト</div><h2>' + esc(stage.name) + 'が とまっている！</h2><p>' + esc(actionCopy) + 'この装置を直して、' + esc(course.chapter) + 'へ明かりを戻そう。</p><button class="primary-button" style="' + lineStyle(line) + '" data-action="begin-stage">しゅうりを はじめる →</button></div></section></div>';
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
    if (ui.stageIntro) return renderStageIntro();
    if (!ui.modal) return '';
    if (ui.modal === 'settings') {
      return '<div class="overlay"><section class="modal-card" role="dialog" aria-modal="true" aria-label="設定"><h2>せってい</h2><div class="setting-row"><span>おと</span><button class="toggle ' + (state.settings.sound ? 'on' : '') + '" data-action="toggle-sound">' + (state.settings.sound ? 'オン' : 'オフ') + '</button></div><div class="setting-row"><span>うごき</span><button class="toggle ' + (state.settings.motion ? 'on' : '') + '" data-action="toggle-motion">' + (state.settings.motion ? 'オン' : 'オフ') + '</button></div><div class="setting-row" style="display:block"><label for="renameInput">こうぼうの なまえ</label><input id="renameInput" class="name-input" maxlength="8" value="' + esc(state.workshopName) + '"></div><div class="button-row" style="margin-top:18px"><button class="soft-button" data-action="close-modal">とじる</button><button class="primary-button" data-action="save-settings">ほぞん</button></div>' + (!isStandalone() ? '<hr><button class="secondary-button" data-action="install-app">ホーム画面に追加</button>' : '') + '</section></div>';
    }
    if (ui.modal === 'quit') {
      return '<div class="overlay"><section class="modal-card" role="dialog" aria-modal="true"><h2>ここで ちゅうだんする？</h2><p>' + (session && session.mode === 'timeAttack' ? '今回のタイムは記録されません。' : 'いまのステージの記録は残りません。') + '</p><div class="button-row"><button class="soft-button" data-action="close-modal">つづける</button><button class="danger-button" data-action="quit-session">ちゅうだんする</button></div></section></div>';
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

  function render() {
    document.body.classList.toggle('no-motion', !state.settings.motion);
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
      const dialogControl = document.querySelector('.overlay button, .overlay input');
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

  function switchLine(lineId, goToMap) {
    if (!LINES[lineId]) return;
    ui.lineId = lineId;
    ui.islandId = lineId;
    state.lastLine = lineId;
    state.lastIsland = lineId;
    if (goToMap) ui.screen = 'map';
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
      state.workshopName = (input && input.value.trim() || 'ひらめき').slice(0, 8);
      if (K) {
        rootState.workshopName = state.workshopName;
        rootState.introSeen = true;
        rootState.courseChosen = false;
        ui.screen = 'courses';
      } else state.introSeen = true;
      ui.openingStep = null;
      saveState();
      playTone('finish');
      render();
      showToast(state.workshopName + '工房、オープン！');
    }
    else if (action === 'choose-course') {
      if (!activateCourse(actionNode.dataset.course)) return;
      ui.screen = 'home';
      ui.result = null;
      ui.courseIntroStep = state.introSeen ? null : 0;
      saveState();
      playTone('finish');
      render();
      global.scrollTo(0, 0);
    }
    else if (action === 'course-intro-next') { ui.courseIntroStep += 1; playTone('tap'); render(); }
    else if (action === 'finish-course-intro') {
      state.introSeen = true;
      ui.courseIntroStep = null;
      saveState();
      playTone('finish');
      render();
    }
    else if (action === 'begin-stage') {
      if (session) {
        const activeStage = lineFor(session.lineId).stages[session.stageIndex];
        state.storySeen[activeStage.id] = true;
        session.startedAt = Date.now();
      }
      ui.stageIntro = null;
      saveState();
      playTone('finish');
      render();
    }
    else if (action === 'open-line') switchLine(actionNode.dataset.line, true);
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
    else if (action === 'toggle-sound') { state.settings.sound = !state.settings.sound; saveState(); render(); }
    else if (action === 'toggle-motion') { state.settings.motion = !state.settings.motion; saveState(); render(); }
    else if (action === 'save-settings') {
      const rename = document.getElementById('renameInput');
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
      ui = { screen: K ? 'courses' : 'home', modal: null, openingStep: 0, courseIntroStep: null, stageIntro: null, lineId: LINE_ORDER[0], islandId: LINE_ORDER[0], result: null };
      render();
    }
    else if (action === 'install-app') requestInstall();
    else if (action === 'apply-update' && waitingWorker) waitingWorker.postMessage({ type: 'SKIP_WAITING' });
  });

  document.addEventListener('visibilitychange', function () {
    if (!session || session.mode !== 'timeAttack' || !session.startedAt) return;
    if (document.visibilityState === 'hidden' && !session.timer.pausedAt) {
      session.timer.pausedAt = Date.now();
    } else if (document.visibilityState === 'visible' && session.timer.pausedAt) {
      session.timer.pausedMs += Date.now() - session.timer.pausedAt;
      session.timer.pausedAt = null;
      updateRushTimer();
    }
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
    getUi: function () { return ui; }
  };

  /* TEST_HOOK */
  render();
}(typeof globalThis !== 'undefined' ? globalThis : window));
