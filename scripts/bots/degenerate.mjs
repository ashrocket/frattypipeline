// Frozen before combat tuning. Inputs only; policy RNG is independent of the sim.
export function policyRandom(seed) {
  let state = seed >>> 0;
  return () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296);
}
export const DEGENERATE_NAMES = ['Idle', 'Spam-toss', 'Spam-lob', 'Spam-edge', 'Spam-far', 'Mash', 'Throw+ollie', 'Pacifist', 'Suicide'];
export function degenerate(name, seed, reader) {
  const random = policyRandom(seed + 93241);
  let next = 0, held = false, releaseAt = 0, lastJump = -1, mash = {};
  return view => {
    const { time, beat, player, lives } = view;
    if (name === 'Idle') return {};
    if (name === 'Pacifist') return { ...reader(view), throw: false, super: false };
    if (name === 'Suicide') return lives <= 1 ? reader(view) : {};
    if (name === 'Mash') {
      if (time >= next) {
        next += .1;
        mash = { x: random() * 2 - .65, z: random() * 2 - 1, throw: random() < .5, ollie: random() < .5, push: random() < .5, super: random() < .1 };
      }
      return mash;
    }
    if (!held && time >= next) {
      held = true;
      releaseAt = time + (name === 'Spam-lob' ? .48 : .08);
      next = time + 2 * .32616 + (random() - .5) * .1;
    } else if (held && time >= releaseAt) held = false;
    const jump = name === 'Throw+ollie' && Math.floor(beat) !== lastJump;
    lastJump = Math.floor(beat);
    return { x: 1, z: name === 'Spam-far' ? 1 : name === 'Spam-edge' ? -1 : 0, throw: held, ollie: jump };
  };
}
