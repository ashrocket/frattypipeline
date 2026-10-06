import { STEPS, finish } from './analyze.js';
// ColecoVision-flavoured chip EDM from an analysed score. The ColecoVision's TI SN76489 had three 50%-duty square
// tone channels (10-bit dividers off a 3.58 MHz clock, 4-bit volume in 2 dB steps) and one LFSR noise channel; every
// moment here stays inside that 3 + 1 budget: lead, 1/32-note chord arpeggio, octave bass that lends itself to the
// kick, and noise drums. Deterministic: the only noise is the chip's 15-bit LFSR, seeded as the chip powers up.
export const CLOCK = 3579545; // NTSC colourburst crystal
export const VOLUME = Float32Array.from({ length: 16 }, (_, k) => (k === 15 ? 0 : 10 ** (-k / 10))); // 15 = off
const GAIN = { lead: 0.24, arp: 0.16, bass: 0.27, noise: 0.21 }; // channel peaks sum below 0.95, so nothing can clip
const HISS = CLOCK / 64; // fastest noise shift rate (noise clocked by tone 3 at N = 1)
const BUILD = 16; // beats of snare roll and kick roll before each stop
const KICK = 420; // Hz where the kick's downward sweep starts
const LEAD_CENTRE = 74; // D5: where each section's melody median is moved, by whole octaves
const BLOCK = 32; // samples per envelope/pitch update; the waveform itself is per sample
const ROLES = [[/pre/, 'build'], [/chorus/, 'chorus'], [/break/, 'breakdown'], [/intro/, 'intro'], [/ring|outro/, 'outro']];
const roleOf = (id) => ROLES.find(([re]) => re.test(id))?.[1] ?? 'verse';
const midi = (m) => 440 * 2 ** ((m - 69) / 12);
const above = (pc, lo) => lo + ((((pc - lo) % 12) + 12) % 12); // lowest MIDI note ≥ lo with that pitch class

// Nearest 10-bit divider in cents: f = CLOCK / (32 · N), N = 1…1023, so high notes keep the chip's detune.
export function divider(f) {
  const n = CLOCK / 32 / f,
    lo = Math.min(1023, Math.max(1, Math.floor(n))),
    hi = Math.min(1023, lo + 1);
  return Math.abs(Math.log(n / lo)) <= Math.abs(Math.log(hi / n)) ? lo : hi;
}
export const chipFreq = (f) => CLOCK / (32 * divider(f));
export const volume = (a) => VOLUME[a >= 1 ? 0 : a > 0 ? Math.min(15, Math.round(-10 * Math.log10(a))) : 15];
export const render = (score, options) => finish(rendering(score, options));

const tone = (t, end, f, o = {}) => ({ t, end, f, atk: 0.002, dec: 1e9, sus: 1, rel: 0.004, vol: 1, ...o });
const hit = (t, o) => ({ t, end: t + 4, atk: 0.0005, rel: 0.002, sus: 0, ...o });
const rest = (t, end) => ({ t, end, f: 0, vol: 0, atk: 1, dec: 1, sus: 0, rel: 1 });

