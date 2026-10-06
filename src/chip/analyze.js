// Song analysis for the chip arrangement: chroma, bass, melody, key and chords, measured on the song's own beat
// grid (one spectrum per 16th note), so the score lines up with BEAT_S/FIRST_BEAT_S without any tempo tracking.
// Pure and deterministic: it runs in a worker, sliced on the main thread, or in node tests.
export const STEPS = 4; // 16th notes per beat
export const NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
// Krumhansl–Kessler key profiles.
const MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
const SCALES = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10] };
const LEAD = [57, 96]; // MIDI range searched for the melody: A3–C7, ≈220–2000 Hz
const BINS = 5; // melody salience bins per semitone
const K = 4; // melody pitch candidates kept per 16th
const HARMONIC = Float64Array.from({ length: 9 }, (_, h) => (h ? 12 * Math.log2(h) : 0));
const pitchOf = (f) => 69 + 12 * Math.log2(f / 440);
const pitchClass = (n) => ((Math.round(n) % 12) + 12) % 12;
// cos² weight over ±1 semitone (Salamon & Gómez harmonic summation), tabulated: it runs millions of times per song.
const G = Float64Array.from({ length: 1025 }, (_, i) => Math.cos(((i / 512 - 1) * Math.PI) / 2) ** 2);
const g = (d) => G[Math.round((d + 1) * 512)];

// Drives a generator to completion (worker, tests); the main-thread fallback slices it between frames instead.
export function finish(job) {
  for (;;) {
    const { done, value } = job.next();
    if (done) return value;
  }
}
export const analyze = (pcm, sampleRate, grid) => finish(analyzing(pcm, sampleRate, grid));

// 23-tap Blackman halfband: we only read below 5 kHz, so its wide transition band costs nothing.
const HALFBAND = (() => {
  const taps = [];
  for (let n = 1; n <= 11; n += 2) taps.push((Math.sin((Math.PI * n) / 2) / (Math.PI * n)) * (0.42 + 0.5 * Math.cos((Math.PI * n) / 12) + 0.08 * Math.cos((Math.PI * n) / 6)));
  const sum = 0.5 + 2 * taps.reduce((a, b) => a + b, 0);
  return { centre: 0.5 / sum, taps: taps.map((t) => t / sum) };
})();
function* halving(x) {
  const [t0, t1, t2, t3, t4, t5] = HALFBAND.taps,
    c0 = HALFBAND.centre,
    y = new Float32Array(x.length >> 1),
    at = (i) => (i >= 0 && i < x.length ? x[i] : 0),
    edge = (c) => c0 * at(c) + t0 * (at(c - 1) + at(c + 1)) + t1 * (at(c - 3) + at(c + 3)) + t2 * (at(c - 5) + at(c + 5)) + t3 * (at(c - 7) + at(c + 7)) + t4 * (at(c - 9) + at(c + 9)) + t5 * (at(c - 11) + at(c + 11)),
    head = Math.min(y.length, 6),
    tail = Math.max(head, (x.length - 12) >> 1);
  for (let m = 0; m < head; m++) y[m] = edge(2 * m);
  for (let m = head; m < tail; ) {
    for (const end = Math.min(tail, m + 131072); m < end; m++) {
      const c = 2 * m;
      y[m] = c0 * x[c] + t0 * (x[c - 1] + x[c + 1]) + t1 * (x[c - 3] + x[c + 3]) + t2 * (x[c - 5] + x[c + 5]) + t3 * (x[c - 7] + x[c + 7]) + t4 * (x[c - 9] + x[c + 9]) + t5 * (x[c - 11] + x[c + 11]);
    }
    yield;
  }
  for (let m = tail; m < y.length; m++) y[m] = edge(2 * m);
  return y;
}
// Mono PCM at ~22–24 kHz: halve 44.1/48/88.2/96 kHz input until it is under 40 kHz.
function* preparing(pcm, sampleRate) {
  while (sampleRate >= 40000) {
    pcm = yield* halving(pcm);
    sampleRate /= 2;
  }
  return { pcm, sampleRate };
}

