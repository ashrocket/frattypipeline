# Layout + Mobile Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the game canvas fill more of the desktop screen, and replace the on-canvas joystick with a pure tilt + swipe + tap system on mobile.

**Architecture:** Phaser 3 game at 480×720 logical resolution. `Phaser.Scale.FIT` already scales the canvas to fit its CSS wrapper — so widening the wrapper is enough for desktop. Mobile gets a separate `_setupMobileControls()` path: swipe-up = kick to accelerate, swipe left/right = lane dodge, tap = use powerup. Desktop mouse keeps the existing joystick. Mobile detection via `('ontouchstart' in window)`.

**Tech Stack:** Phaser 3.70, vanilla JS ES6, no bundler. Files served as static assets.

---

## File Map

| File | Change |
|------|--------|
| `js/main.js:90-101` | Resize fn: cap `maxW` at 700 instead of 480 |
| `js/game.js:192-236` | `_setupJoystick()`: guard with `!isMobile` |
| `js/game.js:280-313` | `handleMovement()`: feed swipe lane-dir from `this._swipe` |
| `js/game.js` (new method) | `_setupMobileControls()` — pointer events for swipe/tap |
| `js/game.js` (new method) | `kickAccelerate()` — speed burst + particles |

---

### Task 1: Widen the desktop canvas

**Files:**
- Modify: `js/main.js:94`

- [ ] **Step 1: Change the maxW cap**

In `js/main.js` find the `resize()` function. Change line:
```js
// Before
const maxW = Math.min(window.innerWidth - 440, 480);
```
to:
```js
// After
const maxW = Math.min(window.innerWidth - 440, 720);
```

- [ ] **Step 2: Verify visually**

Open `file:///Users/ashrocket/ashcode/frattypipeline/index.html` in a desktop browser (≥1200px wide). The game canvas should now be ~700px wide instead of 480px. All game elements should scale up proportionally because Phaser.Scale.FIT handles it. Sidebars should still be visible.

- [ ] **Step 3: Commit**

```bash
cd /Users/ashrocket/ashcode/frattypipeline
git add js/main.js
git commit -m "feat: widen desktop canvas cap from 480 to 720px"
```

---

### Task 2: Gate joystick to desktop only

**Files:**
- Modify: `js/game.js` — `_setupJoystick()` method

- [ ] **Step 1: Add mobile detection and gate the joystick**

At the top of `_setupJoystick()` in `js/game.js`, add an early return for touch devices:
```js
_setupJoystick() {
  // Only show mouse joystick on desktop — mobile uses swipe/tap
  const isMobile = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  if (isMobile) return;

  const JOY_MAX = 55;
  // ... rest of existing joystick code unchanged ...
```

- [ ] **Step 2: Verify on desktop**

Reload the page. On a desktop browser, drag with mouse in the left 65% of canvas — ring and knob should appear. 

- [ ] **Step 3: Simulate touch to verify joystick is hidden**

In Chrome DevTools, toggle device toolbar (Cmd+Shift+M). Reload. Tapping the canvas should NOT show a ring/knob.

- [ ] **Step 4: Commit**

```bash
git add js/game.js
git commit -m "feat: gate mouse joystick to desktop only"
```

---

### Task 3: Add mobile swipe + tap controls

**Files:**
- Modify: `js/game.js` — add `_setupMobileControls()` and `kickAccelerate()`
- Modify: `js/game.js` — `setupInput()` to call it
- Modify: `js/game.js` — `handleMovement()` to read `this._swipe`
- Modify: `js/game.js` — `initState()` to initialise `_swipe`

- [ ] **Step 1: Initialise `_swipe` in `initState()`**

In `initState()`, after the `this.joy = ...` line, add:
```js
this._swipe = { dx: 0, dy: 0, active: false }; // consumed each frame
```

- [ ] **Step 2: Add `_setupMobileControls()` method**

