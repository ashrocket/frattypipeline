---
name: game-playtest-loop
description: The PIPELINE repo's verification and playtest loop — unit tests, seeded bot gauntlets, a dev server on non-conflicting ports, browser screenshots at desktop/landscape-phone/portrait sizes, the read-only frattyDebug() hook, and luminance/readability checks. Use this whenever you change PIPELINE gameplay, rendering, HUD, controls or balance and need to prove it works, or when asked to playtest, QA, screenshot, balance-check or "make sure it's playable".
---

# PIPELINE playtest loop

Passing tests prove rules; they do not prove fun or readability. Run all
three layers and report them separately: **rules** (tests), **balance**
(bots over many seeds), **experience** (real browser frames you looked at).

## 1. Rules

```sh
npm test            # node --test tests/*.test.js
npm run build       # Vite build + built-copy lint
```

Every owner-specified rule should have a test that fails if the rule breaks.
Tests drive `GameModel` directly with a seed and `model.tick(STEP, input)`.

## 2. Balance (bots)

```sh
npm run gauntlet                                   # 100 hold-out seeds per policy + gates
node scripts/gauntlet.mjs --seeds=20 --policy=novice,skilled   # quick look
```

Bots (`scripts/bots/policies.mjs`) read the world only through `perceive()` in
`src/layout.js` (the same projection the renderer uses) and act only through
player inputs. Policies: `idle` and `brake` (must lose; brake must be caught
within 8 s), `masher` (must score far below skilled), `novice`, `skilled`. Never
tune the losing policies to make a gate pass. Keep tables in `docs/v4/balance.md`.

## 3. Experience (browser)

Start servers on ports other sessions are unlikely to use, in the background:

```sh
QUEUE_PORT=8817 node server/dev.mjs &
QUEUE_PORT=8817 node node_modules/vite/bin/vite.js --port 5193 --strictPort &
```

If several Chrome profiles are connected to Claude in Chrome, prefer the headless
scripts in `scripts/` (they need `npm i playwright-core` in a scratch directory
and a local Chrome; set `BASE` and `CHROME` if they differ):

- `shots.mjs <outDir> "/?seed=7&scene=fire&n=0" 1440 900 2500 "<steps>" <tag>`
  takes a screenshot after load, then runs steps such as
  `d:ArrowRight,800;p:KeyF;w:400;s:tag` (hold, press, wait, snap).
- `flow.mjs <outDir>` brakes into a capture, steers the rescue and plays all ten
  bonus passes with real keys, logging phase timings.
- `sheet.py out.png <cols> <width> img...` tiles frames into one contact sheet so
  you can review many frames in a single image.
- `record.mjs <out.mp4> [seed=44] [look=0] [w=1920] [h=1080]` records a
  frame-perfect 60 fps gameplay video through `tests/record.html`: the `demo` bot
  plays one full run (with one deliberate stop to show capture → rescue → bonus),
  every tick is drawn and piped to ffmpeg, and the game's SFX are rendered offline
  from the same events. Seed 44 wins in 3:15 and uses all five shop items. It mixes
  in the local song when present, so keep those videos local (`artifacts/`).
  Don't edit served files while it records: a Vite reload breaks the capture.

Dev-only URL flags (absent from production builds): `?seed=N`,
`?scene=fire|wreck|bonus|rescue|shop|win|lap|aim|play` (with `&n=` for the house,
pass or lap; `&run=1&t=1.3` starts a bonus pass mid-run), `?debug=1` hitboxes.
`tests/qa.html` renders a busy burning scene at three sizes and reports errors and
brightness.

Capture at least: desktop 1440×900, phone landscape 844×390, portrait
390×844 — title, first house, a burning house, capture/rescue, bonus pass,
results. Look at every frame. For each, note readability, brightness,
overlap, and whether the live player count is visible.

`window.frattyDebug()` returns a read-only snapshot (phase, score, player,
houses, aim lock, bonus, lives). Never expose session tokens or mutation hooks
through it. Headless frame times exclude GPU raster cost; do not report them as
device performance.

Brightness check (mean perceived lightness L*/100 ≥ 0.55 and < 10% near-black
pixels; the old night build measured 0.25–0.32 with 45–72% near-black):

```sh
node .claude/skills/game-playtest-loop/scripts/luminance.mjs shot.png
```

## Owner directives to re-check every build

- The game is named **PIPELINE**; "Greek Row" only as the street name.
- Never mention the banned artist reference (the build lint enforces it).
- The live player count is visible on every screen.
- Starting looks range from pretty to punk.
- Never commit `public/audio/*.mp3`; the repo is public.

## Reporting

Separate: local change, tests run (with counts), bot table, browser frames
reviewed (which sizes), committed, pushed, deployed. Say what you did not
verify (e.g. physical phones).
