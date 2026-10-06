// Development-only QA scenes (?scene=...). Loaded only when import.meta.env.DEV is true,
// so production builds never contain these mutation helpers.
import { near, LAP } from '../sim/row.js';
import { igniteBro, houseIgnite, damage, beehive } from '../sim/house.js';
import { startBonus } from '../sim/bonus.js';
import { capture } from '../sim/crew.js';
import { startLap } from '../sim/street.js';
import { SHOPS } from '../data/houses.js';
import { TUNING as T } from '../data/tuning.js';
import { startTraining, gotoStation, finishTraining } from '../sim/training.js';
import { enterAlley } from '../sim/alley.js';
import { headline, yesterday } from '../sim/news.js';
import { ROW } from '../sim/row.js';
function placeBefore(m, h, ahead = 7) {
  m.player.x = near(h.s, m.player.x) - ahead;
  while (m.player.x < 0) m.player.x += LAP;
  m.player.vx = T.roll;
  m.player.z = 0.8;
}
export function applyScene(m, params) {
  const scene = params.get('scene'),
    n = Number(params.get('n') ?? 0);
  if (!scene) return;
  if (scene === 'training') {
    if (m.level !== 'training') startTraining(m);
    gotoStation(m, n);
    m.player.vx = T.roll;
    return;
  }
  if (m.level === 'training') finishTraining(m);
  m.phase = 'playing';
  m.phaseTime = 0;
  m.player.vx = T.roll;
  if (params.has('items') || ['items', 'wreck', 'fire'].includes(scene))
    for (const shop of SHOPS) {
      m.unlocked[shop.kind] = true;
      m.items[shop.kind] = shop.cap;
    }
  if (scene === 'fire') {
    const h = m.houses[n];
    placeBefore(m, h, 6);
    h.can.state = 'burning';
    h.can.fuel = 30;
    h.can.litId++;
    igniteBro(m, h, h.bros[0]);
    h.bros[0].mode = 'zig';
    h.bros[0].burn = 30;
    houseIgnite(m, h, 'scene', 0.7);
    damage(m, h, 30, 'scene');
    h.fd = null;
  } else if (scene === 'wreck') {
    damage(m, m.houses[0], 30, 'scene');
    damage(m, m.houses[1], 65, 'scene');
    damage(m, m.houses[2], 100, 'scene');
    beehive(m, m.houses[3]);
    damage(m, m.houses[3], 35, 'scene');
    m.houses[4].balloons = 2;
    placeBefore(m, m.houses[n], 4);
  } else if (scene === 'lap') {
    m.player.x = LAP * (n - 1) + 30;
    startLap(m, n);
  } else if (scene === 'bonus') {
    startBonus(m);
    m.bonus.pass = n;
    m.bonus.stage = params.has('run') ? 'run' : 'card';
    m.bonus.x = -T.bonusSpeed * T.bonusLead + Number(params.get('t') ?? 0) * T.bonusSpeed;
    m.bonus.t = 0;
  } else if (scene === 'rescue') {
    placeBefore(m, m.houses[n], 4);
    capture(m);
  } else if (scene === 'shop') {
    m.player.x = 52;
    m.player.z = -3.8;
  } else if (scene === 'win') {
    for (const h of m.houses) damage(m, h, 100, 'scene');
  } else if (scene === 'alley') {
    enterAlley(m, 0, near(ROW.shops[0].s, m.player.x));
    m.player.x = n || 10;
  } else if (scene === 'newspaper') {
    m.stats.cansLit = 9;
    m.stats.brosLit = 6;
    m.newspaper = { day: 'TUESDAY', yesterday: 'MONDAY', headline: headline(m, {}), stats: yesterday(m, {}), week: 1 };
    m.phase = 'newspaper';
    m.phaseTime = 0.45;
  } else if (scene === 'trick') {
    // Mid-air: a backflip in progress plus a kickflip.
    placeBefore(m, m.houses[n], 8);
    m.player.grounded = false;
    m.player.y = 1.4;
    m.player.vy = 1;
    m.player.rot = params.has('rot') ? Number(params.get('rot')) : -2.2;
    m.player.flip = params.has('flip') ? { dir: 'up', name: 'KICKFLIP', t: 0.15, dur: 0.36, points: 150 } : null;
    m.held.ollie = false;
  } else if (scene === 'grind') {
    const bench = m.rails.find((r) => r.kind === 'bench');
    m.player.x = near(bench.s0, m.player.x) + 0.6;
    m.player.z = bench.z;
    m.player.y = bench.h;
    m.player.grounded = false;
    m.player.grind = { rail: bench, x1: m.player.x + 2, t: 0.2, name: '50-50 GRIND' };
  } else if (scene === 'flow') {
    placeBefore(m, m.houses[n], 6);
    m.flow = 100;
    m.flowTime = T.flowTime;
  } else if (scene === 'aim') {
    placeBefore(m, m.houses[n], 9);
    m.player.z = -2;
    m.aiming = true;
  }
  m.drainEvents();
}
