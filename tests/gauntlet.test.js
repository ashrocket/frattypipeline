import test from 'node:test';
import assert from 'node:assert/strict';
import { runSuite } from '../scripts/gauntlet.mjs';
test(
  '30-seed smoke gauntlet: every bot, every look, fairness, parity and balance gates',
  { timeout: 300000 },
  () => {
    const result = runSuite({ count: 30, looks: 5, quiet: true });
    assert.equal(result.cosmeticFailures, 0);
    assert.deepEqual(result.failures, []);
  },
);
