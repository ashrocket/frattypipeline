import test from 'node:test';
import assert from 'node:assert/strict';
import { runSuite } from '../scripts/gauntlet.mjs';
test('6-seed smoke gauntlet: braking is caught, idling and mashing lose to deliberate play', { timeout: 300000 }, () => {
  const result = runSuite({ seeds: 6, minutes: 10, quiet: true });
  assert.deepEqual(result.failures, []);
  assert.ok(result.table.novice.captures > 0, 'novices should meet the Pipeline (and the rescue and bonus round)');
  assert.ok(result.table.novice.bonusHits > 0);
});
