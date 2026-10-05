import { BEAT_S, FIRST_BEAT_S, BEATMAP } from './data/tuning.js';
import { S } from './data/strings.js';
export const median = (values) => {
  const a = [...values].sort((x, y) => x - y);
  return (a[Math.floor((a.length - 1) / 2)] + a[Math.floor(a.length / 2)]) / 2;
};
export function calibrate(errors) {
  const offset = median(errors),
    mad = median(errors.map((e) => Math.abs(e - offset)));
  return {
    accepted: errors.length === 8 && mad <= 0.05,
    offset: Math.max(-0.4, Math.min(0.4, offset)),
    mad,
  };
}
export class GameAudio {
  constructor(onLabel = () => {}, settings = {}) {
    this.onLabel = onLabel;
    this.settings = { music: 1, sfx: 0.8, offset: 0, muted: false, ...settings };
    this.voices = [];
    this.pending = [];
    this.scheduled = [];
    this.metronome = new URLSearchParams(location.search).has('metronome');
    this.running = false;
    this.lastClick = -1;
    this.ready = this.load();
  }
  setup() {
    if (this.ctx) return;
    const Context = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!Context) return;
    this.ctx = new Context();
    const c = this.ctx;
    this.music = c.createGain();
    this.duck = c.createGain();
    this.lowpass = c.createBiquadFilter();
    this.master = c.createGain();
    this.sfx = c.createGain();
    this.limiter = c.createDynamicsCompressor();
    this.lowpass.type = 'lowpass';
    this.lowpass.frequency.value = 20000;
    this.limiter.threshold.value = -3;
    this.limiter.ratio.value = 20;
    this.limiter.attack.value = 0.002;
    this.limiter.release.value = 0.08;
    this.limiter.knee.value = 0;
    this.music
      .connect(this.duck)
      .connect(this.lowpass)
      .connect(this.master)
      .connect(this.limiter)
      .connect(c.destination);
    this.sfx.connect(this.master);
    this.noise = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const noise = this.noise.getChannelData(0);
    let state = 42;
    for (let i = 0; i < noise.length; i++) {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      noise[i] = state / 2147483648 - 1;
    }
    this.curve = Float32Array.from({ length: 2048 }, (_, i) => Math.tanh((i / 1023.5 - 1) * 3));
    this.applySettings();
    c.onstatechange = () => {
      if (c.state === 'interrupted') this.onInterrupted?.();
    };
  }
  async load() {
    this.onLabel(S.loading);
    try {
      const response = await fetch('/audio/fratty-pipeline.mp3');
      if (!response.ok || response.headers.get('content-type')?.includes('text/html'))
        throw Error('missing');
      const bytes = await response.arrayBuffer();
      this.setup();
      try {
        this.buffer = await this.ctx.decodeAudioData(bytes);
      } catch {
        this.media = new Audio('/audio/fratty-pipeline.mp3');
        this.media.preload = 'auto';
        this.mediaSource = this.ctx.createMediaElementSource(this.media);
        this.mediaSource.connect(this.music);
        this.fallback = true;
      }
      this.available = true;
      this.onLabel(S.track);
      if (this.running) {
        this.lateBeat = Math.ceil(this.beatAt(performance.now()) / 4) * 4;
      }
    } catch {
      this.available = false;
      this.onLabel(S.missing);
    }
  }
  unlock() {
    try {
      if (navigator.audioSession) navigator.audioSession.type = 'playback';
    } catch {
      /* Optional browser API. */
    }
    this.setup();
    return this.ctx?.resume();
  }
  applySettings() {
    if (!this.ctx) return;
    this.music.gain.value = 0.45 * this.settings.music ** 2;
    this.sfx.gain.value = this.settings.sfx ** 2;
    this.master.gain.value = this.settings.muted ? 0 : 1;
  }
  outputTime(stamp = performance.now()) {
    if (!this.ctx) return stamp / 1000;
    const pair = this.ctx.getOutputTimestamp?.();
    if (pair?.performanceTime > 0) return pair.contextTime + (stamp - pair.performanceTime) / 1000;
    return (
      this.ctx.currentTime -
      (this.ctx.outputLatency ?? this.ctx.baseLatency ?? 0) +
      (stamp - performance.now()) / 1000
    );
  }
  beatAt(stamp = performance.now(), calibrated = false) {
    if (!this.running) return this.pausedBeat ?? 0;
    return Math.max(
      0,
      (this.outputTime(stamp) - this.origin - (calibrated ? this.settings.offset : 0)) / BEAT_S,
    );
  }
  audioTime(beat) {
    return this.origin + beat * BEAT_S;
  }
  stopSource() {
    try {
      this.source?.stop();
    } catch {
      /* Already stopped. */
    }
    this.source = null;
    this.media?.pause();
  }
  playSource(beat = 0, when = this.ctx.currentTime) {
    this.stopSource();
    const trackBeat = beat < 744 ? beat : 8 + ((beat - 744) % 736);
    if (this.buffer) {
      const source = this.ctx.createBufferSource();
      source.buffer = this.buffer;
      source.connect(this.music);
      source.loop = true;
      source.loopStart = FIRST_BEAT_S + BEATMAP.loops.run[0] * BEAT_S;
      source.loopEnd = FIRST_BEAT_S + BEATMAP.loops.run[1] * BEAT_S;
      source.start(when, beat === 0 ? 0 : FIRST_BEAT_S + trackBeat * BEAT_S);
      this.source = source;
    } else if (this.media) {
      this.media.currentTime = beat === 0 ? 0 : FIRST_BEAT_S + trackBeat * BEAT_S;
      this.media.play().catch(() => {});
    }
  }
  startRun() {
    this.setup();
    this.stopSource();
    this.pending = [];
    this.sceneDuck = false;
    this.restoreDuckAt = 0;
    this.duckMusic(0, 0.015);
    this.running = true;
    this.pausedBeat = 0;
    this.lastClick = -1;
    const when = (this.ctx?.currentTime ?? performance.now() / 1000) + 0.04;
    this.origin = when + FIRST_BEAT_S;
    if (this.available) this.playSource(0, when);
  }
  pause(beat) {
    this.pausedBeat = beat;
    this.running = false;
    this.media?.pause();
    return this.ctx?.suspend();
  }
  async resume(beat, projectiles = []) {
    await this.unlock();
    for (const voice of this.voices) {
      try {
        voice.source?.stop();
      } catch {
        /* Already stopped. */
      }
    }
    this.voices = [];
    this.pending = projectiles
      .filter((b) => !b.dead)
      .map((b) => ({ type: 'smash', beat: b.landBeat }));
    const early = Math.max(0, beat - 4);
    this.origin = (this.ctx?.currentTime ?? performance.now() / 1000) - early * BEAT_S;
    this.running = true;
    if (this.available) this.playSource(early);
    return early;
  }
  duckMusic(db, seconds = 0.2, frequency = 20000) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.duck.gain.cancelScheduledValues(t);
    this.duck.gain.setTargetAtTime(10 ** (db / 20), t, 0.02);
    this.lowpass.frequency.cancelScheduledValues(t);
    this.lowpass.frequency.setValueAtTime(this.lowpass.frequency.value, t);
    this.lowpass.frequency.exponentialRampToValueAtTime(frequency, t + seconds);
  }
  queue(type, beat) {
    this.pending.push({ type, beat });
  }
  event(e) {
    if (!this.ctx) return;
    if (e.type === 'throw') {
      this.sound('throw');
      this.queue('smash', e.landBeat);
    } else if (e.type === 'burn') {
      const chordBeat = Math.ceil(e.atBeat - 1e-6);
      this.queue('down', chordBeat);
      this.queue('crowd', Math.ceil((chordBeat + 0.01) / 4) * 4);
      if (!this.sceneDuck) {
        this.duckMusic(-4);
        this.restoreDuckAt = this.ctx.currentTime + 0.7;
      }
    } else if (e.type === 'transform') {
      this.restoreDuckAt = 0;
      this.sceneDuck = true;
      this.duckMusic(-10, 0.8, 600);
    } else if (e.type === 'vs' && e.boss) {
      this.sceneDuck = true;
      this.duckMusic(-6);
    } else if (['reborn', 'riot', 'lost'].includes(e.type)) {
      this.sceneDuck = false;
      this.duckMusic(0, 0.015);
      this.sound(e.type);
    } else if (e.type === 'won') {
      this.stopSource();
      if (this.buffer) {
        const s = this.ctx.createBufferSource();
        s.buffer = this.buffer;
        s.connect(this.music);
        s.start(0, FIRST_BEAT_S + 744 * BEAT_S);
        this.source = s;
      }
      this.sound('down');
    } else if (!['impact', 'miss', 'doused'].includes(e.type)) this.sound(e.type);
  }
  tick() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    if (this.restoreDuckAt && now >= this.restoreDuckAt) {
      this.restoreDuckAt = 0;
      this.duckMusic(0);
    }
    if (this.running) {
      const beat = this.beatAt();
      if (this.lateBeat !== undefined && this.audioTime(this.lateBeat) < now + 0.12) {
        this.playSource(this.lateBeat, Math.max(now, this.audioTime(this.lateBeat)));
        this.lateBeat = undefined;
      }
      if (this.media && this.media.currentTime >= FIRST_BEAT_S + 744 * BEAT_S)
        this.media.currentTime = FIRST_BEAT_S + 8 * BEAT_S;
      if (this.metronome) {
        const next = Math.ceil(beat);
        if (next > this.lastClick && this.audioTime(next) < now + 0.12) {
          this.sound('click', Math.max(now, this.audioTime(next)));
          this.lastClick = next;
        }
      }
    }
    const remaining = [];
    for (const e of this.pending) {
      const at = this.audioTime(e.beat);
      if (at <= now + 0.12) {
        this.sound(e.type, Math.max(now, at));
        this.scheduled.push({ type: e.type, beat: e.beat, at, target: at });
      } else remaining.push(e);
    }
    this.pending = remaining;
    this.scheduled = this.scheduled.slice(-100);
  }
  voice(
    frequency,
    duration,
    when,
    level = 0.1,
    type = 'triangle',
    noise = false,
    filterFrequency = 1600,
    formant = false,
  ) {
    const c = this.ctx;
    if (!c) return;
    this.voices = this.voices.filter((v) => v.end > c.currentTime);
    if (this.voices.length >= 24) return;
    const source = noise ? c.createBufferSource() : c.createOscillator(),
      gain = c.createGain(),
      filter = c.createBiquadFilter(),
      crunch = c.createWaveShaper();
    if (noise) source.buffer = this.noise;
    else {
      source.type = type;
      source.frequency.setValueAtTime(frequency, when);
      source.frequency.exponentialRampToValueAtTime(
        Math.max(260, frequency * 0.65),
        when + duration,
      );
    }
    filter.type = noise || formant ? 'bandpass' : 'highpass';
    filter.frequency.setValueAtTime(noise || formant ? filterFrequency : 250, when);
    if (formant) filter.Q.value = 5;
    if (noise) filter.frequency.exponentialRampToValueAtTime(2800, when + duration);
    crunch.curve = this.curve;
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(level, when + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    source.connect(filter).connect(crunch).connect(gain).connect(this.sfx);
    source.start(when);
    source.stop(when + duration + 0.01);
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      crunch.disconnect();
      gain.disconnect();
    };
    this.voices.push({ source, end: when + duration + 0.01 });
  }
  sound(type, when = this.ctx?.currentTime ?? 0) {
    if (!this.ctx) return;
    if (type === 'throw') {
      this.voice(0, 0.12, when, 0.09, 'triangle', true, 550);
      this.voice(2300, 0.07, when, 0.055);
    } else if (type === 'smash') {
      this.voice(0, 0.19, when, 0.17, 'triangle', true, 1300);
      this.voice(720, 0.13, when, 0.09, 'sawtooth');
      this.voice(3100, 0.12, when, 0.06);
    } else if (type === 'down') {
      for (const f of [293.66, 440, 587.33]) this.voice(f, 0.45, when, 0.09, 'sawtooth');
    } else if (type === 'crowd') {
      for (const f of [500, 800, 1100, 1500])
        this.voice(220, 0.4, when, 0.06, 'sawtooth', false, f, true);
    } else {
      const notes = {
        ollie: 850,
        land: 300,
        parry: 2200,
        hit: 520,
        transform: 1320,
        coffee: 1100,
        pickup: 1500,
        click: 1800,
        reborn: 880,
      };
      this.voice(
        notes[type] ?? 700,
        type === 'click' ? 0.03 : 0.09,
        when,
        type === 'click' ? 0.08 : type === 'empty' ? 0.025 : 0.1,
        ['hit', 'transform', 'pickup', 'coffee'].includes(type) ? 'sine' : 'triangle',
      );
    }
  }
  beginCalibration() {
    this.setup();
    this.stopSource();
    this.calibrationStart = this.ctx.currentTime + 0.6;
    this.calibrationErrors = [];
    for (let i = 0; i < 8; i++) this.sound('click', this.calibrationStart + i * BEAT_S);
  }
  tapCalibration(stamp) {
    const index = this.calibrationErrors.length;
    this.calibrationErrors.push(this.outputTime(stamp) - (this.calibrationStart + index * BEAT_S));
    return this.calibrationErrors.length === 8 ? calibrate(this.calibrationErrors) : null;
  }
}
