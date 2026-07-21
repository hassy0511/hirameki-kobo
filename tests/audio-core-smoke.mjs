import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../audio-core.js', import.meta.url), 'utf8');
new vm.Script(source, { filename: 'audio-core.js' });

const sandbox = { console, Promise, Number, Object, Array, Set, Math };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
new vm.Script(source, { filename: 'audio-core.js' }).runInContext(sandbox);
const audio = sandbox.HiramekiAudio;

assert(audio && typeof audio.create === 'function', 'HiramekiAudio.create が公開されていません');
assert(audio.DEFAULT_BGM_VOLUME >= 0.65 && audio.DEFAULT_BGM_VOLUME <= 0.8, 'BGM初期音量が聞き取りやすい範囲ではありません');
assert(audio.MAX_BGM_GAIN >= 0.25 && audio.MAX_BGM_GAIN <= 0.35, 'BGM最大GainがiPadで聞き取れる実用範囲ではありません');
assert(audio.MAX_BGM_GAIN * audio.DEFAULT_BGM_VOLUME * 0.34 >= 0.06, 'BGM初期音量が実質無音になる水準です');

class FakeAudioParam {
  constructor(value = 0) {
    this.value = value;
    this.events = [];
  }

  cancelScheduledValues(at) { this.events.push(['cancel', at]); }
  setValueAtTime(value, at) { this.value = value; this.events.push(['set', value, at]); }
  setTargetAtTime(value, at, constant) { this.value = value; this.events.push(['target', value, at, constant]); }
  linearRampToValueAtTime(value, at) { this.value = value; this.events.push(['linear', value, at]); }
  exponentialRampToValueAtTime(value, at) { this.value = value; this.events.push(['exponential', value, at]); }
}

class FakeNode {
  constructor() {
    this.connections = [];
    this.disconnected = false;
  }

  connect(node) { this.connections.push(node); return node; }
  disconnect() { this.disconnected = true; }
}

class FakeGain extends FakeNode {
  constructor() {
    super();
    this.gain = new FakeAudioParam(1);
  }
}

class FakeOscillator extends FakeNode {
  constructor(context) {
    super();
    this.context = context;
    this.frequency = new FakeAudioParam(440);
    this.type = 'sine';
    this.startedAt = null;
    this.stoppedAt = null;
    this.onended = null;
  }

  start(at) { this.startedAt = at; }
  stop(at) {
    this.stoppedAt = at;
    if (at === 0 && this.onended) this.onended();
  }
}

class FakeFilter extends FakeNode {
  constructor() {
    super();
    this.type = '';
    this.frequency = new FakeAudioParam();
    this.Q = new FakeAudioParam();
  }
}

class FakeAudioContext {
  static instances = [];

  constructor() {
    this.state = 'suspended';
    this.currentTime = 0;
    this.destination = new FakeNode();
    this.gains = [];
    this.oscillators = [];
    this.resumeCalls = 0;
    this.suspendCalls = 0;
    this.closeCalls = 0;
    FakeAudioContext.instances.push(this);
  }

  createGain() { const gain = new FakeGain(); this.gains.push(gain); return gain; }
  createOscillator() { const oscillator = new FakeOscillator(this); this.oscillators.push(oscillator); return oscillator; }
  createBiquadFilter() { return new FakeFilter(); }
  resume() { this.resumeCalls += 1; this.state = 'running'; return Promise.resolve(); }
  suspend() { this.suspendCalls += 1; this.state = 'suspended'; return Promise.resolve(); }
  close() { this.closeCalls += 1; this.state = 'closed'; return Promise.resolve(); }
}

function createFakeTimers() {
  let id = 0;
  const callbacks = new Map();
  return {
    setInterval(callback) { id += 1; callbacks.set(id, callback); return id; },
    clearInterval(timerId) { callbacks.delete(timerId); },
    run() { Array.from(callbacks.values()).forEach(callback => callback()); },
    size() { return callbacks.size; }
  };
}

const unsupported = audio.create({ AudioContext: null });
assert.equal(unsupported.snapshot().supported, false, 'AudioContext非対応判定が不正です');
unsupported.configure({ master: true, bgm: true, visible: true });
assert.equal(await unsupported.unlock(), false, '非対応環境でunlock成功扱いにしてはいけません');
assert.equal(await unsupported.playTone('good'), false, '非対応環境で効果音成功扱いにしてはいけません');
assert.equal(await unsupported.destroy(), true, '非対応環境でも安全に破棄できる必要があります');

FakeAudioContext.instances.length = 0;
const timers = createFakeTimers();
const manager = audio.create({
  AudioContext: FakeAudioContext,
  setInterval: timers.setInterval,
  clearInterval: timers.clearInterval
});

manager.configure({ master: true, bgm: true, bgmVolume: audio.DEFAULT_BGM_VOLUME, mode: 'workshop', visible: true });
assert.equal(FakeAudioContext.instances.length, 0, 'configureだけでAudioContextを生成してはいけません');
assert.equal(manager.snapshot().contextState, 'uninitialized', '初回操作前は未初期化である必要があります');

