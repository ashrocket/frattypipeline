# Icons & Sprites Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make collectible icons instantly readable at 40×40px: vinyl becomes a bold album disc, zine becomes a recognisable newsprint booklet, and coffee is replaced by a burning joint with a visible ember and smoke curl.

**Architecture:** All icons are drawn procedurally via Phaser Graphics calls in `FP.drawCollectible()` in `entities.js`. Adding `joint` means: add the draw branch, add it to the spawn pool in `game.js`, update the points map, update the HTML legend. No new files needed.

**Tech Stack:** Phaser 3.70 Graphics API (fillRect, fillCircle, strokePath, beginPath, lineTo, moveTo), vanilla JS.

**Design note (sprite review):** Before shipping, dispatch a general-purpose subagent to audit the drawing code: "Read `/Users/ashrocket/ashcode/frattypipeline/js/entities.js` lines 494–600. For each collectible type, describe what the icon will look like at 40×40px on a light cream background and flag anything that won't be readable at that size."

---

## File Map

| File | Change |
|------|--------|
| `js/entities.js:519-538` | Redraw `vinyl` — bolder label, lighter grooves, visible sleeve |
| `js/entities.js:567-594` | Redraw `zine` — bolder cover, visible hand-lettered title, more contrast |
| `js/entities.js:494-518` | Replace `coffee` draw with `joint` draw; keep `coffee` as fallback alias |
| `js/game.js:704` | Spawn pool: replace `'coffee'` entries with `'joint'` |
| `js/game.js:718` | Points map: add `joint: 120` entry |
| `index.html:90` | Legend: update Coffee → Joint line |

---

### Task 1: Redraw vinyl as a bold album

TILE = 40px. The current vinyl is a black circle with a tiny pink centre label — hard to read. Goal: a clearly disc-shaped record with wide visible grooves and a prominent pink label.

**Files:**
- Modify: `js/entities.js` — `vinyl` branch of `FP.drawCollectible`

- [ ] **Step 1: Replace the vinyl draw block**

Find and replace the entire `} else if (type === 'vinyl') {` block (lines 519–538):
```js
} else if (type === 'vinyl') {
  // Hot-pink glow halo
  g.fillStyle(0xff2d6f, 0.25);
  g.fillCircle(s * 0.5, s * 0.5, s * 0.46);
  // Outer sleeve (white cardboard)
  g.fillStyle(0xfff5e0);
  g.fillRect(s * 0.1, s * 0.1, s * 0.8, s * 0.8);
  g.lineStyle(2, FP.COLORS.ink);
  g.strokeRect(s * 0.1, s * 0.1, s * 0.8, s * 0.8);
  // Record peeking out (black disc, slightly offset)
  g.fillStyle(0x111111);
  g.fillCircle(s * 0.52, s * 0.52, s * 0.32);
  // Wide groove rings
  g.lineStyle(1.5, 0x333333, 0.9);
  g.strokeCircle(s * 0.52, s * 0.52, s * 0.26);
  g.strokeCircle(s * 0.52, s * 0.52, s * 0.20);
  g.strokeCircle(s * 0.52, s * 0.52, s * 0.14);
  // Bold pink centre label
  g.fillStyle(0xff2d6f);
  g.fillCircle(s * 0.52, s * 0.52, s * 0.1);
  // Centre hole
  g.fillStyle(FP.COLORS.ink);
  g.fillCircle(s * 0.52, s * 0.52, s * 0.03);
  // Sleeve text stripe (white line = "VINYL" implied)
  g.fillStyle(FP.COLORS.ink);
  g.fillRect(s * 0.14, s * 0.72, s * 0.42, 2);
  g.fillRect(s * 0.14, s * 0.77, s * 0.3, 2);
```

- [ ] **Step 2: Verify visually**

Open the game, start a run. Collect a vinyl: it should look like a record sleeve with a peeking black disc and obvious pink label. Readable from a few metres away.

- [ ] **Step 3: Commit**

```bash
cd /Users/ashrocket/ashcode/frattypipeline
git add js/entities.js
git commit -m "feat: redraw vinyl icon as album sleeve with bold label"
```

---

### Task 2: Redraw zine as a legible newsprint booklet

