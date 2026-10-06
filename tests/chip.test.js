import assert from 'node:assert/strict';
import test from 'node:test';
import { analyze, NAMES } from '../src/chip/analyze.js';
import { CLOCK, VOLUME, divider, chipFreq, volume, render, arrange } from '../src/chip/synth.js';
import { chipJob } from '../src/chip/job.js';
import { GameAudio } from '../src/audio.js';
import { BEAT_S, FIRST_BEAT_S, BEATMAP } from '../src/data/tuning.js';

const GRID = { beatS: BEAT_S, firstBeatS: FIRST_BEAT_S, beatsPerBar: 4, sections: BEATMAP.sections, stops: BEATMAP.stops };
const SR = 8000; // renders are checked at a low rate to keep the suite fast
const cents = (a, b) => 1200 * Math.log2(a / b);
const midi = (m) => 440 * 2 ** ((m - 69) / 12);
// G C D G | Em C D G, one chord per half bar, as [root, minor].
const PROG = [[7, 0], [0, 0], [2, 0], [7, 0], [4, 1], [0, 0], [2, 0], [7, 0]];
const MELODY = [[4, 7, 12, -1], [7, 4, 0, 4]]; // per half bar: four 8ths above the chord root (-1 = rest)

// A score shaped like the analyser's output, covering the whole song, without needing audio.
function fakeScore(beats = 776) {
  const steps = beats * 4,
    score = {
      beats,
      stepsPerBeat: 4,
      key: { tonic: 7, minor: false, name: 'G major' },
      melody: new Uint8Array(steps),
      attack: new Uint8Array(steps),
      chords: new Int8Array(beats / 2),
      bass: new Int8Array(beats),
      energy: new Float32Array(steps).fill(0.8),
      onset: new Float32Array(steps),
    };
  for (let b = 0; b < beats; b++) {
    const [root, minor] = PROG[(b >> 1) % 8];
    if (b % 2 === 0) score.chords[b >> 1] = root + 12 * minor;
    score.bass[b] = root;
    for (let e = 0; e < 2; e++) {
      const off = MELODY[(b >> 1) % 2][(b % 2) * 2 + e];
      if (off < 0) continue;
      score.melody[b * 4 + e * 2] = score.melody[b * 4 + e * 2 + 1] = 60 + root + off;
      score.attack[b * 4 + e * 2] = 1;
    }
  }
  return score;
}

// A synthetic song on the real beat grid: triads, a bass line, an 8th-note melody, kick and hats.
function fakeSong(beats = 64, sr = 22050) {
  const n = Math.ceil((FIRST_BEAT_S + beats * BEAT_S + 0.4) * sr),
    x = new Float32Array(n),
    truth = { chords: [], bass: [], melody: new Int16Array(beats * 4).fill(-1) };
  let seed = 7;
  const noise = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 31 - 1;
  const tone = (m, t0, t1, amp, harmonics) => {
    const w = (2 * Math.PI * midi(m)) / sr,
      i0 = Math.round(t0 * sr),
      i1 = Math.min(n, Math.round(t1 * sr));
    for (let i = i0; i < i1; i++) {
      const k = i - i0,
        env = Math.min(1, k / 200, (i1 - i) / 200);
      let v = 0;
      for (let h = 1; h <= harmonics; h++) v += Math.sin(w * h * k) / h;
      x[i] += amp * env * v;
    }
  };
  for (let b = 0; b < beats; b++) {
    const t = FIRST_BEAT_S + b * BEAT_S,
      [root, minor] = PROG[(b >> 1) % 8];
    if (b % 2 === 0) {
      truth.chords.push(root + 12 * minor);
      for (const iv of [0, minor ? 3 : 4, 7]) tone(55 + ((root + 5) % 12) + iv, t, t + 2 * BEAT_S, 0.035, 5);
    }
    truth.bass.push(root);
    tone(36 + root, t, t + 0.9 * BEAT_S, 0.16, 6);
    for (let e = 0; e < 2; e++) {
      const off = MELODY[(b >> 1) % 2][(b % 2) * 2 + e];
      if (off < 0) continue;
      tone(60 + root + off, t + (e * BEAT_S) / 2, t + ((e + 1) * BEAT_S) / 2, 0.12, 6);
      truth.melody[b * 4 + e * 2] = truth.melody[b * 4 + e * 2 + 1] = (root + off) % 12;
    }
    for (let i = Math.round(t * sr), k = 0; k < 0.08 * sr; i++, k++) x[i] += 0.3 * Math.exp(-k / (0.02 * sr)) * Math.sin(2 * Math.PI * (55 + 80 * Math.exp(-k / 300)) * (k / sr));
    for (let i = Math.round((t + BEAT_S / 2) * sr), k = 0; k < 0.04 * sr; i++, k++) x[i] += 0.05 * Math.exp(-k / (0.01 * sr)) * noise();
  }
  return { pcm: x, truth };
}
function stats(x) {
  let peak = 0,
    sum = 0,
    bad = 0;
  for (const v of x) {
    if (!Number.isFinite(v)) bad++;
    peak = Math.max(peak, Math.abs(v));
    sum += v;
  }
  return { peak, mean: sum / x.length, bad };
}
const rms = (x, a, z) => {
  let s = 0;
  for (let i = Math.round(a); i < Math.round(z); i++) s += x[i] * x[i];
  return Math.sqrt(s / Math.max(1, Math.round(z) - Math.round(a)));
};