// The arrangement: per-channel note lists in beats from `from`, driven by the song's sections and stops.
export function arrange(score, grid, from, to) {
  const lead = [],
    arp = [],
    bass = [],
    noise = [],
    sections = grid.sections?.length ? grid.sections : [{ id: 'verse', from: 0, to: Infinity }],
    stops = grid.stops ?? [],
    bar = grid.beatsPerBar ?? 4;
  const sectionAt = (b) => sections.find((s) => b >= s.from && b < s.to) ?? sections.at(-1);
  const stopAt = (b) => stops.find(([a, z]) => b >= a && b < z);
  const buildAt = (b) => {
    for (const [a] of stops) if (b >= a - BUILD && b < a) return (b - a + BUILD) / BUILD;
    return -1;
  };
  const loud = (b) => {
    let e = 0;
    for (let s = b * STEPS; s < (b + 1) * STEPS; s++) e += score.energy[s] ?? 0;
    return e / STEPS;
  };
  let chord = score.key.tonic + (score.key.minor ? 12 : 0),
    crashUntil = -1;
  for (let b = from; b < to; b++) {
    const t = b - from,
      stop = stopAt(b);
    if (stop) {
      // Silent break: a rest on every channel cuts whatever was ringing.
      if (b === Math.max(from, stop[0])) for (const ch of [lead, arp, bass, noise]) ch.push(rest(t, Math.min(to, stop[1]) - from));
      continue;
    }
    if (score.chords[b >> 1] >= 0) chord = score.chords[b >> 1];
    const role = roleOf(sectionAt(b).id),
      build = buildAt(b),
      dyn = 0.8 + 0.2 * loud(b),
      big = role === 'chorus',
      groove = big || role === 'verse' || role === 'build' || build >= 0,
      root = score.bass[b] >= 0 ? score.bass[b] : chord % 12,
      low = midi(above(root, 45)); // A2 upward: the 10-bit divider bottoms out at 109 Hz
    // Bass channel: four-on-the-floor kicks (a fast sweep landing on the bass note), then the octave above.
    if (groove) {
      const kicks = build >= 0.75 ? 4 : build >= 0.5 ? 2 : 1;
      if (kicks === 1) {
        bass.push(tone(t, t + 0.5, KICK, { to: low, glide: 0.04, vol: dyn, atk: 0.0005, dec: 0.09, sus: 0.55 }));
        bass.push(tone(t + 0.5, t + 1, low * 2, { vol: 0.62 * dyn, dec: 0.12, sus: 0.7, rel: 0.01 }));
      } else
        for (let k = 0; k < kicks; k++)
          bass.push(tone(t + k / kicks, t + (k + 1) / kicks, KICK, { to: low, glide: 0.03, vol: (0.7 + 0.3 * build) * dyn, atk: 0.0005, dec: 0.07, sus: 0.4 }));
    } else if (b % 2 === 0 || b === from) bass.push(tone(t, t + 2, low, { vol: 0.7 * dyn, atk: 0.01, dec: 0.5, sus: 0.45, rel: 0.03 }));
    // Arp channel: the chord as a 1/32 arpeggio (1/16 without a groove), legato like a register write, pumped by the
    // kick like a sidechain.
    const base = above(chord % 12, 55), // G3 up: over the bass's low notes, under the lead
      notes = [base, base + (chord < 12 ? 4 : 3), base + 7, base + 12],
      cycle = big ? 4 : 3,
      per = groove ? 8 : 4,
      swell = build >= 0 ? 0.6 + 0.4 * build : 1,
      arpVol = { intro: 0.5, verse: 0.55, chorus: 0.8, build: 0.7, breakdown: 0.7, outro: 0.5 }[role] * dyn * swell;
    for (let k = 0; k < per; k++)
      arp.push(tone(t + k / per, t + (k + 1) / per, midi(notes[(b * per + k) % cycle]), { vol: arpVol, atk: 0, rel: 0, dec: 0.05, sus: 0.75, pump: groove ? (big ? 0.85 : 0.75) : 0, since: k / per }));
    // Noise channel: kick click, offbeat hats, claps on 2 and 4; a crash on the drop; a rising snare roll into stops.
    if (build >= 0) {
      const per = build < 0.25 ? 1 : build < 0.5 ? 2 : build < 0.75 ? 4 : 8;
      for (let k = 0; k < per; k++) {
        const p = build + k / per / BUILD;
        noise.push(hit(t + k / per, { rate: 3000 * (HISS / 3000) ** p, vol: (0.4 + 0.6 * p) * dyn, dec: per > 4 ? 0.03 : 0.05 }));
      }
    } else if (stops.some(([, z]) => z === b)) {
      noise.push(hit(t, { rate: HISS, vol: 0.9 * dyn, dec: 0.45 }));
      crashUntil = b + 2;
    } else if (groove && b >= crashUntil) {
      const clap = b % bar === 1 || b % bar === 3;
      noise.push(clap ? hit(t, { rate: 9000, vol: 0.85 * dyn, dec: 0.09, clap: true }) : hit(t, { rate: HISS, vol: 0.55 * dyn, dec: 0.004 }));
      if (big) noise.push(hit(t + 0.25, { rate: HISS, vol: 0.28 * dyn, dec: 0.012 }));
      noise.push(hit(t + 0.5, { rate: HISS, vol: (big ? 0.6 : 0.45) * dyn, dec: big ? 0.06 : 0.035 }));
      if (big) noise.push(hit(t + 0.75, { rate: HISS, vol: 0.28 * dyn, dec: 0.012 }));
    } else if (!groove) noise.push(hit(t + 0.5, { rate: HISS, vol: 0.3 * dyn, dec: 0.03 }));
  }
  // Lead: the detected melody, moved by whole octaves per section into the chip's singing range.
  for (const sec of sections) {
    const a = Math.max(from, sec.from) * STEPS,
      z = Math.min(to, sec.to) * STEPS,
      heard = [];
    for (let s = a; s < z; s++) if (score.melody[s]) heard.push(score.melody[s]);
    if (!heard.length) continue;
    heard.sort((x, y) => x - y);
    const shift = 12 * Math.round((LEAD_CENTRE - heard[heard.length >> 1]) / 12),
      vol = { intro: 0.6, verse: 0.75, chorus: 0.95, build: 0.8, breakdown: 0.8, outro: 0.6 }[roleOf(sec.id)];
    for (let s = a; s < z; ) {
      const m = score.melody[s];
      if (!m || stopAt(Math.floor(s / STEPS))) {
        s++;
        continue;
      }
      // A held note re-strikes on half-bar lines once it has rung for a beat, like a chip lead re-singing it.
      let e = s + 1;
      while (e < z && score.melody[e] === m && !score.attack[e] && !stopAt(Math.floor(e / STEPS)) && !(e % (2 * STEPS) === 0 && e - s >= STEPS)) e++;
      let note = m + shift;
      while (note > 92) note -= 12;
      while (note < 64) note += 12;
      lead.push(tone(s / STEPS - from, e / STEPS - from, midi(note), { vol: vol * (0.85 + 0.15 * score.energy[s]), atk: 0.004, dec: 0.25, sus: 0.65, rel: 0.02, vib: e - s >= 4 }));
      s = e;
    }
  }
  for (const ch of [lead, arp, bass, noise]) ch.sort((x, y) => x.t - y.t);
  return { lead, arp, bass, noise };
}

