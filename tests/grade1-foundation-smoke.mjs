import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const rootUrl = new URL('../', import.meta.url);
const coreSource = fs.readFileSync(new URL('game-core.js', rootUrl), 'utf8');
const grade1RuntimeSource = fs.readFileSync(new URL('grade1-runtime.js', rootUrl), 'utf8');
const appSource = fs.readFileSync(new URL('app.js', rootUrl), 'utf8');
const audioSource = fs.readFileSync(new URL('audio-core.js', rootUrl), 'utf8');
const indexSource = fs.readFileSync(new URL('index.html', rootUrl), 'utf8');
const swSource = fs.readFileSync(new URL('sw.js', rootUrl), 'utf8');

for (const [name, source] of [['game-core.js', coreSource], ['grade1-runtime.js', grade1RuntimeSource], ['app.js', appSource], ['audio-core.js', audioSource]]) {
  new vm.Script(source, { filename: name });
}

const sandbox = { console };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
new vm.Script(coreSource, { filename: 'game-core.js' }).runInContext(sandbox);
new vm.Script(grade1RuntimeSource, { filename: 'grade1-runtime.js' }).runInContext(sandbox);
const core = sandbox.HiramekiCore;

const firstStage = core.LINES.number.stages[0];
assert.equal(firstStage.canonicalSkillId, 'g1.number.to5.intro', '最初のステージが数の学習ではありません');
assert.equal(firstStage.name, '1から5まで', '最初のステージ名が子どもに目的を伝えていません');
assert(!/分類|仕分け|なかま分け/.test(firstStage.skill + firstStage.action), '最初のステージに算数ではない分類課題が残っています');

function visibleFingerprint(question) {
  return JSON.stringify({
    kind: question.kind,
    prompt: question.prompt,
    instruction: question.instruction,
    correct: question.correct,
    visual: question.visual
  });
}

for (const seed of [101, 202, 303, 404, 505, 606]) {
  const questions = core.makeStageQuestions('number', 0, { seed }).questions;
  assert.equal(questions.length, 8, '最初のステージは8問必要です');
  assert.equal(new Set(questions.map(visibleFingerprint)).size, 8, '子どもから見て同じ問題が繰り返されています');
  assert.deepEqual(Array.from(questions, question => question.arcRole), Array.from(core.G1_ARC), '8問の学習アークがありません');
  questions.forEach((question, index) => {
    assert.equal(question.kind, 'choice', '同じ課題なのに入力方法が入れ替わっています');
    assert(/まる/.test(question.prompt), '数だけを見る問題に別の物体が混ざっています');
    assert(!/分類|仕分け|トレイ|ギア|回路|部品/.test(question.prompt + question.instruction), '最初のステージに不要な世界観用語があります');
    if (index > 0) assert.equal(question.interactionFamily, questions[index - 1].interactionFamily, '同じ課題の中心操作が途中で変わっています');
    if (question.visual.type === 'objects') assert.equal(question.visual.icon, 'count-dot', '数える対象が毎回変わっています');
    if (question.visual.type === 'selector') assert(question.visual.icons.every(icon => icon === 'count-dot'), 'タップ対象に視覚ノイズがあります');
  });
}

const forbiddenTaskWords = /ギア|回路|配線|コンベア|カウンター|メーター|トレイ|スキャナー|モニター|セレクター|部品|装置|工房|修理|親方|設計図|復旧|車両|レール|点灯|駅|ライト|ミッション|エネルギー/;
for (const lineId of core.LINE_ORDER) {
  const line = core.LINES[lineId];
  line.stages.forEach(stage => {
    assert(!forbiddenTaskWords.test(stage.name + ' ' + stage.action), lineId + '/' + stage.id + ': ステージ案内に工房用語が残っています');
  });
  for (let stageIndex = 0; stageIndex < line.stages.length; stageIndex += 1) {
    const questions = core.makeStageQuestions(lineId, stageIndex, { seed: 7000 + stageIndex * 31 }).questions;
    assert.equal(new Set(questions.map(core.questionContentSignature)).size, questions.length, lineId + '/' + line.stages[stageIndex].id + ': 同じ内容が1回のステージ内で繰り返されています');
    const recent = questions.flatMap(question => [question.signature, question.contentSignature]);
    const nextQuestions = core.makeStageQuestions(lineId, stageIndex, { seed: 9000 + stageIndex * 47, exclude: recent }).questions;
    const previousContent = new Set(questions.map(question => question.contentSignature));
    assert(nextQuestions.every(question => !previousContent.has(question.contentSignature)), lineId + '/' + line.stages[stageIndex].id + ': つづけて遊んだときに直前と同じ内容が出ています');
    questions.forEach(question => {
      const childText = [question.prompt, question.instruction, question.hint, question.explain].join(' ');
      assert(!forbiddenTaskWords.test(childText), lineId + '/' + question.stageId + ': 問題文に工房用語が残っています: ' + childText);
    });
  }
}

assert(appSource.includes("gradeOne ? 'ひらめきこうぼう'"), '一年生ヘッダーがやさしい表記へ切り替わりません');
assert(appSource.includes("gradeOne ? 'ステージ' : '設計図'"), '一年生ヘッダーに難しい「設計図」が表示されます');
assert(appSource.includes("gradeOne ? 'ルミナの げんき' : 'ルミナ復旧パネル'"), 'ルミナ表示が一年生向けの言葉ではありません');
assert(appSource.includes('state.settings.adminUnlockG1'), '管理者用の全ステージ解放モードがありません');
assert(appSource.includes('data-action="toggle-admin-unlock"'), '管理者モードを切り替えるUIがありません');
assert(appSource.includes('data-action="test-bgm"'), 'BGMを実際に試聴するUIがありません');
assert(appSource.includes("question.visual.type === 'sticks'"), '棒の問題が「まるをタップ」という誤った操作表示になります');
assert(appSource.includes("childText(question.prompt)"), '一年生の問題文が読みやすい表記へ変換されません');
assert(appSource.includes("childText(question.instruction)"), '一年生の操作案内が読みやすい表記へ変換されません');
assert(!appSource.includes('ギアを まわす'), '数を変える操作に「ギア」が残っています');

const audioSandbox = { console, Promise, Number, Object, Array, Set, Math };
audioSandbox.globalThis = audioSandbox;
vm.createContext(audioSandbox);
new vm.Script(audioSource, { filename: 'audio-core.js' }).runInContext(audioSandbox);
const audio = audioSandbox.HiramekiAudio;
assert(audio.DEFAULT_BGM_VOLUME >= 0.65, 'BGM初期音量が小さすぎます');
assert(audio.MAX_BGM_GAIN >= 0.25, 'BGM出力が小さすぎます');
assert(audioSource.includes('previewBgm'), 'BGMの試聴機能がありません');
assert(audioSource.includes("musicData: 'synth-loop-v2'"), '実際の音楽データを識別できません');
assert(indexSource.includes('styles.css?v=11') && indexSource.includes('app.js?v=11') && indexSource.includes('grade1-runtime.js?v=11'), 'iPadが旧CSS・JavaScriptを再利用しない版番号がありません');
assert(swSource.includes('./styles.css?v=11') && swSource.includes('./app.js?v=11') && swSource.includes('./grade1-runtime.js?v=11'), 'オフラインキャッシュに版番号付きファイルがありません');

console.log('grade 1 foundation smoke: math-first opening / neutral counters / visible diversity / plain task language / admin unlock / audible BGM preview OK');
