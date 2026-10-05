// Reproducible prototype balance evidence, not a human playtest or a pass/fail gate.
// Run from the repository: node scripts/balance-probe.mjs
// Each policy plays the actual model at 60 fps with all random encounters enabled.
import { GameModel } from '../src/model.js';

const summaries = [];
for (const policy of ['hold-fire', 'hold-fire-and-push', 'coffee-lane-and-ollie']) {
  const runs = [];
  for (let seed = 1; seed <= 100; seed++) {
    let randomState = seed;
    const model = new GameModel(() => {
      randomState = (randomState * 1664525 + 1013904223) >>> 0;
      return randomState / 4294967296;
    });
    model.start();
    let frames = 0;
    while (!['won', 'lost'].includes(model.phase) && frames++ < 180 * 60) {
      const input = { fire: true };
      if (policy === 'hold-fire-and-push') input.push = true;
      if (policy === 'coffee-lane-and-ollie') {
        // Deliberately simple fixed-lane controller, with exact model knowledge.
        // This cannot establish what a person can perceive or do on a phone.
        input.z = Math.max(-1, Math.min(1, (-3.4 - model.player.z) * 2));
        input.push = true;
        const nearCoffee = model.coffeeStands.some(stand =>
          !stand.served && Math.abs(stand.x - model.player.x) < 3);
        input.jump = !nearCoffee && model.hazards.some(hazard =>
          !hazard.ollied && Math.abs(hazard.z - model.player.z) < 1.15
          && hazard.x - model.player.x > 0 && hazard.x - model.player.x < 2.7);
      }
      model.tick(1 / 60, input);
    }
    runs.push({
      won: model.phase === 'won',
      lives: model.lives,
      score: model.score,
      seconds: model.time,
      coffee: model.coffeeStands.filter(stand => stand.served).length,
      tricks: model.events.filter(event => event.type === 'trick').length,
    });
  }
  const average = key => Math.round(runs.reduce((sum, run) => sum + run[key], 0) / runs.length * 100) / 100;
  summaries.push({
    policy,
    seeds: runs.length,
    wins: runs.filter(run => run.won).length,
    averageLives: average('lives'),
    averageScore: average('score'),
    averageSeconds: average('seconds'),
    rangeSeconds: [Math.min(...runs.map(run => run.seconds)), Math.max(...runs.map(run => run.seconds))]
      .map(seconds => Math.round(seconds * 10) / 10),
    averageCoffee: average('coffee'),
    averageTricks: average('tricks'),
  });
}
console.log(JSON.stringify(summaries, null, 2));
