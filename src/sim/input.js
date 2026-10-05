import { TUNING, clamp } from '../data/tuning.js';
export const ACTIONS = ['throw', 'ollie', 'push', 'super', 'skip'];
export function queueInput(model, action, down = true, beat = model.beat, rawBeat = beat) {
  model.inputQueue.push({
    action,
    down,
    beat,
    rawBeat,
    expires: model.motionTime + TUNING.inputBuffer,
  });
}
export function collectInput(model, input) {
  model.move.x = clamp(input.x ?? model.move.x, -1, 1);
  model.move.z = clamp(input.z ?? model.move.z, -1, 1);
  for (const action of ACTIONS) {
    if (!(action in input)) continue;
    const down = Boolean(input[action]);
    if (down !== Boolean(model.held[action])) {
      queueInput(model, action, down, input.pressBeat ?? input.beat ?? model.beat);
      model.held[action] = down;
    }
  }
  for (const edge of input.edges ?? [])
    queueInput(
      model,
      edge.action,
      edge.down,
      edge.beat ?? model.beat,
      edge.rawBeat ?? edge.beat ?? model.beat,
    );
}
export function consumeInput(model) {
  const remaining = [];
  for (const edge of model.inputQueue) {
    if (edge.expires + 1e-8 < model.motionTime) continue;
    if (edge.down) model.lastPress[edge.action] = edge.beat;
    if (edge.down && ['throw', 'ollie'].includes(edge.action) && model.riot >= 100) {
      const other = edge.action === 'throw' ? 'ollie' : 'throw';
      if (Math.abs(edge.beat - (model.lastPress[other] ?? -999)) * 0.32616 <= 0.05) {
        model.super();
        continue;
      }
    }
    if (!model.action(edge)) remaining.push(edge);
  }
  model.inputQueue = remaining;
}
