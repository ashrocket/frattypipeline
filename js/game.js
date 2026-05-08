// Fratty Pipeline v2 — game scene
// TILE, COLS, VIEW_W, VIEW_H are declared at file scope in entities.js
window.FP = window.FP || {};
const U = FP.util;

class GameScene extends Phaser.Scene {
  constructor() { super({ key: 'GameScene' }); }

  create() {
    window.gameScene = this;
    this.gameStarted = false;
    this.initState();
    this.buildWorld();
    this.setupInput();
    this.particles = new FP.ParticleSystem(this);
    this.scene.pause();
    // Auto-begin run when restarting (after game-over / RUN AGAIN)
    if (window.fpPendingBeginRun) {
      window.fpPendingBeginRun = false;
      setTimeout(() => this.beginRun(), 0);
    }
  }

  initState() {
    this.score = 0;
    this.best = parseInt(localStorage.getItem('fratty-pipeline:best') || '0', 10);
    this.gameOver = false;
    this.paused = false;
    this.lives = 3;
    this.punkMeter = 0;
    this.fratMeter = 0;
    this.METER_MAX = 1.0;
    this.hasCigarette = false;
    this.combo = 1;
    this.comboTimer = 0;
    this.COMBO_TIMEOUT = 2400;
    this.SCROLL_SPEED = 65;
    this.scrollAccel = 0.0008;
    this.playerCol = Math.floor(COLS / 2);
    this.playerLane = this.playerCol;
    this.playerX = this.playerCol * TILE + TILE / 2;
    this.playerY = VIEW_H * 0.78;
    this.playerVy = 0;
    this.playerVlane = 0;
    this.joy = { active: false, id: -1, ox: 0, oy: 0, dx: 0, dy: 0 };
    this._swipe = { dx: 0, active: false };
    this.dashCooldown = 0;
    this.dashing = 0;
    this.invuln = 0;
    this.charIdx = 0;
    this.skinIdx = 1;
    this.playerConfig = FP.loadPlayerConfig();
    this.walkFrame = 0; this.walkAccum = 0;
    this.powerup = null;
    this.activePower = null;
    this.fratHouses = [];
    this.activeFratHouse = null;
    this.trashcans = [];
    this.venues = [];
    this.enemies = [];
    this.collectibles = [];
    this.crates = [];
    this.fires = [];
    this.taggedFrat = null;
    this.spawnTimers = {
      frat: 1500, venue: 800, enemy: 5000, crate: 8000, item: 1200,
    };
    this.VISIBLE_ROWS = Math.ceil(VIEW_H / TILE) + 4;
    this.rows = [];
    this.selectedUniversity = (document.getElementById('university')?.value) || 'USC';
    this.fratNamesUsed = 0;
    this.frozen = 0;
    this.hitstop = 0;
    this.boss = null;
    this._scrollAccum = 0;
    this.tiltLeft = false;
    this.tiltRight = false;
  }

  buildWorld() {
    this.bgLayer = this.add.graphics();
    this.bgLayer.setDepth(-10);
    this.bgLayer.fillStyle(FP.COLORS.paper, 1);
    this.bgLayer.fillRect(0, 0, VIEW_W, VIEW_H);
    this.initRows();
    this.createPlayer();
    this.createInGameUI();
  }

  initRows() {
    this.rows = [];
    let y = -TILE * 4;
    for (let i = 0; i < this.VISIBLE_ROWS; i++) {
      const g = this.add.graphics();
      g.setDepth(0);
      const data = this.generateRowData();
      FP.drawRow(g, data);
      g.setY(y);
      this.rows.push({ g, data, y });
      y += TILE;
    }
    this.rowCounter = 0;
  }

  generateRowData() {
    this.rowCounter = (this.rowCounter || 0) + 1;
    const row = new Array(COLS);
    const lineRow = (this.rowCounter % 3 === 0);
    for (let c = 0; c < COLS; c++) {
      if (c === 0 || c === COLS - 1) {
        row[c] = Math.random() < 0.08 ? 'tree' : 'grass';
      } else if (c === 1 || c === COLS - 2) {
        row[c] = Math.random() < 0.1 ? 'bush' : 'sidewalk';
      } else if (c === COLS / 2 - 1 || c === COLS / 2) {
        row[c] = lineRow ? 'road-line' : 'road';
      } else {
        row[c] = Math.random() < 0.02 ? 'manhole' : 'road';
      }
    }
    return row;
  }

  createPlayer() {
    this.player = this.add.graphics();
    this.player.setDepth(50);
    this.drawPlayer();
    this.player.setPosition(this.playerX - TILE / 2, this.playerY - TILE / 2);
  }

  drawPlayer() {
    this.player.clear();
    if (this.fratMeter >= 1.0 && this.lives > 0) {
      FP.drawSorority(this.player);
      return;
    }
    FP.drawPunk(this.player, this.playerConfig, this.walkFrame, null, this.hasCigarette);
  }

  createInGameUI() {
    this.chargeRing = this.add.graphics();
    this.chargeRing.setDepth(45);

    this.bigCombo = this.add.text(VIEW_W / 2, VIEW_H / 3, '', {
      fontFamily: '"Archivo Black", sans-serif',
      fontSize: '48px',
      color: '#ff2d6f',
      stroke: '#0a0a0a', strokeThickness: 6,
    });
    this.bigCombo.setOrigin(0.5).setDepth(120).setAlpha(0);

    this.bossBanner = this.add.text(VIEW_W / 2, 30, '', {
      fontFamily: '"Archivo Black", sans-serif',
      fontSize: '18px',
      color: '#ffd23f',
      stroke: '#0a0a0a', strokeThickness: 4,
    });
    this.bossBanner.setOrigin(0.5).setScrollFactor(0).setDepth(120).setAlpha(0);

    this.bossHpBg = this.add.graphics().setDepth(119).setAlpha(0);
    this.bossHpFg = this.add.graphics().setDepth(120).setAlpha(0);

    this.warnText = this.add.text(VIEW_W / 2, VIEW_H / 2, '', {
      fontFamily: '"Archivo Black", sans-serif',
      fontSize: '24px',
      color: '#ff2d6f',
      stroke: '#0a0a0a', strokeThickness: 5,
      backgroundColor: '#0a0a0a',
      padding: { x: 12, y: 6 },
    });
    this.warnText.setOrigin(0.5).setScrollFactor(0).setDepth(130).setVisible(false);

    this.powerActiveText = this.add.text(VIEW_W / 2, VIEW_H - 30, '', {
      fontFamily: '"Archivo Black", sans-serif',
      fontSize: '14px',
      color: '#ffd23f',
      stroke: '#0a0a0a', strokeThickness: 3,
    });
    this.powerActiveText.setOrigin(0.5).setScrollFactor(0).setDepth(120);

    this.fPrompt = this.add.text(VIEW_W / 2, VIEW_H - 56, '', {
      fontFamily: '"Archivo Black", sans-serif',
      fontSize: '14px',
      color: '#ff7a00',
      stroke: '#0a0a0a', strokeThickness: 3,
    });
    this.fPrompt.setOrigin(0.5).setScrollFactor(0).setDepth(120).setVisible(false);
  }

