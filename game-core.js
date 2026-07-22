(function (global) {
  'use strict';

  const STATE_VERSION = 4;
  const STORE_KEY = 'lumina_state_v1';
  const STAGE_ROUNDS = 8;
  const TIME_ATTACK_ROUNDS = 12;
  const TIME_ATTACK_PENALTY_MS = 3000;

  function stage(id, n, name, skill, canonicalSkillId, action, part, symbol) {
    return { id, n, name, skill, canonicalSkillId, action, part, symbol };
  }

  const NUMBER_STAGES = [
    stage('num_classify', 1, '1から5まで', '1〜5の数', 'g1.number.to5.intro', 'おなじ まるを かぞえて、すうじを えらぶ', 'かずの しるし', '1'),
    stage('num_pair', 2, 'どちらが おおい？', '同じ・多い・少ない', 'g1.number.one_to_one', 'ふたつの かずを ひとつずつ くらべる', 'くらべた しるし', '↔'),
    stage('num_to5', 3, '5までの かず', '1〜5の数', 'g1.number.to5', '1から5までを かぞえて こたえる', '5までの しるし', '5'),
    stage('num_to10', 4, '10までの かず', '6〜10の数', 'g1.number.to10', '6から10までを かぞえて こたえる', '10までの しるし', '10'),
    stage('num_check', 5, '1から10の おさらい', '1〜10の確認', 'g1.number.to10.review', 'いろいろな かぞえかたで たしかめる', 'おさらいの しるし', '✓'),
    stage('num_zero_bonds', 6, '0と かずわけ', '0と数の合成・分解', 'g1.number.zero_bonds', 'ふたつの かずで、もとの かずを つくる', 'かずわけの しるし', '◇'),
    stage('num_order', 7, 'かずの じゅんばん', '数の順序と大小', 'g1.number.order_compare', 'すうじを ちいさい じゅんに ならべる', 'ならびの しるし', '⇢'),
    stage('num_ordinal', 8, 'なんばんめ？', '順序数と位置', 'g1.number.ordinal_position', 'どこに あるかを かぞえて こたえる', 'なんばんめの しるし', '◎'),
    stage('num_to20', 9, '20までの かず', '10といくつ・まとまり', 'g1.number.to20', '10の まとまりと、ばらを かぞえる', '20までの しるし', '20'),
    stage('num_to100', 10, '100までの かず', '十の位・一の位', 'g1.number.to100', '10の まとまりと、ばらで かずを つくる', '100までの しるし', '100'),
    stage('num_core', 11, 'かずの まとめ', '数の総合確認', 'g1.number.review', 'いろいろな かずの みかたを たしかめる', 'かずの まとめしるし', '★')
  ];

  const ADDITION_STAGES = [
    stage('garden', 1, 'たしざんの じゅんび', '二つの数を合わせる準備', 'g1.add.count', '二つの まるの まとまりを あわせて かぞえる', 'あわせた しるし', '◉'),
    stage('pairs', 2, 'たしざんの かずわけ', '5・7・10を作る', 'g1.add.bonds', 'たしざんで つかう かずの わけかたを ためす', 'かずわけの しるし', '↔'),
    stage('delivery', 3, 'あわせると いくつ？', '絵の足し算', 'g1.add.combine', 'ふたつの かずを あわせて こたえる', 'あわせた しるし', '＋'),
    stage('numbers', 4, '10までの たしざん', '10までの足し算', 'g1.add.to10', 'しきを みて、かずの せんを すすむ', 'たしざんの しるし', '＋'),
    stage('gate', 5, 'たしざん おさらい', '足し算基礎の確認', 'g1.add.to10.review', 'いろいろな たしざんを たしかめる', 'おさらいの しるし', '✓'),
    stage('lanterns', 6, '20までの たしざんの じゅんび', '20までの数', 'g1.add.to20.count', '10の まとまりと、ばらで たしざんの じゅんびを する', '20までの しるし', '▦'),
    stage('blocks', 7, '20までの たしざん', '20までの足し算', 'g1.add.to20', 'ふたつの かずを たして こたえる', '20のたしざん しるし', '⌁'),
    stage('kitchen', 8, '3つの かずを たす', '3つの数の足し算', 'g1.add.three_numbers', '3つの かずを じゅんに たす', '3つのかずの しるし', '△'),
    stage('circuit', 9, 'たしざん れんしゅう', '足し算の反復', 'g1.add.fluency', 'いろいろな たしざんに こたえる', 'れんしゅうの しるし', '⌇'),
    stage('lift', 10, '10を つくって たす', '繰り上がりの足し算', 'g1.add.make_ten', '10の まとまりを つくって たす', '10づくりの しるし', '10'),
    stage('core', 11, 'たしざんの まとめ', '足し算の総合確認', 'g1.add.review', 'え・しき・おはなしの たしざんを たしかめる', 'たしざんの まとめしるし', '★')
  ];

  const SUBTRACTION_STAGES = [
    stage('sub_bonds', 1, 'ひきざんの かずわけ', '5・7・10の数の組', 'g1.sub.bonds', 'ひきざんで つかう かずの わけかたを ためす', 'かずわけの しるし', '◇'),
    stage('sub_remove', 2, 'のこりは いくつ？', '絵で理解する引き算', 'g1.sub.remove', 'いくつか とって、のこりを こたえる', 'のこりの しるし', '−'),
    stage('sub_zero', 3, '0の ひきざん', '0を引く・全部を引く', 'g1.sub.zero_same', '0を ひくときと、ぜんぶ ひくときを かんがえる', '0の しるし', '0'),
    stage('sub_gear', 4, '10までの ひきざん', '10までの引き算', 'g1.sub.to10', 'しきを みて、かずの せんを もどる', 'ひきざんの しるし', '−'),
    stage('sub_gate', 5, 'ひきざん おさらい', '引き算基礎の確認', 'g1.sub.to10.review', 'いろいろな ひきざんを たしかめる', 'おさらいの しるし', '✓'),
    stage('sub_teens', 6, '20までの ひきざん', '20までの引き算', 'g1.sub.to20', '20までの かずから ひいて こたえる', '20のひきざん しるし', '▦'),
    stage('sub_sequence', 7, '3つの かず', '3つの数の加減', 'g1.sub.three_numbers', '3つの かずを じゅんに たしたり ひいたりする', '3つのかずの しるし', '⇢'),
    stage('sub_bridge', 8, '10を つかって ひく', '繰り下がりの引き算', 'g1.sub.borrow', '10の まとまりを つかって ひく', '10をつかう しるし', '10'),
    stage('sub_route', 9, 'かずのせんで ひく', '数直線で戻る', 'g1.sub.number_line', 'かずの せんを もどって こたえる', 'かずのせんの しるし', '↶'),
    stage('sub_meter', 10, '100までの ひきざん', '位取りと簡単な引き算', 'g1.sub.to100', '10の まとまりと、ばらを みて ひく', '100までの しるし', '100'),
    stage('sub_core', 11, 'ひきざんの まとめ', '引き算の総合確認', 'g1.sub.review', 'のこり・ちがい・しきを たしかめる', 'ひきざんの まとめしるし', '★')
  ];

  const MEASURE_STAGES = [
    stage('measure_length_direct', 1, 'どちらが ながい？', '長さの直接比較', 'g1.measure.length.direct', 'はしを そろえて、2ほんの ながさを くらべる', 'ながさの しるし', '↕'),
    stage('measure_length_indirect', 2, 'うつして くらべよう', '長さの間接比較', 'g1.measure.length.indirect', 'テープに うつして、ながさを くらべる', 'うつした しるし', '〰'),
    stage('measure_length_unit', 3, 'ブロックで はかろう', '任意単位で長さを表す', 'g1.measure.length.unit', 'おなじ ブロックを すきまなく ならべる', 'はかった しるし', '▤'),
    stage('measure_method', 4, 'どうやって くらべる？', '比較方法を選ぶ', 'g1.measure.method', 'ものに あう くらべかたを えらぶ', 'くらべ方の しるし', '⌘'),
    stage('measure_length_check', 5, 'ながさの おさらい', '長さ比較の確認', 'g1.measure.length.review', 'いろいろな ながさの くらべかたを たしかめる', 'ながさの おさらいしるし', '✓'),
    stage('measure_capacity', 6, 'どちらが おおい？', 'かさを比べる', 'g1.measure.capacity', 'おなじ カップで、はいる りょうを くらべる', 'かさの しるし', '◒'),
    stage('measure_area', 7, 'どちらが ひろい？', '広さを比べる', 'g1.measure.area', 'おなじ マスの かずで、ひろさを くらべる', 'ひろさの しるし', '▦'),
    stage('measure_hour', 8, 'なんじ？', '何時を読む', 'g1.time.hour', 'とけいを みて こたえたり、はりを うごかしたりする', 'なんじの しるし', '◷'),
    stage('measure_half', 9, 'なんじはん？', '何時半を読む', 'g1.time.half_hour', 'なんじはんか こたえたり、はりを うごかしたりする', 'なんじはんの しるし', '◴'),
    stage('measure_minute', 10, 'なんじなんぷん？', '何時何分を読む', 'g1.time.minute', 'じこくを こたえたり、はりを うごかしたりする', 'じこくの しるし', '◶'),
    stage('measure_core', 11, 'くらべる まとめ', '計測の総合確認', 'g1.measure.review', 'ながさ・かさ・ひろさ・じこくを たしかめる', 'くらべる まとめしるし', '★')
  ];

  const SHAPE_STAGES = [
    stage('shape_find', 1, 'にている かたち', '身の回りの形', 'g1.shape.find', 'ものと にている かたちを えらぶ', 'かたちの しるし', '○'),
    stage('shape_function', 2, 'ころがる？ つめる？', '立体の働き', 'g1.shape.function', 'ころがるか、つめるかを かんがえる', 'うごきの しるし', '◫'),
    stage('shape_sort', 3, 'かたちを わけよう', '立体の分類', 'g1.shape.sort_solids', 'かたちの とくちょうで わける', 'なかまの しるし', '▣'),
    stage('shape_faces', 4, 'うつる かたち', '立体の面と平面図形', 'g1.shape.faces', 'ものの めんを うつした かたちを えらぶ', 'めんの しるし', '□'),
    stage('shape_solids_check', 5, 'かたちの おさらい', '立体の特徴の確認', 'g1.shape.solids.review', 'いろいろな かたちを たしかめる', 'おさらいの しるし', '✓'),
    stage('shape_tiles', 6, 'いろいたで つくろう', '色板で形を作る', 'g1.shape.compose_tiles', 'みほんと おなじ かたちを つくる', 'いろいたの しるし', '◆'),
    stage('shape_decompose', 7, 'かたちを わけよう', '形の分解・移動・回転', 'g1.shape.decompose', 'かたちを わけたり、うごかしたりする', 'かたちわけの しるし', '◩'),
    stage('shape_sticks', 8, 'ぼうを えらぼう', '棒で形を作る', 'g1.shape.compose_sticks', 'かたちに ひつような ぼうを えらぶ', 'ぼうの しるし', '△'),
    stage('shape_dots', 9, 'てんで つくろう', '点を結んで形を作る', 'g1.shape.dot_grid', 'てんを えらんで かたちを つくる', 'てんの しるし', '⠿'),
    stage('shape_position', 10, 'どこに ある？', '上下・左右・前後', 'g1.shape.position', 'うえ・した・ひだり・みぎを かんがえる', 'ばしょの しるし', '⌖'),
    stage('shape_core', 11, 'かたちの まとめ', '形の総合確認', 'g1.shape.review', 'いろいろな かたちを たしかめる', 'かたちの まとめしるし', '★')
  ];

  const SOLVE_STAGES = [
    stage('solve_classify', 1, 'かたちを わけよう', '形を特徴で分類する', 'g1.data.classify', 'かたちの とくちょうで なかまに わける', 'なかまの しるし', '◌'),
    stage('solve_align', 2, 'ならべて くらべよう', '並べて個数を比べる', 'g1.data.align', 'カードを いちれつに ならべて かぞえる', 'ならべた しるし', '▥'),
    stage('solve_pictograph', 3, 'えグラフを つくろう', '絵グラフを作る', 'g1.data.pictograph', 'しるしを ならべて グラフを つくる', 'グラフの しるし', '▤'),
    stage('solve_read', 4, 'グラフを よもう', 'グラフを読み取る', 'g1.data.read', 'どれが おおいか、すくないかを こたえる', 'よみとった しるし', '▧'),
    stage('solve_data_check', 5, 'グラフの おさらい', '分類とグラフの確認', 'g1.data.review', 'カードと グラフを たしかめる', 'おさらいの しるし', '✓'),
    stage('solve_operation', 6, 'たす？ ひく？', '場面から演算を選ぶ', 'g1.problem.operation_choice', 'おはなしを みて、たすか ひくかを えらぶ', 'たすひくの しるし', '±'),
    stage('solve_model', 7, 'おはなしと しき', '文章を式にする', 'g1.problem.model', 'おはなしに あう しきを えらぶ', 'しきの しるし', '＝'),
    stage('solve_relation', 8, 'ぜんぶと いくつか', '数量の関係を図で考える', 'g1.problem.relation', 'ぜんぶの かずと、わけた かずを かんがえる', 'かんけいの しるし', '⊕'),
    stage('solve_match', 9, 'え・しき・おはなし', '図・式・文章の対応', 'g1.problem.match', 'おなじ ことを あらわす ものを えらぶ', 'つながりの しるし', '⌇'),
    stage('solve_groups', 10, 'おなじ かずずつ', '同じ数ずつまとめる・分ける', 'g1.problem.equal_groups', 'おなじ かずずつに わける', 'わけた しるし', '∷'),
    stage('solve_core', 11, 'おはなしの まとめ', '表・図・式・文章の総合', 'g1.problem.review', 'グラフ・え・しき・おはなしを たしかめる', 'おはなしの まとめしるし', '★')
  ];

  const ZONES = [
    { n: 'A', name: 'きそ作業台', note: '見て、動かして、仕組みをつかむ', range: [0, 3] },
    { n: 'B', name: '組み替えフロア', note: '違う見方へ切り替える', range: [4, 7] },
    { n: 'C', name: '応用検査室', note: '場面で使い、コアを完成する', range: [8, 10] }
  ];

  const LINES = {
    number: { id: 'number', name: 'かず', short: 'かず', symbol: '123', accent: '#27c2a4', pale: '#dffaf4', stages: NUMBER_STAGES, zones: ZONES, description: 'かずを かぞえる、くらべる、じゅんに ならべる。' },
    addition: { id: 'addition', name: 'たしざん', short: 'たしざん', symbol: '＋', accent: '#ff7b54', pale: '#fff0e9', stages: ADDITION_STAGES, zones: ZONES, description: 'ふたつの かずを あわせて、ぜんぶで いくつか かんがえる。' },
    subtraction: { id: 'subtraction', name: 'ひきざん', short: 'ひきざん', symbol: '−', accent: '#ee5f8a', pale: '#ffe9f0', stages: SUBTRACTION_STAGES, zones: ZONES, description: 'いくつか とって、のこりや ちがいを かんがえる。' },
    measure: { id: 'measure', name: 'ながさ・とけい', short: 'くらべる', symbol: '↕', accent: '#2e9be8', pale: '#e7f5ff', stages: MEASURE_STAGES, zones: ZONES, description: 'ながさ・かさ・ひろさを くらべて、とけいを よむ。' },
    shape: { id: 'shape', name: 'かたち', short: 'かたち', symbol: '◆', accent: '#8b70e8', pale: '#f0ecff', stages: SHAPE_STAGES, zones: ZONES, description: 'ころがす、つむ、ならべる。かたちを よく みる。' },
    solve: { id: 'solve', name: 'おはなし・グラフ', short: 'しらべる', symbol: '▥', accent: '#e5a31a', pale: '#fff6db', stages: SOLVE_STAGES, zones: ZONES, description: 'カードや グラフを しらべて、おはなしに あう しきを かんがえる。' }
  };

  const ISLANDS = LINES;
  const LINE_ORDER = ['number', 'addition', 'subtraction', 'measure', 'shape', 'solve'];

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
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      const temp = copy[i];
      copy[i] = copy[j];
      copy[j] = temp;
    }
    return copy;
  }

  function optionValue(option) {
    return typeof option === 'object' && option !== null ? option.value : option;
  }

  function semanticOptionContract(options) {
    const values = (options || []).map(optionValue).map(String);
    const families = [
      { layout: 'horizontal-axis', orders: [
        ['ひだり', 'みぎ'], ['左', '右'],
        ['ひだり', 'おなじ', 'みぎ'], ['左', 'おなじ', '右'],
        ['左', '真ん中', '右'], ['ひだり', 'まんなか', 'みぎ'],
        ['すくない', 'おおい'], ['少ない', '多い'],
        ['すくない', 'おなじ', 'おおい'], ['少ない', 'おなじ', '多い']
      ] },
      { layout: 'vertical-axis', orders: [
        ['上', '下'], ['うえ', 'した'],
        ['上', '真ん中', '下'], ['うえ', 'まんなか', 'した'], ['上', 'おなじ', '下']
      ] },
      { layout: 'depth-axis', orders: [
        ['前', '後ろ'], ['まえ', 'うしろ'], ['前', '真ん中', '後ろ'], ['まえ', 'まんなか', 'うしろ']
      ] },
      { layout: 'relation', orders: [['＜', '＝', '＞']] }
    ];
    for (let familyIndex = 0; familyIndex < families.length; familyIndex += 1) {
      const family = families[familyIndex];
      for (let orderIndex = 0; orderIndex < family.orders.length; orderIndex += 1) {
        const order = family.orders[orderIndex];
        if (order.length === values.length && order.every(function (value) { return values.includes(value); })) {
          return { policy: 'fixed', layout: family.layout, order: order.slice() };
        }
      }
    }
    return null;
  }

  function applySemanticOrder(options, order) {
    if (!order || !order.length) return options.slice();
    return order.map(function (value) {
      return options.find(function (option) { return String(optionValue(option)) === value; });
    });
  }

  function answerEquals(expected, actual) {
    if (Array.isArray(expected)) {
      const left = expected.map(String).sort().join('|');
      const right = (Array.isArray(actual) ? actual : String(actual).split(',')).map(String).sort().join('|');
      return left === right;
    }
    return String(expected) === String(actual);
  }

  function numberChoices(correct, min, max, count, rng) {
    const result = new Set([correct]);
    const offsets = shuffle([-5, -4, -3, -2, -1, 1, 2, 3, 4, 5, 10, -10], rng);
    let cursor = 0;
    while (result.size < (count || 4) && cursor < offsets.length) {
      const value = Math.max(min, Math.min(max, correct + offsets[cursor]));
      result.add(value);
      cursor += 1;
    }
    while (result.size < (count || 4)) result.add(rand(min, max, rng));
    return shuffle(Array.from(result), rng);
  }

  function hashString(value) {
    let hash = 2166136261;
    const text = String(value);
    for (let i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  function questionSignature(question) {
    const optionSet = (question.options || []).map(optionValue).map(String).sort();
    const visual = question.visual || {};
    const semantic = {
      skill: question.canonicalSkillId,
      kind: question.kind,
      prompt: question.prompt,
      instruction: question.instruction,
      correct: question.correct,
      options: optionSet,
      visual,
      math: question.math || null,
      template: question.templateId || null,
      story: question.story || false
    };
    return hashString(JSON.stringify(semantic));
  }

  function questionContentSignature(question) {
    return hashString(JSON.stringify({
      skill: question.canonicalSkillId,
      kind: question.kind,
      prompt: question.prompt,
      instruction: question.instruction,
      correct: question.correct,
      visual: question.visual || {},
      math: question.math || null,
      template: question.templateId || null,
      story: Boolean(question.story)
    }));
  }

  function finalizeQuestion(data, rng) {
    const question = Object.assign({
      kind: 'choice',
      prompt: '',
      instruction: 'こたえを えらぼう',
      correct: 0,
      options: [],
      hint: 'よく見て、もういちど ためそう。',
      explain: '',
      visual: { type: 'machine' },
      story: false,
      checkpoint: false,
      speedSafe: true,
      templateId: '',
      interactionFamily: '',
      optionPolicy: 'shuffle',
      optionLayout: 'neutral',
      input: '',
      selected: [],
      orderSelected: [],
      attempts: 0,
      feedback: null,
      showHint: false
    }, data);
    const optionContract = semanticOptionContract(question.options);
    if (optionContract) {
      question.optionPolicy = optionContract.policy;
      question.optionLayout = optionContract.layout;
      question.options = applySemanticOrder(question.options, optionContract.order);
    }
    if (question.options && question.options.length && question.optionPolicy !== 'fixed') question.options = shuffle(question.options, rng);
    question.signature = questionSignature(question);
    return question;
  }

  function retagQuestion(question, extra) {
    Object.assign(question, extra || {});
    question.signature = questionSignature(question);
    return question;
  }

  function numericQuestion(config, rng) {
    const correct = config.correct;
    const kind = config.kind || 'slider';
    const usesOptions = kind === 'choice' || kind === 'route' || kind === 'sort';
    return finalizeQuestion(Object.assign({
      kind: kind,
      options: usesOptions ? numberChoices(correct, config.min == null ? 0 : config.min, config.max == null ? Math.max(20, correct + 5) : config.max, 4, rng) : [],
      input: config.start == null ? '' : config.start,
      min: config.min == null ? 0 : config.min,
      max: config.max == null ? 20 : config.max,
      step: config.step || 1
    }, config), rng);
  }

  const PARTS = ['🔩', '⚙️', '💡', '🔋', '🔧', '🟦', '🟡', '🟢'];
  const SOLIDS = [
    { name: 'はこ', icon: '▣', feature: 'つめる', face: 'しかく' },
    { name: 'さいころ', icon: '▦', feature: 'つめる', face: 'しかく' },
    { name: 'つつ', icon: '▥', feature: 'ころがる', face: 'まる' },
    { name: 'ボール', icon: '●', feature: 'ころがる', face: 'まる' }
  ];

  const SHAPE_ACTION_CASES = [
    { name: 'ティッシュの はこ', icon: '▣', correct: 'つめる' },
    { name: 'さいころ', icon: '▦', correct: 'つめる' },
    { name: 'しかくい ブロック', icon: '▣', correct: 'つめる' },
    { name: 'けしゴム', icon: '▣', correct: 'つめる' },
    { name: 'えほん', icon: '▣', correct: 'つめる' },
    { name: 'しかくい つみき', icon: '▣', correct: 'つめる' },
    { name: 'ボール', icon: '●', correct: 'ころがる' },
    { name: 'ビーだま', icon: '●', correct: 'ころがる' },
    { name: 'テニスボール', icon: '●', correct: 'ころがる' },
    { name: 'ピンポンだま', icon: '●', correct: 'ころがる' },
    { name: 'スーパーボール', icon: '●', correct: 'ころがる' },
    { name: 'まるい たま', icon: '●', correct: 'ころがる' },
    { name: 'かん', icon: '▥', correct: 'どちらも' },
    { name: 'かみの つつ', icon: '▥', correct: 'どちらも' },
    { name: 'テープの しん', icon: '▥', correct: 'どちらも' },
    { name: 'まるい のり', icon: '▥', correct: 'どちらも' },
    { name: 'トイレットペーパー', icon: '▥', correct: 'どちらも' },
    { name: 'まるい つつ', icon: '▥', correct: 'どちらも' }
  ];

  const SHAPE_FACE_CASES = [
    { name: 'ティッシュの はこの そこ', icon: '▣', face: 'しかく' },
    { name: 'さいころの めん', icon: '▦', face: 'しかく' },
    { name: 'しかくい ブロックの めん', icon: '▣', face: 'しかく' },
    { name: 'ちいさい はこの そこ', icon: '▣', face: 'しかく' },
    { name: 'けしゴムの ひらたい めん', icon: '▣', face: 'しかく' },
    { name: 'えほんの おもて', icon: '▣', face: 'しかく' },
    { name: 'つみきの ひらたい めん', icon: '▣', face: 'しかく' },
    { name: 'おかしの はこの そこ', icon: '▣', face: 'しかく' },
    { name: 'カードの おもて', icon: '▣', face: 'しかく' },
    { name: 'かんの そこ', icon: '▥', face: 'まる' },
    { name: 'かみの つつの はし', icon: '▥', face: 'まる' },
    { name: 'テープの しんの はし', icon: '▥', face: 'まる' },
    { name: 'まるい コップの そこ', icon: '▥', face: 'まる' },
    { name: 'ペットボトルの ふた', icon: '▥', face: 'まる' },
    { name: 'まるい のりの そこ', icon: '▥', face: 'まる' },
    { name: 'トイレットペーパーの はし', icon: '▥', face: 'まる' },
    { name: 'びんの そこ', icon: '▥', face: 'まる' },
    { name: 'まるい おさらの そこ', icon: '▥', face: 'まる' }
  ];

  function selectorQuestion(target, total, config, rng) {
    return finalizeQuestion(Object.assign({
      kind: 'tap',
      correct: target,
      input: 0,
      instruction: String(target) + 'こ えらんで「けってい」',
      visual: { type: 'selector', total, icons: Array.from({ length: total }, function () { return 'count-dot'; }) }
    }, config), rng);
  }

  function buildNumberQuestion(stageIndex, round, rng) {
    if (stageIndex === 0) {
      const n = rand(1, 5, rng);
      const variant = round % 4;
      if (variant === 1) {
        return selectorQuestion(n, 5, {
          canonicalSkillId: NUMBER_STAGES[0].canonicalSkillId,
          prompt: n + 'この まるを えらぼう。',
          instruction: 'まるを ' + n + 'こ タップして「けってい」',
          visual: { type: 'selector', total: 5, icons: ['count-dot', 'count-dot', 'count-dot', 'count-dot', 'count-dot'] },
          hint: 'タップした まるを、1から かぞえよう。',
          explain: 'まるを ' + n + 'こ えらべたね。',
          templateId: 'number.to5.tap',
          interactionFamily: 'number.to5:tap'
        }, rng);
      }
      if (variant === 2) {
        return numericQuestion({
          canonicalSkillId: NUMBER_STAGES[0].canonicalSkillId,
          kind: 'input',
          prompt: 'まるは いくつ？',
          instruction: 'かぞえて、すうじを いれよう',
          correct: n,
          min: 1,
          max: 5,
          visual: { type: 'five-frame', count: n },
          hint: 'ひだりから、1、2、と かぞえよう。',
          explain: 'まるは ' + n + 'こ。すうじでは「' + n + '」だよ。',
          templateId: 'number.to5.frame',
          interactionFamily: 'number.to5:input'
        }, rng);
      }
      if (variant === 3) {
        return numericQuestion({
          canonicalSkillId: NUMBER_STAGES[0].canonicalSkillId,
          kind: 'slider',
          prompt: 'まるは いくつ？',
          instruction: '−と＋で かずを あわせよう',
          correct: n,
          min: 1,
          max: 5,
          start: 1,
          visual: { type: 'objects', count: n, icon: 'count-dot' },
          hint: 'まるを ひとつずつ かぞえよう。',
          explain: 'まるは ' + n + 'こだね。',
          templateId: 'number.to5.adjust',
          interactionFamily: 'number.to5:adjust'
        }, rng);
      }
      return numericQuestion({
        canonicalSkillId: NUMBER_STAGES[0].canonicalSkillId,
        kind: 'choice',
        prompt: 'まるは いくつ？',
        instruction: 'かぞえて、すうじを えらぼう',
        correct: n,
        min: 1,
        max: 5,
        visual: { type: 'objects', count: n, icon: 'count-dot' },
        hint: 'ひだりから、まるを ひとつずつ かぞえよう。',
        explain: 'まるは ' + n + 'こ。すうじでは「' + n + '」だよ。',
        templateId: 'number.to5.choice',
        interactionFamily: 'number.to5:choice'
      }, rng);
    }
    if (stageIndex === 1) {
      const left = rand(2, 9, rng);
      const delta = pick([-2, -1, 0, 1, 2], rng);
      const right = Math.max(1, Math.min(10, left + delta));
      const correct = left === right ? 'おなじ' : left > right ? 'ひだり' : 'みぎ';
      return finalizeQuestion({
        canonicalSkillId: NUMBER_STAGES[1].canonicalSkillId,
        kind: 'choice',
        prompt: 'まるが おおいのは どっち？',
        instruction: '「ひだり」「おなじ」「みぎ」から えらぼう',
        correct,
        options: ['ひだり', 'おなじ', 'みぎ'],
        visual: { type: 'compare-groups', left, right },
        hint: 'ひだりと みぎを、ひとつずつ くみあわせよう。',
        explain: left + 'こと' + right + 'こだから、' + correct + 'だよ。'
      }, rng);
    }
    if (stageIndex === 2 || stageIndex === 3) {
      const max = stageIndex === 2 ? 5 : 10;
      const min = stageIndex === 2 ? 1 : 6;
      const n = rand(min, max, rng);
      const variant = round % 4;
      if (variant === 0) {
        return selectorQuestion(n, max, {
          canonicalSkillId: NUMBER_STAGES[stageIndex].canonicalSkillId,
          prompt: 'まるを ' + n + 'こ えらぼう。',
          hint: 'えらんだ まるを、ひとつずつ かぞえよう。',
          explain: 'まるを ' + n + 'こ えらべたね。'
        }, rng);
      }
      return numericQuestion({
        canonicalSkillId: NUMBER_STAGES[stageIndex].canonicalSkillId,
        kind: variant === 1 ? 'choice' : variant === 2 ? 'slider' : 'input',
        prompt: 'まるは ぜんぶで いくつ？',
        instruction: variant === 1 ? 'かぞえて、すうじを えらぼう' : variant === 2 ? '−と＋で かずを あわせよう' : 'かぞえて、すうじを いれよう',
        correct: n,
        min: 0,
        max,
        start: 0,
        visual: { type: 'objects', count: n, icon: 'count-dot' },
        templateId: variant === 1 ? 'number.count.choice' : variant === 2 ? 'number.count.adjust' : 'number.count.input',
        interactionFamily: variant === 1 ? 'number.count:choice' : variant === 2 ? 'number.count:adjust' : 'number.count:input',
        hint: 'ひだりから ひとつずつ かぞえよう。',
        explain: 'かぞえると ' + n + 'こ。すうじの「' + n + '」と おなじだよ。'
      }, rng);
    }
    if (stageIndex === 4) {
      const q = buildNumberQuestion(round % 4, round + 3, rng);
      return retagQuestion(q, { checkpoint: true, assessmentFor: NUMBER_STAGES[4].canonicalSkillId });
    }
    if (stageIndex === 5) {
      const target = pick([5, 6, 7, 8, 9, 10], rng);
      const known = rand(0, target, rng);
      const missing = target - known;
      return numericQuestion({
        canonicalSkillId: NUMBER_STAGES[5].canonicalSkillId,
        kind: round % 2 ? 'slider' : 'tap',
        prompt: target + 'こに するには、あと いくつ 入れる？',
        correct: missing,
        min: 0,
        max: target,
        start: 0,
        visual: { type: 'bond', target, known, missing },
        hint: known + 'こから、' + target + 'こまで 数えてみよう。',
        explain: known + 'と' + missing + 'で' + target + '。空でも0という数で表せるよ。',
        math: { kind: 'bond', target, known, result: missing }
      }, rng);
    }
    if (stageIndex === 6) {
      const start = rand(0, 15, rng);
      const values = [start, start + 1, start + 2, start + 3];
      if (round % 2 === 0) {
        const shuffled = shuffle(values, rng);
        return finalizeQuestion({
          canonicalSkillId: NUMBER_STAGES[6].canonicalSkillId,
          kind: 'order',
          prompt: 'すうじを ちいさい じゅんに ならべよう。',
          instruction: 'すうじを じゅんばんに タップして「けってい」',
          correct: values.join(','),
          options: shuffled,
          visual: { type: 'rail', min: start, max: start + 3 },
          hint: 'いちばん ちいさい かずから、ひとつずつ おおきくしよう。',
          explain: values.join('、') + 'の じゅんだね。'
        }, rng);
      }
      const missingIndex = rand(1, 2, rng);
      const correct = values[missingIndex];
      const shown = values.map((v, i) => i === missingIndex ? '?' : v);
      return numericQuestion({
        canonicalSkillId: NUMBER_STAGES[6].canonicalSkillId,
        kind: 'route',
        prompt: '「？」に はいる かずは？',
        correct,
        min: Math.max(0, start - 2),
        max: start + 5,
        visual: { type: 'number-line', values: shown },
        hint: 'ひとつずつ おおきくなる かずの ならびだよ。',
        explain: shown.join('、').replace('?', String(correct)) + 'と ならぶよ。'
      }, rng);
    }
    if (stageIndex === 7) {
      const row = shuffle(['1', '2', '3', '4', '5'], rng);
      const fromRight = round % 2 === 1;
      const ordinal = rand(1, 5, rng);
      const index = fromRight ? row.length - ordinal : ordinal - 1;
      return finalizeQuestion({
        canonicalSkillId: NUMBER_STAGES[7].canonicalSkillId,
        kind: 'choice',
        prompt: (fromRight ? 'みぎ' : 'ひだり') + 'から ' + ordinal + 'ばんめは どれ？',
        correct: row[index],
        options: row,
        visual: { type: 'row', items: row, direction: fromRight ? 'right' : 'left' },
        hint: (fromRight ? '右' : '左') + 'の はしから「1、2…」と 数えよう。',
        explain: (fromRight ? '右' : '左') + 'から' + ordinal + 'ばんめは ' + row[index] + 'だよ。'
      }, rng);
    }
    if (stageIndex === 8) {
      if (round % 3 === 2) {
        const step = pick([2, 5], rng);
        const start = step === 2 ? pick([2, 4, 6], rng) : 5;
        const values = [start, start + step, start + step * 2, start + step * 3];
        const missing = rand(1, 3, rng);
        const correct = values[missing];
        const shown = values.map((v, i) => i === missing ? '?' : v);
        return numericQuestion({
          canonicalSkillId: NUMBER_STAGES[8].canonicalSkillId,
          kind: 'route',
          prompt: step + 'ずつ 数えると「？」は いくつ？',
          correct,
          min: 0,
          max: 20,
          visual: { type: 'number-line', values: shown },
          hint: '前の数に ' + step + 'を 足してみよう。',
          explain: values.join('、') + 'と 数えるよ。'
        }, rng);
      }
      const n = rand(11, 20, rng);
      return numericQuestion({
        canonicalSkillId: NUMBER_STAGES[8].canonicalSkillId,
        kind: round % 2 ? 'slider' : 'choice',
        prompt: '10の まとまりと、ばら。ぜんぶで いくつ？',
        correct: n,
        min: 10,
        max: 20,
        start: 10,
        visual: { type: 'ten-bundle', tens: 1, ones: n - 10 },
        hint: '10と、ばらの数を 合わせよう。',
        explain: '10と' + (n - 10) + 'で' + n + '。'
      }, rng);
    }
    if (stageIndex === 9) {
      const tens = rand(1, 10, rng);
      const ones = tens === 10 ? 0 : rand(0, 9, rng);
      const correct = tens * 10 + ones;
      if (round % 3 === 2) {
        const other = Math.max(10, Math.min(100, correct + pick([-10, -1, 1, 10], rng)));
        const relation = correct === other ? '＝' : correct > other ? '＞' : '＜';
        return finalizeQuestion({
          canonicalSkillId: NUMBER_STAGES[9].canonicalSkillId,
          kind: 'choice',
          prompt: correct + 'と' + other + 'を くらべよう。',
          correct: relation,
          options: ['＜', '＝', '＞'],
          visual: { type: 'place-value-compare', left: correct, right: other },
          hint: 'まず 十の位を くらべよう。',
          explain: correct + relation + other + 'だよ。'
        }, rng);
      }
      return numericQuestion({
        canonicalSkillId: NUMBER_STAGES[9].canonicalSkillId,
        kind: round % 2 ? 'slider' : 'choice',
        prompt: '10の まとまりが' + tens + 'こ、ばらが' + ones + 'こ。いくつ？',
        correct,
        min: 0,
        max: 100,
        step: 1,
        start: tens * 10,
        visual: { type: 'place-value', tens, ones },
        hint: '10の まとまりで' + (tens * 10) + '。そこへ ばらを あわせよう。',
        explain: (tens * 10) + 'と' + ones + 'で' + correct + '。'
      }, rng);
    }
    const pool = [5, 6, 7, 8, 9];
    const q = buildNumberQuestion(pool[round % pool.length], round + 7, rng);
    return retagQuestion(q, { checkpoint: true, assessmentFor: NUMBER_STAGES[10].canonicalSkillId, story: round === 6 });
  }

  function additionValues(max, carry, rng) {
    let a;
    let b;
    if (carry) {
      a = rand(6, 9, rng);
      b = rand(Math.max(2, 11 - a), 9, rng);
    } else if (max <= 10) {
      a = rand(1, 8, rng);
      b = rand(1, max - a, rng);
    } else {
      do {
        a = rand(10, 18, rng);
        b = rand(1, 9, rng);
      } while (a + b > max || (a % 10) + b > 9);
    }
    return [a, b, a + b];
  }

  function additionStory(max, carry, rng) {
    const values = additionValues(max, carry, rng);
    const scenes = [
      ['あかい おはじき', 'あおい おはじき', 'はこ'],
      ['あさに ひろった どんぐり', 'ひるに ひろった どんぐり', 'ふくろ'],
      ['あかい つみき', 'きいろい つみき', 'はこ']
    ];
    const scene = pick(scenes, rng);
    return numericQuestion({
      canonicalSkillId: carry ? ADDITION_STAGES[9].canonicalSkillId : ADDITION_STAGES[max <= 10 ? 2 : 6].canonicalSkillId,
      kind: 'choice',
      prompt: scene[2] + 'に ' + scene[0] + 'が' + values[0] + 'こ、' + scene[1] + 'が' + values[1] + 'こ。ぜんぶで なんこ？',
      correct: values[2],
      min: 0,
      max,
      story: true,
      visual: { type: 'story', icons: ['count-dot', 'count-dot'], counts: [values[0], values[1]], operation: '+' },
      hint: '「ぜんぶで」だから、二つの数を 合わせよう。',
      explain: values[0] + '＋' + values[1] + '＝' + values[2] + '。ぜんぶで' + values[2] + 'こ。',
      math: { kind: 'add', a: values[0], b: values[1], result: values[2] }
    }, rng);
  }

  function buildAdditionQuestion(stageIndex, round, rng) {
    if ((stageIndex >= 2 && stageIndex !== 4 && stageIndex !== 5 && stageIndex !== 8 && stageIndex !== 10) && round === 6) {
      return additionStory(stageIndex >= 6 ? 20 : 10, stageIndex === 9, rng);
    }
    if (stageIndex === 0) {
      const n = rand(2, 10, rng);
      const variant = round % 3;
      if (variant === 0) {
        return selectorQuestion(n, 10, {
          canonicalSkillId: ADDITION_STAGES[0].canonicalSkillId,
          prompt: 'まるを ' + n + 'こ えらぼう。',
          hint: 'えらんだ まるを、ひとつずつ かぞえよう。',
          explain: 'まるを ' + n + 'こ えらべたね。',
          templateId: 'addition.count.tap',
          interactionFamily: 'addition.count:tap'
        }, rng);
      }
      return numericQuestion({
        canonicalSkillId: ADDITION_STAGES[0].canonicalSkillId,
        kind: variant === 1 ? 'choice' : 'input',
        prompt: 'まるは いくつ？',
        instruction: variant === 1 ? 'かぞえて、すうじを えらぼう' : 'かぞえて、すうじを いれよう',
        correct: n,
        min: 1,
        max: 10,
        visual: { type: 'objects', count: n, icon: 'count-dot' },
        hint: 'ひだりから、ひとつずつ かぞえよう。',
        explain: 'まるは ' + n + 'こだね。',
        templateId: variant === 1 ? 'addition.count.choice' : 'addition.count.input',
        interactionFamily: variant === 1 ? 'addition.count:choice' : 'addition.count:input'
      }, rng);
    }
    if (stageIndex === 1) {
      const target = pick([5, 7, 10], rng);
      const known = rand(0, target, rng);
      const correct = target - known;
      return numericQuestion({
        canonicalSkillId: ADDITION_STAGES[1].canonicalSkillId,
        kind: round % 2 ? 'tap' : 'slider',
        prompt: target + 'こに したい。いま ' + known + 'こ。あと いくつ？',
        correct,
        min: 0,
        max: target,
        start: 0,
        visual: { type: 'bond', target, known },
        hint: known + 'から' + target + 'まで 数えよう。',
        explain: known + 'と' + correct + 'で' + target + '。',
        math: { kind: 'bond', target, known, result: correct }
      }, rng);
    }
    if (stageIndex === 2 || stageIndex === 3) {
      const values = additionValues(10, false, rng);
      return numericQuestion({
        canonicalSkillId: ADDITION_STAGES[stageIndex].canonicalSkillId,
        kind: stageIndex === 2 ? (round % 2 ? 'tap' : 'choice') : (round % 2 ? 'route' : 'slider'),
        prompt: stageIndex === 2 ? values[0] + 'こと ' + values[1] + 'こ。あわせると いくつ？' : values[0] + '＋' + values[1] + 'は いくつ？',
        correct: values[2],
        min: 0,
        max: 10,
        start: values[0],
        visual: { type: stageIndex === 2 ? 'merge' : 'dial', counts: [values[0], values[1]], operation: '+' },
        hint: values[0] + 'から' + values[1] + 'こ分、先へ進もう。',
        explain: values[0] + '＋' + values[1] + '＝' + values[2] + '。',
        math: { kind: 'add', a: values[0], b: values[1], result: values[2] }
      }, rng);
    }
    if (stageIndex === 4) {
      const q = buildAdditionQuestion(round % 4, round + 2, rng);
      return retagQuestion(q, { checkpoint: true, assessmentFor: ADDITION_STAGES[4].canonicalSkillId });
    }
    if (stageIndex === 5) {
      const n = rand(11, 20, rng);
      return numericQuestion({
        canonicalSkillId: ADDITION_STAGES[5].canonicalSkillId,
        kind: round % 2 ? 'choice' : 'slider',
        prompt: '10の まとまりと、ばら。ぜんぶで いくつ？',
        correct: n,
        min: 10,
        max: 20,
        start: 10,
        visual: { type: 'ten-bundle', tens: 1, ones: n - 10 },
        hint: '10と、ばらの数を 合わせよう。',
        explain: '10＋' + (n - 10) + '＝' + n + '。'
      }, rng);
    }
    if (stageIndex === 6) {
      const values = additionValues(20, false, rng);
      return numericQuestion({
        canonicalSkillId: ADDITION_STAGES[6].canonicalSkillId,
        kind: round % 2 ? 'slider' : 'choice',
        prompt: values[0] + 'こと ' + values[1] + 'こ。あわせると いくつ？',
        correct: values[2],
        min: 10,
        max: 20,
        start: values[0],
        visual: { type: 'crane', counts: [values[0], values[1]] },
        hint: '十のまとまりは そのまま。ばらを 合わせよう。',
        explain: values[0] + '＋' + values[1] + '＝' + values[2] + '。',
        math: { kind: 'add', a: values[0], b: values[1], result: values[2], mode: 'no-carry-20' }
      }, rng);
    }
    if (stageIndex === 7) {
      let a;
      let b;
      let c;
      do {
        a = rand(1, 8, rng);
        b = rand(1, 6, rng);
        c = rand(1, 6, rng);
      } while (a + b + c > 20);
      const correct = a + b + c;
      return numericQuestion({
        canonicalSkillId: ADDITION_STAGES[7].canonicalSkillId,
        kind: round % 2 ? 'route' : 'slider',
        prompt: a + 'こ、' + b + 'こ、' + c + 'こ。ぜんぶで いくつ？',
        correct,
        min: 0,
        max: 20,
        start: a,
        visual: { type: 'three-step', values: [a, b, c], ops: ['+', '+'] },
        hint: '左から、まず' + a + '＋' + b + 'を 計算しよう。',
        explain: a + '＋' + b + '＋' + c + '＝' + correct + '。',
        math: { kind: 'sequence', values: [a, b, c], ops: ['+', '+'], result: correct }
      }, rng);
    }
    if (stageIndex === 8) {
      const source = buildAdditionQuestion(round % 4 + 1, round + 5, rng);
      const correct = source.math && source.math.result != null ? source.math.result : source.correct;
      const options = numberChoices(Number(correct), 0, 20, 3, rng).map(function (value) {
        return { value, label: 'こたえ ' + value };
      });
      return finalizeQuestion({
        canonicalSkillId: ADDITION_STAGES[8].canonicalSkillId,
        kind: 'route',
        prompt: 'しきに 合う こたえは どれ？',
        correct,
        options,
        visual: { type: 'circuit', equation: source.prompt, paths: options.map(optionValue) },
        hint: source.hint,
        explain: source.explain,
        math: source.math
      }, rng);
    }
    if (stageIndex === 9) {
      const values = additionValues(20, true, rng);
      const need = 10 - values[0];
      const rest = values[1] - need;
      return numericQuestion({
        canonicalSkillId: ADDITION_STAGES[9].canonicalSkillId,
        kind: round % 2 ? 'slider' : 'tap',
        prompt: values[0] + '＋' + values[1] + '。まず10を作るには、' + values[1] + 'から いくつ動かす？',
        correct: need,
        min: 0,
        max: values[1],
        start: 0,
        visual: { type: 'make-ten', a: values[0], b: values[1], need, rest },
        hint: values[0] + 'は あと' + need + 'で10だよ。',
        explain: values[1] + 'を' + need + 'と' + rest + 'に分けると、10＋' + rest + '＝' + values[2] + '。',
        math: { kind: 'add', a: values[0], b: values[1], result: values[2], bridge: need }
      }, rng);
    }
    const pool = [1, 2, 3, 5, 6, 7, 8, 9];
    const q = round === 6 || round === 7 ? additionStory(20, round === 7, rng) : buildAdditionQuestion(pool[round % pool.length], round + 9, rng);
    return retagQuestion(q, { checkpoint: true, assessmentFor: ADDITION_STAGES[10].canonicalSkillId });
  }

  function subtractionValues(max, borrow, rng) {
    let a;
    let b;
    if (borrow) {
      a = rand(11, 18, rng);
      b = rand((a % 10) + 1, 9, rng);
    } else if (max <= 10) {
      a = rand(2, max, rng);
      b = rand(0, a, rng);
    } else {
      do {
        a = rand(11, max, rng);
        b = rand(1, 9, rng);
      } while (b > (a % 10));
    }
    return [a, b, a - b];
  }

  function subtractionStory(max, borrow, rng) {
    const values = subtractionValues(max, borrow, rng);
    const scenes = [
      ['おはじき', 'はこ'],
      ['どんぐり', 'ふくろ'],
      ['つみき', 'はこ']
    ];
    const scene = pick(scenes, rng);
    return numericQuestion({
      canonicalSkillId: borrow ? SUBTRACTION_STAGES[7].canonicalSkillId : SUBTRACTION_STAGES[max <= 10 ? 1 : 5].canonicalSkillId,
      kind: 'choice',
      prompt: scene[1] + 'に ' + scene[0] + 'が' + values[0] + 'こ。' + values[1] + 'こ取り出すと、のこりは？',
      correct: values[2],
      min: 0,
      max,
      story: true,
      visual: { type: 'story', icons: ['count-dot'], counts: [values[0], values[1]], operation: '-' },
      hint: 'はじめの数から、取り出した数を へらそう。',
      explain: values[0] + '−' + values[1] + '＝' + values[2] + '。のこりは' + values[2] + 'こ。',
      math: { kind: 'subtract', a: values[0], b: values[1], result: values[2] }
    }, rng);
  }

  function buildSubtractionQuestion(stageIndex, round, rng) {
    if ((stageIndex >= 1 && stageIndex !== 4 && stageIndex !== 8 && stageIndex !== 10) && round === 6) {
      return subtractionStory(stageIndex >= 5 ? 20 : 10, stageIndex === 7, rng);
    }
    if (stageIndex === 0) {
      const target = pick([5, 7, 10], rng);
      const left = rand(0, target, rng);
      const right = target - left;
      return numericQuestion({
        canonicalSkillId: SUBTRACTION_STAGES[0].canonicalSkillId,
        kind: round % 2 ? 'tap' : 'slider',
        prompt: target + 'こを 二つに分けるよ。片方が' + left + 'こなら、もう片方は？',
        correct: right,
        min: 0,
        max: target,
        start: 0,
        visual: { type: 'bond', target, known: left },
        hint: left + 'から' + target + 'まで 数えよう。',
        explain: left + 'と' + right + 'で' + target + '。',
        math: { kind: 'bond', target, known: left, result: right }
      }, rng);
    }
    if (stageIndex === 1) {
      const values = subtractionValues(10, false, rng);
      if (values[1] === 0) values[1] = 1;
      values[2] = values[0] - values[1];
      return selectorQuestion(values[1], values[0], {
        canonicalSkillId: SUBTRACTION_STAGES[1].canonicalSkillId,
        kind: 'remove',
        prompt: values[0] + 'この まるから ' + values[1] + 'こ とろう。',
        instruction: 'とる まるを ' + values[1] + 'こ タップして「けってい」',
        visual: { type: 'remove', total: values[0], remove: values[1] },
        hint: 'タップした まるを 一つずつ 数えよう。',
        explain: values[0] + '−' + values[1] + '＝' + values[2] + '。のこりは' + values[2] + 'こ。',
        math: { kind: 'subtract', a: values[0], b: values[1], result: values[2] }
      }, rng);
    }
    if (stageIndex === 2) {
      const a = rand(1, 10, rng);
      const b = round % 2 ? a : 0;
      const correct = a - b;
      return finalizeQuestion({
        canonicalSkillId: SUBTRACTION_STAGES[2].canonicalSkillId,
        kind: 'choice',
        prompt: b === 0 ? 'まるを 一つも とらない。のこりは？' : 'まるを ぜんぶ とる。のこりは？',
        correct,
        options: numberChoices(correct, 0, 10, 4, rng),
        visual: { type: 'switch', total: a, mode: b === 0 ? 'none' : 'all' },
        hint: b === 0 ? '何も動かさないから、数は かわらないよ。' : '全部なくなると、空っぽを表す数になるよ。',
        explain: a + '−' + b + '＝' + correct + '。',
        math: { kind: 'subtract', a, b, result: correct }
      }, rng);
    }
    if (stageIndex === 3) {
      const values = subtractionValues(10, false, rng);
      return numericQuestion({
        canonicalSkillId: SUBTRACTION_STAGES[3].canonicalSkillId,
        kind: round % 2 ? 'route' : 'slider',
        prompt: values[0] + '−' + values[1] + 'は いくつ？',
        correct: values[2],
        min: 0,
        max: 10,
        start: values[0],
        visual: { type: 'dial', counts: [values[0], values[1]], operation: '-' },
        hint: values[0] + 'から' + values[1] + 'こ分、後ろへ進もう。',
        explain: values[0] + '−' + values[1] + '＝' + values[2] + '。',
        math: { kind: 'subtract', a: values[0], b: values[1], result: values[2] }
      }, rng);
    }
    if (stageIndex === 4) {
      const q = buildSubtractionQuestion(round % 4, round + 2, rng);
      return retagQuestion(q, { checkpoint: true, assessmentFor: SUBTRACTION_STAGES[4].canonicalSkillId });
    }
    if (stageIndex === 5) {
      const values = subtractionValues(20, false, rng);
      return numericQuestion({
        canonicalSkillId: SUBTRACTION_STAGES[5].canonicalSkillId,
        kind: round % 2 ? 'remove' : 'slider',
        prompt: values[0] + 'この まるから ' + values[1] + 'こ とろう。',
        correct: round % 2 ? values[1] : values[2],
        min: 0,
        max: 20,
        start: values[0],
        visual: { type: 'ten-bundle-remove', a: values[0], b: values[1] },
        hint: '10の まとまりは そのまま。ばらを へらそう。',
        explain: values[0] + '−' + values[1] + '＝' + values[2] + '。',
        math: { kind: 'subtract', a: values[0], b: values[1], result: values[2], mode: 'no-borrow-20' }
      }, rng);
    }
    if (stageIndex === 6) {
      let a;
      let b;
      let c;
      let ops;
      let first;
      let correct;
      do {
        a = rand(8, 18, rng);
        b = rand(1, Math.min(6, a), rng);
        c = rand(1, 5, rng);
        ops = round % 2 ? ['-', '+'] : ['-', '-'];
        first = a - b;
        correct = ops[1] === '+' ? first + c : first - c;
      } while (correct < 0 || correct > 20);
      return numericQuestion({
        canonicalSkillId: SUBTRACTION_STAGES[6].canonicalSkillId,
        kind: 'route',
        prompt: a + ops[0] + b + ops[1] + c + '。ひだりから けいさんしよう。',
        correct,
        min: 0,
        max: 20,
        start: a,
        visual: { type: 'three-step', values: [a, b, c], ops },
        hint: 'まず' + a + ops[0] + b + '＝' + first + '。次へ進もう。',
        explain: a + ops[0] + b + '＝' + first + '、' + first + ops[1] + c + '＝' + correct + '。',
        math: { kind: 'sequence', values: [a, b, c], ops, result: correct }
      }, rng);
    }
    if (stageIndex === 7) {
      const values = subtractionValues(20, true, rng);
      const ones = values[0] % 10;
      const strategy = round % 2 ? 'make-ten' : 'ten-first';
      const firstMove = strategy === 'make-ten' ? ones : 10 - values[1];
      return numericQuestion({
        canonicalSkillId: SUBTRACTION_STAGES[7].canonicalSkillId,
        kind: round % 2 ? 'tap' : 'route',
        prompt: strategy === 'make-ten'
          ? values[0] + 'から、まず いくつ ひくと 10？'
          : '10−' + values[1] + 'は いくつ？',
        correct: firstMove,
        min: 0,
        max: 10,
        start: 0,
        visual: { type: 'break-ten', a: values[0], b: values[1], strategy, result: values[2] },
        hint: strategy === 'make-ten' ? values[0] + 'から' + ones + 'を ひくと 10だよ。' : '10から' + values[1] + 'を ひこう。',
        explain: strategy === 'make-ten' ? values[1] + 'を' + ones + 'と' + (values[1] - ones) + 'に わけると、こたえは' + values[2] + '。' : '10−' + values[1] + '＝' + firstMove + '。のこしていた' + ones + 'を あわせると' + values[2] + '。',
        math: { kind: 'subtract', a: values[0], b: values[1], result: values[2], mode: 'borrow', strategy }
      }, rng);
    }
    if (stageIndex === 8) {
      const a = rand(6, 20, rng);
      const b = rand(1, Math.min(9, a), rng);
      const correct = a - b;
      return numericQuestion({
        canonicalSkillId: SUBTRACTION_STAGES[8].canonicalSkillId,
        kind: 'route',
        prompt: a + 'から ' + b + 'もどると、どこに着く？',
        correct,
        min: 0,
        max: 20,
        visual: { type: 'number-line-back', start: a, steps: b, target: correct },
        hint: a + 'から 左へ' + b + '回 進もう。',
        explain: a + '−' + b + '＝' + correct + '。',
        math: { kind: 'subtract', a, b, result: correct }
      }, rng);
    }
    if (stageIndex === 9) {
      if (round % 2 === 0) {
        const a = rand(2, 10, rng) * 10;
        const b = rand(1, a / 10, rng) * 10;
        const correct = a - b;
        return numericQuestion({
          canonicalSkillId: SUBTRACTION_STAGES[9].canonicalSkillId,
          kind: 'slider',
          prompt: a + 'から' + b + 'を 整理しよう。',
          correct,
          min: 0,
          max: 100,
          step: 10,
          start: a,
          visual: { type: 'place-value-remove', a, b },
          hint: '十の束を ' + (b / 10) + 'こ 取り出そう。',
          explain: a + '−' + b + '＝' + correct + '。',
          math: { kind: 'subtract', a, b, result: correct, mode: 'tens' }
        }, rng);
      }
      let a;
      let ones;
      do {
        a = rand(11, 99, rng);
        ones = a % 10;
      } while (ones === 0);
      const b = rand(1, ones, rng);
      const correct = a - b;
      return numericQuestion({
        canonicalSkillId: SUBTRACTION_STAGES[9].canonicalSkillId,
        kind: 'slider',
        prompt: a + 'から、ばらを ' + b + 'こ ひこう。',
        correct,
        min: 0,
        max: 100,
        start: a,
        visual: { type: 'place-value-remove', a, b },
        hint: '十の束は そのまま。一の位だけ へらそう。',
        explain: a + '−' + b + '＝' + correct + '。',
        math: { kind: 'subtract', a, b, result: correct, mode: 'no-borrow-100' }
      }, rng);
    }
    const pool = [0, 1, 2, 3, 5, 6, 7, 8, 9];
    const q = round === 6 || round === 7 ? subtractionStory(20, round === 7, rng) : buildSubtractionQuestion(pool[round % pool.length], round + 11, rng);
    return retagQuestion(q, { checkpoint: true, assessmentFor: SUBTRACTION_STAGES[10].canonicalSkillId });
  }

  function sideComparisonQuestion(config, round, rng) {
    const variant = ((Number(round) || 0) % 4 + 4) % 4;
    const left = rand(config.min, config.max, rng);
    let right = rand(config.min, config.max, rng);
    const binarySame = variant === 3 && Math.floor((Number(round) || 0) / 4) % 2 === 0;
    if (variant === 2 || binarySame) right = left;
    else if (right === left) right = left < config.max ? left + 1 : left - 1;
    const longer = left === right ? 'おなじ' : left > right ? 'ひだり' : 'みぎ';
    const shorter = left === right ? 'おなじ' : left < right ? 'ひだり' : 'みぎ';
    const binary = variant === 3;
    const mode = binary ? 'same-check' : variant === 1 ? 'pick-shorter' : variant === 2 ? 'same-pair' : 'pick-longer';
    const correct = binary ? (left === right ? 'おなじ' : 'ちがう') : variant === 1 ? shorter : longer;
    const prompt = binary ? config.samePrompt : variant === 1 ? config.shorterPrompt : config.longerPrompt;
    return finalizeQuestion({
      canonicalSkillId: config.canonicalSkillId,
      kind: 'choice',
      prompt,
      instruction: binary ? '二つを くらべて「おなじ・ちがう」を えらぼう' : 'ひだり・みぎを 見て こたえよう',
      correct,
      options: binary ? ['おなじ', 'ちがう'] : ['ひだり', 'おなじ', 'みぎ'],
      optionPolicy: binary ? 'fixed' : 'shuffle',
      templateId: config.templatePrefix + '.' + mode,
      interactionFamily: config.templatePrefix + ':choice',
      visual: Object.assign({ type: config.visualType, left, right, comparisonMode: mode }, config.visualExtra || {}),
      hint: config.hint,
      explain: config.explain(left, right, correct)
    }, rng);
  }

  function lengthQuestion(canonicalSkillId, mode, round, rng) {
    const object = pick(mode === 'indirect' ? ['つくえの よこ', 'たなの よこ', '大きな いた'] : ['ぼう', 'リボン', 'コード'], rng);
    return sideComparisonQuestion({
      canonicalSkillId,
      min: 3,
      max: 10,
      templatePrefix: 'measure.length.' + mode,
      visualType: 'length-position-compare',
      visualExtra: { method: mode, object },
      longerPrompt: 'ひだりと みぎの ' + object + '。どちらが ながい？',
      shorterPrompt: 'ひだりと みぎの ' + object + '。どちらが みじかい？',
      samePrompt: 'ひだりと みぎの ' + object + 'は、おなじ ながさ？',
      hint: mode === 'indirect' ? 'テープに うつした二本を、同じ はじまりから くらべよう。' : '二本の はじまりを そろえて、どこまで のびるか見よう。',
      explain: function (left, right, correct) {
        return (mode === 'indirect' ? 'テープにうつして はじまりをそろえると、' : 'はじまりをそろえると、') + correct + 'だと分かるよ。';
      }
    }, round, rng);
  }

  function buildMeasureQuestion(stageIndex, round, rng) {
    if (stageIndex === 0) return lengthQuestion(MEASURE_STAGES[0].canonicalSkillId, 'direct', round, rng);
    if (stageIndex === 1) return lengthQuestion(MEASURE_STAGES[1].canonicalSkillId, 'indirect', round, rng);
    if (stageIndex === 2) {
      const units = rand(2, 10, rng);
      const variant = ((Number(round) || 0) % 3 + 3) % 3;
      if (variant === 0) {
        return finalizeQuestion({
          canonicalSkillId: MEASURE_STAGES[2].canonicalSkillId,
          kind: 'tap',
          prompt: '上の ぼうは、ブロック いくつ分の ながさ？',
          instruction: '下のブロックを ひだりから見て、ぼうの右はしと合うところをタップ。できたら「けってい」',
          correct: units,
          min: 0,
          max: 10,
          templateId: 'measure.unit.build',
          interactionFamily: 'measure.unit:tap-endpoint',
          visual: { type: 'unit-length-builder', targetUnits: units, maxUnits: 10 },
          hint: 'ブロック1こ分ずつ、ぼうの はしまで 数えよう。',
          explain: 'ぼうと ぴったり同じなのは、ブロック' + units + 'こ分だね。'
        }, rng);
      }
      return numericQuestion({
        canonicalSkillId: MEASURE_STAGES[2].canonicalSkillId,
        kind: variant === 1 ? 'choice' : 'slider',
        prompt: variant === 1 ? 'ぼうの下に ならんだブロックは、いくつ分？' : 'ぼうの ながさは、ブロック いくつ分？',
        instruction: variant === 1 ? 'ブロックを ひだりから数えて、数をえらぼう' : '−と＋で ブロックの数を合わせて「けってい」',
        correct: units,
        min: 0,
        max: 10,
        start: 0,
        templateId: variant === 1 ? 'measure.unit.count' : 'measure.unit.counter',
        interactionFamily: variant === 1 ? 'measure.unit:choice' : 'measure.unit:slider',
        visual: { type: 'unit-length-count', targetUnits: units, maxUnits: 10 },
        hint: '同じ大きさのブロックを、ひだりから 一つずつ数えよう。',
        explain: 'ブロック' + units + 'こ分の 長さだね。'
      }, rng);
    }
    if (stageIndex === 3) {
      const cases = [
        { id: 'direct', icon: '↔', title: '2ほんの えんぴつ', detail: 'どちらが ながいか、そのばで しらべたい。', prompt: '2ほんの えんぴつ。どうやって ながさを くらべる？' },
        { id: 'direct', icon: '↔', title: '2ほんの リボン', detail: 'どちらが みじかいか、そのばで しらべたい。', prompt: '2ほんの リボン。どうやって ながさを くらべる？' },
        { id: 'direct', icon: '↔', title: '2ほんの ぼう', detail: 'どちらも うごかすことが できる。', prompt: 'うごかせる 2ほんの ぼう。どうやって くらべる？' },
        { id: 'direct', icon: '↔', title: '2ほんの ストロー', detail: 'どちらも てに もって うごかせる。', prompt: '2ほんの ストロー。どうやって ながさを くらべる？' },
        { id: 'direct', icon: '↔', title: '2ほんの はし', detail: 'そのばに ならべることが できる。', prompt: '2ほんの はし。どうやって ながさを くらべる？' },
        { id: 'direct', icon: '↔', title: '2まいの テープ', detail: 'どちらも はがして ならべられる。', prompt: '2まいの テープ。どうやって ながさを くらべる？' },
        { id: 'transfer', icon: '〰', title: '2つの つくえ', detail: 'はなれていて、うごかすことが できない。', prompt: 'うごかせない 2つの つくえ。どうやって ながさを くらべる？' },
        { id: 'transfer', icon: '〰', title: '2つの まど', detail: 'はなれた ばしょに ついている。', prompt: 'はなれた 2つの まど。どうやって よこの ながさを くらべる？' },
        { id: 'transfer', icon: '〰', title: 'ドアと たな', detail: 'そのばから うごかすことが できない。', prompt: 'うごかせない ドアと たな。どうやって ながさを くらべる？' },
        { id: 'transfer', icon: '〰', title: '2つの ほんだな', detail: 'べつの へやに あって、うごかせない。', prompt: 'べつの へやの ほんだな。どうやって ながさを くらべる？' },
        { id: 'transfer', icon: '〰', title: '2つの ドア', detail: 'かべに ついていて、ならべられない。', prompt: 'はなれた 2つの ドア。どうやって よこの ながさを くらべる？' },
        { id: 'transfer', icon: '〰', title: 'ベッドと つくえ', detail: 'おおきくて、そのばから うごかせない。', prompt: 'うごかせない ベッドと つくえ。どうやって くらべる？' },
        { id: 'unit', icon: '▥', title: 'ながさを つたえる', detail: 'ここに いない ひとへ、ぼうの ながさを つたえたい。', prompt: 'ぼうの ながさを、はなれた ひとへ つたえるには どうする？' },
        { id: 'unit', icon: '▥', title: 'ながさを きろくする', detail: 'あとで もういちど、おなじ ながさを つくりたい。', prompt: 'ぼうの ながさを、あとで わかるように するには どうする？' },
        { id: 'unit', icon: '▥', title: 'みんなで くらべる', detail: 'おなじ ブロックを つかって、ながさを つたえあう。', prompt: 'ブロックを つかって ながさを つたえるには、どうする？' },
        { id: 'unit', icon: '▥', title: 'リボンを きろくする', detail: 'あしたも おなじ ながさに きりたい。', prompt: 'リボンの ながさを、あしたも わかるように するには どうする？' },
        { id: 'unit', icon: '▥', title: 'いたの ながさを つたえる', detail: 'おなじ ブロックを つかって、かずで つたえたい。', prompt: 'いたの ながさを かずで つたえるには、どうする？' },
        { id: 'unit', icon: '▥', title: 'おなじ ながさを つくる', detail: 'べつの ばしょで、おなじ ながさを つくりたい。', prompt: 'べつの ばしょで おなじ ながさを つくるには、どうする？' }
      ];
      const item = pick(cases, rng);
      const methods = [
        { value: 'direct', icon: '↔', label: 'はしを そろえて ならべる' },
        { value: 'transfer', icon: '〰', label: 'テープに うつして くらべる' },
        { value: 'unit', icon: '▥', label: 'おなじ ブロックで なんこぶんか はかる' }
      ];
      return finalizeQuestion({
        canonicalSkillId: MEASURE_STAGES[3].canonicalSkillId,
        kind: 'choice',
        prompt: item.prompt,
        instruction: 'したの 3つから、やりかたを ひとつ えらぼう',
        correct: item.id,
        options: methods,
        templateId: 'measure.method.' + item.id,
        interactionFamily: 'measure.method:choice',
        visual: { type: 'measure-method', sceneId: item.id, icon: item.icon, title: item.title, detail: item.detail },
        hint: 'うごかせる？ うつしとる？ かずで つたえる？を かんがえよう。',
        explain: methods.find(function (method) { return method.value === item.id; }).label + 'と ぴったりだね。'
      }, rng);
    }
    if (stageIndex === 4) {
      const q = buildMeasureQuestion(round % 4, round + 3, rng);
      return retagQuestion(q, { checkpoint: true, assessmentFor: MEASURE_STAGES[4].canonicalSkillId });
    }
    if (stageIndex === 5) {
      return sideComparisonQuestion({
        canonicalSkillId: MEASURE_STAGES[5].canonicalSkillId,
        min: 2,
        max: 8,
        templatePrefix: 'measure.capacity',
        visualType: 'capacity',
        longerPrompt: '同じカップで 入れたよ。どちらのタンクの かさが おおい？',
        shorterPrompt: '同じカップで 入れたよ。どちらのタンクの かさが すくない？',
        samePrompt: '二つのタンクは、おなじ かさ？',
        hint: 'カップ何はい分かを くらべよう。',
        explain: function (left, right, correct) { return 'ひだりは' + left + 'はい、みぎは' + right + 'はいだから、' + correct + '。'; }
      }, round, rng);
    }
    if (stageIndex === 6) {
      return sideComparisonQuestion({
        canonicalSkillId: MEASURE_STAGES[6].canonicalSkillId,
        min: 3,
        max: 12,
        templatePrefix: 'measure.area',
        visualType: 'area',
        longerPrompt: '同じマスで しきつめたよ。どちらが ひろい？',
        shorterPrompt: '同じマスで しきつめたよ。どちらが せまい？',
        samePrompt: '二つの ひろさは、おなじ？',
        hint: '同じ大きさのマスを 数えよう。',
        explain: function (left, right, correct) { return 'ひだりは' + left + 'マス、みぎは' + right + 'マス。' + correct + 'だよ。'; }
      }, round, rng);
    }
    if (stageIndex >= 7 && stageIndex <= 9) {
      const hour = rand(1, 12, rng);
      const minute = stageIndex === 7 ? 0 : stageIndex === 8 ? 30 : rand(0, 11, rng) * 5;
      const correct = hour + ':' + String(minute).padStart(2, '0');
      const timeLabel = function (targetHour, targetMinute) {
        return targetHour + 'じ' + (targetMinute ? targetMinute + 'ぷん' : '');
      };
      if (round % 2 === 0) {
        const optionMap = new Map();
        optionMap.set(correct, { value: correct, label: timeLabel(hour, minute) });
        while (optionMap.size < 4) {
          const otherHour = rand(1, 12, rng);
          const otherMinute = stageIndex === 7 ? 0 : stageIndex === 8 ? 30 : rand(0, 11, rng) * 5;
          const value = otherHour + ':' + String(otherMinute).padStart(2, '0');
          optionMap.set(value, { value, label: timeLabel(otherHour, otherMinute) });
        }
        return finalizeQuestion({
          canonicalSkillId: MEASURE_STAGES[stageIndex].canonicalSkillId,
          kind: 'choice',
          prompt: stageIndex === 7 ? 'とけいは なんじ？' : stageIndex === 8 ? 'とけいは なんじはん？' : 'とけいは なんじ なんぷん？',
          instruction: 'みじかい はりと ながい はりを みて、えらぼう',
          correct,
          options: shuffle(Array.from(optionMap.values()), rng),
          visual: { type: 'clock-read', value: correct, hour, minute },
          hint: minute === 0 ? 'ながい はりは 12。みじかい はりを みよう。' : minute === 30 ? 'ながい はりは 6。みじかい はりを みよう。' : 'ながい はりは、1めもり 5ふんだよ。',
          explain: timeLabel(hour, minute) + 'だね。',
          templateId: 'measure.clock.read.' + stageIndex,
          interactionFamily: 'measure.clock:read'
        }, rng);
      }
      let startHour = hour === 12 ? 1 : hour + 1;
      const startMinute = stageIndex === 9 ? (minute === 55 ? 0 : (minute + 5) % 60) : (minute === 0 ? 30 : 0);
      return finalizeQuestion({
        canonicalSkillId: MEASURE_STAGES[stageIndex].canonicalSkillId,
        kind: 'clock',
        prompt: hour + 'じ' + (minute ? String(minute) + 'ぷん' : '') + 'に 時計を 合わせよう。',
        instruction: '短い針と長い針を動かして「けってい」',
        correct,
        input: startHour + ':' + String(startMinute).padStart(2, '0'),
        clockStep: stageIndex === 9 ? 5 : 30,
        visual: { type: 'clock', hour, minute },
        hint: minute === 0 ? '長い針は12。短い針を' + hour + 'にしよう。' : minute === 30 ? '長い針は6。短い針は' + hour + 'と次の数の間だよ。' : '長い針は1目盛り5分。' + minute + '分の場所をさがそう。',
        explain: '時計を ' + hour + 'じ' + (minute ? minute + 'ぷん' : '') + 'に 合わせられたね。'
      }, rng);
    }
    const pool = [0, 1, 2, 3, 5, 6, 7, 8, 9];
    const q = buildMeasureQuestion(pool[round % pool.length], round + 8, rng);
    return retagQuestion(q, { checkpoint: true, assessmentFor: MEASURE_STAGES[10].canonicalSkillId, story: round === 6 });
  }

  function buildShapeQuestion(stageIndex, round, rng) {
    if (stageIndex === 0) {
      const solid = pick(SOLIDS, rng);
      const objects = {
        'はこ': ['ティッシュの はこ', 'にもつの はこ', 'おかしの はこ', 'けしゴム'],
        'さいころ': ['ゲームの さいころ', 'しかくい ブロック', 'つみき', 'こおりの かたち'],
        'つつ': ['かん', 'かみの つつ', 'テープの しん', 'まるい のり'],
        'ボール': ['ボール', 'まるい ビーだま', 'オレンジ', 'けいとの たま']
      };
      const object = pick(objects[solid.name], rng);
      return finalizeQuestion({
        canonicalSkillId: SHAPE_STAGES[0].canonicalSkillId,
        kind: 'choice',
        prompt: object + 'に にている形は？',
        correct: solid.name,
        options: SOLIDS.map(function (item) { return item.name; }),
        visual: { type: 'solid-scan', object, icon: solid.icon },
        hint: '角があるか、まるいかを 見よう。',
        explain: object + 'は「' + solid.name + '」に にているよ。'
      }, rng);
    }
    if (stageIndex === 1) {
      const item = pick(SHAPE_ACTION_CASES, rng);
      return finalizeQuestion({
        canonicalSkillId: SHAPE_STAGES[1].canonicalSkillId,
        kind: 'choice',
        prompt: item.name + 'は、ころがる？ つめる？',
        correct: item.correct,
        options: ['ころがる', 'つめる', 'どちらも'],
        visual: { type: 'solid-action', solid: item.icon, object: item.name, action: item.correct },
        hint: 'たいらな めんと、まるい めんを みよう。',
        explain: item.name + 'は「' + item.correct + '」だよ。'
      }, rng);
    }
    if (stageIndex === 2) {
      const item = pick(SHAPE_ACTION_CASES, rng);
      return finalizeQuestion({
        canonicalSkillId: SHAPE_STAGES[2].canonicalSkillId,
        kind: 'sort',
        prompt: item.name + 'は、どの なかま？',
        correct: item.correct,
        options: ['ころがる', 'つめる', 'どちらも'],
        visual: { type: 'sort', item: item.icon, itemLabel: item.name, bins: ['ころがる', 'つめる', 'どちらも'] },
        hint: 'ころがしたり、つんだりする ところを かんがえよう。',
        explain: item.name + 'は「' + item.correct + '」なかまだよ。'
      }, rng);
    }
    if (stageIndex === 3) {
      const item = pick(SHAPE_FACE_CASES, rng);
      return finalizeQuestion({
        canonicalSkillId: SHAPE_STAGES[3].canonicalSkillId,
        kind: 'choice',
        prompt: item.name + 'を スタンプすると、どんな かたち？',
        correct: item.face,
        options: ['まる', 'さんかく', 'しかく'],
        visual: { type: 'stamp', solid: item.icon, object: item.name, face: item.face },
        hint: 'スタンプする たいらな めんを みよう。',
        explain: item.name + 'から「' + item.face + '」の スタンプが できるよ。'
      }, rng);
    }
    if (stageIndex === 4) {
      const q = buildShapeQuestion(round % 4, round + 3, rng);
      return retagQuestion(q, { checkpoint: true, assessmentFor: SHAPE_STAGES[4].canonicalSkillId });
    }
    if (stageIndex === 5 || stageIndex === 8) {
      const patterns = [
        [0, 1, 3, 4],
        [1, 2, 4, 5],
        [0, 3, 4, 7],
        [2, 4, 6, 8],
        [0, 1, 4, 7],
        [1, 3, 4, 5, 7],
        [0, 2, 4, 6, 8],
        [0, 3, 4, 5, 8],
        [2, 3, 4, 5, 6],
        [0, 4, 8],
        [0, 1, 2],
        [3, 4, 5],
        [6, 7, 8],
        [0, 4, 5, 8],
        [2, 3, 4, 6],
        [0, 2, 3, 5, 6, 8],
        [1, 3, 5, 7],
        [0, 1, 2, 4, 7]
      ];
      const target = pick(patterns, rng);
      const dots = stageIndex === 8;
      return finalizeQuestion({
        canonicalSkillId: SHAPE_STAGES[stageIndex].canonicalSkillId,
        kind: 'select',
        prompt: dots ? 'みほんと おなじ てんを えらんで、かたちを つくろう。' : 'みほんと おなじ マスを えらんで、かたちを つくろう。',
        instruction: (dots ? 'てん' : 'マス') + 'を タップして「けってい」',
        correct: target.slice().sort(function (a, b) { return a - b; }).join(','),
        input: '',
        visual: { type: dots ? 'dot-copy' : 'grid-copy', size: 3, target },
        hint: 'うえの みほんを、1だんずつ みくらべよう。',
        explain: 'おなじ ばしょの ' + (dots ? 'てん' : 'マス') + 'を えらべたね。'
      }, rng);
    }
    if (stageIndex === 6) {
      const pieces = rand(2, 7, rng);
      const correct = pick(['そのまま', 'まわす', 'うらがえす'], rng);
      return finalizeQuestion({
        canonicalSkillId: SHAPE_STAGES[6].canonicalSkillId,
        kind: 'choice',
        prompt: '切り分けた' + pieces + 'まいの板。見本に合わせる動きは？',
        correct,
        options: ['そのまま', 'まわす', 'うらがえす'],
        visual: { type: 'transform', pieces, action: correct },
        hint: '角の向きを 見くらべよう。',
        explain: '板を「' + correct + '」と 見本に合うよ。'
      }, rng);
    }
    if (stageIndex === 7) {
      const shapeCases = [
        { name: 'さんかく', diagram: '△', sticks: 3 },
        { name: 'しかく', diagram: '□', sticks: 4 },
        { name: 'ながい しかく', diagram: '▭', sticks: 4 },
        { name: '2つの さんかく', diagram: '△　△', sticks: 6 },
        { name: '2つの しかく', diagram: '□　□', sticks: 8 },
        { name: 'さんかくと しかく', diagram: '△　□', sticks: 7 },
        { name: 'おうちの かたち', diagram: '⌂', sticks: 6 },
        { name: 'となりあう 2つの しかく', diagram: '□□', sticks: 7 },
        { name: 'かどの かたち', diagram: '⌞', sticks: 2 },
        { name: 'じゅうじの かたち', diagram: '＋', sticks: 2 },
        { name: 'やじるしの かたち', diagram: '↑', sticks: 3 },
        { name: 'コの かたち', diagram: '⊏', sticks: 3 },
        { name: 'ひしがた', diagram: '◇', sticks: 4 },
        { name: 'ジグザグの かたち', diagram: '／＼／＼', sticks: 4 },
        { name: '5つの へんの かたち', diagram: '⬠', sticks: 5 },
        { name: '6つの へんの かたち', diagram: '⬡', sticks: 6 }
      ];
      const item = pick(shapeCases, rng);
      return selectorQuestion(item.sticks, 10, {
        canonicalSkillId: SHAPE_STAGES[7].canonicalSkillId,
        prompt: item.name + 'を つくる ぼうを ' + item.sticks + 'ほん えらぼう。',
        instruction: 'ぼうを ' + item.sticks + 'ほん タップして「けってい」',
        hint: 'へんを 1ほんずつ かぞえよう。',
        explain: item.name + 'には ぼうが ' + item.sticks + 'ほん ひつようだよ。',
        visual: { type: 'sticks', target: item.name, diagram: item.diagram, total: 10 }
      }, rng);
    }
    if (stageIndex === 9) {
      const moves = [];
      for (let start = 0; start < 9; start += 1) {
        const row = Math.floor(start / 3);
        const column = start % 3;
        if (row > 0) moves.push({ start, label: 'うえ', delta: -3 });
        if (row < 2) moves.push({ start, label: 'した', delta: 3 });
        if (column > 0) moves.push({ start, label: 'ひだり', delta: -1 });
        if (column < 2) moves.push({ start, label: 'みぎ', delta: 1 });
      }
      const move = pick(moves, rng);
      const correct = move.start + move.delta;
      return finalizeQuestion({
        canonicalSkillId: SHAPE_STAGES[9].canonicalSkillId,
        kind: 'select',
        prompt: 'いろの ついた マスから「' + move.label + '」へ うごかそう。',
        instruction: 'うごいた さきの マスを タップして「けってい」',
        correct: String(correct),
        input: '',
        visual: { type: 'position-grid', size: 3, start: move.start, direction: move.label },
        hint: 'ゆびを ' + move.label + 'へ うごかしてみよう。',
        explain: move.label + 'の マスを えらべたね。'
      }, rng);
    }
    const pool = [0, 1, 2, 3, 5, 6, 7, 8, 9];
    const q = buildShapeQuestion(pool[round % pool.length], round + 9, rng);
    return retagQuestion(q, { checkpoint: true, assessmentFor: SHAPE_STAGES[10].canonicalSkillId, story: round === 6 });
  }

  function dataCounts(rng, allowTie) {
    const counts = [rand(1, 8, rng), rand(1, 8, rng), rand(1, 8, rng)];
    if (!allowTie) {
      let guard = 0;
      while (new Set(counts).size < 3 && guard < 20) {
        counts[1] = rand(1, 8, rng);
        counts[2] = rand(1, 8, rng);
        guard += 1;
      }
    } else if (allowTie) {
      counts[1] = counts[0];
    }
    return counts;
  }

  function operationStory(rng) {
    const isAdd = rand(0, 1, rng) === 1;
    if (isAdd) {
      const values = additionValues(10, false, rng);
      return {
        text: 'はこに おはじきが' + values[0] + 'こ。あとから' + values[1] + 'こ いれました。',
        operation: 'たしざん',
        equation: values[0] + '＋' + values[1] + '＝' + values[2],
        answer: values[2],
        math: { kind: 'add', a: values[0], b: values[1], result: values[2] }
      };
    }
    const values = subtractionValues(10, false, rng);
    return {
      text: 'はこに おはじきが' + values[0] + 'こ。' + values[1] + 'こ とりました。',
      operation: 'ひきざん',
      equation: values[0] + '−' + values[1] + '＝' + values[2],
      answer: values[2],
      math: { kind: 'subtract', a: values[0], b: values[1], result: values[2] }
    };
  }

  function buildSolveQuestion(stageIndex, round, rng) {
    if (stageIndex === 0) {
      const cases = [
        { item: 'りんご', correct: 'たべもの', options: ['たべもの', 'どうぶつ', 'どうぐ'] },
        { item: 'みかん', correct: 'たべもの', options: ['たべもの', 'どうぶつ', 'どうぐ'] },
        { item: 'バナナ', correct: 'たべもの', options: ['たべもの', 'どうぶつ', 'どうぐ'] },
        { item: 'パン', correct: 'たべもの', options: ['たべもの', 'どうぶつ', 'どうぐ'] },
        { item: 'いちご', correct: 'たべもの', options: ['たべもの', 'どうぶつ', 'どうぐ'] },
        { item: 'おにぎり', correct: 'たべもの', options: ['たべもの', 'どうぶつ', 'どうぐ'] },
        { item: 'ねこ', correct: 'どうぶつ', options: ['たべもの', 'どうぶつ', 'どうぐ'] },
        { item: 'いぬ', correct: 'どうぶつ', options: ['たべもの', 'どうぶつ', 'どうぐ'] },
        { item: 'うさぎ', correct: 'どうぶつ', options: ['たべもの', 'どうぶつ', 'どうぐ'] },
        { item: 'とり', correct: 'どうぶつ', options: ['たべもの', 'どうぶつ', 'どうぐ'] },
        { item: 'さかな', correct: 'どうぶつ', options: ['たべもの', 'どうぶつ', 'どうぐ'] },
        { item: 'ぞう', correct: 'どうぶつ', options: ['たべもの', 'どうぶつ', 'どうぐ'] },
        { item: 'えんぴつ', correct: 'どうぐ', options: ['たべもの', 'どうぶつ', 'どうぐ'] },
        { item: 'はさみ', correct: 'どうぐ', options: ['たべもの', 'どうぶつ', 'どうぐ'] },
        { item: 'スプーン', correct: 'どうぐ', options: ['たべもの', 'どうぶつ', 'どうぐ'] },
        { item: 'ものさし', correct: 'どうぐ', options: ['たべもの', 'どうぶつ', 'どうぐ'] },
        { item: 'かさ', correct: 'どうぐ', options: ['たべもの', 'どうぶつ', 'どうぐ'] },
        { item: 'ブラシ', correct: 'どうぐ', options: ['たべもの', 'どうぶつ', 'どうぐ'] }
      ];
      const item = pick(cases, rng);
      return finalizeQuestion({
        canonicalSkillId: SOLVE_STAGES[0].canonicalSkillId,
        kind: 'sort',
        prompt: '「' + item.item + '」は どの なかま？',
        instruction: 'なかまを 一つ えらぼう',
        correct: item.correct,
        options: item.options,
        visual: { type: 'sort', item: item.item, bins: item.options },
        hint: item.item + 'が どんなものか 考えよう。',
        explain: item.item + 'は「' + item.correct + '」の仲間だね。'
      }, rng);
    }
    if (stageIndex === 1) {
      const counts = dataCounts(rng, false);
      const labels = ['りんご', 'みかん', 'ぶどう'];
      const max = Math.max.apply(null, counts);
      const index = counts.indexOf(max);
      return finalizeQuestion({
        canonicalSkillId: SOLVE_STAGES[1].canonicalSkillId,
        kind: 'choice',
        prompt: '一列に ならべたよ。いちばん 多いのは？',
        correct: labels[index],
        options: labels,
        visual: { type: 'aligned-data', labels, counts },
        hint: '同じところから ならべて、いちばん長い列を見よう。',
        explain: labels[index] + 'が' + max + 'こで、いちばん多いよ。'
      }, rng);
    }
    if (stageIndex === 2) {
      const target = rand(2, 8, rng);
      const label = pick(['りんご', 'みかん', 'ぶどう'], rng);
      return selectorQuestion(target, 8, {
        canonicalSkillId: SOLVE_STAGES[2].canonicalSkillId,
        prompt: '「' + label + ' ' + target + 'こ」の えグラフを つくろう。',
        hint: 'ひとつの しるしが、ひとつぶんだよ。',
        explain: label + 'の しるしを ' + target + 'こ ならべられたね。',
        visual: { type: 'graph-build', label, total: 8 }
      }, rng);
    }
    if (stageIndex === 3) {
      const counts = dataCounts(rng, false);
      const labels = ['りんご', 'みかん', 'ぶどう'];
      if (round % 3 === 2) {
        const max = Math.max.apply(null, counts);
        const min = Math.min.apply(null, counts);
        const correct = max - min;
        return numericQuestion({
          canonicalSkillId: SOLVE_STAGES[3].canonicalSkillId,
          kind: 'choice',
          prompt: 'いちばん多いものと 少ないものの ちがいは いくつ？',
          correct,
          min: 0,
          max: 8,
          visual: { type: 'graph', labels, counts },
          hint: 'いちばん高い列から、低い列の数を引こう。',
          explain: max + '−' + min + '＝' + correct + '。'
        }, rng);
      }
      const askMax = round % 2 === 0;
      const target = askMax ? Math.max.apply(null, counts) : Math.min.apply(null, counts);
      const index = counts.indexOf(target);
      return finalizeQuestion({
        canonicalSkillId: SOLVE_STAGES[3].canonicalSkillId,
        kind: 'choice',
        prompt: askMax ? 'いちばん 多いのは？' : 'いちばん 少ないのは？',
        correct: labels[index],
        options: labels,
        visual: { type: 'graph', labels, counts },
        hint: askMax ? 'いちばん高い列を さがそう。' : 'いちばん低い列を さがそう。',
        explain: labels[index] + 'が' + target + 'こだよ。'
      }, rng);
    }
    if (stageIndex === 4) {
      const q = buildSolveQuestion(round % 4, round + 3, rng);
      return retagQuestion(q, { checkpoint: true, assessmentFor: SOLVE_STAGES[4].canonicalSkillId });
    }
    if (stageIndex >= 5 && stageIndex <= 8) {
      const story = operationStory(rng);
      if (stageIndex === 5) {
        return finalizeQuestion({
          canonicalSkillId: SOLVE_STAGES[5].canonicalSkillId,
          kind: 'choice',
          prompt: story.text + ' たしざん？ ひきざん？',
          correct: story.operation,
          options: ['たしざん', 'ひきざん'],
          story: true,
          visual: { type: 'operation-choice', operation: story.operation },
          hint: '増えたのか、使って減ったのかを 見よう。',
          explain: 'この場面は「' + story.operation + '」。式は' + story.equation + '。',
          math: story.math
        }, rng);
      }
      if (stageIndex === 6) {
        const wrong = story.operation === 'たしざん'
          ? story.math.a + '−' + story.math.b
          : story.math.a + '＋' + story.math.b;
        return finalizeQuestion({
          canonicalSkillId: SOLVE_STAGES[6].canonicalSkillId,
          kind: 'choice',
          prompt: story.text + ' 合う式は どれ？',
          correct: story.equation.split('＝')[0],
          options: [story.equation.split('＝')[0], wrong, String(story.answer)],
          story: true,
          visual: { type: 'story-model', text: story.text },
          hint: 'はじめの数と、動いた数を 式へ入れよう。',
          explain: '場面に合う式は ' + story.equation + '。',
          math: story.math
        }, rng);
      }
      if (stageIndex === 7) {
        return numericQuestion({
          canonicalSkillId: SOLVE_STAGES[7].canonicalSkillId,
          kind: 'slider',
          prompt: story.text + ' こたえは いくつ？',
          correct: story.answer,
          min: 0,
          max: 20,
          start: 0,
          story: true,
          visual: { type: 'relation', math: story.math },
          hint: '全体と部分の どこが分からないか 見よう。',
          explain: story.equation + '。'
        }, rng);
      }
      const expression = story.equation.split('＝')[0];
      return finalizeQuestion({
        canonicalSkillId: SOLVE_STAGES[8].canonicalSkillId,
        kind: 'route',
        prompt: 'この おはなしに 合う しきは？ ' + story.text,
        correct: expression,
        options: [expression, story.math.a + (story.operation === 'たしざん' ? '−' : '＋') + story.math.b, String(story.answer)],
        story: true,
        visual: { type: 'circuit', equation: story.text },
        hint: '増えたか、減ったかを たしかめよう。',
        explain: 'お話とつながるのは ' + story.equation + '。',
        math: story.math
      }, rng);
    }
    if (stageIndex === 9) {
      const groups = rand(2, 5, rng);
      const perGroup = rand(1, Math.min(5, Math.floor(20 / groups)), rng);
      const total = groups * perGroup;
      if (round % 2 === 0) {
        return selectorQuestion(perGroup, total, {
          canonicalSkillId: SOLVE_STAGES[9].canonicalSkillId,
          prompt: total + 'この おはじきを ' + groups + '人で おなじ数ずつ わける。一人ぶんは？',
          hint: 'ひとりずつ、じゅんばんに ひとつずつ くばってみよう。',
          explain: 'ひとりに ' + perGroup + 'こずつ くばれるよ。',
          story: true,
          visual: { type: 'equal-groups', groups, total, perGroup }
        }, rng);
      }
      return finalizeQuestion({
        canonicalSkillId: SOLVE_STAGES[9].canonicalSkillId,
        kind: 'choice',
        prompt: total + 'こを ' + perGroup + 'こずつ まとめると、何グループ？',
        correct: groups,
        options: numberChoices(groups, 1, 10, 4, rng),
        visual: { type: 'equal-groups', groups, total, perGroup },
        hint: perGroup + 'こずつ 丸で囲むつもりで 数えよう。',
        explain: perGroup + 'こずつで' + groups + 'グループできるよ。'
      }, rng);
    }
    const pool = [0, 1, 2, 3, 5, 6, 7, 8, 9];
    const q = buildSolveQuestion(pool[round % pool.length], round + 10, rng);
    return retagQuestion(q, { checkpoint: true, assessmentFor: SOLVE_STAGES[10].canonicalSkillId, story: q.story || round === 6 });
  }

  const BUILDERS = {
    number: buildNumberQuestion,
    addition: buildAdditionQuestion,
    subtraction: buildSubtractionQuestion,
    measure: buildMeasureQuestion,
    shape: buildShapeQuestion,
    solve: buildSolveQuestion
  };

  function buildQuestion(lineId, stageIndex, round, context) {
    const line = LINES[lineId] || LINES.number;
    const safeIndex = Math.max(0, Math.min(line.stages.length - 1, Number(stageIndex) || 0));
    const ctx = context || {};
    const rng = ctx.rng || Math.random;
    const builder = BUILDERS[line.id];
    const question = builder(safeIndex, Number(round) || 0, rng);
    if (!question.canonicalSkillId) question.canonicalSkillId = line.stages[safeIndex].canonicalSkillId;
    question.lineId = line.id;
    question.stageId = line.stages[safeIndex].id;
    question.stageIndex = safeIndex;
    question.signature = questionSignature(question);
    question.contentSignature = questionContentSignature(question);
    return question;
  }

  function makeStageQuestions(lineId, stageIndex, options) {
    const config = options || {};
    const seed = config.seed == null ? Date.now() : config.seed;
    const rng = seededRng(seed);
    const count = config.count || STAGE_ROUNDS;
    const recent = new Set(config.exclude || []);
    const used = new Set();
    const usedContent = new Set();
    const questions = [];
    for (let round = 0; round < count; round += 1) {
      let question;
      let guard = 0;
      const previousTemplate = questions.length ? questions[questions.length - 1].templateId : '';
      do {
        question = buildQuestion(lineId, stageIndex, round + guard, { rng });
        guard += 1;
      } while ((used.has(question.signature) || usedContent.has(question.contentSignature) || recent.has(question.signature) || recent.has(question.contentSignature) ||
        (question.templateId && question.templateId === previousTemplate)) && guard < 160);
      if (used.has(question.signature)) {
        question.signature = question.signature + '-' + round + '-' + hashString(seed + ':' + guard);
      }
      used.add(question.signature);
      usedContent.add(question.contentSignature);
      questions.push(question);
    }
    return { seed, questions };
  }

  const RUSH_STAGE_POOLS = {
    number: [0, 1, 2, 3, 5, 5, 6, 7, 8, 9, 9, 10],
    addition: [0, 1, 2, 3, 3, 5, 6, 7, 8, 9, 9, 10],
    subtraction: [0, 1, 2, 3, 5, 5, 6, 7, 7, 8, 9, 10],
    measure: [0, 1, 2, 3, 5, 5, 6, 7, 8, 9, 9, 10],
    shape: [0, 1, 2, 3, 3, 5, 6, 7, 8, 9, 9, 10],
    solve: [0, 1, 2, 3, 3, 5, 5, 6, 7, 8, 9, 10]
  };

  function spreadAdjacent(items, rng) {
    const remaining = shuffle(items, rng);
    const result = [];
    while (remaining.length) {
      const previous = result.length ? result[result.length - 1] : null;
      let candidateIndex = remaining.findIndex(function (value) { return value !== previous; });
      if (candidateIndex < 0) candidateIndex = 0;
      result.push(remaining.splice(candidateIndex, 1)[0]);
    }
    return result;
  }

  function makeTimeAttackQuestions(lineId, options) {
    const config = options || {};
    const seed = config.seed == null ? Date.now() : config.seed;
    const rng = seededRng(seed);
    const pool = spreadAdjacent(RUSH_STAGE_POOLS[lineId] || RUSH_STAGE_POOLS.number, rng);
    const used = new Set(config.exclude || []);
    const questions = [];
    pool.forEach(function (stageIndex, round) {
      let question;
      let guard = 0;
      const previous = questions.length ? questions[questions.length - 1] : null;
      do {
        question = buildQuestion(lineId, stageIndex, round + guard + 17, { rng });
        guard += 1;
      } while ((used.has(question.signature) || used.has(question.contentSignature) || (previous && question.templateId && question.templateId === previous.templateId)) && guard < 80);
      used.add(question.signature);
      used.add(question.contentSignature);
      question.rush = true;
      question.checkpoint = false;
      question.showHint = false;
      questions.push(question);
    });
    return { seed, questions: questions.slice(0, TIME_ATTACK_ROUNDS) };
  }

  function emptyStats() {
    return { totalAnswers: 0, correctAnswers: 0, totalSeconds: 0, bestChain: 0 };
  }

  function emptyTimeAttack() {
    return { runs: 0, bestMs: null, bestRawMs: null, bestMistakes: null, bestSeed: null, lastMs: null, lastMistakes: null, lastPlayed: null };
  }

  function createDefaultState() {
    const lineStats = {};
    const lineIntros = {};
    const timeAttack = {};
    LINE_ORDER.forEach(function (lineId) {
      lineStats[lineId] = emptyStats();
      lineIntros[lineId] = false;
      timeAttack[lineId] = emptyTimeAttack();
    });
    return {
      version: STATE_VERSION,
      introSeen: false,
      workshopName: '',
      lastLine: 'number',
      lastIsland: 'number',
      progress: {},
      parts: {},
      moods: {},
      settings: { sound: true, bgm: true, bgmVolume: 0.7, motion: true, adminUnlockG1: false, audioMixVersion: 2 },
      stats: emptyStats(),
      lineStats,
      islandStats: lineStats,
      lineIntros,
      islandIntros: lineIntros,
      timeAttack,
      recentQuestions: {},
      recentRush: {},
      history: []
    };
  }

  function stageLineId(stageId) {
    for (let i = 0; i < LINE_ORDER.length; i += 1) {
      const lineId = LINE_ORDER[i];
      if (LINES[lineId].stages.some(function (item) { return item.id === stageId; })) return lineId;
    }
    return 'addition';
  }

  function mergeStats(base, saved) {
    return Object.assign({}, base, saved || {});
  }

  function migrateState(saved) {
    const base = createDefaultState();
    if (!saved || typeof saved !== 'object') return base;
    const legacyFallback = Number(saved.version || 1) < 3 ? 'addition' : 'number';
    const lastLine = LINES[saved.lastLine] ? saved.lastLine : LINES[saved.lastIsland] ? saved.lastIsland : legacyFallback;
    base.introSeen = Boolean(saved.introSeen);
    base.workshopName = typeof saved.workshopName === 'string' ? saved.workshopName.slice(0, 8) : '';
    base.lastLine = lastLine;
    base.lastIsland = lastLine;
    base.progress = saved.progress && typeof saved.progress === 'object' ? saved.progress : {};
    base.parts = saved.parts && typeof saved.parts === 'object' ? saved.parts : {};
    base.moods = saved.moods && typeof saved.moods === 'object' ? saved.moods : {};
    const savedSettings = saved.settings && typeof saved.settings === 'object' ? saved.settings : {};
    base.settings = Object.assign({}, base.settings, savedSettings);
    if (!Object.prototype.hasOwnProperty.call(savedSettings, 'bgm')) base.settings.bgm = savedSettings.sound !== false;
    const bgmVolume = Number(base.settings.bgmVolume);
    base.settings.bgmVolume = Number.isFinite(bgmVolume) ? Math.max(0, Math.min(1, bgmVolume)) : 0.7;
    if (Number(saved.settings && saved.settings.audioMixVersion || 0) < 2 && base.settings.bgm && base.settings.bgmVolume > 0 && base.settings.bgmVolume <= 0.35) base.settings.bgmVolume = 0.7;
    base.settings.audioMixVersion = 2;
    base.settings.adminUnlockG1 = Boolean(base.settings.adminUnlockG1);
    base.stats = mergeStats(base.stats, saved.stats);
    const sourceLineStats = saved.lineStats || saved.islandStats || {};
    if (Number(saved.version || 1) === 1 && saved.stats) sourceLineStats.addition = mergeStats(emptyStats(), saved.stats);
    LINE_ORDER.forEach(function (lineId) {
      base.lineStats[lineId] = mergeStats(emptyStats(), sourceLineStats[lineId]);
      const sourceTime = saved.timeAttack && saved.timeAttack[lineId];
      base.timeAttack[lineId] = Object.assign(emptyTimeAttack(), sourceTime || {});
      base.lineIntros[lineId] = Boolean((saved.lineIntros && saved.lineIntros[lineId]) || (saved.islandIntros && saved.islandIntros[lineId]));
    });
    base.islandStats = base.lineStats;
    base.islandIntros = base.lineIntros;
    base.recentQuestions = saved.recentQuestions && typeof saved.recentQuestions === 'object' ? saved.recentQuestions : {};
    base.recentRush = saved.recentRush && typeof saved.recentRush === 'object' ? saved.recentRush : {};
    base.history = Array.isArray(saved.history) ? saved.history.slice(-240).map(function (item) {
      const lineId = LINES[item.lineId] ? item.lineId : LINES[item.islandId] ? item.islandId : stageLineId(item.stage);
      return Object.assign({}, item, { lineId, islandId: lineId });
    }) : [];
    return base;
  }

  function stagesFor(lineId) {
    return (LINES[lineId] || LINES.number).stages;
  }

  function clearedCount(state, lineId) {
    return stagesFor(lineId).filter(function (item) {
      return Boolean(state.progress && state.progress[item.id] && state.progress[item.id].cleared);
    }).length;
  }

  function totalMarks(state, lineId) {
    const stages = lineId ? stagesFor(lineId) : LINE_ORDER.reduce(function (all, id) { return all.concat(stagesFor(id)); }, []);
    return stages.reduce(function (sum, item) {
      return sum + Number(state.progress && state.progress[item.id] && state.progress[item.id].stars || 0);
    }, 0);
  }

  function isUnlocked(state, index, lineId) {
    if (index <= 0) return true;
    const stages = stagesFor(lineId);
    return Boolean(state.progress && state.progress[stages[index - 1].id] && state.progress[stages[index - 1].id].cleared);
  }

  function nextStageIndex(state, lineId) {
    const stages = stagesFor(lineId);
    const index = stages.findIndex(function (item, stageIndex) {
      return isUnlocked(state, stageIndex, lineId) && !(state.progress[item.id] && state.progress[item.id].cleared);
    });
    return index < 0 ? stages.length - 1 : index;
  }

  function isLineComplete(state, lineId) {
    return clearedCount(state, lineId) === stagesFor(lineId).length;
  }

  function formatTimeMs(milliseconds) {
    if (milliseconds == null) return '—';
    const totalTenths = Math.max(0, Math.round(milliseconds / 100));
    const minutes = Math.floor(totalTenths / 600);
    const seconds = Math.floor((totalTenths % 600) / 10);
    const tenths = totalTenths % 10;
    return (minutes ? minutes + ':' + String(seconds).padStart(2, '0') : String(seconds)) + '.' + tenths;
  }

  global.HiramekiCore = {
    STATE_VERSION,
    STORE_KEY,
    STAGE_ROUNDS,
    TIME_ATTACK_ROUNDS,
    TIME_ATTACK_PENALTY_MS,
    LINES,
    ISLANDS,
    LINE_ORDER,
    NUMBER_STAGES,
    ADDITION_STAGES,
    SUBTRACTION_STAGES,
    MEASURE_STAGES,
    SHAPE_STAGES,
    SOLVE_STAGES,
    BUILDERS,
    seededRng,
    rand,
    pick,
    shuffle,
    optionValue,
    semanticOptionContract,
    answerEquals,
    numberChoices,
    questionSignature,
    questionContentSignature,
    buildQuestion,
    makeStageQuestions,
    makeTimeAttackQuestions,
    spreadAdjacent,
    createDefaultState,
    defaultState: createDefaultState,
    migrateState,
    stagesFor,
    stageLineId,
    clearedCount,
    totalMarks,
    isUnlocked,
    nextStageIndex,
    isLineComplete,
    formatTimeMs
  };
}(typeof globalThis !== 'undefined' ? globalThis : window));
