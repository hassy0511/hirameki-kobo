import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const rootUrl = new URL('../', import.meta.url);
const runtimeFiles = [
  'game-core.js',
  'grade2-curriculum.js',
  'grade2-runtime-arithmetic.js',
  'grade2-runtime-world.js',
  'course-core.js'
];
const sandbox = { console };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
for (const filename of runtimeFiles) {
  const source = fs.readFileSync(new URL(filename, rootUrl), 'utf8');
  new vm.Script(source, { filename }).runInContext(sandbox);
}

const core = sandbox.HiramekiCore;
const courses = sandbox.HiramekiCourses;
const appSource = fs.readFileSync(new URL('app.js', rootUrl), 'utf8');
const css = fs.readFileSync(new URL('styles.css', rootUrl), 'utf8');

const horizontalContract = core.semanticOptionContract(['ひだり', 'おなじ', 'みぎ']);
const verticalContract = core.semanticOptionContract(['上', '真ん中', '下']);
const relationContract = core.semanticOptionContract(['＜', '＝', '＞']);
const horizontalPairContract = core.semanticOptionContract(['みぎ', 'ひだり']);
const verticalPairContract = core.semanticOptionContract(['下', '上']);
const depthPairContract = core.semanticOptionContract(['後ろ', '前']);
assert.equal(horizontalContract.policy + ':' + horizontalContract.layout, 'fixed:horizontal-axis', '左右の選択肢を固定配置として認識できません');
assert.equal(verticalContract.policy + ':' + verticalContract.layout, 'fixed:vertical-axis', '上下の選択肢を固定配置として認識できません');
assert.equal(relationContract.policy + ':' + relationContract.layout, 'fixed:relation', '比較記号を固定配置として認識できません');
assert.deepEqual(Array.from(horizontalPairContract.order), ['ひだり', 'みぎ'], '左右2択を正規順へ戻せません');
assert.deepEqual(Array.from(verticalPairContract.order), ['上', '下'], '上下2択を正規順へ戻せません');
assert.deepEqual(Array.from(depthPairContract.order), ['前', '後ろ'], '前後2択を正規順へ戻せません');

function optionValues(question) {
  return Array.from(question.options || [], option => String(core.optionValue(option)));
}

function visibleFingerprint(question) {
  return JSON.stringify({ prompt: question.prompt, correct: question.correct, visual: question.visual });
}

for (const stageIndex of [0, 1, 5, 6]) {
  for (const seed of [101, 202, 303, 404]) {
    const pack = core.makeStageQuestions('measure', stageIndex, { seed: seed + stageIndex * 1000 });
    assert.equal(new Set(pack.questions.map(visibleFingerprint)).size, 8, '計測stage ' + (stageIndex + 1) + ': 見た目と内容が同じ問題を含みます');
    assert(pack.questions.every(question => question.templateId), '計測stage ' + (stageIndex + 1) + ': templateIdがありません');
    for (let index = 1; index < pack.questions.length; index += 1) {
      assert.notEqual(pack.questions[index].templateId, pack.questions[index - 1].templateId, '計測stage ' + (stageIndex + 1) + ': 同じ問題型が連続しています');
    }
    pack.questions.forEach(question => {
      const values = optionValues(question);
      if (values.join('|') === 'ひだり|おなじ|みぎ') {
        assert.equal(question.optionPolicy, 'fixed', '左右問題が固定配置ではありません');
        assert.equal(question.optionLayout, 'horizontal-axis', '左右問題の表示軸が不正です');
      }
    });
  }
}

for (const stageIndex of [0, 1]) {
  const pack = core.makeStageQuestions('measure', stageIndex, { seed: 7100 + stageIndex });
  assert(pack.questions.every(question => question.visual.type === 'length-position-compare'), '長さ問題が左右専用表示を使っていません');
  assert(pack.questions.every(question => Number.isFinite(question.visual.left) && Number.isFinite(question.visual.right)), '長さ問題の左右データが不足しています');
  assert(new Set(pack.questions.map(question => question.templateId)).size >= 4, '長さ問題の問題型が不足しています');
}

const unitPack = core.makeStageQuestions('measure', 2, { seed: 8200 });
assert.deepEqual(new Set(unitPack.questions.map(question => question.templateId)), new Set(['measure.unit.build', 'measure.unit.count', 'measure.unit.counter']), 'ブロック長さ問題の操作バリエーションが不足しています');
const unitBuilders = unitPack.questions.filter(question => question.visual.type === 'unit-length-builder');
assert(unitBuilders.length > 0, 'ブロックを並べる専用問題がありません');
unitBuilders.forEach(question => {
  assert.equal(question.correct, question.visual.targetUnits, '棒の長さと正解ブロック数が一致しません');
  assert(/右はし/.test(question.instruction) && /タップ/.test(question.instruction) && /けってい/.test(question.instruction), 'ブロック問題の操作説明が実操作と一致しません');
});