  setupInput() {
    this.keys = this.input.keyboard.addKeys({
      left: 'LEFT', right: 'RIGHT', up: 'UP', down: 'DOWN',
      a: 'A', d: 'D', w: 'W', s: 'S',
      space: 'SPACE', f: 'F', q: 'Q', p: 'P',
      r: 'R',
    });
    this._lastKeys = {};
    this._isMobile = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    if (this._isMobile) {
      this._setupMobileControls();
    } else {
      this._setupJoystick();
    }
  }

  _setupJoystick() {
    const JOY_MAX = 55;
    this._joyRing = this.add.graphics().setScrollFactor(0).setDepth(200).setAlpha(0);
    this._joyKnob = this.add.graphics().setScrollFactor(0).setDepth(201).setAlpha(0);
    this._joyRing.lineStyle(3, 0xffffff, 0.65);
    this._joyRing.strokeCircle(0, 0, JOY_MAX);
    this._joyKnob.fillStyle(0xffffff, 0.2);
    this._joyKnob.fillCircle(0, 0, 22);
    this._joyKnob.lineStyle(2, 0xffffff, 0.45);
    this._joyKnob.strokeCircle(0, 0, 22);

    this.input.on('pointerdown', (p) => {
      if (this.gameOver || this.paused || !this.gameStarted) return;
      if (p.x < VIEW_W * 0.65 && !this.joy.active) {
        this.joy = { active: true, id: p.id, ox: p.x, oy: p.y, dx: 0, dy: 0 };
        this._joyRing.setPosition(p.x, p.y).setAlpha(1);
        this._joyKnob.setPosition(p.x, p.y).setAlpha(1);
      }
    });
    this.input.on('pointermove', (p) => {
      if (p.id !== this.joy.id) return;
      let dx = p.x - this.joy.ox, dy = p.y - this.joy.oy;
      const mag = Math.hypot(dx, dy);
      if (mag > JOY_MAX) { dx = dx / mag * JOY_MAX; dy = dy / mag * JOY_MAX; }
      this.joy.dx = dx;
      this.joy.dy = dy;
      this._joyKnob.setPosition(this.joy.ox + dx, this.joy.oy + dy);
    });
    this.input.on('pointerup', (p) => {
      if (p.id === this.joy.id) {
        this.joy = { active: false, id: -1, ox: 0, oy: 0, dx: 0, dy: 0 };
        this._joyRing.setAlpha(0);
        this._joyKnob.setAlpha(0);
      }
    });
  }

  _setupMobileControls() {
    let touchStart = null;
    const SWIPE_MIN = 45, TAP_MAX_MS = 250, TAP_MAX_PX = 20;

    this.input.on('pointerdown', (p) => {
      if (this.gameOver || this.paused || !this.gameStarted) return;
      touchStart = { x: p.x, y: p.y, t: this.time.now };
    });

    this.input.on('pointerup', (p) => {
      if (!touchStart) return;
      const dx = p.x - touchStart.x, dy = p.y - touchStart.y;
      const dt = this.time.now - touchStart.t;
      const dist = Math.hypot(dx, dy);
      touchStart = null;

      if (dist < TAP_MAX_PX && dt < TAP_MAX_MS) {
        if (!this.tryUsePowerup()) this.tryDash();
        return;
      }
      if (dist < SWIPE_MIN) return;

      const absX = Math.abs(dx), absY = Math.abs(dy);
      if (absY > absX && dy < 0) {
        this.kickAccelerate();
      } else if (absX > absY) {
        this._swipe = { dx: dx > 0 ? 1 : -1, active: true };
      } else if (absY > absX && dy > 0) {
        this.SCROLL_SPEED = Math.max(65, this.SCROLL_SPEED * 0.65);
      }
    });
  }

  kickAccelerate() {
    this.SCROLL_SPEED = Math.min(220, this.SCROLL_SPEED + 55);
    this.particles.burst(this.playerX, this.playerY + 16, {
      count: 18, colors: [0xffd23f, 0xff7a00, 0xffffff, 0xff2d6f], size: 4, life: 480,
    });
    this.cameras.main.shake(90, 0.014);
    FP.audio.step();
    if (typeof Haptic !== 'undefined') Haptic.heavy();
  }

  beginRun() {
    this.gameStarted = true;
    this.scene.resume();
    FP.audio.resume();
  }

  // ==================== UPDATE LOOP ====================
  update(time, delta) {
    if (!this.gameStarted) return;
    if (this.paused) return;
    if (this.gameOver) {
      if (Phaser.Input.Keyboard.JustDown(this.keys.space) || Phaser.Input.Keyboard.JustDown(this.keys.r)) {
        this.scene.restart();
      }
      return;
    }
    if (this.hitstop > 0) {
      this.hitstop -= delta;
      this.particles.update(delta);
      return;
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.p)) {
      window.fpTogglePause();
      return;
    }

