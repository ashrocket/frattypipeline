// Frame-perfect gameplay recorder (dev tool). The seeded simulation and a bot run at
// exactly 60 Hz; every tick is drawn and handed to the driver as a JPEG, so the video
// is smooth regardless of machine speed. SFX are rendered offline from the same events.
// Driven by .claude/skills/game-playtest-loop/scripts/record.mjs.
import { GameModel, seededRandom } from '../src/model.js';
import { WorldRenderer } from '../src/renderer-flat.js';
import { perceive } from '../src/layout.js';
import { STEP, SCORE, BEAT_S, FIRST_BEAT_S, BEATMAP } from '../src/data/tuning.js';
import { chipJob } from '../src/chip/job.js';
import { seamlessLoop } from '../src/loop.js';
import { demo } from '../scripts/bots/policies.mjs';
import { chrome, text, rr, paint, banner, easeOutBack } from '../src/render/draw.js';
import { P, FONT } from '../src/render/palette.js';
import { GameAudio } from '../src/audio.js';
const params = new URLSearchParams(location.search);
const W = Number(params.get('w') || 1920),
  H = Number(params.get('h') || 1080);
const mount = document.getElementById('stage');
mount.style.width = `${W}px`;
mount.style.height = `${H}px`;
const INTRO = Number(params.get('intro') || 194),
  HOLD = 90,
  OUTRO = 240;