// Renders beats [from, to) of the score at `tempo` (0.75 = training): a mono loop, samples = beats · beat · rate.
export function* rendering(score, { from, to, tempo = 1, sampleRate = 24000, grid }) {
  const beat = grid.beatS / tempo,
    spb = beat * sampleRate,
    out = new Float32Array(Math.round((to - from) * spb));
  yield;
  const song = arrange(score, grid, from, to);
  yield;
  yield* voice(out, song.lead, GAIN.lead, spb, beat, sampleRate, false);
  yield* voice(out, song.arp, GAIN.arp, spb, beat, sampleRate, false);
  yield* voice(out, song.bass, GAIN.bass, spb, beat, sampleRate, false);
  yield* voice(out, song.noise, GAIN.noise, spb, beat, sampleRate, true);
  yield* master(out, sampleRate);
  return out;
}

// One monophonic channel: each note runs until the next starts. Pitch and volume are re-quantized every block
// (divider, 2 dB steps); the waveform is a PolyBLEP square (or the LFSR) per sample, with a 0.4 ms slew on volume.
function* voice(out, notes, gain, spb, beat, sr, noisy) {
  const len = out.length,
    slew = 1 - Math.exp(-1 / (0.0004 * sr)),
    bounds = notes.map((n) => Math.round(n.t * spb));
  let i = 0,
    j = 0,
    phase = 0,
    inc = 0,
    amp = 0,
    lfsr = 0x4000, // free-running: resetting it per hit would start every hit on the same run of zeros (a DC thump)
    blocks = 0;
  while (j < len) {
    while (i < notes.length && (i + 1 < notes.length ? bounds[i + 1] : len) <= j) i++;
    const n = i < notes.length && bounds[i] <= j ? notes[i] : null,
      a = n ? bounds[i] : 0,
      z = n ? Math.min(len, i + 1 < notes.length ? bounds[i + 1] : len, Math.round(n.end * spb)) : len,
      stop = Math.min(len, j + BLOCK, n ? (j < z ? z : i + 1 < notes.length ? bounds[i + 1] : len) : i < notes.length ? bounds[i] : len);
    let target = 0;
    if (n && j < z && n.vol > 0) {
      const t = (j - a) / sr,
        left = (z - j) / sr;
      let e = t < n.atk ? t / n.atk : n.sus + (1 - n.sus) * Math.exp(-(t - n.atk) / n.dec);
      if (left < n.rel) e *= left / n.rel;
      if (n.clap && t < 0.024) e *= 0.55 + 0.45 * Math.exp(-(t % 0.008) / 0.002); // three quick flams
      if (n.pump) e *= 1 - n.pump * Math.exp(-(n.since * beat + t) / 0.06);
      target = gain * volume(n.vol * e);
      if (noisy) inc = n.rate / sr;
      else {
        let f = n.to ? n.f * (n.to / n.f) ** Math.min(1, t / n.glide) : n.f;
        if (n.vib && t > 0.15) f *= 2 ** ((0.25 / 12) * Math.sin(2 * Math.PI * 5.5 * (t - 0.15)) * Math.min(1, (t - 0.15) / 0.15));
        inc = chipFreq(f) / sr;
      }
    }
    if (target === 0 && amp < 1e-5) {
      amp = 0;
      j = stop;
      continue;
    }
    if (noisy)
      for (let k = j; k < stop; k++) {
        phase += inc;
        while (phase >= 1) {
          phase -= 1;
          lfsr = (lfsr >> 1) | (((lfsr ^ (lfsr >> 1)) & 1) << 14); // 15-bit white noise, taps 0 and 1
        }
        amp += (target - amp) * slew;
        out[k] += lfsr & 1 ? amp : -amp;
      }
    else
      for (let k = j; k < stop; k++) {
        let v = phase < 0.5 ? 1 : -1;
        if (phase < inc) {
          const x = phase / inc;
          v += x + x - x * x - 1;
        } else if (phase > 1 - inc) {
          const x = (phase - 1) / inc;
          v += x * x + x + x + 1;
        }
        const q = phase < 0.5 ? phase + 0.5 : phase - 0.5;
        if (q < inc) {
          const x = q / inc;
          v -= x + x - x * x - 1;
        } else if (q > 1 - inc) {
          const x = (q - 1) / inc;
          v -= x * x + x + x + 1;
        }
        amp += (target - amp) * slew;
        out[k] += amp * v;
        phase += inc;
        if (phase >= 1) phase -= 1;
      }
    j = stop;
    if (++blocks % 2048 === 0) yield;
  }
}

// TV-speaker one-pole low-pass, zero mean, 2 ms fades at both ends so the loop seam meets at silence.
function* master(out, sr) {
  const k = 1 - Math.exp((-2 * Math.PI * Math.min(8000, sr * 0.4)) / sr),
    fade = Math.min(out.length >> 1, Math.round(0.002 * sr)),
    CHUNK = 1 << 18;
  let y = 0,
    sum = 0,
    peak = 0;
  for (let i = 0; i < out.length; i++) {
    y += (out[i] - y) * k;
    out[i] = y;
    sum += y;
    if (i % CHUNK === CHUNK - 1) yield;
  }
  const mean = sum / (out.length || 1);
  for (let i = 0; i < out.length; i++) {
    let v = out[i] - mean;
    if (i < fade) v *= i / fade;
    else if (i >= out.length - fade) v *= (out.length - 1 - i) / fade;
    out[i] = v;
    peak = Math.max(peak, Math.abs(v));
    if (i % CHUNK === CHUNK - 1) yield;
  }
  if (peak > 0.95) for (let i = 0; i < out.length; i++) out[i] *= 0.95 / peak;
}