    const dt = delta;
    if (this.dashCooldown > 0) this.dashCooldown -= dt;
    if (this.dashing > 0) this.dashing -= dt;
    if (this.invuln > 0) this.invuln -= dt;
    if (this.frozen > 0) this.frozen -= dt;
    if (this.activePower) {
      this.activePower.until -= dt;
      if (this.activePower.until <= 0) this.endPowerUp();
    }
    if (this.combo > 1) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) { this.combo = 1; this.updateComboHud(); }
    }

    let scrollSpeed = this.SCROLL_SPEED;
    if (this.fratMeter > 0.6) scrollSpeed *= 0.88;
    if (this.activePower?.type === 'skateboard') scrollSpeed *= 1.7;
    if (this.frozen > 0) scrollSpeed *= 0.2;
    this.SCROLL_SPEED = Math.min(220, this.SCROLL_SPEED + this.scrollAccel * dt);
    const dy = scrollSpeed * (dt / 1000);
    this.scrollWorld(dy);

    this.handleMovement(dt);
    const targetX = this.playerLane * TILE + TILE / 2;
    const lerpAmt = Math.min(1, (dt / 1000) * 18);
    this.playerX = U.lerp(this.playerX, targetX, lerpAmt);
    this.player.setPosition(this.playerX - TILE / 2, this.playerY - TILE / 2);
    this.walkAccum += dt;
    if (this.walkAccum > 130) {
      this.walkAccum = 0;
      this.walkFrame = (this.walkFrame + 1) % 4;
      this.drawPlayer();
    }

    if (this.combo > 1) {
      const pct = U.clamp(this.comboTimer / this.COMBO_TIMEOUT, 0, 1);
      const cb = document.getElementById('hud-combo-bar');
      if (cb) cb.style.width = (pct * 100) + '%';
    }

    this.updateFratHouses(dt);
    this.updateEnemies(dt);
    this.updateVenues(dt);
    this.updateCollectibles(dt);
    this.updateCrates(dt);
    this.updateFires(dt);
    this.updateChargeRing();

    this.handleSpawning(dt);

    if (Phaser.Input.Keyboard.JustDown(this.keys.f)) this.tryBurn();
    if (Phaser.Input.Keyboard.JustDown(this.keys.q)) this.tryUsePowerup();
    if (Phaser.Input.Keyboard.JustDown(this.keys.space)) this.tryDash();

    this.score += dt * 0.012 * this.combo;
    this.updateHud();
    this.particles.update(dt);
  }

  handleMovement(dt) {
    if (this.frozen > 0) return;

    const k = this.keys;
    const JOY_DEAD = 10;
    const JOY_MAX = 55;

    // Combine keyboard + tilt + joystick into -1..1 analog axes
    let laneDir = 0, vertDir = 0;
    if (k.left.isDown || k.a.isDown || this.tiltLeft) laneDir -= 1;
    if (k.right.isDown || k.d.isDown || this.tiltRight) laneDir += 1;
    if (k.up.isDown || k.w.isDown) vertDir -= 1;
    if (k.down.isDown || k.s.isDown) vertDir += 1;
    if (this.joy.active) {
      if (Math.abs(this.joy.dx) > JOY_DEAD) laneDir = U.clamp(this.joy.dx / JOY_MAX, -1, 1);
      if (Math.abs(this.joy.dy) > JOY_DEAD) vertDir = U.clamp(this.joy.dy / JOY_MAX, -1, 1);
    }
    // Consume one-shot mobile swipe
    if (this._swipe.active) {
      this.playerVlane = this._swipe.dx * 9;
      this._swipe.active = false;
    }

    // Lane velocity with skate momentum
    const LANE_SPEED = 5.5; // lanes/sec at full deflection
    if (Math.abs(laneDir) > 0.05) {
      this.playerVlane = laneDir * LANE_SPEED;
    } else {
      // Exponential drag — wheel-rolling-to-stop feel
      this.playerVlane *= Math.pow(0.82, dt / 16);
      if (Math.abs(this.playerVlane) < 0.02) this.playerVlane = 0;
    }

    const prevLaneRound = Math.round(this.playerLane);
    this.playerLane = U.clamp(this.playerLane + this.playerVlane * (dt / 1000), 1, COLS - 2);
    if (Math.round(this.playerLane) !== prevLaneRound) {
      FP.audio.step();
      if (typeof Haptic !== 'undefined') Haptic.select();
    }

    // Vertical: smooth analog movement (no tile-snapping)
    const VERT_SPEED = 260; // px/sec
    const targetMin = TILE * 3, targetMax = VIEW_H - TILE * 1.5;
    if (Math.abs(vertDir) > 0.05) {
      this.playerY = U.clamp(this.playerY + vertDir * VERT_SPEED * (dt / 1000), targetMin, targetMax);
    }

    this.playerCol = Math.round(this.playerLane);
  }

  // ==================== SCROLL & ROWS ====================
  scrollWorld(dy) {
    for (const r of this.rows) { r.y += dy; r.g.setY(Math.round(r.y)); }
    const bottom = VIEW_H + TILE * 2;
    let topY = Math.min(...this.rows.map(r => r.y));
    for (const r of this.rows) {
      if (r.y > bottom) {
        r.y = topY - TILE;
        r.data = this.generateRowData();
        FP.drawRow(r.g, r.data);
        r.g.setY(Math.round(r.y));
        topY = r.y;
      }
    }
    const moveAll = (arr, killOff = true) => {
      for (const e of arr) {
        e.y += dy;
        if (e.gfx) e.gfx.setY(Math.round(e.y));
        if (e.label) e.label.y = Math.round(e.y - 14);
        if (e.tint) e.tint.setY(Math.round(e.y));
        if (e.tagGfx) e.tagGfx.setY(Math.round(e.y + 80));
      }
      if (killOff) {
        for (let i = arr.length - 1; i >= 0; i--) {
          if (arr[i].y > VIEW_H + TILE * 5) {
            const e = arr[i];
            if (e.gfx) e.gfx.destroy();
            if (e.label) e.label.destroy();
            if (e.tint) e.tint.destroy();
            if (e.tagGfx) e.tagGfx.destroy();
            if (e === this.boss) this.endBoss(false);
            arr.splice(i, 1);
          }
        }
      }
    };
    moveAll(this.fratHouses);
    moveAll(this.trashcans);
    moveAll(this.venues);
    moveAll(this.enemies);
    moveAll(this.collectibles);
    moveAll(this.crates);
    moveAll(this.fires);
  }

  // ==================== FRAT HOUSES ====================
  updateFratHouses(dt) {
    this.activeFratHouse = null;
    let nearestDist = Infinity;
    for (const h of this.fratHouses) {
      if (h.isBurned) continue;
      const cx = h.x + (TILE * 1.5);
      const cy = h.y + (TILE * 3);
      const d = U.dist(this.playerX, this.playerY, cx, cy);
      h._dist = d;
      if (d < nearestDist) {
        nearestDist = d;
        this.activeFratHouse = h;
      }
    }

    if (this.activeFratHouse && nearestDist < TILE * 4 && this.invuln <= 0 && !this.hasCigarette) {
      const intensity = 1 - (nearestDist / (TILE * 4));
      this.punkMeter = U.clamp(this.punkMeter + intensity * 0.0008 * dt, 0, 1);
      const fratRate = (this.activeFratHouse.isBoss ? 0.0012 : 0.0007);
      this.fratMeter = U.clamp(this.fratMeter + intensity * fratRate * dt, 0, 1);
      const cx = this.activeFratHouse.x + (TILE * 1.5);
      const pull = intensity * 0.025;
      this.playerLane = U.lerp(this.playerLane, cx / TILE, pull);
    }

    if (this.punkMeter >= 1.0 && !this.hasCigarette) {
      this.gainCigarette();
    }
    if (this.fratMeter >= 1.0) {
      this.takePipeline();
    }
  }

  updateChargeRing() {
    this.chargeRing.clear();
    if (this.activeFratHouse && this.activeFratHouse._dist < TILE * 4 && !this.hasCigarette) {
      const intensity = 1 - (this.activeFratHouse._dist / (TILE * 4));
      const r = TILE * 0.7 + intensity * 6;
      this.chargeRing.lineStyle(3, 0xff2d6f, 0.5 + intensity * 0.5);
      this.chargeRing.strokeCircle(this.playerX, this.playerY, r);
      this.chargeRing.lineStyle(2, 0xffd23f, 0.4 + intensity * 0.4);
      this.chargeRing.strokeCircle(this.playerX, this.playerY, r + 6);
    }
  }

  spawnFratHouse(isBoss = false) {
    const names = FP.UNIVERSITIES[this.selectedUniversity] || FP.UNIVERSITIES.USC;
    const houseName = names[this.fratNamesUsed % names.length];
    this.fratNamesUsed++;
    const id = houseName + '_' + this.fratNamesUsed;

    const side = (Math.random() < 0.5) ? 'left' : 'right';
    const col = side === 'left' ? 1 : COLS - 4;
    const x = col * TILE;
    const y = -TILE * 4;
    const w = TILE * 3, h = TILE * 4;

    const gfx = this.add.graphics();
    FP.drawFratHouse(gfx, side, w, h);
    gfx.setPosition(x, y);
    gfx.setDepth(20);

    let tint = null;
    if (isBoss) {
      tint = this.add.graphics();
      tint.fillStyle(0xff2d6f, 0.18);
      tint.fillRect(0, 0, w, h);
      tint.setPosition(x, y);
      tint.setDepth(21);
    }

    const abbr = FP.greekAbbr(houseName);
    const labelY = y + h * 0.355;
    const label = this.add.text(x + w / 2, labelY, abbr, {
      fontFamily: '"Archivo Black", sans-serif',
      fontSize: isBoss ? '26px' : '20px',
      color: isBoss ? '#ff2d6f' : '#0a0a0a',
    }).setOrigin(0.5).setDepth(22);

    const house = {
      gfx, label, tint, x, y, side, col, w, h,
      name: houseName, id, isBurned: false, isBoss,
      hp: isBoss ? 3 : 1,
      isActive: true,
    };
    this.fratHouses.push(house);

    const trashCol = side === 'left' ? col + 3 : col - 1;
    const tg = this.add.graphics();
    FP.drawTrashcan(tg);
    tg.setPosition(trashCol * TILE, y + h - TILE);
    tg.setDepth(22);
    this.trashcans.push({ gfx: tg, x: trashCol * TILE, y: y + h - TILE, house });

    if (isBoss) {
      this.boss = house;
      this.showBossBanner('BOSS: ' + houseName);
      for (let i = 0; i < 3; i++) {
        this.spawnEnemy('fratbro', y + i * 60);
      }
      FP.audio.combo(8);
    }

    this.updateFratRowList();
    return house;
  }

  showBossBanner(text) {
    this.bossBanner.setText(text);
    this.bossBanner.setAlpha(0);
    this.tweens.add({
      targets: this.bossBanner, alpha: 1, duration: 260,
      yoyo: true, hold: 1400,
    });
    this.cameras.main.flash(180, 255, 45, 111);
  }

  endBoss(victory) {
    this.boss = null;
    this.bossHpBg.setAlpha(0);
    this.bossHpFg.setAlpha(0);
    if (victory) {
      this.addScore(2500, 'BOSS DOWN', '#ffd23f');
      this.bigComboText('BOSS DOWN!');
      this.cameras.main.shake(500, 0.025);
    }
  }

  updateFratRowList() {
    const list = document.getElementById('row-list');
    if (!list) return;
    list.innerHTML = '';
    for (const h of this.fratHouses) {
      const item = document.createElement('div');
      item.className = 'row-list-item' + (h.isBurned ? ' burned' : '');
      item.innerHTML = `<span>${FP.greekAbbr(h.name)}</span><span>${h.isBoss ? '★' : ''}</span>`;
      list.appendChild(item);
    }
  }

  // ==================== ENEMIES ====================
  spawnEnemy(kind, atY = -TILE) {
    const col = 2 + Math.floor(Math.random() * (COLS - 4));
    const gfx = this.add.graphics();
    if (kind === 'fratbro') FP.drawFratbro(gfx);
    else if (kind === 'sorority') FP.drawSororityEnemy(gfx);
    else if (kind === 'pledge') FP.drawPledge(gfx);
    else if (kind === 'ra') FP.drawRA(gfx);
    gfx.setPosition(col * TILE, atY);
    gfx.setDepth(40);
    const enemy = {
      gfx, kind,
      x: col * TILE, y: atY,
      col, dir: Math.random() < 0.5 ? -1 : 1,
      moveTimer: 0,
      chaseRadius: kind === 'sorority' ? TILE * 5 : (kind === 'ra' ? TILE * 3 : TILE * 2),
      hitRadius: TILE * 0.85,
      freezeRadius: kind === 'ra' ? TILE * 2.5 : 0,
    };
    this.enemies.push(enemy);
    return enemy;
  }

  updateEnemies(dt) {
    for (const e of this.enemies) {
      e.moveTimer += dt;

      if (e.kind === 'sorority') {
        const d = U.dist(this.playerX, this.playerY, e.x + TILE / 2, e.y + TILE / 2);
        if (d < e.chaseRadius && e.moveTimer > 220) {
          e.moveTimer = 0;
          if (this.playerX > e.x + TILE / 2 && e.col < COLS - 2) e.col++;
          else if (this.playerX < e.x + TILE / 2 && e.col > 1) e.col--;
          e.x = e.col * TILE;
          e.gfx.setX(e.x);
        }
      } else if (e.kind === 'pledge') {
        if (e.moveTimer > 700) {
          e.moveTimer = 0;
          const newCol = e.col + e.dir;
          if (newCol < 2 || newCol > COLS - 3) e.dir *= -1;
          else { e.col = newCol; e.x = e.col * TILE; e.gfx.setX(e.x); }
        }
      } else if (e.kind === 'fratbro') {
        if (e.moveTimer > 450) {
          e.moveTimer = 0;
          if (Math.random() < 0.35) e.dir *= -1;
          const newCol = e.col + e.dir;
          if (newCol >= 2 && newCol <= COLS - 3) {
            e.col = newCol; e.x = e.col * TILE; e.gfx.setX(e.x);
          }
        }
      } else if (e.kind === 'ra') {
        if (e.moveTimer > 600) {
          e.moveTimer = 0;
          const newCol = e.col + e.dir;
          if (newCol < 2 || newCol > COLS - 3) e.dir *= -1;
          else { e.col = newCol; e.x = e.col * TILE; e.gfx.setX(e.x); }
        }
      }

      const d = U.dist(this.playerX, this.playerY, e.x + TILE / 2, e.y + TILE / 2);

      if (this.activePower?.type === 'moshpit') {
        if (d < e.hitRadius * 1.4) {
          this.killEnemy(e, true);
          continue;
        }
      }

      if (d < e.hitRadius && this.invuln <= 0 && !this.hasCigarette) {
        if (e.kind === 'fratbro' || e.kind === 'sorority' || e.kind === 'pledge') {
          this.fratMeter = U.clamp(this.fratMeter + (e.kind === 'sorority' ? 0.18 : 0.12), 0, 1);
          this.combo = 1; this.updateComboHud();
          this.flashHit();
          this.invuln = 700;
          this.playerLane = U.clamp(this.playerLane + (this.playerX < e.x ? -1 : 1), 1, COLS - 2);
          FP.audio.hit();
          if (typeof Haptic !== 'undefined') Haptic.error();
          this.particles.burst(this.playerX, this.playerY, { count: 14, colors: [0xff2d6f, 0xffd23f, 0xff7a00], size: 5, life: 500 });
        }
      }

      if (e.kind === 'ra' && d < e.freezeRadius) {
        this.frozen = Math.max(this.frozen, 250);
        this.warnText.setText('FROZEN BY RA');
        this.warnText.setVisible(true);
        this.time.delayedCall(300, () => {
          if (this.frozen <= 0) this.warnText.setVisible(false);
        });
      }
    }
  }

  killEnemy(e, splat = false) {
    e.gfx.destroy();
    const i = this.enemies.indexOf(e);
    if (i >= 0) this.enemies.splice(i, 1);
    if (splat) {
      this.particles.burst(e.x + TILE / 2, e.y + TILE / 2, { count: 20, colors: [0xffd23f, 0xff2d6f, 0xff7a00] });
      FP.audio.boom();
      this.addScore(50 * this.combo, '+' + 50 * this.combo, '#ffd23f');
      this.bumpCombo();
    }
  }

  // ==================== VENUES & COLLECTIBLES ====================
  spawnVenue(kind) {
    const side = this.activeFratHouse?.side === 'left' ? 'right' : (Math.random() < 0.5 ? 'left' : 'right');
    const col = side === 'left' ? 1 : COLS - 4;
    const x = col * TILE, y = -TILE * 4;
    const w = TILE * 3, h = TILE * 4;
    const gfx = this.add.graphics();
    FP.drawVenue(gfx, kind, w, h);
    gfx.setPosition(x, y);
    gfx.setDepth(18);
    this.venues.push({
      gfx, x, y, w, h, side, col, kind,
      visited: false, reachedTop: false,
    });
  }

  updateVenues(dt) {
    for (const v of this.venues) {
      const inside =
        this.playerX > v.x && this.playerX < v.x + v.w &&
        this.playerY > v.y && this.playerY < v.y + v.h;
      if (inside) {
        v.visited = true;
        if (this.playerY < v.y + v.h * 0.4) v.reachedTop = true;
      } else if (v.visited && v.reachedTop && !v.consumed) {
        v.consumed = true;
        this.collectShopItem(v.kind);
        FP.audio.bigPickup();
        if (typeof Haptic !== 'undefined') Haptic.success();
      } else if (v.visited && !inside && !v.reachedTop) {
        v.visited = false;
      }
    }
  }

  collectShopItem(kind) {
    const map = { coffee: 250, record: 350, skate: 300 };
    const base = map[kind] || 200;
    const pts = base * this.combo;
    this.addScore(pts, '+' + pts + ' ' + kind, '#2ad17b');
    this.punkMeter = U.clamp(this.punkMeter + 0.22, 0, 1);
    this.bumpCombo();
    this.particles.burst(this.playerX, this.playerY, { count: 14, colors: [0x2ad17b, 0xffd23f] });
  }

  spawnCollectible() {
    const col = 2 + Math.floor(Math.random() * (COLS - 4));
    const types = ['zine', 'zine', 'joint', 'joint', 'vinyl', 'skateboard'];
    const type = U.pick(types);
    const gfx = this.add.graphics();
    FP.drawCollectible(gfx, type);
    gfx.setPosition(col * TILE, -TILE);
    gfx.setDepth(35);
    this.collectibles.push({ gfx, x: col * TILE, y: -TILE, col, type });
  }

  updateCollectibles(dt) {
    for (let i = this.collectibles.length - 1; i >= 0; i--) {
      const c = this.collectibles[i];
      const d = U.dist(this.playerX, this.playerY, c.x + TILE / 2, c.y + TILE / 2);
      if (d < TILE * 0.8) {
        const ptsMap = { zine: 150, coffee: 100, joint: 120, vinyl: 175, skateboard: 150 };
        const pts = (ptsMap[c.type] || 100) * this.combo;
        this.addScore(pts, '+' + pts, '#ff2d6f');
        this.punkMeter = U.clamp(this.punkMeter + 0.08, 0, 1);
        this.bumpCombo();
        FP.audio.pickup();
        if (typeof Haptic !== 'undefined') Haptic.medium();
        this.particles.burst(c.x + TILE / 2, c.y + TILE / 2, { count: 8, colors: [0xff2d6f, 0xffd23f], size: 4 });
        c.gfx.destroy();
        this.collectibles.splice(i, 1);
      }
    }
  }

  // ==================== CRATES (POWER-UPS) ====================
  spawnCrate() {
    const types = Object.keys(FP.POWERUPS);
    const type = U.pick(types);
    const col = 2 + Math.floor(Math.random() * (COLS - 4));
    const gfx = this.add.graphics();
    FP.drawPowerupCrate(gfx, type);
    gfx.setPosition(col * TILE, -TILE);
    gfx.setDepth(38);
    this.tweens.add({ targets: gfx, scale: 1.06, duration: 500, yoyo: true, repeat: -1 });
    this.crates.push({ gfx, x: col * TILE, y: -TILE, type });
  }

  updateCrates(dt) {
    for (let i = this.crates.length - 1; i >= 0; i--) {
      const c = this.crates[i];
      const d = U.dist(this.playerX, this.playerY, c.x + TILE / 2, c.y + TILE / 2);
      if (d < TILE) {
        this.powerup = { type: c.type };
        FP.audio.powerup();
        if (typeof Haptic !== 'undefined') Haptic.medium();
        this.addScore(100 * this.combo, '+POWER', '#6effff');
        this.particles.burst(c.x + TILE / 2, c.y + TILE / 2, { count: 18, colors: [0x6effff, 0xffd23f] });
        c.gfx.destroy();
        this.crates.splice(i, 1);
        this.updateHud();
      }
    }
  }

  tryUsePowerup() {
    if (!this.powerup) return;
    const t = this.powerup.type;
    this.activePower = { type: t, until: 4000 };
    if (t === 'skateboard') {
      this.activePower.until = 4000;
      this.particles.burst(this.playerX, this.playerY, { count: 14, colors: [0x6effff], size: 5 });
    } else if (t === 'spraypaint') {
      if (this.activeFratHouse) {
        this.taggedFrat = this.activeFratHouse;
        const tag = this.add.graphics();
        tag.lineStyle(4, 0xff2d6f);
        tag.beginPath();
        tag.moveTo(0, 30); tag.lineTo(60, 8); tag.lineTo(70, 30); tag.lineTo(120, 5);
        tag.strokePath();
        tag.setPosition(this.activeFratHouse.x, this.activeFratHouse.y + 80);
        tag.setDepth(23);
        this.activeFratHouse.tagGfx = tag;
        this.activePower = null;
      } else {
        this.warnText.setText('NO FRAT TO TAG');
        this.warnText.setVisible(true);
        this.time.delayedCall(900, () => this.warnText.setVisible(false));
        this.activePower = null;
        this.powerup = null;
        this.updateHud();
        return;
      }
    } else if (t === 'boombox') {
      this.activePower = null;
      const wave = this.add.graphics().setDepth(60);
      this.tweens.addCounter({
        from: 0, to: 1, duration: 380,
        onUpdate: (tw) => {
          const r = U.lerp(8, TILE * 5, tw.getValue());
          wave.clear();
          wave.lineStyle(4, 0xff7a00, 1 - tw.getValue());
          wave.strokeCircle(this.playerX, this.playerY, r);
          wave.lineStyle(2, 0xffd23f, 1 - tw.getValue());
          wave.strokeCircle(this.playerX, this.playerY, r + 8);
        },
        onComplete: () => wave.destroy(),
      });
      for (const e of this.enemies) {
        const d = U.dist(this.playerX, this.playerY, e.x + TILE / 2, e.y + TILE / 2);
        if (d < TILE * 5) {
          if (e.x + TILE / 2 < this.playerX) {
            e.col = Math.max(1, e.col - 3);
          } else {
            e.col = Math.min(COLS - 2, e.col + 3);
          }
          e.x = e.col * TILE;
          e.gfx.setX(e.x);
          this.particles.burst(e.x + TILE / 2, e.y + TILE / 2, { count: 6, colors: [0xff7a00] });
        }
      }
      FP.audio.boom();
      this.cameras.main.shake(220, 0.012);
    } else if (t === 'moshpit') {
      this.invuln = 4000;
    } else if (t === 'zinebomb') {
      this.activePower = null;
      for (const e of [...this.enemies]) {
        this.particles.burst(e.x + TILE / 2, e.y + TILE / 2, { count: 16, colors: [0xff2d6f, 0xffd23f, 0xff7a00] });
        e.gfx.destroy();
      }
      this.addScore(this.enemies.length * 80 * this.combo, 'ZINE BOMB', '#ff2d6f');
      this.enemies = [];
      this.cameras.main.flash(220, 255, 45, 111);
      this.cameras.main.shake(280, 0.018);
      FP.audio.boom();
    }
    this.powerup = null;
    this.updateHud();
  }

  endPowerUp() {
    const t = this.activePower?.type;
    if (t === 'moshpit') this.invuln = 0;
    this.activePower = null;
    this.updateHud();
  }

  // ==================== BURN / CIG ====================
  gainCigarette() {
    this.hasCigarette = true;
    this.punkMeter = 0;
    this.fratMeter = Math.max(0, this.fratMeter - 0.4);
    this.invuln = 1200;
    FP.audio.cig();
    this.cameras.main.flash(220, 255, 122, 0);
    this.particles.burst(this.playerX, this.playerY, { count: 20, colors: [0xff7a00, 0xffd23f, 0xff2d6f] });
    this.bigComboText('LIT 🔥');
    this.drawPlayer();
  }

  tryBurn() {
    if (!this.hasCigarette) return;
    let best = null, bestD = Infinity;
    for (const t of this.trashcans) {
      if (!t.house || t.house.isBurned) continue;
      const d = U.dist(this.playerX, this.playerY, t.x + TILE / 2, t.y + TILE / 2);
      if (d < bestD) { bestD = d; best = t; }
    }
    if (best && bestD < TILE * 1.5) {
      this.burnHouse(best.house);
    } else {
      this.warnText.setText('GO TO A TRASHCAN');
      this.warnText.setVisible(true);
      this.time.delayedCall(800, () => this.warnText.setVisible(false));
    }
  }

  burnHouse(house) {
    if (house.isBurned) return;
    if (house.isBoss) {
      house.hp -= 1;
      this.cameras.main.shake(360, 0.018);
      this.addScore(800 * this.combo, 'BOSS HIT', '#ff7a00');
      this.particles.burst(house.x + house.w / 2, house.y + house.h / 2, { count: 22, colors: [0xff4d2a, 0xffd23f] });
      this.hasCigarette = false; this.drawPlayer();
      this.invuln = 800;
      this.bumpCombo();
      if (house.hp <= 0) {
        this.actuallyBurn(house, true);
        this.endBoss(true);
      }
      return;
    }
    this.actuallyBurn(house, false);
  }

  actuallyBurn(house, isBoss) {
    house.isBurned = true;
    house.gfx.clear();
    FP.drawBurnedFrat(house.gfx, house.w, house.h);
    if (house.label) house.label.setColor('#666666');
    const multiplier = (this.taggedFrat === house) ? 2 : 1;
    if (multiplier === 2) this.taggedFrat = null;
    const pts = 1500 * multiplier * this.combo;
    this.addScore(pts, multiplier === 2 ? '+TAGGED ×2!' : 'BURNED!', '#ff4d2a');
    this.bumpCombo(2);
    this.hasCigarette = false; this.drawPlayer();
    this.invuln = 1200;
    const fg = this.add.graphics();
    fg.setDepth(22);
    fg.setPosition(house.x, house.y);
    this.fires.push({ gfx: fg, x: house.x, y: house.y, w: house.w, frame: 0, frameTimer: 100, life: 3000 });
    this.cameras.main.flash(280, 255, 122, 0);
    this.cameras.main.shake(380, isBoss ? 0.03 : 0.02);
    this.hitstop = 100;
    this.particles.burst(house.x + house.w / 2, house.y + house.h / 2, { count: 36, colors: [0xff4d2a, 0xffd23f, 0xff7a00], size: 6, life: 800 });
    this.particles.smoke(house.x + house.w / 2, house.y + house.h / 2, { count: 10, dark: true });
    FP.audio.burn();
    this.bigComboText('BURNED 🔥');
    this.updateFratRowList();
  }

  updateFires(dt) {
    for (let i = this.fires.length - 1; i >= 0; i--) {
      const f = this.fires[i];
      f.life -= dt; f.frameTimer -= dt;
      if (f.frameTimer <= 0) {
        f.frame = (f.frame + 1) % 3; f.frameTimer = 100;
        FP.drawFire(f.gfx, f.frame, f.w);
      }
      if (f.life <= 0) {
        f.gfx.destroy();
        this.fires.splice(i, 1);
      }
    }
  }

  // ==================== SPAWN SCHEDULER ====================
  handleSpawning(dt) {
    if (this.boss) {
      this.spawnTimers.enemy -= dt;
      if (this.spawnTimers.enemy <= 0) {
        this.spawnTimers.enemy = U.rand(1500, 2200);
        this.spawnEnemy(U.pick(['fratbro', 'sorority', 'pledge']));
      }
      return;
    }
    const time = this.score * 0.001;
    this.spawnTimers.frat -= dt;
    if (this.spawnTimers.frat <= 0 && !this.activeFratHouse) {
      const boss = (time > 30 && this.fratNamesUsed > 2 && this.fratNamesUsed % 4 === 0);
      this.spawnFratHouse(boss);
      this.spawnTimers.frat = U.rand(3500, 5500);
    }
    this.spawnTimers.venue -= dt;
    if (this.spawnTimers.venue <= 0) {
      this.spawnVenue(U.pick(['coffee', 'record', 'skate']));
      this.spawnTimers.venue = U.rand(2400, 3800);
    }
    this.spawnTimers.enemy -= dt;
    if (this.spawnTimers.enemy <= 0) {
      const types = ['fratbro'];
      if (time > 12) types.push('pledge');
      if (time > 25) types.push('sorority');
      if (time > 40) types.push('ra');
      this.spawnEnemy(U.pick(types));
      this.spawnTimers.enemy = U.rand(1600, Math.max(800, 2400 - time * 12));
    }
    this.spawnTimers.crate -= dt;
    if (this.spawnTimers.crate <= 0) {
      this.spawnCrate();
      this.spawnTimers.crate = U.rand(9000, 13000);
    }
    this.spawnTimers.item -= dt;
    if (this.spawnTimers.item <= 0) {
      this.spawnCollectible();
      this.spawnTimers.item = U.rand(900, 1700);
    }
  }

  // ==================== HIT / DAMAGE / GAME OVER ====================
  takePipeline() {
    this.lives -= 1;
    this.fratMeter = 0; this.punkMeter = 0; this.hasCigarette = false;
    FP.audio.transform();
    if (typeof Haptic !== 'undefined') Haptic.heavy();
    this.cameras.main.shake(420, 0.025);
    this.cameras.main.flash(380, 255, 90, 160);
    this.combo = 1; this.updateComboHud();
    this.invuln = 1800;
    this.particles.burst(this.playerX, this.playerY, { count: 30, colors: [0xff5a8a, 0xffd23f] });
    this.drawPlayer();
    if (this.lives <= 0) {
      this.triggerGameOver();
    } else {
      this.bigComboText('PIPELINED!');
    }
    this.updateHud();
  }

  triggerGameOver() {
    this.gameOver = true;
    if (this.score > this.best) {
      this.best = Math.floor(this.score);
      localStorage.setItem('fratty-pipeline:best', '' + this.best);
    }
    FP.audio.gameover();
    if (typeof Haptic !== 'undefined') Haptic.error();
    this.cameras.main.shake(600, 0.03);
    window.fpShowEnd(Math.floor(this.score), this.best);
  }

  flashHit() {
    this.cameras.main.shake(140, 0.012);
    this.cameras.main.flash(120, 255, 45, 111);
    this.bigComboText('OUCH', 350);
    if (this.player) {
      this.player.setAlpha(0.4);
      this.time.delayedCall(140, () => this.player.setAlpha(1));
    }
  }

  // ==================== COMBO / SCORE / HUD ====================
  bumpCombo(amount = 1) {
    this.combo = Math.min(99, this.combo + amount);
    this.comboTimer = this.COMBO_TIMEOUT;
    FP.audio.combo(this.combo);
    this.updateComboHud();
    if (this.combo >= 5 && this.combo % 5 === 0) {
      this.bigComboText('×' + this.combo + ' COMBO!');
    }
  }

  updateComboHud() {
    const el = document.getElementById('hud-combo');
    if (el) {
      el.textContent = '×' + this.combo;
      el.classList.add('pop');
      setTimeout(() => el.classList.remove('pop'), 120);
    }
    const cb = document.getElementById('hud-combo-bar');
    if (cb) cb.style.width = (this.combo > 1 ? 100 : 0) + '%';
  }

  addScore(amount, label, color = '#ffd23f') {
    this.score += amount;
    if (label) this.spawnFloatText(this.playerX, this.playerY - TILE * 0.6, label, color);
  }

  spawnFloatText(x, y, text, color) {
    const t = this.add.text(x, y, text, {
      fontFamily: '"Archivo Black", sans-serif',
      fontSize: '13px', color, stroke: '#0a0a0a', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(110);
    this.tweens.add({
      targets: t, y: y - 36, alpha: 0, duration: 700,
      onComplete: () => t.destroy(),
    });
  }

  bigComboText(text, duration = 700) {
    this.bigCombo.setText(text).setAlpha(1).setScale(0.5);
    this.tweens.add({
      targets: this.bigCombo, scale: 1.2, duration: 220, ease: 'Back.Out',
    });
    this.tweens.add({
      targets: this.bigCombo, alpha: 0, duration: 280, delay: duration - 180,
    });
  }

  updateHud() {
    document.getElementById('hud-score').textContent = Math.floor(this.score).toLocaleString();
    document.getElementById('hud-best').textContent = Math.floor(this.best).toLocaleString();
    document.getElementById('hud-burned').textContent = this.fratHouses.filter(h => h.isBurned).length;
    document.getElementById('meter-punk-fill').style.width = (this.punkMeter * 100) + '%';
    document.getElementById('meter-frat-fill').style.width = (this.fratMeter * 100) + '%';
    const lr = document.getElementById('hud-lives');
    if (lr) {
      lr.innerHTML = '';
      for (let i = 0; i < 3; i++) {
        const div = document.createElement('div');
        div.className = 'life-pip' + (i >= this.lives ? ' lost' : '');
        lr.appendChild(div);
      }
    }
    const ps = document.getElementById('powerup-slot');
    if (ps) {
      if (this.powerup) {
        const pu = FP.POWERUPS[this.powerup.type];
        ps.classList.add('has');
        ps.innerHTML = `<div class="pup-icon">${pu.icon}</div><div class="pup-name">${pu.name}</div><div class="pup-hint">Q to use</div>`;
      } else {
        ps.classList.remove('has');
        ps.innerHTML = '<div class="pup-empty">empty</div>';
      }
    }
    if (this.activePower) {
      const pu = FP.POWERUPS[this.activePower.type];
      this.powerActiveText.setText(pu.name + ' ' + Math.ceil(this.activePower.until / 500) * 0.5 + 's');
    } else {
      this.powerActiveText.setText('');
    }
    if (this.hasCigarette) {
      let near = false;
      for (const t of this.trashcans) {
        if (t.house?.isBurned) continue;
        if (U.dist(this.playerX, this.playerY, t.x + TILE/2, t.y + TILE/2) < TILE * 1.5) { near = true; break; }
      }
      this.fPrompt.setText(near ? 'PRESS F TO BURN' : 'GET TO A TRASHCAN').setVisible(true);
    } else {
      this.fPrompt.setVisible(false);
    }
  }

  tryDash() {
    if (this.dashCooldown > 0) return;
    this.dashCooldown = 1100;
    this.invuln = 320;
    FP.audio.dash();
    this.playerY = Math.max(TILE * 3, this.playerY - TILE * 2);
    for (let i = 0; i < 6; i++) {
      this.time.delayedCall(i * 30, () => {
        this.particles.trail(this.playerX, this.playerY + TILE * 0.4, 0xff2d6f);
      });
    }
    this.cameras.main.shake(80, 0.005);
  }
}

window.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  width: VIEW_W, height: VIEW_H,
  backgroundColor: 0xf0e9d6,
  render: { pixelArt: false, antialias: true, roundPixels: true },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: GameScene,
};
window.GameScene = GameScene;
