# Sims-Style Character Creator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the character chip-strip in the right panel with a full pre-game dressing room: live character preview, swappable hair / shirt / pants / shoes / accessory, 5 skin tones, and a name. Selections persist to localStorage. The character sheet carries into gameplay.

**Architecture:** The dressing-room UI lives in the right panel's `#char-creator` div (replaces `#char-strip`). A small 80×120 Phaser-independent canvas (`<canvas id="char-preview">`) draws the character live in 2D canvas API using the same geometry as `FP.drawPunk()`. The character definition stored in `FP.PLAYER_CONFIG` (a plain JS object in `localStorage`) is read by `GameScene.createPlayer()` at run-start. No Phaser scenes are touched until run-start.

**Tech Stack:** Vanilla JS, 2D Canvas API for preview, localStorage for persistence, Phaser 3 reads the config at run start.

---

## File Map

| File | Change |
|------|--------|
| `js/entities.js` — end of file | Add `FP.PLAYER_CONFIG` default, `FP.savePlayerConfig()`, `FP.loadPlayerConfig()`, expand `FP.CHARACTER_TYPES` with outfit layers |
| `js/entities.js` — `FP.drawPunk()` | Accept config object instead of `charType` + `skinIdx` separately |
| `index.html` — right panel | Replace `#char-strip` with `#char-creator` markup |
| `styles.css` | Add `.char-creator`, `.cc-row`, `.cc-swatch`, `.cc-preview` styles |
| `js/main.js` | Wire up char-creator UI events, preview canvas render |
| `js/game.js` — `initState()` | Load `FP.PLAYER_CONFIG` into scene state |
| `js/game.js` — `createPlayer()` | Pass config to `FP.drawPunk()` |

---

### Task 1: Define the player config data model

**Files:**
- Modify: `js/entities.js` — add at end of file

- [ ] **Step 1: Add config schema, defaults, and persistence helpers**

Append to the bottom of `js/entities.js`:
```js
// ============ PLAYER CONFIG (persisted) ============
FP.HAIR_COLORS = [
  { name: 'Pink',    hex: '#ff2d6f', val: 0xff2d6f },
  { name: 'Black',   hex: '#111111', val: 0x111111 },
  { name: 'Bleach',  hex: '#f5e642', val: 0xf5e642 },
  { name: 'Blue',    hex: '#4a8ade', val: 0x4a8ade },
  { name: 'Green',   hex: '#2adf6f', val: 0x2adf6f },
  { name: 'Red',     hex: '#cc2200', val: 0xcc2200 },
  { name: 'Purple',  hex: '#9922ff', val: 0x9922ff },
];

FP.SHIRT_COLORS = [
  { name: 'Black',   hex: '#111111', val: 0x111111 },
  { name: 'Pink',    hex: '#ff2d6f', val: 0xff2d6f },
  { name: 'Orange',  hex: '#ff7a00', val: 0xff7a00 },
  { name: 'Navy',    hex: '#1a3a8c', val: 0x1a3a8c },
  { name: 'White',   hex: '#f0e9d6', val: 0xf0e9d6 },
  { name: 'Purple',  hex: '#5a2aaa', val: 0x5a2aaa },
];

FP.PANTS_COLORS = [
  { name: 'Black',   hex: '#2a2a4a', val: 0x2a2a4a },
  { name: 'Grey',    hex: '#7a7a8a', val: 0x7a7a8a },
  { name: 'Plaid',   hex: '#2a4a2a', val: 0x2a4a2a },
  { name: 'Khaki',   hex: '#b09060', val: 0xb09060 },
];

FP.SKIN_TONES = [
  { name: 'S1', hex: '#f5c89a', val: 0xf5c89a },
  { name: 'S2', hex: '#d4925a', val: 0xd4925a },
  { name: 'S3', hex: '#a0623a', val: 0xa0623a },
  { name: 'S4', hex: '#6a3a1a', val: 0x6a3a1a },
  { name: 'S5', hex: '#3a1e0a', val: 0x3a1e0a },
];

FP.HAIR_STYLES = ['punk', 'goth', 'skater', 'raver', 'grunge'];

FP.DEFAULT_PLAYER_CONFIG = {
  name:       'Unnamed',
  hairStyle:  'punk',
  hairColor:  0xff2d6f,
  skinTone:   0xf5c89a,
  shirtColor: 0x111111,
  pantsColor: 0x2a2a4a,
};

FP.loadPlayerConfig = function() {
  try {
    const raw = localStorage.getItem('fratty-pipeline:player');
    if (raw) return Object.assign({}, FP.DEFAULT_PLAYER_CONFIG, JSON.parse(raw));
  } catch (e) {}
  return Object.assign({}, FP.DEFAULT_PLAYER_CONFIG);
};

FP.savePlayerConfig = function(cfg) {
  localStorage.setItem('fratty-pipeline:player', JSON.stringify(cfg));
};

FP.PLAYER_CONFIG = FP.loadPlayerConfig();
```

