# Handoff: Fratty Pipeline (v2)

## Overview
**Fratty Pipeline** is an endless arcade-style browser game with a 90s punk-zine aesthetic. The player is a punk character running up an infinitely scrolling university street, dodging fratbros/sororities/pledges/RAs, collecting items at indie venues, and "burning down" frat houses (by lighting a cigarette at max PUNK meter, then dunking it in a trashcan adjacent to the frat). The fantasy: don't get *pipelined* into greek life — burn it down instead.

## About the Design Files
The files in `design/` are a **design reference created in HTML + Phaser 3** — a fully playable prototype showing intended look, mechanics, and feel. They are **not production code to copy directly**. The implementer's task is to **recreate this game in a target codebase / framework** of their choice (or one already in use). Good options:
- **Phaser 3** (TypeScript) — closest match; the prototype uses Phaser already and would port cleanly
- **PixiJS + a state lib** — if more control is needed
- **HTML5 Canvas from scratch** — feasible; the prototype shows the art is all primitive shapes
- **Godot / Unity** — fine for a more ambitious version, but overkill for this scope

The HTML/CSS chrome around the canvas (panels, meters, overlays) is a separate UI layer — recreate it with whatever the host app uses (React, Vue, plain HTML, etc.). All gameplay drawing happens inside the canvas via Phaser `Graphics` primitives.

## Fidelity
**High-fidelity (hifi).** All colors, typography, spacing, gameplay tuning constants, particle parameters, audio synth values, and interaction timings are final. The implementer should match them as closely as the target framework allows. Some parameter polish (e.g. exact balance of spawn rates) is expected during play-testing; treat the prototype values as a sensible starting point.

## Tech Stack (prototype)
- **Phaser 3.70** (canvas + WebGL renderer) for the game scene
- **Web Audio API** for SFX (no audio assets — all synthesized)
- **Plain HTML/CSS** for surrounding UI (panels, overlays, bottom bar)
- **Spotify Web Playback SDK** referenced but currently stubbed (real PKCE auth needs server config)
- **localStorage** for persisting `fp_best` (best score)

## Game Architecture
The prototype is split into focused modules under `design/js/`:

| File | Responsibility |
|---|---|
| `util.js` | Math helpers, university name lists, Greek-letter abbreviator (`Sigma Chi` → `ΣX`) |
| `entities.js` | Tile constants (`TILE=40`, `COLS=12`, `VIEW_W=480`, `VIEW_H=720`), color palette `FP.COLORS`, all `Graphics`-primitive draw routines (rows, frat house, venues, player, enemies, collectibles, fire, power-up crates), `FP.POWERUPS` registry, `FP.CHARACTER_TYPES` |
| `particles.js` | `ParticleSystem` class — `burst()`, `smoke()`, `trail()`, drawn into a single Graphics layer at depth 80 |
| `audio.js` | `FP.audio` — synthesized SFX (`pickup`, `dash`, `hit`, `burn`, `cig`, `transform`, `powerup`, `combo`, `boom`, `gameover`) |
| `game.js` | `GameScene extends Phaser.Scene` — the entire gameplay loop: state, world building, scrolling, spawning, input, collisions, HUD updates |
| `spotify.js` | Stubbed Spotify connect/play/pause UI for the bottom bar |
| `main.js` | Boot, character chip wiring, start/pause/end overlays, viewport resize |

## Screens / Views

The prototype is a **single screen** with three regions: left HUD panel, center game canvas (480×720), right kit panel. Plus three modal overlay states.

### 1. Main game stage
**Layout**: CSS Grid with `grid-template-columns: 200px 1fr 200px`, gap 14px, padding 14px. Center column is the 480×720 game container.

**Left panel** ("RUN"):
- Score (big, Archivo Black 26px) — current run score
- Best (18px) — best from localStorage
- Burned (18px) — count of frat houses burned this run
- Combo box: "×N" in punk pink, with a thin combo timeout bar underneath
- PUNK meter (pink + orange diagonal stripes, fills as player risks proximity / collects items)
- FRAT meter (blue + light blue stripes, fills when hit by enemies / lingering near frats)
- Pipeline lives: 3 ink-colored shield pips, dimmed when lost

**Right panel** ("KIT"):
- Power-up slot (90px tall, dashed-border when empty, gold + pulse animation when filled, shows icon + name + "Q to use")
- Character strip — 5 chips for Punk / Goth / Skater / Raver / Grunge (toggles player sprite)
- Frat row list — placeholder list of upcoming frat names

