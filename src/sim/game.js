import { TUNING as T, SCORE, STEP, BEAT_S, DIFFICULTY, seededRandom } from '../data/tuning.js';
import { C, S } from '../data/strings.js';
import { HOUSES } from '../data/houses.js';
import { crewFor } from '../data/looks.js';
import { campusById, chapterFor } from '../data/campuses.js';
import { ROW, lapOf } from './row.js';
import { createPlayer, updatePlayer, ollie, push, trickTap } from './player.js';
import { createHouse, updateHouse } from './house.js';
import { aim, release, light, updateProjectiles, cycleItem } from './throw.js';
import { updateStreet, updateShops, startLap, dayName, rowRails } from './street.js';
import { updateHorde, updateCaptured, updateRescue, continueRun } from './crew.js';
import { updateBonus, bonusPress, bonusRelease, startBonus } from './bonus.js';
import { collectInput, consumeInput, queueInput } from './input.js';
import { newCombo, updateCombo, addFlow } from './combo.js';
import { startTraining, updateTraining, finishTraining, trainingEvent } from './training.js';
import { updateAlley } from './alley.js';
import { headline, yesterday } from './news.js';
const COUNTIN = 1.8;
const RESUME = 1.4;
const RESCUED = 1.4;
const VICTORY = 2.5;
const NEWSPAPER = 2.6;
const SKATING = ['playing', 'rescue', 'training'];
const newStats = () => ({
  brosLit: 0,
  bestChain: 0,
  cansLit: 0,
  misses: 0,
  throws: 0,
  houseFires: 0,
  fdRolls: 0,
  fdRescues: 0,
  captures: 0,
  rescues: 0,
  bonusHits: 0,
  shopVisits: 0,
  itemThrows: 0,
  wipeouts: 0,
  stumbles: 0,
  ollies: 0,
  tricks: 0,
  backflips: 0,
  grinds: 0,
  flows: 0,
  bestCombo: 0,
  hives: 0,
  bees: 0,
});
export class GameModel {
  constructor(random = seededRandom(1), options = {}) {
    this.random = random;
    this.look = options.look ?? 0;
    this.hair = options.hair ?? 0;
    this.skin = options.skin ?? 1;
    this.assist = options.assist ?? true;
    this.difficulty = options.difficulty ?? 'easy';
    this.campusId = options.campus ?? 'harvard';
    this.trainingOn = options.training ?? false;
    this.reset();
  }
  reset() {
    this.diff = DIFFICULTY[this.difficulty] ?? DIFFICULTY.easy;
    this.campus = campusById(this.campusId);
    Object.assign(this, {
      phase: 'title',
      phaseTime: 0,
      level: 'row',
      time: 0,
      clockTicks: 0,
      beat: 0,
      beatOrigin: 0,
      beatPulse: 0,
      score: 0,
      lives: 3,
      continues: 0,
      destroyed: 0,
      lap: 1,
      bottles: T.bottles,
      items: {},
      unlocked: {},
      item: 'bottle',
      aiming: false,
      litAt: -9,
      id: 0,
      player: createPlayer(0, 0),
      horde: { gap: T.hordeGap, speed: this.diff.hordeSpeed, warned: false },
      projectiles: [],
      carts: [],
      cartTimer: 3,
      shopVisits: ROW.shops.map(() => 0),
      zombie: null,
      ambulance: null,
      bonus: null,
      course: null,
      alley: null,
      newspaper: null,
      lastGone: null,
      combo: newCombo(),
      flow: 0,
      flowTime: 0,
      chain: { n: 0, until: -1 },
      events: [],
      inputQueue: [],
      move: { x: 0, z: 0 },
      held: {},
      stats: newStats(),
      dayBestCombo: 0,
      // The Row's lap-1 hazards and rails, parked while skate school uses the street.
      rowHazards: null,
      rowRails: null,
    });
    this.crew = crewFor(this.look, this.hair, this.skin);
    this.houses = HOUSES.map((data, i) =>
      createHouse(chapterFor(this.campus, i, data), ROW.houses[i], this.random, () => ++this.id),
    );
    this.staticRails = rowRails(this.houses);
    startLap(this, 1);
    this.dayStart = this.snapshot();
  }
  snapshot() {
    return { ...this.stats, destroyed: this.destroyed, lap: this.lap };
  }
  start() {
    this.crew = crewFor(this.look, this.hair, this.skin);
    if (this.trainingOn) startTraining(this);
    else this.beginRow();
  }
  // The run proper: the song starts here, so the beat clock starts here too.
  beginRow() {
    if (this.rowHazards) {
      this.hazards = this.rowHazards;
      this.rails = this.rowRails;
      this.rowHazards = this.rowRails = null;
    }
    // Skate school is practice: its points, FLOW and stats stay on the quad.
    this.score = 0;
    this.flow = 0;
    this.flowTime = 0;
    this.chain = { n: 0, until: -1 };
    this.stats = newStats();
    this.dayBestCombo = 0;
    this.level = 'row';
    this.phase = 'countin';
    this.phaseTime = 0;
    this.player = createPlayer(0, 2);
    this.projectiles = [];
    this.aiming = false;
    this.combo = newCombo();
    this.beat = 0;
    this.beatOrigin = this.time;
    this.bottles = T.bottles;
    this.dayStart = this.snapshot();
    this.emit('start', C.start);
  }
  enqueue(action, down = true) {
    queueInput(this, action, down);
  }
  drainEvents() {
    return this.events.splice(0);
  }
  emit(type, text = null, data = {}) {
    const e = {
      type,
      text,
      time: Math.round(this.time * 1e6) / 1e6,
      x: this.player.x,
      z: this.player.z,
      level: this.level,
      ...data,
    };
    this.events.push(e);
    if (type === 'houseGone') this.lastGone = this.houses[data.house]?.name ?? null;
    if (type === 'bees') this.stats.bees++;
    if (type === 'broLit') addFlow(this, 4);
    if (this.phase === 'training') trainingEvent(this, e);
  }
  // Paperboy's routes multiply every point. Returns what was actually scored, so
  // events can show it.
  award(points) {
    const scored = Math.round(points * this.diff.points);
    this.score += scored;
    return scored;
  }
  aim() {
    return aim(this);
  }
  get houseCount() {
    return this.houses.length;
  }
  action(edge) {
    // Held keys are tracked as edges arrive (input.js), not on buffered retries.
    const { action, down } = edge;
    if (this.phase === 'bonus') {
      if (action === 'throw') return down ? bonusPress(this) : bonusRelease(this);
      return true;
    }
    if (this.phase === 'continue') {
      if (down && action === 'throw') continueRun(this);
      return true;
    }
    if (this.phase === 'newspaper') {
      if (down && ['skip', 'throw', 'ollie'].includes(action) && this.phaseTime > 0.4) this.endNewspaper();
      return true;
    }
    if (action === 'skip') {
      if (down && this.phase === 'training') finishTraining(this);
      return true;
    }
    if (!SKATING.includes(this.phase)) return true;
    if (action === 'throw') return down ? light(this) : release(this);
    if (!down) return true;
    if (action === 'ollie') return ollie(this, edge.at);
    if (action === 'push') return push(this);
    if (action === 'item') return cycleItem(this, 1);
    if (['up', 'down', 'left', 'right'].includes(action)) return trickTap(this, action);
    return true;
  }
  updateWorld(dt) {
    updateProjectiles(this, dt);
    for (const h of this.houses) updateHouse(this, h, dt);
  }
  endNewspaper() {
    this.phase = 'playing';
    this.newspaper = null;
    this.emit('go', C.go);
  }
  tick(dt, input = {}) {
    if (['title', 'paused', 'won', 'lost'].includes(this.phase)) return;
    collectInput(this, input);
    this.clockTicks += dt / STEP;
    this.time = this.clockTicks * STEP;
    this.beat = Math.max(this.beat, Math.round((input.beat ?? (this.time - this.beatOrigin) / BEAT_S) * 1e9) / 1e9);
    this.beatPulse = Math.exp(-8 * (this.beat % 1));
    switch (this.phase) {
      case 'training':
        consumeInput(this);
        updatePlayer(this, dt);
        updateStreet(this, dt);
        updateProjectiles(this, dt);
        updateCombo(this, dt);
        if (this.phase === 'training') updateTraining(this, dt);
        return;
      case 'countin':
        this.phaseTime += dt;
        consumeInput(this);
        if (this.phaseTime >= COUNTIN) {
          this.phase = 'playing';
          this.player.vx = T.roll;
          this.emit('go', C.go);
        }
        return;
      case 'newspaper':
        this.phaseTime += dt;
        consumeInput(this);
        if (this.phase === 'newspaper' && this.phaseTime >= NEWSPAPER) this.endNewspaper();
        return;
      case 'captured':
        this.inputQueue = [];
        this.updateWorld(dt);
        updateCaptured(this, dt);
        return;
      case 'rescued':
        this.inputQueue = [];
        this.phaseTime += dt;
        this.player.vx = Math.max(0, this.player.vx - 6 * dt);
        updatePlayer(this, dt);
        this.updateWorld(dt);
        if (this.phaseTime >= RESCUED) startBonus(this);
        return;
      case 'bonus':
        consumeInput(this);
        updateBonus(this, dt);
        return;
      case 'resume':
        this.inputQueue = [];
        this.phaseTime += dt;
        if (this.phaseTime >= RESUME) {
          this.phase = 'playing';
          this.ambulance = null;
          this.zombie = null;
          this.horde = { gap: T.hordeGap, speed: this.diff.hordeSpeed, warned: false };
          this.player.vx = Math.max(this.player.vx, T.roll);
          this.player.invulnerable = 1;
          this.emit('go', C.go);
        }
        return;
      case 'continue':
        this.phaseTime += dt;
        consumeInput(this);
        if (this.phase === 'continue' && this.phaseTime >= T.continueTime) {
          this.phase = 'lost';
          this.emit('lost', S.loss);
        }
        return;
      case 'victory':
        this.phaseTime += dt;
        this.inputQueue = [];
        updatePlayer(this, dt);
        this.updateWorld(dt);
        if (this.phaseTime >= VICTORY) {
          this.phase = 'won';
          this.award(SCORE.lifeLeft * this.lives);
          this.emit('won', C.won, { lives: this.lives });
        }
        return;
    }
    // playing / rescue
    consumeInput(this);
    if (this.bottles < T.trickleCap) this.bottles = Math.min(T.trickleCap, this.bottles + dt / T.trickle);
    updatePlayer(this, dt);
    updateStreet(this, dt);
    updateCombo(this, dt);
    if (this.level === 'alley') {
      this.updateWorld(dt);
      if (this.level === 'alley') updateAlley(this, dt);
      return;
    }
    updateShops(this);
    this.updateWorld(dt);
    if (this.phase === 'rescue') updateRescue(this, dt);
    if (this.phase === 'playing' || this.phase === 'rescue') updateHorde(this, dt);
    const lap = lapOf(this.player.x);
    if (lap > this.lap) {
      const before = this.dayStart;
      startLap(this, lap);
      if (this.phase === 'playing') {
        this.newspaper = { day: dayName(lap), yesterday: dayName(lap - 1), headline: headline(this, before), stats: yesterday(this, before), week: Math.floor((lap - 1) / 7) + 1 };
        this.phase = 'newspaper';
        this.phaseTime = 0;
        this.aiming = false;
        this.emit('newspaper', S.daily, { ...this.newspaper });
      }
      this.dayStart = this.snapshot();
      this.dayBestCombo = 0;
    }
    if (this.phase === 'playing' && this.houses.every((h) => h.gone)) {
      this.phase = 'victory';
      this.phaseTime = 0;
      this.emit('victory', C.won);
    }
  }
}