test('SN76489 tone dividers: A4 lands on the nearest 3579545 / (32·N), high notes keep the detune, ~109 Hz floor', () => {
  assert.equal(CLOCK, 3579545);
  assert.equal(divider(440), 254);
  assert.equal(chipFreq(440), CLOCK / (32 * 254));
  for (const n of [253, 255]) assert.ok(Math.abs(cents(chipFreq(440), 440)) < Math.abs(cents(CLOCK / (32 * n), 440)));
  for (let m = 45; m <= 96; m++) {
    const f = chipFreq(midi(m)),
      n = divider(midi(m));
    assert.equal(f, CLOCK / (32 * n));
    for (const other of [n - 1, n + 1].filter((d) => d >= 1 && d <= 1023)) assert.ok(Math.abs(cents(f, midi(m))) <= Math.abs(cents(CLOCK / (32 * other), midi(m))) + 1e-9);
  }
  assert.ok(Math.abs(cents(chipFreq(midi(96)), midi(96))) > 10, 'C7 sits audibly off true pitch, as on the chip');
  assert.equal(chipFreq(30), CLOCK / (32 * 1023));
  assert.equal(chipFreq(1e6), CLOCK / 32);
});

test('4-bit volume: 2 dB attenuation steps, 15 is silence', () => {
  assert.equal(VOLUME.length, 16);
  for (let k = 1; k < 15; k++) assert.ok(Math.abs(20 * Math.log10(VOLUME[k - 1] / VOLUME[k]) - 2) < 1e-5);
  assert.equal(VOLUME[15], 0);
  assert.equal(volume(1), 1);
  assert.equal(volume(0), 0);
  assert.equal(volume(0.5), VOLUME[3]);
  assert.equal(volume(0.01), 0);
});

test('chip renders: deterministic, beats × beat length × rate long, training exactly 4/3 as long, clean and loopable', () => {
  const score = fakeScore(),
    training = render(score, { from: 0, to: 328, tempo: 0.75, sampleRate: SR, grid: GRID }),
    again = render(score, { from: 0, to: 328, tempo: 0.75, sampleRate: SR, grid: GRID }),
    sameAtFull = render(score, { from: 0, to: 328, tempo: 1, sampleRate: SR, grid: GRID }),
    run = render(score, { from: 8, to: 744, tempo: 1, sampleRate: SR, grid: GRID });
  assert.ok(Buffer.from(training.buffer).equals(Buffer.from(again.buffer)), 'same score, same samples');
  assert.ok(Math.abs(training.length - (328 * BEAT_S * SR) / 0.75) <= 1);
  assert.ok(Math.abs(sameAtFull.length - 328 * BEAT_S * SR) <= 1);
  assert.ok(Math.abs(run.length - 736 * BEAT_S * SR) <= 1);
  assert.ok(Math.abs(training.length - (sameAtFull.length * 4) / 3) <= 1);
  for (const x of [training, sameAtFull, run]) {
    const { peak, mean, bad } = stats(x);
    assert.equal(bad, 0);
    assert.ok(peak <= 0.95 && peak > 0.2, `peak ${peak}`);
    assert.ok(Math.abs(mean) < 1e-3, `mean ${mean}`);
    // The loop seam meets at silence: last sample flows into the first with no step.
    assert.ok(Math.abs(x[0]) < 1e-6 && Math.abs(x.at(-1)) < 1e-6);
    assert.ok(Math.abs(x[1]) < 0.05 && Math.abs(x.at(-2)) < 0.05);
  }
});