**Center game canvas** (Phaser): see "Game World" below.

### 2. Start overlay (`#start-overlay`)
Modal over the canvas at run start.
- Title "FRATTY PIPELINE" (Archivo Black 32px)
- Sub "don't get pipelined. burn it down." (VT323 16px, 70% opacity)
- 3-line `<ul class="how">` of controls with `<kbd>` tags
- 3-row `.how-grid` explaining RISK / COMBO / BURN
- Big primary button "START RUN"

### 3. Pause overlay (`#overlay`)
Reused for both pause and game-over. Triggered by `P` key or via `window.fpTogglePause()`.
- Title "PAUSED" or "PIPELINED" or "NEW BEST!"
- Stats block (score, best, burned)
- Button "RESUME" or "RUN AGAIN"

### 4. Top bar
56px, ink border-bottom 2px.
- Brand mark "F/P" (white-on-black, rotated -2°), Archivo Black
- "FRATTY PIPELINE" wordmark + "an endless burn-down · v2" subtitle (VT323)
- University select dropdown (USC, UCLA, UC Berkeley, UT Austin, Michigan)
- "Connect Spotify" button (ghost variant)

### 5. Bottom bar
44px, ink background, paper text.
- Play/pause icon buttons + track name (VT323)
- User name + logout button (right side)

## Game World

### Coordinate system
- 12 columns × variable rows, each tile 40px = 480px wide
- Columns 0, 11: grass (occasionally tree)
- Columns 1, 10: sidewalk (occasionally bush)
- Columns 2–9: road (with center dashed line every 3rd row at columns 5–6)
- Manholes spawn rarely on road tiles

### Scroll
World scrolls **downward** at `SCROLL_SPEED` (starts 110, accelerates by 0.0008 per ms, capped 220). Skateboard power-up multiplies by 1.7. Pipeline (FRAT meter > 0.6) slows to 0.7×. RA freeze drops to 0.2×.

Rows are recycled: when a row's `y > VIEW_H + 2*TILE`, it's repositioned above the topmost row with a freshly generated `rowData`. Same recycling pattern for every entity.

### Player
- Spawns at column 6, y = `VIEW_H * 0.78`
- **Hybrid movement**: tap arrow / WASD = step one column; hold > 220ms = glide-step every 110ms. Up/down moves the player Y in 40px increments (clamped to `[3*TILE, VIEW_H - 1.5*TILE]`)
- Lane lerp: `playerX` lerps toward `playerLane * TILE + TILE/2` at `min(1, dt/1000 * 18)`
- 4-frame walk cycle, frame switches every 130ms
- 5 character types (`FP.CHARACTER_TYPES`) — different hair styles (mohawk, goth fringe, beanie, raver pigtails, grunge), shirt + logo colors

### Frat houses
- 3 tiles wide × 4 tiles tall, anchored to left (col 1) or right (col 8) sidewalk
- Greek-letter banner across top showing abbreviated name (`FP.greekAbbr`)
- 4 yellow windows, dark front door
- Boss variant: pink tint overlay, larger banner text (20px), 3 HP, banner intro screen flash + spawns 3 fratbros

When the player **lingers within 4 tiles** of a frat house (without cigarette and not invuln):
- Charge ring renders around player (depth 45), scaling 0.7→1 of TILE based on intensity
- PUNK meter fills at `intensity * 0.0008 * dt`
- FRAT meter fills at `intensity * (boss ? 0.0012 : 0.0007) * dt` (the risk)
- Player gets a slight magnetic pull toward the frat at `intensity * 0.025` lerp factor

### Trashcans
Spawned alongside each frat house, on the column adjacent to the building's outer edge. Player must stand within 1.5 tiles of the trashcan to burn the linked frat (`F` key when `hasCigarette === true`).

### Friendly venues
3 types: `coffee` (brown wall, green roof), `vinyl` (purple wall, pink roof), `skate` (teal wall, orange roof). Same 3×4 footprint as frat houses, opposite side. Player must enter the venue (overlap) AND reach the upper 40% to "consume" — gives 250–350 × combo points and +0.22 PUNK.

### Enemies
4 types — see `FP.drawFratbro / drawSororityEnemy / drawPledge / drawRA`:

