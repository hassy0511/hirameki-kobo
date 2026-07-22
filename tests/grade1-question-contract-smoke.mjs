import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const rootUrl = new URL('../', import.meta.url);
const coreSource = fs.readFileSync(new URL('game-core.js', rootUrl), 'utf8');
const runtimeSource = fs.readFileSync(new URL('grade1-runtime.js', rootUrl), 'utf8');
const appSource = fs.readFileSync(new URL('app.js', rootUrl), 'utf8');
const cssSource = fs.readFileSync(new URL('styles.css', rootUrl), 'utf8');

for (const [filename, source] of [['game-core.js', coreSource], ['grade1-runtime.js', runtimeSource], ['app.js', appSource]]) {
  new vm.Script(source, { filename });
}

const sandbox = { console };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
new vm.Script(coreSource, { filename: 'game-core.js' }).runInContext(sandbox);
new vm.Script(runtimeSource, { filename: 'grade1-runtime.js' }).runInContext(sandbox);

const core = sandbox.HiramekiCore;
const runtime = sandbox.HiramekiGrade1Runtime;
assert.equal(core.STATE_VERSION, 4, 'G1保存版が統合仕様の4と一致していません');
assert(runtime.validate().ok, runtime.validate().errors.join('\n'));
assert(!runtimeSource.includes('Math.random'), 'G1生成器が注入rng以外を使っています');

const expectedArc = ['intro', 'intro', 'develop', 'develop', 'story', 'twist', 'check', 'capstone'];
let generatedCount = 0;

function values(question) {
  return Array.from(question.options || [], core.optionValue).map(String);
}

function assertQuestion(question, lineId, stageIndex) {
  const line = core.LINES[lineId];
  const stage = line.stages[stageIndex];
  const contract = core.G1_STAGE_CONTRACTS[lineId][stageIndex];
  assert.equal(question.stageAction, stage.action, lineId + '/' + stage.id + ': stage.actionが生成器へ渡っていません');
  assert(question.instruction && /けってい/.test(question.instruction), lineId + '/' + stage.id + ': 確定文法がありません');
  assert(Array.isArray(question.hints) && question.hints.length >= 2, lineId + '/' + stage.id + ': 段階ヒントがありません');
  assert.notEqual(question.hint, 'よく見て、もういちど ためそう。', lineId + '/' + stage.id + ': 無内容なヒントです');
  assert(question.templateId && question.learningSignature, lineId + '/' + stage.id + ': テンプレートまたは学習署名がありません');
  if (!contract.assessment) assert(contract.allowedKinds.includes(question.kind), lineId + '/' + stage.id + ': 契約外の操作 ' + question.kind);
  if (['choice', 'route', 'sort'].includes(question.kind)) {
    const optionValues = values(question);
    assert(optionValues.includes(String(question.correct)), lineId + '/' + stage.id + ': 正解が選択肢にありません');
    if (Number.isFinite(Number(question.correct))) assert.equal(new Set(optionValues).size, 4, lineId + '/' + stage.id + ': 数値選択肢が4つありません');
  }
  if (question.sourceCanonicalSkillId !== 'g1.sub.zero_same' && question.math?.kind === 'subtract') {
    assert.notEqual(Number(question.math.b), 0, lineId + '/' + stage.id + ': 自明な「−0」です');
    assert.notEqual(Number(question.math.result), 0, lineId + '/' + stage.id + ': 意図しない「全部引く」です');
  }
  if (question.sourceCanonicalSkillId !== 'g1.number.zero_bonds' && question.math?.kind === 'bond') {
    assert.notEqual(Number(question.math.known), 0, lineId + '/' + stage.id + ': 意図しない「いま0こ」です');
    assert.notEqual(Number(question.correct), 0, lineId + '/' + stage.id + ': 意図しない「あと0こ」です');
  }
  if (question.answerDerived && Number.isFinite(Number(question.correct))) {
    const escaped = String(question.correct).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert(!new RegExp('(^|[^0-9])' + escaped + '([^0-9]|$)').test(question.instruction), lineId + '/' + stage.id + ': 操作説明に正解が書かれています');
  }
  generatedCount += 1;
}