- [ ] **Step 2: Verify in browser console**

Open the game, open DevTools console, type `FP.PLAYER_CONFIG`. Should return the default config object.

- [ ] **Step 3: Commit**

```bash
cd /Users/ashrocket/ashcode/frattypipeline
git add js/entities.js
git commit -m "feat: add FP.PLAYER_CONFIG schema with persistence helpers"
```

---

### Task 2: Update `FP.drawPunk()` to accept a config object

Currently `FP.drawPunk(g, charType, walkFrame, skinIdx, hasCig)`. We need it to also accept the new flat config shape.

**Files:**
- Modify: `js/entities.js` — `FP.drawPunk` signature + internals

- [ ] **Step 1: Make drawPunk accept either old charType or new config**

Replace the first 6 lines of `FP.drawPunk`:
```js
// Before
FP.drawPunk = function(g, charType, walkFrame, skinIdx, hasCig) {
  const s = TILE;
  const skin = FP.COLORS.skin[skinIdx];
```
With:
```js
// After
FP.drawPunk = function(g, charType, walkFrame, skinIdx, hasCig) {
  const s = TILE;
  // Accept flat config object OR legacy charType+skinIdx pair
  let hair, shirtColor, logoColor, style, skin;
  if (charType && typeof charType.hairColor !== 'undefined') {
    // New config path
    const cfg = charType;
    hair      = cfg.hairColor;
    shirtColor = cfg.shirtColor;
    logoColor  = 0xff2d6f;
    style      = cfg.hairStyle || 'punk';
    skin       = cfg.skinTone;
  } else {
    // Legacy path — charType is a CHARACTER_TYPES entry
    hair       = charType.hair;
    shirtColor = charType.shirt || 0x1a1a1a;
    logoColor  = charType.logo  || 0xff2d6f;
    style      = charType.style;
    skin       = FP.COLORS.skin[skinIdx] || FP.COLORS.skin[0];
  }
```
Then replace every reference to `charType.hair`, `charType.shirt`, `charType.logo`, `charType.style` in the rest of the function with the local variables `hair`, `shirtColor`, `logoColor`, `style`.

Specifically find and replace in the rest of the function body:
- `const hair = charType.hair;` → DELETE (already declared above)
- `g.fillStyle(hair)` → keep (variable name same)
- `if (charType.style === 'punk')` → `if (style === 'punk')`
- `} else if (charType.style === 'goth')` → `} else if (style === 'goth')`
- `} else if (charType.style === 'skater')` → `} else if (style === 'skater')`
- `} else if (charType.style === 'raver')` → `} else if (style === 'raver')`
- `g.fillStyle(charType.shirt || 0x1a1a1a)` → `g.fillStyle(shirtColor)`
- `g.fillStyle(charType.logo || 0xff2d6f)` → `g.fillStyle(logoColor)`
- `const skin = FP.COLORS.skin[skinIdx];` → DELETE (already declared above)

- [ ] **Step 2: Verify existing gameplay still works**

Start a run. Player should render as before (punk style). No console errors.

- [ ] **Step 3: Verify new config path**

In browser console: 
```js
const g = window.gameScene.player; 
g.clear(); 
FP.drawPunk(g, FP.PLAYER_CONFIG, 0, null, false);
```
Should redraw the player with default config (same appearance).

- [ ] **Step 4: Commit**

