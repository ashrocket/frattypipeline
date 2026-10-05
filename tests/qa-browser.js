import { GameModel, seededRandom } from '../src/model.js';
import { WorldRenderer } from '../src/renderer-flat.js';
import { drawPlayer } from '../src/render/player.js';
import { spawnBro } from '../src/sim/enemies.js';
import { layout, project, visible } from '../src/layout.js';
const output = document.querySelector('#results'),
  mount = document.querySelector('#render');
const write = (value) => (output.textContent = JSON.stringify(value, null, 2));
const errors = [];
addEventListener('error', (e) => errors.push(e.message));
addEventListener('unhandledrejection', (e) => errors.push(String(e.reason)));
function pixels(look, pipeline) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const c = canvas.getContext('2d');
  c.translate(64, 121);
  drawPlayer(c, { look, pipeline });
  return c.getImageData(0, 0, 128, 128).data;
}
document.querySelector('#render-check').onclick = () => {
  const report = { pixels: [], layouts: [], performance: [], errors };
  for (let look = 0; look < 5; look++) {
    let old = pixels(look, 0);
    for (const stage of [15, 30, 50, 70, 85]) {
      const next = pixels(look, stage);
      let changed = 0,
        opaque = 0;
      for (let i = 0; i < old.length; i += 4) {
        if (old[i + 3] || next[i + 3]) opaque++;
        if (old.slice(i, i + 4).some((v, n) => v !== next[i + n])) changed++;
      }
      report.pixels.push({ look, stage, percent: +((100 * changed) / opaque).toFixed(2) });
      old = next;
    }
  }
  for (const [width, height] of [
    [1440, 900],
    [390, 844],
    [844, 390],
  ]) {
    mount.replaceChildren();
    mount.style.width = `${width}px`;
    mount.style.height = `${height}px`;
    const m = new GameModel(seededRandom(1));
    m.phase = 'playing';
    m.arena = m.houses[11];
    m.cameraX = m.arena.x;
    m.player.x = m.arena.x;
    m.player.z = 0;
    ['lax', 'keg', 'pong', 'vest', 'conga', 'lax'].forEach((kind, i) => {
      const e = spawnBro(m, kind, i);
      e.state = i % 2 ? 'telegraph' : 'recovery';
      e.x = m.player.x + (i - 3) * 2;
      e.z = -2 + i * 0.7;
    });
    const world = new WorldRenderer(mount);
    world.count = { activeCount: 7, capacity: 20 };
    world.fx.pool.forEach((p, i) =>
      Object.assign(p, {
        life: 1,
        x: m.player.x + (i % 13) - 6,
        z: (i % 9) - 4,
        vx: 0,
        vz: 0,
        color: '#FF2E88',
      }),
    );
    world.draw(m, 0);
    report.performance.push(world.stats());
    const v = layout(width, height, m),
      p = project(v, m.player.x, m.player.z);
    report.layouts.push({
      width,
      height,
      freePercent: (100 * (height - v.hud - v.controls)) / height,
      playerY: p.y / height,
      threats: m.enemies.map((e) => visible(v, e)),
      hud: v.hud,
    });
  }
  report.pass =
    report.pixels.every((p) => p.percent >= 8) &&
    report.performance.every((p) => p.drawCalls <= 700 && p.gradients === 0) &&
    report.layouts.every((v) => v.threats.every(Boolean));
  write(report);
};
document.querySelector('#live-check').onclick = async () => {
  const root = document.querySelector('#live');
  root.replaceChildren();
  const frame = document.createElement('iframe');
  frame.width = 1440;
  frame.height = 900;
  frame.src = '/?qa-input=1';
  root.append(frame);
  await new Promise((r) => (frame.onload = r));
  const doc = frame.contentDocument,
    win = frame.contentWindow;
  const report = { startedAt: new Date().toISOString(), frames: 0, errors: [], samples: [] };
  win.addEventListener('error', (e) => report.errors.push(e.message));
  win.addEventListener('unhandledrejection', (e) => report.errors.push(String(e.reason)));
  doc.querySelector('#start-btn').click();
  // Calibration is explicitly offered, then skipped for this deterministic input audit.
  await new Promise((r) => setTimeout(r, 400));
  if (doc.querySelector('#dialog-title').textContent === 'SOUND CHECK')
    doc.querySelector('#dialog-secondary').click();
  const start = performance.now();
  let stopped = false;
  function key(code, down) {
    win.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, bubbles: true }));
  }
  const pulse = setInterval(() => {
    const t = (performance.now() - start) / 1000;
    key('KeyD', true);
    key('KeyW', Math.sin(t) > 0.4);
    key('KeyS', Math.sin(t) < -0.4);
    key('KeyF', Math.floor(t * 2) % 2 === 0);
    key('Space', Math.floor(t * 3) % 3 === 0);
    key('ShiftLeft', Math.floor(t) % 4 === 0);
    report.frames++;
    if (report.frames % 50 === 0) {
      report.samples.push(win.frattyDebug());
      write({ ...report, progress: `${Math.round(t)}/60` });
    }
    if (t >= 60 && !stopped) {
      stopped = true;
      clearInterval(pulse);
      for (const k of ['KeyD', 'KeyW', 'KeyS', 'KeyF', 'Space', 'ShiftLeft']) key(k, false);
      report.seconds = t;
      report.final = win.frattyDebug();
      report.pass = report.errors.length === 0 && report.final.time >= 50;
      doc.querySelector('#pause-btn').click();
      setTimeout(async () => {
        report.afterPause = win.frattyDebug();
        report.pass &&= report.afterPause.phase === 'paused' && report.afterPause.audio.state === 'suspended';
        doc.querySelector('#dialog-primary').click();
        await new Promise(resolve => setTimeout(resolve, 1700));
        report.afterResume = win.frattyDebug();
        report.pass &&= report.afterResume.phase === 'playing' && report.afterResume.audio.state === 'running';
        doc.querySelector('#pause-btn').click();
        write(report);
      }, 100);
    }
  }, 100);
};
