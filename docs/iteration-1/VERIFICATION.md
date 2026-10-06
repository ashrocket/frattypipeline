# PIPELINE iteration 1 — verification

Local implementation on `codex/greek-row-skateboard`, based on `c302d60`. All changes remain uncommitted. No push, PR, merge, or deployment was performed. `main` was not changed. The local recording remains ignored and untracked.

## Implemented scope

| Spec | Changed behavior and primary files | Verification |
|---|---|---|
| A, D12 | PIPELINE branding; fictional roster; five cosmetic looks and hair colors; persistent selection; conformity targets the uniform. `index.html`, `src/data/`, `src/render/player.js`. | Copy lint, built-byte audit, five-look gauntlet parity, browser preview, uniform pixel audit. |
| A3, D14 | Public cached count endpoint, counts across screens, heartbeat retries at 2/4/8 seconds, real lease expiry, session-cap warning, hidden-tab idle release. `server/http.mjs`, `server/queue.mjs`, `src/session.js`, `src/main.js`. Worker uses the same handler and constant singleton name. | Real local HTTP tests, fake-clock client tests, Worker bundle dry-run, browser count. |
| D1 | Fixed 60 Hz accumulator; simulation-owned input queue and buffer; separate beat/motion clocks; readable sim, data, render modules. Dead Three renderer and dependency removed. | Exact event-log replay for seeds 1–20 at 30/60/120 render fps, ideal supplied beat versus fallback beat. |
| D2–D3 | Twelve houses, district strips, player-paced velocity, arena walls/camera, press-only push phases, exact ollie integration and landing lag. | Focused movement, camera, input, and jump tests; shared layout browser checks. |
| D4 | Charge/release TOSS, LOB, AIR MAIL; fixed lead; visible reticle; short/doused/missed bottles consume ammo; beat landings and fizzle. | Focused throw tests and impact timing assertions across every gauntlet run. |
| D5 | Door waves and guard chunks, porch attacks, reinforcement, per-house timer, TIME OVER, boss bars and final three phases. Counter-throw implemented. | House/timer/super regression tests; caps, timing, pacing and termination gate. |
| D6 | Five enemy silhouettes and tell/active/recovery states; LOW/MID/HIGH defense; no-contact finance pitch; parry; visible danger markings. | Threat-source and visibility assertions at both phone sizes; cap/token gate; pitch-separation tests. |
| D7–D8 | Riot, TOUCH GRASS, skate counters and ammo economy; bottle icons, coffee/vinyl/tricks, district refill. | Focused super/damage/ammo tests; degenerate and suicide policies. |
| D9 | Chosen-look uniform layers, beat-timed clones/rip/comeback, three lives, continues and 1CC. No comeback damage multiplier. | Transformation, reset/continue and damage regression tests; suicide score/time gate. |
| D10–D11 | Canvas HUD, trails, callout priority, VS, KO freeze/slow motion, world-only shake, reduced motion, pooled particles and response SFX. | Canvas fixtures at all three sizes, final-KO regression, browser pause/rotation checks. |
| D13 | Correct measured beatmap; decoded Web Audio clock, beat-scheduled impacts, loop, mute/mix/offset controls, sound check, pause/resume, ducking, missing-song mode and importer fix. | Beat/calibration/audio scheduling tests; decoded MP3 browser run; pause suspended/resume running; song-free build fixture. |
| D15 | Keyboard edges, gamepad mapping/dead zone, touch stick/flick and independent action pointers, full-Riot SUPER button. | Controls unit fixtures, scripted keyboard browser run, portrait/landscape UI review. |
| D16–D17 | Frozen input-only degenerate bots, delayed visible perception, hold-out gate, cosmetic parity, real-time beat during frozen motion and re-snapped attacks. | Baseline failure reproduced; 30-seed smoke in npm test; 100-seed reviewer run; 200-seed training plus 200-seed hold-out. |
| D18 | Round 1 starts at beat 8; archetypes introduced house by house; contextual device prompts and first-full Riot hint. | Encounter data assertions and real simulation progression. |
| D19 | Cached scenery/facades, zero per-frame gradients, layer-stack player poses and substantial uniform steps, danger silhouettes, canvas performance stats. | Six-enemy fixture with particles at cap; every uniform step exceeds 8% changed opaque pixels. |

## Final commands and outputs

