(function (global) {
  'use strict';

  const GRADE_ID = 'g3';
  const STAGE_ROUNDS = 8;
  const TIME_ATTACK_ROUNDS = 12;

  const ZONES = Object.freeze([
    { id: 'A', name: 'きそ作業台', range: [1, 4], note: '具体物と図を動かして、新しい仕組みをつかむ' },
    { id: 'B', name: '組み替えフロア', range: [5, 8], note: '表し方や条件を変えて、既習の考えとつなぐ' },
    { id: 'C', name: '応用検査室', range: [9, 11], note: '生活場面と混合問題で、使える理解を確かめる' }
  ]);

  const QUESTION_POLICY = Object.freeze({
    rounds: STAGE_ROUNDS,
    operationMin: 5,
    storyMin: 1,
    storyMax: 2,
    representationChangeMin: 2,
    bareCalculationMax: 1,
    checkpointStages: [5, 11],
    recentSignatureWindow: 32,
    randomize: ['number', 'object', 'layout', 'direction', 'story', 'answer-position'],
    note: '式だけを連続させず、操作、図・式・場面の変換、短い生活問題、確認を混ぜる。'
  });

  function stage(config) {
    const zoneId = config.n <= 4 ? 'A' : config.n <= 8 ? 'B' : 'C';
    return Object.freeze(Object.assign({
      gradeId: GRADE_ID,
      zoneId,
      checkpoint: config.n === 5 || config.n === 11,
      builderId: config.id,
      interactions: [],
      prerequisites: [],
      curriculumRefs: [],
      timeAttackEligible: config.n !== 5 && config.n !== 11
    }, config));
  }

  const NUMBER_CALCULATION_STAGES = Object.freeze([
    stage({
      id: 'g3_calc_add_3digit', n: 1, name: '3けた合流筆算台',
      canonicalSkillId: 'g3.calculation.add_3digit',
      objective: '3位数どうしなどの加法を、位をそろえた筆算で確実に計算する。',
      action: '百・十・一のレーンをそろえ、10個を一つ上の位へ交換する。',
      interactions: ['place-value', 'exchange', 'repair-column'],
      prerequisites: ['g2.calculation.review', 'g2.number.place_value_4digit'],
      curriculumRefs: ['A(2)', '3社共通・3位数の加法筆算']
    }),
    stage({
      id: 'g3_calc_sub_3digit', n: 2, name: '3けた整理筆算台',
      canonicalSkillId: 'g3.calculation.sub_3digit',
      objective: '3位数どうしなどの減法を、位をそろえた筆算で確実に計算する。',
      action: '上の位の束を下の位へ両替し、指定された部品を取り出す。',
      interactions: ['place-value', 'exchange', 'repair-column'],
      prerequisites: ['g2.calculation.review', 'g3.calculation.add_3digit'],
      curriculumRefs: ['A(2)', '3社共通・3位数の減法筆算']
    }),
    stage({
      id: 'g3_calc_written_4digit', n: 3, name: '4けた連続両替リフト',
      canonicalSkillId: 'g3.calculation.add_sub_4digit',
      objective: '3位数・4位数の加減を筆算し、0をまたぐ繰り上がりや繰り下がりを処理する。',
      action: '複数階の位取りリフトを順番につなぎ、交換経路を完成する。',
      interactions: ['exchange-chain', 'place-value', 'repair-column'],
      prerequisites: ['g3.calculation.add_3digit', 'g3.calculation.sub_3digit'],
      curriculumRefs: ['A(2)', '3社共通・3位数、4位数の加減筆算']
    }),
    stage({
      id: 'g3_calc_mental_estimate', n: 4, name: '暗算・見当ショートカット盤',
      canonicalSkillId: 'g3.calculation.mental_estimate_check',
      objective: '簡単な2位数の加減を暗算し、見当や逆算で計算結果を確かめる。',
      action: '100を作る、数を分ける、逆向きにたどる検査回路を選ぶ。',
      interactions: ['route', 'estimate-range', 'inverse-check'],
      prerequisites: ['g2.calculation.properties_strategies', 'g3.calculation.add_sub_4digit'],
      curriculumRefs: ['A(2)', '内容の取扱い(2)・暗算と結果の見積り'],
      boundaryNote: '四捨五入や概数の形式的な計算は四年生へ送る。'
    }),
    stage({
      id: 'g3_calc_written_check', n: 5, name: 'たしひき制御チェッカー3',
      canonicalSkillId: 'g3.calculation.written.review',
      objective: '3位数・4位数の加減筆算、暗算、見積り、確かめを混合形式で確認する。',
      action: '位取りブロック、筆算、検査回路の故障箇所を見つけて直す。',
      interactions: ['exchange', 'repair-column', 'estimate-range', 'inverse-check'],
      prerequisites: ['g3.calculation.add_3digit', 'g3.calculation.sub_3digit', 'g3.calculation.add_sub_4digit', 'g3.calculation.mental_estimate_check'],
      curriculumRefs: ['A(2)総合・前半確認'],
      timeAttackEligible: false
    }),
    stage({
      id: 'g3_num_man_unit', n: 6, name: '万パーツ束ね機',
      canonicalSkillId: 'g3.number.ten_thousands',
      objective: '万を単位として大きな数を読み、書き、まとまりで捉える。',
      action: '千ケース10個を万ケースへ束ね、4桁区切りで表示する。',
      interactions: ['group', 'place-value', 'compose'],
      prerequisites: ['g2.number.place_value_4digit'],
      curriculumRefs: ['A(1)ア', '3社共通・10000より大きい数']
    }),
    stage({
      id: 'g3_num_to100million', n: 7, name: '一億表示タワー',
      canonicalSkillId: 'g3.number.to100million',
      objective: '一億までの整数を読み書きし、0を含む数を位取りに基づいて構成・分解する。',
      action: '一の組と万の組に分けた表示塔へ数字板を置き、大きな数を組み立てる。',
      interactions: ['place-value', 'compose', 'keypad'],
      prerequisites: ['g3.number.ten_thousands'],
      curriculumRefs: ['A(1)', '内容の取扱い(1)・1億', '3社共通・一億までの数'],
      boundaryNote: '何億・何兆という体系的な扱いは四年生へ送る。'
    }),
    stage({
      id: 'g3_num_order_line', n: 8, name: '大きな数レール3',
      canonicalSkillId: 'g3.number.order_number_line',
      objective: '大きな数の大小・順序・系列を捉え、数直線上の位置を判断する。',
      action: '目盛りの一つ分を決め、数車両を正しい位置や順番へ走らせる。',
      interactions: ['number-line', 'compare', 'order'],
      prerequisites: ['g3.number.to100million', 'g2.number.number_line_sequence'],
      curriculumRefs: ['A(1)', '用語・記号 等号、不等号、数直線']
    }),
    stage({
      id: 'g3_num_scale_transform', n: 9, name: '位取り倍率ギア',
      canonicalSkillId: 'g3.number.scale_10_100_1000_tenth',
      objective: '整数の10倍、100倍、1000倍、10分の1と、数の相対的な大きさを理解する。',
      action: '数字と束を位ごとに左右へ移し、変わる位と変わらない仕組みを確かめる。',
      interactions: ['place-shift', 'exchange', 'match'],
      prerequisites: ['g3.number.order_number_line'],
      curriculumRefs: ['A(1)イ・ウ', '3社共通・10倍、100倍、1000倍、10で割った数']
    }),
    stage({
      id: 'g3_num_soroban', n: 10, name: 'そろばん位取り制御盤',
      canonicalSkillId: 'g3.number.abacus_integer_decimal_add_sub',
      objective: 'そろばんで万までの整数や小数第一位までの数を表し、簡単な加減をする。',
      action: '珠を5と10のまとまりで入れ替え、表示と計算回路を同期させる。',
      interactions: ['abacus', 'compose', 'add-remove'],
      prerequisites: ['g3.number.ten_thousands', 'g3.calculation.written.review', 'g3.decimal.written_add_sub'],
      curriculumRefs: ['A(8)', '3社共通・そろばん'],
      boundaryNote: '複雑な珠算技能ではなく、位取り記数法と簡単な加減を扱う。'
    }),
    stage({
      id: 'g3_num_calc_core', n: 11, name: '位取り計算メインコア3',
      canonicalSkillId: 'g3.number_calculation.review',
      objective: '3・4位数の加減、一億までの数、倍率、暗算・見積り、そろばんを総合する。',
      action: '問題に合う位取り、筆算、数直線、検査、そろばん装置を自分で選ぶ。',
      interactions: ['place-value', 'repair-column', 'number-line', 'estimate-range', 'abacus'],
      prerequisites: ['g3.calculation.written.review', 'g3.number.scale_10_100_1000_tenth', 'g3.number.abacus_integer_decimal_add_sub'],
      curriculumRefs: ['A(1)(2)(8)総合'],
      timeAttackEligible: false
    })
  ]);

  const MULTIPLICATION_STAGES = Object.freeze([
    stage({
      id: 'g3_mul_zero_ten_unknown', n: 1, name: '九九きまり再起動盤',
      canonicalSkillId: 'g3.multiplication.zero_ten_unknown',
      objective: '九九の意味ときまりを使い、0・10を含む乗法や未知の乗数・被乗数を考える。',
      action: '九九表とアレイの欠けたセルを、まとまりを動かして復旧する。',
      interactions: ['grid', 'missing-number', 'match'],
      prerequisites: ['g2.multiplication.review'],
      curriculumRefs: ['A(3)', '内容の取扱い(3)・0の乗法', '3社共通・かけ算のきまり']
    }),
    stage({
      id: 'g3_mul_change_commutative', n: 2, name: '積の変化スキャナー',
      canonicalSkillId: 'g3.multiplication.change_commutative',
      objective: '乗数が増減するときの積の変化と、交換法則を使って計算を確かめる。',
      action: 'アレイの行や列を増減・回転し、変化した部分を点灯する。',
      interactions: ['grid', 'rotate', 'sequence'],
      prerequisites: ['g3.multiplication.zero_ten_unknown'],
      curriculumRefs: ['A(3)ウ', '内容の取扱い(4)・交換法則']
    }),
    stage({
      id: 'g3_mul_distributive', n: 3, name: '分配アレイ分解機',
      canonicalSkillId: 'g3.multiplication.associative_distributive',
      objective: '結合法則・分配法則を具体的な数と図で見いだし、計算を組み替える。',
      action: '大きなアレイを切り分け、順序を変え、部分積を再び合流する。',
      interactions: ['split-grid', 'group', 'route'],
      prerequisites: ['g3.multiplication.change_commutative'],
      curriculumRefs: ['A(3)ウ', '内容の取扱い(4)・結合法則、分配法則']
    }),
    stage({
      id: 'g3_mul_tens_hundreds', n: 4, name: '何十・何百増幅機',
      canonicalSkillId: 'g3.multiplication.tens_hundreds_by_1digit',
      objective: '何十・何百に1位数をかける計算を、10や100の幾つ分として求める。',
      action: '10・100のケースを指定回数だけ複製し、答えの見当も置く。',
      interactions: ['duplicate', 'place-value', 'estimate-range'],
      prerequisites: ['g3.multiplication.associative_distributive', 'g2.number.relative_units'],
      curriculumRefs: ['A(3)', '3社共通・何十、何百×1位数']
    }),
    stage({
      id: 'g3_mul_properties_check', n: 5, name: 'かけ算きまりチェッカー3',
      canonicalSkillId: 'g3.multiplication.properties.review',
      objective: '0・10の乗法、積の変化、三つの性質、何十・何百の乗法を確認する。',
      action: '九九表、アレイ、束、式の食い違いを見つけて修理する。',
      interactions: ['grid', 'split-grid', 'place-value', 'repair'],
      prerequisites: ['g3.multiplication.zero_ten_unknown', 'g3.multiplication.change_commutative', 'g3.multiplication.associative_distributive', 'g3.multiplication.tens_hundreds_by_1digit'],
      curriculumRefs: ['A(3)前半・確認'],
      timeAttackEligible: false
    }),
    stage({
      id: 'g3_mul_two_by_one_model', n: 6, name: '2けた×1けた配線台',
      canonicalSkillId: 'g3.multiplication.2digit_by_1digit_model',
      objective: '2位数×1位数を十と一へ分け、部分積を合わせる考えを筆算へつなぐ。',
      action: '十と一のアレイを別々に増幅し、二つの部分積を合流する。',
      interactions: ['split-grid', 'partial-products', 'combine'],
      prerequisites: ['g3.multiplication.properties.review', 'g2.multiplication.times_simple_2digit'],
      curriculumRefs: ['A(3)', '3社共通・2位数×1位数の仕組み']
    }),
    stage({
      id: 'g3_mul_written_by_one', n: 7, name: 'くり上がり増幅タワー',
      canonicalSkillId: 'g3.multiplication.written_by_1digit',
      objective: '2位数・3位数×1位数を、繰り上がりや0を含む場合も筆算する。',
      action: '一・十・百の部分積を階ごとに作り、10個を上の階へ送る。',
      interactions: ['partial-products', 'exchange', 'repair-column'],
      prerequisites: ['g3.multiplication.2digit_by_1digit_model'],
      curriculumRefs: ['A(3)ア・イ', '3社共通・かけ算の筆算(1)']
    }),
    stage({
      id: 'g3_mul_by_tens', n: 8, name: '何十倍ギア',
      canonicalSkillId: 'g3.multiplication.by_tens',
      objective: '1位数・2位数に何十をかける計算を、10倍と1位数の乗法へ分けて考える。',
      action: '一位数ギアと10倍ギアを順につなぎ、部分積の位をそろえる。',
      interactions: ['gear-route', 'place-shift', 'match'],
      prerequisites: ['g3.multiplication.written_by_1digit', 'g3.number.scale_10_100_1000_tenth'],
      curriculumRefs: ['A(3)', '3社共通・何十をかける計算']
    }),
    stage({
      id: 'g3_mul_two_by_two', n: 9, name: '2けた乗数分解盤',
      canonicalSkillId: 'g3.multiplication.2digit_by_2digit',
      objective: '2位数×2位数を、乗数を十と一に分けた部分積から筆算する。',
      action: '二本の部分積レーンを正しい位から始め、最後に重ねて合流する。',
      interactions: ['partial-products', 'place-value', 'repair-column'],
      prerequisites: ['g3.multiplication.by_tens'],
      curriculumRefs: ['A(3)ア・イ', '3社共通・2位数をかける筆算']
    }),
    stage({
      id: 'g3_mul_three_by_two', n: 10, name: '大型増幅設計台',
      canonicalSkillId: 'g3.multiplication.3digit_by_2digit',
      objective: '3位数×2位数を筆算し、性質・暗算・見積りを使って計算を確かめる。',
      action: '複数の分解案から回路を選び、部分積と答えの範囲を検査する。',
      interactions: ['partial-products', 'route', 'estimate-range'],
      prerequisites: ['g3.multiplication.2digit_by_2digit'],
      curriculumRefs: ['A(3)', '内容の取扱い(2)・暗算と見積り', '3社共通・3位数×2位数'],
      boundaryNote: '3位数×3位数や小数の乗法は扱わない。'
    }),
    stage({
      id: 'g3_mul_core', n: 11, name: 'かけ算メインコア3',
      canonicalSkillId: 'g3.multiplication.review',
      objective: '乗法の性質、部分積、2・3位数×1・2位数の筆算と活用を総合する。',
      action: '数と場面に合うアレイ、分解、筆算、検査装置を自分で選ぶ。',
      interactions: ['grid', 'split-grid', 'partial-products', 'story-model', 'estimate-range'],
      prerequisites: ['g3.multiplication.properties.review', 'g3.multiplication.3digit_by_2digit'],
      curriculumRefs: ['A(3)総合'],
      timeAttackEligible: false
    })
  ]);

  const DIVISION_STAGES = Object.freeze([
    stage({
      id: 'g3_div_partitive', n: 1, name: '同じ数ずつ配る台',
      canonicalSkillId: 'g3.division.partitive',
      objective: '等分除の場面で、全体を同じ人数に分けた一人分を求める。',
      action: '部品を全トレイへ一個ずつ配り、一つ分をそろえる。',
      interactions: ['deal', 'group', 'story-model'],
      prerequisites: ['g2.multiplication.equal_groups', 'g2.number.unit_fractions'],
      curriculumRefs: ['A(4)ア', '3社共通・等分除']
    }),
    stage({
      id: 'g3_div_quotative', n: 2, name: 'いくつ分パック機',
      canonicalSkillId: 'g3.division.quotative',
      objective: '包含除の場面で、全体から同じ数ずつ取ると何組できるかを求める。',
      action: '指定個数ずつ部品を箱へ詰め、できた箱の数を数える。',
      interactions: ['pack', 'group', 'story-model'],
      prerequisites: ['g3.division.partitive', 'g2.multiplication.equal_groups'],
      curriculumRefs: ['A(4)ア', '3社共通・包含除']
    }),
    stage({
      id: 'g3_div_scene_expression', n: 3, name: 'わり算式メーカー',
      canonicalSkillId: 'g3.division.scene_expression',
      objective: '二種類の除法場面を式に表し、式から分け方や求める量を読み取る。',
      action: '場面カード、分配操作、÷の式、答えの単位を順に接続する。',
      interactions: ['match', 'order', 'story-model'],
      prerequisites: ['g3.division.partitive', 'g3.division.quotative'],
      curriculumRefs: ['A(4)イ', '3社共通・除法の場面、図、式']
    }),
    stage({
      id: 'g3_div_inverse_facts', n: 4, name: '九九逆回転モニター',
      canonicalSkillId: 'g3.division.inverse_facts',
      objective: '乗法・減法との関係を使い、除数と商が1位数の除法を確実に計算する。',
      action: '九九回路を逆向きに動かし、繰り返し取り出す動きと答えを照合する。',
      interactions: ['inverse-route', 'repeated-remove', 'missing-number'],
      prerequisites: ['g3.division.scene_expression', 'g2.multiplication.review'],
      curriculumRefs: ['A(4)ウ・エ', '3社共通・九九を使うわり算']
    }),
    stage({
      id: 'g3_div_meaning_check', n: 5, name: 'わり算きそチェッカー',
      canonicalSkillId: 'g3.division.meaning.review',
      objective: '等分除・包含除、式、九九との関係、商が1位数の除法を確認する。',
      action: '分け方、操作図、式、九九回路の食い違いを見つけて直す。',
      interactions: ['deal', 'pack', 'match', 'inverse-route'],
      prerequisites: ['g3.division.partitive', 'g3.division.quotative', 'g3.division.scene_expression', 'g3.division.inverse_facts'],
      curriculumRefs: ['A(4)前半・確認'],
      timeAttackEligible: false
    }),
    stage({
      id: 'g3_div_special_cases', n: 6, name: '0・同数・1分配ゲート',
      canonicalSkillId: 'g3.division.special_cases',
      objective: '0÷a、a÷a、a÷1の意味と答えを具体的な場面から理解する。',
      action: '空の部品列、同数のトレイ、一つのトレイを実際に動かす。',
      interactions: ['deal', 'select-case', 'match'],
      prerequisites: ['g3.division.meaning.review'],
      curriculumRefs: ['A(4)', '3社共通・a÷a、0÷a、a÷1'],
      boundaryNote: '0で割る計算は扱わない。'
    }),
    stage({
      id: 'g3_div_remainder_compute', n: 7, name: 'あまり検出センサー',
      canonicalSkillId: 'g3.division.remainder_compute_check',
      objective: '余りのある除法を計算し、余りが除数より小さいことと確かめ方を理解する。',
      action: '分け切れない部品を余りポケットへ送り、除数×商＋余りの図で検査する。',
      interactions: ['pack', 'remainder-pocket', 'inverse-check'],
      prerequisites: ['g3.division.meaning.review'],
      curriculumRefs: ['A(4)ア・ウ', '3社共通・あまりのあるわり算']
    }),
    stage({
      id: 'g3_div_remainder_context', n: 8, name: 'あまり判断デスク',
      canonicalSkillId: 'g3.division.remainder_context',
      objective: '余りを残す、切り上げる、不足分を求めるなど、場面に合う答え方を選ぶ。',
      action: '余り部品の行き先を選び、箱数・座席数・余りの答えを完成する。',
      interactions: ['story-model', 'select-outcome', 'remainder-pocket'],
      prerequisites: ['g3.division.remainder_compute_check'],
      curriculumRefs: ['A(4)イ', '3社共通・余りのとらえ方']
    }),
    stage({
      id: 'g3_div_simple_two_digit', n: 9, name: '大きな数分配機',
      canonicalSkillId: 'g3.division.simple_2digit_by_1digit',
      objective: '80÷4や69÷3など、簡単な場合の1位数で割って商が2位数になる除法を考える。',
      action: '十と一に分けた部品を別々に分配し、二つの商を合流する。',
      interactions: ['place-value', 'deal', 'combine'],
      prerequisites: ['g3.division.inverse_facts', 'g2.number.relative_units'],
      curriculumRefs: ['A(4)オ', '3社共通・簡単な商2位数の除法'],
      boundaryNote: '80÷4、69÷3のように各位が割り切れる場合まで。一般的な除法筆算は四年生へ送る。'
    }),
    stage({
      id: 'g3_div_multiplicative_comparison', n: 10, name: '倍関係テープ',
      canonicalSkillId: 'g3.division.multiplicative_comparison',
      objective: '比較量・基準量・何倍かの関係を、乗法・除法・図を使って求める。',
      action: '基準テープを複製・分割し、未知の量に合う計算回路を接続する。',
      interactions: ['tape-diagram', 'duplicate', 'operation-choice'],
      prerequisites: ['g3.division.remainder_context', 'g3.multiplication.properties.review'],
      curriculumRefs: ['A(3)(4)(7)', '3社共通・倍とかけ算、わり算']
    }),
    stage({
      id: 'g3_div_core', n: 11, name: 'わり算メインコア',
      canonicalSkillId: 'g3.division.review',
      objective: '除法の二つの意味、余り、簡単な商2位数、倍の関係を総合する。',
      action: '場面に合う分配装置と答え方を選び、乗法の逆回路で確かめる。',
      interactions: ['deal', 'pack', 'remainder-pocket', 'tape-diagram', 'inverse-check'],
      prerequisites: ['g3.division.meaning.review', 'g3.division.simple_2digit_by_1digit', 'g3.division.multiplicative_comparison'],
      curriculumRefs: ['A(4)総合'],
      timeAttackEligible: false
    })
  ]);

  const DECIMAL_FRACTION_STAGES = Object.freeze([
    stage({
      id: 'g3_decimal_tenths_measure', n: 1, name: '0.1精密タンク',
      canonicalSkillId: 'g3.decimal.tenths_measure',
      objective: '1を10等分した一つ分を0.1として、測定の端数を小数で表す。',
      action: '1Lや1mの装置を10区画に分け、端数部分へ0.1チップを置く。',
      interactions: ['partition', 'measure', 'match'],
      prerequisites: ['g2.measure.capacity_ml_relations', 'g2.measure.line_draw_calculate'],
      curriculumRefs: ['A(5)ア', '3社共通・小数の導入']
    }),
    stage({
      id: 'g3_decimal_place_value', n: 2, name: '小数位取りスライダー',
      canonicalSkillId: 'g3.decimal.place_value_compose',
      objective: '小数第一位までの数を読み書きし、一と0.1の幾つ分として構成・分解する。',
      action: '一と0.1の部品を位取り盤へ置き、小数点を固定して組み替える。',
      interactions: ['place-value', 'compose', 'keypad'],
      prerequisites: ['g3.decimal.tenths_measure', 'g3.number.scale_10_100_1000_tenth'],
      curriculumRefs: ['A(5)ア', '3社共通・小数第一位の位取り']
    }),
    stage({
      id: 'g3_decimal_order_line', n: 3, name: '小数レール',
      canonicalSkillId: 'g3.decimal.order_number_line',
      objective: '整数間を10等分した数直線で、小数の順序・大小・相対的な大きさを捉える。',
      action: '0.1刻みの目盛りを作り、小数車両を正しい位置へ走らせる。',
      interactions: ['number-line', 'compare', 'order'],
      prerequisites: ['g3.decimal.place_value_compose', 'g3.number.order_number_line'],
      curriculumRefs: ['A(5)', '3社共通・小数の数直線、大小']
    }),
    stage({
      id: 'g3_decimal_add_sub_meaning', n: 4, name: '0.1単位たしひき台',
      canonicalSkillId: 'g3.decimal.add_sub_meaning',
      objective: '0.1の何個分として、小数第一位までの加法・減法の意味と求め方を考える。',
      action: '0.1チップを追加・取り出しし、整数の加減回路へつなぐ。',
      interactions: ['add-remove', 'unitize', 'story-model'],
      prerequisites: ['g3.decimal.order_number_line', 'g3.calculation.written.review'],
      curriculumRefs: ['A(5)イ', '3社共通・小数の加減']
    }),
    stage({
      id: 'g3_decimal_basic_check', n: 5, name: '小数きそチェッカー',
      canonicalSkillId: 'g3.decimal.basic.review',
      objective: '0.1、位取り、数直線、大小、小数加減の意味を混合形式で確認する。',
      action: '測定、位取り、数直線、式の表示を照合し、ずれを修理する。',
      interactions: ['partition', 'place-value', 'number-line', 'repair'],
      prerequisites: ['g3.decimal.tenths_measure', 'g3.decimal.place_value_compose', 'g3.decimal.order_number_line', 'g3.decimal.add_sub_meaning'],
      curriculumRefs: ['A(5)前半・確認'],
      timeAttackEligible: false
    }),
    stage({
      id: 'g3_decimal_written_add_sub', n: 6, name: '小数点そろえ筆算盤',
      canonicalSkillId: 'g3.decimal.written_add_sub',
      objective: '小数点と位をそろえ、小数第一位までの繰り上がり・繰り下がりを含む加減をする。',
      action: '0.1チップ10枚と一の部品を交換し、筆算の故障箇所も直す。',
      interactions: ['place-value', 'exchange', 'repair-column'],
      prerequisites: ['g3.decimal.basic.review'],
      curriculumRefs: ['A(5)イ', '3社共通・小数の加減筆算'],
      boundaryNote: '小数第二位以降と小数の乗除は扱わない。'
    }),
    stage({
      id: 'g3_fraction_measure_notation', n: 7, name: '分数ものさし',
      canonicalSkillId: 'g3.fraction.measure_notation',
      objective: '等分した部分や端数の量を分数で表し、分母・分子の意味を理解する。',
      action: '1m・1Lを等分し、指定された部分へ分母・分子カードを置く。',
      interactions: ['partition', 'select-parts', 'label'],
      prerequisites: ['g2.number.unit_fractions', 'g3.decimal.tenths_measure'],
      curriculumRefs: ['A(6)ア', '用語 分母、分子', '3社共通・分数の意味と表し方']
    }),
    stage({
      id: 'g3_fraction_unit_compare', n: 8, name: '単位分数レール',
      canonicalSkillId: 'g3.fraction.unit_compare_decimal_relation',
      objective: '分数を単位分数の幾つ分として数直線に置き、同分母の大小と0.1＝1/10を理解する。',
      action: '同じ一を基準にした小数・分数レールへ等しい大きさを重ねる。',
      interactions: ['number-line', 'compare', 'overlay'],
      prerequisites: ['g3.fraction.measure_notation', 'g3.decimal.order_number_line'],
      curriculumRefs: ['A(6)イ', '内容の取扱い(5)・0.1と1/10', '3社共通・単位分数、大小']
    }),
    stage({
      id: 'g3_fraction_simple_add_sub', n: 9, name: '同分母たしひき連結器',
      canonicalSkillId: 'g3.fraction.simple_add_sub',
      objective: '真分数どうしで和が1までの同分母加法と、その逆の減法をする。',
      action: '同じ大きさの分数片をつなぐ・外す操作を、単位分数の個数と式へ変換する。',
      interactions: ['fraction-pieces', 'combine', 'remove'],
      prerequisites: ['g3.fraction.unit_compare_decimal_relation'],
      curriculumRefs: ['A(6)ウ', '3社共通・簡単な同分母分数の加減'],
      boundaryNote: '仮分数・帯分数の分類、和が1を超える計算、異分母計算は扱わない。'
    }),
    stage({
      id: 'g3_precision_representations', n: 10, name: '小数・分数変換モニター',
      canonicalSkillId: 'g3.precision.representations_apply',
      objective: '量、数直線、小数、分数、式の表現を対応させ、生活場面で使い分ける。',
      action: '同じ量を表すタンク、テープ、数直線、数カードを正しい回路でつなぐ。',
      interactions: ['match', 'overlay', 'story-model'],
      prerequisites: ['g3.decimal.written_add_sub', 'g3.fraction.simple_add_sub'],
      curriculumRefs: ['A(5)(6)・活用', '3社共通・小数と分数の関連']
    }),
    stage({
      id: 'g3_precision_core', n: 11, name: '精密数メインコア',
      canonicalSkillId: 'g3.precision_number.review',
      objective: '小数第一位の加減、分数の意味・大小・簡単な加減、両者の関係を総合する。',
      action: '量・位取り・数直線・筆算・分数片を問題に応じて切り替える。',
      interactions: ['measure', 'place-value', 'number-line', 'repair-column', 'fraction-pieces'],
      prerequisites: ['g3.decimal.basic.review', 'g3.decimal.written_add_sub', 'g3.precision.representations_apply'],
      curriculumRefs: ['A(5)(6)総合'],
      timeAttackEligible: false
    })
  ]);

  const MEASURE_STAGES = Object.freeze([
    stage({
      id: 'g3_measure_second', n: 1, name: '1秒リズム発生器',
      canonicalSkillId: 'g3.measure.second',
      objective: '時間の単位「秒」を知り、1秒・10秒・60秒の感覚をもつ。',
      action: '秒針やリズムに合わせて計時ボタンを押し、見当と実測を比べる。',
      interactions: ['timer', 'rhythm-tap', 'estimate'],
      prerequisites: ['g2.measure.day_am_pm', 'g2.measure.time_duration'],
      curriculumRefs: ['C(2)ア', '3社共通・秒']
    }),
    stage({
      id: 'g3_measure_second_relation', n: 2, name: '60秒交換タイマー',
      canonicalSkillId: 'g3.measure.second_minute_relation',
      objective: '1分＝60秒の関係を理解し、生活場面に合う時間の単位を選ぶ。',
      action: '秒チップ60個を1分カプセルへ交換し、計測装置を選ぶ。',
      interactions: ['exchange', 'unit-choice', 'timer'],
      prerequisites: ['g3.measure.second'],
      curriculumRefs: ['C(2)ア', '3社共通・1分＝60秒']
    }),
    stage({
      id: 'g3_measure_elapsed_time', n: 3, name: '経過時間レール',
      canonicalSkillId: 'g3.measure.time_duration',
      objective: '開始時刻から、正時や正午をまたぐ日常的な経過時間を求める。',
      action: '時計の針と時間数直線を連動させ、進んだ区間を分けて数える。',
      interactions: ['clock', 'timeline', 'route'],
      prerequisites: ['g3.measure.second_minute_relation', 'g2.measure.time_duration'],
      curriculumRefs: ['C(2)イ', '3社共通・時刻と時間の計算']
    }),
    stage({
      id: 'g3_measure_start_end_time', n: 4, name: '出発・到着逆算時計',
      canonicalSkillId: 'g3.measure.time_start_end',
      objective: '終了時刻や経過時間から、日常的な開始時刻・終了時刻を求める。',
      action: '時間ブロックを時計の前後へ動かし、出発・到着カードを置く。',
      interactions: ['clock', 'timeline', 'inverse-route'],
      prerequisites: ['g3.measure.time_duration'],
      curriculumRefs: ['C(2)イ', '3社共通・前後の時刻'],
      boundaryNote: '複雑な時間換算だけを目的とする問題は扱わない。'
    }),
    stage({
      id: 'g3_measure_time_check', n: 5, name: '時間チェッカー3',
      canonicalSkillId: 'g3.measure.time.review',
      objective: '秒、1分＝60秒、経過時間、開始・終了時刻を生活場面で確認する。',
      action: 'リズム、時計、数直線、予定カードのずれを見つけて直す。',
      interactions: ['timer', 'clock', 'timeline', 'repair'],
      prerequisites: ['g3.measure.second', 'g3.measure.second_minute_relation', 'g3.measure.time_duration', 'g3.measure.time_start_end'],
      curriculumRefs: ['C(2)総合・前半確認'],
      timeAttackEligible: false
    }),
    stage({
      id: 'g3_measure_tape_path', n: 6, name: '巻尺フィールド',
      canonicalSkillId: 'g3.measure.tape_distance_path',
      objective: '長い物や曲がった所を見積もり、巻尺を使って長さ・道のりを測る。',
      action: '対象に合う道具を選び、巻尺を曲線や区間へ沿わせて目盛りを読む。',
      interactions: ['tool-choice', 'tape-measure', 'estimate'],
      prerequisites: ['g2.measure.review'],
      curriculumRefs: ['C(1)', '3社共通・巻尺、距離、道のり']
    }),
    stage({
      id: 'g3_measure_kilometer', n: 7, name: 'kmルートレール',
      canonicalSkillId: 'g3.measure.kilometer_distance',
      objective: 'kmと1km＝1000mを理解し、距離や道のりに適切な単位を使う。',
      action: '地図上の区間をつなぎ、1000mケースと1kmケースを交換する。',
      interactions: ['map-route', 'exchange', 'unit-choice'],
      prerequisites: ['g3.measure.tape_distance_path', 'g2.number.relative_units'],
      curriculumRefs: ['C(1)ア', '3社共通・km、1km＝1000m']
    }),
    stage({
      id: 'g3_measure_gram_scale', n: 8, name: 'gおもりつり合い台',
      canonicalSkillId: 'g3.measure.gram_scale',
      objective: '重さを単位の幾つ分として捉え、gと天秤・はかりを使って測る。',
      action: '基準おもりと品物をつり合わせ、0点と一目盛りを確かめる。',
      interactions: ['balance-scale', 'scale-read', 'estimate'],
      prerequisites: ['g3.measure.tape_distance_path', 'g2.measure.common_unit_estimate'],
      curriculumRefs: ['C(1)ア', '3社共通・重さ、g、はかり']
    }),
    stage({
      id: 'g3_measure_kilogram', n: 9, name: 'kg大型はかりモニター',
      canonicalSkillId: 'g3.measure.kilogram_relation_tool',
      objective: 'kgと1kg＝1000gを理解し、秤量・感量に着目して適切なはかりを選ぶ。',
      action: '品物を測れる範囲と目盛り幅に合うはかりへ載せ、gとkgを交換する。',
      interactions: ['tool-choice', 'scale-read', 'exchange'],
      prerequisites: ['g3.measure.gram_scale', 'g3.number.scale_10_100_1000_tenth'],
      curriculumRefs: ['C(1)ア・イ', '3社共通・kg、1kg＝1000g']
    }),
    stage({
      id: 'g3_measure_ton_net', n: 10, name: '正味・t重量ネットワーク',
      canonicalSkillId: 'g3.measure.ton_net_tare_total',
      objective: '全体・容器・正味の重さを加減で求め、tと1t＝1000kg、身近な単位の接頭語k・mにも触れる。',
      action: '容器を分離して三つの重さを配線し、大型品をtゲートへ送り、km・kgとmm・mLの単位札をk・mへ対応させる。',
      interactions: ['separate', 'relation-diagram', 'unit-choice', 'prefix-match'],
      prerequisites: ['g3.measure.kilogram_relation_tool', 'g3.calculation.written.review'],
      curriculumRefs: ['C(1)', '内容の取扱い(7)・接頭語k・m、t', '3社共通・正味、風袋、全体の重さ'],
      boundaryNote: '接頭語はkm・kg・mm・mLなど既習の単位を結び付ける範囲とし、未知の単位換算ドリルへ広げない。'
    }),
    stage({
      id: 'g3_measure_core', n: 11, name: '計測メインコア3',
      canonicalSkillId: 'g3.measure.review',
      objective: '時刻・時間、km、g・kg・t、見積り、計器選択を総合する。',
      action: '対象を見積もってから、単位・道具・求め方を選び、結果を検査する。',
      interactions: ['estimate', 'tool-choice', 'clock', 'map-route', 'scale-read'],
      prerequisites: ['g3.measure.time.review', 'g3.measure.kilometer_distance', 'g3.measure.ton_net_tare_total'],
      curriculumRefs: ['C(1)(2)総合'],
      timeAttackEligible: false
    })
  ]);

  const SHAPE_STAGES = Object.freeze([
    stage({
      id: 'g3_shape_circle_parts', n: 1, name: '円パーツスキャナー',
      canonicalSkillId: 'g3.shape.circle_parts_properties',
      objective: '円の中心・半径・直径を知り、半径がどこでも等しいことを理解する。',
      action: '中心から円周へ半径アームを伸ばし、直径を中心へ通す。',
      interactions: ['select-center', 'radius-arm', 'match'],
      prerequisites: ['g1.shape.faces', 'g2.shape.review'],
      curriculumRefs: ['B(1)ウ', '3社共通・円の中心、半径、直径']
    }),
    stage({
      id: 'g3_shape_compass_circle', n: 2, name: 'コンパス円設計盤',
      canonicalSkillId: 'g3.shape.compass_circle_equal_length',
      objective: 'コンパスで円をかき、等しい長さを写し取る道具としても使う。',
      action: '半径を固定し、中心を選んで円や等しい長さの印を作る。',
      interactions: ['compass', 'draw', 'transfer-length'],
      prerequisites: ['g3.shape.circle_parts_properties', 'g2.measure.line_draw_calculate'],
      curriculumRefs: ['B(1)', '内容の取扱い(6)・定規、コンパス']
    }),
    stage({
      id: 'g3_shape_circle_pattern', n: 3, name: 'コンパス模様工房',
      canonicalSkillId: 'g3.shape.circle_pattern_apply',
      objective: '円の中心と等しい半径の性質を使い、模様や回転する形を構成する。',
      action: '同じ半径の円を重ね、中心を移して規則的な模様を完成する。',
      interactions: ['compass', 'pattern-build', 'rotate'],
      prerequisites: ['g3.shape.compass_circle_equal_length'],
      curriculumRefs: ['B(1)・活用', '内容の取扱い(6)・模様']
    }),
    stage({
      id: 'g3_shape_sphere', n: 4, name: '球体検査ドック',
      canonicalSkillId: 'g3.shape.sphere_parts_cross_section',
      objective: '球の中心・半径・直径と、平面で切った切り口が円になることを理解する。',
      action: '球を回転・切断し、はさむ装置で直径を測る。',
      interactions: ['rotate', 'slice', 'clamp-measure'],
      prerequisites: ['g3.shape.circle_parts_properties'],
      curriculumRefs: ['B(1)ウ', '3社共通・球']
    }),
    stage({
      id: 'g3_shape_circle_check', n: 5, name: '円・球チェッカー3',
      canonicalSkillId: 'g3.shape.circle_sphere.review',
      objective: '円・球の中心、半径、直径、コンパスの使い方を混合形式で確認する。',
      action: '円の設計図、コンパス、模様、球の断面の故障箇所を直す。',
      interactions: ['radius-arm', 'compass', 'pattern-build', 'slice'],
      prerequisites: ['g3.shape.circle_parts_properties', 'g3.shape.compass_circle_equal_length', 'g3.shape.circle_pattern_apply', 'g3.shape.sphere_parts_cross_section'],
      curriculumRefs: ['B(1)前半・確認'],
      timeAttackEligible: false
    }),
    stage({
      id: 'g3_shape_triangle_classify', n: 6, name: '等しい辺スキャナー',
      canonicalSkillId: 'g3.shape.isosceles_equilateral_classify',
      objective: '辺の長さの相等に着目して、直角二等辺三角形を含む二等辺三角形と正三角形を弁別する。',
      action: '辺の長さを写し取り、直角印にも注目しながら、等しい辺の本数に合う棚へ仕分ける。',
      interactions: ['transfer-length', 'sort', 'label'],
      prerequisites: ['g2.shape.triangle_quadrilateral', 'g3.shape.compass_circle_equal_length'],
      curriculumRefs: ['B(1)ア', 'B(1)・直角二等辺三角形への接触', '3社共通・二等辺三角形、正三角形']
    }),
    stage({
      id: 'g3_shape_isosceles_construct', n: 7, name: '二等辺フレーム台',
      canonicalSkillId: 'g3.shape.isosceles_construct',
      objective: '二つの辺が等しい条件から、定規・コンパスで二等辺三角形を構成する。',
      action: '二つの弧の交点を頂点に選び、三本の辺を接続する。',
      interactions: ['compass', 'connect-points', 'construct'],
      prerequisites: ['g3.shape.isosceles_equilateral_classify'],
      curriculumRefs: ['B(1)ア・イ', '3社共通・二等辺三角形の作図']
    }),
    stage({
      id: 'g3_shape_equilateral_construct', n: 8, name: '正三角フレーム台',
      canonicalSkillId: 'g3.shape.equilateral_construct',
      objective: '三つの辺が等しい条件から、定規・コンパスで正三角形を構成する。',
      action: '同じ半径の二つの弧を交差させ、三辺を同じ長さで固定する。',
      interactions: ['compass', 'connect-points', 'construct'],
      prerequisites: ['g3.shape.isosceles_construct'],
      curriculumRefs: ['B(1)ア・イ', '3社共通・正三角形の作図']
    }),
    stage({
      id: 'g3_shape_angle_compare', n: 9, name: '角かさねゲージ',
      canonicalSkillId: 'g3.shape.angle_compare',
      objective: '一つの頂点から出る二辺が作る形を角と知り、重ねて大小・相等を比べる。',
      action: '角パーツを移動・回転し、頂点と一辺をそろえて重ねる。',
      interactions: ['overlay', 'rotate', 'compare'],
      prerequisites: ['g2.shape.right_angle', 'g3.shape.isosceles_equilateral_classify'],
      curriculumRefs: ['B(1)イ', '3社共通・形としての角'],
      boundaryNote: '度や分度器による角度測定は四年生へ送る。'
    }),
    stage({
      id: 'g3_shape_triangle_angles_pattern', n: 10, name: '三角形の角ひみつ盤',
      canonicalSkillId: 'g3.shape.triangle_angle_properties_pattern',
      objective: '二等辺・正三角形の角の相等を見いだし、合同な三角形で模様を作る。',
      action: '三角形を折る・重ねる・敷き詰める操作で、等しい角を点灯する。',
      interactions: ['fold', 'overlay', 'tile'],
      prerequisites: ['g3.shape.equilateral_construct', 'g3.shape.angle_compare'],
      curriculumRefs: ['B(1)イ', '内容の取扱い(6)・三角形の模様']
    }),
    stage({
      id: 'g3_shape_core', n: 11, name: 'かたち設計メインコア3',
      canonicalSkillId: 'g3.shape.review',
      objective: '円・球、コンパス、二等辺・正三角形、角の性質を総合する。',
      action: '設計条件に合う作図、構成、比較、断面検査の装置を選ぶ。',
      interactions: ['compass', 'construct', 'overlay', 'tile', 'slice'],
      prerequisites: ['g3.shape.circle_sphere.review', 'g3.shape.triangle_angle_properties_pattern'],
      curriculumRefs: ['B(1)総合'],
      timeAttackEligible: false
    })
  ]);

  const SOLVE_STAGES = Object.freeze([
    stage({
      id: 'g3_data_question_classify', n: 1, name: '調査テーマ仕分け台',
      canonicalSkillId: 'g3.data.question_classify_tally',
      objective: '調べたいことを決め、日時・場所など目的に合う観点で漏れなく分類・集計する。',
      action: '質問と分類箱を組み合わせ、処理したカードへ集計印を付ける。',
      interactions: ['question-choice', 'sort', 'tally'],
      prerequisites: ['g2.data.classification_view', 'g2.data.tally'],
      curriculumRefs: ['D(1)ア', '3社共通・資料の分類整理']
    }),
    stage({
      id: 'g3_data_table', n: 2, name: '調査ひょう作成盤',
      canonicalSkillId: 'g3.data.table_create_read',
      objective: '分類したデータを表に表し、合計と資料数を照合して読み取る。',
      action: '項目・個数・合計を表へ置き、落ちや重なりを検査する。',
      interactions: ['table-build', 'tally', 'sum-check'],
      prerequisites: ['g3.data.question_classify_tally', 'g2.data.one_way_table'],
      curriculumRefs: ['D(1)ア', '3社共通・表の作成、読み取り']
    }),
    stage({
      id: 'g3_data_bar_read', n: 3, name: '棒グラフ読取モニター',
      canonicalSkillId: 'g3.data.bar_graph_read',
      objective: '棒グラフの特徴を知り、数量の大小・差・最大・最小を読み取る。',
      action: '必要な棒と目盛りを照らし、質問に合う比較線を引く。',
      interactions: ['graph-read', 'highlight', 'compare'],
      prerequisites: ['g3.data.table_create_read', 'g2.data.simple_graph'],
      curriculumRefs: ['D(1)イ', '3社共通・棒グラフの読み方']
    }),
    stage({
      id: 'g3_data_bar_construct', n: 4, name: '棒グラフ建設盤',
      canonicalSkillId: 'g3.data.bar_graph_construct',
      objective: '表題、項目、目盛り、単位、棒を正しく置いて棒グラフを作る。',
      action: 'グラフ枠を組み、表の数に合わせて棒を0から伸ばす。',
      interactions: ['graph-build', 'scale-set', 'label'],
      prerequisites: ['g3.data.bar_graph_read', 'g3.data.table_create_read'],
      curriculumRefs: ['D(1)イ', '3社共通・棒グラフのかき方']
    }),
    stage({
      id: 'g3_data_basic_check', n: 5, name: '表・棒グラフチェッカー',
      canonicalSkillId: 'g3.data.table_bar.review',
      objective: '調査の観点、分類、表、棒グラフの読み書きを混合形式で確認する。',
      action: '元データから棒グラフまでの処理回路をたどり、故障箇所を直す。',
      interactions: ['sort', 'table-build', 'graph-read', 'graph-build'],
      prerequisites: ['g3.data.question_classify_tally', 'g3.data.table_create_read', 'g3.data.bar_graph_read', 'g3.data.bar_graph_construct'],
      curriculumRefs: ['D(1)前半・確認'],
      timeAttackEligible: false
    }),
    stage({
      id: 'g3_data_graph_scales', n: 6, name: '目盛り切替グラフ盤',
      canonicalSkillId: 'g3.data.bar_graph_scales_horizontal',
      objective: '最小目盛りが2・5・20・50などの棒グラフや横向きのグラフを読み書きする。',
      action: 'データ範囲に合う目盛り幅と向きを選び、棒の長さを調整する。',
      interactions: ['scale-set', 'rotate-layout', 'graph-build'],
      prerequisites: ['g3.data.table_bar.review', 'g3.number.order_number_line'],
      curriculumRefs: ['D(1)', '内容の取扱い(8)・多様な最小目盛り']
    }),
    stage({
      id: 'g3_data_combined', n: 7, name: '組み合わせ表・グラフ盤',
      canonicalSkillId: 'g3.data.simple_combined_table_graph',
      objective: '一つの観点で作った表を組み合わせた簡単な表と、複数の棒グラフを読む。',
      action: '複数の一次元表や棒グラフを重ね、対応する行・棒・合計を照合する。',
      interactions: ['table-merge', 'graph-overlay', 'sum-check'],
      prerequisites: ['g3.data.bar_graph_scales_horizontal', 'g3.data.table_create_read'],
      curriculumRefs: ['D(1)', '内容の取扱い(8)・簡単な組合せ表、複数の棒グラフ'],
      boundaryNote: '二つの観点による本格的な二次元表と折れ線グラフは四年生へ送る。'
    }),
    stage({
      id: 'g3_data_analyze_express', n: 8, name: 'データ発見レポート台',
      canonicalSkillId: 'g3.data.analyze_express',
      objective: '表・棒グラフから項目間の関係や全体の特徴を見いだし、根拠とともに表現する。',
      action: '根拠になるセルや棒を選び、正しい発見カードと接続する。',
      interactions: ['highlight', 'compare', 'statement-match'],
      prerequisites: ['g3.data.simple_combined_table_graph'],
      curriculumRefs: ['D(1)イ', '3社共通・表、棒グラフを用いた考察']
    }),
    stage({
      id: 'g3_problem_four_operations', n: 9, name: '四つの計算判断レバー',
      canonicalSkillId: 'g3.problem.four_operations_choice',
      objective: '文章場面の数量関係を捉え、加法・減法・乗法・除法から使う計算を判断する。',
      action: '場面の動きを再生し、必要な情報と演算レバーを選ぶ。',
      interactions: ['story-model', 'information-choice', 'operation-choice'],
      prerequisites: ['g3.calculation.written.review', 'g3.multiplication.properties.review', 'g3.division.meaning.review'],
      curriculumRefs: ['A(2)(3)(4)・活用', '3社共通・加減乗除の演算決定']
    }),
    stage({
      id: 'g3_problem_unknown_box', n: 10, name: '□未知数回路',
      canonicalSkillId: 'g3.problem.unknown_box_equation',
      objective: '未知の一つの数量を□で表し、数を当てはめて調べたり、図と四則の相互関係を使ったりして求める。',
      action: '□を場面図へ置き、候補の数を当てはめて確かめた後、問題の順の式と逆向きの計算回路を接続する。',
      interactions: ['equation-balance', 'diagram-place', 'trial-substitute', 'inverse-route'],
      prerequisites: ['g3.problem.four_operations_choice', 'g2.problem.inverse_tape_diagram'],
      curriculumRefs: ['A(7)', '3社共通・□を使った式'],
      boundaryNote: '□は未知量一つを中心とし、二つの変量や文字式へ広げない。'
    }),
    stage({
      id: 'g3_solve_core', n: 11, name: '調査・解決メインコア3',
      canonicalSkillId: 'g3.problem_data.review',
      objective: 'データ調査、表・棒グラフ、四則の演算決定、□を使う文章題を総合する。',
      action: '必要な情報を選び、調査装置・図・式・答え方を組み合わせて結果を検査する。',
      interactions: ['sort', 'table-build', 'graph-build', 'story-model', 'equation-balance'],
      prerequisites: ['g3.data.table_bar.review', 'g3.data.analyze_express', 'g3.problem.unknown_box_equation'],
      curriculumRefs: ['A(7)・D(1)総合'],
      timeAttackEligible: false
    })
  ]);

  function line(config) {
    return Object.freeze(Object.assign({ gradeId: GRADE_ID, zones: ZONES }, config));
  }

  const LINES = Object.freeze({
    number: line({
      id: 'number', name: '大きな数・たしひき 制御ライン', short: '数とたしひき', symbol: '万±',
      domain: 'A(1)(2)(8) 数の表し方・加法減法・そろばん', stages: NUMBER_CALCULATION_STAGES,
      description: '3・4位数の加減から一億までの位取りへ進み、暗算・見積り・そろばんも同じ十進の仕組みでつなぐ。',
      timeAttackStageIds: ['g3_calc_add_3digit', 'g3_calc_sub_3digit', 'g3_calc_written_4digit', 'g3_calc_mental_estimate', 'g3_calc_add_3digit', 'g3_calc_sub_3digit', 'g3_num_man_unit', 'g3_num_to100million', 'g3_num_order_line', 'g3_num_scale_transform', 'g3_num_soroban', 'g3_num_to100million']
    }),
    multiplication: line({
      id: 'multiplication', name: 'かけ算 増幅ライン3', short: 'かけ算筆算', symbol: '×',
      domain: 'A(3) 乗法', stages: MULTIPLICATION_STAGES,
      description: '九九の性質とアレイから部分積を作り、2・3位数×1・2位数の筆算へ増幅する。',
      timeAttackStageIds: ['g3_mul_zero_ten_unknown', 'g3_mul_change_commutative', 'g3_mul_distributive', 'g3_mul_tens_hundreds', 'g3_mul_two_by_one_model', 'g3_mul_two_by_one_model', 'g3_mul_written_by_one', 'g3_mul_written_by_one', 'g3_mul_by_tens', 'g3_mul_two_by_two', 'g3_mul_two_by_two', 'g3_mul_three_by_two']
    }),
    division: line({
      id: 'division', name: 'わり算 分配ライン', short: 'わり算', symbol: '÷',
      domain: 'A(4) 除法', stages: DIVISION_STAGES,
      description: '同じ数ずつ配る・いくつ分を作る操作から、余り、簡単な商2位数、倍の関係まで進む。',
      timeAttackStageIds: ['g3_div_partitive', 'g3_div_quotative', 'g3_div_scene_expression', 'g3_div_inverse_facts', 'g3_div_special_cases', 'g3_div_special_cases', 'g3_div_remainder_compute', 'g3_div_remainder_compute', 'g3_div_remainder_context', 'g3_div_remainder_context', 'g3_div_simple_two_digit', 'g3_div_multiplicative_comparison']
    }),
    decimalFraction: line({
      id: 'decimalFraction', name: '小数・分数 精密ライン', short: '小数と分数', symbol: '0.1',
      domain: 'A(5)(6) 小数・分数', stages: DECIMAL_FRACTION_STAGES,
      description: '一を10等分した0.1と単位分数を、測定・数直線・加減を通して一つの数の体系へつなぐ。',
      timeAttackStageIds: ['g3_decimal_tenths_measure', 'g3_decimal_place_value', 'g3_decimal_order_line', 'g3_decimal_add_sub_meaning', 'g3_decimal_written_add_sub', 'g3_decimal_written_add_sub', 'g3_fraction_measure_notation', 'g3_fraction_unit_compare', 'g3_fraction_unit_compare', 'g3_fraction_simple_add_sub', 'g3_fraction_simple_add_sub', 'g3_precision_representations']
    }),
    measure: line({
      id: 'measure', name: 'はかる 計測ライン3', short: 'はかる', symbol: '秒kg',
      domain: 'C(1)(2) 測定', stages: MEASURE_STAGES,
      description: '秒と時刻計算、km、g・kg・tを、見積り・単位・計器選択と実測で使い分ける。',
      timeAttackStageIds: ['g3_measure_second', 'g3_measure_second_relation', 'g3_measure_elapsed_time', 'g3_measure_elapsed_time', 'g3_measure_start_end_time', 'g3_measure_start_end_time', 'g3_measure_tape_path', 'g3_measure_kilometer', 'g3_measure_gram_scale', 'g3_measure_kilogram', 'g3_measure_kilogram', 'g3_measure_ton_net']
    }),
    shape: line({
      id: 'shape', name: 'かたち 設計ライン3', short: '円と三角形', symbol: '○△',
      domain: 'B(1) 図形', stages: SHAPE_STAGES,
      description: '円・球の性質とコンパスから、辺や角が等しい二等辺・正三角形の設計へ進む。',
      timeAttackStageIds: ['g3_shape_circle_parts', 'g3_shape_compass_circle', 'g3_shape_circle_pattern', 'g3_shape_sphere', 'g3_shape_triangle_classify', 'g3_shape_triangle_classify', 'g3_shape_isosceles_construct', 'g3_shape_equilateral_construct', 'g3_shape_angle_compare', 'g3_shape_angle_compare', 'g3_shape_triangle_angles_pattern', 'g3_shape_compass_circle']
    }),
    solve: line({
      id: 'solve', name: '調査・問題解決ライン3', short: '調査と解決', symbol: '▥□',
      domain: 'D(1) データの活用・A(7) 数量関係', stages: SOLVE_STAGES,
      description: 'データを表・棒グラフへ変え、根拠を読み取り、四則や□で文章場面を解決する。',
      timeAttackStageIds: ['g3_data_question_classify', 'g3_data_table', 'g3_data_bar_read', 'g3_data_bar_construct', 'g3_data_graph_scales', 'g3_data_graph_scales', 'g3_data_combined', 'g3_data_combined', 'g3_data_analyze_express', 'g3_problem_four_operations', 'g3_problem_four_operations', 'g3_problem_unknown_box']
    })
  });

  const LINE_ORDER = Object.freeze(['number', 'multiplication', 'division', 'decimalFraction', 'measure', 'shape', 'solve']);

  const TEXTBOOK_SOURCES = Object.freeze({
    mext: {
      label: '文部科学省 小学校学習指導要領（平成29年告示）解説 算数編',
      url: 'https://www.mext.go.jp/content/20211102-mxt_kyoiku02-100002607_04.pdf'
    },
    tokyoShoseki: {
      label: '東京書籍 令和6年度用 新編 新しい算数 3年 年間指導計画略案',
      url: 'https://ten.tokyo-shoseki.co.jp/text/shou/sansu/data/sansu_keikaku_ryakuan_3_20240131.pdf'
    },
    dainipponTosho: {
      label: '大日本図書 令和6年版 新版 たのしい算数 3年 年間指導計画',
      url: 'https://www.dainippon-tosho.co.jp/sansu/files/r6sansu3rdSH.pdf'
    },
    nihonBunkyo: {
      label: '日本文教出版 令和6年度版 小学算数 3年 年間指導計画',
      url: 'https://www.nichibun-g.co.jp/textbooks/sansu/download/r6/r6_sansu_nenkei_3.pdf'
    }
  });

  const TEXTBOOK_UNIT_GROUPS = Object.freeze([
    '九九の性質・0と10の乗法', '除法の意味と九九を使う除法', '余りのある除法',
    '3位数・4位数の加減筆算と暗算', '一億までの整数', '2・3位数×1・2位数の乗法筆算',
    '簡単な商2位数の除法', '小数第一位と加減', '分数の意味・0.1との関係・簡単な同分母加減',
    '秒・時刻と時間・km・重さ', '表と棒グラフ', '円・球・二等辺三角形・正三角形・角',
    '□を使った式・倍・そろばん'
  ]);

  const PUBLISHER_PLANS = Object.freeze({
    tokyoShoseki: Object.freeze({
      allocatedHours: 149, reserveHours: 26,
      unitOrder: Object.freeze(['かけ算', '時こくと時間のもとめ方', 'わり算', 'たし算とひき算の筆算', '長いものの長さ', 'ぼうグラフと表', '暗算', 'あまりのあるわり算', '大きい数のしくみ', 'かけ算の筆算(1)', '大きい数のわり算、分数とわり算', '円と球', '小数', '重さ', '分数', '□を使った式', 'かけ算の筆算(2)', '倍の計算', '三角形と角', 'そろばん'])
    }),
    dainipponTosho: Object.freeze({
      allocatedHours: 150, reserveHours: 25,
      unitOrder: Object.freeze(['かけ算', 'たし算とひき算の筆算', 'ぼうグラフと表', '時こくと時間', 'わり算', 'あまりのあるわり算', '円と球', 'かけ算の筆算', '答えが2けたになるわり算', '10000より大きい数', '小数', '長さ', '分数', '三角形と角', '重さの単位', '□を使った式', '2けたの数をかける計算', '倍とかけ算、わり算', 'そろばん'])
    }),
    nihonBunkyo: Object.freeze({
      allocatedHours: 157, reserveHours: 18,
      unitOrder: Object.freeze(['かけ算', 'わり算', '時間の計算と短い時間', 'たし算とひき算', 'ぼうグラフ', 'あまりのあるわり算', '大きい数', '長さ', '円と球', 'かけ算の筆算(1)', '小数', '重さ', '分数', '□を使った式', '倍の見方', '三角形と角', 'かけ算の筆算(2)', 'そろばん'])
    })
  });

  const GRADE_BOUNDARIES = Object.freeze({
    integers: '一億まで。億・兆を単位とする一般的な体系は四年生。',
    additionSubtraction: '3位数・4位数の加減、簡単な2位数暗算、感覚的な見積り。四捨五入は四年生。',
    multiplication: '2位数・3位数×1位数・2位数まで。3位数×3位数と小数乗法は扱わない。',
    division: '除数・商が1位数、余り、80÷4や69÷3等の簡単な商2位数まで。一般筆算は四年生。',
    decimals: '小数第一位の意味・大小・加減まで。小数第二位以降と乗除は四年生。',
    fractions: '単位分数、同分母の大小、真分数どうしで和が1までの加法と逆の減法。仮分数・帯分数は四年生。',
    angles: '形としての角を重ねて比べる。度と分度器は四年生。',
    measurement: '秒、km、g・kg・tと、既習単位を通した接頭語k・mへの接触。複雑な時間換算や未知の単位換算へ広げない。',
    data: '棒グラフと一次元表を組み合わせた簡単な表まで。本格的な二次元表と折れ線グラフは四年生。',
    expressions: '□は未知量一つを表す。二つの変量や文字式へ広げない。'
  });

  const OFFICIAL_COVERAGE = Object.freeze({
    A: Object.freeze(['A(1) 数の表し方', 'A(2) 加法・減法', 'A(3) 乗法', 'A(4) 除法', 'A(5) 小数', 'A(6) 分数', 'A(7) □を用いた式', 'A(8) そろばん']),
    B: Object.freeze(['B(1) 二等辺三角形、正三角形、角、円、球']),
    C: Object.freeze(['C(1) 長さ・重さ', 'C(2) 時刻・時間']),
    D: Object.freeze(['D(1) 表と棒グラフ'])
  });

  const RECOMMENDED_PATH = Object.freeze([
    { term: '1学期前半', focus: '九九の性質、除法、秒と時間、加減筆算', steps: ['multiplication:1-5', 'division:1-5', 'measure:1-5', 'number:1-5'] },
    { term: '1学期後半', focus: '表と棒グラフ、余り、長い長さ', steps: ['solve:1-5', 'division:6-8', 'measure:6-7'] },
    { term: '2学期前半', focus: '一億まで、円と球、1位数をかける筆算', steps: ['number:6-9', 'shape:1-5', 'multiplication:6-7'] },
    { term: '2学期後半', focus: '小数、重さ、分数、データの読み取り', steps: ['decimalFraction:1-10', 'measure:8-10', 'solve:6-8'] },
    { term: '3学期', focus: '2位数をかける筆算、倍、三角形と角、□、そろばん、総復習', steps: ['multiplication:8-11', 'division:9-11', 'shape:6-11', 'solve:9-11', 'number:10-11', 'decimalFraction:11', 'measure:11'] }
  ]);

  const IMPLEMENTATION_GATE = Object.freeze({
    runtimeStatus: 'metadata-ready',
    requiredBeforeActivation: [
      'CURRICULA.g1/g2/g3の学年レジストリ',
      'state v4以降の学年別保存と動的学年初期化',
      'gradeIdを含む問題生成・履歴・最近問・タイムアタック',
      '既存G1・66ステージの完全回帰テスト',
      'G2・66ステージとG3・77ステージの問題ビルダー、全完走、学年間分離テスト'
    ],
    note: 'このファイルは公開中のG1アプリへまだ読み込ませない。G2・G3を安全に分離できる共通基盤が完成してから有効化する。'
  });

  function validateCurriculum() {
    const errors = [];
    const stagesByLine = {};
    const stages = LINE_ORDER.reduce(function (all, lineId) {
      const currentLine = LINES[lineId];
      if (!currentLine) {
        errors.push('missing line: ' + lineId);
        return all;
      }
      if (currentLine.stages.length !== 11) errors.push(lineId + ': expected 11 stages');
      if (currentLine.timeAttackStageIds.length !== TIME_ATTACK_ROUNDS) errors.push(lineId + ': expected 12 time attack slots');
      currentLine.stages.forEach(function (item, index) {
        if (item.n !== index + 1) errors.push(lineId + ': invalid stage order at ' + item.id);
      });
      stagesByLine[lineId] = currentLine.stages.map(function (item) { return item.id; });
      return all.concat(currentLine.stages);
    }, []);
    const stageIds = stages.map(function (item) { return item.id; });
    const skillIds = stages.map(function (item) { return item.canonicalSkillId; });
    if (LINE_ORDER.length !== 7) errors.push('expected 7 lines');
    if (stages.length !== 77) errors.push('expected 77 stages');
    if (new Set(stageIds).size !== stageIds.length) errors.push('duplicate stage ids');
    if (new Set(skillIds).size !== skillIds.length) errors.push('duplicate canonical skill ids');
    stages.forEach(function (item) {
      if (!item.id.startsWith('g3_')) errors.push(item.id + ': stage id must start with g3_');
      if (!item.canonicalSkillId.startsWith('g3.')) errors.push(item.id + ': skill id must start with g3.');
      if (item.gradeId !== GRADE_ID) errors.push(item.id + ': invalid grade id');
      if (!item.objective || !item.action || item.interactions.length < 3) errors.push(item.id + ': incomplete action metadata');
      if (!item.curriculumRefs.length) errors.push(item.id + ': missing curriculum refs');
      if ((item.n === 5 || item.n === 11) !== item.checkpoint) errors.push(item.id + ': invalid checkpoint flag');
      item.prerequisites.forEach(function (skillId) {
        if (skillId.startsWith('g3.') && !skillIds.includes(skillId)) errors.push(item.id + ': unknown g3 prerequisite ' + skillId);
      });
    });
    LINE_ORDER.forEach(function (lineId) {
      const lineStageIds = stagesByLine[lineId] || [];
      LINES[lineId].timeAttackStageIds.forEach(function (stageId) {
        if (!lineStageIds.includes(stageId)) errors.push(lineId + ': foreign or unknown time attack stage ' + stageId);
        const selected = stages.find(function (item) { return item.id === stageId; });
        if (selected && !selected.timeAttackEligible) errors.push(lineId + ': checkpoint in time attack ' + stageId);
      });
    });
    Object.keys(PUBLISHER_PLANS).forEach(function (publisherId) {
      const plan = PUBLISHER_PLANS[publisherId];
      if (plan.allocatedHours + plan.reserveHours !== 175) errors.push(publisherId + ': hours must total 175');
    });
    return Object.freeze({ ok: errors.length === 0, errors: Object.freeze(errors), lineCount: LINE_ORDER.length, stageCount: stages.length });
  }

  const CURRICULUM = Object.freeze({
    id: GRADE_ID,
    label: '小学3年生 算数',
    version: 1,
    status: 'curriculum-and-stage-metadata-ready',
    standardHours: 175,
    lineOrder: LINE_ORDER,
    lines: LINES,
    zones: ZONES,
    questionPolicy: QUESTION_POLICY,
    stageRounds: STAGE_ROUNDS,
    timeAttackRounds: TIME_ATTACK_ROUNDS,
    textbookSources: TEXTBOOK_SOURCES,
    textbookUnitGroups: TEXTBOOK_UNIT_GROUPS,
    publisherPlans: PUBLISHER_PLANS,
    gradeBoundaries: GRADE_BOUNDARIES,
    officialCoverage: OFFICIAL_COVERAGE,
    recommendedPath: RECOMMENDED_PATH,
    implementationGate: IMPLEMENTATION_GATE,
    validate: validateCurriculum
  });

  global.HiramekiGrade3Curriculum = CURRICULUM;
}(typeof globalThis !== 'undefined' ? globalThis : window));