const methodPack = core.makeStageQuestions('measure', 3, { seed: 9300 });
assert.equal(new Set(methodPack.questions.map(question => question.visual.sceneId)).size, 3, '比べ方セレクターの三場面が揃いません');
methodPack.questions.forEach(question => {
  assert.equal(question.visual.type, 'measure-method', '比べ方セレクターが場面専用表示を使っていません');
  assert(/どうやって|どうする/.test(question.prompt), '何を答える問題か明記されていません');
  assert(optionValues(question).every(value => ['direct', 'transfer', 'unit'].includes(value)), '比べ方の正解値が安定IDではありません');
  assert(question.options.every(option => option.label.length >= 12 && option.icon), '比べ方の選択肢に操作説明または絵がありません');
});

const signatureBase = {
  canonicalSkillId: 'ux.signature.test', kind: 'choice', prompt: 'どちら？', instruction: 'えらぼう',
  correct: 'ひだり', options: ['ひだり', 'みぎ'], visual: { type: 'length-position-compare', left: 8, right: 4 }
};
const signatureChanged = Object.assign({}, signatureBase, { visual: { type: 'length-position-compare', left: 4, right: 8 } });
assert.notEqual(core.questionSignature(signatureBase), core.questionSignature(signatureChanged), '見た目が違う長さ問題のsignatureが同じです');

for (const seed of [1111, 2222, 3333]) {
  const questions = courses.makeStageQuestions('g2', 'number', 5, { seed }).questions;
  questions.filter(question => optionValues(question).every(value => ['＜', '＝', '＞'].includes(value))).forEach(question => {
    assert.deepEqual(optionValues(question), ['＜', '＝', '＞'], 'G2比較記号が正規順ではありません');
    assert.equal(question.optionPolicy, 'fixed', 'G2比較記号が固定配置ではありません');
    assert.equal(question.optionLayout, 'relation', 'G2比較記号のレイアウトが不正です');
  });
}

const migratedMuted = core.migrateState({ version: 2, settings: { sound: false, motion: true } });
assert.equal(migratedMuted.settings.bgm, false, '旧版で音を消した利用者へBGMを突然有効化しています');
assert.equal(courses.mergeSettings({ sound: false }).bgm, false, '統合stateで旧音設定を尊重していません');
assert.equal(courses.mergeSettings({ bgmVolume: 9 }).bgmVolume, 1, 'BGM音量上限を補正していません');

assert(appSource.indexOf("visual.type === 'unit-length-builder'") < appSource.indexOf("question.kind === 'tap' || question.kind === 'remove'"), 'ブロック専用表示が汎用タップ表示より後です');
assert(/data-length-side=\\?"left\\?"/.test(appSource) && /data-length-side=\\?"right\\?"/.test(appSource), '長さ表示に左右のDOM契約がありません');
assert(/\.length-position-pair\s*\{[\s\S]*grid-template-columns:\s*repeat\(2/.test(css), '長さ表示が左右2列ではありません');
assert(/\.answers--horizontal-axis[\s\S]*grid-template-columns:\s*repeat\(3/.test(css), '左右選択肢が狭幅でも3列固定になりません');
const narrowCss = css.slice(css.indexOf('@media (max-width: 760px)'));
assert(/\.answers--horizontal-axis,[\s\S]*\.answers--relation\s*\{[\s\S]*grid-template-columns:\s*repeat\(3/.test(narrowCss), '狭幅で位置・比較記号の配置が崩れます');
assert(/\.answers--horizontal-axis\.answers--count-2\s*\{[\s\S]*grid-template-columns:\s*repeat\(2/.test(narrowCss), '狭幅で左右2択が左右配置になりません');
assert(/\.unit-measure-grid/.test(css) && /\.measure-method-scene/.test(css), '長さ専用UIのCSSが不足しています');
assert(appSource.includes('aria-label="BGM ') && appSource.includes('aria-label="おと（ぜんぶ） '), '音設定トグルのアクセシブル名が不足しています');
assert(appSource.includes('render(\'[data-action="toggle-bgm"]\')'), 'BGM切替後に操作元へフォーカスが戻りません');

console.log('question UX contract smoke: left/right visual axis / fixed semantic options / unit-length instructions / method scenes / visible diversity / BGM migration OK');