| Kind | Behavior | On contact |
|---|---|---|
| Fratbro | Random walk every 450ms, 35% chance to flip direction | +0.12 FRAT, knockback 1 lane, 700ms invuln |
| Pledge | Slow patrol (700ms cadence) | +0.12 FRAT |
| Sorority | **Chases** player horizontally if within 5 tiles, 220ms cadence | +0.18 FRAT (heavier risk) |
| RA | Patrols. Within 2.5 tiles: **freezes** player (`frozen = 250ms`), shows "FROZEN BY RA" warning | freeze only |

### Collectibles
Spawn on road tiles every 0.9–1.7s. Types: zine (most common — 150 pts), coffee (100), vinyl (175), skateboard (150). Pickup radius 0.8 tile. Each gives `pts × combo` and +0.08 PUNK, +1 combo.

### Power-up crates
Wooden crate sprite with color band matching power-up type. Spawn every 9–13s. Pickup gives +100×combo "POWER" and stores the powerup (only one slot — overwrites). Press `Q` to activate.

| Type | Color | Effect |
|---|---|---|
| `skateboard` | cyan | 4s of 1.7× scroll speed |
| `spraypaint` | pink | Tags the active frat → next burn = ×2 score; visible graffiti on the frat |
| `boombox` | orange | Instant 380ms expanding ring (8→200px); knocks all enemies within 5 tiles 3 columns away |
| `moshpit` | gold | 4s invuln + ramming kills enemies on contact |
| `zinebomb` | pink | Clears all on-screen enemies, +80×combo per kill, screen flash + shake |

### Cigarette flow (the core punk loop)
1. Linger near a frat (or pick up enough zines) until PUNK meter hits 1.0
2. `gainCigarette()` fires: PUNK resets, FRAT drops 0.4, 1.2s invuln, "LIT 🔥" big text, redraw player with cigarette
3. Player must reach a trashcan within 1.5 tiles
4. Press `F` → `burnHouse(linkedFrat)` → +1500 × tagMultiplier × combo, flash, shake, smoke + flame particles, animated 3-frame fire on the rubble for 3s, hit-stop 100ms

For boss frats: each `F` does 1 HP damage + 800×combo, requires re-cig for next hit. At 0 HP, full burn animation + 2500 BOSS DOWN bonus + shake 500ms 0.025 amp.

### Combo system
- Starts at 1, max 99
- Bumps on: pickup, kill, venue visit, burn (+2)
- Timeout `COMBO_TIMEOUT = 2400ms`, reset on hit
- Big floating text "×N COMBO!" every multiple of 5
- HUD combo bar fills proportional to remaining timeout

### Lives / Game over
3 lives shown as ink shield-shape pips. Each `takePipeline()` (FRAT meter hits 1.0): -1 life, reset meters, 1.8s invuln, screen flash 380ms (255,90,160). At 0 lives → `triggerGameOver()`: save `fp_best` if beaten, show end overlay, gameover SFX, shake 600ms.

## Design Tokens

### Colors (CSS + canvas)
```css
--ink:    #0a0a0a    /* primary outline + text */
--paper:  #f5f1e8    /* main bg (CSS); canvas uses 0xf0e9d6 */
--paper-2:#e8e2d3
--punk:   #ff2d6f    /* primary accent — combo, charge ring, hit */
--punk-2: #ff7a00    /* secondary accent — flame, boombox */
--frat:   #1a3a8c    /* frat house wall */
--frat-2: #5b9eff    /* frat meter highlight */
--burn:   #ff4d2a    /* fire */
--gold:   #ffd23f    /* highlights, sparks, frat windows */
--green:  #2ad17b    /* trashcan, "good" pickup color */
--line:   rgba(10,10,10,0.18)
```

Canvas-only colors (`FP.COLORS` in `entities.js`):
- `road: 0xc8bfa6`, `roadLine: 0xf0e9d6`, `sidewalk: 0xb5ad96`
- `grass: 0x9ab485`, `grassDark: 0x7a9468`, `bush: 0x6a8458`
- `fratWall: 0x1a3a8c`, `fratWallDark: 0x122968`, `fratRoof: 0x0a1a4a`, `fratWindow: 0xffd23f`
- `coffeeWall: 0x6b4423`, `coffeeRoof: 0x3a8559`
- `recordWall: 0x2a1845`, `recordRoof: 0xd9325b`
- `skateWall: 0x1a6e6e`, `skateRoof: 0xff7a00`
- Skin tones: `[0xf0c8a0, 0xc89870, 0x8b5a3c, 0x5a3820]`
- `flameRed: 0xe63016`, `flameOrange: 0xff7a00`, `flameYellow: 0xffd23f`