test('arrangement: 3 tone + 1 noise monophonic channels, silent stops, a crash on each drop, kick on every beat', () => {
  const score = fakeScore(),
    song = arrange(score, GRID, 8, 744);
  assert.deepEqual(Object.keys(song).sort(), ['arp', 'bass', 'lead', 'noise']);
  for (const notes of Object.values(song)) for (let i = 1; i < notes.length; i++) assert.ok(notes[i].t >= notes[i - 1].t);
  for (const [a, z] of BEATMAP.stops)
    for (const notes of Object.values(song)) assert.ok(!notes.some((n) => n.vol > 0 && n.t + 8 >= a && n.t + 8 < z), `nothing sounds in the stop at ${a}`);
  const run = render(score, { from: 8, to: 744, tempo: 1, sampleRate: SR, grid: GRID }),
    at = (beat) => (beat - 8) * BEAT_S * SR;
  for (const [a, z] of BEATMAP.stops) {
    assert.ok(rms(run, at(a) + 0.03 * SR, at(z)) < 1e-4, `stop ${a} is silent`);
    assert.ok(rms(run, at(z), at(z + 1)) > 0.05, `drop at ${z} is loud`);
    assert.ok(song.noise.some((n) => n.t + 8 === z && n.dec > 0.3), `crash at ${z}`);
  }
  const verse = song.bass.filter((n) => n.t + 8 >= 16 && n.t + 8 < 48 && n.to);
  assert.equal(verse.length, 32, 'four-on-the-floor kick sweeps on the bass channel');
});

test('analysis recovers the key, chord roots and bass roots of a synthetic song on the beat grid', () => {
  const { pcm, truth } = fakeSong(),
    score = analyze(pcm, 22050, { beatS: BEAT_S, firstBeatS: FIRST_BEAT_S, beatsPerBar: 4 });
  assert.equal(score.key.name, 'G major');
  assert.ok(Math.abs(score.tuning) < 0.1);
  const chords = truth.chords.filter((c, h) => score.chords[h] >= 0 && score.chords[h] % 12 === c % 12).length / truth.chords.length,
    bass = truth.bass.filter((r, b) => score.bass[b] === r).length / truth.bass.length;
  let heard = 0,
    right = 0;
  truth.melody.forEach((pc, s) => {
    if (pc < 0) return;
    heard++;
    if (score.melody[s] && score.melody[s] % 12 === pc) right++;
  });
  assert.ok(chords >= 0.8, `chord roots ${chords}`);
  assert.ok(bass >= 0.8, `bass roots ${bass}`);
  assert.ok(right / heard >= 0.7, `melody pitch classes ${right / heard}`);
  assert.equal(NAMES[score.chords[0] % 12], 'G');
});

test('the worker job posts the score, then training, then the run loop', () => {
  const { pcm } = fakeSong(16),
    renders = [
      { id: 'training', from: 0, to: 16, tempo: 0.75, sampleRate: 4000 },
      { id: 'run', from: 8, to: 16, tempo: 1, sampleRate: 4000 },
    ],
    results = [...chipJob({ pcm, sampleRate: 22050, grid: GRID, renders })].filter(Boolean);
  assert.deepEqual(results.map((r) => r.id), ['score', 'training', 'run']);
  assert.ok(results[1].pcm instanceof Float32Array && results[1].sampleRate === 4000);
  assert.ok(Math.abs(results[2].pcm.length - 8 * BEAT_S * 4000) <= 1);
});

test('GameAudio: the song plays once to beat 768, then chip beat 8 + ((b − 768) mod 736); a late chip joins on a bar line', () => {
  const audio = Object.create(GameAudio.prototype);
  Object.assign(audio, { chip: { run: {} }, chipAt: null, training: false, available: true, origin: 0, running: false });
  audio.planChip(0);
  assert.equal(audio.chipAt, 768);
  const chipBeat = (b) => 8 + audio.chipOffset(b) / BEAT_S;
  for (const [b, c] of [[768, 8], [800, 40], [1503, 743], [1504, 8], [768 + 736 * 3 + 5, 13]]) assert.ok(Math.abs(chipBeat(b) - c) < 1e-9, `run beat ${b}`);
  audio.pausedBeat = 767.5;
  assert.equal(audio.musicMode, 'song');
  audio.pausedBeat = 768;
  assert.equal(audio.musicMode, 'chip');
  // The chip arrived after the song wrapped at 744: switch at the next bar, carrying on from the song loop's place.
  audio.chipAt = null;
  audio.planChip(901);
  assert.equal(audio.chipAt, 904);
  assert.ok(Math.abs(chipBeat(904) - (8 + ((904 - 744) % 736))) < 1e-9);
  audio.training = true;
  assert.equal(audio.musicMode, null, 'training music only counts once it plays');
  assert.equal(audio.chipReady, true);
});