Current zine has low-contrast body text lines on cream. Goal: dark rough-edged cover with obvious hand-lettered title bars, and a punk sticker in the corner.

**Files:**
- Modify: `js/entities.js` — `zine` branch of `FP.drawCollectible`

- [ ] **Step 1: Replace the zine draw block**

Find and replace the entire `} else { // zine` block (lines 567–594) — this is the final else so keep the outer brace:
```js
} else { // zine
  // Gold glow halo
  g.fillStyle(0xffd23f, 0.28);
  g.fillCircle(s * 0.5, s * 0.5, s * 0.44);
  // Zine body — off-white newsprint
  g.fillStyle(0xf0e9d6);
  g.fillRect(s * 0.12, s * 0.08, s * 0.76, s * 0.84);
  g.lineStyle(2, FP.COLORS.ink);
  g.strokeRect(s * 0.12, s * 0.08, s * 0.76, s * 0.84);
  // Bold dark cover band (top 35%)
  g.fillStyle(FP.COLORS.ink);
  g.fillRect(s * 0.12, s * 0.08, s * 0.76, s * 0.3);
  // White title bars on cover
  g.fillStyle(0xffffff);
  g.fillRect(s * 0.18, s * 0.14, s * 0.64, s * 0.08);
  g.fillRect(s * 0.18, s * 0.25, s * 0.44, s * 0.06);
  // Punk-pink accent bar (like a highlighter stripe)
  g.fillStyle(0xff2d6f);
  g.fillRect(s * 0.12, s * 0.38, s * 0.76, s * 0.05);
  // Body text lines (3 lines)
  g.fillStyle(FP.COLORS.ink);
  for (let i = 0; i < 3; i++) {
    g.fillRect(s * 0.18, s * 0.47 + i * s * 0.1, s * 0.6, 2.5);
  }
  g.fillRect(s * 0.18, s * 0.77, s * 0.38, 2.5);
  // Staple marks (left spine)
  g.fillStyle(0x999999);
  g.fillRect(s * 0.12, s * 0.22, 4, 5);
  g.fillRect(s * 0.12, s * 0.62, 4, 5);
  // Orange punk sticker (bottom right)
  g.fillStyle(0xff7a00);
  g.fillCircle(s * 0.74, s * 0.78, 7);
  g.lineStyle(1.5, FP.COLORS.ink);
  g.strokeCircle(s * 0.74, s * 0.78, 7);
  // Tiny X inside sticker
  g.lineStyle(2, FP.COLORS.ink);
  g.beginPath(); g.moveTo(s*0.7, s*0.74); g.lineTo(s*0.78, s*0.82); g.strokePath();
  g.beginPath(); g.moveTo(s*0.78, s*0.74); g.lineTo(s*0.7, s*0.82); g.strokePath();
```

- [ ] **Step 2: Verify visually**

The zine should be unmistakably a small folded booklet: dark top band, white title lines, orange dot sticker.

- [ ] **Step 3: Commit**

```bash
git add js/entities.js
git commit -m "feat: redraw zine icon with bold cover and punk sticker"
```

---

### Task 3: Add burning joint collectible (replaces coffee)

A burning joint: white cylinder body, twisted end, glowing orange ember tip with smoke curl. Keep `coffee` as an aliased fallback so nothing hard-crashes if the type appears in old saves.

**Files:**
- Modify: `js/entities.js` — replace `coffee` draw block with `joint`
- Modify: `js/game.js:704` — spawn pool
- Modify: `js/game.js:718` — points map
- Modify: `index.html:90` — legend

- [ ] **Step 1: Replace the coffee draw block with joint**

