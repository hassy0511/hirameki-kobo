import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const rootUrl = new URL('../', import.meta.url);
const source = fs.readFileSync(new URL('grade3-curriculum.js', rootUrl), 'utf8');
const grade1Source = fs.readFileSync(new URL('game-core.js', rootUrl), 'utf8');
const grade2Source = fs.readFileSync(new URL('grade2-curriculum.js', rootUrl), 'utf8');
const overview = fs.readFileSync(new URL('docs/curriculum_math_g3_overview.md', rootUrl), 'utf8');
const implementation = fs.readFileSync(new URL('docs/implementation_math_g3.md', rootUrl), 'utf8');
const earlierSkillIds = new Set((grade1Source + '\n' + grade2Source).match(/g[12]\.[a-z0-9_.]+/g) || []);

new vm.Script(source, { filename: 'grade3-curriculum.js' });

const sandbox = {};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
new vm.Script(source, { filename: 'grade3-curriculum.js' }).runInContext(sandbox);

const curriculum = sandbox.HiramekiGrade3Curriculum;
assert(curriculum, '三年生カリキュラムが公開されませんでした');
assert.equal(curriculum.id, 'g3');
assert.equal(curriculum.standardHours, 175);
assert.equal(curriculum.stageRounds, 8);
assert.equal(curriculum.timeAttackRounds, 12);
assert.equal(curriculum.lineOrder.length, 7, '三年生は7ライン必要です');

const allStages = curriculum.lineOrder.flatMap(lineId => Array.from(curriculum.lines[lineId].stages));
const allSkillIds = new Set(allStages.map(stage => stage.canonicalSkillId));
assert.equal(allStages.length, 77, '三年生は全77ステージ必要です');
assert.equal(new Set(allStages.map(stage => stage.id)).size, 77, 'ステージIDが重複しています');
assert.equal(new Set(allStages.map(stage => stage.canonicalSkillId)).size, 77, 'canonicalSkillIdが重複しています');

for (const lineId of curriculum.lineOrder) {
  const line = curriculum.lines[lineId];
  const lineStageIds = new Set(Array.from(line.stages, stage => stage.id));
  assert.equal(line.stages.length, 11, lineId + ': 11ステージ必要です');
  assert.deepEqual(Array.from(line.stages, stage => stage.n), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], lineId + ': ステージ番号が連続していません');
  assert.equal(line.timeAttackStageIds.length, 12, lineId + ': タイムアタックは12枠必要です');
  assert(line.domain && line.description, lineId + ': 領域・説明が不足しています');
  assert(line.stages[4].checkpoint, lineId + ': ステージ5は確認テストです');
  assert(line.stages[10].checkpoint, lineId + ': ステージ11は確認テストです');
  assert(!line.stages[4].timeAttackEligible, lineId + ': 前半確認をそのままタイムアタックへ入れません');
  assert(!line.stages[10].timeAttackEligible, lineId + ': 総合確認をそのままタイムアタックへ入れません');
  for (const stageId of line.timeAttackStageIds) {
    assert(lineStageIds.has(stageId), lineId + ': 他ラインのステージをタイムアタックへ混ぜません');
    const stage = line.stages.find(candidate => candidate.id === stageId);
    assert(stage.timeAttackEligible, lineId + ': 確認ステージをタイムアタックへ直接入れません');
  }
}

for (const stage of allStages) {
  assert(stage.id.startsWith('g3_'), stage.id + ': IDへ学年接頭辞が必要です');
  assert.equal(stage.gradeId, 'g3', stage.id + ': gradeIdが不正です');
  assert(stage.canonicalSkillId.startsWith('g3.'), stage.id + ': canonicalSkillIdへ学年接頭辞が必要です');
  assert(stage.objective && stage.action, stage.id + ': 学習目標・中心操作が不足しています');
  assert(stage.interactions.length >= 3, stage.id + ': 操作候補が3種類未満です');
  assert(stage.curriculumRefs.length > 0, stage.id + ': 学習指導要領・共通単元との対応がありません');
  assert(Array.isArray(stage.prerequisites), stage.id + ': 前提技能は配列で必要です');
  for (const prerequisite of stage.prerequisites) {
    if (prerequisite.startsWith('g3.')) assert(allSkillIds.has(prerequisite), stage.id + ': 未定義の三年生前提技能です: ' + prerequisite);
    if (/^g[12]\./.test(prerequisite)) assert(earlierSkillIds.has(prerequisite), stage.id + ': 未定義の前学年前提技能です: ' + prerequisite);
  }
  assert(overview.includes('`' + stage.canonicalSkillId + '`'), stage.id + ': 正本文書にcanonicalSkillIdがありません');
  assert(overview.includes(stage.name), stage.id + ': 正本文書にステージ名がありません');
}