// Just enough of the Web Audio API to watch what GameAudio schedules.
function fakeContext() {
  const param = (value = 1) => ({ value, events: [], setValueAtTime(v, t) { this.events.push(['set', v, t]); }, linearRampToValueAtTime(v, t) { this.events.push(['ramp', v, t]); }, exponentialRampToValueAtTime(v, t) { this.events.push(['exp', v, t]); }, setTargetAtTime(v, t) { this.events.push(['target', v, t]); }, cancelScheduledValues(t) { this.events.push(['cancel', t]); } });
  const node = (extra = {}) => ({ connect: (next) => next, disconnect() {}, ...extra });
  const ctx = {
    currentTime: 0,
    sampleRate: 48000,
    state: 'running',
    outputLatency: 0,
    destination: node(),
    sources: [],
    createGain: () => node({ gain: param(1) }),
    createBiquadFilter: () => node({ type: 'lowpass', frequency: param(350), Q: param(1) }),
    createDynamicsCompressor: () => node({ threshold: param(), ratio: param(), attack: param(), release: param(), knee: param() }),
    createOscillator: () => node({ frequency: param(440), stops: [], start() {}, stop(when = ctx.currentTime) { this.stops.push(when); } }),
    createBuffer: (channels, length, sampleRate) => ({ numberOfChannels: channels, length, sampleRate, duration: length / sampleRate, data: new Float32Array(length), getChannelData() { return this.data; }, copyToChannel(pcm) { this.data.set(pcm); } }),
    createBufferSource() {
      const source = node({ loop: false, starts: [], stops: [], start(when, offset = 0) { this.starts.push([when, offset]); }, stop(when = ctx.currentTime) { this.stops.push(when); } });
      ctx.sources.push(source);
      return source;
    },
    resume: async () => {},
    suspend: async () => {},
  };
  return ctx;
}