### Typography
Loaded via Google Fonts:
- **Archivo Black** — display headings, scores, brand mark, big game text. Letter-spacing 1px. Used at 10–32px.
- **Space Grotesk** (400/500/700) — body text, buttons, labels
- **VT323** — pixel-monospace for retro labels, hints, bottom-bar status. 12–18px.

Game canvas text uses `'"Archivo Black", sans-serif'` for readability against the busy bg.

### Spacing
- App grid gap: 14px
- Panel padding: 10px
- Panel border: 2px solid ink
- Panel offset shadow trick: `::after` block at `inset: 4px -4px -4px 4px; background: ink; z-index: -1;` (gives the chunky punk-zine offset look)
- Game canvas border: 3px ink + 8px 8px 0 ink (hard offset shadow)
- Buttons: 8px 14px padding, 2px ink border, hover translate(-2,-2) + 4px 4px 0 ink shadow

### Borders + shadows
- Most surfaces: solid 2–3px ink border, no rounded corners
- Hard offset shadows (`Npx Npx 0 ink`) — never soft/blurred
- Overlay cards: rotated -1° to -2° for handmade feel
- Power-up slot when filled: `box-shadow: inset 0 0 0 3px paper` + 1.4s scale pulse

### Tile size & viewport
- `TILE = 40` px
- `COLS = 12` (480px wide)
- `VIEW_H = 720` (18 tiles tall)

## Particles
`FP.ParticleSystem` (single Graphics layer, depth 80). Three emit modes:

**`burst(x, y, opts)`** — radial spray
- `count` (default 12), `speed` (120), `colors[]`, `life` (600ms), `size` (4), `gravity` (220), `shape: 'rect'|'circle'`, `drag` (0.98), `upward` (px/s push)

**`smoke(x, y, opts)`** — slow rising puffs
- `count` (6), upward velocity ~30–60, life 900ms, circle shape, fades

**`trail(x, y, color)`** — dash residue, single particle, life 300ms, drag 0.92

Per-particle update: integrates vx/vy with gravity, applies drag, ages out. Render alpha = `fade ? 1-t : 1 - t² * 0.5`.

## Audio
All synthesized via Web Audio API in `FP.audio`. The synth helpers (`tone()`, `noise()`) live at module top.

| Event | Spec |
|---|---|
| `pickup` | square 660→990 Hz, 80ms, peak 0.12 |
| `bigPickup` | square 440→880 + 880→1320 sweep |
| `step` | triangle 220 Hz, 40ms, peak 0.05 |
| `dash` | sawtooth 220→880 sweep + noise tail |
| `hit` | sawtooth 180→60 + noise burst |
| `burn` | sawtooth 80→40 + square 160→80 + noise, 500ms |
| `cig` | square 880→1760 + triangle 1320→2640 |
| `transform` | sawtooth 800→200 + noise (game over–ish) |
| `powerup` | square 330→990, 250ms |
| `combo(level)` | square at `440 + level*80` Hz, 60ms (rising chime) |
| `boom` | sawtooth 100→30 + low-pass noise |
| `gameover` | sawtooth 300→80, 600ms |

## Interactions

### Controls
- `←/→` or `A/D` — step / glide left-right
- `↑/↓` or `W/S` — step / glide up-down
- `SPACE` — dash up 2 tiles, 1.1s cooldown, 320ms invuln
- `F` — burn (when has cigarette + near trashcan)
- `Q` — use stored power-up
- `P` — pause toggle
- `R` or `SPACE` — restart on game over

### Camera effects
- Shake on hit (140ms 0.012), burn (380ms 0.02), boss hit (360ms 0.018), boss kill (500ms 0.025), zine bomb (280ms 0.018), pipeline (420ms 0.025), game over (600ms 0.03)
- Flash on burn (280ms orange), pipeline (380ms pink), zine bomb (220ms pink), boss spawn (180ms pink), cigarette (220ms orange)
- Hit-stop on burn: 100ms full pause (renders particles only)
- Slow-mo: not used in v2 — hit-stop covers it