for (const lineId of core.LINE_ORDER) {
  const line = core.LINES[lineId];
  assert.equal(core.G1_STAGE_CONTRACTS[lineId].length, 11, lineId + ': 11ステージ分の契約がありません');
  for (let stageIndex = 0; stageIndex < line.stages.length; stageIndex += 1) {
    const contract = core.G1_STAGE_CONTRACTS[lineId][stageIndex];
    assert(line.stages[stageIndex].questionContract, lineId + ': ステージメタデータに出題契約がありません');
    for (const seed of [101, 202, 303]) {
      const pack = core.makeStageQuestions(lineId, stageIndex, { seed: seed + stageIndex * 1009 });
      assert.equal(pack.questions.length, 8);
      assert.deepEqual(Array.from(pack.questions, question => question.arcRole), expectedArc, lineId + '/' + stageIndex + ': 8問アークが不正です');
      assert.equal(new Set(pack.questions.map(question => question.learningSignature)).size, 8, lineId + '/' + stageIndex + ': 同じ学習内容が一回の中で重複しています');
      assert(pack.questions[4].story, lineId + '/' + stageIndex + ': 5問目に場面問題がありません');
      assert(pack.questions[7].checkpoint, lineId + '/' + stageIndex + ': 最終問が代表問題ではありません');
      const kinds = new Set(pack.questions.map(question => question.kind));
      if (!contract.assessment && !contract.paired) assert.deepEqual(kinds, new Set([contract.primaryKind]), lineId + '/' + stageIndex + ': 1ステージ1中心操作ではありません');
      if (contract.paired) assert(kinds.size <= 2 && [...kinds].every(kind => contract.allowedKinds.includes(kind)), lineId + '/' + stageIndex + ': 読む・つくる以外の操作が混在しています');
      pack.questions.forEach(question => assertQuestion(question, lineId, stageIndex));
    }
    const deterministicA = core.makeStageQuestions(lineId, stageIndex, { seed: 919191 + stageIndex });
    const deterministicB = core.makeStageQuestions(lineId, stageIndex, { seed: 919191 + stageIndex });
    assert.deepEqual(deterministicA, deterministicB, lineId + '/' + stageIndex + ': 同じシードを再現できません');
  }
}

for (let packIndex = 0; generatedCount < 1000; packIndex += 1) {
  const lineId = core.LINE_ORDER[packIndex % core.LINE_ORDER.length];
  const stageIndex = Math.floor(packIndex / core.LINE_ORDER.length) % 11;
  core.makeStageQuestions(lineId, stageIndex, { seed: 700000 + packIndex * 7919 }).questions.forEach(question => assertQuestion(question, lineId, stageIndex));
}

const expressionPacks = [
  core.makeStageQuestions('solve', 6, { seed: 551 }),
  core.makeStageQuestions('solve', 8, { seed: 552 })
];
expressionPacks.flatMap(pack => pack.questions).forEach(question => {
  assert(values(question).every(value => /[＋−]/.test(value)), '式の選択肢に裸の数値が混ざっています');
});

const equalGroups = core.makeStageQuestions('solve', 9, { seed: 8800 }).questions;
assert(equalGroups.every(question => question.kind === 'grouping'), '等分問題が操作ルーレットへ戻っています');
assert(equalGroups.every(question => !String(question.instruction).includes(String(question.correct))), '等分問題の説明に答えがあります');

assert(appSource.includes('data-select-answer'), '通常モードで選択と確定が分かれていません');
assert(appSource.includes("action === 'submit-choice'"), '選択式の「けってい」処理がありません');
assert(appSource.includes("question.attempts >= 2"), '二回目の誤答で支援が進みません');
assert(appSource.includes("kind: 'teach'"), '正解説明へ進む段階支援がありません');
assert(appSource.includes("question.kind === 'numberline'"), '歩ける数直線UIがありません');
assert(appSource.includes("question.kind === 'grouping'"), '等分を試すUIがありません');
assert(appSource.includes("slice(activeCourseId === 'g1' ? -96"), '通常ステージの直近32問分を保持していません');
assert(appSource.includes("slice(activeCourseId === 'g1' ? -108"), 'タイムアタックの直近36問分を保持していません');
assert(/\.answer-button\.selected/.test(cssSource), '選択中の答えが見分けられません');
assert(/\.play-number-line/.test(cssSource), '操作できる数直線の見た目がありません');
assert(/\.groups-builder/.test(cssSource), '等分盤面の見た目がありません');

console.log('grade 1 question contract smoke: 66 contracts / fixed center action / 8-question arc / seeded rng / misconception choices / hint ladder / confirm grammar / 1000+ invariants OK');
