// Browser render check: a deliberately busy scene at desktop, phone landscape and portrait.
// Reports frame time, brightness (mean CIE L*/100) and any runtime errors.
import { GameModel, seededRandom } from '../src/model.js';
import { WorldRenderer } from '../src/renderer-flat.js';
import { near } from '../src/sim/row.js';
import { igniteBro, houseIgnite, damage, beehive } from '../src/sim/house.js';
const output = document.querySelector('#results'),
  mount = document.querySelector('#render');
const errors = [];
addEventListener('error', (e) => errors.push(e.message));
function busyModel() {
  const m = new GameModel(seededRandom(3));
  m.start();
  m.phase = 'playing';
  const h = m.houses[1];
  m.player.x = near(h.s, 0) - 6;
  m.player.vx = 7;
  for (const house of m.houses.slice(0, 4)) {
    house.can.state = 'burning';
    house.can.fuel = 99;
    for (const b of house.bros.slice(0, 3)) igniteBro(m, house, b);
    houseIgnite(m, house, 'qa', 0.8);
    house.fd = null;
  }
  damage(m, m.houses[0], 50, 'qa');
  beehive(m, m.houses[2]);
  m.houses[3].balloons = 2;
  m.drainEvents();
  return m;
}
const lightness = (canvas) => {
  const c = canvas.getContext('2d'),
    { data } = c.getImageData(0, 0, canvas.width, canvas.height);
  let sum = 0,
    n = 0;
  for (let i = 0; i < data.length; i += 16) {
    const lin = (v) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    const l = 0.2126 * lin(data[i]) + 0.7152 * lin(data[i + 1]) + 0.0722 * lin(data[i + 2]);
    sum += (l <= 216 / 24389 ? (l * 24389) / 27 : 116 * Math.cbrt(l) - 16) / 100;
    n++;
  }
  return +(sum / n).toFixed(3);
};
document.querySelector('#render-check').onclick = () => {
  const report = { sizes: [], errors };
  for (const [width, height] of [[1440, 900], [844, 390], [390, 844]]) {
    mount.replaceChildren();
    mount.style.width = `${width}px`;
    mount.style.height = `${height}px`;
    const m = busyModel(),
      world = new WorldRenderer(mount);
    world.count = { activeCount: 7, capacity: 20 };
    const times = [];
    for (let i = 0; i < 90; i++) {
      for (let k = 0; k < 2; k++) m.tick(1 / 60, { x: 1 });
      for (const e of m.drainEvents()) world.event(e, m);
      const t0 = performance.now();
      world.draw(m, 1 / 30);
      times.push(performance.now() - t0);
    }
    times.sort((a, b) => a - b);
    report.sizes.push({ width, height, medianMs: +times[45].toFixed(2), p95Ms: +times[85].toFixed(2), lightness: lightness(world.canvas), particles: world.stats().particles });
  }
  output.textContent = JSON.stringify(report, null, 2);
};