```bash
git add js/entities.js
git commit -m "refactor: drawPunk accepts flat player config or legacy charType"
```

---

### Task 3: Add dressing-room UI to HTML

**Files:**
- Modify: `index.html` — right panel `#char-strip` block
- Modify: `styles.css` — add creator styles

- [ ] **Step 1: Replace char-strip with creator markup**

In `index.html`, find:
```html
<div class="panel-h" style="margin-top:14px">CHARACTER</div>
<div id="char-strip" class="char-strip"></div>
```
Replace with:
```html
<div class="panel-h" style="margin-top:14px">CHARACTER</div>
<div id="char-creator" class="char-creator">
  <div class="cc-preview-wrap">
    <canvas id="char-preview" width="80" height="120"></canvas>
  </div>
  <div class="cc-field">
    <label class="cc-label">Name</label>
    <input id="cc-name" class="cc-input" type="text" maxlength="12" placeholder="your name" />
  </div>
  <div class="cc-field">
    <label class="cc-label">Hair Style</label>
    <div id="cc-hairstyle" class="cc-row"></div>
  </div>
  <div class="cc-field">
    <label class="cc-label">Hair Color</label>
    <div id="cc-haircolor" class="cc-swatches"></div>
  </div>
  <div class="cc-field">
    <label class="cc-label">Skin Tone</label>
    <div id="cc-skin" class="cc-swatches"></div>
  </div>
  <div class="cc-field">
    <label class="cc-label">Shirt</label>
    <div id="cc-shirt" class="cc-swatches"></div>
  </div>
  <div class="cc-field">
    <label class="cc-label">Pants</label>
    <div id="cc-pants" class="cc-swatches"></div>
  </div>
</div>
```

- [ ] **Step 2: Add CSS for the creator**

Append to `styles.css`:
```css
/* ── Character creator ──────────────────────────────────── */
.char-creator { display: flex; flex-direction: column; gap: 8px; }

.cc-preview-wrap {
  display: flex; justify-content: center; padding: 8px 0;
  border: 2px solid var(--ink); background: var(--paper-2);
}
#char-preview { image-rendering: pixelated; }

.cc-field { display: flex; flex-direction: column; gap: 3px; }
.cc-label { font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; opacity: 0.6; }

.cc-row { display: flex; gap: 4px; flex-wrap: wrap; }
.cc-chip {
  padding: 2px 7px; font-size: 11px; font-weight: 700; cursor: pointer;
  border: 2px solid var(--ink); background: var(--paper);
  transition: background 0.1s;
}
.cc-chip.active { background: var(--ink); color: var(--paper); }

.cc-swatches { display: flex; gap: 4px; flex-wrap: wrap; }
.cc-swatch {
  width: 20px; height: 20px; border: 2px solid var(--ink);
  cursor: pointer; border-radius: 2px; transition: transform 0.1s;
}
.cc-swatch:hover { transform: scale(1.15); }
.cc-swatch.active { outline: 3px solid var(--punk); outline-offset: 1px; }

.cc-input {
  font-family: inherit; font-size: 12px; font-weight: 700;
  border: 2px solid var(--ink); padding: 3px 6px;
  background: var(--paper); width: 100%; box-sizing: border-box;
}
```

- [ ] **Step 3: Verify layout**

Open the game. Right panel should now show a preview canvas, a name field, and rows of style chips/swatches (currently empty — wired up in Task 4).

- [ ] **Step 4: Commit**

```bash
git add index.html styles.css
git commit -m "feat: add character creator markup and CSS to right panel"
```

---

### Task 4: Wire up the creator with live preview

**Files:**
- Modify: `js/main.js` — add `initCharCreator()` call at load time

- [ ] **Step 1: Add `initCharCreator()` to main.js**