test('GameAudio music: skate school loops the song intro, the run plays the song once, the chip takes over at 768', async () => {
  const ctx = fakeContext(),
    audio = GameAudio.offline(ctx),
    near = (a, b) => Math.abs(a - b) < 1e-6;
  audio.available = true;
  audio.startTraining();
  assert.equal(audio.musicMode, null, 'nothing to play until the song is decoded');
  audio.buffer = ctx.createBuffer(2, 25000, 1000);
  audio.buffer.data.forEach((_, i, a) => (a[i] = i / 25000));
  audio.playTraining();
  const training = ctx.sources.at(-1),
    [from, to] = BEATMAP.loops.tutorial;
  assert.equal(audio.musicMode, 'training');
  assert.ok(training.loop, 'the intro loops for all of skate school');
  assert.equal(to - from, 64, 'sixteen bars: two whole passes of the chord cycle');
  assert.ok(FIRST_BEAT_S + to * BEAT_S + 0.012 < BEATMAP.firstVocalS, 'ends (with its crossfade) before the first sung note');
  assert.equal(training.buffer.length, Math.round(64 * BEAT_S * 1000));
  assert.ok(near(training.buffer.data[30], (Math.round((FIRST_BEAT_S + from * BEAT_S) * 1000) + 30) / 25000), 'cut from the song itself');
  assert.equal(training.starts[0][0], 0);
  ctx.currentTime = 30;
  audio.pause(0);
  assert.equal(await audio.resume(0), 0);
  assert.equal(training.stops.length, 0, 'pause/resume carries the training loop on');
  audio.startRun();
  assert.ok(training.stops[0] > 30 && training.stops[0] < 30.3, 'training fades out quickly');
  const song = ctx.sources.at(-1);
  assert.equal(song.buffer, audio.buffer);
  assert.ok(song.loop, 'until the chip loop exists the song loops 8–744 as before');
  assert.ok(near(song.starts[0][0], 30.04) && near(song.starts[0][1], 0), 'the song starts from the top');
  assert.equal(audio.musicMode, 'song');
  ctx.currentTime = 30.04 + FIRST_BEAT_S + 10 * BEAT_S;
  audio.chipDone({ id: 'run', pcm: new Float32Array(480), sampleRate: 24000 });
  const chip = ctx.sources.at(-1),
    switchAt = audio.audioTime(768);
  assert.equal(song.loop, false, 'with the chip ready the song plays through its ring-out once');
  assert.ok(near(chip.starts[0][0], switchAt) && near(chip.starts[0][1], 0), 'chip beat 8 starts exactly on run beat 768');
  assert.ok(chip.loop && near(song.stops[0], switchAt + 0.04));
  ctx.currentTime = audio.audioTime(800);
  assert.equal(audio.musicMode, 'chip');
  audio.pause(800);
  assert.equal(await audio.resume(800), 796);
  const resumed = ctx.sources.at(-1);
  assert.notEqual(resumed, chip);
  assert.equal(resumed.buffer, audio.chip.run);
  assert.ok(near(resumed.starts[0][1], 28 * BEAT_S), 'resume maps run beat 796 to chip beat 36');
  // A chip version that turns up after the song has wrapped joins on the next bar line.
  audio.startRun();
  audio.chip.run = null;
  audio.chipAt = null;
  audio.stopSource();
  audio.playSource(ctx.currentTime);
  ctx.currentTime = audio.audioTime(901);
  audio.chipDone({ id: 'run', pcm: new Float32Array(480), sampleRate: 24000 });
  const late = ctx.sources.at(-1);
  assert.equal(audio.chipAt, 904);
  assert.ok(near(late.starts[0][0], audio.audioTime(904)) && near(late.starts[0][1], 160 * BEAT_S));
});

test('v5 SFX: every new sim event makes a short, bounded sound; grinds sustain until grindEnd', () => {
  const ctx = fakeContext(),
    audio = GameAudio.offline(ctx),
    events = [
      { type: 'kick' }, { type: 'kick', lazy: true }, { type: 'light' }, { type: 'flip' }, { type: 'slide' }, { type: 'land', clean: true }, { type: 'land', clean: false, big: true },
      { type: 'stumble' }, { type: 'trick', parts: 3 }, { type: 'combo', mult: 4, parts: [] }, { type: 'comboLost' }, { type: 'flow' }, { type: 'flowEnd' }, { type: 'smash', kind: 'cart' },
      { type: 'hive', full: true }, { type: 'honey' }, { type: 'noticed' }, { type: 'alleyEnter' }, { type: 'alleyExit' }, { type: 'newspaper' }, { type: 'station' },
      { type: 'stationDone' }, { type: 'stationRetry' }, { type: 'trainingStart' }, { type: 'trainingDone' }, { type: 'practiceHit' }, { type: 'practiceMiss' },
      { type: 'getup' }, { type: 'mash' }, { type: 'ollie', perfect: true }, { type: 'ollie' }, { type: 'houseEmpty', house: 2 },
    ];
  events.forEach((e, i) => {
    const before = audio.voices.length,
      at = i * 2;
    audio.event(e, at);
    const made = audio.voices.filter((v) => v.end > at);
    assert.ok(audio.voices.length > before || made.length, `${e.type} makes a sound`);
    assert.ok(made.every((v) => v.end - at < 1.6), `${e.type} stays short`);
    assert.ok(audio.voices.length <= 28);
  });
  for (const kind of ['curb', 'bench', 'rail', 'ledge']) {
    audio.event({ type: 'grind', kind }, 100);
    const scrape = audio.grinding;
    assert.equal(scrape.length, 2, `${kind} grind`);
    assert.ok(scrape.every((v) => v.held >= 104), 'the scrape holds while grinding');
    audio.event({ type: 'grindEnd', kind, seconds: 0.8 }, 100.8);
    assert.equal(audio.grinding, null);
    assert.ok(scrape.every((v) => v.source.stops.at(-1) <= 101 && v.end <= 101), 'grindEnd cuts it');
  }
});
test('seamless loops: the end of the slice is crossfaded into its start, so the wrap continues the waveform', async () => {
  const { loopSamples } = await import('../src/loop.js');
  const data = Float32Array.from({ length: 1000 }, (_, i) => Math.sin(i * 0.37));
  const out = loopSamples(data, 100, 600, 12);
  assert.equal(out.length, 600);
  assert.ok(Math.abs(out[0] - data[700]) < 1e-6, 'sample 0 is what follows the loop end');
  assert.ok(Math.abs(out[599] - data[699]) < 1e-6);
  assert.ok(Math.abs(out[20] - data[120]) < 1e-6, 'past the crossfade it is the original');
  for (let i = 1; i < 12; i++) assert.ok(Math.abs(out[i] - out[i - 1]) < 0.5, 'no jump inside the crossfade');
});

