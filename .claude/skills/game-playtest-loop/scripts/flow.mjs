// Needs playwright-core (npm i playwright-core in a scratch dir) and a local Chrome.
// BASE=http://127.0.0.1:5193 CHROME=/path/to/chrome node <script> ...
// Forces a capture with the brake, then plays the rescue and the 10x bonus with real keys.
import { chromium } from 'playwright-core';
const out = process.argv[2];
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(`${process.env.BASE ?? 'http://127.0.0.1:5193'}/?seed=21`, { waitUntil: 'networkidle' });
await page.click('#start-btn');
await page.waitForTimeout(2300);
const state = () => page.evaluate(() => { const d = window.frattyDebug(); return { phase: d.phase, z: d.player.z, x: d.player.x, bonus: d.bonus, zombie: d.zombie, ambulance: d.ambulance, score: d.score, lives: d.lives }; });
const t0 = Date.now(); let shot = 0, last = '', holding = false, phases = [];
await page.keyboard.down('ArrowLeft');
while (Date.now() - t0 < 75000) {
  const s = await state();
  if (s.phase !== last) { phases.push(`${((Date.now() - t0) / 1000).toFixed(1)}s:${s.phase}`); last = s.phase; await page.screenshot({ path: `${out}/flow-${String(shot++).padStart(2, '0')}-${s.phase}.png` }); }
  if (s.phase === 'rescue') {
    await page.keyboard.up('ArrowLeft'); await page.keyboard.down('ArrowRight');
    const goal = s.zombie?.state === 'waiting' ? s.zombie : s.ambulance;
    if (goal) {
      if (goal.z < s.z - 0.15) { await page.keyboard.down('ArrowUp'); await page.keyboard.up('ArrowDown'); }
      else if (goal.z > s.z + 0.15) { await page.keyboard.down('ArrowDown'); await page.keyboard.up('ArrowUp'); }
      else { await page.keyboard.up('ArrowUp'); await page.keyboard.up('ArrowDown'); }
    }
  }
  if (s.phase === 'bonus' && s.bonus) {
    const want = s.bonus.stage === 'run' && !s.bonus.thrown && s.bonus.x < -3.36 - 0.15;
    if (want && !holding) { await page.keyboard.down('KeyF'); holding = true; }
    if (!want && holding) { await page.keyboard.up('KeyF'); holding = false; }
    if (s.bonus.stage === 'run' && s.bonus.x > -6 && s.bonus.x < -5 && shot < 40) await page.screenshot({ path: `${out}/flow-${String(shot++).padStart(2, '0')}-pass${s.bonus.pass}.png` });
  }
  if (s.phase === 'playing' && phases.length > 4) break;
  await page.waitForTimeout(40);
}
const final = await state();
console.log(JSON.stringify({ phases, final, errors }));
await browser.close();
