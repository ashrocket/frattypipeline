// Fratty Pipeline - Spotify Integration & Game Initialization
// 90s Style Edition

const MUSIC_VERSION = '1.0.0';
const GAME_VERSION = '1.0.0';

// Spotify credentials
const CLIENT_ID = 'aa16f7f72c04485fb93d86d2f7ee33d1';
const REDIRECT_URI = window.location.origin + window.location.pathname;
const SCOPES = 'user-read-private user-read-email user-modify-playback-state user-read-playback-state streaming';
const TEST_TRACK_URI = 'spotify:track:33lVSu93J91BDmhfRT7iTA';

let accessToken = null;
let spotifyPlayer = null;
let deviceId = null;
let userPausedManually = false;

// UI Elements
const spotifyLoginSection = document.getElementById('spotify-login-section');
const musicBar = document.getElementById('music-bar');
const spotifyLoginBtn = document.getElementById('spotify-login');
const skipSpotifyBtn = document.getElementById('skip-spotify');
const playBtn = document.getElementById('play-btn');
const pauseBtn = document.getElementById('pause-btn');
const resumeBtn = document.getElementById('resume-btn');
const logoutBtn = document.getElementById('logout-btn');
const trackInfo = document.getElementById('track-info');
const userInfo = document.getElementById('user-info');

function updateStatus(message, isError = false) {
  console.log(isError ? `[ERROR] ${message}` : `[INFO] ${message}`);
  if (trackInfo) {
    trackInfo.textContent = message;
  }
}

function generateRandomString(length) {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const values = crypto.getRandomValues(new Uint8Array(length));
  return values.reduce((acc, x) => acc + possible[x % possible.length], "");
}

async function sha256(plain) {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return window.crypto.subtle.digest('SHA-256', data);
}

function base64encode(input) {
  return btoa(String.fromCharCode(...new Uint8Array(input)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

async function loginWithSpotify() {
  updateStatus('Starting login...');

  const codeVerifier = generateRandomString(64);
  const hashed = await sha256(codeVerifier);
  const codeChallenge = base64encode(hashed);

  localStorage.setItem('code_verifier', codeVerifier);

  const authUrl = new URL('https://accounts.spotify.com/authorize');
  authUrl.searchParams.append('response_type', 'code');
  authUrl.searchParams.append('client_id', CLIENT_ID);
  authUrl.searchParams.append('scope', SCOPES);
  authUrl.searchParams.append('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.append('code_challenge_method', 'S256');
  authUrl.searchParams.append('code_challenge', codeChallenge);

  window.location.href = authUrl.toString();
}

async function handleCallback() {
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');
  const error = urlParams.get('error');

  window.history.replaceState({}, document.title, window.location.pathname);

  if (error) {
    updateStatus(`Login error: ${error}`, true);
    showPlayerOnly();
    return;
  }

  if (code) {
    updateStatus('Getting token...');
    const success = await exchangeCodeForToken(code);
    if (success) {
      updateStatus('Connected! Initializing player...');
      getUserInfo();
    } else {
      updateStatus('Login failed');
      showSpotifyLoginOption();
    }
  }
}

async function exchangeCodeForToken(code) {
  const codeVerifier = localStorage.getItem('code_verifier');

  if (!codeVerifier) {
    updateStatus('No code verifier found', true);
    return false;
  }

  try {
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: REDIRECT_URI,
        client_id: CLIENT_ID,
        code_verifier: codeVerifier
      })
    });

    if (!response.ok) {
      throw new Error(`Token failed: ${response.status}`);
    }

    const data = await response.json();
    accessToken = data.access_token;

    sessionStorage.setItem('spotify_access_token', accessToken);
    localStorage.removeItem('code_verifier');

    return true;

  } catch (error) {
    updateStatus(`Token error: ${error.message}`, true);
    return false;
  }
}