// Radix-2 real FFT: an n/2-point complex transform plus the usual split, reused for every frame.
class RealFFT {
  constructor(n) {
    const m = n >> 1,
      bits = Math.log2(m);
    Object.assign(this, { n, m, re: new Float64Array(m), im: new Float64Array(m), rev: new Uint32Array(m) });
    for (let i = 0; i < m; i++) {
      let r = 0;
      for (let b = 0, x = i; b < bits; b++, x >>= 1) r = (r << 1) | (x & 1);
      this.rev[i] = r;
    }
    this.cos = Float64Array.from({ length: m / 2 }, (_, k) => Math.cos((2 * Math.PI * k) / m));
    this.sin = Float64Array.from({ length: m / 2 }, (_, k) => Math.sin((2 * Math.PI * k) / m));
    this.wc = Float64Array.from({ length: m }, (_, k) => Math.cos((2 * Math.PI * k) / n));
    this.ws = Float64Array.from({ length: m }, (_, k) => Math.sin((2 * Math.PI * k) / n));
  }
  // Magnitudes of bins 0..n/2 of a real frame.
  magnitudes(x, out) {
    const { m, re, im, rev, cos, sin, wc, ws } = this;
    for (let i = 0; i < m; i++) {
      re[rev[i]] = x[2 * i];
      im[rev[i]] = x[2 * i + 1];
    }
    // The first two stages have trivial twiddles (1, then 1 and −i): no multiplies.
    for (let a = 0; a < m; a += 4) {
      const r0 = re[a] + re[a + 1],
        i0 = im[a] + im[a + 1],
        r1 = re[a] - re[a + 1],
        i1 = im[a] - im[a + 1],
        r2 = re[a + 2] + re[a + 3],
        i2 = im[a + 2] + im[a + 3],
        r3 = re[a + 2] - re[a + 3],
        i3 = im[a + 2] - im[a + 3];
      re[a] = r0 + r2;
      im[a] = i0 + i2;
      re[a + 2] = r0 - r2;
      im[a + 2] = i0 - i2;
      re[a + 1] = r1 + i3;
      im[a + 1] = i1 - r3;
      re[a + 3] = r1 - i3;
      im[a + 3] = i1 + r3;
    }
    for (let size = 8; size <= m; size <<= 1) {
      const half = size >> 1,
        step = m / size;
      for (let i = 0; i < m; i += size)
        for (let j = 0, k = 0; j < half; j++, k += step) {
          const a = i + j,
            b = a + half,
            tr = re[b] * cos[k] + im[b] * sin[k],
            ti = im[b] * cos[k] - re[b] * sin[k];
          re[b] = re[a] - tr;
          im[b] = im[a] - ti;
          re[a] += tr;
          im[a] += ti;
        }
    }
    out[0] = Math.abs(re[0] + im[0]);
    out[m] = Math.abs(re[0] - im[0]);
    for (let k = 1; k < m; k++) {
      const zr = re[k],
        zi = im[k],
        yr = re[m - k],
        yi = im[m - k],
        er = zr + yr,
        ei = zi - yi,
        or = zi + yi,
        oi = yr - zr,
        xr = er + wc[k] * or + ws[k] * oi,
        xi = ei + wc[k] * oi - ws[k] * or;
      out[k] = 0.5 * Math.sqrt(xr * xr + xi * xi);
    }
  }
}
// Hann window scaled so a full-scale sine reads 1.0 at its peak bin.
function hann(n) {
  return Float64Array.from({ length: n }, (_, i) => (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n)) * (4 / n));
}
function fill(frame, pcm, centre, win) {
  const start = Math.round(centre) - frame.length / 2;
  for (let i = 0; i < frame.length; i++) {
    const j = start + i;
    frame[i] = j >= 0 && j < pcm.length ? pcm[j] * win[i] : 0;
  }
}
// Spectral peaks between two bins above a floor, refined parabolically on log magnitude; returns the new count.
function peaks(mag, k0, k1, floor, hz, freq, amp, count, max) {
  const start = count;
  for (let k = Math.max(1, k0); k <= k1 && count - start < max; k++) {
    const v = mag[k];
    if (v <= floor || v <= mag[k - 1] || v < mag[k + 1]) continue;
    const l = Math.log(mag[k - 1] + 1e-12),
      c = Math.log(v),
      r = Math.log(mag[k + 1] + 1e-12),
      den = l - 2 * c + r,
      p = den < 0 ? (0.5 * (l - r)) / den : 0;
    freq[count] = (k + p) * hz;
    amp[count] = Math.exp(c - 0.25 * (l - r) * p);
    count++;
  }
  return count;
}
function quantile(values, q) {
  const sorted = Float64Array.from(values).sort();
  return sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] : 0;
}
// Pitch classes of chord id c (0–11 major on that root, 12–23 minor).
const triad = (c) => [c % 12, (c % 12) + (c < 12 ? 4 : 3), (c % 12) + 7].map((n) => n % 12);
// Diatonic triads of a key, as chord ids (root, +12 for minor), plus bVII which rock leans on.
function diatonic(tonic, minor) {
  const steps = minor ? [[0, 1], [3, 0], [5, 1], [7, 1], [7, 0], [8, 0], [10, 0]] : [[0, 0], [2, 1], [4, 1], [5, 0], [7, 0], [9, 1], [10, 0]];
  return new Set(steps.map(([d, m]) => ((tonic + d) % 12) + 12 * m));
}