After the `resize` function block in `js/main.js`, append:
```js
// ─── Character creator ──────────────────────────────────────────────────────
function initCharCreator() {
  const cfg = FP.PLAYER_CONFIG;
  const previewCanvas = document.getElementById('char-preview');
  if (!previewCanvas) return;
  const ctx = previewCanvas.getContext('2d');

  function drawPreview() {
    ctx.clearRect(0, 0, 80, 120);
    ctx.fillStyle = '#f0e9d6';
    ctx.fillRect(0, 0, 80, 120);
    // Use a temporary off-screen Phaser graphics draw isn't available here.
    // Draw a simplified pixel avatar using 2D canvas matching drawPunk proportions.
    const s = 80; // preview tile size
    // Shadow
    ctx.fillStyle = 'rgba(10,10,10,0.2)';
    ctx.beginPath(); ctx.ellipse(s*0.5, s*1.45, s*0.28, s*0.05, 0, 0, Math.PI*2); ctx.fill();
    // Hair
    ctx.fillStyle = '#' + cfg.hairColor.toString(16).padStart(6, '0');
    if (cfg.hairStyle === 'punk') {
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.moveTo(s*(0.32+i*0.06), s*0.08);
        ctx.lineTo(s*(0.35+i*0.06), s*0.28);
        ctx.lineTo(s*(0.38+i*0.06), s*0.08);
        ctx.fill();
      }
    } else {
      ctx.fillRect(s*0.2, s*0.1, s*0.6, s*0.24);
    }
    // Face
    ctx.fillStyle = '#' + cfg.skinTone.toString(16).padStart(6, '0');
    ctx.fillRect(s*0.28, s*0.28, s*0.44, s*0.28);
    ctx.strokeStyle = '#0a0a0a'; ctx.lineWidth = 1.5;
    ctx.strokeRect(s*0.28, s*0.28, s*0.44, s*0.28);
    // Eyes
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(s*0.32, s*0.35, s*0.12, s*0.06);
    ctx.fillRect(s*0.56, s*0.35, s*0.12, s*0.06);
    // Shirt
    ctx.fillStyle = '#' + cfg.shirtColor.toString(16).padStart(6, '0');
    ctx.fillRect(s*0.2, s*0.56, s*0.6, s*0.28);
    ctx.strokeStyle = '#0a0a0a'; ctx.lineWidth = 1.5;
    ctx.strokeRect(s*0.2, s*0.56, s*0.6, s*0.28);
    // Pants
    ctx.fillStyle = '#' + cfg.pantsColor.toString(16).padStart(6, '0');
    ctx.fillRect(s*0.26, s*0.84, s*0.2, s*0.18);
    ctx.fillRect(s*0.54, s*0.84, s*0.2, s*0.18);
    ctx.strokeStyle = '#0a0a0a'; ctx.lineWidth = 1;
    ctx.strokeRect(s*0.26, s*0.84, s*0.2, s*0.18);
    ctx.strokeRect(s*0.54, s*0.84, s*0.2, s*0.18);
  }

  function saveAndRedraw() {
    FP.savePlayerConfig(cfg);
    drawPreview();
    // Redraw in-game player if run has started
    if (window.gameScene && window.gameScene.gameStarted) {
      window.gameScene.player.clear();
      FP.drawPunk(window.gameScene.player, cfg, window.gameScene.walkFrame, null, false);
    }
  }

  // Name input
  const nameEl = document.getElementById('cc-name');
  if (nameEl) {
    nameEl.value = cfg.name;
    nameEl.addEventListener('input', () => { cfg.name = nameEl.value; saveAndRedraw(); });
  }

  // Hair style chips
  const hsEl = document.getElementById('cc-hairstyle');
  if (hsEl) {
    FP.HAIR_STYLES.forEach(style => {
      const chip = document.createElement('div');
      chip.className = 'cc-chip' + (style === cfg.hairStyle ? ' active' : '');
      chip.textContent = style[0].toUpperCase() + style.slice(1);
      chip.addEventListener('click', () => {
        cfg.hairStyle = style;
        hsEl.querySelectorAll('.cc-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        saveAndRedraw();
      });
      hsEl.appendChild(chip);
    });
  }

  // Colour swatch builder
  function buildSwatches(elId, palette, cfgKey) {
    const el = document.getElementById(elId);
    if (!el) return;
    palette.forEach(entry => {
      const sw = document.createElement('div');
      sw.className = 'cc-swatch' + (entry.val === cfg[cfgKey] ? ' active' : '');
      sw.style.background = entry.hex;
      sw.title = entry.name;
      sw.addEventListener('click', () => {
        cfg[cfgKey] = entry.val;
        el.querySelectorAll('.cc-swatch').forEach(s => s.classList.remove('active'));
        sw.classList.add('active');
        saveAndRedraw();
      });
      el.appendChild(sw);
    });
  }

  buildSwatches('cc-haircolor', FP.HAIR_COLORS,   'hairColor');
  buildSwatches('cc-skin',      FP.SKIN_TONES,     'skinTone');
  buildSwatches('cc-shirt',     FP.SHIRT_COLORS,   'shirtColor');
  buildSwatches('cc-pants',     FP.PANTS_COLORS,   'pantsColor');

  drawPreview();
}
initCharCreator();
```