let model, world, policy, frame, wonAt, events, finished;
function veil(c, a) {
  c.fillStyle = `rgba(255,255,255,${a})`;
  c.fillRect(0, 0, W, H);
}
function introCard(c, f) {
  const k = Math.min(1, f / 40);
  veil(c, 0.35 * k);
  c.save();
  c.translate(W / 2, H * 0.4);
  const s = easeOutBack(Math.min(1, f / 30)) * (1 + f * 0.0006);
  c.scale(s, s);
  c.rotate(-0.06);
  chrome(c, 'PIPELINE', 0, 0, Math.min(W * 0.16, 230));
  c.restore();
  c.globalAlpha = Math.min(1, Math.max(0, (f - 25) / 25));
  banner(c, 'Burn the status quo.', W / 2, H * 0.6, Math.min(W * 0.03, 44), { fill: P.sun, angle: -0.03 });
  text(c, `GAMEPLAY · SKATE SCHOOL + ONE FULL RUN · ${model.campus.name}`, W / 2, H * 0.71, Math.min(W * 0.016, 24), P.ink, { weight: 900, italic: false, family: FONT.ui, stroke: '#FFFFFF', strokeWidth: 6 });
  c.globalAlpha = 1;
}
function endCard(c, f) {
  const k = Math.min(1, f / 30);
  veil(c, 0.72 * k);
  c.globalAlpha = k;
  c.save();
  c.translate(W / 2, H * 0.26);
  const s = easeOutBack(Math.min(1, f / 26));
  c.scale(s, s);
  chrome(c, 'THE ROW IS GONE', 0, 0, Math.min(W * 0.075, 108));
  c.restore();
  const st = model.stats,
    cells = [
      [model.score.toLocaleString(), 'SCORE'],
      [`${model.destroyed} / 12`, 'HOUSES GONE'],
      [String(st.brosLit), 'FRATS LIT'],
      [st.bestCombo.toLocaleString(), 'BEST COMBO'],
      [`${st.bonusHits} / 10`, 'BONUS HITS'],
      [`${Math.floor(model.time / 60)}:${String(Math.floor(model.time % 60)).padStart(2, '0')}`, 'TIME'],
    ];
  const cw = Math.min(250, W * 0.13),
    ch = cw * 0.52,
    gap = 18,
    total = cells.length * cw + (cells.length - 1) * gap,
    x0 = W / 2 - total / 2,
    y = H * 0.44;
  cells.forEach(([value, label], i) => {
    const d = Math.min(1, Math.max(0, (f - 10 - i * 5) / 16)),
      x = x0 + i * (cw + gap);
    c.save();
    c.globalAlpha = d * k;
    c.translate(0, (1 - d) * 30);
    rr(c, x + 5, y + 6, cw, ch, 16);
    c.fillStyle = 'rgba(42,30,79,0.25)';
    c.fill();
    rr(c, x, y, cw, ch, 16);
    paint(c, '#FFFFFF', P.ink, 3);
    text(c, value, x + cw / 2, y + ch * 0.42, ch * 0.34, P.ink, { weight: 900 });
    text(c, label, x + cw / 2, y + ch * 0.78, ch * 0.13, P.inkSoft, { weight: 800, italic: false, family: FONT.ui });
    c.restore();
  });
  if (model.continues === 0) banner(c, '1CC · NO CONTINUES', W / 2, H * 0.7, Math.min(W * 0.022, 32), { fill: P.mint, angle: -0.04 });
  text(c, 'PIPELINE', W / 2, H * 0.86, Math.min(W * 0.02, 28), P.pink, { weight: 900, stroke: P.ink, strokeWidth: 5 });
  c.globalAlpha = 1;
}
function step() {
  const c = world.ctx;
  if (frame < INTRO) {
    world.draw(model, STEP);
    c.setTransform(world.ratio, 0, 0, world.ratio, 0, 0);
    introCard(c, frame);
  } else {
    if (frame === INTRO) {
      model.start();
      model.inputDevice = 'keyboard';
    }
    if (!['won', 'lost'].includes(model.phase)) {
      model.tick(STEP, policy(perceive(model)));
      for (const e of model.drainEvents()) {
        world.event(e, model);
        events.push({ ...e, at: INTRO / 60 + e.time });
      }
    } else if (wonAt === null) wonAt = frame;
    world.draw(model, STEP);
    if (wonAt !== null && frame - wonAt >= HOLD) {
      c.setTransform(world.ratio, 0, 0, world.ratio, 0, 0);
      endCard(c, frame - wonAt - HOLD);
      if (frame - wonAt >= HOLD + OUTRO) finished = true;
    }
  }
  frame++;
}
window.recorder = {
  init(seed, look = 0, campus = 'harvard', training = true) {
    model = new GameModel(seededRandom(seed), { look, hair: 0, skin: 1, campus, training, difficulty: 'easy' });
    mount.replaceChildren();
    world = new WorldRenderer(mount);
    world.count = { activeCount: 1, capacity: 20 };
    policy = demo(seed);
    frame = 0;
    wonAt = null;
    events = [];
    finished = false;
    return { W, H, ratio: world.ratio };
  },
  // Advance n frames; returns JPEG data URLs for each.
  frames(n, quality = 0.9) {
    const out = [];
    for (let i = 0; i < n && !finished; i++) {
      step();
      out.push(world.canvas.toDataURL('image/jpeg', quality));
    }
    return { frames: out, done: finished, frame, phase: model.phase, time: model.time, score: model.score };
  },
  summary() {
    const marks = {};
    for (const e of events)
      if (['trainingStart', 'stationDone', 'trainingDone', 'start', 'go', 'hit', 'broLit', 'houseFire', 'unlock', 'alleyEnter', 'alleyExit', 'fdArrive', 'houseGone', 'fireball', 'liftoff', 'bees', 'combo', 'flow', 'captured', 'rescueStart', 'freed', 'rescued', 'bonusStart', 'perfect', 'bonusEnd', 'newspaper', 'victory'].includes(e.type))
        (marks[e.type] ??= []).push(+e.at.toFixed(2));
    return { frames: frame, seconds: frame / 60, score: model.score, stats: model.stats, marks };
  },
  // The music, laid out the way GameAudio plays it: the song's instrumental intro looped during
  // skate school, the full song from the run's 'start', then the chip loop on the same beat grid.
  // Derived here from the local song only (never written anywhere but this video's audio).
  async music(ctx) {
    const response = await fetch('/audio/fratty-pipeline.mp3');
    if (!response.ok || response.headers.get('content-type')?.includes('text/html')) return false;
    const song = await ctx.decodeAudioData(await response.arrayBuffer()),
      pcm = new Float32Array(song.length);
    song.copyFromChannel(pcm, 0);
    if (song.numberOfChannels > 1) {
      const right = song.getChannelData(1);
      for (let i = 0; i < pcm.length; i++) pcm[i] = (pcm[i] + right[i]) / 2;
    }
    const [LOOP_START, LOOP_END] = BEATMAP.loops.run,
      BAR = BEATMAP.beatsPerBar,
      SONG_END = Math.ceil(BEATMAP.sections.at(-1).to / BAR) * BAR,
      grid = { beatS: BEAT_S, firstBeatS: FIRST_BEAT_S, beatsPerBar: BAR, sections: BEATMAP.sections, stops: BEATMAP.stops },
      rate = 24000,
      chip = {};
    const renders = [{ id: 'run', from: LOOP_START, to: LOOP_END, tempo: 1, sampleRate: rate }];
    for (const result of chipJob({ pcm, sampleRate: song.sampleRate, grid, renders }))
      if (result?.pcm) {
        const b = ctx.createBuffer(1, result.pcm.length, result.sampleRate);
        b.copyToChannel(result.pcm, 0);
        chip[result.id] = b;
      }
    const bus = ctx.createGain();
    bus.gain.value = 0.42;
    bus.connect(ctx.destination);
    const play = (buffer, at, { offset = 0, loop = false, loopStart = 0, loopEnd = 0, gain = 1, until = null, fadeIn = 0 } = {}) => {
      const source = ctx.createBufferSource(),
        g = ctx.createGain();
      source.buffer = buffer;
      source.loop = loop;
      source.loopStart = loopStart;
      source.loopEnd = loopEnd;
      g.gain.setValueAtTime(fadeIn ? 0 : gain, at);
      if (fadeIn) g.gain.linearRampToValueAtTime(gain, at + fadeIn);
      source.connect(g).connect(bus);
      source.start(at, offset);
      // stop() is only legal after start().
      if (until !== null) {
        g.gain.setValueAtTime(gain, until);
        g.gain.linearRampToValueAtTime(0, until + 0.15);
        source.stop(until + 0.2);
      }
    };
    const trainAt = events.find((e) => e.type === 'trainingStart')?.at,
      runAt = events.find((e) => e.type === 'start')?.at;
    const [introFrom, introTo] = BEATMAP.loops.tutorial;
    if (trainAt !== undefined)
      play(seamlessLoop(ctx, song, FIRST_BEAT_S + introFrom * BEAT_S, FIRST_BEAT_S + introTo * BEAT_S), trainAt, { loop: true, fadeIn: 0.02, until: runAt ?? null });
    if (runAt !== undefined) {
      const when = runAt + 0.04,
        switchAt = when + FIRST_BEAT_S + SONG_END * BEAT_S;
      play(song, when, { until: chip.run ? switchAt - 0.12 : null });
      if (chip.run) play(chip.run, switchAt, { loop: true, gain: 1.4 });
    }
    return true;
  },
  // Render the game's own synthesized SFX for every event (plus the music), offline, as 16-bit stereo PCM.
  async renderAudio(sampleRate = 48000) {
    const seconds = frame / 60 + 0.5,
      ctx = new OfflineAudioContext(2, Math.ceil(seconds * sampleRate), sampleRate),
      audio = GameAudio.offline(ctx, { sfx: 0.8 });
    for (const e of events) audio.event(e, e.at);
    this.musicError = null;
    this.withMusic = await this.music(ctx).catch((error) => {
      this.musicError = String(error?.stack ?? error);
      console.warn('No music in the render:', error);
      return false;
    });
    const buffer = await ctx.startRendering(),
      left = buffer.getChannelData(0),
      right = buffer.getChannelData(1),
      pcm = new Int16Array(left.length * 2);
    for (let i = 0; i < left.length; i++) {
      pcm[i * 2] = Math.max(-1, Math.min(1, left[i])) * 32767;
      pcm[i * 2 + 1] = Math.max(-1, Math.min(1, right[i])) * 32767;
    }
    this.pcm = new Uint8Array(pcm.buffer);
    return { bytes: this.pcm.length, sampleRate, voices: events.length, music: this.withMusic, musicError: this.musicError };
  },
  pcmChunk(index, size = 2 ** 21) {
    const part = this.pcm.subarray(index * size, (index + 1) * size);
    let binary = '';
    for (let i = 0; i < part.length; i += 0x8000) binary += String.fromCharCode(...part.subarray(i, i + 0x8000));
    return btoa(binary);
  },
};
export { SCORE };
