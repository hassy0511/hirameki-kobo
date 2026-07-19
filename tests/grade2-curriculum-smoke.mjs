import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const rootUrl = new URL('../', import.meta.url);
const source = fs.readFileSync(new URL('grade2-curriculum.js', rootUrl), 'utf8');

new vm.Script(source, { filename: 'grade2-curriculum.js' });

const sandbox = {};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
new vm.Script(source, { filename: 'grade2-curriculum.js' }).runInContext(sandbox);

const curriculum = sandbox.HiramekiGrade2Curriculum;
assert(curriculum, '二年生カリキュラムが公開されませんでした');
assert.equal(curriculum.id, 'g2');
assert.equal(curriculum.standardHours, 175);
assert.equal(curriculum.stageRounds, 8);
assert.equal(curriculum.timeAttackRounds, 12);
assert.equal(curriculum.lineOrder.length, 6, '二年生は6ライン必要です');

const allStages = curriculum.lineOrder.flatMap(lineId => Array.from(curriculum.lines[lineId].stages));
assert.equal(allStages.length, 66, '二年生は全66ステージ必要です');
assert.equal(new Set(allStages.map(stage => stage.id)).size, 66, 'ステージIDが重複しています');
assert.equal(new Set(allStages.map(stage => stage.canonicalSkillId)).size, 66, 'canonicalSkillIdが重複しています');

for (const lineId of curriculum.lineOrder) {
  const line = curriculum.lines[lineId];
  assert.equal(line.stages.length, 11, lineId + ': 11ステージ必要です');
  assert.equal(line.timeAttackStageIds.length, 12, lineId + ': タイムアタックは12枠必要です');
  assert(line.domain && line.description, lineId + ': 領域・説明が不足しています');
  assert(line.stages[4].checkpoint, lineId + ': ステージ5は確認テストです');
  assert(line.stages[10].checkpoint, lineId + ': ステージ11は確認テストです');
  assert(!line.stages[4].timeAttackEligible, lineId + ': 確認テストをそのままタイムアタックへ入れません');
  assert(!line.stages[10].timeAttackEligible, lineId + ': 総合確認をそのままタイムアタックへ入れません');
}

for (const stage of allStages) {
  assert(stage.id.startsWith('g2_'), stage.id + ': IDへ学年接頭辞が必要です');
  assert(stage.canonicalSkillId.startsWith('g2.'), stage.id + ': canonicalSkillIdへ学年接頭辞が必要です');
  assert(stage.objective && stage.action, stage.id + ': 学習目標・中心操作が不足しています');
  assert(stage.interactions.length >= 3, stage.id + ': 操作候補が3種類未満です');
  assert(stage.curriculumRefs.length > 0, stage.id + ': 学習指導要領・共通単元との対応がありません');
}

assert.equal(curriculum.questionPolicy.operationMin, 5, '通常ステージは操作問題を最低5問含めます');
assert.equal(curriculum.questionPolicy.bareCalculationMax, 1, '式だけの問題は最大1問です');
assert.equal(curriculum.questionPolicy.recentSignatureWindow, 32, '直近問題の重複回避窓が不正です');
assert.equal(Object.keys(curriculum.textbookSources).length, 4, '文科省と教科書3社の公式資料が必要です');
assert.equal(curriculum.recommendedPath.length, 5, '年間おすすめ順は5期に分けます');
assert.equal(curriculum.implementationGate.runtimeStatus, 'playable');
assert.equal(curriculum.implementationGate.requiredBeforeActivation.length, 0);

const validation = curriculum.validate();
assert.equal(validation.ok, true, validation.errors.join('\n'));
assert.equal(validation.stageCount, 66);

console.log('grade2 curriculum smoke: 6 lines / 66 stages / curriculum refs / action metadata / checkpoints / 12-slot time attacks OK');
