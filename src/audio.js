import { BEAT_S, FIRST_BEAT_S, BEATMAP } from './data/tuning.js';
import { S } from './data/strings.js';
import { deriveChip } from './chip/index.js';
import { seamlessLoop } from './loop.js';
// Web Audio: the optional local song on a beat clock, plus bounded synthesized SFX.
// The simulation never reads audio state; audio only listens to simulation events.
// Music: skate school loops the song's instrumental intro (the owner's pick: everything before the first verse,
// measured: the band hits at 2.55 s, the first sung note is at 23.45 s; 64 beats, crossfaded at the seam);
// the run plays the song once in full, then a ColecoVision-style chip version loops on the same beat grid. The chip
// version is derived here, from the local file.
const [LOOP_START, LOOP_END] = BEATMAP.loops.run;
const LOOP = LOOP_END - LOOP_START;
const BAR = BEATMAP.beatsPerBar;
// The song plays through its ring-out; the chip loop (chip beat 8 onward) takes over on the next bar line.
const SONG_END = Math.ceil(BEATMAP.sections.at(-1).to / BAR) * BAR;
const [TUTORIAL_START, TUTORIAL_END] = BEATMAP.loops.tutorial;
const MARGIN = 2; // beats of headroom for scheduling a switch ahead of the playhead
const CHIP_GAIN = 1.4; // squares sit ~4 dB under the mastered song; this keeps the hand-off level
// The longest curb (25.6 m) at grindMinSpeed (3 m/s) is ~8.5 s; the hold only has to outlast that, 'grindEnd' fades it.
const GRIND_HOLD = 9;
// Sim events that end a grind without a 'grindEnd' (the skater is replaced, wiped out or moved): the scrape stops there.
const GRIND_CUT = new Set(['start', 'trainingStart', 'trainingDone', 'captured', 'wipeout', 'alleyEnter', 'alleyExit', 'newspaper', 'bonusStart', 'victory', 'lost']);
export class GameAudio {
  constructor(onLabel = () => {}, settings = {}) {
    this.onLabel = onLabel;
    this.settings = { music: 1, sfx: 0.8, muted: false, ...settings };
    this.voices = [];
    this.pending = [];
    this.scheduled = [];
    this.metronome = new URLSearchParams(location.search).has('metronome');
    this.running = false;
    this.lastClick = -1;
    this.chip = {};
    this.chipAt = null;
    this.training = false;
    this.ready = this.load();
  }
  // Same SFX graph on an OfflineAudioContext, for rendering a gameplay video's sound.
  static offline(context, settings = {}) {
    const audio = Object.create(GameAudio.prototype);
    Object.assign(audio, {
      settings: { music: 1, sfx: 0.8, muted: false, ...settings },
      voices: [],
      pending: [],
      scheduled: [],
      running: false,
      metronome: false,
      onLabel: () => {},
      chip: {},
      chipAt: null,
      training: false,
    });
    audio.setup(context);
    return audio;
  }
  setup(context = null) {
    if (this.ctx) return;
    const Context = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!context && !Context) return;
    this.ctx = context ?? new Context();
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
    this.music.connect(this.duck).connect(this.lowpass).connect(this.master).connect(this.limiter).connect(c.destination);
    this.sfx.connect(this.master);
    this.noise = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const data = this.noise.getChannelData(0);
    let state = 42;
    for (let i = 0; i < data.length; i++) {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      data[i] = state / 2147483648 - 1;
    }
    this.applySettings();
    c.onstatechange = () => {
      if (c.state === 'interrupted') this.onInterrupted?.();
    };
  }
  async load() {
    this.onLabel(S.loading);
    try {
      const response = await fetch('/audio/fratty-pipeline.mp3');
      if (!response.ok || response.headers.get('content-type')?.includes('text/html')) throw Error('missing');
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
      if (this.running) this.lateBeat = Math.ceil(this.beatAt(performance.now()) / 4) * 4;
      this.playTraining();
      if (this.buffer) this.derive();
    } catch {
      this.available = false;
      this.onLabel(S.missing);
    }
  }
  // Mono copy of the decoded song for the chip derivation (the worker takes ownership of it).
  mono() {
    const b = this.buffer,
      pcm = new Float32Array(b.length);
    b.copyFromChannel(pcm, 0);
    if (b.numberOfChannels > 1) {
      const right = b.getChannelData(1);
      for (let i = 0; i < pcm.length; i++) pcm[i] = (pcm[i] + right[i]) / 2;
    }
    return pcm;
  }
  // Derive both chip renders off the main thread, training first; ~24 kHz is plenty for squares and noise.
  derive() {
    const rate = this.ctx.sampleRate / Math.max(1, Math.round(this.ctx.sampleRate / 24000)),
      grid = { beatS: BEAT_S, firstBeatS: FIRST_BEAT_S, beatsPerBar: BAR, sections: BEATMAP.sections, stops: BEATMAP.stops },
      failed = (message) => console.warn('Chip version unavailable; the song keeps looping:', message);
    try {
      deriveChip(
        () => ({
          pcm: this.mono(),
          sampleRate: this.buffer.sampleRate,
          grid,
          renders: [{ id: 'run', from: LOOP_START, to: LOOP_END, tempo: 1, sampleRate: rate }],
        }),
        (result) => this.chipDone(result),
        failed,
      );
    } catch (error) {
      failed(error?.message ?? error);
    }
  }
  chipDone({ id, pcm, sampleRate, key }) {
    if (id === 'score') {
      this.chipKey = key;
      return;
    }
    const buffer = this.ctx.createBuffer(1, pcm.length, sampleRate);
    buffer.copyToChannel(pcm, 0);
    this.chip[id] = buffer;
    if (id === 'run' && !this.training && this.origin !== undefined) {
      this.planChip(this.running ? this.ctxBeat() : (this.pausedBeat ?? 0));
      if (this.running) this.armChip();
    }
  }
  get chipReady() {
    return Boolean(this.chip?.run);
  }
  // 'training' | 'song' | 'chip' | null: what the music bus is playing (read-only, for the HUD and debug).
  get musicMode() {
    if (this.training) return this.trainSource || this.trainMedia ? 'training' : null;
    if (!this.available || this.origin === undefined) return null;
    const beat = this.running ? this.beatAt() : (this.pausedBeat ?? 0);
    return this.chipAt !== null && beat >= this.chipAt ? 'chip' : 'song';
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
    this.music.gain.value = 0.42 * this.settings.music ** 2;
    this.sfx.gain.value = this.settings.sfx ** 2;
    this.master.gain.value = this.settings.muted ? 0 : 1;
  }
  outputTime(stamp = performance.now()) {
    if (!this.ctx) return stamp / 1000;
    const pair = this.ctx.getOutputTimestamp?.();
    if (pair?.performanceTime > 0) return pair.contextTime + (stamp - pair.performanceTime) / 1000;
    return this.ctx.currentTime - (this.ctx.outputLatency ?? this.ctx.baseLatency ?? 0) + (stamp - performance.now()) / 1000;
  }
  beatAt(stamp = performance.now()) {
    if (!this.running) return this.pausedBeat ?? 0;
    return Math.max(0, (this.outputTime(stamp) - this.origin) / BEAT_S);
  }
  // The beat being scheduled right now (context time, no output latency): what switches are planned against.
  ctxBeat() {
    return ((this.ctx?.currentTime ?? 0) - this.origin) / BEAT_S;
  }
  audioTime(beat) {
    return this.origin + beat * BEAT_S;
  }
  stopSource() {
    for (const source of [this.source, this.chipSource])
      try {
        source?.stop();
      } catch {
        /* Already stopped. */
      }
    this.source = this.chipSource = null;
    this.media?.pause();
  }
  // Where the chip loop takes over: after the whole song when it can still play through unlooped, otherwise (the
  // chip arrived after the song wrapped) on the next bar line, continuing from where the song loop had got to.
  planChip(beat) {
    if (this.chipAt !== null || !this.chip.run) return;
    if (beat < LOOP_END - MARGIN) this.chipAt = this.chipBase = SONG_END;
    else {
      this.chipAt = Math.ceil((beat + MARGIN) / BAR) * BAR;
      this.chipBase = LOOP_END;
    }
  }
  // Run beat b ≥ chipAt plays chip beat 8 + ((b − chipBase) mod 736); the chip buffer starts at chip beat 8.
  chipOffset(beat) {
    return ((((beat - this.chipBase) % LOOP) + LOOP) % LOOP) * BEAT_S;
  }
  // Schedules the hand-off sample-accurately on the playing song: unloop it, fade it at the switch, start the chip.
  armChip() {
    if (!this.source || this.chipSource || this.chipAt === null) return;
    const at = this.audioTime(this.chipAt);
    if (at < this.ctx.currentTime) return;
    if (this.chipAt === SONG_END) this.source.loop = false;
    this.sourceGain.gain.setValueAtTime(1, at);
    this.sourceGain.gain.linearRampToValueAtTime(0, at + 0.03);
    this.source.stop(at + 0.04);
    this.startChip(this.chipAt, at);
  }
  startChip(beat, when) {
    const source = this.ctx.createBufferSource(),
      gain = this.ctx.createGain();
    source.buffer = this.chip.run;
    source.loop = true;
    gain.gain.value = CHIP_GAIN;
    source.connect(gain).connect(this.music);
    source.start(when, this.chipOffset(beat));
    this.chipSource = source;
  }
  // Starts run music at context time `when` (at or after the clock's origin minus the song's lead-in).
  playSource(when = this.ctx.currentTime) {
    this.stopSource();
    const beat = (when - this.origin) / BEAT_S;
    if (this.chip.run) this.planChip(Math.max(0, beat));
    if (this.chipAt !== null && beat >= this.chipAt) {
      this.startChip(beat, when);
      return;
    }
    // Until the chip is scheduled, the song loops 8–744 as a safety net; once it is, the song plays straight through.
    const through = this.chipAt === SONG_END,
      trackBeat = through || beat < LOOP_END ? beat : LOOP_START + ((beat - LOOP_END) % LOOP),
      offset = Math.max(0, FIRST_BEAT_S + trackBeat * BEAT_S);
    if (this.buffer) {
      const source = this.ctx.createBufferSource(),
        gain = this.ctx.createGain();
      source.buffer = this.buffer;
      source.connect(gain).connect(this.music);
      source.loop = !through;
      source.loopStart = FIRST_BEAT_S + LOOP_START * BEAT_S;
      source.loopEnd = FIRST_BEAT_S + LOOP_END * BEAT_S;
      source.start(when, offset);
      this.source = source;
      this.sourceGain = gain;
      this.armChip();
    } else if (this.media) {
      this.media.currentTime = offset;
      this.media.play().catch(() => {});
    }
  }
  // Skate school: the song's instrumental intro on a seamless bar-aligned loop, faded in as soon as the song is
  // decoded. Without the song file there is no music (no substitute soundtrack).
  startTraining() {
    this.setup();
    this.stopTraining(0.05);
    this.stopSource();
    this.pending = [];
    this.grindEnd(this.ctx?.currentTime ?? 0, false);
    this.duckMusic(0, 0.015);
    this.running = false;
    this.pausedBeat = 0;
    this.origin = undefined;
    this.chipAt = null;
    this.training = true;
    this.playTraining();
  }
  playTraining() {
    if (!this.training || this.trainSource || this.trainMedia || !this.ctx) return;
    if (!this.buffer) {
      // Media-element fallback (the song would not decode): play the same intro bars, wrapped in tick(). Not
      // sample-accurate at the seam, but skate school still has its music.
      if (!this.media) return;
      this.media.currentTime = FIRST_BEAT_S + TUTORIAL_START * BEAT_S;
      this.media.play().catch(() => {});
      this.trainMedia = true;
      return;
    }
    this.introLoop ??= seamlessLoop(this.ctx, this.buffer, FIRST_BEAT_S + TUTORIAL_START * BEAT_S, FIRST_BEAT_S + TUTORIAL_END * BEAT_S);
    const now = this.ctx.currentTime,
      source = this.ctx.createBufferSource(),
      gain = this.ctx.createGain();
    source.buffer = this.introLoop;
    source.loop = true;
    // The loop opens on the band's first hit, so the fade-in is just long enough not to click.
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(1, now + 0.02);
    source.connect(gain).connect(this.music);
    source.start(now);
    this.trainSource = source;
    this.trainGain = gain;
  }
  stopTraining(fade = 0.15) {
    this.training = false;
    if (this.trainMedia) {
      this.media.pause();
      this.trainMedia = false;
    }
    const source = this.trainSource;
    if (!source) return;
    const now = this.ctx.currentTime,
      gain = this.trainGain.gain;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(gain.value, now);
    gain.linearRampToValueAtTime(0, now + fade);
    source.stop(now + fade + 0.02);
    this.trainSource = this.trainGain = null;
  }
  startRun() {
    this.setup();
    this.stopTraining();
    this.stopSource();
    this.pending = [];
    this.grindEnd(this.ctx?.currentTime ?? 0, false);
    this.duckMusic(0, 0.015);
    this.running = true;
    this.pausedBeat = 0;
    this.lastClick = -1;
    this.chipAt = null;
    const when = (this.ctx?.currentTime ?? performance.now() / 1000) + 0.04;
    this.origin = when + FIRST_BEAT_S;
    if (this.available) this.playSource(when);
  }
  pause(beat) {
    this.pausedBeat = beat;
    this.running = false;
    this.media?.pause();
    return this.ctx?.suspend();
  }
  // Leaving a run or skate school: every music source and SFX voice ends, so nothing old plays when the context is
  // next resumed (START or the mute toggle on the title screen). The caller suspends it with pause().
  stop() {
    this.stopTraining(0.02);
    this.stopSource();
    this.silence();
    this.running = false;
    this.origin = this.lateBeat = undefined;
    this.chipAt = null;
    this.restoreAt = 0;
  }
  // Stops every SFX voice (a grind scrape included) and drops queued stings.
  silence() {
    for (const voice of this.voices) {
      try {
        voice.source?.stop();
      } catch {
        /* Already stopped. */
      }
    }
    this.voices = [];
    this.pending = [];
    this.grinding = null;
  }
  // Resume four beats early so the song leads back in under the 3·2·1 count-in; { countIn: false } (the newspaper)
  // picks up exactly where it paused. Training music just carries on. A grind the pause cut scrapes on as play resumes.
  async resume(beat, { countIn = true } = {}) {
    await this.unlock();
    const grind = this.grinding ? this.grindKind : null;
    this.silence();
    if (this.training) {
      if (this.trainMedia) this.media.play().catch(() => {});
      if (grind) this.grind(grind, this.ctx?.currentTime ?? 0);
      return beat;
    }
    const early = countIn ? Math.max(0, beat - 4) : beat,
      now = this.ctx?.currentTime ?? performance.now() / 1000;
    this.origin = now - early * BEAT_S;
    this.running = true;
    if (this.available) this.playSource(now);
    if (grind) this.grind(grind, this.audioTime(beat));
    return early;
  }
  duckMusic(db, seconds = 0.2, frequency = 20000) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.duck.gain.cancelScheduledValues(t);
    this.duck.gain.setTargetAtTime(10 ** (db / 20), t, 0.03);
    this.lowpass.frequency.cancelScheduledValues(t);
    this.lowpass.frequency.setValueAtTime(this.lowpass.frequency.value, t);
    this.lowpass.frequency.exponentialRampToValueAtTime(frequency, t + seconds);
  }
  dip(db = -5, hold = 0.6) {
    this.duckMusic(db);
    this.restoreAt = (this.ctx?.currentTime ?? 0) + hold;
  }
  queue(type, beat) {
    this.pending.push({ type, beat });
  }
  nextBeat() {
    return Math.ceil(this.beatAt() + 0.05);
  }
  event(e, at = this.ctx?.currentTime ?? 0) {
    if (!this.ctx) return;
    if (this.grinding && GRIND_CUT.has(e.type)) this.grindEnd(at, false);
    const map = {
      throw: 'whoosh',
      hit: 'ignite',
      miss: 'clank',
      wasted: 'shatter',
      itemMiss: 'thud',
      broLit: 'yelp',
      houseFire: 'roar',
      harmed: 'crunch',
      reallyHarmed: 'crunch',
      fdArrive: 'hose',
      doused: 'fizz',
      fumble: 'fizz',
      bees: 'buzz',
      houseEmpty: 'swarm', // a beehive emptied the house ('empty' alone is out of ammo)
      sub: 'thump',
      subBeat: 'thump',
      fryer: 'clunk',
      fireball: 'boom',
      raccoons: 'chitter',
      raccoonsIn: 'chitter',
      lidOff: 'clank',
      balloon: 'squeak',
      liftoff: 'whistle',
      unlock: 'chaching',
      restock: 'chaching',
      crate: 'pickup',
      empty: 'dud',
      noThrow: 'dud',
      wipeout: 'crash',
      ramp: 'whoosh',
      push: 'scuff',
      warn: 'heartbeat',
      captured: 'sad',
      rescueStart: 'jingle',
      freed: 'arp',
      rescued: 'fanfare',
      bonusStart: 'jingle',
      bonusThrow: 'whoosh',
      bonusHit: 'swish',
      bonusMiss: 'clank',
      perfect: 'fanfare',
      bonusEnd: 'arp',
      lap: 'jingle',
      go: 'horn',
      continued: 'horn',
      honk: 'honk',
      keg: 'rumble',
      item: 'tick',
      victory: 'fanfare',
      lost: 'sad',
      gawk: null,
      light: 'light',
      flip: 'flip',
      slide: 'slide',
      stumble: 'stumble',
      comboLost: 'comboLost',
      flow: 'flow',
      flowEnd: 'flowEnd',
      smash: 'smash',
      honey: 'honey',
      noticed: 'alarm',
      alleyEnter: 'gateIn',
      alleyExit: 'gateOut',
      newspaper: 'paper',
      station: 'bubble',
      stationDone: 'success',
      stationRetry: 'retry',
      trainingStart: 'jingle',
      trainingDone: 'horn',
      practiceMiss: 'clank',
      getup: 'getup',
      mash: 'tap',
    };
    switch (e.type) {
      case 'fdRoll':
        return this.sound(e.success ? 'siren' : 'tick', at);
      case 'grind':
        return this.grind(e.kind, at);
      case 'grindEnd':
        return this.grindEnd(at);
      case 'kick':
        return this.sound('kick', at, { scale: e.lazy ? 0.5 : 1 });
      case 'land':
        return this.sound(e.clean ? 'clack' : 'wobble', at, { scale: e.big ? 1.25 : 1 });
      case 'ollie':
        return this.sound(e.perfect ? 'popUp' : 'pop', at);
      case 'trick':
        return this.sound('blip', at, { n: typeof e.parts === 'number' ? e.parts : (e.parts?.length ?? 1) });
      case 'combo':
        return this.sound('bank', at, { n: e.mult ?? 1 });
      case 'hive':
        this.sound('hive', at);
        if (e.full) this.sound('honey', at + 0.12);
        return;
      case 'practiceHit':
        return this.sound('ignite', at, { scale: 0.55 });
    }
    if (e.type === 'houseGone') {
      this.sound('collapse', at);
      this.dip(-6, 0.9);
      if (this.running) {
        const beat = this.nextBeat();
        this.queue('sting', beat);
        this.queue('cheer', beat + 1);
      } else {
        this.sound('sting', at);
        this.sound('cheer', at + BEAT_S);
      }
      return;
    }
    if (['fireball', 'captured', 'houseFire'].includes(e.type)) this.dip(e.type === 'captured' ? -10 : -5, 0.8);
    if (e.type === 'bonusStart') this.duckMusic(-4, 0.3, 4000);
    if (e.type === 'bonusEnd') this.duckMusic(0, 0.3);
    const sound = map[e.type];
    if (sound) this.sound(sound, at);
  }
  // A scrape that lasts as long as the grind: 'grindEnd' (or an event in GRIND_CUT) fades it. Timbre by surface;
  // the hold outlasts the longest grind and is only a cap so it can't hang.
  grind(kind, at) {
    this.grindEnd(at);
    const [f, q, level] = { rail: [1900, 9, 0.05], bench: [1100, 4, 0.05], ledge: [600, 2, 0.06], curb: [750, 2.5, 0.06] }[kind] ?? [1200, 4, 0.05];
    const hold = GRIND_HOLD;
    this.grindKind = kind;
    this.grinding = [
      this.voice({ noise: true, at, dur: hold + 0.3, hold, level, filter: { f }, q, attack: 0.02, tremolo: 23 }),
      this.voice({ f: f / 4, at, dur: hold + 0.3, hold, level: level * 0.4, type: 'sawtooth', filter: { f }, q: q * 2, attack: 0.03, tremolo: 11 }),
    ].filter(Boolean);
  }
  // `scuff` is the dismount; a grind cut short by a capture, wipeout or level change just stops under that event's sound.
  grindEnd(at, scuff = true) {
    for (const v of this.grinding ?? []) {
      if (at >= v.held) continue; // already fading out on its own
      v.gain.gain.cancelScheduledValues(at);
      v.gain.gain.setTargetAtTime(0, at, 0.025);
      v.depth?.gain.setTargetAtTime(0, at, 0.025); // the tremolo rides on the gain, so fade it too
      try {
        v.source.stop(at + 0.15);
      } catch {
        /* Already stopped. */
      }
      v.end = at + 0.15;
    }
    if (this.grinding && scuff) this.sound('scuff', at, { scale: 0.6 });
    this.grinding = null;
  }
  tick() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    if (this.restoreAt && now >= this.restoreAt) {
      this.restoreAt = 0;
      this.duckMusic(0);
    }
    if (this.running) {
      if (this.lateBeat !== undefined && this.audioTime(this.lateBeat) < now + 0.12) {
        this.playSource(Math.max(now, this.audioTime(this.lateBeat)));
        this.lateBeat = undefined;
      }
      if (this.media && this.media.currentTime >= FIRST_BEAT_S + LOOP_END * BEAT_S) this.media.currentTime = FIRST_BEAT_S + LOOP_START * BEAT_S;
      if (this.metronome) {
        const next = Math.ceil(this.beatAt());
        if (next > this.lastClick && this.audioTime(next) < now + 0.12) {
          this.sound('tick', Math.max(now, this.audioTime(next)));
          this.lastClick = next;
        }
      }
    }
    if (this.trainMedia && this.media.currentTime >= FIRST_BEAT_S + TUTORIAL_END * BEAT_S) this.media.currentTime = FIRST_BEAT_S + TUTORIAL_START * BEAT_S;
    const remaining = [];
    for (const e of this.pending) {
      const at = this.audioTime(e.beat);
      if (at <= now + 0.12) {
        this.sound(e.type, Math.max(now, at));
        this.scheduled.push({ type: e.type, beat: e.beat, at });
      } else remaining.push(e);
    }
    this.pending = remaining;
    this.scheduled = this.scheduled.slice(-60);
  }
  // One synthesized voice: oscillator or noise through a filter and an envelope; `hold` sustains before the decay.
  voice({ f = 440, to = null, dur = 0.12, at, level = 0.1, type = 'triangle', noise = false, filter = null, q = 1, attack = 0.004, tremolo = 0, hold = 0 }) {
    const c = this.ctx;
    if (!c) return;
    const when = at ?? c.currentTime;
    // Prune by the scheduled time so offline rendering (currentTime = 0) is not capped.
    this.voices = this.voices.filter((v) => v.end > when);
    if (this.voices.length >= 28) return;
    const source = noise ? c.createBufferSource() : c.createOscillator(),
      gain = c.createGain();
    let node = source;
    if (noise) {
      source.buffer = this.noise;
      source.loop = true;
    } else {
      source.type = type;
      source.frequency.setValueAtTime(f, when);
      if (to) source.frequency.exponentialRampToValueAtTime(Math.max(20, to), when + dur);
    }
    if (filter) {
      const bq = c.createBiquadFilter();
      bq.type = filter.type ?? 'bandpass';
      bq.frequency.setValueAtTime(filter.f, when);
      if (filter.to) bq.frequency.exponentialRampToValueAtTime(filter.to, when + dur);
      bq.Q.value = q;
      node.connect(bq);
      node = bq;
    }
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(level, when + attack);
    if (hold) gain.gain.setValueAtTime(level, when + attack + hold);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    node.connect(gain).connect(this.sfx);
    let lfo, depth;
    if (tremolo) {
      lfo = c.createOscillator();
      depth = c.createGain();
      lfo.frequency.value = tremolo;
      depth.gain.value = level * 0.6;
      lfo.connect(depth).connect(gain.gain);
      lfo.start(when);
      lfo.stop(when + dur + 0.02);
    }
    source.start(when);
    source.stop(when + dur + 0.02);
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
      lfo?.disconnect();
    };
    const record = { source, gain, depth, end: when + dur + 0.02, held: when + attack + hold };
    this.voices.push(record);
    return record;
  }
  // o.scale scales every level (quieter variants); o.n is a count that raises pitch (trick parts, multiplier).
  sound(type, at = this.ctx?.currentTime ?? 0, o = {}) {
    if (!this.ctx) return;
    const scale = o.scale ?? 1;
    const v = (p) => this.voice({ at, ...p, level: (p.level ?? 0.1) * scale });
    const jitter = 1 + (Math.random() - 0.5) * 0.12;
    switch (type) {
      case 'whoosh':
        v({ noise: true, dur: 0.22, level: 0.12, filter: { f: 500, to: 2600 }, q: 1.5 });
        break;
      case 'ignite':
        v({ noise: true, dur: 0.12, level: 0.16, filter: { f: 3000, type: 'highpass' } });
        v({ noise: true, dur: 0.45, level: 0.16, filter: { f: 300, to: 1400 }, q: 0.8, attack: 0.02 });
        v({ f: 120 * jitter, to: 60, dur: 0.25, level: 0.18, type: 'sine' });
        v({ f: 880 * jitter, to: 1320, dur: 0.18, level: 0.06, type: 'triangle', at: at + 0.05 });
        break;
      case 'clank':
        v({ f: 180 * jitter, dur: 0.16, level: 0.12, type: 'square', filter: { f: 900 }, q: 3 });
        v({ noise: true, dur: 0.08, level: 0.1, filter: { f: 2400 }, q: 4 });
        break;
      case 'shatter':
        v({ noise: true, dur: 0.25, level: 0.14, filter: { f: 5000, type: 'highpass' } });
        v({ f: 2400 * jitter, to: 1800, dur: 0.12, level: 0.04, type: 'sine' });
        break;
      case 'thud':
        v({ f: 140 * jitter, to: 70, dur: 0.12, level: 0.14, type: 'sine' });
        break;
      case 'yelp':
        v({ f: 300 * jitter, to: 900 * jitter, dur: 0.32, level: 0.08, type: 'sawtooth', filter: { f: 1100, to: 2200 }, q: 6 });
        v({ noise: true, dur: 0.3, level: 0.08, filter: { f: 600, to: 2000 } });
        break;
      case 'roar':
        v({ noise: true, dur: 0.9, level: 0.18, filter: { f: 200, to: 900 }, q: 0.7, attack: 0.08 });
        v({ f: 70, to: 45, dur: 0.6, level: 0.16, type: 'sine' });
        break;
      case 'crunch':
        v({ noise: true, dur: 0.35, level: 0.18, filter: { f: 700, to: 250, type: 'lowpass' } });
        v({ f: 95, to: 50, dur: 0.3, level: 0.16, type: 'triangle' });
        break;
      case 'collapse':
        v({ noise: true, dur: 1.4, level: 0.22, filter: { f: 400, to: 120, type: 'lowpass' }, attack: 0.02 });
        v({ f: 60, to: 32, dur: 1.1, level: 0.22, type: 'sine' });
        break;
      case 'sting':
        for (const f of [392, 523.25, 659.25, 783.99]) v({ f, dur: 0.55, level: 0.06, type: 'sawtooth', filter: { f: 3000, type: 'lowpass' } });
        break;
      case 'cheer':
        for (const f of [600, 900, 1300]) v({ noise: true, dur: 0.9, level: 0.05, filter: { f, to: f * 1.2 }, q: 4, attack: 0.1 });
        break;
      case 'siren':
        for (let i = 0; i < 4; i++) v({ f: i % 2 ? 660 : 880, dur: 0.36, level: 0.06, type: 'square', filter: { f: 2000, type: 'lowpass' }, at: at + i * 0.36 });
        break;
      case 'hose':
        v({ noise: true, dur: 1.2, level: 0.08, filter: { f: 3500, type: 'highpass' }, attack: 0.1 });
        break;
      case 'fizz':
        v({ noise: true, dur: 0.4, level: 0.07, filter: { f: 4000, type: 'highpass' } });
        break;
      case 'buzz':
        v({ f: 220, dur: 1.2, level: 0.06, type: 'sawtooth', filter: { f: 900 }, q: 2, tremolo: 22, attack: 0.05 });
        v({ f: 233, dur: 1.2, level: 0.05, type: 'sawtooth', filter: { f: 1200 }, q: 2, tremolo: 17, attack: 0.08 });
        break;
      case 'swarm': // the hive empties the house: the swarm swells up, a door bangs open
        v({ f: 247, to: 494, dur: 0.7, level: 0.05, type: 'sawtooth', filter: { f: 1400 }, q: 2, tremolo: 27, attack: 0.1, at: at + 0.25 });
        v({ f: 150, to: 90, dur: 0.12, level: 0.12, type: 'square', filter: { f: 600, type: 'lowpass' }, at: at + 0.3 });
        break;
      case 'thump':
        v({ f: 90, to: 42, dur: 0.22, level: 0.32, type: 'sine', attack: 0.002 });
        v({ noise: true, dur: 0.03, level: 0.06, filter: { f: 3000 } });
        break;
      case 'clunk':
        v({ f: 160, to: 110, dur: 0.15, level: 0.14, type: 'square', filter: { f: 700, type: 'lowpass' } });
        break;
      case 'boom':
        v({ noise: true, dur: 1, level: 0.26, filter: { f: 900, to: 90, type: 'lowpass' }, attack: 0.005 });
        v({ f: 80, to: 30, dur: 0.8, level: 0.26, type: 'sine' });
        break;
      case 'chitter':
        for (let i = 0; i < 6; i++) v({ f: (1800 + Math.random() * 900) * jitter, dur: 0.05, level: 0.05, type: 'square', at: at + i * 0.06 });
        break;
      case 'squeak':
        v({ f: 500 * jitter, to: 1400, dur: 0.25, level: 0.07, type: 'sine' });
        break;
      case 'whistle':
        v({ f: 600, to: 2400, dur: 1.1, level: 0.06, type: 'sine', attack: 0.05 });
        break;
      case 'chaching':
        v({ f: 2093, dur: 0.12, level: 0.07, type: 'triangle' });
        v({ f: 2637, dur: 0.3, level: 0.07, type: 'triangle', at: at + 0.09 });
        v({ noise: true, dur: 0.08, level: 0.05, filter: { f: 6000, type: 'highpass' } });
        break;
      case 'pickup':
        for (const [i, f] of [[0, 988], [1, 1319]]) v({ f, dur: 0.1, level: 0.07, type: 'square', filter: { f: 4000, type: 'lowpass' }, at: at + i * 0.07 });
        break;
      case 'dud':
        v({ f: 200, to: 160, dur: 0.08, level: 0.06, type: 'square', filter: { f: 800, type: 'lowpass' } });
        break;
      case 'crash':
        v({ noise: true, dur: 0.5, level: 0.2, filter: { f: 1200, to: 300, type: 'lowpass' } });
        v({ f: 400, to: 120, dur: 0.45, level: 0.08, type: 'sawtooth', filter: { f: 1200, type: 'lowpass' } });
        break;
      case 'pop':
        v({ noise: true, dur: 0.04, level: 0.16, filter: { f: 2500 }, q: 2 });
        v({ f: 720 * jitter, to: 500, dur: 0.06, level: 0.06, type: 'triangle' });
        break;
      case 'popUp': // perfect ollie: a higher, brighter pop with a sparkle
        v({ noise: true, dur: 0.04, level: 0.16, filter: { f: 3600 }, q: 2 });
        v({ f: 1000 * jitter, to: 1500, dur: 0.07, level: 0.06, type: 'triangle' });
        v({ f: 2637, dur: 0.12, level: 0.03, type: 'sine', at: at + 0.04 });
        break;
      case 'scuff':
        v({ noise: true, dur: 0.14, level: 0.07, filter: { f: 1600 }, q: 1.2 });
        break;
      case 'kick': // kick-push: wheels scrape, then the tail clacks down
        v({ noise: true, dur: 0.16, level: 0.05, filter: { f: 900, to: 1500 }, q: 1.2, attack: 0.02 });
        v({ f: 1300 * jitter, to: 900, dur: 0.04, level: 0.04, type: 'triangle', at: at + 0.12 });
        v({ noise: true, dur: 0.03, level: 0.05, filter: { f: 2600 }, q: 3, at: at + 0.12 });
        break;
      case 'light': // lighter flick, then the rag catching
        v({ noise: true, dur: 0.025, level: 0.08, filter: { f: 4500, type: 'highpass' } });
        v({ f: 3200 * jitter, dur: 0.02, level: 0.03, type: 'square', filter: { f: 6000, type: 'lowpass' } });
        v({ noise: true, dur: 0.3, level: 0.07, filter: { f: 350, to: 1600 }, q: 0.9, attack: 0.04, at: at + 0.06 });
        break;
      case 'flip': // board flick, then the catch
        v({ f: 1500 * jitter, to: 1100, dur: 0.035, level: 0.06, type: 'triangle' });
        v({ noise: true, dur: 0.03, level: 0.07, filter: { f: 3000 }, q: 3 });
        v({ f: 1200 * jitter, to: 850, dur: 0.04, level: 0.06, type: 'triangle', at: at + 0.11 });
        v({ noise: true, dur: 0.03, level: 0.06, filter: { f: 2500 }, q: 3, at: at + 0.11 });
        break;
      case 'slide': // powerslide hiss
        v({ noise: true, dur: 0.4, level: 0.08, filter: { f: 2600, to: 1400 }, q: 0.9, attack: 0.03 });
        break;
      case 'clack': // clean landing: crisp wood
        v({ noise: true, dur: 0.05, level: 0.12, filter: { f: 2200 }, q: 2 });
        v({ f: 950 * jitter, to: 620, dur: 0.05, level: 0.06, type: 'triangle' });
        v({ f: 120, to: 65, dur: 0.1, level: 0.12, type: 'sine' });
        break;
      case 'wobble': // sketchy landing: a thud and rattling wheels
        v({ f: 120 * jitter, to: 58, dur: 0.22, level: 0.15, type: 'sine' });
        v({ f: 300, to: 190, dur: 0.3, level: 0.05, type: 'triangle', tremolo: 14 });
        v({ noise: true, dur: 0.12, level: 0.05, filter: { f: 700, type: 'lowpass' } });
        break;
      case 'stumble': // scuff and a grunt
        v({ noise: true, dur: 0.18, level: 0.08, filter: { f: 1200 }, q: 1.2 });
        v({ f: 190 * jitter, to: 130, dur: 0.13, level: 0.05, type: 'sawtooth', filter: { f: 700, type: 'lowpass' }, at: at + 0.04 });
        break;
      case 'blip': {
        // Trick: a small rising blip, two semitones higher per part of the combo.
        const f = 660 * 2 ** (Math.min(o.n ?? 1, 10) / 6);
        v({ f, to: f * 1.5, dur: 0.07, level: 0.05, type: 'square', filter: { f: 4000, type: 'lowpass' } });
        v({ f: f * 1.5, dur: 0.06, level: 0.035, type: 'square', filter: { f: 5000, type: 'lowpass' }, at: at + 0.05 });
        break;
      }
      case 'bank': {
        // Combo banked: a cha-ching chord that climbs with the multiplier.
        const f = 523.25 * 2 ** ((Math.min(o.n ?? 1, 8) - 1) / 6);
        [1, 1.26, 1.5, 2].forEach((r, i) => v({ f: f * r, dur: 0.22, level: 0.05, type: 'triangle', at: at + i * 0.045 }));
        v({ noise: true, dur: 0.1, level: 0.05, filter: { f: 6000, type: 'highpass' }, at: at + 0.12 });
        break;
      }
      case 'comboLost':
        v({ f: 660, to: 220, dur: 0.25, level: 0.05, type: 'square', filter: { f: 2000, type: 'lowpass' } });
        v({ f: 440, to: 150, dur: 0.3, level: 0.04, type: 'square', filter: { f: 1500, type: 'lowpass' }, at: at + 0.12 });
        break;
      case 'flow': // whoosh up into a bright chord
        v({ noise: true, dur: 0.5, level: 0.08, filter: { f: 400, to: 3200 }, q: 1.2, attack: 0.12 });
        for (const f of [783.99, 987.77, 1174.66]) v({ f, dur: 0.55, level: 0.035, type: 'triangle', attack: 0.02, at: at + 0.18 });
        break;
      case 'flowEnd':
        v({ f: 1200, to: 300, dur: 0.4, level: 0.04, type: 'triangle' });
        v({ noise: true, dur: 0.35, level: 0.04, filter: { f: 2000, to: 400 }, q: 1 });
        break;
      case 'smash': // crunchy hit
        v({ noise: true, dur: 0.25, level: 0.16, filter: { f: 2500, to: 600, type: 'lowpass' } });
        v({ f: 140 * jitter, to: 70, dur: 0.16, level: 0.08, type: 'square', filter: { f: 900, type: 'lowpass' } });
        v({ noise: true, dur: 0.1, level: 0.06, filter: { f: 4000, type: 'highpass' }, at: at + 0.02 });
        break;
      case 'hive': // a buzz as the hive comes aboard, then a pop
        v({ f: 233, dur: 0.35, level: 0.05, type: 'sawtooth', filter: { f: 1000 }, q: 2, tremolo: 25, attack: 0.02 });
        v({ noise: true, dur: 0.04, level: 0.1, filter: { f: 2500 }, q: 2, at: at + 0.06 });
        v({ f: 900, to: 1400, dur: 0.07, level: 0.05, type: 'triangle', at: at + 0.06 });
        break;
      case 'honey':
        v({ f: 1567.98, dur: 0.4, level: 0.05, type: 'triangle' });
        v({ f: 2093, dur: 0.45, level: 0.045, type: 'triangle', at: at + 0.07 });
        v({ f: 3135.96, dur: 0.3, level: 0.02, type: 'sine', at: at + 0.12 });
        break;
      case 'alarm': // noticed: two clashing stabs
        for (const d of [0, 0.2]) for (const f of [880, 932.33]) v({ f, dur: 0.16, level: 0.045, type: 'square', filter: { f: 3000, type: 'lowpass' }, at: at + d });
        break;
      case 'gateIn':
      case 'gateOut': {
        // Gate creak, then a little jingle: up going into the alley, down coming out.
        const up = type === 'gateIn',
          notes = up ? [659.25, 783.99, 987.77] : [987.77, 783.99, 659.25];
        v({ f: up ? 140 : 210, to: up ? 210 : 130, dur: 0.35, level: 0.04, type: 'sawtooth', filter: { f: 900 }, q: 6, tremolo: 30, attack: 0.03 });
        notes.forEach((f, i) => v({ f, dur: 0.1, level: 0.05, type: 'square', filter: { f: 5000, type: 'lowpass' }, at: at + 0.25 + i * 0.07 }));
        break;
      }
      case 'paper': // the newspaper thwaps down, then the rubber stamp
        v({ noise: true, dur: 0.07, level: 0.12, filter: { f: 1800 }, q: 0.8 });
        v({ f: 110, to: 70, dur: 0.12, level: 0.16, type: 'sine', at: at + 0.25 });
        v({ noise: true, dur: 0.06, level: 0.08, filter: { f: 800, type: 'lowpass' }, at: at + 0.25 });
        break;
      case 'bubble': // training station
        v({ f: 400, to: 1200, dur: 0.08, level: 0.07, type: 'sine' });
        v({ f: 600, to: 1500, dur: 0.06, level: 0.05, type: 'sine', at: at + 0.05 });
        break;
      case 'success':
        [783.99, 987.77, 1174.66, 1567.98].forEach((f, i) => v({ f, dur: 0.12, level: 0.05, type: 'square', filter: { f: 5000, type: 'lowpass' }, at: at + i * 0.06 }));
        break;
      case 'retry':
        v({ f: 330, to: 262, dur: 0.16, level: 0.05, type: 'triangle' });
        v({ f: 262, to: 196, dur: 0.2, level: 0.05, type: 'triangle', at: at + 0.12 });
        break;
      case 'getup':
        v({ f: 500 * jitter, to: 900, dur: 0.07, level: 0.05, type: 'triangle' });
        v({ noise: true, dur: 0.03, level: 0.05, filter: { f: 2000 }, q: 2 });
        break;
      case 'tap': // wipeout button-mash
        v({ f: 1200 * jitter, dur: 0.025, level: 0.03, type: 'triangle' });
        break;
      case 'heartbeat':
        v({ f: 70, to: 50, dur: 0.12, level: 0.25, type: 'sine' });
        v({ f: 64, to: 46, dur: 0.12, level: 0.2, type: 'sine', at: at + 0.18 });
        break;
      case 'sad':
        v({ f: 392, to: 370, dur: 0.3, level: 0.07, type: 'sawtooth', filter: { f: 1400, type: 'lowpass' } });
        v({ f: 370, to: 349, dur: 0.3, level: 0.07, type: 'sawtooth', filter: { f: 1400, type: 'lowpass' }, at: at + 0.3 });
        v({ f: 349, to: 262, dur: 0.8, level: 0.07, type: 'sawtooth', filter: { f: 1200, type: 'lowpass' }, at: at + 0.6 });
        break;
      case 'jingle':
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => v({ f, dur: 0.12, level: 0.06, type: 'square', filter: { f: 5000, type: 'lowpass' }, at: at + i * 0.07 }));
        break;
      case 'arp':
        [659.25, 783.99, 987.77, 1318.5].forEach((f, i) => v({ f, dur: 0.14, level: 0.06, type: 'triangle', at: at + i * 0.06 }));
        break;
      case 'fanfare':
        [[0, 523.25], [0.12, 659.25], [0.24, 783.99], [0.36, 1046.5]].forEach(([d, f]) => v({ f, dur: 0.5, level: 0.06, type: 'sawtooth', filter: { f: 3500, type: 'lowpass' }, at: at + d }));
        break;
      case 'swish':
        v({ noise: true, dur: 0.25, level: 0.12, filter: { f: 800, to: 4000 }, q: 2 });
        v({ f: 1568, dur: 0.25, level: 0.06, type: 'triangle', at: at + 0.12 });
        break;
      case 'horn':
        for (const f of [349.23, 440, 523.25]) v({ f, dur: 0.45, level: 0.05, type: 'sawtooth', filter: { f: 2500, type: 'lowpass' } });
        break;
      case 'honk':
        v({ f: 520, dur: 0.12, level: 0.06, type: 'square', filter: { f: 1500, type: 'lowpass' } });
        v({ f: 520, dur: 0.12, level: 0.06, type: 'square', filter: { f: 1500, type: 'lowpass' }, at: at + 0.17 });
        break;
      case 'rumble':
        v({ noise: true, dur: 0.6, level: 0.08, filter: { f: 300, type: 'lowpass' } });
        break;
      case 'tick':
        v({ f: 1800, dur: 0.03, level: 0.05, type: 'triangle' });
        break;
    }
  }
}
