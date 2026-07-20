(function (global) {
  'use strict';

  const GRADE_ID = 'g2';
  const LINE_IDS = Object.freeze(['measure', 'shape', 'solve']);
  const STAGE_ROUNDS = 8;
  const TIME_ATTACK_ROUNDS = 12;
  const APP_KINDS = Object.freeze(['choice', 'route', 'sort', 'tap', 'remove', 'select', 'order', 'slider', 'clock']);

  function curriculum() {
    const value = global.HiramekiGrade2Curriculum;
    if (!value || !value.lines) throw new Error('HiramekiGrade2Curriculum must be loaded before the G2 world runtime.');
    return value;
  }

  function hashNumber(value) {
    let hash = 2166136261;
    const text = String(value);
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function hashString(value) {
    return hashNumber(value).toString(36);
  }

  function seededRng(seed) {
    let value = typeof seed === 'number' && Number.isFinite(seed) ? seed >>> 0 : hashNumber(seed);
    return function () {
      value += 0x6D2B79F5;
      let mixed = value;
      mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
      mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
      return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
    };
  }

  function rand(min, max, rng) {
    return Math.floor((rng || Math.random)() * (max - min + 1)) + min;
  }

  function pick(items, rng) {
    return items[rand(0, items.length - 1, rng)];
  }

  function shuffle(items, rng) {
    const copy = items.slice();
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor((rng || Math.random)() * (index + 1));
      const saved = copy[index];
      copy[index] = copy[swapIndex];
      copy[swapIndex] = saved;
    }
    return copy;
  }

  function optionValue(option) {
    return typeof option === 'object' && option !== null ? option.value : option;
  }

  function numberChoices(correct, min, max, count, rng) {
    const values = new Set([correct]);
    const offsets = shuffle([-100, -50, -20, -10, -5, -3, -2, -1, 1, 2, 3, 5, 10, 20, 50, 100], rng);
    let cursor = 0;
    while (values.size < (count || 4) && cursor < offsets.length) {
      const candidate = Math.max(min, Math.min(max, Number(correct) + offsets[cursor]));
      values.add(candidate);
      cursor += 1;
    }
    while (values.size < (count || 4)) values.add(rand(min, max, rng));
    return shuffle(Array.from(values), rng);
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
      story: Boolean(question.story)
    };
    return hashString(JSON.stringify(semantic));
  }

  function finalizeQuestion(data, rng) {
    const question = Object.assign({
      kind: 'choice',
      prompt: '',
      instruction: 'こたえを えらぼう',
      correct: '',
      options: [],
      hint: '図と数を もういちど たしかめよう。',
      explain: '',
      visual: { type: 'machine' },
      story: false,
      bareCalculation: false,
      formulaOnly: false,
      checkpoint: false,
      speedSafe: true,
      input: '',
      selected: [],
      orderSelected: [],
      attempts: 0,
      feedback: null,
      showHint: false
    }, data || {});
    if (!APP_KINDS.includes(question.kind)) throw new Error('Unsupported G2 question kind: ' + question.kind);
    if (question.options && question.options.length) {
      question.options = question.optionPolicy === 'fixed'
        ? question.options.slice()
        : shuffle(question.options, rng);
    }
    question.signature = questionSignature(question);
    return question;
  }

  function numericQuestion(config, rng) {
    const correct = Number(config.correct);
    const min = config.min == null ? 0 : Number(config.min);
    const max = config.max == null ? Math.max(20, correct + 5) : Number(config.max);
    return finalizeQuestion(Object.assign({
      kind: config.kind || 'slider',
      correct,
      min,
      max,
      step: config.step || 1,
      input: config.start == null ? min : config.start,
      options: numberChoices(correct, min, max, 4, rng)
    }, config), rng);
  }

  function choiceQuestion(config, rng) {
    return finalizeQuestion(Object.assign({ kind: 'choice' }, config), rng);
  }

  function tapQuestion(config, rng) {
    return finalizeQuestion(Object.assign({
      kind: 'tap',
      input: 0,
      instruction: String(config.correct) + 'こ えらんで「けってい」'
    }, config), rng);
  }

  function slotFor(round, context) {
    const slot = ((Number(round) || 0) % STAGE_ROUNDS + STAGE_ROUNDS) % STAGE_ROUNDS;
    return context && context.rush ? slot % 6 : slot;
  }

  function isStorySlot(slot, context) {
    return slot === 6 && !(context && context.rush);
  }

  function isFormulaSlot(slot, context) {
    return slot === 7 && !(context && context.rush);
  }

  function lineFor(lineId) {
    if (!LINE_IDS.includes(lineId)) throw new RangeError('Unknown G2 world line: ' + lineId);
    const line = curriculum().lines[lineId];
    if (!line) throw new RangeError('Missing G2 curriculum line: ' + lineId);
    return line;
  }

  function resolveStage(line, stageRef) {
    let index = -1;
    if (typeof stageRef === 'number' && Number.isInteger(stageRef)) index = stageRef;
    else if (typeof stageRef === 'string') index = line.stages.findIndex(function (stage) { return stage.id === stageRef; });
    else if (stageRef && typeof stageRef === 'object' && typeof stageRef.id === 'string') {
      index = line.stages.findIndex(function (stage) { return stage.id === stageRef.id; });
    }
    if (index < 0 || index >= line.stages.length) throw new RangeError('Unknown stage for ' + line.id + ': ' + stageRef);
    return { stage: line.stages[index], index };
  }

  function retag(question, extra) {
    Object.assign(question, extra || {});
    question.signature = questionSignature(question);
    return question;
  }

  function relationOptions(correct) {
    return ['＜', '＝', '＞'].includes(correct) ? ['＜', '＝', '＞'] : [];
  }

  function buildMeasureQuestion(stageIndex, round, rng, context) {
    const slot = slotFor(round, context);
    const stage = lineFor('measure').stages[stageIndex];

    if (stageIndex === 0) {
      const objects = [
        { name: 'けしゴム', estimate: 5, tool: '15cmものさし' },
        { name: 'えんぴつ', estimate: 17, tool: '30cmものさし' },
        { name: 'ノートのたて', estimate: 26, tool: '30cmものさし' },
        { name: 'カードのよこ', estimate: 9, tool: '15cmものさし' }
      ];
      const item = pick(objects, rng);
      if (isStorySlot(slot, context)) {
        return choiceQuestion({
          prompt: 'モクモは ' + item.name + 'を、だれが測っても同じ数で伝えたい。何を使う？',
          correct: item.tool,
          options: [item.tool, '手のひら', 'えんぴつ何本分'],
          visual: { type: 'tools', scene: item.name + 'の長さを共有する' },
          hint: '人によって大きさが変わらない道具を選ぼう。',
          explain: item.tool + 'なら、cmで同じ長さを伝えられるよ。',
          story: true
        }, rng);
      }
      if (slot % 2 === 0) {
        return choiceQuestion({
          kind: 'sort',
          prompt: item.name + 'を 測る道具は？',
          correct: item.tool,
          options: ['15cmものさし', '30cmものさし', '1cmブロック'],
          visual: { type: 'tools', scene: item.name },
          hint: 'はかる物より少し長く、目盛りのある道具が便利だよ。',
          explain: item.name + 'には ' + item.tool + 'が使いやすいね。'
        }, rng);
      }
      return numericQuestion({
        kind: slot % 3 === 0 ? 'slider' : 'route',
        prompt: item.name + 'の長さの よそうとして近いのは？',
        correct: item.estimate,
        min: 1,
        max: 30,
        start: Math.max(1, item.estimate - 3),
        visual: { type: 'length', left: item.estimate, right: 10, aligned: true },
        hint: '1cmくらいの幅を思いうかべよう。',
        explain: item.name + 'は およそ' + item.estimate + 'cmと考えられるよ。'
      }, rng);
    }

    if (stageIndex === 1) {
      const startMark = slot % 3 === 0 ? rand(1, 4, rng) : 0;
      const length = rand(3, 15, rng);
      const endMark = startMark + length;
      if (isStorySlot(slot, context)) {
        return numericQuestion({
          kind: 'slider',
          prompt: '工作で使うテープを、0の目盛りから' + endMark + 'cmまで切る。長さは何cm？',
          correct: endMark,
          min: 0,
          max: 20,
          start: Math.max(0, endMark - 2),
          visual: { type: 'unit-length', count: endMark },
          hint: '端を0にそろえ、終わりの目盛りを読もう。',
          explain: '0から' + endMark + 'までなので、' + endMark + 'cmだよ。',
          story: true
        }, rng);
      }
      if (startMark === 0 && slot % 2 === 0) {
        return tapQuestion({
          prompt: endMark + 'cmのところまで 目盛りを点灯しよう。',
          correct: endMark,
          visual: { type: 'unit-length', count: 20 },
          hint: '0から一目盛りずつ数えよう。',
          explain: endMark + 'こ分で' + endMark + 'cmだよ。'
        }, rng);
      }
      return numericQuestion({
        kind: 'route',
        prompt: 'ものさしの' + startMark + 'cmから' + endMark + 'cmまで。長さは？',
        correct: length,
        min: 0,
        max: 20,
        visual: { type: 'number-line', values: [startMark, '…', endMark] },
        hint: '終わりの目盛りから、始まりの目盛りを引こう。',
        explain: endMark + '−' + startMark + '＝' + length + 'で、' + length + 'cm。',
        math: { kind: 'subtract', a: endMark, b: startMark, result: length }
      }, rng);
    }

    if (stageIndex === 2) {
      if (isFormulaSlot(slot, context)) {
        return numericQuestion({
          kind: 'route',
          prompt: '1cm ＝ □mm',
          correct: 10,
          min: 0,
          max: 20,
          visual: { type: 'circuit', equation: '1cm ＝ □mm' },
          hint: '1cmを10こに同じように分けた一つが1mm。',
          explain: '1cm＝10mmだよ。',
          bareCalculation: true,
          formulaOnly: true
        }, rng);
      }
      const cm = rand(1, 8, rng);
      const mm = rand(1, 9, rng);
      const total = cm * 10 + mm;
      if (isStorySlot(slot, context)) {
        return numericQuestion({
          kind: 'route',
          prompt: '小さなねじの長さは' + cm + 'cm' + mm + 'mm。全部で何mm？',
          correct: total,
          min: 10,
          max: 99,
          visual: { type: 'length', left: cm * 2, right: mm, aligned: true },
          hint: cm + 'cmを' + (cm * 10) + 'mmにしよう。',
          explain: (cm * 10) + 'mmと' + mm + 'mmで' + total + 'mm。',
          story: true
        }, rng);
      }
      if (slot % 2 === 0) {
        const wrongCm = cm % 8 + 1;
        return choiceQuestion({
          kind: 'route',
          prompt: total + 'mmと同じ長さは？',
          correct: cm + 'cm' + mm + 'mm',
          options: [cm + 'cm' + mm + 'mm', wrongCm + 'cm' + mm + 'mm', total + 'cm'],
          visual: { type: 'number-line', values: [cm + 'cm', mm + 'mm', total + 'mm'] },
          hint: '10mmごとに1cmへまとめよう。',
          explain: total + 'mm＝' + cm + 'cm' + mm + 'mmだよ。'
        }, rng);
      }
      return numericQuestion({
        kind: 'slider',
        prompt: cm + 'cm' + mm + 'mmは、全部で何mm？',
        correct: total,
        min: 0,
        max: 99,
        start: cm * 10,
        visual: { type: 'unit-length', count: Math.min(20, cm + mm) },
        hint: '1cm＝10mmを使おう。',
        explain: cm + '×10＋' + mm + '＝' + total + 'mm。'
      }, rng);
    }

    if (stageIndex === 3) {
      const first = rand(3, 14, rng);
      const second = rand(2, 9, rng);
      const add = slot % 2 === 0;
      const answer = add ? first + second : first;
      const whole = add ? answer : first + second;
      if (isFormulaSlot(slot, context)) {
        return numericQuestion({
          kind: 'route',
          prompt: first + 'cm ＋ ' + second + 'cm ＝ □cm',
          correct: first + second,
          min: 0,
          max: 30,
          visual: { type: 'three-step', values: [first, second, 0], ops: ['+', '+'] },
          hint: '単位が同じなので、数を足そう。',
          explain: first + '＋' + second + '＝' + (first + second) + 'cm。',
          bareCalculation: true,
          formulaOnly: true
        }, rng);
      }
      if (isStorySlot(slot, context)) {
        return numericQuestion({
          kind: 'slider',
          prompt: first + 'cmの青い線と' + second + 'cmの黄色い線をつなぐ。全体は何cm？',
          correct: first + second,
          min: 0,
          max: 30,
          start: first,
          visual: { type: 'length', left: first, right: second, aligned: true },
          hint: '二本をつなぐので足し算だね。',
          explain: first + '＋' + second + '＝' + (first + second) + 'cm。',
          story: true,
          math: { kind: 'add', a: first, b: second, result: first + second }
        }, rng);
      }
      if (slot % 3 === 0) {
        const start = rand(1, 4, rng);
        const lineLength = rand(4, 12, rng);
        return numericQuestion({
          kind: 'route',
          prompt: start + 'cmの点から、' + lineLength + 'cmの直線を引く。終わりの目盛りは？',
          correct: start + lineLength,
          min: 0,
          max: 25,
          visual: { type: 'number-line', values: [start, '→ ' + lineLength + 'cm', '?'] },
          hint: '始まりの目盛りに、直線の長さを足そう。',
          explain: start + '＋' + lineLength + '＝' + (start + lineLength) + '。'
        }, rng);
      }
      return numericQuestion({
        kind: slot % 2 === 0 ? 'slider' : 'route',
        prompt: add ? '長さ' + first + 'cmと' + second + 'cmをつなぐと？' : '長さ' + whole + 'cmから' + second + 'cm切ると？',
        correct: answer,
        min: 0,
        max: 30,
        start: add ? first : whole,
        visual: { type: 'length', left: add ? first : whole, right: second, aligned: true },
        hint: add ? 'つなぐので足そう。' : '切り取るので引こう。',
        explain: add ? first + '＋' + second + '＝' + answer + 'cm。' : whole + '−' + second + '＝' + answer + 'cm。',
        math: { kind: add ? 'add' : 'subtract', a: add ? first : whole, b: second, result: answer }
      }, rng);
    }

    if (stageIndex === 4) {
      const sourceIndexes = [0, 1, 2, 3, 0, 1, 2, 3];
      const source = buildMeasureQuestion(sourceIndexes[slot], round, rng, context);
      return retag(source, { checkpoint: true, assessmentFor: stage.canonicalSkillId });
    }

    if (stageIndex === 5) {
      if (isFormulaSlot(slot, context)) {
        return numericQuestion({
          kind: 'route',
          prompt: '1L ＝ □dL',
          correct: 10,
          min: 0,
          max: 20,
          visual: { type: 'circuit', equation: '1L ＝ □dL' },
          hint: '1Lますは、1dLカップ10はい分。',
          explain: '1L＝10dLだよ。',
          bareCalculation: true,
          formulaOnly: true
        }, rng);
      }
      const liters = rand(1, 3, rng);
      const dl = rand(1, 9, rng);
      const totalDl = liters * 10 + dl;
      if (isStorySlot(slot, context)) {
        return numericQuestion({
          kind: 'route',
          prompt: 'タンクに' + liters + 'Lと' + dl + 'dLの水を入れた。全部で何dL？',
          correct: totalDl,
          min: 0,
          max: 40,
          visual: { type: 'capacity', left: liters * 3, right: dl },
          hint: liters + 'Lを' + (liters * 10) + 'dLにしよう。',
          explain: (liters * 10) + 'dL＋' + dl + 'dL＝' + totalDl + 'dL。',
          story: true
        }, rng);
      }
      if (slot % 2 === 0) {
        const target = rand(2, 10, rng);
        return tapQuestion({
          prompt: '1dLカップで' + target + 'dL入れよう。',
          correct: target,
          visual: { type: 'unit-length', count: 10, icons: ['◒'] },
          hint: '一つが1dL。必要な数だけ選ぼう。',
          explain: target + 'はいで' + target + 'dLだよ。'
        }, rng);
      }
      const wrongLiters = liters % 3 + 1;
      return choiceQuestion({
        kind: 'route',
        prompt: totalDl + 'dLと同じかさは？',
        correct: liters + 'L' + dl + 'dL',
        options: [liters + 'L' + dl + 'dL', wrongLiters + 'L' + dl + 'dL', totalDl + 'L'],
        visual: { type: 'capacity', left: liters * 3, right: dl },
        hint: '10dLずつ1Lへまとめよう。',
        explain: totalDl + 'dL＝' + liters + 'L' + dl + 'dL。'
      }, rng);
    }

    if (stageIndex === 6) {
      if (isFormulaSlot(slot, context)) {
        const relation = pick([{ text: '1dL ＝ □mL', answer: 100 }, { text: '1L ＝ □mL', answer: 1000 }], rng);
        return choiceQuestion({
          kind: 'route',
          prompt: relation.text,
          correct: relation.answer,
          options: relation.answer === 100 ? [10, 100, 1000] : [100, 500, 1000],
          visual: { type: 'circuit', equation: relation.text },
          hint: relation.answer === 100 ? '1dLは100mL。' : '1Lは1000mL。',
          explain: relation.text.replace('□', relation.answer) + 'だよ。',
          bareCalculation: true,
          formulaOnly: true
        }, rng);
      }
      const amounts = [100, 200, 300, 500, 600, 800];
      const amount = pick(amounts, rng);
      if (isStorySlot(slot, context)) {
        const add = pick([100, 200], rng);
        return numericQuestion({
          kind: 'route',
          prompt: 'ボトルに' + amount + 'mL、あとから' + add + 'mL入れた。全部で何mL？',
          correct: amount + add,
          min: 0,
          max: 1000,
          step: 100,
          start: amount,
          visual: { type: 'capacity', left: amount / 100, right: add / 100 },
          hint: 'どちらもmLなので、そのまま足せるよ。',
          explain: amount + '＋' + add + '＝' + (amount + add) + 'mL。',
          story: true,
          math: { kind: 'add', a: amount, b: add, result: amount + add }
        }, rng);
      }
      if (slot % 2 === 0) {
        const label = amount === 1000 ? '1L' : amount + 'mL';
        return choiceQuestion({
          prompt: '容器の目盛りが' + amount + 'mL。正しい読み方は？',
          correct: label,
          options: [label, amount + 'dL', amount + 'L'],
          visual: { type: 'capacity', left: amount / 100, right: 10 },
          hint: '容器に書かれたmLの単位もいっしょに読もう。',
          explain: amount + 'mLと読むよ。'
        }, rng);
      }
      const dl = amount / 100;
      return choiceQuestion({
        kind: 'route',
        prompt: amount + 'mLは何dL？',
        correct: dl,
        options: numberChoices(dl, 1, 10, 4, rng),
        visual: { type: 'number-line', values: ['100mL', '…', amount + 'mL'] },
        hint: '100mLが1dLだよ。',
        explain: amount + 'mL＝' + dl + 'dL。'
      }, rng);
    }

    if (stageIndex === 7) {
      const hour = rand(7, 10, rng);
      const startMinute = pick([0, 10, 20, 30, 40], rng);
      const duration = pick([10, 20, 30], rng);
      const total = hour * 60 + startMinute + duration;
      const endHour = Math.floor(total / 60);
      const endMinute = total % 60;
      const answer = endHour + ':' + String(endMinute).padStart(2, '0');
      if (isStorySlot(slot, context)) {
        return finalizeQuestion({
          kind: 'clock',
          prompt: hour + ':' + String(startMinute).padStart(2, '0') + 'に読書を始め、' + duration + '分読んだ。終わる時刻に合わせよう。',
          correct: answer,
          input: hour + ':' + String((startMinute + 50) % 60).padStart(2, '0'),
          clockStep: 10,
          visual: { type: 'clock', hour: endHour, minute: endMinute },
          hint: '長い針を' + duration + '分進めよう。',
          explain: '終わる時刻は' + answer + '。動いた長さが' + duration + '分だよ。',
          story: true
        }, rng);
      }
      if (slot % 3 === 0) {
        return choiceQuestion({
          kind: 'sort',
          prompt: '「9時20分」は時刻。「20分間」はどちら？',
          correct: '時間',
          options: ['時刻', '時間'],
          visual: { type: 'tools', scene: '9:20 ／ 20分間' },
          hint: 'いつ、を表すか、どれだけ、を表すか考えよう。',
          explain: '20分間は、どれだけ続いたかを表す「時間」だよ。'
        }, rng);
      }
      if (slot % 3 === 1) {
        return numericQuestion({
          kind: 'route',
          prompt: hour + ':' + String(startMinute).padStart(2, '0') + 'から' + answer + 'まで、何分？',
          correct: duration,
          min: 0,
          max: 60,
          step: 10,
          visual: { type: 'number-line', values: [hour + ':' + String(startMinute).padStart(2, '0'), '→', answer] },
          hint: '長い針が進んだ目盛りを数えよう。',
          explain: duration + '分進んでいるよ。'
        }, rng);
      }
      return finalizeQuestion({
        kind: 'clock',
        prompt: hour + ':' + String(startMinute).padStart(2, '0') + 'から' + duration + '分後へ、時計を進めよう。',
        correct: answer,
        input: hour + ':' + String(startMinute).padStart(2, '0'),
        clockStep: 10,
        visual: { type: 'clock', hour: endHour, minute: endMinute },
        hint: '長い針を' + duration + '分ぶん進めよう。',
        explain: duration + '分後は' + answer + 'だよ。'
      }, rng);
    }

    if (stageIndex === 8) {
      const schedules = [
        ['7:00 おきる', '8:00 とうこう', '12:00 ひるごはん', '19:00 ばんごはん'],
        ['6:30 おきる', '8:30 学校', '15:30 げこう', '21:00 ねる']
      ];
      const schedule = pick(schedules, rng);
      if (isStorySlot(slot, context)) {
        return choiceQuestion({
          prompt: '正午に昼ごはんを食べ、3時間後におやつを食べる。おやつは？',
          correct: '午後3時',
          options: ['午前3時', '午後3時', '午後12時'],
          visual: { type: 'number-line', values: ['正午', '＋3時間', '?'] },
          hint: '正午からあとは午後だよ。',
          explain: '正午の3時間後は午後3時。',
          story: true
        }, rng);
      }
      if (slot % 3 === 0) {
        return finalizeQuestion({
          kind: 'order',
          prompt: '一日の予定を 早いじゅんにつなごう。',
          instruction: '時刻の早いカードからタップして「けってい」',
          correct: schedule.join(','),
          options: shuffle(schedule, rng),
          visual: { type: 'rail', values: ['朝', '昼', '夜'] },
          hint: '朝から夜へ、時計の時刻を見て並べよう。',
          explain: schedule.join(' → ') + 'の順だよ。'
        }, rng);
      }
      if (slot % 3 === 1) {
        const event = pick([{ text: '朝7時', answer: '午前7時' }, { text: '夜7時', answer: '午後7時' }, { text: '昼12時', answer: '正午' }], rng);
        return choiceQuestion({
          kind: 'sort',
          prompt: event.text + 'を正しく表すと？',
          correct: event.answer,
          options: ['午前7時', '午後7時', '正午'],
          visual: { type: 'clock', label: event.text },
          hint: '正午より前は午前、あとは午後だよ。',
          explain: event.text + 'は' + event.answer + '。'
        }, rng);
      }
      return choiceQuestion({
        kind: 'route',
        prompt: '一日は何時間？',
        correct: 24,
        options: [12, 24, 60],
        visual: { type: 'number-line', values: ['午前0時', '正午', '午後12時'] },
        hint: '午前12時間と午後12時間を合わせよう。',
        explain: '12時間＋12時間で、一日は24時間。'
      }, rng);
    }

    if (stageIndex === 9) {
      if (isFormulaSlot(slot, context)) {
        return choiceQuestion({
          kind: 'route',
          prompt: '1m ＝ □cm',
          correct: 100,
          options: [10, 100, 1000],
          visual: { type: 'circuit', equation: '1m ＝ □cm' },
          hint: '1mものさしには1cmが100こあるよ。',
          explain: '1m＝100cmだよ。',
          bareCalculation: true,
          formulaOnly: true
        }, rng);
      }
      const meters = rand(1, 4, rng);
      const cm = pick([10, 20, 30, 40, 50], rng);
      const totalCm = meters * 100 + cm;
      if (isStorySlot(slot, context)) {
        return choiceQuestion({
          kind: 'route',
          prompt: 'ロープは' + meters + 'm' + cm + 'cm。全部で何cm？',
          correct: totalCm,
          options: numberChoices(totalCm, 100, 500, 4, rng),
          visual: { type: 'length', left: meters * 3, right: cm / 10, aligned: true },
          hint: meters + 'mを' + (meters * 100) + 'cmにしよう。',
          explain: (meters * 100) + '＋' + cm + '＝' + totalCm + 'cm。',
          story: true
        }, rng);
      }
      if (slot % 3 === 0) {
        const useM = pick([true, false], rng);
        const object = useM ? pick(['教室のよこ', '廊下', 'なわとび']) : pick(['ノート', 'えんぴつ', 'けしゴム']);
        return choiceQuestion({
          kind: 'sort',
          prompt: object + 'の長さを表すのに使いやすい単位は？',
          correct: useM ? 'm' : 'cm',
          options: ['mm', 'cm', 'm'],
          visual: { type: 'tools', scene: object },
          hint: '長いものにはm、手もとの小物にはcmが便利。',
          explain: object + 'には' + (useM ? 'm' : 'cm') + 'が使いやすいよ。'
        }, rng);
      }
      if (slot % 3 === 1) {
        return choiceQuestion({
          kind: 'route',
          prompt: totalCm + 'cmと同じ長さは？',
          correct: meters + 'm' + cm + 'cm',
          options: [meters + 'm' + cm + 'cm', cm + 'm' + meters + 'cm', totalCm + 'm'],
          visual: { type: 'number-line', values: [meters + 'm', cm + 'cm', totalCm + 'cm'] },
          hint: '100cmずつmへまとめよう。',
          explain: totalCm + 'cm＝' + meters + 'm' + cm + 'cm。'
        }, rng);
      }
      const estimate = pick([2, 3, 4, 5], rng);
      return numericQuestion({
        kind: 'slider',
        prompt: '教室のドアの高さをmで予想しよう。近いのは？',
        correct: 2,
        min: 1,
        max: 8,
        start: estimate === 2 ? 3 : estimate,
        visual: { type: 'length', left: 6, right: 2, aligned: true },
        hint: '大人の背の高さと比べてみよう。',
        explain: 'ドアの高さは、およそ2mと考えられるよ。'
      }, rng);
    }

    const sourceIndexes = [0, 2, 5, 6, 7, 8, 9, 9];
    const source = buildMeasureQuestion(sourceIndexes[slot], round, rng, context);
    return retag(source, { checkpoint: true, assessmentFor: stage.canonicalSkillId });
  }

  function buildShapeQuestion(stageIndex, round, rng, context) {
    const slot = slotFor(round, context);
    const stage = lineFor('shape').stages[stageIndex];

    if (stageIndex === 0) {
      const cases = [
        { icon: '△', label: '3本の直線で閉じた形', answer: '直線で囲まれている' },
        { icon: '□', label: '4本の直線で閉じた形', answer: '直線で囲まれている' },
        { icon: '∩', label: '下が開いた形', answer: '囲まれていない' },
        { icon: '○', label: '曲線で閉じた形', answer: '曲線をふくむ' },
        { icon: '⌜', label: '端がつながっていない形', answer: '囲まれていない' }
      ];
      const item = pick(cases, rng);
      if (isStorySlot(slot, context)) {
        return choiceQuestion({
          kind: 'sort',
          prompt: '畑をまっすぐな柵で囲みたい。使える設計図はどれ？',
          correct: '直線で閉じた形',
          options: ['直線で閉じた形', '一か所開いた形', '曲線だけの形'],
          visual: { type: 'sort', item: '柵の設計図', bins: ['閉じる', '開いている'] },
          hint: 'まっすぐな線の端と端が全部つながる形を選ぼう。',
          explain: '直線で閉じた形なら、すき間なく囲めるね。',
          story: true
        }, rng);
      }
      if (slot % 2 === 0) {
        return choiceQuestion({
          kind: 'sort',
          prompt: item.label + 'を仕分けよう。',
          correct: item.answer,
          options: ['直線で囲まれている', '囲まれていない', '曲線をふくむ'],
          visual: { type: 'sort', item: item.icon, bins: ['直線で囲む', '開いている', '曲線'] },
          hint: '線がまっすぐか、端が全部つながるかを見よう。',
          explain: item.icon + 'は「' + item.answer + '」形だよ。'
        }, rng);
      }
      const closed = pick([true, false], rng);
      return choiceQuestion({
        kind: 'route',
        prompt: closed ? '直線の端をつないで、囲みを完成するには？' : 'この形が囲みにならない理由は？',
        correct: closed ? '開いた2つの端をつなぐ' : '端と端がつながっていない',
        options: closed ? ['開いた2つの端をつなぐ', '曲線を一本足す', '線を一本消す'] : ['端と端がつながっていない', '直線が3本ある', '向きがななめ'],
        visual: { type: 'solid-scan', icon: closed ? '⌜_' : '∩' },
        hint: '囲みは、どこにも出口がない形だよ。',
        explain: closed ? '開いた端をつなぐと囲みが完成するよ。' : '端がつながらないと囲みにはならないよ。'
      }, rng);
    }

    if (stageIndex === 1) {
      const shapes = [
        { icon: '△', edges: 3, answer: '三角形' },
        { icon: '▽', edges: 3, answer: '三角形' },
        { icon: '□', edges: 4, answer: '四角形' },
        { icon: '◇', edges: 4, answer: '四角形' },
        { icon: '○', edges: 0, answer: 'どちらでもない' },
        { icon: '⌜', edges: 2, answer: 'どちらでもない' }
      ];
      const item = pick(shapes, rng);
      if (isStorySlot(slot, context)) {
        return choiceQuestion({
          kind: 'sort',
          prompt: '3本のまっすぐな棒で、すき間なく囲んだ名札を作った。何という形？',
          correct: '三角形',
          options: ['三角形', '四角形', '円'],
          visual: { type: 'sticks', target: '三角形', total: 3 },
          hint: '何本の直線で囲まれているか数えよう。',
          explain: '3本の直線で囲まれた形は三角形。',
          story: true
        }, rng);
      }
      if (slot % 3 === 0) {
        return tapQuestion({
          prompt: item.answer === 'どちらでもない' ? 'この形の直線を数えよう。' : item.answer + 'の辺を一本ずつ点灯しよう。',
          correct: item.edges,
          visual: { type: 'sticks', total: Math.max(4, item.edges), target: item.icon },
          hint: '形を囲むまっすぐな線を数えよう。',
          explain: item.icon + 'には直線が' + item.edges + '本見えるよ。'
        }, rng);
      }
      return choiceQuestion({
        kind: 'sort',
        prompt: item.icon + 'を どの棚へ入れる？',
        correct: item.answer,
        options: ['三角形', '四角形', 'どちらでもない'],
        visual: { type: 'sort', item: item.icon, bins: ['三角形', '四角形', 'ほか'] },
        hint: '直線で囲まれているか、辺が何本かを見よう。',
        explain: item.edges ? item.edges + '本の直線で囲まれているので' + item.answer + '。' : '曲線や開いた線は三角形・四角形ではないよ。'
      }, rng);
    }

    if (stageIndex === 2) {
      const isTriangle = pick([true, false], rng);
      const count = isTriangle ? 3 : 4;
      const part = pick(['辺', '頂点'], rng);
      const icon = pick(isTriangle ? ['△', '▽', '◁', '▷'] : ['□', '◇', '▱', '▰'], rng);
      const frame = pick(['青い', '黄色い', '光る', '予備の'], rng);
      if (isStorySlot(slot, context)) {
        const storyTriangle = pick([true, false], rng);
        const storyCount = storyTriangle ? 3 : 4;
        return tapQuestion({
          prompt: (storyTriangle ? '三角形' : '四角形') + 'のフレームを作る。角のコネクターは何こ必要？',
          correct: storyCount,
          visual: { type: 'sticks', total: storyCount, target: (storyTriangle ? '三角形' : '四角形') + 'の頂点' },
          hint: '直線と直線が出会うところが頂点だよ。',
          explain: (storyTriangle ? '三角形' : '四角形') + 'には頂点が' + storyCount + 'こあるので、コネクターも' + storyCount + 'こ。',
          story: true
        }, rng);
      }
      if (slot % 3 === 0 || slot % 3 === 1) {
        return tapQuestion({
          prompt: frame + (isTriangle ? '三角形' : '四角形') + 'の' + part + 'を点灯しよう。',
          correct: count,
          visual: { type: 'sticks', total: count, target: icon + 'の' + part },
          hint: part === '辺' ? '形を囲む直線が辺だよ。' : '辺と辺が出会う点が頂点だよ。',
          explain: (isTriangle ? '三角形' : '四角形') + 'の' + part + 'は' + count + 'つ。'
        }, rng);
      }
      return choiceQuestion({
        kind: 'route',
        prompt: frame + icon + 'の辺と頂点の数は？',
        correct: count + '本・' + count + 'こ',
        options: [count + '本・' + count + 'こ', count + '本・' + (count + 1) + 'こ', (count + 1) + '本・' + count + 'こ'],
        visual: { type: 'solid-scan', icon: icon },
        hint: '辺を一周なぞり、出会う点も数えよう。',
        explain: '辺も頂点も' + count + 'つずつあるよ。'
      }, rng);
    }

    if (stageIndex === 3) {
      const corners = [
        { icon: '└', answer: '直角', note: 'ぴったり重なる' },
        { icon: '⌞', answer: '直角', note: '向きが変わっても同じ' },
        { icon: '＜', answer: '直角ではない', note: 'せまい角' },
        { icon: '∧', answer: '直角ではない', note: 'ななめの角' }
      ];
      const item = pick(corners, rng);
      if (isStorySlot(slot, context)) {
        return choiceQuestion({
          prompt: '紙を2回ぴったり折ってできた角を、箱のすみに重ねると合った。この角は？',
          correct: '直角',
          options: ['直角', 'まっすぐな線', '曲線'],
          visual: { type: 'transform', pieces: 2, action: '折って重ねる' },
          hint: '紙をぴったり折って作る角が直角のもとだよ。',
          explain: '向きが変わっても、ぴったり重なる角は直角。',
          story: true
        }, rng);
      }
      if (slot % 2 === 0) {
        return choiceQuestion({
          kind: 'sort',
          prompt: item.icon + ' に直角ゲージは合う？',
          correct: item.answer,
          options: ['直角', '直角ではない'],
          visual: { type: 'solid-scan', icon: item.icon },
          hint: '角の向きではなく、折り紙の角と重なるかで考えよう。',
          explain: item.icon + 'は' + item.answer + '。' + item.note + 'よ。'
        }, rng);
      }
      const shape = pick([{ icon: '□', count: 4 }, { icon: '▭', count: 4 }, { icon: '◩', count: 1 }], rng);
      return numericQuestion({
        kind: 'route',
        prompt: shape.icon + 'にある直角は何こ？',
        correct: shape.count,
        min: 0,
        max: 4,
        visual: { type: 'solid-scan', icon: shape.icon },
        hint: '直角ゲージを角ごとに回して重ねよう。',
        explain: '直角は' + shape.count + 'こあるよ。'
      }, rng);
    }

    if (stageIndex === 4) {
      const sources = [0, 1, 2, 3, 0, 1, 2, 3];
      const source = buildShapeQuestion(sources[slot], round, rng, context);
      return retag(source, { checkpoint: true, assessmentFor: stage.canonicalSkillId });
    }

    if (stageIndex === 5) {
      const rectanglePatterns = [
        [0, 1, 2, 3, 4, 5],
        [1, 2, 4, 5, 7, 8],
        [0, 1, 3, 4]
      ];
      if (isStorySlot(slot, context)) {
        return choiceQuestion({
          kind: 'sort',
          prompt: '写真フレームは四つの角が全部直角。たてとよこの長さはちがう。この形は？',
          correct: '長方形',
          options: ['長方形', '正方形', '直角三角形'],
          visual: { type: 'solid-scan', icon: '▭' },
          hint: '四つの角が直角という条件に注目しよう。',
          explain: '四つの角が直角なので長方形。',
          story: true
        }, rng);
      }
      if (slot % 3 === 0) {
        const target = pick(rectanglePatterns, rng);
        return finalizeQuestion({
          kind: 'select',
          prompt: '見本と同じ長方形のマスを選ぼう。',
          instruction: 'マスを選んで「けってい」',
          correct: target,
          visual: { type: 'grid-copy', size: 3, target },
          hint: 'たてとよこの直線、四つの直角を見よう。',
          explain: '長方形を同じ向きと大きさで作れたね。'
        }, rng);
      }
      if (slot % 3 === 1) {
        return choiceQuestion({
          kind: 'sort',
          prompt: '長方形になる条件は？',
          correct: '四つの角が直角',
          options: ['四つの角が直角', '四つの辺が全部同じ', '角が一つだけ直角'],
          visual: { type: 'solid-scan', icon: '▭' },
          hint: '長方形は角の形に注目するよ。',
          explain: '長方形の四つの角は全部直角。'
        }, rng);
      }
      return numericQuestion({
        kind: 'route',
        prompt: '長方形の直角は何こ？',
        correct: 4,
        min: 0,
        max: 6,
        visual: { type: 'solid-scan', icon: '▭' },
        hint: '四すみを一つずつ確かめよう。',
        explain: '長方形には直角が4こあるよ。'
      }, rng);
    }

    if (stageIndex === 6) {
      const squareTargets = [[0, 1, 3, 4], [1, 2, 4, 5], [3, 4, 6, 7]];
      if (isStorySlot(slot, context)) {
        return choiceQuestion({
          kind: 'sort',
          prompt: '同じ長さの棒4本を、四つの直角でつないだ。できる形は？',
          correct: '正方形',
          options: ['正方形', '長方形だけ', '三角形'],
          visual: { type: 'sticks', target: '四辺が同じ', total: 4 },
          hint: '辺の長さと角の形を両方見よう。',
          explain: '四辺が同じで四角が直角なら正方形。',
          story: true
        }, rng);
      }
      if (slot % 3 === 0) {
        const target = pick(squareTargets, rng);
        return finalizeQuestion({
          kind: 'select',
          prompt: '見本と同じ正方形のマスを選ぼう。',
          instruction: 'マスを選んで「けってい」',
          correct: target,
          visual: { type: 'grid-copy', size: 3, target },
          hint: 'たてとよこが同じ長さになるように見よう。',
          explain: '同じ長さのたて・よこで正方形を作れたね。'
        }, rng);
      }
      if (slot % 3 === 1) {
        return choiceQuestion({
          kind: 'sort',
          prompt: '正方形の条件を二つ選んだ説明は？',
          correct: '四辺が同じ・四角が直角',
          options: ['四辺が同じ・四角が直角', '向かい合う二辺だけ同じ・角は自由', '三辺が同じ・直角が一つ'],
          visual: { type: 'solid-scan', icon: '□' },
          hint: '辺の長さと角をどちらも確かめよう。',
          explain: '正方形は四辺が同じ長さで、四つの角が直角。'
        }, rng);
      }
      return tapQuestion({
        prompt: '正方形の同じ長さの辺を点灯しよう。',
        correct: 4,
        visual: { type: 'sticks', total: 4, target: '□' },
        hint: '正方形は四辺が全部同じ長さ。',
        explain: '4本すべてが同じ長さだよ。'
      }, rng);
    }

    if (stageIndex === 7) {
      const cases = [
        { icon: '◩', answer: '直角三角形' },
        { icon: '△', answer: '直角三角形ではない' },
        { icon: '◢', answer: '直角三角形' },
        { icon: '▽', answer: '直角三角形ではない' }
      ];
      const item = pick(cases, rng);
      if (isStorySlot(slot, context)) {
        return choiceQuestion({
          prompt: '長方形の紙を、向かい合う角を結ぶ線で切った。できた三角形は？',
          correct: '直角三角形',
          options: ['直角三角形', '正方形', '四角形'],
          visual: { type: 'transform', pieces: 2, action: '対角線で切る' },
          hint: 'もとの長方形の角が、三角形に一つ残るよ。',
          explain: '長方形の直角を一つもつので直角三角形。',
          story: true
        }, rng);
      }
      if (slot % 2 === 0) {
        return choiceQuestion({
          kind: 'sort',
          prompt: item.icon + 'を直角ゲージで調べよう。',
          correct: item.answer,
          options: ['直角三角形', '直角三角形ではない'],
          visual: { type: 'solid-scan', icon: item.icon },
          hint: '三角形の中に直角が一つあるか見よう。',
          explain: item.icon + 'は' + item.answer + '。'
        }, rng);
      }
      return choiceQuestion({
        kind: 'route',
        prompt: '直角三角形の説明は？',
        correct: '直角が一つある三角形',
        options: ['直角が一つある三角形', '辺が四本ある形', '角が全部直角の形'],
        visual: { type: 'solid-scan', icon: '◩' },
        hint: '名前の「直角」に注目しよう。',
        explain: '直角を一つもつ三角形を直角三角形というよ。'
      }, rng);
    }

    if (stageIndex === 8) {
      const patterns = [
        { name: '長方形', cells: [0, 1, 2, 3, 4, 5] },
        { name: '正方形', cells: [0, 1, 3, 4] },
        { name: 'かいだん形', cells: [0, 3, 4, 6, 7, 8] }
      ];
      const pattern = pick(patterns, rng);
      if (isStorySlot(slot, context)) {
        return choiceQuestion({
          prompt: '正方形タイルを、すき間も重なりもなく床に並べる。この作り方は？',
          correct: 'しきつめ',
          options: ['しきつめ', '囲みを開く', '辺を消す'],
          visual: { type: 'area', left: 8, right: 8 },
          hint: '同じ形をすき間なく並べる操作だよ。',
          explain: 'すき間も重なりもなく並べることを、しきつめというよ。',
          story: true
        }, rng);
      }
      if (slot % 2 === 0) {
        return finalizeQuestion({
          kind: 'select',
          prompt: '見本の' + pattern.name + 'を方眼に写そう。',
          instruction: '同じマスを選んで「けってい」',
          correct: pattern.cells,
          visual: { type: 'grid-copy', size: 3, target: pattern.cells },
          hint: '行と列の位置を一つずつ合わせよう。',
          explain: pattern.name + 'を方眼に写せたね。'
        }, rng);
      }
      const operation = pick(['まわす', 'ずらす', 'うらがえす'], rng);
      return choiceQuestion({
        kind: 'route',
        prompt: '形の大きさを変えず、向きだけ変える操作は？',
        correct: 'まわす',
        options: ['まわす', 'のばす', '切り取る'],
        visual: { type: 'transform', pieces: rand(2, 5, rng), action: operation },
        hint: '形を回転させても、辺の長さは変わらないよ。',
        explain: 'まわすと向きだけが変わるよ。'
      }, rng);
    }

    if (stageIndex === 9) {
      const element = pick([
        { name: '面', count: 6, icon: '□' },
        { name: '辺', count: 12, icon: '┃' },
        { name: '頂点', count: 8, icon: '◆' }
      ], rng);
      if (isStorySlot(slot, context)) {
        return numericQuestion({
          kind: 'route',
          prompt: '箱の骨組みを、ひごで作る。辺になるひごは何本必要？',
          correct: 12,
          min: 0,
          max: 16,
          visual: { type: 'solid-scan', icon: '▣' },
          hint: '上に4本、下に4本、たてに4本あるよ。',
          explain: '4＋4＋4で、辺は12本。',
          story: true
        }, rng);
      }
      if (slot % 3 === 0) {
        return tapQuestion({
          prompt: '箱の' + element.name + 'の数だけ部品を選ぼう。',
          correct: element.count,
          visual: { type: 'sticks', total: element.count, icons: [element.icon], target: '箱の' + element.name },
          hint: element.name === '面' ? '上・下・前・後ろ・左・右を数えよう。' : element.name === '辺' ? '上、下、たての辺に分けよう。' : '上の角と下の角に分けよう。',
          explain: '箱の' + element.name + 'は' + element.count + (element.name === '辺' ? '本' : 'こ') + '。'
        }, rng);
      }
      if (slot % 3 === 1) {
        return choiceQuestion({
          kind: 'route',
          prompt: '箱の面になる形は？',
          correct: '長方形や正方形',
          options: ['長方形や正方形', '開いた曲線だけ', '点だけ'],
          visual: { type: 'stamp', solid: '▣', face: '□' },
          hint: '箱の平らなところを紙に写した形を考えよう。',
          explain: '箱の面は長方形や正方形でできているよ。'
        }, rng);
      }
      return choiceQuestion({
        kind: 'sort',
        prompt: '箱の平らな広がりを何という？',
        correct: '面',
        options: ['面', '辺', '頂点'],
        visual: { type: 'stamp', solid: '▣', face: '□' },
        hint: '触ると平らに広がっているところだよ。',
        explain: '箱の平らなところを面というよ。'
      }, rng);
    }

    const sources = [0, 1, 2, 3, 5, 6, 7, 9];
    const source = buildShapeQuestion(sources[slot], round, rng, context);
    return retag(source, { checkpoint: true, assessmentFor: stage.canonicalSkillId });
  }

  function dataSet(rng, allowTie) {
    const labels = shuffle(['ギア', 'ライト', 'ねじ'], rng);
    let counts = [rand(2, 8, rng), rand(2, 8, rng), rand(2, 8, rng)];
    if (!allowTie) {
      let guard = 0;
      while (new Set(counts).size < counts.length && guard < 30) {
        counts = [rand(2, 8, rng), rand(2, 8, rng), rand(2, 8, rng)];
        guard += 1;
      }
    }
    return { labels, counts };
  }

  function maxIndex(values) {
    return values.indexOf(Math.max.apply(null, values));
  }

  function minIndex(values) {
    return values.indexOf(Math.min.apply(null, values));
  }

  function addSubScene(rng) {
    const add = rand(0, 1, rng) === 1;
    if (add) {
      const a = rand(20, 59, rng);
      const b = rand(10, Math.min(39, 99 - a), rng);
      return {
        operation: '＋',
        a,
        b,
        result: a + b,
        text: '部品が' + a + 'こあり、' + b + 'こ届いた。全部で何こ？',
        math: { kind: 'add', a, b, result: a + b }
      };
    }
    const a = rand(45, 95, rng);
    const b = rand(10, Math.min(39, a - 1), rng);
    return {
      operation: '−',
      a,
      b,
      result: a - b,
      text: '部品が' + a + 'こあり、' + b + 'こ使った。残りは何こ？',
      math: { kind: 'subtract', a, b, result: a - b }
    };
  }

  function buildSolveQuestion(stageIndex, round, rng, context) {
    const slot = slotFor(round, context);
    const stage = lineFor('solve').stages[stageIndex];

    if (stageIndex === 0) {
      const cases = [
        { purpose: '光る部品の数を知りたい', item: '青く光るライト', view: '光る・光らない', bin: '光る' },
        { purpose: '形ごとの数を知りたい', item: '丸いボタン', view: '形', bin: 'まる' },
        { purpose: '使う場所ごとの数を知りたい', item: '台所で使う電池', view: '使う場所', bin: '台所' },
        { purpose: '色ごとの数を知りたい', item: '赤いねじ', view: '色', bin: '赤' }
      ];
      const item = pick(cases, rng);
      if (isStorySlot(slot, context)) {
        return choiceQuestion({
          kind: 'sort',
          prompt: 'トトは「雨の日に使う物」を調べたい。カードを分ける観点は？',
          correct: '使う天気',
          options: ['使う天気', 'カードの色', '文字の数'],
          visual: { type: 'sort', item: 'かさ・長ぐつ・ぼうし', bins: ['雨', '晴れ'] },
          hint: '調べたいことに直接つながる分け方を選ぼう。',
          explain: '使う天気で分けると、雨の日の物が数えやすいね。',
          story: true
        }, rng);
      }
      if (slot % 2 === 0) {
        return choiceQuestion({
          kind: 'sort',
          prompt: '「' + item.purpose + '」。どんな観点で分ける？',
          correct: item.view,
          options: shuffle([item.view, '大きさ', '名前の長さ'], rng),
          visual: { type: 'sort', item: item.item, bins: [item.bin, 'ほか'] },
          hint: '知りたいことと同じ特徴に注目しよう。',
          explain: item.view + 'で分けると目的に合うよ。'
        }, rng);
      }
      return choiceQuestion({
        kind: 'sort',
        prompt: item.item + 'を、どの箱へ入れる？',
        correct: item.bin,
        options: [item.bin, 'ほか'],
        visual: { type: 'sort', item: item.item, bins: [item.bin, 'ほか'] },
        hint: '決めた観点だけを見て仕分けよう。',
        explain: item.item + 'は「' + item.bin + '」の箱だね。'
      }, rng);
    }

    if (stageIndex === 1) {
      const icons = shuffle(['⚙', '⚙', '💡', '🔩', '⚙', '💡', '🔩', '⚙'], rng);
      const target = pick(['⚙', '💡', '🔩'], rng);
      const count = icons.filter(function (icon) { return icon === target; }).length;
      if (isStorySlot(slot, context)) {
        return tapQuestion({
          prompt: '部品カードを一枚ずつ見て、⚙に印を付けた。⚙の印を' + count + 'こ点灯しよう。',
          correct: count,
          visual: { type: 'graph-build', total: icons.length, icons: ['✓'] },
          hint: '処理したカードには一度だけ印を付けよう。',
          explain: '⚙は' + count + 'こ。印を付けると重ねて数えにくいね。',
          story: true
        }, rng);
      }
      if (slot % 3 === 0) {
        return tapQuestion({
          prompt: target + 'のカードを数え、同じ数だけ印を点灯しよう。',
          correct: count,
          visual: { type: 'objects', count: icons.length, icon: target, icons },
          hint: '一枚数えたら印を一つ。数えたカードはもう数えないよ。',
          explain: target + 'は' + count + 'こあるよ。'
        }, rng);
      }
      if (slot % 3 === 1) {
        const tally = count === 5 ? '||||/' : '|'.repeat(count);
        return choiceQuestion({
          kind: 'route',
          prompt: target + 'が' + count + 'こ。正しい記録の印は？',
          correct: tally,
          options: [tally, '|'.repeat(Math.max(1, count - 1)), '|'.repeat(count + 1)],
          visual: { type: 'circuit', equation: target + ' → 記録' },
          hint: '一つにつき印を一つ対応させよう。',
          explain: count + 'こなので、印も' + count + 'こ。'
        }, rng);
      }
      return choiceQuestion({
        kind: 'sort',
        prompt: '数え落としを防ぐやり方は？',
        correct: '数えたカードに印を付ける',
        options: ['数えたカードに印を付ける', '同じカードを何度も戻す', '順番を毎回変える'],
        visual: { type: 'tools', scene: 'カード → 印 → 処理ずみ' },
        hint: 'まだのカードと終わったカードを見分ける方法だよ。',
        explain: '処理ずみの印で、重複と数え落としを防げるよ。'
      }, rng);
    }

    if (stageIndex === 2) {
      const data = dataSet(rng, true);
      const targetIndex = rand(0, 2, rng);
      const total = data.counts.reduce(function (sum, count) { return sum + count; }, 0);
      if (isStorySlot(slot, context)) {
        return numericQuestion({
          kind: 'route',
          prompt: '部品を表にすると、' + data.labels.map(function (label, index) { return label + data.counts[index] + 'こ'; }).join('、') + '。全部で何こ？',
          correct: total,
          min: 0,
          max: 30,
          visual: { type: 'aligned-data', labels: data.labels, counts: data.counts },
          hint: '表の三つの個数を足そう。',
          explain: data.counts.join('＋') + '＝' + total + 'こ。',
          story: true
        }, rng);
      }
      if (slot % 3 === 0) {
        return numericQuestion({
          kind: 'slider',
          prompt: '表の「' + data.labels[targetIndex] + '」の行へ置く個数は？',
          correct: data.counts[targetIndex],
          min: 0,
          max: 10,
          visual: { type: 'aligned-data', labels: data.labels, counts: data.counts },
          hint: 'ラベルと同じ種類のカードだけ数えよう。',
          explain: data.labels[targetIndex] + 'は' + data.counts[targetIndex] + 'こ。'
        }, rng);
      }
      if (slot % 3 === 1) {
        return choiceQuestion({
          kind: 'route',
          prompt: '元のカードは全部で' + total + '枚。表の合計も' + total + '。何を確かめられる？',
          correct: '数え落としや重なりがない',
          options: ['数え落としや重なりがない', '項目名が全部同じ', 'グラフの色が同じ'],
          visual: { type: 'circuit', equation: total + '枚 ＝ 表の合計' + total },
          hint: '元の数と整理後の合計を比べよう。',
          explain: '合計が同じなら、分類でカードをなくしたり二重に数えたりしていないね。'
        }, rng);
      }
      return choiceQuestion({
        kind: 'sort',
        prompt: '一次元の表で必要なものは？',
        correct: '種類の名前と個数',
        options: ['種類の名前と個数', '時計の針', '図形の角度'],
        visual: { type: 'aligned-data', labels: data.labels, counts: data.counts },
        hint: '何をいくつ数えたか分かるようにしよう。',
        explain: '種類の名前と個数を対応させると見やすい表になるよ。'
      }, rng);
    }

    if (stageIndex === 3) {
      const data = dataSet(rng, true);
      const targetIndex = rand(0, 2, rng);
      const target = data.counts[targetIndex];
      if (isStorySlot(slot, context)) {
        return tapQuestion({
          prompt: 'クラスで好きな部品を調べると、' + data.labels[targetIndex] + 'が' + target + '人。○をいくつ点灯する？',
          correct: target,
          visual: { type: 'graph-build', total: 8, label: data.labels[targetIndex] },
          hint: '○一つが一人を表すよ。',
          explain: target + '人なので○も' + target + 'こ。',
          story: true
        }, rng);
      }
      if (slot % 2 === 0) {
        return tapQuestion({
          prompt: data.labels[targetIndex] + 'が' + target + 'こ。グラフの○を下から点灯しよう。',
          correct: target,
          visual: { type: 'graph-build', total: 8, label: data.labels[targetIndex] },
          hint: '一番下から、すき間を空けずに点灯するよ。',
          explain: '○を' + target + 'こ並べれば表と同じ。'
        }, rng);
      }
      return choiceQuestion({
        kind: 'route',
        prompt: 'この表と同じグラフは、' + data.labels[targetIndex] + 'の○がいくつ？',
        correct: target,
        options: numberChoices(target, 0, 8, 4, rng),
        visual: { type: 'graph', labels: data.labels, counts: data.counts },
        hint: '表の個数と○の数を一対一で合わせよう。',
        explain: data.labels[targetIndex] + 'の○は' + target + 'こ。'
      }, rng);
    }

    if (stageIndex === 4) {
      const sources = [0, 1, 2, 3, 0, 1, 2, 3];
      const source = buildSolveQuestion(sources[slot], round, rng, context);
      return retag(source, { checkpoint: true, assessmentFor: stage.canonicalSkillId });
    }

    if (stageIndex === 5) {
      const data = dataSet(rng, false);
      const high = maxIndex(data.counts);
      const low = minIndex(data.counts);
      const difference = data.counts[high] - data.counts[low];
      const total = data.counts.reduce(function (sum, count) { return sum + count; }, 0);
      if (isStorySlot(slot, context)) {
        return numericQuestion({
          kind: 'route',
          prompt: '工房で集めた部品のグラフ。いちばん多い' + data.labels[high] + 'と、少ない' + data.labels[low] + 'の差は？',
          correct: difference,
          min: 0,
          max: 8,
          visual: { type: 'graph', labels: data.labels, counts: data.counts },
          hint: data.counts[high] + 'から' + data.counts[low] + 'を引こう。',
          explain: data.counts[high] + '−' + data.counts[low] + '＝' + difference + 'こ。',
          story: true
        }, rng);
      }
      if (slot % 4 === 0) {
        return choiceQuestion({
          prompt: 'グラフでいちばん多いのは？',
          correct: data.labels[high],
          options: data.labels,
          visual: { type: 'graph', labels: data.labels, counts: data.counts },
          hint: 'いちばん高い列を見よう。',
          explain: data.labels[high] + 'が' + data.counts[high] + 'こで、いちばん多いよ。'
        }, rng);
      }
      if (slot % 4 === 1) {
        return choiceQuestion({
          prompt: 'グラフでいちばん少ないのは？',
          correct: data.labels[low],
          options: data.labels,
          visual: { type: 'graph', labels: data.labels, counts: data.counts },
          hint: 'いちばん低い列を見よう。',
          explain: data.labels[low] + 'が' + data.counts[low] + 'こで、いちばん少ないよ。'
        }, rng);
      }
      if (slot % 4 === 2) {
        return numericQuestion({
          kind: 'slider',
          prompt: data.labels[high] + 'と' + data.labels[low] + 'の差は？',
          correct: difference,
          min: 0,
          max: 8,
          visual: { type: 'graph', labels: data.labels, counts: data.counts },
          hint: '多い方から少ない方を引こう。',
          explain: data.counts[high] + '−' + data.counts[low] + '＝' + difference + '。'
        }, rng);
      }
      return numericQuestion({
        kind: 'route',
        prompt: '三つの種類を合わせると全部でいくつ？',
        correct: total,
        min: 0,
        max: 30,
        visual: { type: 'graph', labels: data.labels, counts: data.counts },
        hint: '三本の列の数を足そう。',
        explain: data.counts.join('＋') + '＝' + total + '。'
      }, rng);
    }

    if (stageIndex === 6) {
      const cases = [
        { purpose: '種類ごとの個数を正確に読む', answer: '表', other: 'グラフ' },
        { purpose: 'どれが多いか一目で比べる', answer: 'グラフ', other: '表' },
        { purpose: '全部のカードをまず分類する', answer: '仕分け', other: 'グラフ' }
      ];
      const item = pick(cases, rng);
      if (isStorySlot(slot, context)) {
        return choiceQuestion({
          prompt: 'モクモは、三つの部品のうちどれが一番多いか発表したい。見やすい表し方は？',
          correct: 'グラフ',
          options: ['グラフ', '文章だけ', '時刻表'],
          visual: { type: 'graph', labels: ['A', 'B', 'C'], counts: [3, 7, 5] },
          hint: '高さを見てすぐ比べられる表し方を選ぼう。',
          explain: 'グラフなら、多い・少ないを一目で比べられるよ。',
          story: true
        }, rng);
      }
      if (slot % 2 === 0) {
        return choiceQuestion({
          kind: 'sort',
          prompt: '「' + item.purpose + '」のに合う装置は？',
          correct: item.answer,
          options: [item.answer, item.other, '時計'],
          visual: { type: 'tools', scene: item.purpose },
          hint: '知りたいことが見やすくなる表し方を選ぼう。',
          explain: item.purpose + 'なら' + item.answer + 'が合うよ。'
        }, rng);
      }
      const repair = pick([
        { fault: 'グラフの○が途中から並んでいる', fix: '下からすき間なく並べる' },
        { fault: '表に種類の名前がない', fix: '種類の名前を付ける' },
        { fault: '一つだけ○二こ分になっている', fix: '○一つを一こにそろえる' }
      ], rng);
      return choiceQuestion({
        kind: 'route',
        prompt: '故障「' + repair.fault + '」。どう直す？',
        correct: repair.fix,
        options: [repair.fix, '色だけ変える', '個数を全部消す'],
        visual: { type: 'circuit', equation: '表・グラフ修理' },
        hint: '同じ決まりで見比べられるようにしよう。',
        explain: repair.fix + 'と、正しく読み取れるね。'
      }, rng);
    }

    if (stageIndex === 7) {
      const scene = addSubScene(rng);
      if (isStorySlot(slot, context)) {
        return choiceQuestion({
          prompt: scene.text + ' 使う計算は？',
          correct: scene.operation,
          options: ['＋', '−'],
          visual: { type: 'operation-choice', operation: scene.operation },
          hint: scene.operation === '＋' ? '増えた量を合わせる場面だよ。' : '使った量を元の数から取り出す場面だよ。',
          explain: 'この場面は' + scene.operation + 'を使うよ。',
          story: true,
          math: scene.math
        }, rng);
      }
      if (slot % 3 === 0) {
        return choiceQuestion({
          kind: 'sort',
          prompt: scene.operation === '＋' ? '部品が増える動き。入れるレバーは？' : '部品を取り出す動き。入れるレバーは？',
          correct: scene.operation,
          options: ['＋', '−'],
          visual: { type: 'operation-choice', operation: scene.operation },
          hint: '合わせる・増えるなら＋、残り・違いなら−。',
          explain: 'この動きには' + scene.operation + 'を使うよ。',
          math: scene.math
        }, rng);
      }
      if (slot % 3 === 1) {
        const needed = scene.operation === '＋' ? 'はじめの数と届いた数' : 'はじめの数と使った数';
        return choiceQuestion({
          kind: 'route',
          prompt: '答えを出すために必要な情報は？',
          correct: needed,
          options: [needed, '部品の色だけ', '作業した人の名前だけ'],
          visual: { type: 'story-model', math: scene.math },
          hint: '計算に入る二つの数量を選ぼう。',
          explain: needed + 'があれば計算できるよ。',
          math: scene.math
        }, rng);
      }
      return choiceQuestion({
        kind: 'route',
        prompt: scene.a + 'と' + scene.b + 'の場面に合う式は？',
        correct: scene.a + scene.operation + scene.b,
        options: [scene.a + scene.operation + scene.b, scene.b + (scene.operation === '＋' ? '−' : '＋') + scene.a, scene.result + scene.operation + scene.b],
        visual: { type: 'operation-choice', operation: scene.operation },
        hint: 'はじめの量を前に置き、動きに合う記号を選ぼう。',
        explain: '場面に合う式は' + scene.a + scene.operation + scene.b + '。',
        math: scene.math
      }, rng);
    }

    if (stageIndex === 8) {
      const mode = slot % 3;
      let whole;
      let known;
      let answer;
      let math;
      if (mode === 0) {
        whole = rand(50, 95, rng);
        known = rand(15, whole - 10, rng);
        answer = whole - known;
        math = { kind: 'subtract', a: whole, b: known, result: answer, unknown: 'part' };
      } else if (mode === 1) {
        known = rand(20, 55, rng);
        answer = rand(10, 35, rng);
        whole = known + answer;
        math = { kind: 'add', a: known, b: answer, result: whole, unknown: 'whole' };
      } else {
        const larger = rand(50, 95, rng);
        known = rand(20, larger - 10, rng);
        answer = larger - known;
        whole = larger;
        math = { kind: 'subtract', a: larger, b: known, result: answer, unknown: 'difference' };
      }
      if (isFormulaSlot(slot, context)) {
        return numericQuestion({
          kind: 'route',
          prompt: whole + ' − □ ＝ ' + known,
          correct: whole - known,
          min: 0,
          max: 100,
          visual: { type: 'circuit', equation: whole + ' − □ ＝ ' + known },
          hint: '全体から分かっている部分を引こう。',
          explain: whole + '−' + known + '＝' + (whole - known) + '。',
          bareCalculation: true,
          formulaOnly: true,
          math: { kind: 'subtract', a: whole, b: known, result: whole - known, unknown: 'part' }
        }, rng);
      }
      if (isStorySlot(slot, context)) {
        return numericQuestion({
          kind: 'slider',
          prompt: '箱に部品が全部で' + whole + 'こ。青い部品は' + known + 'こ。ほかの部品は何こ？',
          correct: whole - known,
          min: 0,
          max: 100,
          start: Math.max(0, whole - known - 5),
          visual: { type: 'relation', math: { kind: 'subtract', a: whole, b: known } },
          hint: '全体のテープから、分かっている部分を取り出そう。',
          explain: whole + '−' + known + '＝' + (whole - known) + 'こ。',
          story: true,
          math: { kind: 'subtract', a: whole, b: known, result: whole - known, unknown: 'part' }
        }, rng);
      }
      if (slot % 2 === 0) {
        return numericQuestion({
          kind: 'slider',
          prompt: 'テープ全体が' + whole + '、分かっている部分が' + known + '。空欄はいくつ？',
          correct: answer,
          min: 0,
          max: 100,
          start: Math.max(0, answer - 5),
          visual: { type: 'relation', math },
          hint: mode === 1 ? '二つの部分を合わせて全体にしよう。' : '全体から分かる部分を引こう。',
          explain: '空欄は' + answer + 'だよ。',
          math
        }, rng);
      }
      const route = mode === 1 ? known + '＋' + answer : whole + '−' + known;
      return choiceQuestion({
        kind: 'route',
        prompt: '空欄へ届く計算回路は？',
        correct: route,
        options: [route, known + '−' + answer, whole + '＋' + known],
        visual: { type: 'story-model', math },
        hint: '全体・部分・差のどこが空欄か見よう。',
        explain: route + 'の回路で空欄を求められるよ。',
        math
      }, rng);
    }

    if (stageIndex === 9) {
      if (isFormulaSlot(slot, context)) {
        const whole = rand(55, 90, rng);
        const part = rand(20, whole - 10, rng);
        const answer = whole - part;
        return numericQuestion({
          kind: 'route',
          prompt: '□ ＋ ' + part + ' ＝ ' + whole,
          correct: answer,
          min: 0,
          max: 100,
          visual: { type: 'circuit', equation: '□ ＋ ' + part + ' ＝ ' + whole },
          hint: '全体から分かっている部分を引こう。',
          explain: whole + '−' + part + '＝' + answer + '。',
          bareCalculation: true,
          formulaOnly: true,
          math: { kind: 'subtract', a: whole, b: part, result: answer, unknown: 'part' }
        }, rng);
      }
      if (isStorySlot(slot, context)) {
        const scene = addSubScene(rng);
        const extra = rand(2, 9, rng);
        return numericQuestion({
          kind: 'route',
          prompt: scene.text + ' 部品は3色ある、という情報は使わない。答えは？',
          correct: scene.result,
          min: 0,
          max: 100,
          visual: { type: 'story-model', math: scene.math, extra: '3色' },
          hint: '個数の計算に必要な二つの数だけを使おう。',
          explain: '色の数は使わず、' + scene.a + scene.operation + scene.b + '＝' + scene.result + '。',
          story: true,
          math: Object.assign({ extra }, scene.math)
        }, rng);
      }
      if (slot === 0) {
        const scene = addSubScene(rng);
        return choiceQuestion({
          kind: 'sort',
          prompt: '「増えた／使った」の動きに合う装置は？',
          correct: scene.operation,
          options: ['＋', '−', '×'],
          visual: { type: 'operation-choice', operation: scene.operation },
          hint: '量が増えるか減るかを見よう。',
          explain: 'この動きには' + scene.operation + 'を使うよ。',
          math: scene.math
        }, rng);
      }
      if (slot === 1) {
        const needed = pick(['はじめの個数と増えた個数', '全体の個数と分かる部分'], rng);
        return choiceQuestion({
          kind: 'route',
          prompt: '答えを出すため、作業台へ置く情報は？',
          correct: needed,
          options: [needed, '部品の色と箱の名前', '作業した曜日と天気'],
          visual: { type: 'tools', scene: '必要な情報を2枚選ぶ' },
          hint: '数量の関係を作れる情報を選ぼう。',
          explain: needed + 'を使えば計算できるよ。'
        }, rng);
      }
      if (slot === 2) {
        const whole = rand(50, 95, rng);
        const part = rand(15, whole - 10, rng);
        return numericQuestion({
          kind: 'slider',
          prompt: '全体' + whole + '、部分' + part + '。テープ図の空欄は？',
          correct: whole - part,
          min: 0,
          max: 100,
          visual: { type: 'relation', math: { kind: 'subtract', a: whole, b: part } },
          hint: '全体から分かる部分を引こう。',
          explain: whole + '−' + part + '＝' + (whole - part) + '。'
        }, rng);
      }
      if (slot === 3) {
        const scene = addSubScene(rng);
        return choiceQuestion({
          kind: 'route',
          prompt: 'この数量関係に合うモデルは？',
          correct: scene.operation === '＋' ? '二つの部分を合わせる図' : '全体から一部を外す図',
          options: ['二つの部分を合わせる図', '全体から一部を外す図', '同じ数ずつのグループ図'],
          visual: { type: 'story-model', math: scene.math },
          hint: '＋は合流、−は取り出す動きで考えよう。',
          explain: 'この場面には' + (scene.operation === '＋' ? '二つの部分を合わせる図' : '全体から一部を外す図') + 'が合うよ。',
          math: scene.math
        }, rng);
      }
      if (slot === 4) {
        const groups = rand(2, 5, rng);
        const each = rand(2, 5, rng);
        return choiceQuestion({
          kind: 'route',
          prompt: each + 'こずつの箱が' + groups + '箱。合う式は？',
          correct: each + '×' + groups,
          options: [each + '×' + groups, each + '＋' + groups, groups + '−' + each],
          visual: { type: 'equal-groups', groups, perGroup: each, total: groups * each },
          hint: '同じ数ずつのまとまりがいくつ分かを見よう。',
          explain: '一つ分' + each + '×' + groups + 'つ分の式だよ。',
          math: { kind: 'multiply', a: each, b: groups, result: each * groups }
        }, rng);
      }
      const data = dataSet(rng, false);
      const high = maxIndex(data.counts);
      return choiceQuestion({
        prompt: '表・グラフから先に使う情報は？',
        correct: data.labels[high] + 'が' + data.counts[high] + 'こ',
        options: data.labels.map(function (label, index) { return label + 'が' + data.counts[index] + 'こ'; }),
        visual: { type: 'graph', labels: data.labels, counts: data.counts },
        hint: 'いちばん多い列の名前と個数を組にしよう。',
        explain: data.labels[high] + 'が' + data.counts[high] + 'こで、いちばん多いよ。'
      }, rng);
    }

    const sources = [0, 2, 3, 5, 6, 7, 8, 9];
    const source = buildSolveQuestion(sources[slot], round, rng, context);
    return retag(source, { checkpoint: true, assessmentFor: stage.canonicalSkillId });
  }

  const BUILDERS = Object.freeze({
    measure: buildMeasureQuestion,
    shape: buildShapeQuestion,
    solve: buildSolveQuestion
  });

  function buildQuestion(lineId, stageRef, round, context) {
    const line = lineFor(lineId);
    const resolved = resolveStage(line, stageRef);
    const ctx = context || {};
    const rng = typeof ctx.rng === 'function' ? ctx.rng : Math.random;
    const question = BUILDERS[line.id](resolved.index, Number(round) || 0, rng, ctx);
    question.gradeId = GRADE_ID;
    question.courseId = GRADE_ID;
    question.lineId = line.id;
    question.stageId = resolved.stage.id;
    question.stageIndex = resolved.index;
    if (!question.canonicalSkillId) question.canonicalSkillId = resolved.stage.canonicalSkillId;
    if (resolved.stage.checkpoint) question.checkpoint = true;
    question.signature = questionSignature(question);
    return question;
  }

  function makeStageQuestions(lineId, stageRef, options) {
    const line = lineFor(lineId);
    const resolved = resolveStage(line, stageRef);
    const config = options || {};
    const seed = config.seed == null ? Date.now() : config.seed;
    const rng = typeof config.rng === 'function' ? config.rng : seededRng(seed);
    const count = config.count == null ? STAGE_ROUNDS : Math.max(1, Number(config.count) || STAGE_ROUNDS);
    const recent = new Set(config.exclude || []);
    const used = new Set();
    const questions = [];

    for (let questionIndex = 0; questionIndex < count; questionIndex += 1) {
      let question;
      let guard = 0;
      do {
        question = buildQuestion(line.id, resolved.index, questionIndex + guard * STAGE_ROUNDS, { rng });
        guard += 1;
      } while ((used.has(question.signature) || recent.has(question.signature)) && guard < 80);
      if (used.has(question.signature) || recent.has(question.signature)) {
        const baseSignature = question.signature;
        let suffix = 0;
        do {
          question.signature = baseSignature + '-' + questionIndex + '-' + hashString(seed + ':' + guard + ':' + suffix + ':' + resolved.stage.id);
          suffix += 1;
        } while (used.has(question.signature) || recent.has(question.signature));
      }
      used.add(question.signature);
      questions.push(question);
    }

    return {
      seed,
      gradeId: GRADE_ID,
      lineId: line.id,
      stageId: resolved.stage.id,
      questions
    };
  }

  function makeTimeAttackQuestions(lineId, options) {
    const line = lineFor(lineId);
    const config = options || {};
    const seed = config.seed == null ? Date.now() : config.seed;
    const rng = typeof config.rng === 'function' ? config.rng : seededRng(seed);
    const recent = new Set(config.exclude || []);
    const used = new Set();
    const questions = [];
    const pool = line.timeAttackStageIds || [];

    pool.slice(0, TIME_ATTACK_ROUNDS).forEach(function (stageId, questionIndex) {
      let question;
      let guard = 0;
      do {
        question = buildQuestion(line.id, stageId, questionIndex + guard * STAGE_ROUNDS, { rng, rush: true });
        guard += 1;
      } while ((used.has(question.signature) || recent.has(question.signature)) && guard < 80);
      question.rush = true;
      question.checkpoint = false;
      question.showHint = false;
      question.story = false;
      question.bareCalculation = false;
      question.formulaOnly = false;
      const baseSignature = questionSignature(question);
      question.signature = baseSignature;
      if (used.has(question.signature) || recent.has(question.signature)) {
        let suffix = 0;
        do {
          question.signature = baseSignature + '-rush-' + questionIndex + '-' + hashString(seed + ':' + guard + ':' + suffix + ':' + stageId);
          suffix += 1;
        } while (used.has(question.signature) || recent.has(question.signature));
      }
      used.add(question.signature);
      questions.push(question);
    });

    return { seed, gradeId: GRADE_ID, lineId: line.id, questions };
  }

  function hasCorrectOption(question) {
    if (!['choice', 'route', 'sort'].includes(question.kind)) return true;
    return (question.options || []).some(function (option) {
      return String(optionValue(option)) === String(question.correct);
    });
  }

  function validate() {
    const errors = [];
    let generatedQuestions = 0;
    let stageCount = 0;

    LINE_IDS.forEach(function (lineId, lineIndex) {
      let line;
      try {
        line = lineFor(lineId);
      } catch (error) {
        errors.push(error.message);
        return;
      }
      if (line.stages.length !== 11) errors.push(lineId + ': expected 11 stages');
      if (!Array.isArray(line.timeAttackStageIds) || line.timeAttackStageIds.length !== TIME_ATTACK_ROUNDS) {
        errors.push(lineId + ': expected 12 time-attack stage ids');
      }
      stageCount += line.stages.length;

      line.stages.forEach(function (stage, stageIndex) {
        let pack;
        try {
          pack = makeStageQuestions(lineId, stage.id, { seed: 220000 + lineIndex * 100 + stageIndex });
        } catch (error) {
          errors.push(stage.id + ': generation failed: ' + error.message);
          return;
        }
        generatedQuestions += pack.questions.length;
        if (pack.questions.length !== STAGE_ROUNDS) errors.push(stage.id + ': expected 8 questions');
        if (new Set(pack.questions.map(function (question) { return question.signature; })).size !== pack.questions.length) {
          errors.push(stage.id + ': duplicate signatures in a stage pack');
        }
        const storyCount = pack.questions.filter(function (question) { return question.story; }).length;
        const bareCount = pack.questions.filter(function (question) { return question.bareCalculation || question.formulaOnly; }).length;
        if (storyCount < 1 || storyCount > 2) errors.push(stage.id + ': expected 1-2 story questions, got ' + storyCount);
        if (bareCount > 1) errors.push(stage.id + ': expected at most 1 bare calculation, got ' + bareCount);

        pack.questions.forEach(function (question, questionIndex) {
          const prefix = stage.id + '[' + questionIndex + ']';
          if (question.gradeId !== GRADE_ID || question.courseId !== GRADE_ID || question.lineId !== lineId || question.stageId !== stage.id) {
            errors.push(prefix + ': invalid grade/line/stage tags');
          }
          if (!question.canonicalSkillId || !question.canonicalSkillId.startsWith('g2.')) errors.push(prefix + ': invalid skill id');
          if (!APP_KINDS.includes(question.kind)) errors.push(prefix + ': unsupported kind ' + question.kind);
          if (!question.prompt || !question.hint || !question.explain) errors.push(prefix + ': missing learning copy');
          if (!question.visual || !question.visual.type) errors.push(prefix + ': missing visual');
          if (!question.signature) errors.push(prefix + ': missing signature');
          if (!hasCorrectOption(question)) errors.push(prefix + ': options do not contain correct answer');
          if (['choice', 'route', 'sort'].includes(question.kind)) {
            const optionStrings = (question.options || []).map(optionValue).map(String);
            if (new Set(optionStrings).size !== optionStrings.length) errors.push(prefix + ': duplicate options');
          }
          if ((stage.n === 5 || stage.n === 11) && !question.checkpoint) errors.push(prefix + ': checkpoint flag missing');
        });
      });

      try {
        const rush = makeTimeAttackQuestions(lineId, { seed: 9900 + lineIndex });
        generatedQuestions += rush.questions.length;
        if (rush.questions.length !== TIME_ATTACK_ROUNDS) errors.push(lineId + ': expected 12 rush questions');
        rush.questions.forEach(function (question, index) {
          if (!question.rush || question.checkpoint || question.story || question.bareCalculation) {
            errors.push(lineId + ': invalid rush flags at ' + index);
          }
          if (!hasCorrectOption(question)) errors.push(lineId + ': rush options missing correct answer at ' + index);
        });
      } catch (error) {
        errors.push(lineId + ': time attack generation failed: ' + error.message);
      }
    });

    return Object.freeze({
      ok: errors.length === 0,
      errors: Object.freeze(errors),
      stageCount,
      generatedQuestions
    });
  }

  const stageIds = Object.freeze(LINE_IDS.reduce(function (result, lineId) {
    result[lineId] = Object.freeze(lineFor(lineId).stages.map(function (stage) { return stage.id; }));
    return result;
  }, {}));

  global.HiramekiGrade2WorldRuntime = Object.freeze({
    version: 1,
    gradeId: GRADE_ID,
    lineIds: LINE_IDS,
    stageIds,
    seededRng,
    questionSignature,
    buildQuestion,
    makeStageQuestions,
    makeTimeAttackQuestions,
    validate
  });
}(typeof globalThis !== 'undefined' ? globalThis : window));
