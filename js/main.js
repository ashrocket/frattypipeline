// Boot + global UI glue
window.addEventListener('load', () => {
  const game = new Phaser.Game(window.GameConfig);
  window.fpGame = game;

  // Character chips
  const charStrip = document.getElementById('char-strip');
  if (charStrip && FP.CHARACTER_TYPES) {
    FP.CHARACTER_TYPES.forEach((c, i) => {
      const chip = document.createElement('div');
      chip.className = 'char-chip' + (i === 0 ? ' active' : '');
      chip.textContent = c.name;
      chip.addEventListener('click', () => {
        document.querySelectorAll('.char-chip').forEach(el => el.classList.remove('active'));
        chip.classList.add('active');
        if (window.gameScene) {
          window.gameScene.charIdx = i;
          window.gameScene.drawPlayer();
        }
      });
      charStrip.appendChild(chip);
    });
  }

  // Start button
  const startBtn = document.getElementById('start-btn');
  const startOverlay = document.getElementById('start-overlay');
  startBtn?.addEventListener('click', () => {
    startOverlay.classList.add('hidden');
    if (window.gameScene) window.gameScene.beginRun();
    FP.audio.resume();
  });

  // Pause / game-over overlay
  const overlay = document.getElementById('overlay');
  const overlayBtn = document.getElementById('overlay-btn');
  const overlayTitle = document.getElementById('overlay-title');
  const overlaySub = document.getElementById('overlay-sub');
  const overlayStats = document.getElementById('overlay-stats');

  let isPaused = false;
  let isEnd = false;

  window.fpTogglePause = () => {
    if (isEnd) return;
    if (!window.gameScene || !window.gameScene.gameStarted) return;
    isPaused = !isPaused;
    window.gameScene.paused = isPaused;
    if (isPaused) {
      overlayTitle.textContent = 'PAUSED';
      overlaySub.textContent = 'press P or click resume';
      overlayStats.innerHTML = '';
      overlayBtn.textContent = 'RESUME';
      overlay.classList.remove('hidden');
    } else {
      overlay.classList.add('hidden');
    }
  };

  window.fpShowEnd = (score, best) => {
    isEnd = true;
    overlayTitle.textContent = score >= best ? 'NEW BEST!' : 'PIPELINED';
    overlaySub.textContent = score >= best ? 'you survived. for now.' : 'they got you. try again.';
    overlayStats.innerHTML = `
      <div>Score: <b>${score.toLocaleString()}</b></div>
      <div>Best: <b>${best.toLocaleString()}</b></div>
      <div>Burned: <b>${window.gameScene.fratHouses.filter(h => h.isBurned).length}</b></div>
    `;
    overlayBtn.textContent = 'RUN AGAIN';
    overlay.classList.remove('hidden');
  };

  overlayBtn?.addEventListener('click', () => {
    if (isEnd) {
      isEnd = false; isPaused = false;
      overlay.classList.add('hidden');
      window.fpPendingBeginRun = true;
      window.gameScene.scene.restart();
    } else {
      window.fpTogglePause();
    }
  });

  // University select live update
  document.getElementById('university')?.addEventListener('change', (e) => {
    if (window.gameScene) window.gameScene.selectedUniversity = e.target.value;
  });

  // Resize game canvas to fit viewport
  function resize() {
    const wrap = document.getElementById('game-wrapper');
    if (!wrap) return;
    const maxH = window.innerHeight - 120;
    const maxW = Math.min(window.innerWidth - 440, 720);
    let h = maxH, w = h * (480/720);
    if (w > maxW) { w = maxW; h = w * (720/480); }
    if (window.innerWidth < 1100) { w = Math.min(window.innerWidth - 16, 480); h = w * 720/480; }
    wrap.style.width = w + 'px';
    wrap.style.height = h + 'px';
    const gameEl = document.getElementById('game');
    if (gameEl) { gameEl.style.width = w + 'px'; gameEl.style.height = h + 'px'; }
  }
  window.addEventListener('resize', resize);
  setTimeout(resize, 100);

  // ─── Tilt steering ──────────────────────────────────────────────────────────
  const TILT_DEAD = 18;
  let _tiltLeft = false, _tiltRight = false;
  Motion.onTilt((gamma) => {
    const newLeft = gamma < -TILT_DEAD;
    const newRight = gamma > TILT_DEAD;
    if (newLeft !== _tiltLeft || newRight !== _tiltRight) {
      _tiltLeft = newLeft;
      _tiltRight = newRight;
      if (window.gameScene) {
        window.gameScene.tiltLeft  = _tiltLeft;
        window.gameScene.tiltRight = _tiltRight;
      }
    }
  });

  const _motionBtn = document.getElementById('motion-btn');
  if (Motion.isMobile()) {
    if (Motion.needsPermission()) {
      if (_motionBtn) {
        _motionBtn.style.display = '';
        _motionBtn.addEventListener('click', async () => {
          if (await Motion.start()) _motionBtn.remove();
        });
      }
    } else {
      Motion.start();
    }
  }

  // ─── Character creator ──────────────────────────────────────────────────────
  (function initCharCreator() {
    const cfg = FP.PLAYER_CONFIG;
    const previewCanvas = document.getElementById('char-preview');
    if (!previewCanvas) return;
    const ctx = previewCanvas.getContext('2d');

    function toHex(val) { return '#' + val.toString(16).padStart(6, '0'); }

    function drawPreview() {
      const s = 80;
      ctx.clearRect(0, 0, s, 120);
      ctx.fillStyle = '#f0e9d6'; ctx.fillRect(0, 0, s, 120);
      // Shadow
      ctx.fillStyle = 'rgba(10,10,10,0.18)';
      ctx.beginPath(); ctx.ellipse(s*0.5, 113, s*0.28, 5, 0, 0, Math.PI*2); ctx.fill();
      // Hair
      ctx.fillStyle = toHex(cfg.hairColor);
      if (cfg.hairStyle === 'punk') {
        for (let i = 0; i < 6; i++) {
          ctx.beginPath();
          ctx.moveTo(s*(0.32+i*0.06), s*0.08); ctx.lineTo(s*(0.35+i*0.06), s*0.28); ctx.lineTo(s*(0.38+i*0.06), s*0.08);
          ctx.fill();
        }
      } else if (cfg.hairStyle === 'goth') {
        ctx.fillRect(s*0.18, s*0.08, s*0.64, s*0.22);
        ctx.fillRect(s*0.12, s*0.18, s*0.18, s*0.3);
      } else {
        ctx.fillRect(s*0.2, s*0.08, s*0.6, s*0.22);
      }
      // Face
      ctx.fillStyle = toHex(cfg.skinTone); ctx.fillRect(s*0.28, s*0.28, s*0.44, s*0.28);
      ctx.strokeStyle = '#0a0a0a'; ctx.lineWidth = 1.5; ctx.strokeRect(s*0.28, s*0.28, s*0.44, s*0.28);
      // Eyes
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(s*0.32, s*0.35, s*0.12, s*0.07); ctx.fillRect(s*0.56, s*0.35, s*0.12, s*0.07);
      // Shirt
      ctx.fillStyle = toHex(cfg.shirtColor); ctx.fillRect(s*0.2, s*0.56, s*0.6, s*0.28);
      ctx.strokeStyle = '#0a0a0a'; ctx.lineWidth = 1.5; ctx.strokeRect(s*0.2, s*0.56, s*0.6, s*0.28);
      // Pants
      ctx.fillStyle = toHex(cfg.pantsColor);
      ctx.fillRect(s*0.26, s*0.84, s*0.2, s*0.18); ctx.fillRect(s*0.54, s*0.84, s*0.2, s*0.18);
      ctx.strokeStyle = '#0a0a0a'; ctx.lineWidth = 1;
      ctx.strokeRect(s*0.26, s*0.84, s*0.2, s*0.18); ctx.strokeRect(s*0.54, s*0.84, s*0.2, s*0.18);
      // Name tag
      ctx.fillStyle = '#0a0a0a'; ctx.font = 'bold 8px monospace';
      ctx.fillText(cfg.name || '—', 4, 118);
    }

    function saveAndRedraw() {
      FP.savePlayerConfig(cfg);
      drawPreview();
      if (window.gameScene && window.gameScene.gameStarted) {
        window.gameScene.playerConfig = Object.assign({}, cfg);
        window.gameScene.player.clear();
        FP.drawPunk(window.gameScene.player, window.gameScene.playerConfig, 0, null, false);
      }
    }

    // Name
    const nameEl = document.getElementById('cc-name');
    if (nameEl) {
      nameEl.value = cfg.name;
      nameEl.addEventListener('input', () => { cfg.name = nameEl.value; saveAndRedraw(); });
    }

    // Hair style chips
    const hsEl = document.getElementById('cc-hairstyle');
    if (hsEl) {
      FP.HAIR_STYLES.forEach(style => {
        const chip = document.createElement('div');
        chip.className = 'cc-chip' + (style === cfg.hairStyle ? ' active' : '');
        chip.textContent = style[0].toUpperCase() + style.slice(1);
        chip.addEventListener('click', () => {
          cfg.hairStyle = style;
          hsEl.querySelectorAll('.cc-chip').forEach(c => c.classList.remove('active'));
          chip.classList.add('active');
          saveAndRedraw();
        });
        hsEl.appendChild(chip);
      });
    }

    function buildSwatches(elId, palette, cfgKey) {
      const el = document.getElementById(elId);
      if (!el) return;
      palette.forEach(entry => {
        const sw = document.createElement('div');
        sw.className = 'cc-swatch' + (entry.val === cfg[cfgKey] ? ' active' : '');
        sw.style.background = entry.hex;
        sw.title = entry.name;
        sw.addEventListener('click', () => {
          cfg[cfgKey] = entry.val;
          el.querySelectorAll('.cc-swatch').forEach(s => s.classList.remove('active'));
          sw.classList.add('active');
          saveAndRedraw();
        });
        el.appendChild(sw);
      });
    }

    buildSwatches('cc-haircolor', FP.HAIR_COLORS,  'hairColor');
    buildSwatches('cc-skin',      FP.SKIN_TONES,   'skinTone');
    buildSwatches('cc-shirt',     FP.SHIRT_COLORS, 'shirtColor');
    buildSwatches('cc-pants',     FP.PANTS_COLORS, 'pantsColor');

    drawPreview();
  })();
});
