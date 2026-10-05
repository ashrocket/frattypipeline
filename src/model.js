// Simulation is independent of rendering, screen orientation, and frame rate.
export const DISTRICTS = ['FRESHMAN ROW', 'LEGACY HEIGHTS', 'THE FINAL PLEDGE'];
const NAMES = [['Kappa Cash', 'Κ$'], ['Alpha Ego', 'ΑΕ'], ['Beta Yacht', 'ΒΥ'], ['Delta Daddy', 'ΔΔ'], ['Trust Fund', 'ΤF'], ['Sigma Flex', 'ΣF'], ['Omega Beige', 'ΩΒ'], ['Legacy Club', 'LΧ'], ['Chad Manor', 'ΧΜ'], ['Gold Standard', 'GΣ'], ['The Old Boys', 'ΟΒ'], ['The Grand Chapter', 'ΩΩ']];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export class GameModel {
  constructor(random = Math.random) { this.random = random; this.reset(); }
  reset() {
    this.phase = 'title'; this.time = 0; this.distance = 0; this.score = 0;
    this.lives = 3; this.combo = 1; this.comboTime = 0; this.burned = 0;
    this.ammo = 5; this.shotCooldown = 0; this.dashCooldown = 0;
    this.player = { x: 0, z: 1, pipeline: 0, level: 0, invulnerable: 0, dashing: 0, onBoard: true, jumpHeight: 0, jumpVelocity: 0, skateSpeed: 0, velocityX: 0, velocityZ: 0, wipeout: 0 };
    this.houses = NAMES.map(([name, letters], id) => ({ id, name, letters, district: Math.floor(id / 4), x: 14 + id * 20, z: -10.5, maxHp: id === 11 ? 7 : 2 + Math.floor(id / 4), hp: id === 11 ? 7 : 2 + Math.floor(id / 4), burned: false }));
    this.coffeeStands = Array.from({ length: 6 }, (_, id) => ({ id, x: 22 + id * 40, z: -3.4, served: false }));
    this.hazards = []; this.pickups = []; this.projectiles = []; this.events = [];
    this.targetId = null; this.spawnTimer = 2.7; this.pickupTimer = 2; this.transformTimer = 0; this.id = 0; this.portrait = false; this.jumpHeld = false;
  }
  start() { this.phase = 'playing'; this.emit('start', 'WELCOME TO GREEK ROW'); }
  emit(type, text, data = {}) { this.events.push({ type, text, ...data }); }
  drainEvents() { return this.events.splice(0); }
  target() {
    return this.houses.filter(h => !h.burned && Math.abs(h.x - this.player.x) < 11).sort((a, b) => Math.abs(a.x - this.player.x) - Math.abs(b.x - this.player.x))[0];
  }
  throwBottle() {
    if (this.phase !== 'playing' || this.shotCooldown > 0) return false;
    const h = this.target();
    if (!h) { this.emit('hint', 'GET CLOSER TO A GLOWING LAWN'); this.shotCooldown = .25; return false; }
    if (this.ammo < 1) { this.emit('hint', 'RELOADING — KEEP MOVING'); this.shotCooldown = .25; return false; }
    this.ammo -= 1; this.shotCooldown = .48 - this.player.level * .06;
    this.projectiles.push({ id: ++this.id, fromX: this.player.x, fromZ: this.player.z, toX: h.x, toZ: -6.6, progress: 0, targetId: h.id, damage: 1 + this.player.level * .5 });
    this.emit('throw', ''); return true;
  }
  push() {
    if (this.phase !== 'playing' || this.dashCooldown > 0 || this.player.jumpHeight > 0 || this.player.jumpVelocity > 0 || this.player.wipeout > 0) return false;
    this.player.dashing = .55; this.player.invulnerable = Math.max(this.player.invulnerable, .65); this.dashCooldown = 3.5;
    this.emit('dash', 'KICK PUSH!'); return true;
  }
  dash() { return this.push(); }
  ollie() {
    if (this.phase !== 'playing' || !this.player.onBoard || this.player.jumpHeight > 0 || this.player.jumpVelocity > 0 || this.player.wipeout > 0) return false;
    this.player.jumpVelocity = 8.4;
    this.emit('ollie', ''); return true;
  }
  hit(amount = 20, text = 'RUSH SWAG • MAKEOVER +20') {
    if (this.phase !== 'playing' || this.player.invulnerable > 0) return;
    this.player.pipeline = clamp(this.player.pipeline + amount, 0, 100);
    this.player.invulnerable = 1.1; this.combo = 1; this.comboTime = 0; this.emit('hit', text);
    if (!amount) { this.player.wipeout = .7; this.player.dashing = 0; this.player.velocityX = 0; this.player.velocityZ = 0; }
    if (this.player.pipeline >= 100) this.transform();
  }
  transform() {
    if (this.phase !== 'playing') return;
    this.player.pipeline = 100; this.player.jumpHeight = 0; this.player.jumpVelocity = 0; this.player.dashing = 0; this.player.skateSpeed = 0; this.player.velocityX = 0; this.player.velocityZ = 0;
    this.phase = 'transform'; this.transformTimer = 2.8;
    this.emit('transform', 'FULL MAKEOVER');
  }
  impact(p) {
    const h = this.houses[p.targetId]; if (!h || h.burned) return;
    h.hp = Math.max(0, h.hp - p.damage);
    this.emit('impact', '', { x: h.x, z: -6.6 });
    if (h.hp > 0) { this.score += 100 * this.combo; return; }
    h.burned = true; this.burned++; this.score += (h.id === 11 ? 2500 : 1000) * this.combo;
    this.combo = Math.min(8, this.combo + 1); this.comboTime = 10;
    this.emit('burn', `${h.name.toUpperCase()} DOWN!`, { x: h.x, z: h.z });
    if (this.burned % 4 === 0 && this.burned < 12) {
      this.ammo = 5; this.player.pipeline = Math.max(0, this.player.pipeline - 12);
      this.emit('district', `${DISTRICTS[this.burned / 4]} • AMMO REFILLED • MAKEOVER −12`);
    }
    if (this.burned === this.houses.length) {
      this.score += this.lives * 2000; this.phase = 'won'; this.emit('won', 'THE ROW IS YOURS.');
    }
  }
  tick(delta, input = {}) {
    const dt = clamp(delta, 0, .05);
    if (this.phase === 'transform') {
      this.time += dt; this.transformTimer -= dt;
      if (this.transformTimer <= 0) {
        this.lives--;
        if (!this.lives) { this.phase = 'lost'; this.emit('lost', 'THE MAKEOVER WON THIS ROUND.'); return; }
        this.player.level++; this.player.pipeline = 0; this.player.invulnerable = 4;
        this.player.jumpHeight = 0; this.player.jumpVelocity = 0; this.player.wipeout = 0; this.player.onBoard = true;
        this.ammo = 5; this.hazards = []; this.phase = 'playing';
        this.emit('reborn', this.player.level === 1 ? 'BACK LOUDER. +50% THROW POWER' : 'MAXIMUM PUNK. DOUBLE THROW POWER');
      }
      return;
    }
    if (this.phase !== 'playing') return;
    this.time += dt;
    this.shotCooldown = Math.max(0, this.shotCooldown - dt); this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    this.player.dashing = Math.max(0, this.player.dashing - dt); this.player.invulnerable = Math.max(0, this.player.invulnerable - dt);
    this.player.wipeout = Math.max(0, this.player.wipeout - dt);
    this.ammo = Math.min(5, this.ammo + dt * .82);
    this.comboTime = Math.max(0, this.comboTime - dt); if (!this.comboTime) this.combo = 1;
    const next = this.houses.find(h => !h.burned);
    // Pause the scrolling at an uncleared house, so a missed lawn never makes a run unwinnable.
    if (input.push || input.dash) this.push();
    if (input.jump && !this.jumpHeld) this.ollie();
    this.jumpHeld = Boolean(input.jump);
    if (this.player.jumpHeight > 0 || this.player.jumpVelocity > 0) {
      // Integrate the ballistic arc exactly so airtime does not depend on frame rate.
      this.player.jumpHeight += this.player.jumpVelocity * dt - 12 * dt * dt;
      this.player.jumpVelocity -= 24 * dt;
      if (this.player.jumpHeight <= 0) {
        this.player.jumpHeight = 0; this.player.jumpVelocity = 0; this.player.onBoard = true;
        this.emit('land', '');
      }
    }
    const speed = this.player.wipeout > 0 ? 1.2 : 3.9 + this.player.level * .25 + (this.player.dashing > 0 ? 6 : 0);
    this.distance = Math.min(this.distance + dt * speed, next ? next.x + 1.5 : 260);
    const lateral = clamp(input.z || 0, -1, 1), forward = clamp(input.x || 0, -1, 1);
    const moveSpeed = this.player.wipeout > 0 ? 2 : 7;
    const previousX = this.player.x;
    // Roll into speed and coast when steering is released. Carving responds more
    // quickly than forward momentum; exact integration keeps 30/60 fps aligned.
    const targetX = speed + forward * moveSpeed, targetZ = lateral * moveSpeed;
    const dragX = Math.exp(-6 * dt), dragZ = Math.exp(-10 * dt);
    const deltaX = targetX * dt + (this.player.velocityX - targetX) * (1 - dragX) / 6;
    const deltaZ = targetZ * dt + (this.player.velocityZ - targetZ) * (1 - dragZ) / 10;
    this.player.velocityX = targetX + (this.player.velocityX - targetX) * dragX;
    this.player.velocityZ = targetZ + (this.player.velocityZ - targetZ) * dragZ;
    this.player.x = clamp(this.player.x + deltaX, this.distance - 4, this.distance + 5);
    this.player.z = clamp(this.player.z + deltaZ, -4.3, 4.3);
    this.player.skateSpeed = dt > 0 ? (this.player.x - previousX) / dt : 0;
    this.targetId = this.target()?.id ?? null;
    if (input.fire) this.throwBottle();
    if (this.player.pipeline >= 100) { this.transform(); return; }
    for (const stand of this.coffeeStands) {
      if (!stand.served && this.player.onBoard && this.player.jumpHeight === 0 && Math.abs(this.player.skateSpeed) > .5 && Math.abs(stand.x - this.player.x) < 1.5 && Math.abs(stand.z - this.player.z) < .9) {
        stand.served = true; this.score += 250 * this.combo; this.comboTime = 10;
        this.player.pipeline = Math.max(0, this.player.pipeline - 18);
        this.emit('coffee', 'ROLL-THROUGH COFFEE • MAKEOVER −18', { x: stand.x, z: stand.z });
      }
    }
    for (const p of this.projectiles) { p.progress += dt / .65; if (p.progress >= 1) this.impact(p); }
    this.projectiles = this.projectiles.filter(p => p.progress < 1);
    if (this.phase !== 'playing') return;
    this.spawnTimer -= dt; this.pickupTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer += Math.max(.95, 2.4 - (next?.district || 0) * .45);
      this.hazards.push({ id: ++this.id, x: this.distance + 18, z: this.random() * 8 - 4, type: ['bro', 'keg', 'pink'][Math.floor(this.random() * 3)], age: 0 });
    }
    if (this.pickupTimer <= 0) {
      this.pickupTimer += 3.4;
      this.pickups.push({ id: ++this.id, x: this.distance + 15, z: this.random() * 7 - 3.5, type: ['vinyl', 'bolt'][Math.floor(this.random() * 2)], age: 0 });
    }
    for (const h of this.hazards) {
      h.age += dt; h.x -= dt * (h.type === 'keg' ? 5.2 : 2.4);
      if (h.type === 'pink') h.z += Math.sign(this.player.z - h.z) * dt * .75;
      if (!h.ollied && Math.hypot(h.x - this.player.x, h.z - this.player.z) < 1.05) {
        if (this.player.jumpHeight > .62) {
          h.ollied = true; this.score += 200 * this.combo; this.comboTime = 10;
          this.player.pipeline = Math.max(0, this.player.pipeline - 5);
          this.emit('trick', 'CLEAN OLLIE! • MAKEOVER −5', { x: h.x, z: h.z });
        } else if (this.player.dashing > 0) { h.dead = true; this.score += 150; this.emit('smash', 'KICK PUSH!', { x: h.x, z: h.z }); }
        else {
          this.hit(h.type === 'keg' ? 0 : h.type === 'pink' ? 25 : 20, h.type === 'keg' ? 'WIPEOUT • STREAK LOST' : h.type === 'pink' ? 'PERFUME CLOUD • MAKEOVER +25' : 'RUSH SWAG • MAKEOVER +20');
          h.dead = true;
        }
      }
    }
    for (const p of this.pickups) {
      p.age += dt; p.x -= dt * .5;
      if (Math.hypot(p.x - this.player.x, p.z - this.player.z) < 1.3) {
        p.dead = true; this.score += 150 * this.combo; this.comboTime = 10;
        if (p.type === 'bolt') { this.dashCooldown = 0; this.player.invulnerable = 3; }
        if (p.type === 'vinyl') this.ammo = Math.min(5, this.ammo + 2);
        this.emit('pickup', p.type === 'bolt' ? 'SKATE SHIELD • 3 SECONDS' : 'VINYL • +2 BOTTLES', { x: p.x, z: p.z });
      }
    }
    this.hazards = this.hazards.filter(h => !h.dead && h.x > this.distance - 15);
    this.pickups = this.pickups.filter(p => !p.dead && p.x > this.distance - 15);
  }
}