### Spawn schedule (per ms remaining timer)
- `frat` — 3500–5500ms, only if no active frat. Boss every 4th after 30s of run time
- `venue` — 2400–3800ms
- `enemy` — `1600 .. max(800, 2400 - time*12)` (gets faster). Pool grows over time: fratbro always; pledge after 12s; sorority after 25s; RA after 40s
- `crate` — 9000–13000ms
- `item` — 900–1700ms

## State Management

### Per-run state (reset on `scene.restart()`)
```
score, best, gameOver, paused, lives (3), punkMeter (0..1), fratMeter (0..1),
hasCigarette, combo (1..99), comboTimer,
SCROLL_SPEED, playerCol, playerLane, playerX, playerY, playerVy,
dashCooldown, dashing, invuln, charIdx, skinIdx, walkFrame, walkAccum,
powerup ({type}), activePower ({type, until}),
fratHouses[], activeFratHouse, trashcans[], venues[], enemies[],
collectibles[], crates[], fires[], taggedFrat, frozen, hitstop, boss,
spawnTimers {frat, venue, enemy, crate, item}, rows[], rowCounter,
selectedUniversity, fratNamesUsed
```

### Persisted (localStorage)
- `fp_best` — highest score across runs (integer)

### Window globals (HTML ↔ Phaser bridge)
- `window.gameScene` — set in `GameScene.create()` for HUD updates from outside
- `window.fpGame` — Phaser.Game instance
- `window.fpTogglePause()` — called by `P` key or pause button
- `window.fpShowEnd(score, best)` — called from `triggerGameOver()`

## HUD update protocol
`GameScene.updateHud()` runs every tick and writes to:
- `#hud-score`, `#hud-best`, `#hud-burned` — text content
- `#hud-combo` — text + adds `.pop` class for 120ms scale animation
- `#hud-combo-bar` — `style.width = pct%`
- `#meter-punk-fill`, `#meter-frat-fill` — `style.width = (meter*100)%`
- `#hud-lives` — rebuilds 3 `.life-pip` divs (`.lost` for missing)
- `#powerup-slot` — toggles `.has` class, rebuilds inner HTML
- In-canvas: `bossBanner`, `bossHpBg/Fg`, `warnText`, `powerActiveText`, `fPrompt` Phaser texts

## Responsive behavior
- ≥1100px: 3-column layout, panels alongside 480×720 game
- <1100px: panels collapse to grids above/below; game scales to viewport width while keeping 480:720 aspect ratio
- `main.js` `resize()` recomputes wrapper dimensions on every `window.resize` event

## Files in handoff
```
design/
├── index.html              — page chrome, HUD markup, overlay markup, script load order
├── styles.css              — all UI styling (panels, meters, overlays, buttons)
└── js/
    ├── util.js             — math, university name lists, Greek abbreviator
    ├── audio.js            — Web Audio synth SFX
    ├── particles.js        — particle system class
    ├── entities.js         — TILE/COLS constants, color palette, all draw routines, POWERUPS, CHARACTER_TYPES
    ├── game.js             — GameScene (Phaser.Scene): the entire gameplay
    ├── spotify.js          — stubbed Spotify connect UI
    └── main.js             — boot, character chips, overlays, resize
```

## Implementation Notes for Claude Code

1. **Port target.** If unsure, port to **Phaser 3 + TypeScript** in a Vite project — minimal friction. Otherwise pick what fits the host codebase (e.g. integrate as a React component using `<canvas>` + Phaser game inside a ref).

2. **Don't try to render the punk character art with sprite sheets.** All art is `Phaser.Graphics` primitives drawn from JS — porting to a different engine means rewriting `entities.js` against that engine's draw API (or generating sprite atlases at build time).

3. **Spotify stub.** The `spotify.js` here is a UI placeholder. Real PKCE auth needs:
   - A redirect URI registered in the Spotify dashboard
   - Server-side or static-site code-verifier flow
   - Web Playback SDK premium account requirement
   See the `_original/main.js` (not in handoff) for the full original auth flow if needed.

4. **Tuning constants.** Most balance values are clustered at the top of `GameScene.initState()` and inside `handleSpawning()`. Keep them in one config object for easier playtesting.

5. **Audio in browsers.** `AudioContext` must be resumed on first user gesture — `FP.audio.resume()` is called in `beginRun()` and on the start button click.

6. **localStorage key namespace.** Currently bare (`fp_best`). Namespace it (e.g. `fratty-pipeline:best`) before shipping.

7. **No assets.** Everything is procedural. No image/audio files to bundle.