export function* analyzing(input, inputRate, grid) {
  const { pcm, sampleRate: sr } = yield* preparing(input, inputRate);
  input = null; // a 44.1/48 kHz original is no longer needed
  const first = grid.firstBeatS,
    beatS = grid.beatS,
    stepS = beatS / STEPS,
    beats = Math.max(0, Math.floor((pcm.length / sr - first) / beatS)),
    steps = beats * STEPS;
  // 1. One spectrum per 16th, centred on it: loudness, spectral flux and peaks (60 Hz–5 kHz).
  const n = sr < 30000 ? 4096 : 8192,
    fft = new RealFFT(n),
    win = hann(n),
    frame = new Float64Array(n),
    hz = sr / n,
    k0 = Math.floor(60 / hz),
    k1 = Math.min(n / 2 - 1, Math.ceil(5000 / hz)),
    MAXP = 160;
  const mag = new Float64Array(n / 2 + 1),
    edges = Array.from({ length: 25 }, (_, i) => Math.round((60 * (5000 / 60) ** (i / 24)) / hz)); // 24 log-spaced bands for flux
  let bands = new Float64Array(24),
    prev = new Float64Array(24);
  const peakF = new Float32Array(steps * MAXP),
    peakA = new Float32Array(steps * MAXP),
    peakAt = new Uint32Array(steps + 1),
    rms = new Float32Array(steps),
    flux = new Float32Array(steps);
  let count = 0;
  for (let s = 0; s < steps; s++) {
    const t = first + s * stepS,
      i0 = Math.round(t * sr),
      i1 = Math.min(pcm.length, Math.round((t + stepS) * sr));
    let e = 0;
    for (let i = i0; i < i1; i++) e += pcm[i] * pcm[i];
    rms[s] = Math.sqrt(e / Math.max(1, i1 - i0));
    fill(frame, pcm, (t + stepS / 2) * sr, win);
    fft.magnitudes(frame, mag);
    let top = 0,
      rise = 0;
    for (let k = k0; k <= k1; k++) if (mag[k] > top) top = mag[k];
    for (let q = 0; q < 24; q++) {
      let sum = 0;
      for (let k = edges[q]; k < Math.max(edges[q] + 1, edges[q + 1]); k++) sum += mag[k];
      bands[q] = Math.log1p(100 * sum);
      if (s && bands[q] > prev[q]) rise += bands[q] - prev[q];
    }
    flux[s] = rise;
    [bands, prev] = [prev, bands];
    peakAt[s] = count;
    count = peaks(mag, k0, k1, Math.max(1e-5, top * 0.003), hz, peakF, peakA, count, MAXP);
    if (s % 48 === 47) yield;
  }
  peakAt[steps] = count;
  // 2. Tuning: the amplitude-weighted circular mean of every peak's offset from equal temperament.
  let tc = 0,
    ts = 0;
  for (let i = 0; i < count; i++) {
    if (peakF[i] < 100 || peakF[i] > 3000) continue;
    const p = pitchOf(peakF[i]),
      d = 2 * Math.PI * (p - Math.round(p));
    tc += peakA[i] * Math.cos(d);
    ts += peakA[i] * Math.sin(d);
  }
  const tuning = count ? Math.atan2(ts, tc) / (2 * Math.PI) : 0;
  yield;
  // 3. Chroma per 16th (peaks folded to pitch classes) and melody salience by harmonic summation.
  const chroma = new Float32Array(steps * 12),
    candP = new Float32Array(steps * K),
    candS = new Float32Array(steps * K),
    nb = (LEAD[1] - LEAD[0]) * BINS,
    sal = new Float64Array(nb),
    weight = Float64Array.from({ length: 9 }, (_, h) => 0.8 ** (h - 1));
  for (let s = 0; s < steps; s++) {
    sal.fill(0);
    let top = 0;
    for (let i = peakAt[s]; i < peakAt[s + 1]; i++) if (peakF[i] >= 150 && peakA[i] > top) top = peakA[i];
    for (let i = peakAt[s]; i < peakAt[s + 1]; i++) {
      const f = peakF[i],
        a = peakA[i],
        p = pitchOf(f) - tuning,
        r = Math.round(p);
      if (f >= 80) chroma[s * 12 + pitchClass(r)] += a * g(2 * (p - r));
      if (f < 150 || a < top * 0.03) continue;
      for (let h = 1; h <= 8; h++) {
        const c = (p - HARMONIC[h] - LEAD[0]) * BINS;
        if (c < -BINS) break;
        if (c > nb - 1 + BINS) continue;
        const w = a * weight[h];
        for (let j = Math.max(0, Math.ceil(c - BINS)), end = Math.min(nb - 1, Math.floor(c + BINS)); j <= end; j++) sal[j] += w * g((j - c) / BINS);
      }
    }
    const base = s * K;
    for (let j = 1; j < nb - 1; j++) {
      const v = sal[j];
      if (v <= sal[j - 1] || v < sal[j + 1] || v <= candS[base + K - 1]) continue;
      const den = sal[j - 1] - 2 * v + sal[j + 1],
        off = den < 0 ? (0.5 * (sal[j - 1] - sal[j + 1])) / den : 0;
      let q = K - 1;
      for (; q > 0 && candS[base + q - 1] < v; q--) {
        candS[base + q] = candS[base + q - 1];
        candP[base + q] = candP[base + q - 1];
      }
      candS[base + q] = v;
      candP[base + q] = LEAD[0] + (j + off) / BINS;
    }
    if (s % 96 === 95) yield;
  }
  // 4. Bass per beat from a 2.8–3 kHz copy: a ~1/3 s window resolves semitones down to E1.
  let low = pcm;
  for (let i = 0; i < 3; i++) low = yield* halving(low);
  const lr = sr / 8,
    bn = 1024,
    bfft = new RealFFT(bn),
    bwin = hann(bn),
    bframe = new Float64Array(bn),
    bmag = new Float64Array(bn / 2 + 1),
    bhz = lr / bn,
    bk0 = Math.floor(30 / bhz),
    bk1 = Math.ceil(400 / bhz),
    bf = new Float32Array(64),
    ba = new Float32Array(64),
    bsal = new Float64Array(40), // MIDI 24–63
    bassChroma = new Float32Array(beats * 12);
  for (let b = 0; b < beats; b++) {
    fill(bframe, low, (first + (b + 0.5) * beatS) * lr, bwin);
    bfft.magnitudes(bframe, bmag);
    let top = 0;
    for (let k = bk0; k <= bk1; k++) if (bmag[k] > top) top = bmag[k];
    const np = peaks(bmag, bk0, bk1, Math.max(1e-5, top * 0.03), bhz, bf, ba, 0, 64);
    bsal.fill(0);
    for (let i = 0; i < np; i++) {
      const p = pitchOf(bf[i]) - tuning;
      for (let h = 1; h <= 4; h++) {
        const p0 = p - HARMONIC[h],
          r = Math.round(p0);
        if (r < 24) break;
        if (r < 64) bsal[r - 24] += ba[i] * 0.7 ** (h - 1) * g(2 * (p0 - r));
      }
    }
    for (let r = 28; r <= 55; r++) bassChroma[b * 12 + (r % 12)] += bsal[r - 24];
    if (b % 128 === 127) yield;
  }
  yield;
  // 5. Loudness per 16th on a 30 dB scale under the song's loud passages (1 = full, 0 = silence), and onsets 0–1.
  const db = Float32Array.from(rms, (v) => 20 * Math.log10(v + 1e-9)),
    hi = quantile(db, 0.95),
    fq = quantile(flux, 0.95) || 1,
    energy = Float32Array.from(db, (v) => Math.min(1, Math.max(0, 1 + (v - hi) / 30))),
    onset = Float32Array.from(flux, (v) => Math.min(1, v / fq));
  const norm = (arr, i) => {
    let m = 0;
    for (let c = 0; c < 12; c++) m = Math.max(m, arr[i * 12 + c]);
    return m;
  };
  // 6. Key: Krumhansl–Schmuckler on loudness-weighted chroma plus bass.
  const total = new Float64Array(12);
  for (let s = 0; s < steps; s++) {
    const m = norm(chroma, s);
    if (m > 0) for (let c = 0; c < 12; c++) total[c] += (chroma[s * 12 + c] / m) * energy[s];
  }
  for (let b = 0; b < beats; b++) {
    const m = norm(bassChroma, b);
    if (m > 0) for (let c = 0; c < 12; c++) total[c] += (bassChroma[b * 12 + c] / m) * STEPS * 0.5;
  }
  let key = { tonic: 0, minor: false, r: -2 };
  for (const [minor, profile] of [[false, MAJOR], [true, MINOR]])
    for (let tonic = 0; tonic < 12; tonic++) {
      const r = correlation(total, (c) => profile[(c - tonic + 12) % 12]);
      if (r > key.r) key = { tonic, minor, r };
    }
  const inKey = diatonic(key.tonic, key.minor);
  yield;
  // 7. Chords per half bar: triad templates on chroma + bass, Viterbi-smoothed with a diatonic prior.
  const halves = Math.ceil(beats / 2),
    em = new Float64Array(halves * 24),
    silent = new Uint8Array(halves),
    feat = new Float64Array(12),
    templates = Array.from({ length: 24 }, (_, c) => triad(c));
  for (let h = 0; h < halves; h++) {
    feat.fill(0);
    let loud = 0,
      n16 = 0;
    for (let s = h * 2 * STEPS; s < Math.min(steps, (h + 1) * 2 * STEPS); s++, n16++) {
      const m = norm(chroma, s);
      loud += energy[s];
      if (m > 0) for (let c = 0; c < 12; c++) feat[c] += (chroma[s * 12 + c] / m) * (0.2 + energy[s]);
    }
    for (let b = 2 * h; b < Math.min(beats, 2 * h + 2); b++) {
      const m = norm(bassChroma, b);
      if (m > 0) for (let c = 0; c < 12; c++) feat[c] += (bassChroma[b * 12 + c] / m) * 1.5;
    }
    silent[h] = loud / Math.max(1, n16) < 0.1 ? 1 : 0;
    let len = 0;
    for (let c = 0; c < 12; c++) len += feat[c] * feat[c];
    len = Math.sqrt(len) || 1;
    for (let c = 0; c < 24; c++) {
      const [r, t, f] = templates[c];
      em[h * 24 + c] = (feat[r] * 1.1 + feat[t] + feat[f]) / len / Math.sqrt(1.1 * 1.1 + 2);
    }
  }
  // Rock voicings are often bare fifths, so the bass note is the best evidence for which triad it is.
  const bassHalf = new Float64Array(halves * 12);
  for (let b = 0; b < beats; b++) {
    const m = norm(bassChroma, b);
    if (m > 0) for (let c = 0; c < 12; c++) bassHalf[(b >> 1) * 12 + c] += bassChroma[b * 12 + c] / m / 2;
  }
  const chordPath = viterbi(halves, 24, (h, c) => 9 * em[h * 24 + c] + (inKey.has(c) ? 0.6 : 0) + 2 * bassHalf[h * 12 + (c % 12)], (a, b) => (a === b ? 0.9 : 0));
  const chords = Int8Array.from(chordPath, (c, h) => (silent[h] ? -1 : c));
  yield;
  // 8. Bass root per beat: bass chroma, pulled toward the chord's root and tones.
  const bassPath = viterbi(beats, 12, (b, c) => {
    const m = norm(bassChroma, b) || 1,
      chord = chordPath[b >> 1],
      tones = templates[chord];
    return 3 * Math.log(0.08 + bassChroma[b * 12 + c] / m) + (c === tones[0] ? 0.8 : tones.includes(c) ? 0.3 : 0);
  }, (a, b) => (a === b ? 0.7 : 0));
  const bass = Int8Array.from(bassPath, (c, b) => (silent[b >> 1] ? -1 : c));
  yield;
  // 9. Melody: track one candidate (or a rest) per 16th, then snap to the key or the chord and tidy up.
  // A rest wins below 40% of the salience of the song's strongest pitched moments.
  const loudTop = [];
  for (let s = 0; s < steps; s++) if (energy[s] > 0.6 && candS[s * K] > 0) loudTop.push(candS[s * K]);
  const ref = quantile(loudTop, 0.9) || 1,
    rest = Math.log(0.4),
    REST = K;
  const path = viterbi(
    steps,
    K + 1,
    (s, q) => {
      if (q === REST) return rest;
      const v = candS[s * K + q];
      return v > 0 ? Math.log(v / ref) - (energy[s] < 0.4 ? 3 : 0) : -Infinity;
    },
    (a, b, s) => {
      if (a === REST || b === REST) return a === b ? 0 : -1;
      const d = Math.abs(candP[s * K + b] - candP[(s - 1) * K + a]);
      return -0.12 * d - (d > 7 ? 0.8 : 0);
    },
  );
  const scale = (key.minor ? SCALES.minor : SCALES.major).map((d) => (d + key.tonic) % 12),
    allowedWith = templates.map((tones) => new Set([...scale, ...tones])), // the key, plus a borrowed chord's tones
    melody = new Uint8Array(steps),
    strength = new Float32Array(steps);
  for (let s = 0; s < steps; s++) {
    if (path[s] === REST) continue;
    const p = candP[s * K + path[s]],
      allowed = allowedWith[chordPath[s >> 3]];
    let note = Math.round(p);
    if (!allowed.has(pitchClass(note))) note += allowed.has(pitchClass(note + 1)) && (!allowed.has(pitchClass(note - 1)) || p >= note) ? 1 : -1;
    melody[s] = note;
    strength[s] = candS[s * K + path[s]] / ref;
  }
  for (let s = 1; s < steps - 1; s++) {
    const [a, b, c] = [melody[s - 1], melody[s], melody[s + 1]];
    if (b && !a && !c) melody[s] = 0; // a lone 16th between rests is noise
    else if (b && a && a === c && b !== a) melody[s] = a; // one-16th blip inside a held note
  }
  const attack = new Uint8Array(steps);
  for (let s = 0; s < steps; s++)
    attack[s] = melody[s] && (!s || melody[s - 1] !== melody[s] || (onset[s] > 0.4 && strength[s] > 1.5 * strength[s - 1])) ? 1 : 0;
  return {
    version: 1,
    stepsPerBeat: STEPS,
    beats,
    tuning: Math.round(tuning * 1000) / 1000,
    key: { tonic: key.tonic, minor: key.minor, name: `${NAMES[key.tonic]} ${key.minor ? 'minor' : 'major'}` },
    melody,
    attack,
    chords,
    bass,
    energy,
    onset,
  };
}
function correlation(values, profile) {
  let mx = 0,
    my = 0;
  for (let c = 0; c < 12; c++) {
    mx += values[c] / 12;
    my += profile(c) / 12;
  }
  let sxy = 0,
    sxx = 0,
    syy = 0;
  for (let c = 0; c < 12; c++) {
    const x = values[c] - mx,
      y = profile(c) - my;
    sxy += x * y;
    sxx += x * x;
    syy += y * y;
  }
  return sxy / Math.sqrt(sxx * syy || 1);
}
// Max-sum path through `length` steps of `states` states; transition(prev, next, step) adds to the score.
function viterbi(length, states, emission, transition) {
  const path = new Uint8Array(length);
  if (!length) return path;
  const back = new Uint8Array(length * states);
  let cur = Float64Array.from({ length: states }, (_, q) => emission(0, q)),
    next = new Float64Array(states);
  for (let t = 1; t < length; t++) {
    for (let q = 0; q < states; q++) {
      let best = -Infinity,
        arg = 0;
      for (let r = 0; r < states; r++) {
        const v = cur[r] + transition(r, q, t);
        if (v > best) {
          best = v;
          arg = r;
        }
      }
      next[q] = best + emission(t, q);
      back[t * states + q] = arg;
    }
    [cur, next] = [next, cur];
  }
  let arg = 0;
  for (let q = 1; q < states; q++) if (cur[q] > cur[arg]) arg = q;
  for (let t = length - 1; t >= 0; t--) {
    path[t] = arg;
    arg = back[t * states + arg];
  }
  return path;
}