async function getUserInfo() {
  try {
    const response = await fetch('https://api.spotify.com/v1/me', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    if (!response.ok) throw new Error(`User info failed: ${response.status}`);

    const user = await response.json();

    if (userInfo) {
      userInfo.textContent = user.display_name || 'User';
    }

    if (logoutBtn) {
      logoutBtn.classList.remove('hidden');
    }

    if (user.product === 'premium') {
      updateStatus('Initializing player...');
      if (spotifyLoginSection) spotifyLoginSection.classList.add('hidden');
      if (musicBar) musicBar.classList.remove('hidden');
      if (window.initializeSpotifyPlayer) {
        window.initializeSpotifyPlayer();
      }
    } else {
      updateStatus('Premium required for playback', true);
      showPlayerOnly();
    }

  } catch (error) {
    updateStatus(`Error: ${error.message}`, true);
    showPlayerOnly();
  }
}

window.initializeSpotifyPlayer = function() {
  if (!window.Spotify?.Player) {
    updateStatus('SDK loading...');
    return;
  }

  spotifyPlayer = new Spotify.Player({
    name: 'Fratty Pipeline Player',
    getOAuthToken: cb => cb(accessToken),
    volume: 0.8
  });

  window.spotifyPlayer = spotifyPlayer;

  spotifyPlayer.addListener('initialization_error', ({ message }) => {
    updateStatus(`Init error: ${message}`, true);
  });

  spotifyPlayer.addListener('authentication_error', ({ message }) => {
    updateStatus(`Auth error: ${message}`, true);
  });

  spotifyPlayer.addListener('account_error', ({ message }) => {
    updateStatus(`Account error: ${message}`, true);
  });

  spotifyPlayer.addListener('playback_error', ({ message }) => {
    updateStatus(`Playback error: ${message}`, true);
  });

  spotifyPlayer.addListener('ready', async ({ device_id }) => {
    updateStatus('Player ready!');
    deviceId = device_id;

    try {
      await fetch('https://api.spotify.com/v1/me/player', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          device_ids: [device_id],
          play: false
        })
      });

      if (playBtn) playBtn.disabled = false;
      updateStatus('Ready to play!');

    } catch (err) {
      updateStatus('Device activation failed', true);
    }
  });

  spotifyPlayer.addListener('player_state_changed', state => {
    if (!state) return;

    const isPlaying = !state.paused;

    if (!userPausedManually || isPlaying) {
      if (playBtn) playBtn.classList.toggle('hidden', isPlaying);
      if (pauseBtn) pauseBtn.classList.toggle('hidden', !isPlaying);
      if (resumeBtn) resumeBtn.classList.add('hidden');
    }

    if (state.track_window.current_track) {
      const track = state.track_window.current_track;
      const position = Math.round(state.position / 1000);
      const duration = Math.round(state.duration / 1000);
      updateStatus(`${isPlaying ? 'Playing' : 'Paused'}: ${track.name} (${position}/${duration}s)`);
    }
  });

  spotifyPlayer.connect();
};

async function playTestTrack() {
  if (!deviceId) {
    updateStatus('Player not ready', true);
    return;
  }

  try {
    if (spotifyPlayer && spotifyPlayer.activateElement) {
      await spotifyPlayer.activateElement();
    }

    updateStatus('Starting playback...');

    const response = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ uris: [TEST_TRACK_URI] })
    });

    if (response.ok) {
      updateStatus('Playing!');
    } else {
      updateStatus('Play failed', true);
    }

  } catch (error) {
    updateStatus(`Error: ${error.message}`, true);
  }
}

async function pauseTrack() {
  if (spotifyPlayer) {
    userPausedManually = true;

    if (pauseBtn) pauseBtn.classList.add('hidden');
    if (resumeBtn) resumeBtn.classList.remove('hidden');

    await spotifyPlayer.pause();
    updateStatus('Paused');
  }
}

window.pauseTrack = pauseTrack;

async function resumeTrack() {
  if (spotifyPlayer) {
    userPausedManually = false;

    await spotifyPlayer.resume();

    if (resumeBtn) resumeBtn.classList.add('hidden');
    if (pauseBtn) pauseBtn.classList.remove('hidden');

    updateStatus('Resumed');
  }
}

window.resumeTrack = resumeTrack;

async function logoutSpotify() {
  if (spotifyPlayer) {
    try {
      await spotifyPlayer.disconnect();
    } catch (e) {}
    spotifyPlayer = null;
    window.spotifyPlayer = null;
  }

  sessionStorage.removeItem('spotify_access_token');
  accessToken = null;
  deviceId = null;

  if (logoutBtn) logoutBtn.classList.add('hidden');
  if (playBtn) playBtn.classList.add('hidden');
  if (pauseBtn) pauseBtn.classList.add('hidden');
  if (resumeBtn) resumeBtn.classList.add('hidden');
  if (musicBar) musicBar.classList.add('hidden');
  if (spotifyLoginSection) spotifyLoginSection.classList.remove('hidden');

  updateStatus('Logged out');
}

function showPlayerOnly() {
  if (spotifyLoginSection) spotifyLoginSection.classList.add('hidden');
  if (musicBar) musicBar.classList.remove('hidden');
  updateStatus('No track playing');
}

function showSpotifyLoginOption() {
  if (spotifyLoginSection) spotifyLoginSection.classList.remove('hidden');
  updateStatus('Connect Spotify for music');
}

