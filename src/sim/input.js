import { clamp } from '../data/tuning.js';
export const ACTIONS = ['throw', 'ollie', 'push', 'item', 'up', 'down', 'left', 'right', 'skip'];
// Keys the sim reads while held: Space spins, Shift grabs, T aims.
const HELD = ['ollie', 'push', 'throw'];
const BUFFER = 0.1;
// Held state follows the physical key as each edge arrives, never a buffered retry:
// a press that acts late (an ollie just before landing) must not re-hold a key that
// was already let go, and a release dropped by a phase that clears the queue
// (captured, rescued, resume, victory) still lets go.
export function queueInput(model, action, down = true) {
  if (HELD.includes(action)) model.held[action] = down;
  model.inputQueue.push({ action, down, at: model.time, expires: model.time + BUFFER });
}
export function collectInput(model, input) {
  model.move.x = clamp(input.x ?? model.move.x, -1, 1);
  model.move.z = clamp(input.z ?? model.move.z, -1, 1);
  // Bots and tests may pass held state; the browser passes discrete edges.
  for (const action of ACTIONS) {
    if (!(action in input)) continue;
    const down = Boolean(input[action]);
    if (down !== Boolean(model.held[action])) {
      queueInput(model, action, down);
      model.held[action] = down;
    }
  }
  for (const edge of input.edges ?? []) queueInput(model, edge.action, edge.down);
}
// Presses that cannot act yet (an ollie just before landing) wait up to 100 ms.
// Later edges of the same action wait behind them, so a buffered tap still acts in
// order (T lights, then throws).
export function consumeInput(model) {
  const remaining = [],
    waiting = new Set();
  for (const edge of model.inputQueue) {
    if (edge.expires + 1e-9 < model.time) continue;
    if (waiting.has(edge.action) || !model.action(edge)) {
      remaining.push(edge);
      waiting.add(edge.action);
    }
  }
  model.inputQueue = remaining;
}