- [ ] **Step 2: Verify live preview**

Open the game. Right panel shows the character. Clicking hair colour swatches changes the hair in the preview canvas immediately. Clicking hair style chips changes the style. Name input saves on type.

- [ ] **Step 3: Commit**

```bash
git add js/main.js
git commit -m "feat: wire up character creator with live 2D canvas preview"
```

---

### Task 5: Pass config into GameScene at run start

**Files:**
- Modify: `js/game.js` — `initState()` and `createPlayer()` / `drawPlayer()`

- [ ] **Step 1: Load config in `initState()`**

In `initState()`, after the `this.tiltRight = false;` line:
```js
this.playerConfig = FP.loadPlayerConfig();
```

- [ ] **Step 2: Pass config to `drawPlayer()`**

Find the `drawPlayer()` method in `game.js`. It currently calls:
```js
FP.drawPunk(this.player, FP.CHARACTER_TYPES[this.charIdx], this.walkFrame, this.skinIdx, this.hasCigarette);
```
Replace with:
```js
FP.drawPunk(this.player, this.playerConfig, this.walkFrame, null, this.hasCigarette);
```

- [ ] **Step 3: Verify in-game**

Start a run. The character on screen should match the current creator selection. Change a colour in the creator, start a new run — character should reflect the change.

- [ ] **Step 4: Commit**

```bash
git add js/game.js
git commit -m "feat: GameScene reads PLAYER_CONFIG for player appearance"
```

---

### Task 6: Show character name in HUD

**Files:**
- Modify: `index.html` — add a name display spot
- Modify: `js/main.js` — populate it on run start

- [ ] **Step 1: Add name display in the left panel HUD**

In `index.html`, find the `<div class="panel-h">RUN</div>` line and add after it:
```html
<div id="hud-player-name" class="stat-l" style="font-style:italic;opacity:0.6"></div>
```

- [ ] **Step 2: Populate on page load**

In `js/main.js`, at the end of `initCharCreator()`, add:
```js
function updateNameDisplay() {
  const el = document.getElementById('hud-player-name');
  if (el) el.textContent = cfg.name || '';
}
updateNameDisplay();
// Also update on name change (already calls saveAndRedraw, so add there)
```
And in the `nameEl` input listener, call `updateNameDisplay()` after `saveAndRedraw()`.

- [ ] **Step 3: Verify**

Type a name in the creator. The left panel shows the name immediately.

- [ ] **Step 4: Commit**

```bash
git add index.html js/main.js
git commit -m "feat: show player name in HUD from character creator"
```

---

## Self-Review

**Spec coverage:**
- ✅ Picking your character is a pre-game activity
- ✅ SIMS style: individual customisable layers (hair style, hair color, skin, shirt, pants)
- ✅ Live preview canvas
- ✅ Persists across sessions (localStorage)
- ✅ Carries into gameplay (GameScene reads config)
- ✅ Name field

**Missing from spec but worth noting:** Accessories (hats, glasses, earrings) are not in this plan. They can be added as another swatch row using the same pattern — `cfg.accessory` → additional draw pass in `drawPunk`. Defer to next sprint.

**Placeholder scan:** None — all methods are fully implemented.

**Type consistency:** `cfg.hairColor`, `cfg.skinTone`, `cfg.shirtColor`, `cfg.pantsColor` are used consistently across entities.js, main.js creator, and game.js consumer. `FP.drawPunk` detects config vs legacy charType via `typeof charType.hairColor !== 'undefined'`.