const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;
// Records which named sounds GameAudio plays, while still playing them.
function listen(audio) {
  const played = [],
    sound = audio.sound;
  audio.sound = function (type, ...rest) {
    played.push(type);
    return sound.call(this, type, ...rest);
  };
  return played;
}

test('GameAudio stop(): leaving ends the skate-school loop, the song, the chip loop, queued stings and every SFX voice', () => {
  const ctx = fakeContext(),
    audio = GameAudio.offline(ctx);
  audio.available = true;
  audio.buffer = ctx.createBuffer(2, 25000, 1000);
  audio.startTraining();
  const training = ctx.sources.at(-1);
  audio.event({ type: 'grind', kind: 'rail' }, 0);
  audio.event({ type: 'flow' }, 0);
  audio.stop();
  assert.ok(training.stops.length === 1 && training.stops[0] <= 0.05, 'the intro loop stops at once');
  assert.equal(audio.training, false);
  assert.equal(audio.musicMode, null);
  assert.equal(audio.grinding, null);
  assert.equal(audio.voices.length, 0);
  audio.startRun();
  const song = ctx.sources.at(-1);
  ctx.currentTime = 5;
  audio.chipDone({ id: 'run', pcm: new Float32Array(480), sampleRate: 24000 });
  const chip = ctx.sources.at(-1);
  assert.equal(chip.buffer, audio.chip.run);
  audio.event({ type: 'houseGone' }, 5);
  assert.ok(audio.pending.length > 0, 'a sting is queued on the beat');
  audio.stop();
  audio.pause(0);
  assert.equal(song.stops.at(-1), 5, 'the song stops now, not just suspended');
  assert.deepEqual(chip.stops, [5], 'the scheduled chip loop is stopped too');
  assert.deepEqual(audio.pending, []);
  assert.equal(audio.running, false);
  assert.equal(audio.musicMode, null);
  // A chip render finishing after leaving schedules nothing; the title screen's START resuming the context plays nothing old.
  const before = ctx.sources.length;
  audio.chip = {};
  audio.chipDone({ id: 'run', pcm: new Float32Array(480), sampleRate: 24000 });
  ctx.currentTime = 9;
  audio.tick();
  assert.equal(ctx.sources.length, before);
});

test('GameAudio resume: the count-in rewinds four beats; { countIn: false } (the newspaper) resumes exactly at the paused beat', async () => {
  const ctx = fakeContext(),
    audio = GameAudio.offline(ctx);
  audio.available = true;
  audio.buffer = ctx.createBuffer(2, 25000, 1000);
  audio.startRun();
  ctx.currentTime = 10;
  audio.pause(20);
  assert.equal(await audio.resume(20, { countIn: false }), 20);
  assert.ok(near(audio.origin, 10 - 20 * BEAT_S), 'beat 20 is now');
  assert.ok(near(ctx.sources.at(-1).starts[0][1], FIRST_BEAT_S + 20 * BEAT_S), 'the song picks up where it paused');
  ctx.currentTime = 12;
  audio.pause(20);
  assert.equal(await audio.resume(20), 16);
  assert.ok(near(audio.origin, 12 - 16 * BEAT_S));
  assert.ok(near(ctx.sources.at(-1).starts[0][1], FIRST_BEAT_S + 16 * BEAT_S), 'four beats of lead-in under the 3·2·1');
});

