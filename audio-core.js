(function (global) {
  'use strict';

  const DEFAULT_BGM_VOLUME = 0.35;
  const MAX_BGM_GAIN = 0.1;
  const TEMPO = 80;
  const STEP_SECONDS = 60 / TEMPO;
  const LOOK_AHEAD_SECONDS = 0.35;
  const SCHEDULER_INTERVAL_MS = 100;
  const DUCK_RATIO = 0.4;

  // A deliberately sparse C-major pentatonic phrase. Rests and the long loop
  // keep it in the background while a child reads or thinks.
  const MELODY = Object.freeze([
    329.63, null, 392.00, null, 440.00, null, 392.00, null,
    293.66, null, 329.63, 392.00, null, null, 261.63, null,
    329.63, null, 440.00, null, 523.25, null, 440.00, null,
    392.00, null, 329.63, null, 293.66, null, 261.63, null
  ]);
  const BASS = Object.freeze([130.81, 110.00, 146.83, 98.00]);
  const TONES = Object.freeze({
    tap: Object.freeze([440]),
    good: Object.freeze([523, 659, 784]),
    hint: Object.freeze([330, 294]),
    finish: Object.freeze([523, 659, 784, 1047])
  });

  function clamp(value, min, max) {
    const number = Number(value);
    if (!Number.isFinite(number)) return min;
    return Math.max(min, Math.min(max, number));
  }

  function create(options) {
    const opts = options || {};
    const hasAudioOverride = Object.prototype.hasOwnProperty.call(opts, 'AudioContext');
    const Audio = hasAudioOverride ? opts.AudioContext : (global.AudioContext || global.webkitAudioContext || null);
    const setIntervalFn = opts.setInterval || global.setInterval;
    const clearIntervalFn = opts.clearInterval || global.clearInterval;

    let config = {
      master: true,
      bgm: true,
      bgmVolume: DEFAULT_BGM_VOLUME,
      mode: 'workshop',
      visible: true
    };
    let context = null;
    let masterGain = null;
    let sfxGain = null;
    let musicGain = null;
    let musicInput = null;
    let schedulerId = null;
    let nextStepTime = 0;
    let stepIndex = 0;
    let everUnlocked = false;
    let unlockPromise = null;
    let visibilityPromise = Promise.resolve(false);
    let destroyed = false;
    const musicVoices = new Set();
    const sfxVoices = new Set();

    function contextRunning() {
      return Boolean(context && (!context.state || context.state === 'running'));
    }

    function setParam(param, value, at, timeConstant) {
      if (!param) return;
      const target = Number(value);
      try {
        if (typeof param.cancelScheduledValues === 'function') param.cancelScheduledValues(at);
        if (typeof param.setTargetAtTime === 'function') {
          param.setTargetAtTime(target, at, timeConstant || 0.025);
        } else if (typeof param.setValueAtTime === 'function') {
          param.setValueAtTime(target, at);
        } else {
          param.value = target;
        }
      } catch (error) {
        try { param.value = target; } catch (ignored) {}
      }
    }

    function envelope(param, when, duration, peak) {
      if (!param) return;
      const start = Math.max(0, Number(when) || 0);
      const length = Math.max(0.06, Number(duration) || 0.1);
      try {
        if (typeof param.cancelScheduledValues === 'function') param.cancelScheduledValues(start);
        if (typeof param.setValueAtTime === 'function') param.setValueAtTime(0.0001, start);
        if (typeof param.linearRampToValueAtTime === 'function') {
          param.linearRampToValueAtTime(peak, start + Math.min(0.08, length * 0.25));
        } else if (typeof param.setValueAtTime === 'function') {
          param.setValueAtTime(peak, start + Math.min(0.08, length * 0.25));
        } else {
          param.value = peak;
        }
        if (typeof param.exponentialRampToValueAtTime === 'function') {
          param.exponentialRampToValueAtTime(0.0001, start + length);
        } else if (typeof param.linearRampToValueAtTime === 'function') {
          param.linearRampToValueAtTime(0, start + length);
        }
      } catch (error) {
        try { param.value = 0; } catch (ignored) {}
      }
    }

    function ensureGraph() {
      if (context || destroyed || !Audio) return Boolean(context);
      try {
        context = new Audio();
        masterGain = context.createGain();
        sfxGain = context.createGain();
        musicGain = context.createGain();
        masterGain.gain.value = 0;
        sfxGain.gain.value = 1;
        musicGain.gain.value = 0;
        sfxGain.connect(masterGain);
        musicGain.connect(masterGain);
        masterGain.connect(context.destination);
        musicInput = musicGain;
        if (typeof context.createBiquadFilter === 'function') {
          const filter = context.createBiquadFilter();
          filter.type = 'lowpass';
          if (filter.frequency) filter.frequency.value = 1800;
          if (filter.Q) filter.Q.value = 0.2;
          filter.connect(musicGain);
          musicInput = filter;
        }
        return true;
      } catch (error) {
        context = null;
        masterGain = null;
        sfxGain = null;
        musicGain = null;
        musicInput = null;
        return false;
      }
    }

    function removeVoice(collection, voice) {
      collection.delete(voice);
      try { voice.oscillator.disconnect(); } catch (ignored) {}
      try { voice.gain.disconnect(); } catch (ignored) {}
    }

    function stopVoices(collection) {
      Array.from(collection).forEach(function (voice) {
        try { voice.oscillator.stop(0); } catch (ignored) {}
        removeVoice(collection, voice);
      });
    }

    function scheduleVoice(frequency, when, duration, peak, type, destination, collection) {
      if (!contextRunning() || !destination) return false;
      try {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const voice = { oscillator: oscillator, gain: gain };
        oscillator.type = type || 'sine';
        if (oscillator.frequency && typeof oscillator.frequency.setValueAtTime === 'function') {
          oscillator.frequency.setValueAtTime(frequency, when);
        } else if (oscillator.frequency) {
          oscillator.frequency.value = frequency;
        }
        envelope(gain.gain, when, duration, peak);
        oscillator.connect(gain);
        gain.connect(destination);
        collection.add(voice);
        oscillator.onended = function () { removeVoice(collection, voice); };
        oscillator.start(when);
        oscillator.stop(when + duration + 0.05);
        return true;
      } catch (error) {
        return false;
      }
    }

    function musicAllowed() {
      return Boolean(
        !destroyed && config.master && config.bgm && config.visible &&
        config.bgmVolume > 0 &&
        config.mode !== 'rush' && config.mode !== 'silent' && config.mode !== 'off' &&
        contextRunning()
      );
    }

    function musicLevel() {
      return MAX_BGM_GAIN * clamp(config.bgmVolume, 0, 1);
    }

    function scheduleMusicStep(when, index) {
      const melodyFrequency = MELODY[index % MELODY.length];
      if (melodyFrequency) {
        scheduleVoice(melodyFrequency, when, STEP_SECONDS * 0.72, 0.34, 'triangle', musicInput, musicVoices);
      }
      if (index % 8 === 0) {
        const bassFrequency = BASS[Math.floor(index / 8) % BASS.length];
        scheduleVoice(bassFrequency, when, STEP_SECONDS * 3.5, 0.16, 'sine', musicInput, musicVoices);
      }
    }

    function schedulerTick() {
      if (!musicAllowed()) return;
      const now = Number(context.currentTime || 0);
      if (!nextStepTime || nextStepTime < now - STEP_SECONDS) nextStepTime = now + 0.05;
      let safety = 0;
      while (nextStepTime < now + LOOK_AHEAD_SECONDS && safety < 8) {
        scheduleMusicStep(nextStepTime, stepIndex);
        stepIndex = (stepIndex + 1) % MELODY.length;
        nextStepTime += STEP_SECONDS;
        safety += 1;
      }
    }

    function startMusic() {
      if (!musicAllowed() || schedulerId != null || typeof setIntervalFn !== 'function') return;
      nextStepTime = Number(context.currentTime || 0) + 0.05;
      schedulerTick();
      schedulerId = setIntervalFn(schedulerTick, SCHEDULER_INTERVAL_MS);
    }

    function stopMusic(resetPhrase) {
      if (schedulerId != null && typeof clearIntervalFn === 'function') clearIntervalFn(schedulerId);
      schedulerId = null;
      nextStepTime = 0;
      if (resetPhrase) stepIndex = 0;
      stopVoices(musicVoices);
    }

    function applyConfig() {
      if (!context || destroyed) return;
      const now = Number(context.currentTime || 0);
      const masterOn = Boolean(config.master && config.visible && contextRunning());
      setParam(masterGain && masterGain.gain, masterOn ? 1 : 0, now, 0.02);
      if (musicAllowed()) {
        setParam(musicGain && musicGain.gain, musicLevel(), now, 0.08);
        startMusic();
      } else {
        setParam(musicGain && musicGain.gain, 0, now, 0.04);
        stopMusic(true);
      }
      if (!masterOn) stopVoices(sfxVoices);
    }

    function snapshot() {
      return {
        supported: Boolean(Audio),
        unlocked: everUnlocked,
        contextState: context ? (context.state || 'running') : 'uninitialized',
        schedulerRunning: schedulerId != null,
        master: config.master,
        bgm: config.bgm,
        bgmVolume: config.bgmVolume,
        mode: config.mode,
        visible: config.visible,
        destroyed: destroyed
      };
    }

    function unlock() {
      if (destroyed || !config.visible || !ensureGraph()) return Promise.resolve(false);
      if (contextRunning()) {
        everUnlocked = true;
        applyConfig();
        return Promise.resolve(true);
      }
      if (unlockPromise) return unlockPromise;
      let resumed;
      try {
        resumed = typeof context.resume === 'function' ? context.resume() : null;
      } catch (error) {
        return Promise.resolve(false);
      }
      unlockPromise = Promise.resolve(resumed).then(function () {
        const running = contextRunning();
        if (running) {
          everUnlocked = true;
          applyConfig();
        }
        unlockPromise = null;
        return running;
      }, function () {
        unlockPromise = null;
        return false;
      });
      return unlockPromise;
    }

    function configure(next) {
      if (destroyed || !next || typeof next !== 'object') return snapshot();
      const oldVisible = config.visible;
      if (Object.prototype.hasOwnProperty.call(next, 'master')) config.master = Boolean(next.master);
      if (Object.prototype.hasOwnProperty.call(next, 'sound')) config.master = Boolean(next.sound);
      if (Object.prototype.hasOwnProperty.call(next, 'bgm')) config.bgm = Boolean(next.bgm);
      if (Object.prototype.hasOwnProperty.call(next, 'bgmVolume')) {
        const volume = Number(next.bgmVolume);
        config.bgmVolume = Number.isFinite(volume) ? clamp(volume, 0, 1) : DEFAULT_BGM_VOLUME;
      }
      if (Object.prototype.hasOwnProperty.call(next, 'mode')) config.mode = String(next.mode || 'workshop');
      if (Object.prototype.hasOwnProperty.call(next, 'visible')) config.visible = Boolean(next.visible);
      if (oldVisible !== config.visible) {
        setVisible(config.visible);
      } else {
        applyConfig();
      }
      return snapshot();
    }

    function duckMusic(kind) {
      if (!musicAllowed() || !musicGain) return;
      const now = Number(context.currentTime || 0);
      const duration = kind === 'finish' ? 0.55 : kind === 'good' ? 0.38 : 0.28;
      const target = musicLevel();
      const param = musicGain.gain;
      try {
        if (typeof param.cancelScheduledValues === 'function') param.cancelScheduledValues(now);
        if (typeof param.setTargetAtTime === 'function') {
          param.setTargetAtTime(target * DUCK_RATIO, now, 0.018);
          param.setTargetAtTime(target, now + duration, 0.08);
        } else {
          param.value = target * DUCK_RATIO;
        }
      } catch (error) {}
    }

    function playTone(kind) {
      if (destroyed || !config.master || !config.visible) return Promise.resolve(false);
      const name = Object.prototype.hasOwnProperty.call(TONES, kind) ? kind : 'tap';
      return unlock().then(function (ready) {
        if (!ready || destroyed || !config.master || !config.visible) return false;
        const now = Number(context.currentTime || 0);
        const notes = TONES[name];
        notes.forEach(function (frequency, index) {
          scheduleVoice(frequency, now + index * 0.08, 0.2, 0.09, 'sine', sfxGain, sfxVoices);
        });
        duckMusic(name);
        return true;
      });
    }

    function setVisible(visible) {
      if (destroyed) return Promise.resolve(false);
      config.visible = Boolean(visible);
      const transition = function () {
        if (destroyed) return false;
        if (!config.visible) {
          applyConfig();
          stopMusic(false);
          stopVoices(sfxVoices);
          if (!context || typeof context.suspend !== 'function' || context.state === 'suspended') return true;
          try {
            return Promise.resolve(context.suspend()).then(function () { return true; }, function () { return false; });
          } catch (error) {
            return false;
          }
        }
        if (!context || !everUnlocked) {
          applyConfig();
          return false;
        }
        return unlock();
      };
      visibilityPromise = visibilityPromise.then(transition, transition);
      return visibilityPromise;
    }

    function destroy() {
      if (destroyed) return Promise.resolve(true);
      destroyed = true;
      stopMusic(true);
      stopVoices(sfxVoices);
      unlockPromise = null;
      visibilityPromise = Promise.resolve(false);
      const current = context;
      context = null;
      try { if (sfxGain) sfxGain.disconnect(); } catch (ignored) {}
      try { if (musicGain) musicGain.disconnect(); } catch (ignored) {}
      try { if (masterGain) masterGain.disconnect(); } catch (ignored) {}
      sfxGain = null;
      musicGain = null;
      masterGain = null;
      musicInput = null;
      if (!current || typeof current.close !== 'function' || current.state === 'closed') return Promise.resolve(true);
      try {
        return Promise.resolve(current.close()).then(function () { return true; }, function () { return false; });
      } catch (error) {
        return Promise.resolve(false);
      }
    }

    return Object.freeze({
      configure: configure,
      unlock: unlock,
      playTone: playTone,
      setVisible: setVisible,
      destroy: destroy,
      snapshot: snapshot
    });
  }

  global.HiramekiAudio = Object.freeze({
    DEFAULT_BGM_VOLUME: DEFAULT_BGM_VOLUME,
    MAX_BGM_GAIN: MAX_BGM_GAIN,
    create: create
  });
}(typeof globalThis !== 'undefined' ? globalThis : window));