Find the `if (type === 'coffee') {` block (lines 496–518) and replace it entirely:
```js
if (type === 'coffee' || type === 'joint') {
  // Warm orange glow halo
  g.fillStyle(0xff7a00, 0.22);
  g.fillCircle(s * 0.5, s * 0.52, s * 0.42);
  // Joint body — white rolled paper, diagonal
  g.fillStyle(0xfff5e0);
  // Main cylinder (rotated via rect at angle — use thin tall rect centred)
  g.fillRect(s * 0.36, s * 0.22, s * 0.28, s * 0.52);
  g.lineStyle(1.5, FP.COLORS.ink);
  g.strokeRect(s * 0.36, s * 0.22, s * 0.28, s * 0.52);
  // Rolling paper texture lines
  g.lineStyle(1, FP.COLORS.ink, 0.3);
  for (let i = 1; i < 4; i++) {
    g.beginPath();
    g.moveTo(s * 0.36, s * (0.22 + i * 0.12));
    g.lineTo(s * 0.64, s * (0.22 + i * 0.12));
    g.strokePath();
  }
  // Twisted tip (top)
  g.fillStyle(0xfff5e0);
  g.fillTriangle(s * 0.42, s * 0.22, s * 0.5, s * 0.1, s * 0.58, s * 0.22);
  g.lineStyle(1, FP.COLORS.ink);
  g.strokeTriangle(s * 0.42, s * 0.22, s * 0.5, s * 0.1, s * 0.58, s * 0.22);
  // Ember tip — glowing orange circle at the lit end (bottom)
  g.fillStyle(0xff4d2a);
  g.fillCircle(s * 0.5, s * 0.78, 6);
  g.fillStyle(0xff9900);
  g.fillCircle(s * 0.5, s * 0.78, 3.5);
  g.fillStyle(0xffd23f);
  g.fillCircle(s * 0.5, s * 0.78, 1.5);
  // Smoke curl (3 dots drifting up-right)
  g.fillStyle(0xcccccc, 0.7);
  g.fillCircle(s * 0.54, s * 0.68, 2.5);
  g.fillStyle(0xbbbbbb, 0.5);
  g.fillCircle(s * 0.58, s * 0.58, 2);
  g.fillStyle(0xaaaaaa, 0.35);
  g.fillCircle(s * 0.62, s * 0.48, 1.5);
```

- [ ] **Step 2: Update spawn pool in `game.js`**

Find line 704 in `js/game.js`:
```js
const types = ['zine', 'zine', 'zine', 'coffee', 'vinyl', 'skateboard'];
```
Replace with:
```js
const types = ['zine', 'zine', 'joint', 'joint', 'vinyl', 'skateboard'];
```

- [ ] **Step 3: Update points map in `game.js`**

Find line 718 in `js/game.js`:
```js
const ptsMap = { zine: 150, coffee: 100, vinyl: 175, skateboard: 150 };
```
Replace with:
```js
const ptsMap = { zine: 150, coffee: 100, joint: 120, vinyl: 175, skateboard: 150 };
```

- [ ] **Step 4: Update HTML legend**

In `index.html`, find:
```html
<div class="legend-item"><span class="ldot" style="background:#ff7a00"></span>Coffee — +PUNK pts</div>
```
Replace with:
```html
<div class="legend-item"><span class="ldot" style="background:#ff7a00"></span>Joint — +PUNK pts</div>
```

- [ ] **Step 5: Verify visually**

Run the game. Spawned items should include a white tube with a glowing orange tip and grey smoke wisps. Should be unmistakably a lit joint at 40px.

- [ ] **Step 6: Dispatch sprite review subagent**

After implementing, dispatch a general-purpose agent:
> "Read `/Users/ashrocket/ashcode/frattypipeline/js/entities.js` lines 494–600. For each collectible type (joint, vinyl, zine, skateboard), describe what the icon will look like rendered at exactly 40×40 pixels on a cream (#f0e9d6) background. Flag any shapes that will be too small to read, any colour combinations that'll look muddy, and any draw operations that might clip outside the 40px bounds."

Incorporate any feedback before committing.

- [ ] **Step 7: Commit**

```bash
git add js/entities.js js/game.js index.html
git commit -m "feat: add burning joint collectible, replace coffee in spawn pool"
```

---

## Self-Review

**Spec coverage:**
- ✅ Album: vinyl redrawn as sleeve + disc
- ✅ Zine: bold cover, newsprint body, punk sticker
- ✅ Burning joint: glowing ember, smoke drift, replaces coffee
- ✅ Legend updated
- ✅ Points map updated

**Placeholder scan:** None — all draw code is complete and explicit.

**Type consistency:** `type === 'coffee' || type === 'joint'` in draw covers the alias. Spawn pool uses `'joint'` only. Points map has both keys.
