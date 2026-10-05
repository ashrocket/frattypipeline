export const KEYMAP = {
  KeyJ: 'throw',
  KeyF: 'throw',
  KeyK: 'ollie',
  Space: 'ollie',
  KeyL: 'push',
  ShiftLeft: 'push',
  ShiftRight: 'push',
};
export function radial(x, y, dead = 0.2) {
  const n = Math.hypot(x, y);
  if (n <= dead) return { x: 0, z: 0 };
  const scale = Math.min(1, (n - dead) / (1 - dead)) / n;
  return { x: x * scale, z: y * scale };
}
export function gamepadState(pad) {
  if (!pad)
    return { x: 0, z: 0, throw: false, ollie: false, push: false, super: false, pause: false };
  const b = (i) => Boolean(pad.buttons[i]?.pressed || pad.buttons[i]?.value > 0.5),
    stick = radial(pad.axes[0] ?? 0, pad.axes[1] ?? 0);
  return {
    x: b(15) ? 1 : b(14) ? -1 : stick.x,
    z: b(13) ? 1 : b(12) ? -1 : stick.z,
    ollie: b(0),
    throw: b(2) || b(7),
    push: b(1) || b(5),
    super: b(3),
    pause: b(9),
  };
}
