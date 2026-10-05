import test from 'node:test';
import assert from 'node:assert/strict';
import { GameModel } from '../src/model.js';

// Disable random encounters only where a test isolates another mechanic.
function quietRun() {
  const model = new GameModel(() => 0.5);
  model.start();
  model.spawnTimer = Infinity;
  model.pickupTimer = Infinity;
  return model;
}

function advance(model, seconds, input = {}, fps = 60) {
  const frames = Math.round(seconds * fps);
  for (let frame = 0; frame < frames; frame++) model.tick(1 / fps, input);
}

function near(actual, expected, tolerance = 1e-8) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} differs from ${expected}`);
}

test('a complete run defeats all twelve houses through actual throws and impacts', () => {
  const model = quietRun();
  let frames = 0;
  while (model.phase !== 'won' && model.phase !== 'lost' && frames++ < 120 * 60) {
    model.tick(1 / 60, { fire: true });
  }

  assert.equal(model.phase, 'won');
  assert.equal(model.burned, 12);
  assert.equal(model.houses.length, 12);
  assert.ok(model.houses.every(house => house.burned && house.hp === 0));
  assert.equal(model.events.filter(event => event.type === 'burn').length, 12);
  assert.equal(model.events.filter(event => event.type === 'won').length, 1);
  assert.ok(model.score > 12_000);
  assert.ok(frames < 120 * 60, 'the complete route is finishable within two minutes');
});

test('each of the first two transformations returns a stronger punk; the third ends the run', () => {
  const model = quietRun();
  const powers = [];
  const cooldowns = [];

  for (let life = 0; life < 3; life++) {
    model.player.x = model.houses[0].x;
    model.shotCooldown = 0;
    assert.equal(model.throwBottle(), true);
    powers.push(model.projectiles.at(-1).damage);
    cooldowns.push(model.shotCooldown);
    model.projectiles = [];

    model.player.invulnerable = 0;
    model.hit(100);
    assert.equal(model.phase, 'transform');
    assert.equal(model.player.pipeline, 100);
    assert.equal(model.lives, 3 - life, 'the transformation scene completes before a life is spent');
    assert.equal(model.throwBottle(), false);
    advance(model, 3);

    assert.equal(model.lives, 2 - life);
    assert.equal(model.phase, life === 2 ? 'lost' : 'playing');
    if (life < 2) {
      assert.equal(model.player.level, life + 1);
      assert.ok(model.player.pipeline < 1);
      assert.ok(model.player.invulnerable > 3);
      assert.equal(model.ammo, 5);
    }
  }

  assert.deepEqual(powers, [1, 1.5, 2]);
  assert.ok(cooldowns[0] > cooldowns[1] && cooldowns[1] > cooldowns[2]);
  assert.equal(model.events.filter(event => event.type === 'reborn').length, 2);
  assert.equal(model.events.filter(event => event.type === 'lost').length, 1);
});

test('throws require a reachable target and a full bottle, and respect cooldown', () => {
  const model = quietRun();
  const initialAmmo = model.ammo;
  assert.equal(model.target(), undefined);
  assert.equal(model.throwBottle(), false);
  assert.equal(model.ammo, initialAmmo);
  assert.equal(model.projectiles.length, 0);

  model.player.x = model.houses[0].x;
  model.shotCooldown = 0;
  model.ammo = 0.99;
  assert.equal(model.throwBottle(), false);
  assert.equal(model.ammo, 0.99);
  assert.equal(model.projectiles.length, 0);

  model.shotCooldown = 0;
  model.ammo = 1;
  assert.equal(model.throwBottle(), true);
  assert.equal(model.ammo, 0);
  assert.equal(model.projectiles[0].targetId, model.houses[0].id);
  model.ammo = 5;
  assert.equal(model.throwBottle(), false);
  assert.equal(model.projectiles.length, 1);
  assert.equal(model.ammo, 5);
});

test('a missed house stays reachable, then the route resumes after it is defeated', () => {
  const model = quietRun();
  advance(model, 20, { x: 1 });
  const missed = model.houses[0];
  assert.equal(missed.burned, false);
  assert.equal(model.target()?.id, missed.id);
  assert.ok(Math.abs(missed.x - model.player.x) < 11);
  assert.ok(model.distance < model.houses[1].x);
  const heldDistance = model.distance;

  advance(model, 3, { fire: true });
  assert.equal(missed.burned, true);
  assert.ok(model.distance > heldDistance);
  assert.ok(model.houses.slice(1).every(house => !house.burned));
});

test('skating momentum, makeover, ammunition, and cooldowns are stable at 30 and 60 fps', () => {
  const results = [30, 60].map(fps => {
    const model = quietRun();
    model.ammo = 0;
    model.shotCooldown = 3;
    model.dashCooldown = 3.5;
    advance(model, 2, { x: -0.1, z: 0.08 }, fps);
    return model;
  });
  const [slow, fast] = results;
  for (const key of ['time', 'distance', 'ammo', 'shotCooldown', 'dashCooldown']) near(slow[key], fast[key]);
  for (const key of ['x', 'z', 'pipeline']) near(slow.player[key], fast.player[key]);
  near(slow.time, 2);
  near(slow.ammo, 1.64);
});

test('a full firing run has the same result and score at 30 and 60 fps', () => {
  const runs = [30, 60].map(fps => {
    const model = quietRun();
    for (let frame = 0; frame < 120 * fps && model.phase === 'playing'; frame++) {
      model.tick(1 / fps, { fire: true });
    }
    return model;
  });
  assert.ok(runs.every(model => model.phase === 'won' && model.burned === 12));
  assert.equal(runs[0].score, runs[1].score);
  assert.equal(runs[0].lives, runs[1].lives);
  assert.ok(Math.abs(runs[0].time - runs[1].time) < 1.5, 'frame quantization should not materially change the run duration');
});

test('pause freezes the complete simulation and blocks action methods', () => {
  const model = quietRun();
  model.player.x = model.houses[0].x;
  model.throwBottle();
  model.dash();
  model.phase = 'paused';
  const before = JSON.stringify(model);
  advance(model, 10, { x: 1, z: -1, fire: true, dash: true });
  assert.equal(model.throwBottle(), false);
  assert.equal(model.dash(), false);
  assert.equal(model.push(), false);
  assert.equal(model.ollie(), false);
  model.hit(100);
  assert.equal(JSON.stringify(model), before);
});

test('won and lost screens cannot continue movement, combat, or timers', () => {
  for (const phase of ['won', 'lost']) {
    const model = quietRun();
    model.player.x = model.houses[0].x;
    model.phase = phase;
    const before = JSON.stringify(model);
    advance(model, 2, { fire: true, dash: true, x: 1, z: 1 });
    assert.equal(model.throwBottle(), false);
    assert.equal(model.dash(), false);
    assert.equal(model.push(), false);
    assert.equal(model.ollie(), false);
    assert.equal(JSON.stringify(model), before);
  }
});

test('projectiles land after flight and multiple hits cannot award the same house twice', () => {
  const model = quietRun();
  model.player.x = model.houses[0].x;
  model.distance = model.player.x;
  model.player.level = 2;
  model.throwBottle();
  const projectile = { ...model.projectiles[0] };
  advance(model, 0.3);
  assert.equal(model.houses[0].burned, false);
  advance(model, 0.4);
  assert.equal(model.houses[0].burned, true);
  assert.equal(model.burned, 1);
  const score = model.score;
  model.impact(projectile);
  assert.equal(model.burned, 1);
  assert.equal(model.score, score);
});

test('kick push protects the player and smashes an incoming obstacle; dash remains an alias', () => {
  const model = quietRun();
  model.player.pipeline = 40;
  model.hazards.push({ id: 99, type: 'keg', x: model.player.x, z: model.player.z, age: 0 });
  assert.equal(model.dash(), true);
  model.tick(1 / 60);
  assert.equal(model.player.pipeline, 40, 'pushing does not change the outfit meter');
  assert.equal(model.hazards.length, 0);
  assert.equal(model.score, 150);
  assert.ok(model.events.some(event => event.type === 'smash'));
  assert.equal(model.dash(), false);
});

test('skateboard gains momentum, coasts, carves in depth, and kick push increases rolling speed', () => {
  const normal = quietRun(), pushed = quietRun();
  advance(normal, .2);
  advance(pushed, .2);
  assert.ok(normal.player.velocityX > 0 && normal.player.velocityX < 3.9, 'rolling accelerates instead of snapping to full speed');
  assert.equal(pushed.push(), true);
  advance(normal, .3);
  advance(pushed, .3);
  assert.ok(pushed.player.x > normal.player.x + .7, 'push supplies forward movement without holding a direction');
  assert.ok(pushed.player.skateSpeed > normal.player.skateSpeed + 3);
  assert.equal(pushed.push(), false, 'push has a recovery cooldown');

  advance(normal, .3, { x: 1, z: -1 });
  assert.ok(normal.player.velocityX > 8);
  assert.ok(normal.player.velocityZ < -6);
  const carvingZ = normal.player.z;
  normal.tick(1 / 60);
  assert.ok(normal.player.velocityX > 3.9, 'released direction retains momentum');
  assert.ok(normal.player.z < carvingZ, 'released carving coasts briefly');
  advance(normal, 1);
  assert.ok(normal.player.velocityX < 4);
  assert.ok(Math.abs(normal.player.velocityZ) < .01);
});

test('ollie has a physical arc, prevents air jumps, and lands back on the skateboard', () => {
  const model = quietRun();
  assert.equal(model.ollie(), true);
  assert.equal(model.ollie(), false, 'a second call before the first frame cannot add another impulse');
  advance(model, .2);
  assert.ok(model.player.jumpHeight > 1);
  assert.equal(model.ollie(), false);
  assert.equal(model.push(), false, 'a skater cannot kick the pavement while airborne');
  advance(model, .55);
  assert.equal(model.player.jumpHeight, 0);
  assert.equal(model.player.jumpVelocity, 0);
  assert.equal(model.player.onBoard, true);
  assert.equal(model.events.filter(event => event.type === 'land').length, 1);
  assert.equal(model.ollie(), true, 'landing enables the next manually timed jump');
});

test('holding jump cannot automatically bunny-hop and a fresh press can ollie again', () => {
  const model = quietRun();
  advance(model, 2, { jump: true });
  assert.equal(model.events.filter(event => event.type === 'ollie').length, 1);
  assert.equal(model.player.jumpHeight, 0);
  model.tick(1 / 60, { jump: false });
  model.tick(1 / 60, { jump: true });
  assert.equal(model.events.filter(event => event.type === 'ollie').length, 2);
});

test('a clean ollie clears an obstacle once, scores a trick, and reverses some makeover', () => {
  const model = quietRun();
  model.player.pipeline = 40;
  model.ollie();
  advance(model, .2);
  model.hazards.push({ id: 99, type: 'keg', x: model.player.x + .2, z: model.player.z, age: 0 });
  model.tick(1 / 60);
  assert.equal(model.score, 200);
  assert.equal(model.player.pipeline, 35);
  assert.equal(model.hazards[0].ollied, true);
  assert.equal(model.player.wipeout, 0);
  advance(model, .6);
  assert.equal(model.score, 200, 'the same obstacle cannot award multiple tricks');
  assert.equal(model.events.filter(event => event.type === 'trick').length, 1);
  assert.equal(model.events.some(event => event.type === 'hit'), false);
});

test('rush swag and perfume cause visible makeover; barrels only cause a skating wipeout', () => {
  for (const [type, expected] of [['bro', 20], ['pink', 25], ['keg', 0]]) {
    const model = quietRun();
    advance(model, 1);
    const speed = model.player.skateSpeed;
    model.hazards.push({ id: 99, type, x: model.player.x, z: model.player.z, age: 0 });
    model.tick(1 / 60);
    assert.equal(model.player.pipeline, expected);
    const hit = model.events.find(event => event.type === 'hit');
    assert.match(hit.text, type === 'keg' ? /WIPEOUT/ : /MAKEOVER/);
    if (type === 'keg') {
      assert.ok(model.player.wipeout > 0);
      model.tick(1 / 60);
      assert.ok(model.player.skateSpeed < speed / 2);
    }
  }
  const model = quietRun();
  advance(model, 90);
  assert.equal(model.player.pipeline, 0, 'time alone never changes the player outfit');
  assert.equal(model.lives, 3);
});

function coffeeRun() {
  const model = quietRun();
  model.houses[0].burned = true;
  model.player.x = model.distance = 21.5;
  model.player.z = model.coffeeStands[0].z;
  model.player.pipeline = 50;
  return model;
}

test('coffee is served once by rolling through the stand lane on a skateboard', () => {
  const model = coffeeRun();
  advance(model, .3);
  assert.equal(model.coffeeStands[0].served, true);
  assert.equal(model.player.pipeline, 32);
  assert.equal(model.score, 250);
  advance(model, .2);
  assert.equal(model.score, 250);
  assert.equal(model.events.filter(event => event.type === 'coffee').length, 1);
  assert.deepEqual(model.events.find(event => event.type === 'coffee'), {
    type: 'coffee', text: 'ROLL-THROUGH COFFEE • MAKEOVER −18', x: 22, z: -3.4,
  });
});

test('coffee is not granted outside its serving lane, airborne, or off the board', () => {
  for (const scenario of ['outside', 'airborne', 'offboard']) {
    const model = coffeeRun();
    if (scenario === 'outside') model.player.z += 1.1;
    if (scenario === 'airborne') model.ollie();
    if (scenario === 'offboard') model.player.onBoard = false;
    advance(model, .3);
    assert.equal(model.coffeeStands[0].served, false, scenario);
    assert.equal(model.player.pipeline, 50, scenario);
    assert.equal(model.score, 0, scenario);
  }
});

test('floating pickups never contain coffee and reset restores all skate and stand state', () => {
  const model = coffeeRun();
  advance(model, .2);
  for (const value of [0, .3, .5, .7, .99]) {
    model.random = () => value;
    model.pickupTimer = 0;
    model.tick(1 / 60);
  }
  assert.ok(model.pickups.length > 0);
  assert.ok(model.pickups.every(pickup => ['vinyl', 'bolt'].includes(pickup.type)));
  model.ollie();
  model.reset();
  assert.equal(model.phase, 'title');
  assert.equal(model.coffeeStands.length, 6);
  assert.ok(model.coffeeStands.every(stand => !stand.served));
  for (const key of ['jumpHeight', 'jumpVelocity', 'skateSpeed', 'velocityX', 'velocityZ', 'wipeout']) assert.equal(model.player[key], 0);
  assert.equal(model.player.onBoard, true);
  assert.equal(model.jumpHeld, false);
});