- `npm test`: **51 passed, 0 failed**, 40,933.378125 ms. Includes all 30 seeds × five looks × eleven policies (1,650 smoke runs). [Full output](npm-test.txt).
- `npm run build`: **PASS**, 29 modules, 91 ms; JS 77.61 kB / 29.67 kB gzip; built-copy audit PASS. [Full output](build.txt).
- `node scripts/baseline-gate.mjs`: baseline `c302d60` reproduced **100/100** hold-throw wins, mean **63.3 s**; fun-floor gate **FAIL as expected**. [Output](baseline.txt).
- `node scripts/bot-gauntlet.mjs`: **PASS**, 100 seeds × five looks × eleven policies = **5,500 runs**. Skilled **99%**, median **249.9 s**; novice **33%**, 100% reach district 3; all spam and mash policies 0% wins. [Verbatim table](gauntlet-100.txt).
- `npm run gauntlet`: **FULL GATE PASS**, 200 training seeds + 200 hold-out seeds × five looks × eleven policies = **22,000 runs**. Skilled training/hold-out: **99.5% / 100%**, medians **249.8 / 249.2 s**. Novice: **32% / 29.5%**. All frozen-policy, cosmetic-parity, fairness, termination, score, pacing and ±5-point drift gates passed. [Full output](gauntlet-full.txt).
- Song-free temporary fixture: `npm run build` **exit 0** with `SONG FILE MISSING` warning; `npm run check:song` **exit 1**. [Output](missing-song-build.txt). The real local MP3 was not moved or deleted.
- `npx wrangler deploy --dry-run`: **PASS**, Durable Object and asset bindings bundled; no deployment. [Output](worker-dry-run.txt).
- `git diff --check`: **PASS**. [Source SHA-256 manifest](source-sha256.txt).

## Browser evidence

Connected Chrome was used against the separately started dev server at `http://127.0.0.1:5173` with admission on port 8797. The supplied Playwright harness could not launch Chrome under the workspace sandbox (EPERM/SIGABRT); no permission bypass was attempted.

The final scripted run lasted **60.0016 seconds**, exercised **599 keyboard input pulses**, and recorded **zero console errors, runtime errors, or unhandled rejections**. The real MP3 decoded and the AudioContext was running. Pause held the simulation at 60.35 seconds with audio suspended; resume returned to playing with audio running after the count-in. [Structured evidence](browser-evidence.json), [re-runnable browser harness](../../tests/qa.html).

Desktop 1440×900, portrait 390×844, and landscape 844×390 were visually inspected, including phone pause screens and rotation. A six-enemy final-arena fixture at maximum particles measured:

| Canvas | Fill/stroke/drawImage operations | Gradients | Particles |
|---|---:|---:|---:|
| 1440×900 | 439 | 0 | 192 |
| 390×844 | 360 | 0 | 96 |
| 844×390 | 343 | 0 | 96 |

Portrait HUD height is **56 px**, usable height free of HUD/controls is **76.78%**, and the player's base is at **77.5%**. All six fixture threats are visible at each size. The 25 uniform-piece comparisons across all five looks change **10.79–34.55%** of opaque pixels.

## Interpretations, limitations, and preserved work

- D4's explicit fixed .60/.90-second aim lead wins over D13's conflicting actual-flight-time aim sentence. Beat phase stretches the arc without moving the reticle.
- D13's explicit removal of the demo sequencer wins over the later fallback sentence: missing music uses SFX plus the visual beat clock and an honest missing-file label.
- D19's `YOU, UNFILTERED` label applies to every chosen look.
- A conga formation is one attack actor/token; its followers share the leader's pass and flee together. This reconciles a 4–7-person line with the smaller district actor caps.
- Optional SHOULD items deferred: remapping UI, ASSIST auto-throw, PIPELINE DROP, and adaptive music-section jumps. Counter-throw is included. Iteration 2 was not implemented.
- No physical iPhone, Bluetooth-earbud latency, or physical gamepad validation was available. Browser viewport checks and Gamepad API fixtures are evidence for those layers, not a claim of device certification or subjective audio listening QA.
- The reviewer's existing server at **5273** and queue at **8897** were left running. Its queue process predates the new status route and needs a normal restart to load it. The separate **5173/8797** server serves the verified implementation now.
- Concurrent idle-release/lease-grace edits that appeared in `src/main.js`, `src/session.js`, `server/queue.mjs`, and their client/queue tests were preserved and included in final verification.
- Frozen degenerate policy SHA-256: `a4e3d2b2b19a1d7c502ec88bc66719e6ce472cb0d3a3c2e1cca393a51cc2b5ef`. Intermediate tuning probes remain under [tuning-history](tuning-history/README.md); they are not final pass claims.

## Important changed paths

Simulation: `src/sim/`, `src/model.js`, `src/data/`. Presentation: `src/render/`, `src/layout.js`, `src/renderer-flat.js`, `styles.css`, `index.html`, `public/icon.svg`. Integration: `src/main.js`, `src/audio.js`, `src/controls.js`, `src/session.js`, `server/http.mjs`, `server/queue.mjs`. Verification/tooling: `tests/`, `scripts/bots/`, `scripts/gauntlet.mjs`, `scripts/bot-gauntlet.mjs`, `scripts/baseline-gate.mjs`, song/copy scripts, package files. Documentation: `AGENTS.md`, `README.md`, `public/audio/README.md`, this evidence folder. `src/renderer.js` was removed.