assert.equal(curriculum.questionPolicy.operationMin, 5, '通常ステージは操作問題を最低5問含めます');
assert.equal(curriculum.questionPolicy.storyMin, 1, '毎ステージに文章・生活場面が必要です');
assert.equal(curriculum.questionPolicy.bareCalculationMax, 1, '式だけの問題は最大1問です');
assert.equal(curriculum.questionPolicy.recentSignatureWindow, 32, '直近問題の重複回避窓が不正です');
assert.equal(Object.keys(curriculum.textbookSources).length, 4, '文科省と教科書3社の公式資料が必要です');
assert.equal(Object.keys(curriculum.publisherPlans).length, 3, '教科書3社の年間順が必要です');
for (const plan of Object.values(curriculum.publisherPlans)) {
  assert.equal(plan.allocatedHours + plan.reserveHours, 175, '配当時数と予備時数の合計が標準175時間になりません');
  assert(plan.unitOrder.length >= 18, '出版社別の主単元順が不足しています');
}

assert.equal(curriculum.textbookUnitGroups.length, 13, '3社共通単元は13束必要です');
assert.deepEqual(Object.keys(curriculum.officialCoverage), ['A', 'B', 'C', 'D']);
assert.equal(curriculum.officialCoverage.A.length, 8, 'A(1)〜A(8)をすべて含めます');
assert.match(curriculum.gradeBoundaries.integers, /一億まで/);
assert.match(curriculum.gradeBoundaries.division, /一般筆算は四年生/);
assert.match(curriculum.gradeBoundaries.decimals, /小数第一位/);
assert.match(curriculum.gradeBoundaries.fractions, /和が1まで/);
assert.match(curriculum.gradeBoundaries.angles, /分度器は四年生/);
assert.match(curriculum.gradeBoundaries.data, /折れ線グラフは四年生/);
assert.equal(curriculum.recommendedPath.length, 5, '年間おすすめ順は5期に分けます');
const kilometer = allStages.find((stage) => stage.id === 'g3_measure_kilometer');
assert(!kilometer.prerequisites.includes('g3.number.scale_10_100_1000_tenth'), 'kmは後置の大きな数ステージを前提にしません');
const tonPrefix = allStages.find((stage) => stage.id === 'g3_measure_ton_net');
assert(tonPrefix.objective.includes('接頭語k・m'), '内容の取扱い(7)に沿い、接頭語k・mへ触れます');
const unknownBox = allStages.find((stage) => stage.id === 'g3_problem_unknown_box');
assert(unknownBox.interactions.includes('trial-substitute'), '□には数を当てはめて調べる操作を含めます');
const soroban = allStages.find((stage) => stage.id === 'g3_num_soroban');
assert(soroban.prerequisites.includes('g3.decimal.written_add_sub'), '小数を扱うそろばんには小数加減を前提にします');
const simpleDivision = allStages.find((stage) => stage.id === 'g3_div_simple_two_digit');
assert(!simpleDivision.prerequisites.includes('g3.number.scale_10_100_1000_tenth'), '簡単な商2位数の除法は後置の大きな数ステージを前提にしません');
const triangleClassify = allStages.find((stage) => stage.id === 'g3_shape_triangle_classify');
assert(triangleClassify.objective.includes('直角二等辺三角形'), '直角二等辺三角形にも触れます');
assert.equal(curriculum.implementationGate.runtimeStatus, 'metadata-ready');
assert.match(implementation, /7ライン・77ステージ/);
assert.match(implementation, /COURSES\.g1\/g2/);
assert.match(implementation, /一般的な除法筆算/);

const validation = curriculum.validate();
assert.equal(validation.ok, true, validation.errors.join('\n'));
assert.equal(validation.lineCount, 7);
assert.equal(validation.stageCount, 77);

console.log('grade3 curriculum smoke: 7 lines / 77 stages / official boundaries / publisher plans / action metadata / checkpoints / 12-slot time attacks OK');