assert.equal(await manager.unlock(), true, 'ユーザー操作後のunlockに失敗しました');
assert.equal(FakeAudioContext.instances.length, 1, 'AudioContextは一度だけ生成する必要があります');
const context = FakeAudioContext.instances[0];
assert.equal(context.resumeCalls, 1, 'suspendedなAudioContextをresumeしていません');
assert.equal(manager.snapshot().schedulerRunning, true, 'unlock後にBGMスケジューラーが始まりません');
assert.equal(timers.size(), 1, 'BGMスケジューラーが一つではありません');
assert(context.oscillators.length > 0, '手続きBGMの音がスケジュールされていません');
assert.equal(manager.snapshot().musicData, 'synth-loop-v2', '実際のBGMデータ識別子がありません');

const beforePreview = context.oscillators.length;
assert.equal(await manager.previewBgm(), true, 'BGM試聴が再生できません');
assert.equal(context.oscillators.length, beforePreview + 4, 'BGM試聴は聞き取りやすい4音である必要があります');

await manager.unlock();
manager.configure({ mode: 'workshop' });
assert.equal(FakeAudioContext.instances.length, 1, '再unlockでAudioContextが重複しました');
assert.equal(timers.size(), 1, '再configureでBGMループが重複しました');

const beforeGood = context.oscillators.length;
assert.equal(await manager.playTone('good'), true, '正解効果音を再生できません');
assert.equal(context.oscillators.length, beforeGood + 3, '正解効果音は3音必要です');
const musicBus = context.gains[2];
const duckTargets = musicBus.gain.events.filter(event => event[0] === 'target').map(event => event[1]);
assert(duckTargets.some(value => value > 0 && value < audio.MAX_BGM_GAIN * audio.DEFAULT_BGM_VOLUME), '効果音時にBGMがダッキングされません');

manager.configure({ bgmVolume: 99 });
assert.equal(manager.snapshot().bgmVolume, 1, 'BGM音量の上限がクランプされません');
manager.configure({ bgmVolume: -2 });
assert.equal(manager.snapshot().bgmVolume, 0, 'BGM音量の下限がクランプされません');
assert.equal(manager.snapshot().schedulerRunning, false, 'BGM音量0でもスケジューラーが動いています');
assert.equal(timers.size(), 0, 'BGM音量0でタイマーが残っています');
manager.configure({ bgmVolume: 'invalid' });
assert.equal(manager.snapshot().bgmVolume, audio.DEFAULT_BGM_VOLUME, '不正なBGM音量を既定値へ戻していません');

manager.configure({ bgm: false });
assert.equal(manager.snapshot().schedulerRunning, false, 'BGMオフでスケジューラーが止まりません');
assert.equal(timers.size(), 0, 'BGMオフ後にタイマーが残っています');
const beforeTapWithoutMusic = context.oscillators.length;
assert.equal(await manager.playTone('tap'), true, 'BGMオフでも効果音は必要です');
assert.equal(context.oscillators.length, beforeTapWithoutMusic + 1, 'BGMオフ時の効果音数が不正です');

manager.configure({ master: false, bgm: true });
const beforeMutedTone = context.oscillators.length;
assert.equal(await manager.playTone('finish'), false, '親スイッチオフ時に効果音を鳴らしてはいけません');
assert.equal(context.oscillators.length, beforeMutedTone, '親スイッチオフ時に発音ノードを作っています');

manager.configure({ master: true, bgm: true, bgmVolume: audio.DEFAULT_BGM_VOLUME, mode: 'workshop' });
assert.equal(manager.snapshot().schedulerRunning, true, 'BGM再オンでスケジューラーが復帰しません');
manager.configure({ mode: 'rush' });
assert.equal(manager.snapshot().schedulerRunning, false, 'タイムアタック中はBGMを停止する必要があります');
const beforeRushTone = context.oscillators.length;
assert.equal(await manager.playTone('hint'), true, 'タイムアタック中も効果音は必要です');
assert.equal(context.oscillators.length, beforeRushTone + 2, 'タイムアタック中のヒント音が不正です');
timers.run();
assert.equal(timers.size(), 0, 'タイムアタック中にBGMタイマーが再生成されました');

manager.configure({ mode: 'workshop' });
assert.equal(manager.snapshot().schedulerRunning, true, 'タイムアタック終了後にBGMが戻りません');
assert.equal(await manager.setVisible(false), true, '非表示時の停止に失敗しました');
assert.equal(context.suspendCalls, 1, '非表示時にAudioContextをsuspendしていません');
assert.equal(manager.snapshot().schedulerRunning, false, '非表示時にBGMが動いています');
assert.equal(await manager.playTone('tap'), false, '非表示時に効果音を鳴らしてはいけません');

assert.equal(await manager.setVisible(true), true, '表示復帰時のresumeに失敗しました');
assert.equal(context.resumeCalls, 2, '表示復帰時にAudioContextをresumeしていません');
assert.equal(manager.snapshot().schedulerRunning, true, '表示復帰時にBGMが戻りません');
assert.equal(timers.size(), 1, '表示復帰でBGMループが重複しました');

assert.equal(await manager.destroy(), true, '音声管理を破棄できません');
assert.equal(context.closeCalls, 1, 'destroy時にAudioContextをcloseしていません');
assert.equal(timers.size(), 0, 'destroy後にタイマーが残っています');
assert.equal(manager.snapshot().destroyed, true, 'destroy状態が公開されません');
assert.equal(await manager.unlock(), false, 'destroy後に再unlockしてはいけません');
assert.equal(await manager.playTone('good'), false, 'destroy後に効果音を鳴らしてはいけません');

console.log('audio-core smoke test: delayed unlock / procedural BGM / SFX duck / master and BGM toggles / rush silence / visibility suspend-resume / destroy / unsupported fallback OK');
