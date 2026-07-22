(function (global) {
  'use strict';

  const core = global.HiramekiCore;
  if (!core) throw new Error('HiramekiCore is required before grade1-runtime.js');

  const legacyBuildQuestion = core.buildQuestion;
  const ARC = Object.freeze(['intro', 'intro', 'develop', 'develop', 'story', 'twist', 'check', 'capstone']);
  const ARC_TARGET = Object.freeze([0.22, 0.34, 0.48, 0.6, 0.64, 0.72, 0.8, 0.9]);
  const ALL_KINDS = Object.freeze(['choice', 'route', 'sort', 'tap', 'remove', 'select', 'order', 'slider', 'clock', 'input', 'numberline', 'grouping']);

  function contract(kind, options) {
    return Object.freeze(Object.assign({
      primaryKind: kind,
      allowedKinds: Object.freeze([kind]),
      paired: false,
      assessment: false,
      sourceRound: null,
      sourceStage: null,
      roundPattern: null
    }, options || {}));
  }

  function paired(kinds, options) {
    return contract(kinds[0], Object.assign({
      allowedKinds: Object.freeze(kinds.slice()),
      paired: true
    }, options || {}));
  }

  function assessment(options) {
    return contract(null, Object.assign({
      allowedKinds: ALL_KINDS,
      assessment: true
    }, options || {}));
  }

  const STAGE_CONTRACTS = Object.freeze({
    number: Object.freeze([
      contract('choice', { sourceRound: 0 }),
      contract('choice'),
      contract('choice', { sourceRound: 1 }),
      contract('input', { sourceRound: 3 }),
      assessment({ reviewPlan: [0, 1, 2, 3, 0, 1, 2, 3] }),
      contract('tap', { sourceRound: 1 }),
      contract('order', { sourceRound: 0 }),
      contract('choice'),
      contract('choice', { sourceRound: 0 }),
      contract('choice', { sourceRound: 0 }),
      assessment({ reviewPlan: [0, 1, 2, 3, 5, 6, 8, 9] })
    ]),
    addition: Object.freeze([
      contract('choice', { sourceStage: 2, sourceRound: 0 }),
      contract('tap', { sourceRound: 1 }),
      contract('choice', { sourceRound: 0 }),
      contract('numberline', { sourceRound: 1 }),
      assessment({ reviewPlan: [0, 1, 2, 3, 0, 1, 2, 3] }),
      contract('choice', { sourceRound: 1 }),
      contract('choice', { sourceRound: 0 }),
      contract('numberline', { sourceRound: 1 }),
      contract('route'),
      contract('tap', { sourceRound: 0 }),
      assessment({ reviewPlan: [1, 2, 3, 5, 6, 7, 8, 9] })
    ]),
    subtraction: Object.freeze([
      contract('tap', { sourceRound: 1 }),
      contract('remove', { sourceRound: 0 }),
      contract('choice'),
      contract('numberline', { sourceRound: 1 }),
      assessment({ reviewPlan: [0, 1, 2, 3, 0, 1, 2, 3] }),
      contract('remove', { sourceRound: 1 }),
      contract('numberline'),
      contract('choice'),
      contract('numberline'),
      contract('remove', { custom: 'placeValueRemove' }),
      assessment({ reviewPlan: [0, 1, 2, 3, 5, 6, 7, 8] })
    ]),
    measure: Object.freeze([
      contract('choice'),
      contract('choice'),
      contract('tap', { sourceRound: 0 }),
      contract('choice'),
      assessment({ reviewPlan: [0, 1, 2, 3, 0, 1, 2, 3] }),
      contract('choice'),
      contract('choice'),
      paired(['choice', 'clock']),
      paired(['choice', 'clock']),
      paired(['choice', 'clock']),
      assessment({ reviewPlan: [0, 1, 2, 3, 5, 6, 8, 9] })
    ]),
    shape: Object.freeze([
      contract('choice'),
      contract('choice'),
      contract('sort'),
      contract('choice'),
      assessment({ reviewPlan: [0, 1, 2, 3, 0, 1, 2, 3] }),
      contract('select'),
      contract('choice'),
      contract('tap'),
      contract('select'),
      contract('select'),
      assessment({ reviewPlan: [0, 1, 2, 3, 5, 6, 7, 9] })
    ]),
    solve: Object.freeze([
      contract('sort', { custom: 'mathClassify' }),
      contract('choice'),
      contract('tap'),
      contract('choice'),
      assessment({ reviewPlan: [0, 1, 2, 3, 0, 1, 2, 3] }),
      contract('choice'),
      contract('choice'),
      contract('input'),
      contract('choice'),
      contract('grouping', { custom: 'equalGroups' }),
      assessment({ reviewPlan: [0, 1, 2, 3, 5, 6, 8, 9] })
    ])
  });

  Object.keys(STAGE_CONTRACTS).forEach(function (lineId) {
    core.LINES[lineId].stages.forEach(function (stage, stageIndex) {
      stage.questionContract = Object.freeze(Object.assign({}, STAGE_CONTRACTS[lineId][stageIndex], {
        action: stage.action,
        arc: ARC
      }));
    });
  });

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function isNumeric(value) {
    return value !== '' && Number.isFinite(Number(value));
  }

  function optionValue(option) {
    return core.optionValue(option);
  }

  function uniqueOptions(values) {
    const seen = new Set();
    return values.filter(function (value) {
      const key = String(optionValue(value));
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function numericMisconceptions(question, rng) {
    const correct = Number(question.correct);
    const min = Number.isFinite(Number(question.min)) ? Number(question.min) : Math.max(0, correct - 10);
    const max = Number.isFinite(Number(question.max)) ? Number(question.max) : Math.max(20, correct + 10);
    const math = question.math || {};
    const candidates = [correct];
    if (math.kind === 'add') {
      candidates.push(math.a, math.b, Math.abs(math.a - math.b), correct - 1, correct + 1);
    } else if (math.kind === 'subtract') {
      candidates.push(Number(math.a) + Number(math.b), math.b, math.a, correct - 1, correct + 1);
    } else if (math.kind === 'bond') {
      candidates.push(math.known, math.target, correct - 1, correct + 1);
    } else if (math.kind === 'sequence') {
      const first = Number(math.values && math.values[0] || 0);
      const second = Number(math.values && math.values[1] || 0);
      const firstResult = math.ops && math.ops[0] === '-' ? first - second : first + second;
      candidates.push(firstResult, correct - 1, correct + 1, first);
    } else if (math.kind === 'groups') {
      candidates.push(math.groups, math.perGroup, correct - 1, correct + 1, math.total);
    } else {
      candidates.push(correct - 1, correct + 1, correct - 2, correct + 2);
      if (correct >= 10) candidates.push(Number(String(correct).split('').reverse().join('')));
    }
    const bounded = uniqueOptions(candidates.map(function (value) {
      return clamp(Number(value), min, max);
    }));
    const preferred = bounded.slice(0, 4);
    for (let distance = 1; preferred.length < 4 && distance <= Math.max(20, max - min); distance += 1) {
      [correct - distance, correct + distance].forEach(function (value) {
        const boundedValue = clamp(value, min, max);
        if (!preferred.some(function (item) { return item === boundedValue; })) preferred.push(boundedValue);
      });
    }
    return core.shuffle(preferred.slice(0, 4), rng);
  }

  function expressionOptions(question, rng) {
    const math = question.math || {};
    const a = Number(math.a);
    const b = Number(math.b);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return question.options || [];
    const symbol = math.kind === 'subtract' ? '−' : '＋';
    const opposite = symbol === '＋' ? '−' : '＋';
    const correct = a + symbol + b;
    const nearB = Math.max(0, b - 1);
    const candidates = [
      correct,
      a + opposite + b,
      a + symbol + (b + 1),
      a + symbol + nearB,
      Math.max(0, a - 1) + symbol + b
    ];
    return core.shuffle(uniqueOptions(candidates).slice(0, 4), rng);
  }

  function normalizeChoiceOptions(question, rng) {
    const values = (question.options || []).map(optionValue);
    const expression = typeof question.correct === 'string' && /[＋−]/.test(question.correct);
    if (expression) {
      question.options = expressionOptions(question, rng);
      return;
    }
    if (isNumeric(question.correct)) {
      question.options = numericMisconceptions(question, rng);
      return;
    }
    if (!values.some(function (value) { return String(value) === String(question.correct); })) {
      question.options = [question.correct].concat(question.options || []);
    }
    question.options = uniqueOptions(question.options || []);
  }

  function startForNumberLine(question) {
    const math = question.math || {};
    if (math.kind === 'sequence' && math.values) return Number(math.values[0]);
    if (math.a != null) return Number(math.a);
    if (question.visual && question.visual.start != null) return Number(question.visual.start);
    return Number(question.min || 0);
  }

  function coerceKind(question, kind, rng) {
    if (!kind || question.kind === kind) return question;
    question.kind = kind;
    question.selected = [];
    question.orderSelected = [];
    if (kind === 'choice' || kind === 'route' || kind === 'sort') {
      normalizeChoiceOptions(question, rng);
      question.input = '';
    } else if (kind === 'input') {
      question.options = [];
      question.input = '';
    } else if (kind === 'numberline') {
      question.options = [];
      question.input = startForNumberLine(question);
      question.min = Number.isFinite(Number(question.min)) ? Number(question.min) : 0;
      question.max = Number.isFinite(Number(question.max)) ? Number(question.max) : 20;
      question.step = 1;
    } else if (kind === 'tap' || kind === 'remove' || kind === 'select') {
      question.options = [];
      question.input = 0;
    }
    return question;
  }

  function instructionFor(question) {
    const visual = question.visual || {};
    if (question.kind === 'choice') {
      if (visual.type === 'measure-method') return 'やりかたを ひとつ えらんで「けってい」';
      if (question.optionLayout === 'horizontal-axis') return 'ひだり・おなじ・みぎから えらんで「けってい」';
      if (question.optionLayout === 'vertical-axis') return 'うえ・まんなか・したから えらんで「けってい」';
      if (question.optionLayout === 'depth-axis') return 'まえ・うしろから えらんで「けってい」';
      if (question.optionLayout === 'relation') return '＜・＝・＞から えらんで「けってい」';
      return 'こたえを ひとつ えらんで「けってい」';
    }
    if (question.kind === 'route') return 'たどりつく こたえを えらんで「けってい」';
    if (question.kind === 'sort') return 'なかまを ひとつ えらんで「けってい」';
    if (question.kind === 'tap') {
      if (visual.type === 'unit-length-builder') return 'ぼうの はしと あう ブロックの みぎはしを タップして「けってい」';
      if (visual.type === 'graph-build') return 'ひつような しるしを タップして「けってい」';
      if (visual.type === 'sticks') return 'ひつような ぼうを タップして「けってい」';
      if (visual.type === 'bond' || visual.type === 'bond-builder') return 'たりないぶんの まるを タップして「けってい」';
      if (visual.type === 'make-ten' || visual.type === 'make-ten-builder') return '10に うごかす まるを タップして「けってい」';
      return 'ひつようなぶんを タップして「けってい」';
    }
    if (question.kind === 'remove') return 'とる ものを タップして「けってい」';
    if (question.kind === 'select') return 'こたえの ばしょを タップして「けってい」';
    if (question.kind === 'order') return 'じゅんばんに タップして「けってい」';
    if (question.kind === 'slider') return '−と＋で こたえを つくって「けってい」';
    if (question.kind === 'numberline') return 'かずの せんを ひとつずつ うごかして「けってい」';
    if (question.kind === 'clock') return 'みじかい はりと ながい はりを うごかして「けってい」';
    if (question.kind === 'grouping') return '−と＋で わけかたを ためして「けってい」';
    return 'すうじを いれて「けってい」';
  }

  function secondHint(question) {
    const math = question.math || {};
    if (math.kind === 'add') return math.a + 'から ' + math.b + 'こぶん すすむと どうなるかな。';
    if (math.kind === 'subtract') return math.a + 'から ' + math.b + 'こぶん もどると どうなるかな。';
    if (math.kind === 'bond') return math.known + 'から ' + math.target + 'まで、ゆびで 1つずつ かぞえよう。';
    if (math.kind === 'groups') return 'まるを 1こずつ、どの ばしょにも おなじように くばろう。';
    if (question.visual && question.visual.type === 'clock-read') return 'ながい はりで ふん、みじかい はりで じを たしかめよう。';
    if (question.visual && /length|capacity|area/.test(question.visual.type || '')) return '二つの はじまりや、つかった おなじ大きさの ものを たしかめよう。';
    return 'みほんと こたえを、ひとつずつ ゆびで たしかめよう。';
  }

  function shortStoryLead(lineId) {
    return {
      number: 'トトが かずを たしかめています。',
      addition: 'トトと モクモの まるを あわせます。',
      subtraction: 'モクモが まるを つかいました。',
      measure: 'トトが ざいりょうを しらべています。',
      shape: 'モクモが みほんの かたちを つくります。',
      solve: 'トトが しらべた ことを まとめます。'
    }[lineId];
  }

  function fixKnownQuestionProblems(question, lineId, stageIndex, variation, rng) {
    if (lineId === 'number' && [0, 2, 3].includes(stageIndex) && question.visual && ['objects', 'five-frame'].includes(question.visual.type)) {
      question.visual.layoutVariant = variation % 6;
      if (Math.floor(variation / 6) % 2 === 1) question.prompt = 'ならんだ まるを かぞえよう。いくつ？';
    }
    if (((lineId === 'number' && stageIndex === 8) || (lineId === 'addition' && stageIndex === 5)) && question.visual && question.visual.type === 'ten-bundle') {
      question.visual.layoutVariant = variation % 3;
      if (Math.floor(variation / 3) % 2 === 1) question.prompt = '10と ばらを あわせると、いくつ？';
    }
    if (lineId === 'measure' && stageIndex === 2 && question.visual) {
      question.visual.layoutVariant = variation % 3;
      if (Math.floor(variation / 3) % 2 === 1) question.prompt = 'ぼうの はしまで、ブロック なんこぶん？';
    }
    if (lineId === 'number' && stageIndex === 6) {
      const orderPrompts = [
        'すうじを ちいさい じゅんに ならべよう。',
        'かずの せんの ひだりから ならべよう。',
        'ひとつずつ おおきくなるように ならべよう。',
        'いちばん ちいさい かずから ならべよう。'
      ];
      question.prompt = orderPrompts[variation % orderPrompts.length];
      question.visual.layoutVariant = variation % orderPrompts.length;
    }
    if (lineId === 'addition' && stageIndex === 0) {
      question.prompt = 'たしざんの じゅんび。' + question.prompt;
      question.templateId = 'addition.prepare.combine';
      question.math = question.math || { kind: 'add', a: question.visual.counts[0], b: question.visual.counts[1], result: question.correct };
    }
    if (lineId === 'addition' && stageIndex === 1) question.prompt = 'たしざんの かずわけ。' + question.prompt;
    if (lineId === 'addition' && stageIndex === 5) question.prompt = '20までの たしざんの じゅんび。' + question.prompt;
    if (lineId === 'subtraction' && stageIndex === 0) question.prompt = 'ひきざんの かずわけ。' + question.prompt;
    if ((lineId === 'number' && stageIndex === 5) || (lineId === 'addition' && stageIndex === 1) || (lineId === 'subtraction' && stageIndex === 0)) {
      if (question.visual && question.visual.type === 'bond') question.visual.type = 'bond-builder';
    }
    if (lineId === 'addition' && stageIndex === 9 && question.visual && question.visual.type === 'make-ten') {
      question.visual.type = 'make-ten-builder';
    }
    if (lineId === 'shape' && stageIndex === 7) {
      const stickPrompts = [
        question.visual.target + 'を つくるには、ぼうが なんぼん いる？',
        'みほんの ' + question.visual.target + '。ひつような ぼうを えらぼう。',
        question.visual.target + 'の へんを みよう。ぼうは なんぼん？',
        'ぼうで ' + question.visual.target + 'を つくろう。なんぼん ひつよう？'
      ];
      question.prompt = stickPrompts[variation % stickPrompts.length];
      question.visual.materialVariant = variation % stickPrompts.length;
      question.templateId = 'shape.sticks.build';
    }
    if (lineId === 'solve' && (stageIndex === 6 || stageIndex === 8)) {
      const expression = question.math && question.math.a != null
        ? question.math.a + (question.math.kind === 'subtract' ? '−' : '＋') + question.math.b
        : question.correct;
      question.correct = expression;
      question.options = expressionOptions(question, rng);
      question.kind = 'choice';
      question.templateId = stageIndex === 6 ? 'solve.model.expression' : 'solve.match.expression';
    }
    return question;
  }

  const CLASSIFY_CASES = Object.freeze([
    { item: 'ボール', icon: '●', correct: 'まるい かたち' },
    { item: 'ビーだま', icon: '●', correct: 'まるい かたち' },
    { item: 'おさら', icon: '●', correct: 'まるい かたち' },
    { item: 'タイヤ', icon: '●', correct: 'まるい かたち' },
    { item: 'さいころ', icon: '▦', correct: 'しかくい かたち' },
    { item: 'はこ', icon: '▣', correct: 'しかくい かたち' },
    { item: 'けしゴム', icon: '▣', correct: 'しかくい かたち' },
    { item: 'えほん', icon: '▣', correct: 'しかくい かたち' },
    { item: 'えんぴつ', icon: '┃', correct: 'ながい かたち' },
    { item: 'ストロー', icon: '┃', correct: 'ながい かたち' },
    { item: 'ぼう', icon: '┃', correct: 'ながい かたち' },
    { item: 'リボン', icon: '┃', correct: 'ながい かたち' }
  ]);

  function mathClassifyQuestion(round, variation, rng) {
    const item = core.pick(CLASSIFY_CASES, rng);
    const promptVariants = [
      item.item + 'の かたちは、どの なかま？',
      item.item + 'を かたちで わけると、どこに はいる？',
      '「' + item.item + '」と おなじ とくちょうの なかまは？',
      item.item + 'の みためを よく みよう。どの なかま？'
    ];
    return {
      canonicalSkillId: core.SOLVE_STAGES[0].canonicalSkillId,
      kind: 'sort',
      prompt: promptVariants[variation % promptVariants.length],
      correct: item.correct,
      options: ['まるい かたち', 'しかくい かたち', 'ながい かたち'],
      visual: { type: 'sort', item: item.icon, itemLabel: item.item, bins: ['まるい かたち', 'しかくい かたち', 'ながい かたち'] },
      hint: 'まるい？ かどが ある？ ながく のびている？を みよう。',
      explain: item.item + 'は「' + item.correct + '」の なかまだね。',
      templateId: 'solve.classify.shape.' + (variation % promptVariants.length)
    };
  }

  function equalGroupsQuestion(round, rng) {
    const groups = core.rand(2, 5, rng);
    const perGroup = core.rand(2, Math.min(5, Math.floor(20 / groups)), rng);
    const total = groups * perGroup;
    const share = round % 2 === 0;
    return {
      canonicalSkillId: core.SOLVE_STAGES[9].canonicalSkillId,
      kind: 'grouping',
      prompt: share
        ? total + 'この まるを ' + groups + 'にんで おなじ かずずつ わけよう。ひとりぶんは？'
        : total + 'この まるを ' + perGroup + 'こずつ まとめよう。グループは いくつ？',
      correct: share ? perGroup : groups,
      input: 1,
      min: 1,
      max: share ? Math.floor(total / groups) + 2 : Math.floor(total / perGroup) + 2,
      visual: { type: 'equal-groups-builder', total, groups, perGroup, mode: share ? 'share' : 'group' },
      hint: share ? 'どの 人にも、まるを 1こずつ じゅんばんに くばろう。' : perGroup + 'こを ひとまとまりにして、なんこ できるか かぞえよう。',
      explain: share ? 'ひとり ' + perGroup + 'こずつ。' + groups + 'にんぶんで ' + total + 'こだよ。' : perGroup + 'こずつで ' + groups + 'グループ。ぜんぶで ' + total + 'こだよ。',
      math: { kind: 'groups', total, groups, perGroup, result: share ? perGroup : groups },
      templateId: share ? 'solve.groups.share' : 'solve.groups.make'
    };
  }

  function placeValueRemoveQuestion(round, rng) {
    const tensMode = round % 2 === 0;
    if (tensMode) {
      const tens = core.rand(4, 10, rng);
      const remove = core.rand(1, Math.max(1, tens - 1), rng);
      const a = tens * 10;
      const b = remove * 10;
      return {
        canonicalSkillId: core.SUBTRACTION_STAGES[9].canonicalSkillId,
        kind: 'remove',
        prompt: a + 'から、10の まとまりを ' + remove + 'こ とろう。',
        correct: remove,
        input: 0,
        visual: { type: 'place-value-remove-builder', number: a, total: tens, unit: 'ten' },
        hint: '10の まとまりだけを、ひだりから ひとつずつ とろう。',
        explain: a + '−' + b + '＝' + (a - b) + '。',
        math: { kind: 'subtract', a, b, result: a - b, mode: 'tens' },
        answerDerived: false,
        templateId: 'subtraction.place.remove-tens'
      };
    }
    const tens = core.rand(2, 9, rng);
    const ones = core.rand(3, 9, rng);
    const remove = core.rand(1, ones - 1, rng);
    const a = tens * 10 + ones;
    return {
      canonicalSkillId: core.SUBTRACTION_STAGES[9].canonicalSkillId,
      kind: 'remove',
      prompt: a + 'から、ばらを ' + remove + 'こ とろう。',
      correct: remove,
      input: 0,
      visual: { type: 'place-value-remove-builder', number: a, total: ones, unit: 'one' },
      hint: '10の まとまりは そのまま。ばらだけを とろう。',
      explain: a + '−' + remove + '＝' + (a - remove) + '。',
      math: { kind: 'subtract', a, b: remove, result: a - remove, mode: 'ones' },
      answerDerived: false,
      templateId: 'subtraction.place.remove-ones'
    };
  }

  function mappedRound(stageContract, arcRound) {
    if (stageContract.roundPattern) return stageContract.roundPattern[arcRound % stageContract.roundPattern.length];
    if (stageContract.sourceRound != null) return stageContract.sourceRound;
    return arcRound;
  }

  function rawInstructionalQuestion(lineId, stageIndex, arcRound, variation, rng) {
    const stageContract = STAGE_CONTRACTS[lineId][stageIndex];
    if (stageContract.custom === 'mathClassify') return mathClassifyQuestion(arcRound, variation, rng);
    if (stageContract.custom === 'equalGroups') return equalGroupsQuestion(arcRound, rng);
    if (stageContract.custom === 'placeValueRemove') return placeValueRemoveQuestion(arcRound, rng);
    const sourceStage = stageContract.sourceStage == null ? stageIndex : stageContract.sourceStage;
    const sourceRound = mappedRound(stageContract, arcRound);
    return legacyBuildQuestion(lineId, sourceStage, sourceRound, { rng });
  }

  function rawQuestion(lineId, stageIndex, arcRound, variation, rng) {
    const stageContract = STAGE_CONTRACTS[lineId][stageIndex];
    if (!stageContract.assessment) return rawInstructionalQuestion(lineId, stageIndex, arcRound, variation, rng);
    const plan = stageContract.reviewPlan;
    const sourceStage = plan[arcRound % plan.length];
    return rawInstructionalQuestion(lineId, sourceStage, arcRound, variation, rng);
  }

  function difficultyScore(question) {
    const math = question.math || {};
    if (math.kind === 'add') {
      const addScale = Number(math.result) <= 10 ? 10 : 20;
      return clamp(Number(math.result) / addScale + (math.bridge ? 0.08 : 0), 0, 1);
    }
    if (math.kind === 'subtract') {
      const a = Number(math.a);
      const subtractScale = a > 20 ? 100 : 20;
      return clamp(a / subtractScale + (math.mode === 'borrow' ? 0.12 : 0), 0, 1);
    }
    if (math.kind === 'bond') return clamp(Number(math.target) / 10, 0, 1);
    if (math.kind === 'sequence') return clamp(Number(math.result) / (Number(question.max) || 20), 0, 1);
    if (math.kind === 'groups') return clamp(Number(math.total) / 20, 0, 1);
    if (isNumeric(question.correct) && Number.isFinite(Number(question.min)) && Number.isFinite(Number(question.max)) && Number(question.max) > Number(question.min)) {
      return clamp((Number(question.correct) - Number(question.min)) / (Number(question.max) - Number(question.min)), 0, 1);
    }
    const visual = question.visual || {};
    if (Number.isFinite(Number(visual.left)) && Number.isFinite(Number(visual.right))) return clamp(Math.max(Number(visual.left), Number(visual.right)) / 12, 0, 1);
    return null;
  }

  function normalizeQuestion(raw, lineId, stageIndex, arcRound, variation, rng) {
    const line = core.LINES[lineId];
    const stage = line.stages[stageIndex];
    const stageContract = STAGE_CONTRACTS[lineId][stageIndex];
    const question = Object.assign({
      kind: 'choice', prompt: '', instruction: '', correct: 0, options: [], hint: '', explain: '',
      visual: { type: 'machine' }, story: false, checkpoint: false, speedSafe: true,
      templateId: '', interactionFamily: '', optionPolicy: 'shuffle', optionLayout: 'neutral',
      input: '', selected: [], orderSelected: [], attempts: 0, feedback: null, showHint: false
    }, raw || {});
    const sourceStageIndex = Number.isFinite(Number(question.stageIndex)) ? Number(question.stageIndex) : stageIndex;
    question.sourceCanonicalSkillId = question.canonicalSkillId || stage.canonicalSkillId;
    question.canonicalSkillId = stage.canonicalSkillId;
    question.lineId = lineId;
    question.stageId = stage.id;
    question.stageIndex = stageIndex;
    question.stageAction = stage.action;
    question.arcRole = ARC[arcRound] || 'develop';
    question.arcIndex = arcRound;
    question.story = question.arcRole === 'story';
    question.checkpoint = stageContract.assessment || question.arcRole === 'check' || question.arcRole === 'capstone';
    question.assessmentFor = stageContract.assessment ? stage.canonicalSkillId : question.assessmentFor;
    if (!stageContract.assessment && (!stageContract.paired || !stageContract.allowedKinds.includes(question.kind))) {
      coerceKind(question, stageContract.primaryKind, rng);
    }
    fixKnownQuestionProblems(question, lineId, stageContract.assessment ? sourceStageIndex : stageIndex, variation, rng);
    if (question.kind === 'choice' || question.kind === 'route' || question.kind === 'sort') normalizeChoiceOptions(question, rng);
    question.instruction = instructionFor(question);
    question.hint = question.hint && question.hint !== 'よく見て、もういちど ためそう。' ? question.hint : secondHint(question);
    question.hints = uniqueOptions([question.hint, secondHint(question)]);
    if (question.hints.length < 2) question.hints.push('わかっている ところから、ひとつずつ たしかめよう。');
    const learningPrompt = question.prompt;
    const learningTemplate = question.templateId || lineId + '.' + stage.id;
    if (question.story && !String(question.prompt).startsWith(shortStoryLead(lineId))) {
      question.prompt = shortStoryLead(lineId) + ' ' + question.prompt;
    }
    question.templateId = learningTemplate + '.arc-' + question.arcRole;
    question.interactionFamily = lineId + '.' + stage.id + ':' + question.kind;
    question.difficulty = difficultyScore(question);
    question.difficultyBand = question.arcRole;
    question.answerDerived = question.answerDerived !== false;
    question.selected = [];
    question.orderSelected = [];
    question.attempts = 0;
    question.feedback = null;
    question.showHint = false;
    question.learningSignature = core.questionContentSignature(Object.assign({}, question, {
      canonicalSkillId: question.sourceCanonicalSkillId,
      prompt: learningPrompt,
      story: false,
      checkpoint: false,
      templateId: learningTemplate
    }));
    question.signature = core.questionSignature(question);
    question.contentSignature = core.questionContentSignature(question);
    return question;
  }

  function candidateDistance(question, arcRound) {
    if (question.difficulty == null) return 0;
    return Math.abs(question.difficulty - ARC_TARGET[arcRound]);
  }

  function invalidQuestion(question) {
    const math = question.math || {};
    if (math.kind === 'subtract' && question.sourceCanonicalSkillId !== 'g1.sub.zero_same') {
      if (Number(math.b) === 0 || Number(math.result) === 0) return true;
    }
    if (math.kind === 'bond' && question.sourceCanonicalSkillId !== 'g1.number.zero_bonds') {
      if (Number(math.known) === 0 || Number(question.correct) === 0) return true;
    }
    if (question.kind === 'choice' || question.kind === 'route' || question.kind === 'sort') {
      const values = uniqueOptions(question.options || []).map(optionValue).map(String);
      if (!values.includes(String(question.correct))) return true;
      if (isNumeric(question.correct) && values.length < 4) return true;
    }
    return false;
  }

  function makeStageQuestions(lineId, stageIndex, options) {
    const config = options || {};
    const line = core.LINES[lineId];
    if (!line) throw new Error('Unknown Grade 1 line: ' + lineId);
    const safeIndex = clamp(Number(stageIndex) || 0, 0, line.stages.length - 1);
    const seed = config.seed == null ? Date.now() : config.seed;
    const rng = core.seededRng(seed);
    const count = Number(config.count || core.STAGE_ROUNDS);
    const excluded = new Set(config.exclude || []);
    const usedSignatures = new Set();
    const usedContent = new Set();
    const usedLearning = new Set();
    const questions = [];
    for (let round = 0; round < count; round += 1) {
      let best = null;
      let bestDistance = Infinity;
      for (let variation = 0; variation < 20; variation += 1) {
        const raw = rawQuestion(lineId, safeIndex, round % ARC.length, variation, rng);
        const candidate = normalizeQuestion(raw, lineId, safeIndex, round % ARC.length, variation, rng);
        if (invalidQuestion(candidate)) continue;
        const blocked = excluded.has(candidate.signature) || excluded.has(candidate.contentSignature) || excluded.has(candidate.learningSignature) || usedSignatures.has(candidate.signature) || usedContent.has(candidate.contentSignature) || usedLearning.has(candidate.learningSignature);
        if (blocked) continue;
        const distance = candidateDistance(candidate, round % ARC.length);
        if (!best || distance < bestDistance) {
          best = candidate;
          bestDistance = distance;
        }
        if (distance <= 0.08) break;
      }
      if (!best) {
        best = normalizeQuestion(rawQuestion(lineId, safeIndex, round % ARC.length, 99 + round, rng), lineId, safeIndex, round % ARC.length, 99 + round, rng);
      }
      usedSignatures.add(best.signature);
      usedContent.add(best.contentSignature);
      usedLearning.add(best.learningSignature);
      questions.push(best);
    }
    return { seed, questions };
  }

  const RUSH_STAGE_POOLS = Object.freeze({
    number: [0, 1, 2, 3, 5, 6, 7, 8, 9, 5, 8, 9],
    addition: [0, 1, 2, 3, 5, 6, 7, 8, 9, 6, 8, 9],
    subtraction: [0, 1, 2, 3, 5, 6, 7, 8, 9, 5, 7, 9],
    measure: [0, 1, 2, 3, 5, 6, 7, 8, 9, 6, 8, 9],
    shape: [0, 1, 2, 3, 5, 6, 7, 8, 9, 5, 7, 9],
    solve: [0, 1, 2, 3, 5, 6, 7, 8, 9, 3, 6, 9]
  });

  function makeTimeAttackQuestions(lineId, options) {
    const config = options || {};
    const seed = config.seed == null ? Date.now() : config.seed;
    const rng = core.seededRng(seed);
    const excluded = new Set(config.exclude || []);
    const pool = core.spreadAdjacent(RUSH_STAGE_POOLS[lineId] || RUSH_STAGE_POOLS.number, rng);
    const used = new Set();
    const questions = [];
    pool.forEach(function (stageIndex, round) {
      let question = null;
      for (let variation = 0; variation < 24; variation += 1) {
        const raw = rawInstructionalQuestion(lineId, stageIndex, 5 + round % 3, variation, rng);
        const candidate = normalizeQuestion(raw, lineId, stageIndex, 5 + round % 3, variation, rng);
        if (invalidQuestion(candidate)) continue;
        if (excluded.has(candidate.signature) || excluded.has(candidate.contentSignature) || excluded.has(candidate.learningSignature) || used.has(candidate.signature) || used.has(candidate.contentSignature) || used.has(candidate.learningSignature)) continue;
        question = candidate;
        break;
      }
      if (!question) question = normalizeQuestion(rawInstructionalQuestion(lineId, stageIndex, 7, 100 + round, rng), lineId, stageIndex, 7, 100 + round, rng);
      question.rush = true;
      question.story = false;
      question.checkpoint = false;
      question.showHint = false;
      question.signature = core.questionSignature(question);
      question.contentSignature = core.questionContentSignature(question);
      used.add(question.signature);
      used.add(question.contentSignature);
      used.add(question.learningSignature);
      questions.push(question);
    });
    return { seed, questions: questions.slice(0, core.TIME_ATTACK_ROUNDS) };
  }

  function validate() {
    const errors = [];
    Object.keys(STAGE_CONTRACTS).forEach(function (lineId) {
      const line = core.LINES[lineId];
      if (!line || STAGE_CONTRACTS[lineId].length !== line.stages.length) errors.push(lineId + ': stage contract count mismatch');
      (line && line.stages || []).forEach(function (stage, stageIndex) {
        const stageContract = STAGE_CONTRACTS[lineId][stageIndex];
        if (!stageContract || !stage.questionContract) errors.push(lineId + '/' + stage.id + ': missing question contract');
      });
    });
    return { ok: errors.length === 0, errors };
  }

  core.G1_ARC = ARC;
  core.G1_STAGE_CONTRACTS = STAGE_CONTRACTS;
  core.makeStageQuestions = makeStageQuestions;
  core.makeTimeAttackQuestions = makeTimeAttackQuestions;
  core.grade1RuntimeValidate = validate;
  global.HiramekiGrade1Runtime = Object.freeze({ ARC, STAGE_CONTRACTS, makeStageQuestions, makeTimeAttackQuestions, validate });
}(typeof globalThis !== 'undefined' ? globalThis : window));