Add this method to the `GameScene` class, after `_setupJoystick()`:
```js
_setupMobileControls() {
  const isMobile = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  if (!isMobile) return;

  let touchStart = null;
  const SWIPE_MIN = 30;   // px minimum for swipe
  const TAP_MAX_MS = 250; // ms maximum for tap
  const TAP_MAX_PX = 20;  // px maximum drift for tap

  this.input.on('pointerdown', (p) => {
    if (this.gameOver || this.paused || !this.gameStarted) return;
    touchStart = { x: p.x, y: p.y, t: this.time.now };
  });

  this.input.on('pointerup', (p) => {
    if (!touchStart) return;
    const dx = p.x - touchStart.x;
    const dy = p.y - touchStart.y;
    const dt = this.time.now - touchStart.t;
    const dist = Math.hypot(dx, dy);
    touchStart = null;

    if (dist < TAP_MAX_PX && dt < TAP_MAX_MS) {
      // Tap — use powerup if available, else dash
      if (!this.tryUsePowerup()) this.tryDash();
      return;
    }

    if (dist < SWIPE_MIN) return;

    const absX = Math.abs(dx), absY = Math.abs(dy);
    if (absY > absX && dy < 0) {
      // Swipe UP → kick to accelerate
      this.kickAccelerate();
    } else if (absX > absY) {
      // Swipe LEFT/RIGHT → instant lane push
      this._swipe = { dx: dx > 0 ? 1 : -1, dy: 0, active: true };
    } else if (absY > absX && dy > 0) {
      // Swipe DOWN → brake (reduce speed)
      this.SCROLL_SPEED = Math.max(65, this.SCROLL_SPEED * 0.65);
    }
  });
}
```

- [ ] **Step 3: Add `kickAccelerate()` method**

Add after `_setupMobileControls()`:
```js
kickAccelerate() {
  const MAX_SPEED = 220;
  const KICK_BOOST = 45;
  this.SCROLL_SPEED = Math.min(MAX_SPEED, this.SCROLL_SPEED + KICK_BOOST);
  // Dust particles at foot level
  this.particles.burst(this.playerX, this.playerY + 16, {
    count: 10, colors: [0xffd23f, 0xff7a00, 0xffffff], size: 3, life: 380,
  });
  FP.audio.step();
}
```

- [ ] **Step 4: Wire up in `setupInput()`**

At the end of `setupInput()`, after `this._setupJoystick()`, add:
```js
this._setupMobileControls();
```

- [ ] **Step 5: Consume swipe in `handleMovement()`**

In `handleMovement()`, in the section that builds `laneDir`, add swipe consumption:
```js
// Consume a pending swipe (one-shot, from mobile)
if (this._swipe.active) {
  laneDir = this._swipe.dx;
  this._swipe.active = false;
  // Give a strong one-shot velocity push
  this.playerVlane = laneDir * 9;
}
```
Place this after the existing keyboard/tilt checks but before the joy block, so swipe takes priority over tilt when both fire simultaneously.

- [ ] **Step 6: Verify in Chrome mobile emulation**

1. Open game in Chrome with device toolbar active (Cmd+Shift+M, choose iPhone).
2. Tap canvas: should trigger powerup use or dash.
3. Swipe up: board should visibly speed up (scroll faster) with dust particle burst.
4. Swipe left/right: player should jump lanes.
5. Tilt left/right (simulated with Chrome sensor override): player should steer.

- [ ] **Step 7: Commit**

```bash
git add js/game.js
git commit -m "feat: mobile swipe-to-kick, tap powerup, swipe lane dodge"
```

---

### Task 4: Update start screen instructions for mobile

**Files:**
- Modify: `index.html:122-125` — the `<ul class="how">` block

- [ ] **Step 1: Add mobile hint**

Replace the existing `<ul class="how">` block:
```html
<ul class="how">
  <li><kbd>WASD</kbd>/<kbd>ARROWS</kbd> move · <kbd>SPACE</kbd> dash · <kbd>F</kbd> burn</li>
  <li><kbd>Q</kbd> use power-up · <kbd>P</kbd> pause</li>
</ul>
```
with:
```html
<ul class="how">
  <li><kbd>WASD</kbd>/<kbd>ARROWS</kbd> move · <kbd>SPACE</kbd> dash · <kbd>F</kbd> burn · <kbd>Q</kbd> power-up</li>
  <li id="mobile-hint" style="display:none">📱 Tilt to steer · Swipe ↑ to kick · Tap to use power-up</li>
</ul>
<script>
  if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
    document.getElementById('mobile-hint').style.display = '';
  }
</script>
```

- [ ] **Step 2: Verify**

Desktop: only the keyboard hint shows. Mobile emulation: only the touch hint shows.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: show platform-appropriate control hints on start screen"
```

---

## Self-Review

**Spec coverage:**
- ✅ Desktop canvas wider
- ✅ No joystick on mobile
- ✅ Tilt steering (already exists, not touched)
- ✅ Swipe up = kick/accelerate
- ✅ Swipe left/right = lane dodge
- ✅ Tap = action timing
- ✅ Swipe down = brake (bonus, makes sense for skate game)
- ✅ Instructions updated

**Placeholder scan:** None — all steps have actual code.

**Type consistency:** `this._swipe = { dx, dy, active }` initialised in `initState()`, written in `_setupMobileControls()`, read and cleared in `handleMovement()`. Consistent.