function setupEventListeners() {
  if (spotifyLoginBtn) spotifyLoginBtn.addEventListener('click', loginWithSpotify);
  if (skipSpotifyBtn) skipSpotifyBtn.addEventListener('click', showPlayerOnly);
  if (playBtn) playBtn.addEventListener('click', playTestTrack);
  if (pauseBtn) pauseBtn.addEventListener('click', pauseTrack);
  if (resumeBtn) resumeBtn.addEventListener('click', resumeTrack);
  if (logoutBtn) logoutBtn.addEventListener('click', logoutSpotify);

  // Mobile control event listeners
  const mobileLeftBtn = document.getElementById('mobile-left');
  const mobileRightBtn = document.getElementById('mobile-right');
  const mobileUpBtn = document.getElementById('mobile-up');
  const mobileDownBtn = document.getElementById('mobile-down');
  const mobileCharBtn = document.getElementById('mobile-char-btn');
  const mobileCharLabel = document.getElementById('mobile-char');

  if (mobileLeftBtn) {
    mobileLeftBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (window.gameScene) window.gameScene.mobileControls.left = true;
    });
    mobileLeftBtn.addEventListener('touchend', (e) => {
      e.preventDefault();
      if (window.gameScene) window.gameScene.mobileControls.left = false;
    });
    mobileLeftBtn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      if (window.gameScene) window.gameScene.mobileControls.left = true;
    });
    mobileLeftBtn.addEventListener('mouseup', (e) => {
      e.preventDefault();
      if (window.gameScene) window.gameScene.mobileControls.left = false;
    });
  }

  if (mobileRightBtn) {
    mobileRightBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (window.gameScene) window.gameScene.mobileControls.right = true;
    });
    mobileRightBtn.addEventListener('touchend', (e) => {
      e.preventDefault();
      if (window.gameScene) window.gameScene.mobileControls.right = false;
    });
    mobileRightBtn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      if (window.gameScene) window.gameScene.mobileControls.right = true;
    });
    mobileRightBtn.addEventListener('mouseup', (e) => {
      e.preventDefault();
      if (window.gameScene) window.gameScene.mobileControls.right = false;
    });
  }

  if (mobileUpBtn) {
    mobileUpBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (window.gameScene) window.gameScene.mobileControls.up = true;
    });
    mobileUpBtn.addEventListener('touchend', (e) => {
      e.preventDefault();
      if (window.gameScene) window.gameScene.mobileControls.up = false;
    });
    mobileUpBtn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      if (window.gameScene) window.gameScene.mobileControls.up = true;
    });
    mobileUpBtn.addEventListener('mouseup', (e) => {
      e.preventDefault();
      if (window.gameScene) window.gameScene.mobileControls.up = false;
    });
  }

  if (mobileDownBtn) {
    mobileDownBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (window.gameScene) window.gameScene.mobileControls.down = true;
    });
    mobileDownBtn.addEventListener('touchend', (e) => {
      e.preventDefault();
      if (window.gameScene) window.gameScene.mobileControls.down = false;
    });
    mobileDownBtn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      if (window.gameScene) window.gameScene.mobileControls.down = true;
    });
    mobileDownBtn.addEventListener('mouseup', (e) => {
      e.preventDefault();
      if (window.gameScene) window.gameScene.mobileControls.down = false;
    });
  }

  if (mobileCharBtn) {
    mobileCharBtn.addEventListener('click', () => {
      if (window.gameScene) {
        window.gameScene.cycleCharacter();
        if (mobileCharLabel) {
          const charNames = ['Punk Rocker', 'Skater', 'Goth', 'Raver', 'Grunge'];
          mobileCharLabel.textContent = charNames[window.gameScene.currentCharacter] || 'Character';
        }
      }
    });
  }
}

// Initialize
window.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();

  // Start the Phaser game
  const game = new Phaser.Game(GameConfig);

  game.events.on('ready', () => {
    window.gameScene = game.scene.getScene('GameScene');

    // Connect university dropdown to game
    const universitySelect = document.getElementById('university');
    if (universitySelect && window.gameScene) {
      // Set initial value
      window.gameScene.selectedUniversity = universitySelect.value;

      // Listen for changes
      universitySelect.addEventListener('change', (e) => {
        if (window.gameScene) {
          window.gameScene.selectedUniversity = e.target.value;
          // Reset the frat row for the new university
          window.gameScene.fratRowHouses = [];
          window.gameScene.burnedHouses.clear();
        }
      });
    }
  });

  // Handle OAuth callback
  if (window.location.search.includes('code=')) {
    handleCallback();
    return;
  }

  // Check for existing session
  const savedToken = sessionStorage.getItem('spotify_access_token');
  if (savedToken) {
    accessToken = savedToken;
    updateStatus('Found saved session...');
    getUserInfo();
  } else {
    showSpotifyLoginOption();
  }
});
