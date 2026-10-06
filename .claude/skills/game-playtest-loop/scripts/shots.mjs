// Needs playwright-core (npm i playwright-core in a scratch dir) and a local Chrome.
// BASE=http://127.0.0.1:5193 CHROME=/path/to/chrome node <script> ...
// Usage: node shots.mjs <outDir> <url-path> <w> <h> [waitMs] [keys-script]
import { chromium } from 'playwright-core';
const [outDir, path = '/', w = '1440', h = '900', wait = '1500', script = ''] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: +w < 600 ? 2 : 1, hasTouch: +w < 900, isMobile: false });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(`${process.env.BASE ?? 'http://127.0.0.1:5193'}${path}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(+wait);
const name = (process.argv[8] ?? 'shot');
let i = 0;
async function snap(tag) { await page.screenshot({ path: `${outDir}/${name}-${String(i++).padStart(2, '0')}-${tag}.png` }); }
await snap('start');
// Mini script: "d:ArrowRight,500;k:KeyF;u:KeyF;w:800;s:tag"
for (const step of script.split(';').filter(Boolean)) {
  const [op, arg] = step.split(':');
  if (op === 'd') { const [key, ms] = arg.split(','); await page.keyboard.down(key); if (ms) { await page.waitForTimeout(+ms); await page.keyboard.up(key); } }
  else if (op === 'u') await page.keyboard.up(arg);
  else if (op === 'p') await page.keyboard.press(arg);
  else if (op === 'w') await page.waitForTimeout(+arg);
  else if (op === 's') await snap(arg);
  else if (op === 'c') { const [x, y] = arg.split(',').map(Number); await page.mouse.click(x, y); }
  else if (op === 'e') console.log(JSON.stringify(await page.evaluate(arg)));
}
const debug = await page.evaluate(() => window.frattyDebug ? (({ phase, lap, score, destroyed, lives, item, horde, stats }) => ({ phase, lap, score, destroyed, lives, item, horde, render: stats.render }))(window.frattyDebug()) : null);
console.log(JSON.stringify({ debug, errors: errors.slice(0, 8) }));
await browser.close();
