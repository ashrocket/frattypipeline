import { TUNING as T, BEAT_S, clamp, seededRandom } from '../data/tuning.js';
import { C, S } from '../data/strings.js';
import { createPlayer, updatePlayer, ollie, push } from './player.js';
import { createHouses, updateHouses, updateRoundTimer, damageHouse, lockArena } from './houses.js';
import { advanceBeat, nextBar } from './beat.js';
import { collectInput, consumeInput, queueInput } from './input.js';
import { startCharge, release, updateThrows, aim } from './throw.js';
import { updateEnemies, fleeAll } from './enemies.js';
export class GameModel {
  constructor(random = seededRandom(1), options = {}) {
    this.random = random;
    this.look = options.look ?? 4;
    this.hair = options.hair ?? 0;
    this.reset();
  }
  reset() {
    Object.assign(this, {
      phase: 'title',
      time: 0,
      clockTicks: 0,
      motionTime: 0,
      beat: 0,
      beatPulse: 1,
      cameraX: 4,
      score: 0,
      lives: 3,
      combo: 1,
      ammo: 5,
      maxAmmo: 5,
      riot: 0,
      burned: 0,
      hitstop: 0,
      slowmo: 0,
      groove: 0,
      lastJudgedBeat: -99,
      charge: null,
      id: 0,
      arena: null,
      stripTime: 0,
      hits: 0,
      fightHits: 0,
      parries: 0,
      perfects: 0,
      continues: 0,
      superPending: false,
      ripped: false,
      transformEnd: 0,
      transformStart: 0,
      bannerUntil: 0,
      vsTime: 0,
      vsElapsed: 0,
      player: createPlayer(),
      houses: createHouses(),
      enemies: [],
      attacks: [],
      projectiles: [],
      events: [],
      fights: [],
      inputQueue: [],
      move: { x: 0, z: 0 },
      held: {},
      lastPress: {},
      used: {},
      conveyor: null,
    });
    this.coffeeStands = this.houses.slice(0, -1).map((h, id) => ({
      id,
      x: (h.x + this.houses[id + 1].x) / 2,
      z: -3.4,
      served: false,
      active: true,
    }));
    this.coffeeStands.push({
      id: 11,
      x: this.houses[11].x + 5,
      z: -3.4,
      served: false,
      active: false,
      boss: true,
    });
    this.pickups = this.coffeeStands
      .filter((s) => !s.boss)
      .flatMap((s) => [
        { id: ++this.id, type: 'vinyl', x: s.x - 2, z: -2.5 },
        { id: ++this.id, type: 'vinyl', x: s.x + 2, z: 1.5 },
      ]);
    this.obstacles = this.coffeeStands
      .filter((s) => !s.boss)
      .map((s) => ({
        id: ++this.id,
        type: s.id % 2 ? 'keg' : 'cone',
        x: s.x - 3,
        z: -3.4,
        done: false,
      }));
  }
  start() {
    this.phase = 'countin';
    this.emit('start', C.start);
  }
  target() {
    return this.arena ?? this.houses.find((h) => !h.burned);
  }
  enqueue(action, down = true, beat = this.beat) {
    queueInput(this, action, down, beat);
  }
  drainEvents() {
    return this.events.splice(0);
  }
  emit(type, text, data = {}) {
    this.events.push({
      type,
      text,
      atBeat: this.beat,
      time: Math.round(this.time * 1e6) / 1e6,
      motionTime: Math.round(this.motionTime * 1e6) / 1e6,
      x: this.player.x,
      z: this.player.z,
      ...data,
    });
  }
  freeze(seconds) {
    this.hitstop = Math.max(this.hitstop, seconds);
  }
  award(points) {
    this.score += Math.round(points * this.combo * (this.groove >= 4 ? 2 : 1) * this.lives);
  }
  addRiot(amount) {
    const old = this.riot;
    this.riot = clamp(this.riot + amount, 0, 100);
    if (old < 100 && this.riot === 100 && !this.used.riot) {
      this.used.riot = true;
      this.emit('hint', C.ready);
    }
  }
  damageHouse(h, damage) {
    damageHouse(this, h, damage);
  }
  aim() {
    return aim(this);
  }
  action(edge) {
    if (edge.action === 'skip' && this.phase === 'vs' && this.vsElapsed >= 0.4) {
      this.vsTime = 0;
      return true;
    }
    if (this.phase !== 'playing') return false;
    if (!edge.down) {
      if (edge.action === 'throw') release(this, edge.beat, edge.rawBeat);
      return true;
    }
    if (edge.action === 'throw') return startCharge(this, edge.beat, edge.rawBeat);
    if (edge.action === 'ollie') return ollie(this);
    if (edge.action === 'push') return push(this);
    if (edge.action === 'super') {
      this.super();
      return true;
    }
    return true;
  }
  super() {
    if (this.phase !== 'playing' || this.riot < 100 || !this.arena) return false;
    this.riot = 0;
    this.charge = null;
    this.superPending = true;
    this.freeze(0.6);
    fleeAll(this);
    this.emit('super', C.super, { x: this.arena.x, z: -6.6 });
    return true;
  }
  transform() {
    if (this.phase !== 'playing') return;
    this.phase = 'transform';
    this.transformEnd = nextBar(this.beat + 6);
    this.transformStart = this.beat;
    this.charge = null;
    this.inputQueue = [];
    this.player.vx = this.player.vz = 0;
    this.player.jumpHeight = this.player.jumpVelocity = 0;
    this.player.pushAge = 999;
    this.emit('transform', S.transformTitle);
  }
  finishTransform() {
    this.lives--;
    if (this.lives === 0) {
      this.phase = 'continue';
      this.continueEnd = nextBar(this.beat) + 40;
      this.emit('lost', S.loss);
      return;
    }
    this.phase = 'playing';
    this.player.level++;
    this.player.pipeline = 0;
    this.player.invulnerable = 2;
    this.player.wipeout = 0;
    this.player.pitchLock = 0;
    this.player.onBoard = true;
    this.maxAmmo++;
    this.ammo = this.maxAmmo;
    this.riot = 100;
    fleeAll(this);
    this.emit('reborn', S.comeback[this.player.level - 1], {
      sub: S.louder[this.player.level - 1],
    });
  }
  continueRun() {
    if (this.phase !== 'continue') return;
    const at = this.houses.find((h) => !h.burned);
    this.continues++;
    this.score = 0;
    this.lives = 3;
    this.player = createPlayer();
    this.player.x = at.x - 8;
    this.cameraX = at.x;
    this.riot = 0;
    this.maxAmmo = this.ammo = 5;
    this.enemies = [];
    this.attacks = [];
    this.projectiles = [];
    this.inputQueue = [];
    this.charge = null;
    this.conveyor = null;
    this.superPending = false;
    this.hitstop = this.slowmo = 0;
    this.phase = 'playing';
    at.phase = 0;
    at.deadAir = 0;
    at.timer = at.bars > 1 ? 90 : 60;
    at.timerTell = null;
    at.timeouts = 0;
    at.everOpened = false;
    at.chunk = 0;
    at.hp = at.maxHp;
    at.chunkHp = at.chunkMax;
    at.guard = true;
    lockArena(this, at);
  }
  updatePickups() {
    const p = this.player;
    for (const stand of this.coffeeStands) {
      if (
        stand.active &&
        !stand.served &&
        p.onBoard &&
        p.jumpHeight === 0 &&
        Math.abs(p.vx) > 0.5 &&
        ((stand.x - p.x) / 1.2) ** 2 + ((stand.z - p.z) / 0.85) ** 2 < 1
      ) {
        stand.served = true;
        p.pipeline = Math.max(0, p.pipeline - 18);
        this.ammo = Math.min(this.maxAmmo, this.ammo + 2);
        this.award(250);
        this.emit('coffee', C.coffee, { x: stand.x, z: stand.z, sub: '−18 · +2' });
      }
    }
    for (const item of this.pickups) {
      if (!item.dead && ((item.x - p.x) / 1.1) ** 2 + ((item.z - p.z) / 0.8) ** 2 < 1) {
        item.dead = true;
        this.ammo = Math.min(this.maxAmmo, this.ammo + 2);
        this.award(100);
        this.emit('pickup', C.pickup, { x: item.x, z: item.z, sub: '+2' });
      }
    }
    for (const item of this.obstacles) {
      if (!item.done && Math.hypot(item.x - p.x, item.z - p.z) < 1 && p.jumpHeight > 0.75) {
        item.done = true;
        this.ammo = Math.min(this.maxAmmo, this.ammo + 1);
        p.pipeline = Math.max(0, p.pipeline - 5);
        this.award(250);
        this.emit('trick', C.trick, { x: item.x, z: item.z, sub: '−5 · +1' });
      }
    }
  }
  tick(dt, input = {}) {
    if (['title', 'paused', 'won', 'lost'].includes(this.phase)) return;
    collectInput(this, input);
    advanceBeat(this, dt, input.beat);
    updateThrows(this);
    if (this.phase === 'ko') {
      if (this.hitstop > 1e-8) {
        this.hitstop = Math.max(0, this.hitstop - dt);
        return;
      }
      const motionDt = dt * 0.35;
      this.motionTime += motionDt;
      updatePlayer(this, motionDt);
      updateEnemies(this, motionDt);
      this.slowmo = Math.max(0, this.slowmo - dt);
      if (this.slowmo <= 1e-8) {
        this.phase = 'won';
        this.score += this.lives * 2000;
        this.emit('won', S.win, { sub: S.winCopy[this.lives - 1][1] });
      }
      return;
    }
    if (this.phase === 'continue') {
      if (this.beat >= this.continueEnd) this.phase = 'lost';
      return;
    }
    if (this.phase === 'countin') {
      if (this.beat >= 8) {
        this.phase = 'playing';
        lockArena(this, this.houses[0]);
      }
      return;
    }
    if (this.phase === 'transform') {
      if (!this.ripped && this.beat >= this.transformEnd - 2) {
        this.ripped = true;
        this.emit('rip', C.rip);
      }
      if (this.beat >= this.transformEnd) {
        this.ripped = false;
        this.finishTransform();
      }
      return;
    }
    updateRoundTimer(this, dt);
    // Song-time impacts are always resolved, even inside hit-stop and KO motion slow-mo.
    if (this.hitstop > 1e-8) {
      this.hitstop = Math.max(0, this.hitstop - dt);
      if (this.hitstop < 1e-8) this.hitstop = 0;
      return;
    }
    if (this.phase === 'vs') {
      this.vsElapsed += dt;
      this.vsTime -= dt;
      consumeInput(this);
      if (this.vsTime <= 0) {
        this.phase = 'playing';
        this.emit('riot', C.vs);
      }
      return;
    }
    if (this.phase !== 'playing') return;
    if (this.superPending) {
      this.superPending = false;
      if (this.arena) {
        const h = this.arena;
        const landBeat = Math.ceil(this.beat + 1.5);
        // Six visible bottles share a single five-damage carpet impact.
        for (let i = 0; i < 6; i++) {
          const bottle = {
            id: ++this.id,
            fromX: this.player.x,
            fromZ: this.player.z,
            fromY: 1,
            toX: h.x + (i - 2.5) * 0.2,
            toZ: -6.6,
            kind: 'air',
            releaseBeat: this.beat,
            landBeat,
            houseId: h.id,
            damage: i === 0 ? 5 : 0,
            super: true,
            timing: 1,
            progress: 0,
          };
          this.projectiles.push(bottle);
          this.emit('throw', C.throw, { ...bottle, x: this.player.x, z: this.player.z });
        }
      }
    }
    const motionDt = dt * (this.slowmo > 0 ? 0.35 : 1);
    this.slowmo = Math.max(0, this.slowmo - dt);
    consumeInput(this);
    if (this.hitstop > 0) return;
    this.motionTime += motionDt;
    this.ammo = Math.min(this.maxAmmo, this.ammo + T.regen * motionDt);
    updatePlayer(this, motionDt);
    updateHouses(this, motionDt);
    updateEnemies(this, motionDt);
    this.updatePickups();
  }
}
