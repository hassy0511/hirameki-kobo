(function (global) {
  'use strict';

  const GRADE_ID = 'g2';
  const STAGE_ROUNDS = 8;
  const TIME_ATTACK_ROUNDS = 12;

  const ZONES = [
    { id: 'A', name: 'きそ作業台', range: [1, 4], note: '具体物を動かして、新しい仕組みをつかむ' },
    { id: 'B', name: '組み替えフロア', range: [5, 8], note: '表し方や条件を変えて、考え方をつなぐ' },
    { id: 'C', name: '応用検査室', range: [9, 11], note: '生活場面と混合問題で、使える理解を確かめる' }
  ];

  const QUESTION_POLICY = {
    rounds: STAGE_ROUNDS,
    operationMin: 5,
    storyMin: 1,
    storyMax: 2,
    bareCalculationMax: 1,
    checkpointStages: [5, 11],
    recentSignatureWindow: 32,
    randomize: ['number', 'object', 'layout', 'direction', 'story', 'answer-position'],
    note: '式だけを連続させず、操作、図・式の対応、短い生活場面、確認を混ぜる。'
  };

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

  const NUMBER_STAGES = [
    stage({
      id: 'g2_num_group_count', n: 1, name: 'まとまりカウンター',
      canonicalSkillId: 'g2.number.group_count',
      objective: '2ずつ、5ずつ、10ずつまとめたり、観点を決めて分類したりして数える。',
      action: '散らばった部品を囲み、同じ数ずつケースへまとめる。',
      interactions: ['group', 'sort', 'tap'],
      prerequisites: ['g1.number.to100', 'g1.problem.equal_groups'],
      curriculumRefs: ['A(1)ア', '3社共通・まとめて数える']
    }),
    stage({
      id: 'g2_num_to1000', n: 2, name: '1000パーツ倉庫',
      canonicalSkillId: 'g2.number.to1000',
      objective: '1000までの数を読み、書き、具体物と対応させる。',
      action: '百ケース、十の束、一の部品を棚へ積み、表示数を作る。',
      interactions: ['place-value', 'tap', 'keypad'],
      prerequisites: ['g1.number.to100'],
      curriculumRefs: ['A(1)イ', '3社共通・1000までの数']
    }),
    stage({
      id: 'g2_num_place_value', n: 3, name: '位取りリフト',
      canonicalSkillId: 'g2.number.place_value_3digit',
      objective: '百・十・一の位と、0を含む3位数の構成・分解を理解する。',
      action: '位ごとのリフトへ数字板や束を置き、別の表し方へ組み替える。',
      interactions: ['place-value', 'compose', 'match'],
      prerequisites: ['g2.number.to1000'],
      curriculumRefs: ['A(1)イ', '3社共通・3位数の位取り']
    }),
    stage({
      id: 'g2_num_relative_units', n: 4, name: '10・100束変換機',
      canonicalSkillId: 'g2.number.relative_units',
      objective: '数を10や100のいくつ分として捉え、数の構成に基づく簡単な加減をする。',
      action: '一、十、百の束を交換し、同じ数になる表し方を接続する。',
      interactions: ['exchange', 'compose', 'route'],
      prerequisites: ['g2.number.place_value_3digit'],
      curriculumRefs: ['A(1)ウ', 'A(2)', '3社共通・10や100を単位とする見方']
    }),
    stage({
      id: 'g2_num_1000_check', n: 5, name: '1000までチェッカー',
      canonicalSkillId: 'g2.number.to1000.review',
      objective: 'まとめて数える、3位数、位取り、相対的な大きさを混合形式で確認する。',
      action: '四つの検査装置を切り替え、表示と部品のずれを直す。',
      interactions: ['group', 'place-value', 'match', 'repair'],
      prerequisites: ['g2.number.group_count', 'g2.number.to1000', 'g2.number.place_value_3digit', 'g2.number.relative_units'],
      curriculumRefs: ['A(1)前半・確認'],
      timeAttackEligible: false
    }),
    stage({
      id: 'g2_num_compare', n: 6, name: '大小ゲート',
      canonicalSkillId: 'g2.number.compare_order',
      objective: '3位数・4位数の大小を位に着目して比べ、＞、＜で表す。',
      action: '大きい位からスキャンし、正しい向きへ比較ゲートを回す。',
      interactions: ['compare', 'slider', 'select'],
      prerequisites: ['g2.number.place_value_3digit'],
      curriculumRefs: ['A(1)イ', '用語・記号 ＞ ＜']
    }),
    stage({
      id: 'g2_num_number_line', n: 7, name: '大きな数レール',
      canonicalSkillId: 'g2.number.number_line_sequence',
      objective: '数直線上の位置、順序、2・5・10・100ずつの系列を捉える。',
      action: '目盛り幅を選び、数字車両を正しい位置や順番へ走らせる。',
      interactions: ['number-line', 'order', 'route'],
      prerequisites: ['g2.number.compare_order'],
      curriculumRefs: ['A(1)イ', '3社共通・数の系列と数直線']
    }),
    stage({
      id: 'g2_num_to10000', n: 8, name: '10000表示タワー',
      canonicalSkillId: 'g2.number.to10000',
      objective: '9999までの4位数と、10000の読み方・書き方・位取りを理解する。',
      action: '千・百・十・一の表示塔を動かし、0を含む4位数を組み立てる。',
      interactions: ['place-value', 'compose', 'keypad'],
      prerequisites: ['g2.number.to1000', 'g2.number.place_value_3digit'],
      curriculumRefs: ['A(1)イ', '内容の取扱い(1)・1万', '3社共通・10000までの数']
    }),
    stage({
      id: 'g2_num_10000_relations', n: 9, name: '四けた変換盤',
      canonicalSkillId: 'g2.number.place_value_4digit',
      objective: '4位数を構成・分解し、大小、系列、10や100を単位とする見方を使う。',
      action: '数カード、位取り表、数直線、束の表現を正しい回路でつなぐ。',
      interactions: ['match', 'place-value', 'number-line'],
      prerequisites: ['g2.number.to10000', 'g2.number.relative_units'],
      curriculumRefs: ['A(1)イ・ウ', '3社共通・4位数の多面的な見方']
    }),
    stage({
      id: 'g2_num_unit_fractions', n: 10, name: '同じ大きさ分けカッター',
      canonicalSkillId: 'g2.number.unit_fractions',
      objective: '具体物を同じ大きさに分け、1/2、1/3、1/4などの単位分数を知る。',
      action: 'テープや部品のまとまりを等分し、指定された一つ分を取り出す。',
      interactions: ['partition', 'select-parts', 'match'],
      prerequisites: ['g1.problem.equal_groups'],
      curriculumRefs: ['A(1)カ', '3社共通・分数'],
      boundaryNote: '分数の大小比較や加減計算は扱わない。'
    }),
    stage({
      id: 'g2_num_core', n: 11, name: '大きな数メインコア',
      canonicalSkillId: 'g2.number.review',
      objective: '10000までの数、数直線、位取り、相対的な大きさ、単位分数を総合する。',
      action: '必要な数の見方を自分で選び、五つの表示装置を同期させる。',
      interactions: ['place-value', 'number-line', 'compare', 'partition', 'repair'],
      prerequisites: ['g2.number.to1000.review', 'g2.number.place_value_4digit', 'g2.number.unit_fractions'],
      curriculumRefs: ['A(1)総合'],
      timeAttackEligible: false
    })
  ];

  const WRITTEN_STAGES = [
    stage({
      id: 'g2_calc_add_no_carry', n: 1, name: '位そろえ合流台',
      canonicalSkillId: 'g2.calculation.add_2digit_no_regroup',
      objective: '2位数の足し算を位ごとに考え、繰り上がりなしで計算する。',
      action: '十の束と一の部品を同じ位のレーンへ合流させる。',
      interactions: ['place-value', 'combine', 'repair-column'],
      prerequisites: ['g1.add.review', 'g1.number.to100'],
      curriculumRefs: ['A(2)', '3社共通・2桁の足し算']
    }),
    stage({
      id: 'g2_calc_add_regroup', n: 2, name: '10こ交換リフト',
      canonicalSkillId: 'g2.calculation.add_2digit_regroup',
      objective: '一の位が10以上になる2位数の足し算と、筆算の繰り上がりを理解する。',
      action: '一の部品10個を十の束1本へ交換し、繰り上がり札を置く。',
      interactions: ['exchange', 'place-value', 'repair-column'],
      prerequisites: ['g2.calculation.add_2digit_no_regroup'],
      curriculumRefs: ['A(2)', '3社共通・加法の筆算と繰り上がり']
    }),
    stage({
      id: 'g2_calc_sub_no_borrow', n: 3, name: '位そろえ整理台',
      canonicalSkillId: 'g2.calculation.sub_2digit_no_regroup',
      objective: '2位数の引き算を位ごとに考え、繰り下がりなしで計算する。',
      action: '十の束と一の部品を同じ位から取り出し、残りを確認する。',
      interactions: ['place-value', 'remove', 'repair-column'],
      prerequisites: ['g1.sub.review', 'g1.number.to100'],
      curriculumRefs: ['A(2)', '3社共通・2桁の引き算']
    }),
    stage({
      id: 'g2_calc_sub_regroup', n: 4, name: '10こ両替レバー',
      canonicalSkillId: 'g2.calculation.sub_2digit_regroup',
      objective: '一の位から引けない2位数の引き算と、筆算の繰り下がりを理解する。',
      action: '十の束1本を一の部品10個へ両替し、取り出し工程を完成する。',
      interactions: ['exchange', 'remove', 'repair-column'],
      prerequisites: ['g2.calculation.sub_2digit_no_regroup'],
      curriculumRefs: ['A(2)', '3社共通・減法の筆算と繰り下がり']
    }),
    stage({
      id: 'g2_calc_basic_check', n: 5, name: 'たしひき筆算チェッカー',
      canonicalSkillId: 'g2.calculation.written_2digit.review',
      objective: '2位数の足し算・引き算と、繰り上がり・繰り下がりを混合形式で確認する。',
      action: '位取りブロック、筆算、場面カードの故障箇所を見つけて直す。',
      interactions: ['exchange', 'repair-column', 'match', 'story-choice'],
      prerequisites: ['g2.calculation.add_2digit_regroup', 'g2.calculation.sub_2digit_regroup'],
      curriculumRefs: ['A(2)前半・確認'],
      timeAttackEligible: false
    }),
    stage({
      id: 'g2_calc_sum_to_3digit', n: 6, name: '百の位点灯ゲート',
      canonicalSkillId: 'g2.calculation.add_sum_3digit',
      objective: '2位数どうしを足して和が3位数になる計算をする。',
      action: '二回の交換をつなぎ、百の位のランプを点灯する。',
      interactions: ['exchange', 'place-value', 'repair-column'],
      prerequisites: ['g2.calculation.add_2digit_regroup'],
      curriculumRefs: ['A(2)', '3社共通・和が3位数になる加法']
    }),
    stage({
      id: 'g2_calc_sub_from_3digit', n: 7, name: '百の位両替ゲート',
      canonicalSkillId: 'g2.calculation.sub_from_3digit',
      objective: '3位数から1・2位数を引き、差が2位数になる計算をする。',
      action: '百・十の束を必要な位へ両替し、取り出し順を組み立てる。',
      interactions: ['exchange', 'remove', 'repair-column'],
      prerequisites: ['g2.calculation.sub_2digit_regroup', 'g2.number.to1000'],
      curriculumRefs: ['A(2)', '3社共通・3位数からの減法']
    }),
    stage({
      id: 'g2_calc_simple_3digit', n: 8, name: '3けた対応パネル',
      canonicalSkillId: 'g2.calculation.simple_3digit',
      objective: '簡単な3位数と1・2位数の足し算・引き算を、位取りを基に行う。',
      action: '計算できる位のレーンを見極め、対応する部品だけを動かす。',
      interactions: ['place-value', 'select-route', 'repair-column'],
      prerequisites: ['g2.calculation.add_sum_3digit', 'g2.calculation.sub_from_3digit'],
      curriculumRefs: ['A(2)', '3社共通・簡単な3位数の加減'],
      boundaryNote: '一般的な3位数どうしの筆算は扱わない。'
    }),
    stage({
      id: 'g2_calc_properties', n: 9, name: '計算くふう配線盤',
      canonicalSkillId: 'g2.calculation.properties_strategies',
      objective: '交換法則・結合法則、括弧、10を作る見方を使って計算を工夫する。',
      action: '数字カードの順序やまとまりを配線し直し、短い計算ルートを作る。',
      interactions: ['order', 'group', 'route'],
      prerequisites: ['g2.calculation.written_2digit.review'],
      curriculumRefs: ['A(2)', '内容の取扱い(2)(3)', '3社共通・計算の工夫']
    }),
    stage({
      id: 'g2_calc_inverse_check', n: 10, name: '逆算検査モニター',
      canonicalSkillId: 'g2.calculation.inverse_estimate_check',
      objective: '足し算と引き算の相互関係、検算、結果の見積りを使って答えを確かめる。',
      action: '逆向きの計算回路を接続し、あり得ない答えや欠けた数を検出する。',
      interactions: ['inverse-route', 'estimate', 'missing-number', 'repair'],
      prerequisites: ['g2.calculation.simple_3digit', 'g2.calculation.properties_strategies'],
      curriculumRefs: ['A(2)', '内容の取扱い(2)', '3社共通・加減の関係と確かめ']
    }),
    stage({
      id: 'g2_calc_core', n: 11, name: 'たしひき筆算メインコア',
      canonicalSkillId: 'g2.calculation.review',
      objective: '2位数の筆算、簡単な3位数の加減、計算の工夫、確かめを総合する。',
      action: '場面に応じてブロック、筆算、逆算、見積りの装置を選ぶ。',
      interactions: ['exchange', 'repair-column', 'story-choice', 'inverse-route', 'estimate'],
      prerequisites: ['g2.calculation.written_2digit.review', 'g2.calculation.inverse_estimate_check'],
      curriculumRefs: ['A(2)総合'],
      timeAttackEligible: false
    })
  ];

  const MULTIPLICATION_STAGES = [
    stage({
      id: 'g2_mul_equal_groups', n: 1, name: '同じ数ずつコンベア',
      canonicalSkillId: 'g2.multiplication.equal_groups',
      objective: '同じ数ずつの集まりを見つけ、「一つ分」と「いくつ分」を捉える。',
      action: '同じ個数の部品箱だけを選び、等間隔でコンベアへ並べる。',
      interactions: ['group', 'sort', 'tap'],
      prerequisites: ['g1.problem.equal_groups', 'g2.number.group_count'],
      curriculumRefs: ['A(3)ア', '3社共通・かけ算の意味']
    }),
    stage({
      id: 'g2_mul_scene_expression', n: 2, name: 'かけ算式メーカー',
      canonicalSkillId: 'g2.multiplication.scene_expression',
      objective: '「一つ分の数×いくつ分」の順で、場面をかけ算の式に表し、式を読む。',
      action: '場面カード、まとまり図、式カードを正しい順で接続する。',
      interactions: ['match', 'order', 'story-model'],
      prerequisites: ['g2.multiplication.equal_groups'],
      curriculumRefs: ['A(3)ア・イ', '3社共通・場面、図、式の対応']
    }),
    stage({
      id: 'g2_mul_array_repeated_add', n: 3, name: 'アレイ増幅パネル',
      canonicalSkillId: 'g2.multiplication.array_repeated_add',
      objective: '配列図とかけ算、同じ数の足し算を対応させ、積の求め方を考える。',
      action: '行と列を点灯し、同じ配列を表す足し算とかけ算へ配線する。',
      interactions: ['grid', 'tap', 'match'],
      prerequisites: ['g2.multiplication.scene_expression'],
      curriculumRefs: ['A(3)', '3社共通・累加とアレイ図']
    }),
    stage({
      id: 'g2_mul_tables_2_5', n: 4, name: '2・5の段ジェネレーター',
      canonicalSkillId: 'g2.multiplication.tables_2_5',
      objective: '2の段と5の段を、乗数が1増えると積が増えるきまりから構成し、使う。',
      action: '前の積へ2または5を加え、九九カード列を完成する。',
      interactions: ['sequence', 'card-build', 'story-apply'],
      prerequisites: ['g2.multiplication.array_repeated_add'],
      curriculumRefs: ['A(3)ウ・エ', '3社共通・2、5の段']
    }),
    stage({
      id: 'g2_mul_meaning_check', n: 5, name: 'かけ算きそチェッカー',
      canonicalSkillId: 'g2.multiplication.meaning.review',
      objective: '同じ数ずつ、場面と式、配列、2・5の段を混合形式で確認する。',
      action: '場面、図、式、九九カードの食い違いを見つけて修理する。',
      interactions: ['group', 'match', 'grid', 'repair'],
      prerequisites: ['g2.multiplication.equal_groups', 'g2.multiplication.scene_expression', 'g2.multiplication.tables_2_5'],
      curriculumRefs: ['A(3)前半・確認'],
      timeAttackEligible: false
    }),
    stage({
      id: 'g2_mul_tables_3_4', n: 6, name: '3・4の段ジェネレーター',
      canonicalSkillId: 'g2.multiplication.tables_3_4',
      objective: '3の段と4の段を構成し、場面や図へ適用する。',
      action: 'アレイを一列ずつ増幅し、抜けた積カードを差し込む。',
      interactions: ['grid', 'sequence', 'story-apply'],
      prerequisites: ['g2.multiplication.tables_2_5'],
      curriculumRefs: ['A(3)ウ・エ', '3社共通・3、4の段']
    }),
    stage({
      id: 'g2_mul_tables_6_7', n: 7, name: '6・7の段ジェネレーター',
      canonicalSkillId: 'g2.multiplication.tables_6_7',
      objective: '既習の九九や分ける考えを使い、6の段と7の段を構成して使う。',
      action: 'アレイを既知のまとまりへ分割し、二つの積を合流させる。',
      interactions: ['partition-array', 'combine', 'story-apply'],
      prerequisites: ['g2.multiplication.tables_3_4'],
      curriculumRefs: ['A(3)ウ・エ', '3社共通・6、7の段']
    }),
    stage({
      id: 'g2_mul_tables_8_9_1', n: 8, name: '8・9・1の段ジェネレーター',
      canonicalSkillId: 'g2.multiplication.tables_8_9_1',
      objective: '8・9・1の段を構成し、1〜9の九九を場面に応じて使う。',
      action: '不足する列を補い、1の段を含む九九回路を完成する。',
      interactions: ['partition-array', 'sequence', 'story-apply'],
      prerequisites: ['g2.multiplication.tables_6_7'],
      curriculumRefs: ['A(3)ウ・エ', '3社共通・8、9、1の段']
    }),
    stage({
      id: 'g2_mul_properties_table', n: 9, name: '九九表ひみつスキャナー',
      canonicalSkillId: 'g2.multiplication.properties',
      objective: '九九表から、乗数と積の変化、交換法則、分けて足す考えを見つけて使う。',
      action: '九九表の行・列・対称位置を照らし、同じ答えや変化を接続する。',
      interactions: ['table-scan', 'match', 'route'],
      prerequisites: ['g2.multiplication.tables_8_9_1'],
      curriculumRefs: ['A(3)ウ', '3社共通・かけ算の性質と九九表']
    }),
    stage({
      id: 'g2_mul_times_and_beyond', n: 10, name: '倍・10こえ増幅機',
      canonicalSkillId: 'g2.multiplication.times_simple_2digit',
      objective: '何倍の意味を使い、九九のきまりを基に10〜12程度を含む簡単な乗法を考える。',
      action: '基準テープを指定回数コピーし、九九の先へ増幅レールを延ばす。',
      interactions: ['copy-length', 'extend-sequence', 'story-apply'],
      prerequisites: ['g2.multiplication.properties'],
      curriculumRefs: ['A(3)', '内容の取扱い(4)', '3社共通・倍と簡単な2位数×1位数'],
      boundaryNote: '一般的な2位数×1位数の筆算は扱わず、10〜12程度を九九の性質で求める。'
    }),
    stage({
      id: 'g2_mul_core', n: 11, name: 'かけ算メインコア',
      canonicalSkillId: 'g2.multiplication.review',
      objective: 'かけ算の意味、九九、性質、倍、簡単な九九を超える計算を総合する。',
      action: '場面に応じて、まとまり、アレイ、九九表、倍テープの装置を選ぶ。',
      interactions: ['story-model', 'grid', 'table-scan', 'copy-length', 'repair'],
      prerequisites: ['g2.multiplication.meaning.review', 'g2.multiplication.times_simple_2digit'],
      curriculumRefs: ['A(3)総合'],
      timeAttackEligible: false
    })
  ];

  const MEASURE_STAGES = [
    stage({
      id: 'g2_measure_common_unit', n: 1, name: '共通ものさしセレクター',
      canonicalSkillId: 'g2.measure.common_unit_estimate',
      objective: '共通の単位で測る必要性を知り、およその長さと適切な道具を考える。',
      action: 'ばらばらな物差しを同じ単位へ交換し、測る前の予想をセットする。',
      interactions: ['tool-select', 'estimate', 'compare'],
      prerequisites: ['g1.measure.length.review'],
      curriculumRefs: ['C(1)', '3社共通・普遍単位と見積り']
    }),
    stage({
      id: 'g2_measure_cm_ruler', n: 2, name: 'cmものさし台',
      canonicalSkillId: 'g2.measure.centimeter_ruler',
      objective: 'cmの目盛りを読み、端を0にそろえて長さを測る。',
      action: '物差しを部品の端へ移動し、目盛りの位置をタップする。',
      interactions: ['align-ruler', 'slider', 'tap-scale'],
      prerequisites: ['g2.measure.common_unit_estimate'],
      curriculumRefs: ['C(1)ア', '3社共通・cmとものさし']
    }),
    stage({
      id: 'g2_measure_mm', n: 3, name: 'mm精密ゲージ',
      canonicalSkillId: 'g2.measure.millimeter_relation',
      objective: 'mmを使って端数を測り、1cm＝10mmの関係を理解する。',
      action: 'cm目盛りを10分割した精密ゲージで、長さをcmとmmに分けて表示する。',
      interactions: ['zoom-scale', 'compose-unit', 'match'],
      prerequisites: ['g2.measure.centimeter_ruler'],
      curriculumRefs: ['C(1)ア', '3社共通・mmと1cm=10mm']
    }),
    stage({
      id: 'g2_measure_line_length', n: 4, name: '直線カッター',
      canonicalSkillId: 'g2.measure.line_draw_calculate',
      objective: '指定した長さの直線を作り、同じ単位の長さの加減をする。',
      action: '始点と終点を指定して直線を切り出し、二本の長さをつなぐ・切り取る。',
      interactions: ['draw-line', 'combine-length', 'remove-length'],
      prerequisites: ['g2.measure.millimeter_relation'],
      curriculumRefs: ['C(1)', '用語・記号 直線', '3社共通・作図と長さの加減']
    }),
    stage({
      id: 'g2_measure_length_check', n: 5, name: '長さ単位チェッカー',
      canonicalSkillId: 'g2.measure.length.review',
      objective: '見積り、cm・mm、物差し、直線、長さの加減を混合形式で確認する。',
      action: '予想、道具、目盛り、単位のうち故障している表示を直す。',
      interactions: ['estimate', 'align-ruler', 'draw-line', 'repair'],
      prerequisites: ['g2.measure.common_unit_estimate', 'g2.measure.line_draw_calculate'],
      curriculumRefs: ['C(1)長さ・確認'],
      timeAttackEligible: false
    }),
    stage({
      id: 'g2_measure_capacity_ldl', n: 6, name: 'L・dL注水タンク',
      canonicalSkillId: 'g2.measure.capacity_l_dl',
      objective: 'L・dLでかさを測り、1L＝10dLの関係を理解する。',
      action: '1Lますと1dLカップを選び、指定の目盛りまでタンクへ注ぐ。',
      interactions: ['pour', 'select-unit', 'compose-unit'],
      prerequisites: ['g1.measure.capacity'],
      curriculumRefs: ['C(1)ア', '3社共通・L、dL']
    }),
    stage({
      id: 'g2_measure_capacity_ml', n: 7, name: 'mL精密タンク',
      canonicalSkillId: 'g2.measure.capacity_ml_relations',
      objective: 'mLを知り、1L＝1000mLなどの単位関係とかさの加減を使う。',
      action: '容器の表示を読み、L・dL・mLの部品を交換して必要量を作る。',
      interactions: ['read-container', 'exchange-unit', 'pour'],
      prerequisites: ['g2.measure.capacity_l_dl'],
      curriculumRefs: ['C(1)ア', '3社共通・mLとかさの加減'],
      boundaryNote: '1L=1000mLは知らせる程度とし、複雑な単位換算を主目的にしない。'
    }),
    stage({
      id: 'g2_measure_time_duration', n: 8, name: '時こく・時間切替時計',
      canonicalSkillId: 'g2.measure.time_duration',
      objective: '時刻と時間を区別し、1時間＝60分を使って簡単な経過時間を考える。',
      action: '開始時計から長針を進め、到着時刻と動いた時間を別々に表示する。',
      interactions: ['clock', 'advance-time', 'classify'],
      prerequisites: ['g1.time.minute'],
      curriculumRefs: ['C(2)', '3社共通・時刻と時間、1時間=60分']
    }),
    stage({
      id: 'g2_measure_day_schedule', n: 9, name: '1日スケジュール盤',
      canonicalSkillId: 'g2.measure.day_am_pm',
      objective: '午前・午後、正午、1日＝24時間を理解し、生活の予定へ時刻と時間を使う。',
      action: '一日の予定カードを時刻順へ置き、空いている時間帯を動かして確かめる。',
      interactions: ['timeline', 'order', 'advance-time'],
      prerequisites: ['g2.measure.time_duration'],
      curriculumRefs: ['C(2)', '3社共通・午前午後、1日=24時間']
    }),
    stage({
      id: 'g2_measure_meter', n: 10, name: 'mロングレール',
      canonicalSkillId: 'g2.measure.meter_relation',
      objective: 'mを使って長いものを測り、1m＝100cmと適切な単位選択を理解する。',
      action: '1mレールをつなぎ、余りをcmで測って見積りと実測を比べる。',
      interactions: ['tile-meter', 'estimate', 'compose-unit'],
      prerequisites: ['g2.measure.length.review'],
      curriculumRefs: ['C(1)ア・イ', '3社共通・mと1m=100cm']
    }),
    stage({
      id: 'g2_measure_core', n: 11, name: '計測メインコア2',
      canonicalSkillId: 'g2.measure.review',
      objective: '長さ、かさ、時刻と時間について、適切な単位・道具・測り方を使い分ける。',
      action: '対象物や生活場面を見て、物差し、タンク、時計、長いレールを起動する。',
      interactions: ['tool-select', 'measure', 'clock', 'estimate', 'repair'],
      prerequisites: ['g2.measure.length.review', 'g2.measure.capacity_ml_relations', 'g2.measure.day_am_pm', 'g2.measure.meter_relation'],
      curriculumRefs: ['C(1)(2)総合'],
      timeAttackEligible: false
    })
  ];

  const SHAPE_STAGES = [
    stage({
      id: 'g2_shape_lines_enclosure', n: 1, name: '直線・囲みスキャナー',
      canonicalSkillId: 'g2.shape.lines_enclosure',
      objective: '直線で囲まれた形に着目し、開いた形や曲線を含む形と区別する。',
      action: '線分の端を接続し、囲みが完成した形だけを点灯する。',
      interactions: ['connect-dots', 'sort', 'repair-shape'],
      prerequisites: ['g1.shape.review'],
      curriculumRefs: ['B(1)', '用語・記号 直線']
    }),
    stage({
      id: 'g2_shape_tri_quad', n: 2, name: '三角・四角仕分け棚',
      canonicalSkillId: 'g2.shape.triangle_quadrilateral',
      objective: '3本・4本の直線で囲まれた形を三角形・四角形として弁別する。',
      action: '辺を一本ずつスキャンし、条件に合う棚へ形を入れる。',
      interactions: ['count-edges', 'sort', 'select'],
      prerequisites: ['g2.shape.lines_enclosure'],
      curriculumRefs: ['B(1)ア', '3社共通・三角形と四角形']
    }),
    stage({
      id: 'g2_shape_edges_vertices', n: 3, name: '辺・頂点コネクター',
      canonicalSkillId: 'g2.shape.edges_vertices',
      objective: '三角形・四角形の辺と頂点を見つけ、数や位置を説明する。',
      action: '辺をなぞり、頂点へコネクターを置いて形の構成を完成する。',
      interactions: ['trace', 'tap-points', 'match'],
      prerequisites: ['g2.shape.triangle_quadrilateral'],
      curriculumRefs: ['B(1)ア', '用語・記号 頂点、辺']
    }),
    stage({
      id: 'g2_shape_right_angle', n: 4, name: '直角おり紙ゲージ',
      canonicalSkillId: 'g2.shape.right_angle',
      objective: '紙を折って作る角を基に直角を知り、向きが変わっても見つける。',
      action: '直角ゲージを回転して角へ重ね、ぴったり合う場所を検査する。',
      interactions: ['rotate', 'overlay', 'select'],
      prerequisites: ['g2.shape.edges_vertices'],
      curriculumRefs: ['B(1)ア', '用語・記号 直角']
    }),
    stage({
      id: 'g2_shape_basic_check', n: 5, name: '図形きそチェッカー',
      canonicalSkillId: 'g2.shape.basic.review',
      objective: '直線、囲み、三角形・四角形、辺・頂点、直角を混合形式で確認する。',
      action: '形の設計図にある、線・辺・頂点・角の故障箇所を直す。',
      interactions: ['repair-shape', 'count-edges', 'tap-points', 'overlay'],
      prerequisites: ['g2.shape.lines_enclosure', 'g2.shape.right_angle'],
      curriculumRefs: ['B(1)前半・確認'],
      timeAttackEligible: false
    }),
    stage({
      id: 'g2_shape_rectangle', n: 6, name: '長方形フレーム台',
      canonicalSkillId: 'g2.shape.rectangle',
      objective: '四つの角が直角であることに着目して長方形を弁別・構成する。',
      action: '辺の長さが異なるフレームを組み、四隅を直角ゲージで固定する。',
      interactions: ['assemble', 'overlay', 'sort'],
      prerequisites: ['g2.shape.right_angle'],
      curriculumRefs: ['B(1)ア', '3社共通・長方形']
    }),
    stage({
      id: 'g2_shape_square', n: 7, name: '正方形フレーム台',
      canonicalSkillId: 'g2.shape.square',
      objective: '四つの辺が同じ長さで四つの角が直角である正方形を弁別・構成する。',
      action: '同じ長さの辺だけを選び、直角の四隅へ接続する。',
      interactions: ['measure-edges', 'assemble', 'sort'],
      prerequisites: ['g2.shape.rectangle'],
      curriculumRefs: ['B(1)ア', '3社共通・正方形']
    }),
    stage({
      id: 'g2_shape_right_triangle', n: 8, name: '直角三角形カッター',
      canonicalSkillId: 'g2.shape.right_triangle',
      objective: '直角を一つもつ三角形を直角三角形として弁別・構成する。',
      action: '長方形や正方形を対角線で切り、できた角を直角ゲージで調べる。',
      interactions: ['cut', 'rotate', 'overlay'],
      prerequisites: ['g2.shape.right_angle', 'g2.shape.rectangle'],
      curriculumRefs: ['B(1)ア', '3社共通・直角三角形']
    }),
    stage({
      id: 'g2_shape_draw_tile', n: 9, name: '方眼しきつめ設計盤',
      canonicalSkillId: 'g2.shape.draw_compose_tile',
      objective: '方眼上に長方形・正方形・直角三角形をかき、分割・敷き詰めで形を構成する。',
      action: '点を結んで指定図形を作り、回転したパーツで面を隙間なく埋める。',
      interactions: ['connect-dots', 'rotate', 'tile'],
      prerequisites: ['g2.shape.rectangle', 'g2.shape.square', 'g2.shape.right_triangle'],
      curriculumRefs: ['B(1)', '内容の取扱い(5)', '3社共通・作図と敷き詰め']
    }),
    stage({
      id: 'g2_shape_box', n: 10, name: 'はこ組み立てドック',
      canonicalSkillId: 'g2.shape.box_faces_edges_vertices',
      objective: '箱の形を面・辺・頂点に着目して観察し、平面の面から組み立てる。',
      action: '6枚の面や12本のひごを選び、8個の頂点へ接続して箱を作る。',
      interactions: ['assemble-3d', 'count-elements', 'match-face'],
      prerequisites: ['g2.shape.edges_vertices', 'g2.shape.rectangle', 'g2.shape.square'],
      curriculumRefs: ['B(1)ア', '用語・記号 面', '3社共通・箱の形'],
      boundaryNote: '立方体・直方体の形式的な定義や本格的な展開図問題へ広げない。'
    }),
    stage({
      id: 'g2_shape_core', n: 11, name: 'かたち設計メインコア2',
      canonicalSkillId: 'g2.shape.review',
      objective: '平面図形の構成要素、直角、基本図形の性質、作図・敷き詰め、箱を総合する。',
      action: '設計条件を読み、辺・角・方眼・立体組立の装置を使い分ける。',
      interactions: ['sort', 'overlay', 'connect-dots', 'tile', 'assemble-3d'],
      prerequisites: ['g2.shape.basic.review', 'g2.shape.draw_compose_tile', 'g2.shape.box_faces_edges_vertices'],
      curriculumRefs: ['B(1)総合'],
      timeAttackEligible: false
    })
  ];

  const SOLVE_STAGES = [
    stage({
      id: 'g2_data_classify_view', n: 1, name: '観点えらび仕分け台',
      canonicalSkillId: 'g2.data.classification_view',
      objective: '目的に合う分類の観点を決め、身の回りのデータを整理する。',
      action: '調べたいことを選び、同じカードを適切な分類箱へ入れる。',
      interactions: ['choose-view', 'sort', 'tap'],
      prerequisites: ['g1.data.classify'],
      curriculumRefs: ['D(1)', '3社共通・表とグラフ']
    }),
    stage({
      id: 'g2_data_tally', n: 2, name: '数え落とし防止カウンター',
      canonicalSkillId: 'g2.data.tally',
      objective: 'データを印で記録し、重複や数え落としなく個数を数える。',
      action: 'カードを一枚ずつ送り、対応する欄へ印を付けて処理済みにする。',
      interactions: ['tally', 'tap', 'repair'],
      prerequisites: ['g2.data.classification_view'],
      curriculumRefs: ['D(1)ア', '3社共通・分類整理']
    }),
    stage({
      id: 'g2_data_table', n: 3, name: '一次元ひょう作成盤',
      canonicalSkillId: 'g2.data.one_way_table',
      objective: '分類したデータを簡単な一次元の表に表し、合計を確かめる。',
      action: '分類ラベルと個数チップを表の行へ置き、元データ数と照合する。',
      interactions: ['table-build', 'place', 'check-total'],
      prerequisites: ['g2.data.tally'],
      curriculumRefs: ['D(1)ア', '3社共通・簡単な表']
    }),
    stage({
      id: 'g2_data_graph', n: 4, name: '○グラフ点灯盤',
      canonicalSkillId: 'g2.data.simple_graph',
      objective: '一つが一個を表す○などを並べた簡単なグラフを作り、表と対応させる。',
      action: '表の個数と同じ数だけランプを下から隙間なく点灯する。',
      interactions: ['graph-build', 'tap-grid', 'match'],
      prerequisites: ['g2.data.one_way_table'],
      curriculumRefs: ['D(1)ア', '3社共通・簡単なグラフ']
    }),
    stage({
      id: 'g2_data_basic_check', n: 5, name: '表・グラフチェッカー',
      canonicalSkillId: 'g2.data.table_graph.review',
      objective: '分類、数え方、表、簡単なグラフを混合形式で確認する。',
      action: '元データから表・グラフまでの処理回路にある誤りを直す。',
      interactions: ['sort', 'tally', 'table-build', 'graph-build', 'repair'],
      prerequisites: ['g2.data.classification_view', 'g2.data.simple_graph'],
      curriculumRefs: ['D(1)前半・確認'],
      timeAttackEligible: false
    }),
    stage({
      id: 'g2_data_read_compare', n: 6, name: 'データ読取モニター2',
      canonicalSkillId: 'g2.data.read_compare',
      objective: '表やグラフから、多い・少ない・同じ・全部・差を読み取り、特徴を考える。',
      action: '質問に必要な列だけを照らし、比べる二つのデータを接続する。',
      interactions: ['highlight', 'compare', 'select'],
      prerequisites: ['g2.data.table_graph.review'],
      curriculumRefs: ['D(1)イ', '3社共通・表とグラフの読み取り']
    }),
    stage({
      id: 'g2_data_representation', n: 7, name: '表し方セレクター',
      canonicalSkillId: 'g2.data.choose_repair_representation',
      objective: '目的に合う表・グラフを選び、ラベル、並べ方、個数の誤りを直す。',
      action: '調べたい質問を読み、見やすい表示装置を選んで故障箇所を修正する。',
      interactions: ['representation-choice', 'repair', 'match'],
      prerequisites: ['g2.data.read_compare'],
      curriculumRefs: ['D(1)イ', '3社共通・データの考察']
    }),
    stage({
      id: 'g2_problem_operation_choice', n: 8, name: 'たす・ひく判断レバー2',
      canonicalSkillId: 'g2.problem.add_sub_operation_choice',
      objective: '2位数を含む生活場面から、足し算か引き算かを選び、必要な情報を見つける。',
      action: '場面アニメを再生し、量の変化や全体・部分に合うレバーを入れる。',
      interactions: ['story-playback', 'operation-choice', 'select-info'],
      prerequisites: ['g2.calculation.written_2digit.review'],
      curriculumRefs: ['A(2)', '3社共通・演算決定']
    }),
    stage({
      id: 'g2_problem_inverse_diagram', n: 9, name: 'テープ図逆算モニター',
      canonicalSkillId: 'g2.problem.inverse_tape_diagram',
      objective: '全体・部分や差の関係をテープ図に表し、加減の逆思考で未知の量を求める。',
      action: '分かっている数を図へ置き、空欄へ届く逆向きの計算回路をつなぐ。',
      interactions: ['tape-diagram', 'place-values', 'inverse-route'],
      prerequisites: ['g2.problem.add_sub_operation_choice', 'g2.calculation.inverse_estimate_check'],
      curriculumRefs: ['A(2)', '3社共通・図を使う加減の逆思考']
    }),
    stage({
      id: 'g2_problem_mixed_story', n: 10, name: '情報えらび解決デスク',
      canonicalSkillId: 'g2.problem.mixed_story_model',
      objective: '余分な情報や□を含む文章題を、図・式・表から適切な表現を選んで解決する。',
      action: '必要な情報カードだけを作業台へ置き、解決に使う装置と式を組み合わせる。',
      interactions: ['select-info', 'model-choice', 'missing-number', 'story-solve'],
      prerequisites: ['g2.problem.inverse_tape_diagram', 'g2.multiplication.scene_expression'],
      curriculumRefs: ['A(2)(3)', 'D(1)', '3社共通・問題解決']
    }),
    stage({
      id: 'g2_solve_core', n: 11, name: '調査・解決メインコア2',
      canonicalSkillId: 'g2.problem_data.review',
      objective: 'データの整理・表現・考察と、加減・乗法の文章題を総合して解決する。',
      action: '調査から得た情報を表や図へ変換し、使う計算装置を自分で選ぶ。',
      interactions: ['sort', 'table-build', 'graph-build', 'tape-diagram', 'story-solve'],
      prerequisites: ['g2.data.table_graph.review', 'g2.data.choose_repair_representation', 'g2.problem.mixed_story_model'],
      curriculumRefs: ['A・D総合'],
      timeAttackEligible: false
    })
  ];

  function line(config) {
    return Object.freeze(Object.assign({ gradeId: GRADE_ID, zones: ZONES }, config));
  }

  const LINES = Object.freeze({
    number: line({
      id: 'number', name: '大きなかず 位取りライン', short: '大きなかず', symbol: '1000',
      domain: 'A(1) 数の構成と表し方', stages: NUMBER_STAGES,
      description: '1000、10000、位取り、数直線、単位分数を、束と表示を組み替えて理解する。',
      timeAttackStageIds: ['g2_num_group_count', 'g2_num_to1000', 'g2_num_place_value', 'g2_num_relative_units', 'g2_num_compare', 'g2_num_number_line', 'g2_num_to10000', 'g2_num_10000_relations', 'g2_num_unit_fractions', 'g2_num_to1000', 'g2_num_compare', 'g2_num_to10000']
    }),
    written: line({
      id: 'written', name: 'たしひき 筆算ライン', short: 'たしひき', symbol: '±',
      domain: 'A(2) 加法・減法', stages: WRITTEN_STAGES,
      description: '位をそろえる、10を交換する、逆算で確かめる。足し算と引き算を一つの仕組みとして扱う。',
      timeAttackStageIds: ['g2_calc_add_no_carry', 'g2_calc_add_no_carry', 'g2_calc_add_regroup', 'g2_calc_add_regroup', 'g2_calc_sub_no_borrow', 'g2_calc_sub_no_borrow', 'g2_calc_sub_regroup', 'g2_calc_sub_regroup', 'g2_calc_sum_to_3digit', 'g2_calc_sub_from_3digit', 'g2_calc_simple_3digit', 'g2_calc_inverse_check']
    }),
    multiplication: line({
      id: 'multiplication', name: 'かけ算 増幅ライン', short: 'かけ算', symbol: '×',
      domain: 'A(3) 乗法', stages: MULTIPLICATION_STAGES,
      description: '同じ数ずつのまとまりをアレイと九九へつなぎ、きまりを使って増幅する。',
      timeAttackStageIds: ['g2_mul_equal_groups', 'g2_mul_scene_expression', 'g2_mul_array_repeated_add', 'g2_mul_tables_2_5', 'g2_mul_tables_2_5', 'g2_mul_tables_3_4', 'g2_mul_tables_6_7', 'g2_mul_tables_8_9_1', 'g2_mul_tables_8_9_1', 'g2_mul_properties_table', 'g2_mul_times_and_beyond', 'g2_mul_times_and_beyond']
    }),
    measure: line({
      id: 'measure', name: 'はかる 計測ライン', short: 'はかる', symbol: '㎝',
      domain: 'C 測定', stages: MEASURE_STAGES,
      description: 'cm・mm・m、L・dL・mL、時刻・時間を、見積りと実測で使い分ける。',
      timeAttackStageIds: ['g2_measure_common_unit', 'g2_measure_cm_ruler', 'g2_measure_mm', 'g2_measure_line_length', 'g2_measure_capacity_ldl', 'g2_measure_capacity_ldl', 'g2_measure_capacity_ml', 'g2_measure_time_duration', 'g2_measure_time_duration', 'g2_measure_day_schedule', 'g2_measure_meter', 'g2_measure_meter']
    }),
    shape: line({
      id: 'shape', name: 'かたち 設計ライン2', short: 'かたち', symbol: '□',
      domain: 'B 図形', stages: SHAPE_STAGES,
      description: '辺・頂点・直角を手掛かりに平面図形を設計し、面から箱を組み立てる。',
      timeAttackStageIds: ['g2_shape_lines_enclosure', 'g2_shape_tri_quad', 'g2_shape_edges_vertices', 'g2_shape_right_angle', 'g2_shape_rectangle', 'g2_shape_square', 'g2_shape_right_triangle', 'g2_shape_draw_tile', 'g2_shape_box', 'g2_shape_tri_quad', 'g2_shape_right_angle', 'g2_shape_box']
    }),
    solve: line({
      id: 'solve', name: '調査・問題解決ライン', short: 'しらべる', symbol: '▥',
      domain: 'D データの活用・Aの活用', stages: SOLVE_STAGES,
      description: 'データを表・グラフにし、文章を図と式へ変換して、使う計算を判断する。',
      timeAttackStageIds: ['g2_data_classify_view', 'g2_data_tally', 'g2_data_table', 'g2_data_graph', 'g2_data_read_compare', 'g2_data_representation', 'g2_problem_operation_choice', 'g2_problem_operation_choice', 'g2_problem_inverse_diagram', 'g2_problem_inverse_diagram', 'g2_problem_mixed_story', 'g2_problem_mixed_story']
    })
  });

  const LINE_ORDER = Object.freeze(['number', 'written', 'multiplication', 'measure', 'shape', 'solve']);

  const TEXTBOOK_SOURCES = Object.freeze({
    mext: {
      label: '文部科学省 小学校学習指導要領（平成29年告示）解説 算数編',
      url: 'https://www.mext.go.jp/content/20211102-mxt_kyoiku02-100002607_04.pdf'
    },
    tokyoShoseki: {
      label: '東京書籍 令和6年度用 新編 新しい算数 2年 年間指導計画略案',
      url: 'https://ten.tokyo-shoseki.co.jp/text/shou/sansu/data/sansu_keikaku_ryakuan_2.pdf'
    },
    dainipponTosho: {
      label: '大日本図書 令和6年版 新版 たのしい算数 年間単元一覧表',
      url: 'https://www.dainippon-tosho.co.jp/sansu/files/r6sansuSK.pdf'
    },
    nihonBunkyo: {
      label: '日本文教出版 令和6年度版 小学算数 2年 年間指導計画',
      url: 'https://www.nichibun-g.co.jp/textbooks/sansu/download/r6/r6_sansu_nenkei_2.pdf'
    }
  });

  const TEXTBOOK_UNIT_GROUPS = Object.freeze([
    '表とグラフ', '2位数の足し算', '2位数の引き算', '演算決定', 'cm・mmとものさし',
    '1000までの数', 'かさ', '時刻と時間', '発展的な加減筆算', '計算の工夫・加減の関係',
    '三角形と四角形', 'かけ算の意味', '九九', 'かけ算の性質', 'mと長い長さ',
    '10000までの数', '図を使う問題解決', '簡単な分数', '箱の形'
  ]);

  const RECOMMENDED_PATH = Object.freeze([
    { term: '1学期前半', focus: '表・グラフと2位数の加減', steps: ['solve:1-5', 'written:1-5'] },
    { term: '1学期後半', focus: '長さ、1000までの数、かさ・時間', steps: ['measure:1-9', 'number:1-5'] },
    { term: '2学期前半', focus: '発展筆算と平面図形', steps: ['written:6-10', 'shape:1-9'] },
    { term: '2学期後半', focus: 'かけ算の意味と九九', steps: ['multiplication:1-8'] },
    { term: '3学期', focus: '九九の性質、m、10000、逆思考、箱、分数、総合', steps: ['multiplication:9-11', 'measure:10-11', 'number:6-11', 'solve:6-11', 'shape:10-11', 'written:11'] }
  ]);

  const IMPLEMENTATION_GATE = Object.freeze({
    runtimeStatus: 'playable',
    requiredBeforeActivation: [],
    completed: [
      'g1/g2コースレジストリ',
      'state v4への学年別保存移行',
      'courseId・gradeId付きの問題生成・履歴・タイムアタック',
      '既存G1・66ステージの完全回帰テスト',
      'G2・66ステージの問題ビルダーと全完走テスト'
    ],
    note: 'index.htmlから実行時に読み込み、コース選択から小学2年生を直接開始できる。'
  });

  function validateCurriculum() {
    const errors = [];
    const stages = LINE_ORDER.reduce(function (all, lineId) {
      const currentLine = LINES[lineId];
      if (!currentLine) {
        errors.push('missing line: ' + lineId);
        return all;
      }
      if (currentLine.stages.length !== 11) errors.push(lineId + ': expected 11 stages');
      if (currentLine.timeAttackStageIds.length !== TIME_ATTACK_ROUNDS) errors.push(lineId + ': expected 12 time attack slots');
      return all.concat(currentLine.stages);
    }, []);
    const stageIds = stages.map(function (item) { return item.id; });
    const skillIds = stages.map(function (item) { return item.canonicalSkillId; });
    if (stages.length !== 66) errors.push('expected 66 stages');
    if (new Set(stageIds).size !== stageIds.length) errors.push('duplicate stage ids');
    if (new Set(skillIds).size !== skillIds.length) errors.push('duplicate canonical skill ids');
    stages.forEach(function (item) {
      if (!item.id.startsWith('g2_')) errors.push(item.id + ': stage id must start with g2_');
      if (!item.canonicalSkillId.startsWith('g2.')) errors.push(item.id + ': skill id must start with g2.');
      if (!item.objective || !item.action || !item.interactions.length) errors.push(item.id + ': incomplete stage metadata');
      if ((item.n === 5 || item.n === 11) !== item.checkpoint) errors.push(item.id + ': invalid checkpoint flag');
    });
    LINE_ORDER.forEach(function (lineId) {
      LINES[lineId].timeAttackStageIds.forEach(function (stageId) {
        if (!stageIds.includes(stageId)) errors.push(lineId + ': unknown time attack stage ' + stageId);
      });
    });
    return Object.freeze({ ok: errors.length === 0, errors: Object.freeze(errors), stageCount: stages.length });
  }

  const CURRICULUM = Object.freeze({
    id: GRADE_ID,
    label: '小学2年生 算数',
    version: 2,
    status: 'playable-runtime-ready',
    standardHours: 175,
    lineOrder: LINE_ORDER,
    lines: LINES,
    zones: ZONES,
    questionPolicy: QUESTION_POLICY,
    stageRounds: STAGE_ROUNDS,
    timeAttackRounds: TIME_ATTACK_ROUNDS,
    textbookSources: TEXTBOOK_SOURCES,
    textbookUnitGroups: TEXTBOOK_UNIT_GROUPS,
    recommendedPath: RECOMMENDED_PATH,
    implementationGate: IMPLEMENTATION_GATE,
    validate: validateCurriculum
  });

  global.HiramekiGrade2Curriculum = CURRICULUM;
}(typeof globalThis !== 'undefined' ? globalThis : window));
