import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, renameSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { needsChecks, scope } from '../scope.mjs';

test('allowlist and mixed/shared/uncertain paths', () => {
  assert.equal(needsChecks(['docs/guide.md', 'README.md']), false);
  for (const path of ['src/model.js', 'worker/index.mjs', '.github/workflows/ci.yml', 'scripts/gauntlet.mjs', 'AGENTS.md', 'unknown', 'docs/DESIGN.md', 'docs/fixtures.json']) {
    assert.equal(needsChecks(['docs/a.md', path]), true, path);
  }
  assert.equal(needsChecks([]), true);
});
test('non-PR events and failed comparisons always run full', () => {
  for (const event of ['push', 'workflow_dispatch', 'merge_group', 'unknown']) assert.equal(scope(event, {}), true);
  assert.equal(scope('pull_request', {}), true);
  const event = { pull_request: {base: {sha: 'a'.repeat(40)}, head: {sha: 'b'.repeat(40)}}};
  assert.equal(scope('pull_request', event, () => {throw Error('missing history');}), true);
  assert.equal(scope('pull_request', event, () => Buffer.from('docs/a.md')), true);
});
test('real git diffs include rename source, delete and multiple areas', () => {
  const dir = mkdtempSync(join(tmpdir(), 'duva-ci-'));
  const git = args => execFileSync('git', args, {cwd: dir});
  const commit = () => {git(['add', '.']); git(['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'fixture']); return git(['rev-parse', 'HEAD']).toString().trim();};
  try {
    git(['init', '-q']); mkdirSync(join(dir, 'server')); mkdirSync(join(dir, 'docs'));
    writeFileSync(join(dir, 'server/a'), 'shared'); writeFileSync(join(dir, 'docs/a.md'), 'docs');
    const base = commit();
    renameSync(join(dir, 'server/a'), join(dir, 'docs/renamed'));
    let head = commit();
    const check = () => scope('pull_request', {pull_request: {base: {sha: base}, head: {sha: head}}}, git);
    assert.equal(check(), true);
    git(['reset', '--hard', base]); rmSync(join(dir, 'server/a')); head = commit(); assert.equal(check(), true);
    git(['reset', '--hard', base]); rmSync(join(dir, 'docs/a.md')); head = commit(); assert.equal(check(), false);
    writeFileSync(join(dir, 'server/b'), 'shared'); head = commit(); assert.equal(check(), true);
  } finally {rmSync(dir, {recursive:true, force:true});}
});
