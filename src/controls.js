export const KEYMAP = {
  KeyT: 'throw',
  KeyJ: 'throw',
  KeyF: 'throw',
  Enter: 'skip',
  NumpadEnter: 'skip',
  KeyK: 'ollie',
  Space: 'ollie',
  KeyL: 'push',
  ShiftLeft: 'push',
  ShiftRight: 'push',
  KeyQ: 'item',
  KeyE: 'item',
};
// Arrow keys and WASD also send direction taps: flip tricks in the air, hop off a rail.
export const DIRECTIONS = {
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
};
// Keys whose browser default (scroll, click the focused button) must never fire in play.
export const SCROLL_KEYS = ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
export const PLAY_KEYS = [...SCROLL_KEYS, 'Enter', 'NumpadEnter'];
// Browser shortcuts (⌘F, ⌘D, Ctrl+S) are never game input: macOS never sends their keyups, so the key would stick.
export const shortcut = (e) => Boolean(e.metaKey || e.ctrlKey || e.altKey);
// macOS also drops the keyup of any key let go while ⌘ is down, so letting go of ⌘ (or Ctrl) releases every key.
export const releasesAll = (code) => /^(Meta|OS|Control)/.test(code);
export function radial(x, y, dead = 0.2) {
  const n = Math.hypot(x, y);
  if (n <= dead) return { x: 0, z: 0 };
  const scale = Math.min(1, (n - dead) / (1 - dead)) / n;
  return { x: x * scale, z: y * scale };
}
export function gamepadState(pad) {
  if (!pad) return { x: 0, z: 0, throw: false, ollie: false, push: false, item: false, pause: false, skip: false, up: false, down: false, left: false, right: false };
  const b = (i) => Boolean(pad.buttons[i]?.pressed || pad.buttons[i]?.value > 0.5),
    stick = radial(pad.axes[0] ?? 0, pad.axes[1] ?? 0);
  return {
    x: b(15) ? 1 : b(14) ? -1 : stick.x,
    z: b(13) ? 1 : b(12) ? -1 : stick.z,
    ollie: b(0),
    throw: b(2) || b(7),
    push: b(1) || b(5),
    item: b(3) || b(4),
    pause: b(9),
    skip: b(8),
    // D-pad presses and hard stick flicks count as direction taps.
    up: b(12) || (pad.axes[1] ?? 0) < -0.75,
    down: b(13) || (pad.axes[1] ?? 0) > 0.75,
    left: b(14) || (pad.axes[0] ?? 0) < -0.75,
    right: b(15) || (pad.axes[0] ?? 0) > 0.75,
  };
}
