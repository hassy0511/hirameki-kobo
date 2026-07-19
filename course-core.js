(function (global) {
  'use strict';

  const G1 = global.HiramekiCore;
  const G2 = global.HiramekiGrade2Curriculum;
  if (!G1 || !G2) throw new Error('Grade 1 core and Grade 2 curriculum are required');

  const STATE_VERSION = 4;
  const STORE_KEY = G1.STORE_KEY;

  const G1_RECOMMENDED = [
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

  const G2_COLORS = {
    number: ['#12a88c', '#ddf8f2'],
    written: ['#ef6b4a', '#fff0e9'],
    multiplication: ['#8758d8', '#f1ebff'],
    measure: ['#258fd3', '#e7f5ff'],
    shape: ['#db607f', '#ffeaf0'],
    solve: ['#d49317', '#fff5d8']
  };

  function normalizeG2Line(raw) {
    const colors = G2_COLORS[raw.id] || ['#4f6fe8', '#edf1ff'];
    const stages = Array.from(raw.stages, function (item) {
      return Object.freeze(Object.assign({}, item, {
        skill: item.objective,
        part: item.name.replace(/(ライン|メインコア|チェッカー).*$/, '') + 'パーツ',
        symbol: raw.symbol
      }));
    });
    const zones = Array.from(raw.zones, function (zone) {
      return Object.freeze({
        n: zone.id,
        id: zone.id,
        name: zone.name,
        note: zone.note,
        range: [Math.max(0, zone.range[0] - 1), Math.max(0, zone.range[1] - 1)]
      });
    });
    return Object.freeze(Object.assign({}, raw, {
      accent: colors[0],
      pale: colors[1],
      stages: Object.freeze(stages),
      zones: Object.freeze(zones)
    }));
  }

  const G2_LINES = Object.freeze(G2.lineOrder.reduce(function (result, lineId) {
    result[lineId] = normalizeG2Line(G2.lines[lineId]);
    return result;
  }, {}));

  function expandRecommendedPath(path) {
    const result = [];
    path.forEach(function (term) {
      term.steps.forEach(function (step) {
        const parts = String(step).split(':');
        const range = String(parts[1]).split('-').map(Number);
        for (let number = range[0]; number <= (range[1] || range[0]); number += 1) {
          result.push([parts[0], number - 1]);
        }
      });
    });
    return result;
  }

  const COURSES = Object.freeze({
    g1: Object.freeze({
      id: 'g1', gradeId: 'g1', subjectId: 'math', label: '小学1年生 算数', short: '1年生',
      chapter: 'はじまり区画', chapterNo: 'CHAPTER 1', symbol: '1', accent: '#27c2a4', pale: '#dffaf4',
      premise: '光・数・形を動かして、ルミナの基礎装置を目覚めさせよう。',
      lineOrder: Object.freeze(G1.LINE_ORDER.slice()), lines: G1.LINES,
      recommendedPath: Object.freeze(G1_RECOMMENDED), stageRounds: 8, timeAttackRounds: 12
    }),
    g2: Object.freeze({
      id: 'g2', gradeId: 'g2', subjectId: 'math', label: '小学2年生 算数', short: '2年生',
      chapter: 'ひろがり区画', chapterNo: 'CHAPTER 2', symbol: '2', accent: '#6b65d8', pale: '#efedff',
      premise: '大きな数、筆算、九九をつないで、止まった大型装置を動かそう。',
      lineOrder: Object.freeze(Array.from(G2.lineOrder)), lines: G2_LINES,
      recommendedPath: Object.freeze(expandRecommendedPath(G2.recommendedPath)), stageRounds: 8, timeAttackRounds: 12
    })
  });
  const COURSE_ORDER = Object.freeze(['g1', 'g2']);

  function emptyStats() {
    return { totalAnswers: 0, correctAnswers: 0, totalSeconds: 0, bestChain: 0 };
  }

  function emptyTimeAttack() {
    return { runs: 0, bestMs: null, bestRawMs: null, bestMistakes: null, bestSeed: null, lastMs: null, lastMistakes: null, lastPlayed: null };
  }

  function createCourseState(courseId) {
    const course = COURSES[courseId];
    if (!course) throw new Error('Unknown course state: ' + courseId);
    const lineStats = {};
    const lineIntros = {};
    const timeAttack = {};
    course.lineOrder.forEach(function (lineId) {
      lineStats[lineId] = emptyStats();
      lineIntros[lineId] = false;
      timeAttack[lineId] = emptyTimeAttack();
    });
    return {
      introSeen: false,
      lastLine: course.lineOrder[0],
      lastIsland: course.lineOrder[0],
      progress: {}, parts: {}, moods: {}, storySeen: {},
      stats: emptyStats(), lineStats: lineStats, islandStats: lineStats,
      lineIntros: lineIntros, islandIntros: lineIntros,
      timeAttack: timeAttack, recentQuestions: {}, recentRush: {}, history: []
    };
  }

  function createDefaultState() {
    return {
      version: STATE_VERSION,
      introSeen: false,
      courseChosen: false,
      workshopName: '',
      activeCourseId: 'g1',
      settings: { sound: true, motion: true },
      courses: { g1: createCourseState('g1'), g2: createCourseState('g2') }
    };
  }

  function mergeStats(saved) {
    return Object.assign(emptyStats(), saved || {});
  }

  function mergeCourseState(courseId, saved) {
    const base = createCourseState(courseId);
    const source = saved && typeof saved === 'object' ? saved : {};
    const course = COURSES[courseId];
    base.introSeen = Boolean(source.introSeen);
    base.lastLine = course.lines[source.lastLine] ? source.lastLine : course.lineOrder[0];
    base.lastIsland = base.lastLine;
    ['progress', 'parts', 'moods', 'storySeen', 'recentQuestions', 'recentRush'].forEach(function (key) {
      base[key] = source[key] && typeof source[key] === 'object' ? source[key] : {};
    });
    base.stats = mergeStats(source.stats);
    const statsSource = source.lineStats || source.islandStats || {};
    course.lineOrder.forEach(function (lineId) {
      base.lineStats[lineId] = mergeStats(statsSource[lineId]);
      base.timeAttack[lineId] = Object.assign(emptyTimeAttack(), source.timeAttack && source.timeAttack[lineId] || {});
      base.lineIntros[lineId] = Boolean(source.lineIntros && source.lineIntros[lineId] || source.islandIntros && source.islandIntros[lineId]);
    });
    base.islandStats = base.lineStats;
    base.islandIntros = base.lineIntros;
    base.history = Array.isArray(source.history) ? source.history.slice(-240) : [];
    return base;
  }

  function migrateState(saved) {
    const base = createDefaultState();
    if (!saved || typeof saved !== 'object') return base;
    if (Number(saved.version || 0) > STATE_VERSION) {
      const error = new Error('Saved data is newer than this app');
      error.code = 'FUTURE_STATE_VERSION';
      throw error;
    }
    if (Number(saved.version || 0) >= STATE_VERSION && saved.courses) {
      base.introSeen = Boolean(saved.introSeen);
      base.courseChosen = Boolean(saved.courseChosen);
      base.workshopName = typeof saved.workshopName === 'string' ? saved.workshopName.slice(0, 8) : '';
      base.activeCourseId = COURSES[saved.activeCourseId] ? saved.activeCourseId : 'g1';
      base.settings = Object.assign({}, base.settings, saved.settings || {});
      COURSE_ORDER.forEach(function (courseId) { base.courses[courseId] = mergeCourseState(courseId, saved.courses[courseId]); });
      return base;
    }
    const legacy = G1.migrateState(saved);
    base.introSeen = Boolean(legacy.introSeen);
    base.courseChosen = false;
    base.workshopName = legacy.workshopName;
    base.settings = Object.assign({}, base.settings, legacy.settings || {});
    base.courses.g1 = mergeCourseState('g1', legacy);
    base.courses.g1.introSeen = true;
    base.courses.g1.history = base.courses.g1.history.map(function (item) { return Object.assign({}, item, { gradeId: 'g1', courseId: 'g1' }); });
    return base;
  }

  function courseFor(courseId) {
    if (!COURSES[courseId]) throw new Error('Unknown course: ' + courseId);
    return COURSES[courseId];
  }

  function courseState(rootState, courseId) {
    if (!COURSES[courseId]) throw new Error('Unknown course state: ' + courseId);
    const id = courseId;
    if (!rootState.courses[id]) rootState.courses[id] = createCourseState(id);
    return rootState.courses[id];
  }

  function lineFor(courseId, lineId) {
    const course = courseFor(courseId);
    if (!course.lines[lineId]) throw new Error('Unknown line: ' + courseId + '/' + lineId);
    return course.lines[lineId];
  }

  function clearedCount(state, courseId, lineId) {
    return lineFor(courseId, lineId).stages.filter(function (stage) {
      return Boolean(state.progress && state.progress[stage.id] && state.progress[stage.id].cleared);
    }).length;
  }

  function totalMarks(state, courseId, lineId) {
    const course = courseFor(courseId);
    const stages = lineId ? lineFor(courseId, lineId).stages : course.lineOrder.reduce(function (all, id) { return all.concat(course.lines[id].stages); }, []);
    return stages.reduce(function (sum, stage) { return sum + Number(state.progress && state.progress[stage.id] && state.progress[stage.id].stars || 0); }, 0);
  }

  function isUnlocked(state, courseId, index, lineId) {
    if (index <= 0) return true;
    const stages = lineFor(courseId, lineId).stages;
    return Boolean(state.progress && state.progress[stages[index - 1].id] && state.progress[stages[index - 1].id].cleared);
  }

  function nextStageIndex(state, courseId, lineId) {
    const stages = lineFor(courseId, lineId).stages;
    const index = stages.findIndex(function (stage, stageIndex) {
      return isUnlocked(state, courseId, stageIndex, lineId) && !(state.progress[stage.id] && state.progress[stage.id].cleared);
    });
    return index < 0 ? stages.length - 1 : index;
  }

  function isLineComplete(state, courseId, lineId) {
    return clearedCount(state, courseId, lineId) === lineFor(courseId, lineId).stages.length;
  }

  function g2Runtime(lineId) {
    if (['number', 'written', 'multiplication'].includes(lineId)) return global.HiramekiGrade2ArithmeticRuntime;
    return global.HiramekiGrade2WorldRuntime;
  }

  function makeStageQuestions(courseId, lineId, stageIndex, options) {
    courseFor(courseId);
    lineFor(courseId, lineId);
    if (courseId === 'g1') return G1.makeStageQuestions(lineId, stageIndex, options || {});
    if (courseId !== 'g2') throw new Error('No question runtime for course: ' + courseId);
    const runtime = g2Runtime(lineId);
    if (!runtime) throw new Error('Grade 2 runtime is not loaded for ' + lineId);
    return runtime.makeStageQuestions(lineId, stageIndex, options || {});
  }

  function makeTimeAttackQuestions(courseId, lineId, options) {
    courseFor(courseId);
    lineFor(courseId, lineId);
    if (courseId === 'g1') return G1.makeTimeAttackQuestions(lineId, options || {});
    if (courseId !== 'g2') throw new Error('No time-attack runtime for course: ' + courseId);
    const runtime = g2Runtime(lineId);
    if (!runtime) throw new Error('Grade 2 runtime is not loaded for ' + lineId);
    return runtime.makeTimeAttackQuestions(lineId, options || {});
  }

  function validate() {
    const errors = [];
    const stageIds = new Set();
    COURSE_ORDER.forEach(function (courseId) {
      const course = COURSES[courseId];
      const pathKeys = new Set();
      course.lineOrder.forEach(function (lineId) {
        const line = course.lines[lineId];
        if (!line || line.stages.length !== 11) errors.push(courseId + '/' + lineId + ': expected 11 stages');
        if (!line.accent || !line.pale || line.zones.length !== 3) errors.push(courseId + '/' + lineId + ': incomplete UI metadata');
        line.stages.forEach(function (stage) {
          if (stageIds.has(stage.id)) errors.push(courseId + '/' + lineId + ': duplicate stage id ' + stage.id);
          stageIds.add(stage.id);
        });
      });
      course.recommendedPath.forEach(function (item) {
        const line = course.lines[item[0]];
        const key = item[0] + ':' + item[1];
        if (!line || !line.stages[item[1]]) errors.push(courseId + ': invalid recommended step ' + key);
        if (pathKeys.has(key)) errors.push(courseId + ': duplicate recommended step ' + key);
        pathKeys.add(key);
      });
      const courseStageCount = course.lineOrder.reduce(function (sum, lineId) { return sum + course.lines[lineId].stages.length; }, 0);
      if (pathKeys.size !== courseStageCount) errors.push(courseId + ': recommended path does not cover all stages');
    });
    [global.HiramekiGrade2ArithmeticRuntime, global.HiramekiGrade2WorldRuntime].forEach(function (runtime, index) {
      if (!runtime || typeof runtime.validate !== 'function') {
        errors.push('g2 runtime ' + (index + 1) + ' is not loaded');
        return;
      }
      const result = runtime.validate();
      if (!result.ok) errors.push.apply(errors, result.errors.map(function (error) { return 'g2 runtime: ' + error; }));
    });
    return { ok: errors.length === 0, errors: errors };
  }

  global.HiramekiCourses = {
    STATE_VERSION: STATE_VERSION,
    STORE_KEY: STORE_KEY,
    COURSES: COURSES,
    COURSE_ORDER: COURSE_ORDER,
    createDefaultState: createDefaultState,
    createCourseState: createCourseState,
    migrateState: migrateState,
    courseFor: courseFor,
    courseState: courseState,
    lineFor: lineFor,
    clearedCount: clearedCount,
    totalMarks: totalMarks,
    isUnlocked: isUnlocked,
    nextStageIndex: nextStageIndex,
    isLineComplete: isLineComplete,
    makeStageQuestions: makeStageQuestions,
    makeTimeAttackQuestions: makeTimeAttackQuestions,
    formatTimeMs: G1.formatTimeMs,
    validate: validate
  };
}(typeof globalThis !== 'undefined' ? globalThis : window));