test('grind scrape: outlasts the longest curb, ends on capture/wipeout/start/level changes without a stray scuff, and survives a pause', async () => {
  const ctx = fakeContext(),
    audio = GameAudio.offline(ctx),
    played = listen(audio);
  ['captured', 'wipeout', 'start', 'trainingStart', 'trainingDone', 'alleyEnter', 'alleyExit', 'newspaper', 'victory'].forEach((type, i) => {
    const at = 20 + i * 20;
    audio.event({ type: 'grind', kind: 'curb' }, at);
    const scrape = audio.grinding;
    assert.equal(scrape.length, 2);
    assert.ok(scrape.every((v) => v.held >= at + 25.6 / 3), 'holds past the longest curb at grindMinSpeed');
    played.length = 0;
    audio.event({ type }, at + 1);
    assert.equal(audio.grinding, null, `${type} ends the scrape`);
    assert.ok(scrape.every((v) => v.source.stops.at(-1) <= at + 1.2 && v.end <= at + 1.2), `${type} cuts it`);
    assert.ok(!played.includes('scuff'), `${type}: no dismount scuff`);
  });
  // startRun()/startTraining() also clear it, so the next grind starts clean.
  audio.event({ type: 'grind', kind: 'rail' }, 300);
  ctx.currentTime = 301;
  audio.startRun();
  assert.equal(audio.grinding, null);
  played.length = 0;
  audio.event({ type: 'grind', kind: 'rail' }, 302);
  assert.ok(!played.includes('scuff'), 'no stray scuff from a grind that already ended');
  // Paused mid-grind: the scrape stops for the pause and starts again as play resumes (after the count-in).
  audio.available = false;
  ctx.currentTime = 303;
  audio.pause(40);
  const old = audio.grinding;
  assert.equal(await audio.resume(40), 36);
  assert.ok(old.every((v) => v.source.stops.at(-1) <= 303 + 1e-9), 'the paused scrape is cut');
  assert.equal(audio.grinding.length, 2);
  assert.ok(near(audio.grinding[0].source.starts[0][0], audio.audioTime(40)), 'the scrape comes back on the resume beat');
  audio.pause(40);
  await audio.resume(40, { countIn: false });
  assert.ok(near(audio.grinding[0].source.starts[0][0], 303));
  audio.event({ type: 'grindEnd' }, 304);
  assert.equal(audio.grinding, null);
});

test('houseEmpty (a beehive emptied a house) buzzes; only out-of-ammo empty plays the dud', () => {
  const ctx = fakeContext(),
    audio = GameAudio.offline(ctx),
    played = listen(audio);
  audio.event({ type: 'houseEmpty', house: 3 }, 0);
  audio.event({ type: 'empty', item: 'bottle' }, 2);
  assert.deepEqual(played, ['swarm', 'dud']);
});

test('media-element fallback (the song will not decode): skate school still loops the intro bars, and the run takes over', async () => {
  const ctx = fakeContext(),
    media = { currentTime: 0, paused: true, play() { this.paused = false; return Promise.resolve(); }, pause() { this.paused = true; } };
  ctx.decodeAudioData = async () => {
    throw Error('decode failed');
  };
  ctx.createMediaElementSource = () => ({ connect() {} });
  const audio = GameAudio.offline(ctx),
    [from, to] = BEATMAP.loops.tutorial,
    { fetch, Audio } = globalThis;
  audio.startTraining();
  assert.equal(audio.musicMode, null, 'nothing yet: the song is still loading');
  globalThis.fetch = async () => ({ ok: true, headers: { get: () => 'audio/mpeg' }, arrayBuffer: async () => new ArrayBuffer(8) });
  globalThis.Audio = function () {
    return media;
  };
  try {
    await audio.load();
  } finally {
    globalThis.fetch = fetch;
    globalThis.Audio = Audio;
  }
  assert.ok(audio.fallback && audio.available && !audio.buffer);
  assert.equal(audio.musicMode, 'training');
  assert.ok(!media.paused && near(media.currentTime, FIRST_BEAT_S + from * BEAT_S), 'plays from the intro');
  media.currentTime = FIRST_BEAT_S + to * BEAT_S + 0.01;
  audio.tick();
  assert.ok(near(media.currentTime, FIRST_BEAT_S + from * BEAT_S), 'wraps back to the start of the intro');
  audio.pause(0);
  assert.ok(media.paused);
  await audio.resume(0);
  assert.ok(!media.paused, 'resuming skate school resumes the element');
  audio.startRun();
  assert.equal(audio.trainMedia, false);
  assert.equal(audio.musicMode, 'song');
  assert.ok(!media.paused && near(media.currentTime, 0), 'the run plays the song from the top');
  audio.stop();
  assert.ok(media.paused);
});
