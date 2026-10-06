// Records a frame-perfect PIPELINE gameplay video (1080p60 by default) with the game's
// own SFX rendered offline, mixed with the local song when present.
// Needs playwright-core (npm i playwright-core in a scratch dir), a local Chrome, ffmpeg,
// and the dev server running (BASE defaults to http://127.0.0.1:5193).
//   node record.mjs <out.mp4> [seed=44] [look=0] [width=1920] [height=1080] [campus=harvard]
// The recorder renders the music itself (skate school's looped instrumental intro, the song, then
// the chip loop) when the local song exists. The song is copyrighted and the chip loop is derived
// from it: inside the repo, recordings may only go under the git-ignored artifacts/, and the
// temporary video and WAV next to `out` are removed even when ffmpeg fails or the run is interrupted.
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { writeFileSync, existsSync, rmSync } from 'node:fs';
import { resolve, relative, sep, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
const [out, seed = '44', look = '0', w = '1920', h = '1080', campus = 'harvard'] = process.argv.slice(2);
const BASE = process.env.BASE ?? 'http://127.0.0.1:5193';
const ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const SONG = process.env.SONG ?? fileURLToPath(new URL('../../../../public/audio/fratty-pipeline.mp3', import.meta.url));
if (!out) {
  console.error('usage: node record.mjs <out.mp4> [seed=44] [look=0] [width=1920] [height=1080] [campus=harvard]');
  process.exit(2);
}
const inRepo = relative(ROOT, resolve(out));
if (inRepo !== '..' && !inRepo.startsWith(`..${sep}`) && !isAbsolute(inRepo) && inRepo.split(sep)[0] !== 'artifacts') {
  console.error(`Refusing to write ${out}: inside the repo, recordings (and their derived audio) go under artifacts/.`);
  process.exit(2);
}
const video = `${out}.video.mp4`,
  sfx = `${out}.sfx.wav`;
const cleanup = () => {
  rmSync(video, { force: true });
  rmSync(sfx, { force: true });
};
process.once('SIGINT', () => {
  cleanup();
  process.exit(130);
});
const run = (args) =>
  new Promise((resolve, reject) => {
    const p = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', ...args], { stdio: ['ignore', 'inherit', 'inherit'] });
    p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg ${code}`))));
  });
const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
});
let report;
try {
  report = await record();
} finally {
  await browser.close().catch(() => {});
  cleanup();
}
console.log(JSON.stringify(report, null, 1));

async function record() {
  const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${BASE}/tests/record.html?w=${w}&h=${h}`, { waitUntil: 'networkidle' });
  await page.evaluate(([s, l, c]) => window.recorder.init(s, l, c), [+seed, +look, campus]);
  const ff = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', '60', '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', video], { stdio: ['pipe', 'inherit', 'inherit'] });
  const finished = new Promise((resolve, reject) => ff.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg ${code}`)))));
  let done = false,
    count = 0;
  const started = Date.now();
  while (!done) {
    const r = await page.evaluate(() => window.recorder.frames(6));
    for (const url of r.frames) {
      if (!ff.stdin.write(Buffer.from(url.slice(url.indexOf(',') + 1), 'base64')))
        await new Promise((resolve) => ff.stdin.once('drain', resolve));
      count++;
    }
    done = r.done;
    if (count % 600 < 6) console.log(`frame ${count} · game ${r.time.toFixed(1)} s · ${r.phase} · score ${r.score} · ${((Date.now() - started) / 1000).toFixed(0)} s elapsed`);
  }
  ff.stdin.end();
  await finished;
  const summary = await page.evaluate(() => window.recorder.summary());
  const audio = await page.evaluate(() => window.recorder.renderAudio());
  const parts = [];
  for (let i = 0; i * 2 ** 21 < audio.bytes; i++) parts.push(Buffer.from(await page.evaluate((n) => window.recorder.pcmChunk(n), i), 'base64'));
  const pcm = Buffer.concat(parts),
    header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(2, 22);
  header.writeUInt32LE(audio.sampleRate, 24);
  header.writeUInt32LE(audio.sampleRate * 4, 28);
  header.writeUInt16LE(4, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  writeFileSync(sfx, Buffer.concat([header, pcm]));
  const seconds = summary.seconds,
    fade = Math.max(0, seconds - 2.5).toFixed(2);
  if (audio.music)
    await run(['-y', '-i', video, '-i', sfx, '-filter_complex', `[1:a]alimiter=limit=0.95,afade=t=out:st=${fade}:d=2.5[a]`, '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', out]);
  else if (existsSync(SONG))
    await run(['-y', '-i', video, '-i', SONG, '-i', sfx, '-filter_complex', `[2:a]volume=1[s];[1:a]volume=0.42[m];[s][m]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.95,afade=t=out:st=${fade}:d=2.5[a]`, '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', out]);
  else await run(['-y', '-i', video, '-i', sfx, '-filter_complex', `[1:a]alimiter=limit=0.95,afade=t=out:st=${fade}:d=2.5[a]`, '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', out]);
  return { out, frames: count, seconds, song: existsSync(SONG), music: audio.music, summary, errors };
}
