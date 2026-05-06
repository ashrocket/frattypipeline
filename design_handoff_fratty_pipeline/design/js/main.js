// Boot + global UI glue
window.addEventListener('load', () => {
  // Initialize Phaser game
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

  // Pause overlay
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
      window.gameScene.scene.restart();
    } else {
      window.fpTogglePause();
    }
  });

  // University select live update
  document.getElementById('university')?.addEventListener('change', (e) => {
    if (window.gameScene) window.gameScene.selectedUniversity = e.target.value;
  });

  // Resize game to fit viewport (height-priority since 720 is tall)
  function resize() {
    const wrap = document.getElementById('game-wrapper');
    if (!wrap) return;
    const maxH = window.innerHeight - 120;
    const maxW = Math.min(window.innerWidth - 440, 480);
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
});
