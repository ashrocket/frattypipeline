// Spotify stub — real PKCE auth needs a registered redirect URI + server config.
window.FP = window.FP || {};
(() => {
  const loginBtn = document.getElementById('spotify-login');
  const trackInfo = document.getElementById('track-info');
  const userInfo = document.getElementById('user-info');
  const playBtn = document.getElementById('play-btn');
  const pauseBtn = document.getElementById('pause-btn');
  const logoutBtn = document.getElementById('logout-btn');

  let connected = false;

  function setTrack(text) { if (trackInfo) trackInfo.textContent = text; }

  loginBtn?.addEventListener('click', () => {
    if (connected) return;
    connected = true;
    loginBtn.textContent = 'Connected';
    loginBtn.classList.add('hidden');
    if (userInfo) userInfo.textContent = 'punk_mode';
    if (logoutBtn) logoutBtn.classList.remove('hidden');
    setTrack('▶ Bikini Kill — Rebel Girl');
  });

  playBtn?.addEventListener('click', () => {
    playBtn.classList.add('hidden');
    pauseBtn?.classList.remove('hidden');
    if (!connected) setTrack('▶ silence (connect Spotify for music)');
  });
  pauseBtn?.addEventListener('click', () => {
    pauseBtn.classList.add('hidden');
    playBtn?.classList.remove('hidden');
    setTrack('❚❚ paused');
  });
  logoutBtn?.addEventListener('click', () => {
    connected = false;
    loginBtn?.classList.remove('hidden');
    loginBtn.textContent = 'Connect Spotify';
    logoutBtn.classList.add('hidden');
    if (userInfo) userInfo.textContent = 'guest';
    setTrack('no track');
  });
})();
