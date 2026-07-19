(function (global) {
  'use strict';

  const VERSION = 1;
  const GRADE_ID = 'g2';
  const STAGE_ROUNDS = 8;
  const TIME_ATTACK_ROUNDS = 12;
  const KNOWN_KINDS = Object.freeze(['choice', 'route', 'sort', 'tap', 'remove', 'select', 'order', 'slider', 'clock', 'input']);
  const LINE_IDS = Object.freeze(['number', 'written', 'multiplication']);

  const FALLBACK_STAGES = Object.freeze({
    number: Object.freeze([
      ['g2_num_group_count', 'g2.number.group_count'],
      ['g2_num_to1000', 'g2.number.to1000'],
      ['g2_num_place_value', 'g2.number.place_value_3digit'],
      ['g2_num_relative_units', 'g2.number.relative_units'],
      ['g2_num_1000_check', 'g2.number.to1000.review'],
      ['g2_num_compare', 'g2.number.compare_order'],
      ['g2_num_number_line', 'g2.number.number_line_sequence'],
      ['g2_num_to10000', 'g2.number.to10000'],
      ['g2_num_10000_relations', 'g2.number.place_value_4digit'],
      ['g2_num_unit_fractions', 'g2.number.unit_fractions'],
      ['g2_num_core', 'g2.number.review']
    ]),
    written: Object.freeze([
      ['g2_calc_add_no_carry', 'g2.calculation.add_2digit_no_regroup'],
      ['g2_calc_add_regroup', 'g2.calculation.add_2digit_regroup'],
      ['g2_calc_sub_no_borrow', 'g2.calculation.sub_2digit_no_regroup'],
      ['g2_calc_sub_regroup', 'g2.calculation.sub_2digit_regroup'],
      ['g2_calc_basic_check', 'g2.calculation.written_2digit.review'],
      ['g2_calc_sum_to_3digit', 'g2.calculation.add_sum_3digit'],
      ['g2_calc_sub_from_3digit', 'g2.calculation.sub_from_3digit'],
      ['g2_calc_simple_3digit', 'g2.calculation.simple_3digit'],
      ['g2_calc_properties', 'g2.calculation.properties_strategies'],
      ['g2_calc_inverse_check', 'g2.calculation.inverse_estimate_check'],
      ['g2_calc_core', 'g2.calculation.review']
    ]),
    multiplication: Object.freeze([
      ['g2_mul_equal_groups', 'g2.multiplication.equal_groups'],
      ['g2_mul_scene_expression', 'g2.multiplication.scene_expression'],
      ['g2_mul_array_repeated_add', 'g2.multiplication.array_repeated_add'],
      ['g2_mul_tables_2_5', 'g2.multiplication.tables_2_5'],
      ['g2_mul_meaning_check', 'g2.multiplication.meaning.review'],
      ['g2_mul_tables_3_4', 'g2.multiplication.tables_3_4'],
      ['g2_mul_tables_6_7', 'g2.multiplication.tables_6_7'],
      ['g2_mul_tables_8_9_1', 'g2.multiplication.tables_8_9_1'],
      ['g2_mul_properties_table', 'g2.multiplication.properties'],
      ['g2_mul_times_and_beyond', 'g2.multiplication.times_simple_2digit'],
      ['g2_mul_core', 'g2.multiplication.review']
    ])
  });

  const FALLBACK_RUSH = Object.freeze({
    number: Object.freeze(['g2_num_group_count', 'g2_num_to1000', 'g2_num_place_value', 'g2_num_relative_units', 'g2_num_compare', 'g2_num_number_line', 'g2_num_to10000', 'g2_num_10000_relations', 'g2_num_unit_fractions', 'g2_num_to1000', 'g2_num_compare', 'g2_num_to10000']),
    written: Object.freeze(['g2_calc_add_no_carry', 'g2_calc_add_no_carry', 'g2_calc_add_regroup', 'g2_calc_add_regroup', 'g2_calc_sub_no_borrow', 'g2_calc_sub_no_borrow', 'g2_calc_sub_regroup', 'g2_calc_sub_regroup', 'g2_calc_sum_to_3digit', 'g2_calc_sub_from_3digit', 'g2_calc_simple_3digit', 'g2_calc_inverse_check']),
    multiplication: Object.freeze(['g2_mul_equal_groups', 'g2_mul_scene_expression', 'g2_mul_array_repeated_add', 'g2_mul_tables_2_5', 'g2_mul_tables_2_5', 'g2_mul_tables_3_4', 'g2_mul_tables_6_7', 'g2_mul_tables_8_9_1', 'g2_mul_tables_8_9_1', 'g2_mul_properties_table', 'g2_mul_times_and_beyond', 'g2_mul_times_and_beyond'])
  });

  function seededRng(seed) {
    let value = Number(seed) >>> 0;
    return function () {
      value += 0x6D2B79F5;
      let t = value;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function rand(min, max, rng) {
    const random = rng || Math.random;
    return Math.floor(random() * (max - min + 1)) + min;
  }

  function pick(items, rng) {
    return items[rand(0, items.length - 1, rng)];
  }

  function shuffle(items, rng) {
    const copy = items.slice();
    const random = rng || Math.random;
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(random() * (index + 1));
      const value = copy[index];
      copy[index] = copy[swap];
      copy[swap] = value;
    }
    return copy;
  }

  function optionValue(option) {
    return typeof option === 'object' && option !== null ? option.value : option;
  }

  function hashString(value) {
    let hash = 2166136261;
    const text = String(value);
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  function questionSignature(question) {
    const semantic = {
      skill: question.canonicalSkillId,
      kind: question.kind,
      prompt: question.prompt,
      correct: question.correct,
      options: (question.options || []).map(optionValue).map(String).sort(),
      visual: question.visual || null,
      math: question.math || null,
      story: Boolean(question.story),
      bare: Boolean(question.bareCalculation)
    };
    return hashString(JSON.stringify(semantic));
  }

  function normalizeLineId(lineId) {
    if (!LINE_IDS.includes(lineId)) throw new RangeError('unknown grade 2 arithmetic line: ' + lineId);
    return lineId;
  }

  function curriculumLine(lineId) {
    const curriculum = global.HiramekiGrade2Curriculum;
    return curriculum && curriculum.lines && curriculum.lines[lineId];
  }

  function stageList(lineId) {
    const normalized = normalizeLineId(lineId);
    const live = curriculumLine(normalized);
    if (live && Array.isArray(live.stages) && live.stages.length === 11) return live.stages;
    return FALLBACK_STAGES[normalized].map(function (entry, index) {
      return { id: entry[0], canonicalSkillId: entry[1], n: index + 1, checkpoint: index === 4 || index === 10 };
    });
  }

  function resolveStage(lineId, stageRef) {
    const normalized = normalizeLineId(lineId);
    const stages = stageList(normalized);
    let index = -1;
    if (typeof stageRef === 'string') {
      index = stages.findIndex(function (stage) { return stage.id === stageRef; });
    } else if (stageRef && typeof stageRef === 'object' && stageRef.id) {
      index = stages.findIndex(function (stage) { return stage.id === stageRef.id; });
    } else if (Number.isFinite(Number(stageRef))) {
      index = Math.floor(Number(stageRef));
    }
    if (index < 0 || index >= stages.length) throw new RangeError('unknown stage for ' + normalized + ': ' + stageRef);
    return { lineId: normalized, stage: stages[index], stageIndex: index };
  }

  function uniqueOptions(correct, candidates, minimum) {
    const seen = new Set();
    const result = [];
    [correct].concat(candidates || []).forEach(function (value) {
      const key = String(optionValue(value));
      if (!seen.has(key)) {
        seen.add(key);
        result.push(value);
      }
    });
    if (result.length < (minimum || 2)) throw new Error('not enough unique options for ' + correct);
    return result;
  }

  function numberOptions(correct, config, rng) {
    const cfg = config || {};
    const min = cfg.min == null ? 0 : cfg.min;
    const max = cfg.max == null ? Math.max(20, correct + 10) : cfg.max;
    const step = cfg.step || 1;
    const offsets = shuffle([step, -step, step * 2, -step * 2, step * 5, -step * 5, step * 10, -step * 10], rng);
    const values = [correct];
    offsets.forEach(function (offset) {
      const value = correct + offset;
      if (value >= min && value <= max) values.push(value);
    });
    let guard = 0;
    while (new Set(values.map(String)).size < 4 && guard < 80) {
      values.push(rand(Math.ceil(min / step), Math.floor(max / step), rng) * step);
      guard += 1;
    }
    return uniqueOptions(correct, values, 2).slice(0, 4);
  }

  function defaults(data) {
    return Object.assign({
      kind: 'choice',
      prompt: '',
      instruction: 'こたえを えらぼう',
      correct: 0,
      options: [],
      hint: '数や図を、位やまとまりに分けて見てみよう。',
      explain: '図と数をつなぐと確かめられるよ。',
      visual: { type: 'machine' },
      story: false,
      checkpoint: false,
      speedSafe: true,
      bareCalculation: false,
      operation: true,
      input: '',
      selected: [],
      orderSelected: [],
      attempts: 0,
      feedback: null,
      showHint: false
    }, data || {});
  }

  function finalizeQuestion(data, meta, rng) {
    const question = defaults(data);
    question.gradeId = GRADE_ID;
    question.courseId = GRADE_ID;
    question.lineId = meta.lineId;
    question.stageId = meta.stage.id;
    question.stageIndex = meta.stageIndex;
    question.canonicalSkillId = meta.stage.canonicalSkillId || FALLBACK_STAGES[meta.lineId][meta.stageIndex][1];
    question.checkpoint = meta.stageIndex === 4 || meta.stageIndex === 10;
    if (question.options && question.options.length) question.options = shuffle(question.options, rng);
    question.signature = questionSignature(question);
    return question;
  }

  function numericChoice(correct, prompt, visual, rng, extra) {
    const cfg = extra || {};
    return Object.assign({
      kind: cfg.kind || 'choice',
      prompt,
      correct,
      options: numberOptions(correct, cfg, rng),
      visual
    }, cfg);
  }

  function numericInput(correct, prompt, visual, extra) {
    return Object.assign({
      kind: 'input',
      prompt,
      instruction: '数字キーで 入れて「けってい」',
      correct,
      input: '',
      options: [],
      visual
    }, extra || {});
  }

  function numericSlider(correct, prompt, visual, extra) {
    const cfg = extra || {};
    const step = cfg.step || 1;
    const radius = cfg.radius == null ? step * 5 : cfg.radius;
    const min = cfg.min == null ? Math.max(0, correct - radius) : cfg.min;
    const max = cfg.max == null ? correct + radius : cfg.max;
    return Object.assign({
      kind: 'slider',
      prompt,
      instruction: 'ギアを回して 数を合わせよう',
      correct,
      input: Math.max(min, correct - step * 2),
      min,
      max,
      step,
      options: [],
      visual
    }, cfg);
  }

  function orderedQuestion(values, prompt, visual, extra) {
    return Object.assign({
      kind: 'order',
      prompt,
      instruction: 'カードを じゅんばんに タップして「けってい」',
      correct: values.join(','),
      options: values.slice(),
      visual
    }, extra || {});
  }

  function tapQuestion(correct, total, prompt, visual, extra) {
    return Object.assign({
      kind: 'tap',
      prompt,
      instruction: String(correct) + 'こ えらんで「けってい」',
      correct,
      options: [],
      input: 0,
      visual: Object.assign({ type: 'selector', total }, visual || {})
    }, extra || {});
  }

  function relationOptions(correct) {
    return uniqueOptions(correct, ['＞', '＜', '＝'], 3);
  }

  function digits3(rng, allowZero) {
    const hundreds = rand(1, 9, rng);
    const tens = rand(allowZero ? 0 : 1, 9, rng);
    const ones = rand(allowZero ? 0 : 1, 9, rng);
    return { hundreds, tens, ones, value: hundreds * 100 + tens * 10 + ones };
  }

  function digits4(rng, allowZero) {
    const thousands = rand(1, 9, rng);
    const hundreds = rand(allowZero ? 0 : 1, 9, rng);
    const tens = rand(allowZero ? 0 : 1, 9, rng);
    const ones = rand(allowZero ? 0 : 1, 9, rng);
    return { thousands, hundreds, tens, ones, value: thousands * 1000 + hundreds * 100 + tens * 10 + ones };
  }

  function placeWords(parts) {
    const values = [];
    if (parts.thousands) values.push(parts.thousands + '千');
    if (parts.hundreds) values.push(parts.hundreds + '百');
    if (parts.tens) values.push(parts.tens + '十');
    if (parts.ones) values.push(parts.ones + '一');
    return values.join('・') || '0';
  }

  function numberGroupCount(round, rng) {
    const unit = pick([2, 5, 10], rng);
    const groups = rand(2, unit === 10 ? 8 : 9, rng);
    const total = unit * groups;
    const role = round % STAGE_ROUNDS;
    if (role === 0) return tapQuestion(unit, Math.min(20, total), total + 'この部品を ' + unit + 'こずつにする。1ケース分を選ぼう。', { type: 'selector', total: Math.min(20, total) }, { hint: 'まず一つのケースに入る数だけ選ぼう。', explain: '1ケースは' + unit + 'こだね。' });
    if (role === 1) return numericChoice(total, unit + 'こ入りのケースが' + groups + 'こ。全部で何こ？', { type: 'equal-groups', groups, perGroup: unit, total }, rng, { min: 2, max: 90, step: unit, instruction: 'まとまりを数えて えらぼう', explain: unit + 'こずつを' + groups + '回数えると' + total + 'こ。' });
    if (role === 2) return { kind: 'sort', prompt: total + 'こを いちばん少ないケース数で、同じ数ずつまとめるなら？', correct: '10こずつ', options: ['2こずつ', '5こずつ', '10こずつ'], visual: { type: 'sort', item: total + 'こ', bins: ['2こずつ', '5こずつ', '10こずつ'] }, hint: '一つのケースに多く入るほど、ケースは少なくなるよ。', explain: '10こずつにするとケース数がいちばん少ないね。' };
    if (role === 3) {
      const start = unit * rand(0, 2, rng);
      const values = [start, start + unit, start + unit * 2, start + unit * 3];
      return orderedQuestion(values, unit + 'ずつ ふえるように並べよう。', { type: 'number-line', values }, { hint: 'となりへ行くたび' + unit + 'を足そう。', explain: values.join('、') + 'の順だよ。' });
    }
    if (role === 4) return numericChoice(total + unit, total + 'まで数えた。つぎの「' + unit + 'ずつ」の数は？', { type: 'number-line', values: [total - unit, total, '?'] }, rng, { kind: 'route', min: unit, max: 100, step: unit, hint: total + 'に' + unit + 'を足そう。', explain: 'つぎは' + (total + unit) + 'だよ。' });
    if (role === 5) return numericChoice(total, '工房で部品を' + unit + 'こずつ、' + groups + '箱につめた。部品は全部で何こ？', { type: 'equal-groups', groups, perGroup: unit, total }, rng, { min: 2, max: 90, step: unit, story: true, instruction: '箱のまとまりを数えよう', hint: unit + 'ずつを' + groups + '回数えよう。', explain: '全部で' + total + 'こだね。' });
    if (role === 6) return numericInput(total, Array(groups).fill(unit).join('＋') + '＝□', { type: 'circuit', equation: unit + 'ずつ ' + groups + '回' }, { bareCalculation: true, operation: false, hint: unit + 'ずつ数えよう。', explain: '答えは' + total + '。' });
    return numericChoice(groups, total + 'こを' + unit + 'こずつケースに入れる。ケースはいくつ？', { type: 'equal-groups', groups, perGroup: unit, total }, rng, { min: 1, max: 10, hint: unit + 'こずつ丸で囲むつもりで数えよう。', explain: groups + 'ケースできるよ。' });
  }

  function numberTo1000(round, rng) {
    const parts = digits3(rng, true);
    if (parts.tens === 0 && parts.ones === 0) parts.ones = rand(1, 9, rng);
    parts.value = parts.hundreds * 100 + parts.tens * 10 + parts.ones;
    const role = round % STAGE_ROUNDS;
    const visual = { type: 'circuit', equation: placeWords(parts) };
    if (role === 0) return numericChoice(parts.value, parts.hundreds + '百、' + parts.tens + '十、' + parts.ones + '一を組み立てると？', visual, rng, { min: 100, max: 999, step: 10, instruction: '位のケースをつないで えらぼう', hint: '百・十・一の順に数字を置こう。', explain: 'できる数は' + parts.value + '。' });
    if (role === 1) return numericInput(parts.value, '表示「' + placeWords(parts) + '」を数字で入れよう。', visual, { hint: 'ない位には0を置くよ。', explain: placeWords(parts) + 'は' + parts.value + '。' });
    if (role === 2) {
      const base = rand(1, 7, rng) * 100 + rand(0, 5, rng) * 10;
      const values = [base + 2, base + 20, base + 200];
      return orderedQuestion(values.sort(function (a, b) { return a - b; }), '小さい数から レールへ並べよう。', { type: 'number-line', values: values.slice().sort(function (a, b) { return a - b; }) }, { hint: 'まず百の位を比べよう。', explain: '百、十、一の位の順に比べるよ。' });
    }
    if (role === 3) {
      const place = pick([{ label: '百の位', correct: parts.hundreds }, { label: '十の位', correct: parts.tens }, { label: '一の位', correct: parts.ones }], rng);
      return numericChoice(place.correct, parts.value + 'の' + place.label + 'の数字は？', visual, rng, { min: 0, max: 9, hint: '位取り表の列をたどろう。', explain: place.label + 'は' + place.correct + '。' });
    }
    if (role === 4) return numericSlider(parts.hundreds, parts.value + 'には 百の束がいくつある？', visual, { min: 0, max: 9, step: 1, hint: 'いちばん左の数字を見よう。', explain: '百の束は' + parts.hundreds + 'こ。' });
    if (role === 5) return numericChoice(parts.value, '倉庫に百ケースが' + parts.hundreds + 'こ、十の束が' + parts.tens + '本、ばらが' + parts.ones + 'こある。全部でいくつ？', visual, rng, { min: 100, max: 999, step: 10, story: true, hint: '百ケースから順に数へ直そう。', explain: '全部で' + parts.value + 'こ。' });
    if (role === 6) return numericInput(parts.value, (parts.hundreds * 100) + '＋' + (parts.tens * 10) + '＋' + parts.ones + '＝□', visual, { bareCalculation: true, operation: false, hint: '百・十・一を同じ数にまとめよう。', explain: '答えは' + parts.value + '。' });
    const decompositions = [
      parts.hundreds + '百 ' + parts.tens + '十 ' + parts.ones + '一',
      Math.max(0, parts.hundreds - 1) + '百 ' + (parts.tens + 10) + '十 ' + parts.ones + '一',
      parts.hundreds + '百 ' + Math.max(0, parts.tens - 1) + '十 ' + (parts.ones + 10) + '一'
    ];
    return { kind: 'route', prompt: parts.value + 'と同じ数になる回路は？', correct: decompositions[0], options: uniqueOptions(decompositions[0], decompositions.slice(1), 2), visual, hint: '百、十、一へ直して合計しよう。', explain: decompositions[0] + 'が基本の表し方だよ。' };
  }

  function numberPlaceValue(round, rng) {
    const parts = digits3(rng, true);
    const role = round % STAGE_ROUNDS;
    const visual = { type: 'circuit', equation: placeWords(parts) + ' → ' + parts.value };
    if (role === 0) {
      const targets = [{ digit: parts.hundreds, place: '百の位', value: parts.hundreds * 100 }, { digit: parts.tens, place: '十の位', value: parts.tens * 10 }, { digit: parts.ones, place: '一の位', value: parts.ones }];
      const target = pick(targets, rng);
      return numericChoice(target.value, parts.value + 'の数字「' + target.digit + '」が表す大きさは？', visual, rng, { min: 0, max: 900, step: target.place === '百の位' ? 100 : target.place === '十の位' ? 10 : 1, hint: target.place + 'にある数字だよ。', explain: target.digit + 'は' + target.value + 'を表すよ。' });
    }
    if (role === 1) {
      const correct = parts.hundreds * 100 + '＋' + parts.tens * 10 + '＋' + parts.ones;
      return { kind: 'choice', prompt: parts.value + 'を位ごとに分けた式は？', correct, options: uniqueOptions(correct, [parts.hundreds + '＋' + parts.tens + '＋' + parts.ones, parts.hundreds * 10 + '＋' + parts.tens * 100 + '＋' + parts.ones, parts.hundreds * 100 + '＋' + parts.tens + '＋' + parts.ones * 10], 2), visual, hint: '百の位は100倍、十の位は10倍するよ。', explain: correct + 'だね。' };
    }
    if (role === 2) {
      let cards = [parts.hundreds, parts.tens, parts.ones];
      while (new Set(cards).size < 3) cards = shuffle([rand(1, 9, rng), rand(0, 9, rng), rand(0, 9, rng)], rng);
      const correct = cards.join(',');
      return { kind: 'order', prompt: cards[0] + 'を百の位、' + cards[1] + 'を十の位、' + cards[2] + 'を一の位に置こう。', correct, options: cards.slice(), visual: { type: 'circuit', equation: '百｜十｜一' }, instruction: '指定された順に数字カードをタップ', hint: '問題文に出た数字の順だよ。', explain: '百・十・一の順で' + cards.join('、') + '。' };
    }
    if (role === 3) {
      const correct = placeWords(parts);
      return { kind: 'route', prompt: parts.value + 'につながる位取り表示は？', correct, options: uniqueOptions(correct, [parts.hundreds + '百・' + parts.ones + '十・' + parts.tens + '一', parts.tens + '百・' + parts.hundreds + '十・' + parts.ones + '一', ((parts.hundreds % 9) + 1) + '百・' + parts.tens + '十・' + parts.ones + '一'], 2), visual, hint: '左から百、十、一の位。', explain: correct + 'につながるよ。' };
    }
    if (role === 4) return numericSlider(parts.tens, parts.value + 'の十の位を合わせよう。', visual, { min: 0, max: 9, hint: '右から2番目の数字だよ。', explain: '十の位は' + parts.tens + '。' });
    if (role === 5) return numericChoice(parts.value, '表示塔に百の板' + parts.hundreds + '枚、十の棒' + parts.tens + '本、一の部品' + parts.ones + 'こを置いた。表示される数は？', visual, rng, { min: 100, max: 999, step: 10, story: true, hint: '位ごとの部品を数字へ直そう。', explain: '表示は' + parts.value + '。' });
    if (role === 6) return numericInput(parts.value, (parts.hundreds * 100) + '＋' + (parts.tens * 10) + '＋' + parts.ones + '＝□', visual, { bareCalculation: true, operation: false, hint: '同じ位を確かめて合わせよう。', explain: '答えは' + parts.value + '。' });
    const wrong = parts.hundreds * 100 + parts.ones * 10 + parts.tens;
    return { kind: 'choice', prompt: '「' + placeWords(parts) + '」の表示。正しく直った数字は？', correct: parts.value, options: uniqueOptions(parts.value, [wrong, parts.value + 10, Math.max(100, parts.value - 100)], 2), visual, hint: '0がある位も飛ばさないよ。', explain: '正しい表示は' + parts.value + '。' };
  }

  function numberRelativeUnits(round, rng) {
    const role = round % STAGE_ROUNDS;
    const unit = pick([10, 100], rng);
    const count = rand(2, unit === 100 ? 9 : 90, rng);
    const total = unit * count;
    const visual = { type: 'circuit', equation: unit + 'の束 × ' + count };
    if (role === 0) return numericChoice(count, total + 'は' + unit + 'のいくつ分？', visual, rng, { min: 1, max: unit === 100 ? 10 : 100, hint: unit + 'ずつ区切って数えよう。', explain: total + 'は' + unit + 'の' + count + 'こ分。' });
    if (role === 1) return numericChoice(total, unit + 'の束が' + count + 'こ。できる数は？', visual, rng, { min: unit, max: unit === 100 ? 1000 : 990, step: unit, hint: '束の数に' + unit + 'を重ねよう。', explain: 'できる数は' + total + '。' });
    if (role === 2) {
      const correct = count + 'こ分';
      return { kind: 'route', prompt: total + 'と同じ大きさへ回路をつなごう。', correct, options: uniqueOptions(correct, [(count + 1) + 'こ分', Math.max(1, count - 1) + 'こ分'], 2), visual, hint: total + 'を' + unit + 'ずつ数えよう。', explain: unit + 'の' + correct + 'だね。' };
    }
    if (role === 3) {
      const add = unit * rand(1, 3, rng);
      const correct = total + add;
      return numericSlider(correct, total + 'に' + unit + 'の束を' + (add / unit) + 'こ足そう。', { type: 'number-line', values: [total, total + unit, correct] }, { min: total, max: correct + unit * 2, step: unit, hint: unit + 'ずつギアを進めよう。', explain: 'できる数は' + correct + '。' });
    }
    if (role === 4) {
      const values = [total, total + unit, total + unit * 2];
      return orderedQuestion(values, unit + 'ずつ増える順に並べよう。', { type: 'number-line', values }, { hint: 'となりへ行くと' + unit + '増えるよ。', explain: values.join('、') + 'の順。' });
    }
    if (role === 5) return numericChoice(total, '工房へ' + unit + '個入りの部品ケースが' + count + 'こ届いた。部品はいくつ？', visual, rng, { min: unit, max: unit === 100 ? 1000 : 990, step: unit, story: true, hint: unit + 'を' + count + '回ぶん考えよう。', explain: '部品は' + total + 'こ。' });
    if (role === 6) {
      const a = rand(2, unit === 100 ? 6 : 60, rng) * unit;
      const b = rand(1, unit === 100 ? 3 : 20, rng) * unit;
      return numericInput(a + b, a + '＋' + b + '＝□', { type: 'circuit', equation: unit + 'を単位に計算' }, { bareCalculation: true, operation: false, hint: unit + 'の束の数どうしを足そう。', explain: '答えは' + (a + b) + '。' });
    }
    const leftCount = rand(3, unit === 100 ? 9 : 90, rng);
    const removeCount = rand(1, Math.min(3, leftCount - 1), rng);
    return numericChoice((leftCount - removeCount) * unit, (leftCount * unit) + 'から' + unit + 'の束を' + removeCount + 'こ外すと？', { type: 'number-line-back', start: leftCount * unit, steps: removeCount * unit, target: (leftCount - removeCount) * unit }, rng, { min: 0, max: leftCount * unit, step: unit, hint: '束の数を' + removeCount + '減らそう。', explain: '残りは' + ((leftCount - removeCount) * unit) + '。' });
  }

  function numberCompare(round, rng) {
    const fourDigit = round % 3 === 2;
    const left = fourDigit ? digits4(rng, true).value : digits3(rng, true).value;
    let right = fourDigit ? digits4(rng, true).value : digits3(rng, true).value;
    if (right === left) right += right < (fourDigit ? 9999 : 999) ? 1 : -1;
    const correct = left > right ? '＞' : '＜';
    const role = round % STAGE_ROUNDS;
    const visual = { type: 'place-value-compare', left, right };
    if (role === 0) return { kind: 'choice', prompt: left + ' □ ' + right + '。ゲートの向きは？', correct, options: relationOptions(correct), visual, hint: 'いちばん大きい位から比べよう。', explain: left + correct + right + 'だよ。' };
    if (role === 1) return { kind: 'sort', prompt: '大きい数を「大きい」トレイへ。', correct: String(Math.max(left, right)), options: [String(left), String(right)], visual: { type: 'sort', item: left + ' と ' + right, bins: [String(left), String(right)] }, hint: '上の位で違うところを探そう。', explain: Math.max(left, right) + 'のほうが大きいね。' };
    if (role === 2) {
      let third = fourDigit ? rand(1000, 9999, rng) : rand(100, 999, rng);
      while (third === left || third === right) third = fourDigit ? rand(1000, 9999, rng) : rand(100, 999, rng);
      const values = [left, right, third].sort(function (a, b) { return a - b; });
      values.sort(function (a, b) { return a - b; });
      return orderedQuestion(values, '小さい順に ゲートへ通そう。', { type: 'number-line', values }, { hint: '千、百、十、一の位の順に比べよう。', explain: values.join('＜') + '。' });
    }
    if (role === 3) {
      const place = fourDigit ? (Math.floor(left / 1000) !== Math.floor(right / 1000) ? '千の位' : '下の位') : (Math.floor(left / 100) !== Math.floor(right / 100) ? '百の位' : '下の位');
      return { kind: 'route', prompt: left + 'と' + right + '。最初に大小が決まるスキャン場所は？', correct: place, options: uniqueOptions(place, fourDigit ? ['千の位', '百の位', '十の位', '一の位'] : ['百の位', '十の位', '一の位', '下の位'], 2), visual, hint: '左の位から、違う数字を探そう。', explain: place + 'を見れば判断できるよ。' };
    }
    if (role === 4) return { kind: 'choice', prompt: '比較ゲートの説明で正しいものは？', correct: '大きい位から比べる', options: ['大きい位から比べる', '一の位だけ比べる', '数字の個数だけ見る'], visual, hint: '位の大きさには順番があるよ。', explain: '千・百・十・一のように大きい位から比べるよ。' };
    if (role === 5) return { kind: 'choice', prompt: '東倉庫に' + left + 'こ、西倉庫に' + right + 'こある。多い倉庫の個数は？', correct: Math.max(left, right), options: numberOptions(Math.max(left, right), { min: fourDigit ? 1000 : 100, max: fourDigit ? 9999 : 999, step: 10 }, rng), visual, story: true, hint: '倉庫の数を大きい位から比べよう。', explain: Math.max(left, right) + 'この倉庫が多いね。' };
    if (role === 6) return { kind: 'choice', prompt: left + ' □ ' + right, correct, options: relationOptions(correct), visual, bareCalculation: true, operation: false, hint: '左から違う位を探そう。', explain: left + correct + right + '。' };
    return { kind: 'route', prompt: '大きい数へ回路をつなごう。', correct: Math.max(left, right), options: uniqueOptions(Math.max(left, right), [Math.min(left, right)], 2), visual, hint: '位ごとに比べよう。', explain: '大きい数は' + Math.max(left, right) + '。' };
  }

  function numberLine(round, rng) {
    const step = pick([2, 5, 10, 100], rng);
    const maxStart = step === 100 ? 8000 : step === 10 ? 9900 : 990;
    const start = rand(0, Math.floor(maxStart / step), rng) * step;
    const values = [start, start + step, start + step * 2, start + step * 3];
    const role = round % STAGE_ROUNDS;
    const visual = { type: 'number-line', values };
    if (role === 0) return orderedQuestion(values, step + 'ずつ増える順に 数字車両を並べよう。', visual, { hint: '一駅ごとに' + step + 'を足そう。', explain: values.join('、') + 'の順。' });
    if (role === 1) return numericChoice(values[2], values[0] + '、' + values[1] + '、□、' + values[3] + '。□は？', visual, rng, { min: Math.max(0, start - step), max: start + step * 5, step, hint: values[1] + 'に' + step + 'を足そう。', explain: '□は' + values[2] + '。' });
    if (role === 2) return numericSlider(values[3], start + 'から' + step + 'ずつ3駅進もう。', visual, { min: start, max: start + step * 5, step, hint: step + 'を3回足すよ。', explain: '着く数は' + values[3] + '。' });
    if (role === 3) return numericChoice(values[1], start + 'のつぎの駅は？ 目盛りは' + step + 'ずつ。', visual, rng, { kind: 'route', min: start, max: start + step * 4, step, hint: start + 'に' + step + 'を足そう。', explain: 'つぎは' + values[1] + '。' });
    if (role === 4) return { kind: 'choice', prompt: values[0] + 'から' + values[1] + 'までの目盛り幅は？', correct: step, options: uniqueOptions(step, [step === 2 ? 5 : 2, step === 100 ? 10 : 100, step === 5 ? 10 : 5], 2), visual, hint: 'となりの数の差を見よう。', explain: '目盛りは' + step + 'ずつ。' };
    if (role === 5) return numericChoice(values[3], 'レール車が' + start + '駅から、1区間' + step + 'ずつ3区間進んだ。着いた駅は？', visual, rng, { min: start, max: start + step * 5, step, story: true, hint: step + 'を3回進めよう。', explain: '着いた駅は' + values[3] + '。' });
    if (role === 6) return numericInput(values[2], values[0] + '，' + values[1] + '，□，' + values[3], visual, { bareCalculation: true, operation: false, hint: step + 'ずつ増えるよ。', explain: '□は' + values[2] + '。' });
    return orderedQuestion(values.slice().reverse(), '大きい順に 車両を戻そう。', visual, { hint: step + 'ずつ小さくなる順だよ。', explain: values.slice().reverse().join('、') + '。' });
  }

  function numberTo10000(round, rng) {
    const parts = digits4(rng, true);
    const role = round % STAGE_ROUNDS;
    const visual = { type: 'circuit', equation: placeWords(parts) };
    if (role === 0) return numericChoice(parts.value, parts.thousands + '千、' + parts.hundreds + '百、' + parts.tens + '十、' + parts.ones + '一を組み立てると？', visual, rng, { min: 1000, max: 9999, step: 100, hint: '千・百・十・一の順に数字を置こう。', explain: '表示は' + parts.value + '。' });
    if (role === 1) {
      const correct = placeWords(parts);
      return { kind: 'route', prompt: parts.value + 'の読み方につながる回路は？', correct, options: uniqueOptions(correct, [parts.thousands + '千・' + parts.tens + '百・' + parts.hundreds + '十・' + parts.ones + '一', parts.hundreds + '千・' + parts.thousands + '百・' + parts.tens + '十・' + parts.ones + '一', ((parts.thousands % 9) + 1) + '千・' + parts.hundreds + '百・' + parts.tens + '十・' + parts.ones + '一'], 2), visual, hint: '左から千、百、十、一。', explain: correct + 'だよ。' };
    }
    if (role === 2) {
      let values = [parts.value, rand(1000, 9999, rng), rand(1000, 9999, rng)];
      while (new Set(values).size < 3) values = [parts.value, rand(1000, 9999, rng), rand(1000, 9999, rng)];
      values.sort(function (a, b) { return a - b; });
      return orderedQuestion(values, '小さい4けたの数から並べよう。', { type: 'number-line', values }, { hint: '千の位から比べよう。', explain: values.join('＜') + '。' });
    }
    if (role === 3) {
      const target = pick([{ label: '千の位', digit: parts.thousands, value: parts.thousands * 1000 }, { label: '百の位', digit: parts.hundreds, value: parts.hundreds * 100 }, { label: '十の位', digit: parts.tens, value: parts.tens * 10 }, { label: '一の位', digit: parts.ones, value: parts.ones }], rng);
      return numericChoice(target.value, parts.value + 'の' + target.label + 'の「' + target.digit + '」が表す大きさは？', visual, rng, { min: 0, max: 9000, step: target.value >= 1000 ? 1000 : target.value >= 100 ? 100 : target.value >= 10 ? 10 : 1, hint: target.label + 'の単位をかけよう。', explain: '表す大きさは' + target.value + '。' });
    }
    if (role === 4) return numericSlider(parts.thousands, parts.value + 'には千の束がいくつある？', visual, { min: 0, max: 10, step: 1, hint: '千の位の数字を見よう。', explain: '千の束は' + parts.thousands + 'こ。' });
    if (role === 5) return numericChoice(parts.value, '表示タワーへ千ケース' + parts.thousands + 'こ、百ケース' + parts.hundreds + 'こ、十の束' + parts.tens + '本、ばら' + parts.ones + 'こを運んだ。表示は？', visual, rng, { min: 1000, max: 9999, step: 100, story: true, hint: '空の位には0を置いて読もう。', explain: '表示は' + parts.value + '。' });
    if (role === 6) return { kind: 'choice', prompt: (parts.thousands * 1000) + '＋' + (parts.hundreds * 100) + '＋' + (parts.tens * 10) + '＋' + parts.ones + '＝□', correct: parts.value, options: numberOptions(parts.value, { min: 1000, max: 9999, step: 100 }, rng), visual, bareCalculation: true, operation: false, hint: '千・百・十・一を合わせよう。', explain: '答えは' + parts.value + '。' };
    return { kind: 'choice', prompt: '「' + placeWords(parts) + '」へ正しく直した表示は？', correct: parts.value, options: uniqueOptions(parts.value, [parts.thousands * 1000 + parts.tens * 100 + parts.hundreds * 10 + parts.ones, parts.value + (parts.value <= 9899 ? 100 : -100), parts.value + (parts.value <= 9989 ? 10 : -10)], 2), visual, hint: '各位の数字をもう一度たどろう。', explain: '正しい表示は' + parts.value + '。' };
  }

  function numberRelations10000(round, rng) {
    const parts = digits4(rng, true);
    const role = round % STAGE_ROUNDS;
    const visual = { type: 'circuit', equation: parts.value + ' ⇄ ' + placeWords(parts) };
    if (role === 0) {
      const correct = placeWords(parts);
      return { kind: 'route', prompt: parts.value + 'と同じ位取り回路は？', correct, options: uniqueOptions(correct, [parts.thousands + '千・' + parts.tens + '百・' + parts.hundreds + '十・' + parts.ones + '一', parts.hundreds + '千・' + parts.thousands + '百・' + parts.tens + '十・' + parts.ones + '一', ((parts.thousands % 9) + 1) + '千・' + parts.hundreds + '百・' + parts.tens + '十・' + parts.ones + '一'], 2), visual, hint: '数字を千・百・十・一へ分けよう。', explain: correct + 'だよ。' };
    }
    if (role === 1) {
      const step = pick([10, 100], rng);
      const base = Math.floor(parts.value / step) * step;
      const values = [Math.max(0, base - step), base, base + step];
      return orderedQuestion(values, step + 'ずつ増える順に並べよう。', { type: 'number-line', values }, { hint: 'となりへ' + step + 'ずつ進むよ。', explain: values.join('、') + '。' });
    }
    if (role === 2) {
      const hundreds = Math.floor(parts.value / 100);
      return numericChoice(hundreds, parts.value + 'は100を何こ集めて、あと' + (parts.value % 100) + '？', visual, rng, { min: 1, max: 99, hint: '百のまとまりまでを数えよう。', explain: '100が' + hundreds + 'こと、あと' + (parts.value % 100) + '。' });
    }
    if (role === 3) {
      const next = Math.floor(parts.value / 100) * 100 + 100;
      return numericSlider(next, parts.value + 'より大きい、つぎの100のまとまりへ合わせよう。', { type: 'number-line', values: [parts.value, next] }, { min: next - 200, max: next + 200, step: 100, hint: '百の位を一つ進めよう。', explain: 'つぎの100のまとまりは' + next + '。' });
    }
    if (role === 4) {
      const other = parts.value + pick([-100, -10, 10, 100], rng);
      const correct = parts.value > other ? '＞' : '＜';
      return { kind: 'choice', prompt: parts.value + ' □ ' + other, correct, options: relationOptions(correct), visual: { type: 'place-value-compare', left: parts.value, right: other }, hint: '違う位を上から探そう。', explain: parts.value + correct + other + '。' };
    }
    if (role === 5) return numericChoice(parts.value, 'タワーの千ケース' + parts.thousands + 'こ、百ケース' + parts.hundreds + 'こ、十束' + parts.tens + '本、ばら' + parts.ones + 'こを再点検する。合計は？', visual, rng, { min: 1000, max: 9999, step: 100, story: true, hint: '位ごとの数を合わせよう。', explain: '合計は' + parts.value + '。' });
    if (role === 6) return { kind: 'choice', prompt: (parts.thousands * 1000) + '＋' + (parts.hundreds * 100) + '＋' + (parts.tens * 10) + '＋' + parts.ones + '＝□', correct: parts.value, options: numberOptions(parts.value, { min: 1000, max: 9999, step: 100 }, rng), visual, bareCalculation: true, operation: false, hint: '位ごとの大きさを合わせよう。', explain: '答えは' + parts.value + '。' };
    const step = pick([10, 100], rng);
    const start = Math.floor(parts.value / step) * step;
    return numericChoice(start + step * 2, start + '、' + (start + step) + '、□。目盛りは' + step + 'ずつ。', { type: 'number-line', values: [start, start + step, '?'] }, rng, { kind: 'route', min: start, max: start + step * 4, step, hint: step + 'をもう一度足そう。', explain: '□は' + (start + step * 2) + '。' });
  }

  function numberFractions(round, rng) {
    const denominator = pick([2, 3, 4, 5, 8], rng);
    const notation = '1/' + denominator;
    const role = round % STAGE_ROUNDS;
    const visual = { type: 'objects', count: denominator, icon: '▰' };
    if (role === 0) return tapQuestion(1, denominator, '同じ大きさに' + denominator + 'つに分けた。' + notation + 'ぶんを選ぼう。', { type: 'selector', total: denominator, icons: ['▰'] }, { hint: '単位分数は、分けた一つ分だよ。', explain: denominator + 'つのうち1つが' + notation + '。' });
    if (role === 1) return { kind: 'choice', prompt: '一つを同じ大きさに' + denominator + 'つに分けた一つ分は？', correct: notation, options: uniqueOptions(notation, ['1/' + Math.max(2, denominator - 1), '1/' + Math.min(9, denominator + 1), denominator + '/1'], 2), visual, hint: '分母は、いくつに分けたかを表すよ。', explain: '一つ分は' + notation + '。' };
    if (role === 2) return { kind: 'sort', prompt: notation + 'を作れる切り方はどちら？', correct: denominator + 'つを同じ大きさ', options: [denominator + 'つを同じ大きさ', denominator + 'つをばらばらの大きさ'], visual: { type: 'sort', item: '1本のテープ', bins: ['同じ大きさ', 'ばらばら'] }, hint: '分数では同じ大きさに分けるよ。', explain: denominator + 'つを同じ大きさに分けるよ。' };
    if (role === 3) {
      const onePart = rand(1, 4, rng);
      const total = onePart * denominator;
      return numericChoice(onePart, total + 'この部品の' + notation + 'は何こ？', { type: 'equal-groups', groups: denominator, perGroup: onePart, total }, rng, { kind: 'route', min: 1, max: 10, hint: denominator + 'つの同じグループへ分けよう。', explain: '一つ分は' + onePart + 'こ。' });
    }
    if (role === 4) return numericSlider(denominator, '「1/' + denominator + '」を作るには、もとをいくつに等分する？', visual, { min: 2, max: 8, hint: '分母を見るよ。', explain: denominator + '等分する。' });
    if (role === 5) return { kind: 'choice', prompt: 'トトが1本のテープを' + denominator + '人で同じ長さに分けた。1人分のテープは？', correct: notation, options: uniqueOptions(notation, ['1/' + Math.max(2, denominator - 1), denominator + '/1'], 2), visual, story: true, hint: denominator + '人で等しく分けるよ。', explain: '1人分は全体の' + notation + '。' };
    if (role === 6) return { kind: 'choice', prompt: '1を' + denominator + '等分した1こ分 → □', correct: notation, options: uniqueOptions(notation, ['1/' + Math.min(9, denominator + 1), denominator + '/1'], 2), visual, bareCalculation: true, operation: false, hint: '分母は等分した数。', explain: '□は' + notation + '。' };
    return { kind: 'route', prompt: notation + 'の説明へ回路をつなごう。', correct: denominator + '等分の一つ分', options: uniqueOptions(denominator + '等分の一つ分', [denominator + 'こを全部', '大きさの違う一つ分'], 2), visual, hint: '「同じ大きさ」と「一つ分」が大切。', explain: notation + 'は' + denominator + '等分の一つ分。' };
  }

  const NUMBER_BUILDERS = [];
  NUMBER_BUILDERS[0] = numberGroupCount;
  NUMBER_BUILDERS[1] = numberTo1000;
  NUMBER_BUILDERS[2] = numberPlaceValue;
  NUMBER_BUILDERS[3] = numberRelativeUnits;
  NUMBER_BUILDERS[4] = function (round, rng) { return NUMBER_BUILDERS[[0, 1, 2, 3, 0, 1, 2, 3][round % 8]](round, rng); };
  NUMBER_BUILDERS[5] = numberCompare;
  NUMBER_BUILDERS[6] = numberLine;
  NUMBER_BUILDERS[7] = numberTo10000;
  NUMBER_BUILDERS[8] = numberRelations10000;
  NUMBER_BUILDERS[9] = numberFractions;
  NUMBER_BUILDERS[10] = function (round, rng) { return NUMBER_BUILDERS[[0, 1, 2, 3, 5, 7, 8, 9][round % 8]](round, rng); };

  function addNoCarryPair(rng) {
    const aTens = rand(1, 7, rng);
    const bTens = rand(1, 8 - aTens, rng);
    const aOnes = rand(1, 8, rng);
    const bOnes = rand(1, 9 - aOnes, rng);
    const a = aTens * 10 + aOnes;
    const b = bTens * 10 + bOnes;
    return { a, b, result: a + b, operation: '+', regroup: false };
  }

  function addRegroupPair(rng) {
    const aTens = rand(1, 7, rng);
    const bTens = rand(1, 8 - aTens, rng);
    const aOnes = rand(2, 9, rng);
    const bOnes = rand(Math.max(1, 10 - aOnes), 9, rng);
    const a = aTens * 10 + aOnes;
    const b = bTens * 10 + bOnes;
    return { a, b, result: a + b, operation: '+', regroup: true };
  }

  function subNoBorrowPair(rng) {
    const aTens = rand(2, 9, rng);
    const bTens = rand(1, aTens - 1, rng);
    const aOnes = rand(1, 9, rng);
    const bOnes = rand(1, aOnes, rng);
    const a = aTens * 10 + aOnes;
    const b = bTens * 10 + bOnes;
    return { a, b, result: a - b, operation: '-', regroup: false };
  }

  function subRegroupPair(rng) {
    const aTens = rand(2, 9, rng);
    const bTens = rand(1, aTens - 1, rng);
    const aOnes = rand(0, 8, rng);
    const bOnes = rand(aOnes + 1, 9, rng);
    const a = aTens * 10 + aOnes;
    const b = bTens * 10 + bOnes;
    return { a, b, result: a - b, operation: '-', regroup: true };
  }

  function arithmeticVisual(pair) {
    return { type: 'story', counts: [pair.a, pair.b], operation: pair.operation === '-' ? '−' : '＋' };
  }

  function arithmeticMath(pair, mode) {
    return { kind: pair.operation === '+' ? 'add' : 'subtract', a: pair.a, b: pair.b, result: pair.result, mode };
  }

  function twoDigitWritten(round, rng, pairFactory, mode) {
    const pair = pairFactory(rng);
    const add = pair.operation === '+';
    const role = round % STAGE_ROUNDS;
    const aOnes = pair.a % 10;
    const bOnes = pair.b % 10;
    const visual = arithmeticVisual(pair);
    const math = arithmeticMath(pair, mode);
    if (role === 0) {
      if (add && pair.regroup) return tapQuestion(10, aOnes + bOnes, '一の部品が' + (aOnes + bOnes) + 'こ。十の束へ交換する10こを選ぼう。', { type: 'selector', total: aOnes + bOnes }, { math, hint: '10こ選ぶと、十の束1本に交換できるよ。', explain: '10こを十の束1本へ交換するよ。' });
      if (!add) {
        const available = pair.regroup ? aOnes + 10 : aOnes;
        return Object.assign(tapQuestion(bOnes, available, '一の位から' + bOnes + 'こ取り出そう。', { type: 'selector', total: available }, { math, hint: pair.regroup ? '十の束1本をくずすと一が10こ増えるよ。' : '一の部品だけを見よう。', explain: bOnes + 'こ取り出せたね。' }), { kind: 'remove' });
      }
      return numericChoice(aOnes + bOnes, '一の位のレーンを合流すると何こ？', visual, rng, { min: 0, max: 18, math, hint: aOnes + 'と' + bOnes + 'を合わせよう。', explain: '一の位は' + (aOnes + bOnes) + 'こ。' });
    }
    if (role === 1) {
      let steps;
      if (add && pair.regroup) steps = ['一の位をたす', '10こを十1本へ交換', '十の位をたす'];
      else if (add) steps = ['一の位をたす', '十の位をたす', '二つの位を合わせる'];
      else if (pair.regroup) steps = ['十を一つくずす', '一の位をひく', '十の位をひく'];
      else steps = ['一の位をひく', '十の位をひく', '二つの位を合わせる'];
      return orderedQuestion(steps, pair.a + (add ? '＋' : '−') + pair.b + 'の作業順を並べよう。', { type: 'circuit', equation: pair.a + (add ? '＋' : '−') + pair.b }, { math, hint: '一の位から作業するよ。', explain: steps.join('→') + 'の順。' });
    }
    if (role === 2) return numericChoice(pair.result, '位をそろえたブロックを、答えの回路へつなごう。' + pair.a + (add ? '＋' : '−') + pair.b, visual, rng, { kind: 'route', min: 0, max: 99, math, hint: pair.regroup ? (add ? '一の位の10こを交換しよう。' : '十を一つくずそう。') : '同じ位どうしで計算しよう。', explain: '答えは' + pair.result + '。' });
    if (role === 3) {
      const tens = Math.floor(pair.result / 10);
      const ones = pair.result % 10;
      const correct = tens + '十 ' + ones + '一';
      return { kind: 'choice', prompt: '計算後の十の束と一の部品は？', correct, options: uniqueOptions(correct, [Math.max(0, tens - 1) + '十 ' + (ones + 10) + '一', (tens + 1) + '十 ' + ones + '一', tens + '十 ' + ((ones + 1) % 10) + '一'], 2), visual, math, hint: '答えを十と一へ分けよう。', explain: pair.result + 'は' + correct + '。' };
    }
    if (role === 4) return numericSlider(pair.result, '筆算モニターの答えを合わせよう。', { type: 'circuit', equation: pair.a + (add ? '＋' : '−') + pair.b }, { min: Math.max(0, pair.result - 5), max: Math.min(99, pair.result + 5), step: 1, math, hint: '一の位、十の位の順に確かめよう。', explain: '答えは' + pair.result + '。' });
    if (role === 5) {
      const verb = add ? 'あとから' + pair.b + 'こ届いた' : pair.b + 'こを使った';
      return numericInput(pair.result, '部品が' + pair.a + 'こあり、' + verb + '。いま何こ？', visual, { story: true, math, hint: add ? '増えたので足し算だよ。' : '使ったので引き算だよ。', explain: 'いまは' + pair.result + 'こ。' });
    }
    if (role === 6) return numericInput(pair.result, pair.a + (add ? '＋' : '−') + pair.b + '＝□', { type: 'circuit', equation: pair.a + (add ? '＋' : '−') + pair.b }, { bareCalculation: true, operation: false, math, hint: pair.regroup ? '10の交換を忘れずに。' : '位をそろえよう。', explain: '答えは' + pair.result + '。' });
    return numericChoice(pair.result, '故障した筆算を直す。正しい答えは？', { type: 'circuit', equation: pair.a + (add ? '＋' : '−') + pair.b + '＝？' }, rng, { min: 0, max: 99, math, hint: '一の位の交換が必要か確かめよう。', explain: '修理後は' + pair.result + '。' });
  }

  function addSum3Pair(rng) {
    let a;
    let b;
    do {
      a = rand(50, 99, rng);
      b = rand(20, 99, rng);
    } while (a + b < 100 || a + b > 198);
    return { a, b, result: a + b, operation: '+', regroup: true };
  }

  function subFrom3Pair(rng) {
    let result;
    let b;
    let a;
    do {
      result = rand(20, 99, rng);
      b = rand(10, 99, rng);
      a = result + b;
    } while (a < 100 || a > 198);
    return { a, b, result, operation: '-', regroup: true };
  }

  function simple3Pair(rng) {
    const add = rand(0, 1, rng) === 0;
    if (add) {
      let a;
      let b;
      do {
        a = rand(101, 949, rng);
        b = rand(1, 50, rng);
      } while (a + b > 999 || Math.floor(a / 100) !== Math.floor((a + b) / 100));
      return { a, b, result: a + b, operation: '+', regroup: (a % 10) + (b % 10) >= 10 };
    }
    let a;
    let b;
    do {
      a = rand(150, 999, rng);
      b = rand(1, 50, rng);
    } while (a - b < 100 || Math.floor(a / 100) !== Math.floor((a - b) / 100));
    return { a, b, result: a - b, operation: '-', regroup: (a % 10) < (b % 10) };
  }

  function extendedWritten(round, rng, pairFactory, mode) {
    const pair = pairFactory(rng);
    const add = pair.operation === '+';
    const role = round % STAGE_ROUNDS;
    const visual = arithmeticVisual(pair);
    const math = arithmeticMath(pair, mode);
    if (role === 0) {
      const steps = add
        ? ['一の位を計算', '十の位を交換', '百の位を点灯']
        : ['百・十の束を確認', '必要なら両替', '同じ位から取り出す'];
      return orderedQuestion(steps, pair.a + (add ? '＋' : '−') + pair.b + 'の装置を動かす順は？', { type: 'circuit', equation: pair.a + (add ? '＋' : '−') + pair.b }, { math, hint: '一の位から順に、交換が要るか見るよ。', explain: steps.join('→') + '。' });
    }
    if (role === 1) {
      const target = add ? Math.floor(pair.result / 100) : Math.floor(pair.result / 10);
      const label = add ? '百の位に点灯する数字' : '答えに残る十の束';
      return numericChoice(target, label + 'は？', visual, rng, { min: 0, max: 9, math, hint: '全体の答えを位ごとに見よう。', explain: label + 'は' + target + '。' });
    }
    if (role === 2) return numericChoice(pair.result, '位取り回路を正しい答えへつなごう。', visual, rng, { kind: 'route', min: add ? 100 : 0, max: add ? 198 : 99, math, hint: '同じ位どうしを計算しよう。', explain: '答えは' + pair.result + '。' });
    if (role === 3) return numericSlider(pair.result, '答えのメーターを合わせよう。', { type: 'circuit', equation: pair.a + (add ? '＋' : '−') + pair.b }, { min: Math.max(0, pair.result - 5), max: Math.min(999, pair.result + 5), step: 1, math, hint: '答えの近くから1ずつ合わせよう。', explain: 'メーターは' + pair.result + '。' });
    if (role === 4) {
      const place = add ? '百の位まで使う' : '答えは2けたになる';
      return { kind: 'choice', prompt: pair.a + (add ? '＋' : '−') + pair.b + 'の見通しで正しいものは？', correct: place, options: uniqueOptions(place, ['答えは1けたになる', '答えは1000より大きい', add ? '百の位は使わない' : '答えは3けたのまま'], 2), visual, math, hint: 'およその大きさを先に見よう。', explain: place + 'ね。' };
    }
    if (role === 5) {
      const verb = add ? 'さらに' + pair.b + 'こ届いた' : pair.b + 'こ出荷した';
      return numericInput(pair.result, '倉庫に' + pair.a + 'こあり、' + verb + '。残る表示は？', visual, { story: true, math, hint: add ? '届いたので足そう。' : '出荷したので引こう。', explain: '表示は' + pair.result + '。' });
    }
    if (role === 6) return numericInput(pair.result, pair.a + (add ? '＋' : '−') + pair.b + '＝□', { type: 'circuit', equation: pair.a + (add ? '＋' : '−') + pair.b }, { bareCalculation: true, operation: false, math, hint: '位を縦にそろえるつもりで計算しよう。', explain: '答えは' + pair.result + '。' });
    return numericChoice(pair.result, '検査モニターの故障を直す。正しい計算結果は？', { type: 'circuit', equation: pair.a + (add ? '＋' : '−') + pair.b + '＝？' }, rng, { min: 0, max: 999, math, hint: '逆の計算でも確かめられるよ。', explain: '正しい結果は' + pair.result + '。' });
  }

  function writtenProperties(round, rng) {
    const role = round % STAGE_ROUNDS;
    const first = pick([2, 3, 4, 6, 7, 8], rng);
    const complement = 10 - first;
    let extra = rand(11, 39, rng);
    if (extra === first || extra === complement) extra += 1;
    const result = first + complement + extra;
    const visual = { type: 'three-step', values: [first, complement, extra], ops: ['＋', '＋'] };
    const math = { kind: 'strategy', values: [first, complement, extra], result, mode: 'make-ten' };
    if (role === 0) return orderedQuestion([first, complement, extra], 'まず' + first + '、つぎに10を作るカード、さいごに残りを選ぼう。', visual, { math, hint: first + 'といくつで10か考えよう。', explain: first + '＋' + complement + 'で10を先に作れるよ。' });
    if (role === 1) {
      const a = rand(11, 39, rng);
      const b = rand(2, 20, rng);
      const correct = b + '＋' + a;
      return { kind: 'choice', prompt: a + '＋' + b + 'と同じ答えになる式は？', correct, options: uniqueOptions(correct, [a + '−' + b, b + '−' + a, a + '＋' + (b + 1)], 2), visual: { type: 'circuit', equation: a + '＋' + b }, math: { kind: 'commutative', a, b, result: a + b }, hint: '足す順を入れ替えても答えは同じ。', explain: correct + 'でも同じ答え。' };
    }
    if (role === 2) {
      const correct = '(' + first + '＋' + complement + ')＋' + extra;
      return { kind: 'route', prompt: '10を先に作る近道回路は？', correct, options: uniqueOptions(correct, [first + '＋(' + complement + '＋' + extra + ')', '(' + first + '＋' + extra + ')＋' + complement], 2), visual, math, hint: first + 'と' + complement + 'を先につなごう。', explain: correct + 'なら10を先に作れる。' };
    }
    if (role === 3) return numericSlider(result, '近道回路の答えへギアを合わせよう。', visual, { min: result - 5, max: result + 5, math, hint: '10＋' + extra + 'と考えよう。', explain: '答えは' + result + '。' });
    if (role === 4) return { kind: 'choice', prompt: first + '＋' + complement + '＋' + extra + 'を早く計算する組み方は？', correct: first + 'と' + complement, options: uniqueOptions(first + 'と' + complement, [first + 'と' + extra, complement + 'と' + extra], 2), visual, math, hint: 'ぴったり10になる組を探そう。', explain: first + 'と' + complement + 'で10。' };
    if (role === 5) return numericChoice(result, '部品箱に' + first + 'こ、' + complement + 'こ、' + extra + 'こ入っている。先に10こケースを作ると全部で何こ？', visual, rng, { min: 10, max: 60, story: true, math, hint: first + 'こと' + complement + 'こで10こケース。', explain: '全部で' + result + 'こ。' });
    if (role === 6) return numericInput(result, first + '＋' + complement + '＋' + extra + '＝□', visual, { bareCalculation: true, operation: false, math, hint: '10になる組を先に足そう。', explain: '答えは' + result + '。' });
    return { kind: 'choice', prompt: '「足す順を変えてもよい」を使った正しい説明は？', correct: '先に10を作る', options: ['先に10を作る', 'どの数も1増やす', '足し算を引き算へ変える'], visual, math, hint: '答えを変えずに計算しやすくするよ。', explain: '先に10を作ると簡単だね。' };
  }

  function writtenInverse(round, rng) {
    const add = addRegroupPair(rng);
    const role = round % STAGE_ROUNDS;
    const visual = { type: 'story-model', math: { kind: 'add', a: add.a, b: add.b, result: add.result } };
    if (role === 0) {
      const correct = add.result + '−' + add.b + '＝' + add.a;
      return { kind: 'route', prompt: add.a + '＋' + add.b + '＝' + add.result + 'を確かめる逆向き回路は？', correct, options: uniqueOptions(correct, [add.result + '＋' + add.b + '＝' + add.a, add.a + '−' + add.b + '＝' + add.result], 2), visual, math: { kind: 'inverse', a: add.a, b: add.b, result: add.result }, hint: '和から一方を引くと、もう一方になるよ。', explain: correct + 'で確かめられる。' };
    }
    if (role === 1) return numericChoice(add.b, add.a + '＋□＝' + add.result + '。□は？', visual, rng, { min: 0, max: 99, math: { kind: 'missing-addend', a: add.a, result: add.result, missing: add.b }, hint: add.result + 'から' + add.a + 'を引こう。', explain: '□は' + add.b + '。' });
    if (role === 2) return numericSlider(add.a, add.result + '−□＝' + add.b + '。□へ合わせよう。', visual, { min: Math.max(0, add.a - 5), max: Math.min(99, add.a + 5), math: { kind: 'missing-subtrahend', total: add.result, result: add.b, missing: add.a }, hint: add.b + 'に何を足すと' + add.result + '？', explain: '□は' + add.a + '。' });
    if (role === 3) {
      const estimate = add.a + add.b < 100 ? '100より小さい' : '100以上';
      return { kind: 'sort', prompt: add.a + '＋' + add.b + 'の答えを見積りトレイへ。', correct: estimate, options: ['100より小さい', '100以上'], visual: { type: 'sort', item: add.a + '＋' + add.b, bins: ['100より小さい', '100以上'] }, hint: '十の位を見て、およその大きさを考えよう。', explain: '答えは' + add.result + 'なので「' + estimate + '」。' };
    }
    if (role === 4) {
      const wrong = add.result + pick([-10, 10], rng);
      return { kind: 'choice', prompt: add.a + '＋' + add.b + '＝' + wrong + '。検査結果は？', correct: '故障あり', options: ['故障あり', '正しい'], visual: { type: 'circuit', equation: add.a + '＋' + add.b + '＝' + wrong }, hint: '逆の引き算で確かめよう。', explain: '正しくは' + add.result + 'なので故障あり。' };
    }
    if (role === 5) return numericChoice(add.b, '部品が合わせて' + add.result + 'こ。はじめに' + add.a + 'こあった。あとから届いたのは何こ？', visual, rng, { min: 0, max: 99, story: true, hint: '全部から、はじめの数を引こう。', explain: '届いたのは' + add.b + 'こ。' });
    if (role === 6) return numericInput(add.b, add.result + '−' + add.a + '＝□', { type: 'circuit', equation: add.result + '−' + add.a }, { bareCalculation: true, operation: false, hint: '足し算の逆向きだよ。', explain: '答えは' + add.b + '。' });
    return { kind: 'route', prompt: add.a + '＋' + add.b + 'の答えを確かめる式へつなごう。', correct: add.result + '−' + add.a, options: uniqueOptions(add.result + '−' + add.a, [add.result + '＋' + add.a, add.a + '−' + add.result], 2), visual, hint: '和から一方を引く回路。', explain: add.result + '−' + add.a + '＝' + add.b + '。' };
  }

  const WRITTEN_BUILDERS = [];
  WRITTEN_BUILDERS[0] = function (round, rng) { return twoDigitWritten(round, rng, addNoCarryPair, '2digit-no-carry'); };
  WRITTEN_BUILDERS[1] = function (round, rng) { return twoDigitWritten(round, rng, addRegroupPair, '2digit-regroup'); };
  WRITTEN_BUILDERS[2] = function (round, rng) { return twoDigitWritten(round, rng, subNoBorrowPair, '2digit-no-borrow'); };
  WRITTEN_BUILDERS[3] = function (round, rng) { return twoDigitWritten(round, rng, subRegroupPair, '2digit-borrow'); };
  WRITTEN_BUILDERS[4] = function (round, rng) { return WRITTEN_BUILDERS[[0, 1, 2, 3, 0, 1, 2, 3][round % 8]](round, rng); };
  WRITTEN_BUILDERS[5] = function (round, rng) { return extendedWritten(round, rng, addSum3Pair, 'sum-to-3digit'); };
  WRITTEN_BUILDERS[6] = function (round, rng) { return extendedWritten(round, rng, subFrom3Pair, 'sub-from-3digit'); };
  WRITTEN_BUILDERS[7] = function (round, rng) { return extendedWritten(round, rng, simple3Pair, 'simple-3digit'); };
  WRITTEN_BUILDERS[8] = writtenProperties;
  WRITTEN_BUILDERS[9] = writtenInverse;
  WRITTEN_BUILDERS[10] = function (round, rng) { return WRITTEN_BUILDERS[[0, 1, 2, 3, 5, 6, 8, 9][round % 8]](round, rng); };

  function multiplicationMath(a, b, mode) {
    return { kind: 'multiply', a, b, result: a * b, mode };
  }

  function equalGroupsVisual(a, b) {
    return { type: 'equal-groups', groups: b, perGroup: a, total: a * b };
  }

  function multiplicationEqualGroups(round, rng) {
    const perGroup = rand(2, 6, rng);
    const groups = rand(2, 6, rng);
    const total = perGroup * groups;
    const role = round % STAGE_ROUNDS;
    const visual = equalGroupsVisual(perGroup, groups);
    const math = multiplicationMath(perGroup, groups, 'equal-groups');
    if (role === 0) return { kind: 'sort', prompt: '「同じ数ずつ」の部品箱を選ぼう。', correct: perGroup + 'こずつ', options: [perGroup + 'こずつ', perGroup + 'こと' + (perGroup + 1) + 'こ'], visual: { type: 'sort', item: groups + '箱', bins: ['同じ数ずつ', 'ばらばら'] }, math, hint: 'どの箱にも同じ個数が入る形だよ。', explain: 'どの箱も' + perGroup + 'こずつなら同じ数ずつ。' };
    if (role === 1) return tapQuestion(perGroup, Math.min(20, total), total + 'この部品を同じ数ずつ' + groups + '箱にした。1箱分を選ぼう。', { type: 'selector', total: Math.min(20, total) }, { math, hint: groups + 'つへ同じになるように分けよう。', explain: '1箱は' + perGroup + 'こ。' });
    if (role === 2) return numericChoice(groups, total + 'こを' + perGroup + 'こずつ囲むと、まとまりはいくつ？', visual, rng, { min: 1, max: 10, math, hint: perGroup + 'こずつ区切ろう。', explain: groups + 'まとまりできるよ。' });
    if (role === 3) return orderedQuestion(['同じ数の箱を見つける', '一つ分を数える', '箱の数を数える'], 'まとまりを調べる順に並べよう。', visual, { math, hint: 'まず同じ数ずつかを確かめよう。', explain: '同じ数→一つ分→いくつ分の順。' });
    if (role === 4) return numericChoice(total, perGroup + 'こずつのまとまりが' + groups + 'こ。全部の数へ回路をつなごう。', visual, rng, { kind: 'route', min: 1, max: 50, math, hint: perGroup + 'を' + groups + '回足そう。', explain: '全部で' + total + 'こ。' });
    if (role === 5) return numericChoice(total, '整備車が' + groups + '台あり、どの車にも部品を' + perGroup + 'こずつ積んだ。全部で何こ？', visual, rng, { min: 1, max: 50, story: true, math, hint: perGroup + 'こずつを' + groups + '台分数えよう。', explain: '全部で' + total + 'こ。' });
    if (role === 6) return numericInput(total, Array(groups).fill(perGroup).join('＋') + '＝□', { type: 'circuit', equation: perGroup + 'を' + groups + '回' }, { bareCalculation: true, operation: false, math, hint: '同じ数を順に足そう。', explain: '答えは' + total + '。' });
    return { kind: 'choice', prompt: '「一つ分が' + perGroup + 'こ、いくつ分が' + groups + '」の図は？', correct: groups + '箱に' + perGroup + 'こずつ', options: uniqueOptions(groups + '箱に' + perGroup + 'こずつ', [perGroup + '箱に' + groups + 'こずつ', groups + '箱にばらばら'], 2), visual, math, hint: '一箱の数と箱の数を分けて読もう。', explain: groups + '箱に' + perGroup + 'こずつだね。' };
  }

  function multiplicationSceneExpression(round, rng) {
    const a = rand(2, 9, rng);
    const b = rand(2, 6, rng);
    const result = a * b;
    const expression = a + '×' + b;
    const role = round % STAGE_ROUNDS;
    const visual = equalGroupsVisual(a, b);
    const math = multiplicationMath(a, b, 'scene-expression');
    if (role === 0) return orderedQuestion([a + 'こずつ', b + '箱', expression], '場面カードを「一つ分→いくつ分→式」の順につなごう。', visual, { math, hint: '一つ分の数×いくつ分の順。', explain: a + 'こずつ、' + b + '箱だから' + expression + '。' });
    if (role === 1) return { kind: 'choice', prompt: a + 'こずつ入った箱が' + b + 'こ。表す式は？', correct: expression, options: uniqueOptions(expression, [b + '×' + a, a + '＋' + b, result + '×1'], 2), visual, math, hint: '一つ分の数を先に書くよ。', explain: '式は' + expression + '。' };
    if (role === 2) return { kind: 'route', prompt: expression + 'の読み方へ回路をつなごう。', correct: a + 'こずつを' + b + 'こ分', options: uniqueOptions(a + 'こずつを' + b + 'こ分', [b + 'こずつを' + a + 'こ分', a + 'こと' + b + 'こを合わせる'], 2), visual, math, hint: '前の数が一つ分、後ろがいくつ分。', explain: expression + 'は' + a + 'こずつを' + b + 'こ分。' };
    if (role === 3) return { kind: 'choice', prompt: expression + 'で「一つ分の数」はどれ？', correct: a, options: uniqueOptions(a, [b, result], 2), visual, math, hint: '×の前の数だよ。', explain: '一つ分は' + a + 'こ。' };
    if (role === 4) return tapQuestion(a, Math.min(20, result), '図の一つ分だけを選ぼう。', { type: 'selector', total: Math.min(20, result) }, { math, hint: '一箱に入る数だけ選ぶよ。', explain: '一つ分は' + a + 'こ。' });
    if (role === 5) return { kind: 'choice', prompt: 'ライトを1列に' + a + 'こずつ、' + b + '列つける。場面に合う式は？', correct: expression, options: uniqueOptions(expression, [b + '×' + a, a + '＋' + b], 2), visual, story: true, math, hint: '1列の数×列の数。', explain: '合う式は' + expression + '。' };
    if (role === 6) return numericInput(result, expression + '＝□', { type: 'circuit', equation: expression }, { bareCalculation: true, operation: false, math, hint: a + 'を' + b + '回足しても求められるよ。', explain: '答えは' + result + '。' });
    return { kind: 'choice', prompt: expression + 'と図のつながりで正しいものは？', correct: b + 'グループ', options: uniqueOptions(b + 'グループ', [a + 'グループ', result + 'グループ'], 2), visual, math, hint: '×の後ろの数がグループ数。', explain: b + 'グループを表しているよ。' };
  }

  function multiplicationArray(round, rng) {
    const a = rand(2, 6, rng);
    const b = rand(2, 6, rng);
    const result = a * b;
    const repeated = Array(b).fill(a).join('＋');
    const role = round % STAGE_ROUNDS;
    const visual = equalGroupsVisual(a, b);
    const math = multiplicationMath(a, b, 'array-repeated-add');
    if (role === 0) return tapQuestion(a, Math.min(20, result), b + '列のアレイから、1列分を点灯しよう。', { type: 'selector', total: Math.min(20, result) }, { math, hint: '一列に並ぶ' + a + 'こだけ選ぼう。', explain: '一列分は' + a + 'こ。' });
    if (role === 1) return { kind: 'choice', prompt: a + 'こが' + b + '列のアレイと同じ足し算は？', correct: repeated, options: uniqueOptions(repeated, [Array(a).fill(b).join('＋'), a + '＋' + b, result + '＋0'], 2), visual, math, hint: '一列の数を列の数だけ足すよ。', explain: repeated + '。' };
    if (role === 2) return { kind: 'route', prompt: 'このアレイを表すかけ算へつなごう。', correct: a + '×' + b, options: uniqueOptions(a + '×' + b, [b + '×' + a, a + '＋' + b], 2), visual, math, hint: '一列の数×列の数。', explain: a + '×' + b + 'と表すよ。' };
    if (role === 3) {
      const values = [a, a * 2, a * 3, a * 4].slice(0, Math.min(4, b + 1));
      return orderedQuestion(values, 'アレイを一列ずつ増やしたときの数を並べよう。', { type: 'number-line', values }, { math, hint: '一列増えるたび' + a + '増えるよ。', explain: values.join('、') + '。' });
    }
    if (role === 4) return numericSlider(result, '全部の点の数へメーターを合わせよう。', visual, { min: Math.max(0, result - a * 2), max: result + a * 2, step: a, math, hint: a + 'ずつ' + b + '列数えよう。', explain: '全部で' + result + 'こ。' });
    if (role === 5) return numericChoice(result, '部品を横一列に' + a + 'こずつ、' + b + '列並べた。全部で何こ？', visual, rng, { min: 1, max: 50, story: true, math, hint: a + 'こずつを' + b + '列。', explain: '全部で' + result + 'こ。' });
    if (role === 6) return numericInput(result, a + '×' + b + '＝□', { type: 'circuit', equation: a + '×' + b }, { bareCalculation: true, operation: false, math, hint: repeated + 'と考えよう。', explain: '答えは' + result + '。' });
    return { kind: 'choice', prompt: 'アレイを90度回したとき、同じ答えになる式は？', correct: b + '×' + a, options: uniqueOptions(b + '×' + a, [a + '＋' + b, result + '×1'], 2), visual, math, hint: '行と列が入れ替わるよ。', explain: b + '×' + a + 'も答えは' + result + '。' };
  }

  function multiplicationTable(round, rng, factors, mode) {
    const a = pick(factors, rng);
    const b = rand(1, 9, rng);
    const result = a * b;
    const role = round % STAGE_ROUNDS;
    const visual = equalGroupsVisual(a, b);
    const math = multiplicationMath(a, b, mode);
    if (role === 0) return tapQuestion(a, Math.min(20, Math.max(a, result)), a + 'の段の一つ分を点灯しよう。', { type: 'selector', total: Math.min(20, Math.max(a, result)) }, { math, hint: '一つ分は' + a + 'こ。', explain: a + 'こ選べたね。' });
    if (role === 1) {
      const startB = Math.max(1, Math.min(6, b));
      const values = [a * startB, a * (startB + 1), a * (startB + 2)];
      return orderedQuestion(values, a + 'の段を小さい順に並べよう。', { type: 'number-line', values }, { math, hint: '一つ進むたび' + a + '増えるよ。', explain: values.join('、') + '。' });
    }
    if (role === 2) {
      const nextFactor = b === 9 ? 8 : b + 1;
      const direction = b === 9 ? '一つ前' : 'つぎ';
      const change = b === 9 ? 'から' + a + 'を引こう。' : 'に' + a + 'を足そう。';
      return numericChoice(a * nextFactor, a + '×' + b + '＝' + result + '。' + direction + 'の積は？', { type: 'number-line', values: [result, '?'] }, rng, { kind: 'route', min: a, max: a * 9, step: a, math, hint: result + change, explain: direction + 'は' + (a * nextFactor) + '。' });
    }
    if (role === 3) return { kind: 'choice', prompt: a + '×' + b + 'を表すまとまりは？', correct: a + 'こずつ' + b + 'グループ', options: uniqueOptions(a + 'こずつ' + b + 'グループ', [b + 'こずつ' + a + 'グループ', a + 'こと' + b + 'こ'], 2), visual, math, hint: '一つ分×いくつ分の順。', explain: a + 'こずつ' + b + 'グループ。' };
    if (role === 4) return numericSlider(result, a + 'の段の積へ合わせよう。', visual, { min: Math.max(0, result - a * 2), max: Math.min(a * 9, result + a * 2), step: a, math, hint: a + 'ずつ増やそう。', explain: a + '×' + b + '＝' + result + '。' });
    if (role === 5) return numericChoice(result, '一箱に' + a + 'この部品を入れ、' + b + '箱作った。全部で何こ？', visual, rng, { min: 0, max: a * 9, story: true, math, hint: a + '×' + b + 'で求めよう。', explain: '全部で' + result + 'こ。' });
    if (role === 6) return numericInput(result, a + '×' + b + '＝□', { type: 'circuit', equation: a + '×' + b }, { bareCalculation: true, operation: false, math, hint: a + 'の段を思い出そう。', explain: '答えは' + result + '。' });
    const missing = b;
    return numericChoice(missing, a + '×□＝' + result + '。□は？', visual, rng, { min: 1, max: 9, math, hint: a + 'の段で' + result + 'になる場所。', explain: '□は' + missing + '。' });
  }

  function multiplicationSplit(round, rng) {
    const a = pick([6, 7], rng);
    const b = rand(3, 9, rng);
    const result = a * b;
    const split = b > 5 ? 5 : b - 1;
    const rest = b - split;
    const role = round % STAGE_ROUNDS;
    const visual = equalGroupsVisual(a, b);
    const math = multiplicationMath(a, b, 'split-array');
    if (role === 0) {
      const correct = a + '×' + split + ' と ' + a + '×' + rest;
      return { kind: 'choice', prompt: a + '×' + b + 'のアレイを' + split + '列と' + rest + '列に分けた式は？', correct, options: uniqueOptions(correct, [split + '×' + a + ' と ' + rest + '×' + a, a + '×' + b + ' と 1×' + b], 2), visual, math, hint: '一列の数' + a + 'は変わらないよ。', explain: correct + 'に分けられる。' };
    }
    if (role === 1) return orderedQuestion([a * split, a * rest, result], '二つの部分の積を出して、さいごに全体を選ぼう。', visual, { math, hint: '部分の積を足すと全体。', explain: (a * split) + '＋' + (a * rest) + '＝' + result + '。' });
    if (role === 2) return { kind: 'route', prompt: a + '×' + b + 'の分け算回路へつなごう。', correct: a + '×' + split + '＋' + a + '×' + rest, options: uniqueOptions(a + '×' + split + '＋' + a + '×' + rest, [a + '×' + split + '＋' + rest, a + '×' + (split + 1) + '＋' + a + '×' + rest], 2), visual, math, hint: b + 'を' + split + 'と' + rest + 'に分けるよ。', explain: '二つの積を足すと' + result + '。' };
    if (role === 3) return tapQuestion(rest, b, b + '列のうち、' + split + '列を使った残りを選ぼう。', { type: 'selector', total: b }, { math, hint: b + '−' + split + 'を考えよう。', explain: '残りは' + rest + '列。' });
    if (role === 4) return numericSlider(result, '分けたアレイを合流した積へ合わせよう。', visual, { min: Math.max(0, result - a * 2), max: result + a * 2, step: a, math, hint: (a * split) + 'と' + (a * rest) + 'を足そう。', explain: '積は' + result + '。' });
    if (role === 5) return numericChoice(result, '一列' + a + '席のベンチが' + b + '列ある。' + split + '列と残りに分けて数えると全部で何席？', visual, rng, { min: 0, max: 63, story: true, math, hint: a + '×' + split + 'と' + a + '×' + rest + 'を合わせよう。', explain: '全部で' + result + '席。' });
    if (role === 6) return numericInput(result, a + '×' + b + '＝□', { type: 'circuit', equation: a + '×' + split + '＋' + a + '×' + rest }, { bareCalculation: true, operation: false, math, hint: '知っている段へ分けよう。', explain: '答えは' + result + '。' });
    return { kind: 'choice', prompt: a + '×' + b + 'を分けて求めた正しい答えは？', correct: result, options: numberOptions(result, { min: 0, max: 63, step: a }, rng), visual, math, hint: '二つの部分の積を足そう。', explain: '答えは' + result + '。' };
  }

  function multiplicationProperties(round, rng) {
    const a = rand(2, 9, rng);
    const b = rand(2, 8, rng);
    const result = a * b;
    const role = round % STAGE_ROUNDS;
    const visual = equalGroupsVisual(a, b);
    const math = multiplicationMath(a, b, 'properties');
    if (role === 0) return { kind: 'choice', prompt: a + '×' + b + 'と同じ答えになる九九表の位置は？', correct: b + '×' + a, options: uniqueOptions(b + '×' + a, [a + '×' + (b + 1), Math.max(1, b - 1) + '×' + a], 2), visual, math, hint: '行と列を入れ替えた対称の位置。', explain: b + '×' + a + 'も' + result + '。' };
    if (role === 1) return numericChoice(result + a, a + '×' + b + '＝' + result + '。右へ1列増やすと？', { type: 'number-line', values: [result, result + a] }, rng, { kind: 'route', min: a, max: a * 9, step: a, math, hint: '一列分の' + a + 'を足そう。', explain: '積は' + (result + a) + '。' });
    if (role === 2) {
      const split = Math.min(5, b - 1);
      const rest = b - split;
      const correct = a + '×' + split + '＋' + a + '×' + rest;
      return { kind: 'choice', prompt: a + '×' + b + 'を二つに分ける式は？', correct, options: uniqueOptions(correct, [a + '×' + split + '＋' + rest, split + '×' + rest], 2), visual, math, hint: b + 'を' + split + 'と' + rest + 'に分けよう。', explain: correct + '。' };
    }
    if (role === 3) {
      const values = [a * Math.max(1, b - 1), result, result + a];
      return orderedQuestion(values, a + 'の段の前・いま・次を並べよう。', { type: 'number-line', values }, { math, hint: a + 'ずつ増えるよ。', explain: values.join('、') + '。' });
    }
    if (role === 4) return numericSlider(result, '九九表の交わる数へ合わせよう。', visual, { min: Math.max(0, result - a * 2), max: Math.min(81, result + a * 2), step: a, math, hint: a + 'の行と' + b + 'の列。', explain: '交わる数は' + result + '。' });
    if (role === 5) return numericChoice(result, '部品を' + a + 'こずつ' + b + '列に並べた。向きを変えても全部で何こ？', visual, rng, { min: 0, max: 81, story: true, math, hint: '向きを変えても部品の総数は同じ。', explain: '全部で' + result + 'こ。' });
    if (role === 6) return numericInput(result, a + '×' + b + '＝□', { type: 'circuit', equation: b + '×' + a + 'でも同じ' }, { bareCalculation: true, operation: false, math, hint: '入れ替えた九九でも確かめよう。', explain: '答えは' + result + '。' });
    return { kind: 'route', prompt: result + 'になる二つの九九をつなごう。', correct: a + '×' + b + ' と ' + b + '×' + a, options: uniqueOptions(a + '×' + b + ' と ' + b + '×' + a, [a + '×' + b + ' と ' + a + '×' + (b + 1)], 2), visual, math, hint: '交換しても積は同じ。', explain: '二つとも' + result + '。' };
  }

  function multiplicationBeyond(round, rng) {
    const a = rand(2, 9, rng);
    const b = rand(10, 12, rng);
    const result = a * b;
    const role = round % STAGE_ROUNDS;
    const visual = { type: 'equal-groups', groups: b, perGroup: a, total: result };
    const math = multiplicationMath(a, b, '10-to-12');
    if (role === 0) return tapQuestion(a, Math.min(20, result), b + '本の基準テープから、1本分の' + a + '目盛りを選ぼう。', { type: 'selector', total: Math.min(20, result) }, { math, hint: '一つ分は' + a + '。', explain: a + '目盛りが基準。' });
    if (role === 1) {
      const values = [a * 10, a * 11, a * 12];
      return orderedQuestion(values, a + '×10、×11、×12の順に積を並べよう。', { type: 'number-line', values }, { math, hint: '一つ進むたび' + a + '増える。', explain: values.join('、') + '。' });
    }
    if (role === 2) {
      const correct = a + '×10＋' + a + '×' + (b - 10);
      return { kind: 'route', prompt: a + '×' + b + 'を10こ分と残りへ分けた式は？', correct, options: uniqueOptions(correct, [a + '×10＋' + (b - 10), a + '×' + (b - 10)], 2), visual, math, hint: b + 'を10と' + (b - 10) + 'に分けよう。', explain: correct + '。' };
    }
    if (role === 3) return numericSlider(result, '10こ分から先へ増幅して答えを合わせよう。', { type: 'number-line', values: [a * 10, result] }, { min: a * 10, max: a * 12, step: a, math, hint: a + 'ずつ' + (b - 10) + '回進めよう。', explain: '積は' + result + '。' });
    if (role === 4) {
      const times = rand(2, 5, rng);
      const base = rand(2, 9, rng);
      return numericChoice(base * times, base + 'の' + times + '倍は？', { type: 'equal-groups', groups: times, perGroup: base, total: base * times }, rng, { min: 0, max: 45, math: multiplicationMath(base, times, 'times'), hint: base + 'を' + times + 'こ分。', explain: base * times + '。' });
    }
    if (role === 5) return numericChoice(result, '一列' + a + 'このライトを' + b + '列つける。10列と残りに分けて数えると全部で何こ？', visual, rng, { min: 0, max: 108, story: true, math, hint: a + '×10に残りの列を足そう。', explain: '全部で' + result + 'こ。' });
    if (role === 6) return numericInput(result, a + '×' + b + '＝□', { type: 'circuit', equation: a + '×10＋' + a + '×' + (b - 10) }, { bareCalculation: true, operation: false, math, hint: '×10から' + a + 'ずつ増やそう。', explain: '答えは' + result + '。' });
    return numericChoice(b, a + '×□＝' + result + '。□は？', visual, rng, { min: 1, max: 12, math, hint: a + '×10から続きを数えよう。', explain: '□は' + b + '。' });
  }

  const MULTIPLICATION_BUILDERS = [];
  MULTIPLICATION_BUILDERS[0] = multiplicationEqualGroups;
  MULTIPLICATION_BUILDERS[1] = multiplicationSceneExpression;
  MULTIPLICATION_BUILDERS[2] = multiplicationArray;
  MULTIPLICATION_BUILDERS[3] = function (round, rng) { return multiplicationTable(round, rng, [2, 5], 'tables-2-5'); };
  MULTIPLICATION_BUILDERS[4] = function (round, rng) { return MULTIPLICATION_BUILDERS[[0, 1, 2, 3, 0, 1, 2, 3][round % 8]](round, rng); };
  MULTIPLICATION_BUILDERS[5] = function (round, rng) { return multiplicationTable(round, rng, [3, 4], 'tables-3-4'); };
  MULTIPLICATION_BUILDERS[6] = multiplicationSplit;
  MULTIPLICATION_BUILDERS[7] = function (round, rng) { return multiplicationTable(round, rng, [8, 9, 1], 'tables-8-9-1'); };
  MULTIPLICATION_BUILDERS[8] = multiplicationProperties;
  MULTIPLICATION_BUILDERS[9] = multiplicationBeyond;
  MULTIPLICATION_BUILDERS[10] = function (round, rng) { return MULTIPLICATION_BUILDERS[[0, 1, 2, 3, 5, 6, 8, 9][round % 8]](round, rng); };

  const BUILDERS = Object.freeze({
    number: NUMBER_BUILDERS,
    written: WRITTEN_BUILDERS,
    multiplication: MULTIPLICATION_BUILDERS
  });

  function buildQuestion(lineId, stageRef, round, context) {
    const meta = resolveStage(lineId, stageRef);
    const ctx = context || {};
    const rng = typeof ctx.rng === 'function' ? ctx.rng : Math.random;
    const safeRound = Math.max(0, Math.floor(Number(round) || 0));
    const builder = BUILDERS[meta.lineId][meta.stageIndex];
    const draft = builder(safeRound, rng, ctx);
    return finalizeQuestion(draft, meta, rng);
  }

  function makeStageQuestions(lineId, stageRef, options) {
    const config = options || {};
    const meta = resolveStage(lineId, stageRef);
    const seed = config.seed == null ? Date.now() : config.seed;
    const rng = typeof config.rng === 'function' ? config.rng : seededRng(seed);
    const count = Math.max(1, Math.floor(Number(config.count) || STAGE_ROUNDS));
    const recent = new Set(config.exclude || []);
    const used = new Set();
    const questions = [];
    for (let round = 0; round < count; round += 1) {
      let question;
      let guard = 0;
      do {
        question = buildQuestion(meta.lineId, meta.stageIndex, round, { rng, variant: guard });
        guard += 1;
      } while ((used.has(question.signature) || recent.has(question.signature)) && guard < 80);
      if (used.has(question.signature) || recent.has(question.signature)) {
        question.signature += '-' + round + '-' + hashString(seed + ':' + guard);
      }
      used.add(question.signature);
      questions.push(question);
    }
    return { seed, gradeId: GRADE_ID, lineId: meta.lineId, stageId: meta.stage.id, questions };
  }

  function rushStageIds(lineId) {
    const normalized = normalizeLineId(lineId);
    const live = curriculumLine(normalized);
    if (live && Array.isArray(live.timeAttackStageIds) && live.timeAttackStageIds.length === TIME_ATTACK_ROUNDS) return live.timeAttackStageIds;
    return FALLBACK_RUSH[normalized];
  }

  function makeTimeAttackQuestions(lineId, options) {
    const config = options || {};
    const normalized = normalizeLineId(lineId);
    const seed = config.seed == null ? Date.now() : config.seed;
    const rng = typeof config.rng === 'function' ? config.rng : seededRng(seed);
    const recent = new Set(config.exclude || []);
    const used = new Set();
    const questions = [];
    const roles = [0, 1, 2, 3, 4, 6, 7, 2, 3, 4, 0, 1];
    rushStageIds(normalized).forEach(function (stageId, index) {
      let question;
      let guard = 0;
      do {
        question = buildQuestion(normalized, stageId, roles[index], { rng, rush: true, variant: guard });
        guard += 1;
      } while ((used.has(question.signature) || recent.has(question.signature)) && guard < 80);
      if (used.has(question.signature) || recent.has(question.signature)) question.signature += '-rush-' + index + '-' + hashString(seed + ':' + guard);
      question.rush = true;
      question.checkpoint = false;
      question.showHint = false;
      question.speedSafe = true;
      used.add(question.signature);
      questions.push(question);
    });
    return { seed, gradeId: GRADE_ID, lineId: normalized, questions: questions.slice(0, TIME_ATTACK_ROUNDS) };
  }

  function validate() {
    const errors = [];
    let generatedQuestions = 0;
    const samplesPerStage = 8;
    LINE_IDS.forEach(function (lineId, lineOffset) {
      const stages = stageList(lineId);
      if (stages.length !== 11) errors.push(lineId + ': expected 11 stages');
      stages.forEach(function (stage, stageIndex) {
        for (let sample = 0; sample < samplesPerStage; sample += 1) {
          const pack = makeStageQuestions(lineId, stage.id, { seed: 120000 + lineOffset * 10000 + stageIndex * 100 + sample });
          generatedQuestions += pack.questions.length;
          if (pack.questions.length !== STAGE_ROUNDS) errors.push(stage.id + ': expected 8 questions');
          if (new Set(pack.questions.map(function (question) { return question.signature; })).size !== pack.questions.length) errors.push(stage.id + ': duplicate signatures');
          const storyCount = pack.questions.filter(function (question) { return question.story; }).length;
          const bareCount = pack.questions.filter(function (question) { return question.bareCalculation; }).length;
          if (storyCount < 1 || storyCount > 2) errors.push(stage.id + ': story count ' + storyCount);
          if (bareCount > 1) errors.push(stage.id + ': too many bare calculations');
          pack.questions.forEach(function (question, questionIndex) {
            const label = stage.id + '@' + sample + '#' + (questionIndex + 1);
            if (!KNOWN_KINDS.includes(question.kind)) errors.push(label + ': unsupported kind ' + question.kind);
            ['gradeId', 'courseId', 'lineId', 'stageId', 'canonicalSkillId', 'signature', 'prompt', 'instruction', 'hint', 'explain'].forEach(function (key) {
              if (question[key] === '' || question[key] == null) errors.push(label + ': missing ' + key);
            });
            if ((stageIndex === 4 || stageIndex === 10) !== question.checkpoint) errors.push(label + ': checkpoint mismatch');
            if (['choice', 'route', 'sort'].includes(question.kind)) {
              const values = (question.options || []).map(optionValue).map(String);
              if (values.length < 2) errors.push(label + ': too few options');
              if (!values.includes(String(question.correct))) errors.push(label + ': correct option missing');
              if (new Set(values).size !== values.length) errors.push(label + ': duplicate options');
            }
            if (question.kind === 'order') {
              const values = (question.options || []).map(String);
              if (values.length < 2) errors.push(label + ': too few order cards');
              if (new Set(values).size !== values.length) errors.push(label + ': duplicate order cards');
              if (String(question.correct).split(',').length !== values.length) errors.push(label + ': incomplete order answer');
            }
            if (question.kind === 'input' && String(question.correct).length > 5) errors.push(label + ': keypad answer exceeds 5 digits');
          });
        }
      });
      for (let sample = 0; sample < 4; sample += 1) {
        const rush = makeTimeAttackQuestions(lineId, { seed: 99000 + lineOffset * 100 + sample });
        if (rush.questions.length !== TIME_ATTACK_ROUNDS) errors.push(lineId + ': expected 12 rush questions');
        if (!rush.questions.every(function (question) { return question.rush && !question.checkpoint; })) errors.push(lineId + ': invalid rush flags');
      }
    });
    return Object.freeze({ ok: errors.length === 0, errors: Object.freeze(errors), lineCount: LINE_IDS.length, stageCount: LINE_IDS.length * 11, samplesPerStage, generatedQuestions });
  }

  const STAGE_IDS = Object.freeze(LINE_IDS.reduce(function (result, lineId) {
    result[lineId] = Object.freeze(FALLBACK_STAGES[lineId].map(function (entry) { return entry[0]; }));
    return result;
  }, {}));

  global.HiramekiGrade2ArithmeticRuntime = Object.freeze({
    version: VERSION,
    gradeId: GRADE_ID,
    stageRounds: STAGE_ROUNDS,
    timeAttackRounds: TIME_ATTACK_ROUNDS,
    lineIds: LINE_IDS,
    stageIds: STAGE_IDS,
    knownKinds: KNOWN_KINDS,
    seededRng,
    questionSignature,
    buildQuestion,
    makeStageQuestions,
    makeTimeAttackQuestions,
    validate
  });
}(typeof globalThis !== 'undefined' ? globalThis : window));
