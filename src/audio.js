export class GameAudio {
  constructor(onStatus) {
    this.onStatus = onStatus; this.muted = false; this.started = false; this.ctx = null;
    this.track = new Audio(); this.track.loop = true; this.track.volume = .58;
    this.hasTrack = false; this.step = 0; this.lastBeat = 0;
    fetch('/audio/fratty-pipeline.mp3', { method: 'HEAD' }).then(r => {
      this.hasTrack = r.ok && /audio|octet-stream/.test(r.headers.get('content-type') || ''); if(this.hasTrack)this.track.src='/audio/fratty-pipeline.mp3'; this.status();
      if (this.started && this.hasTrack) this.track.play().catch(() => { this.onStatus('Tap sound to start the track'); });
    }).catch(() => this.status());
    this.track.addEventListener('error', () => { this.hasTrack = false; this.status(); });
    this.status();
  }
  status() { this.onStatus(this.muted ? 'SOUND OFF' : this.hasTrack ? 'FRATTY PIPELINE · ON REPEAT' : 'DEMO INSTRUMENTAL · ON REPEAT'); }
  start() {
    this.started = true;
    try { this.ctx ||= new (window.AudioContext || window.webkitAudioContext)(); this.ctx.resume(); } catch { /* Music can still play without Web Audio. */ }
    if (this.hasTrack && !this.muted) this.track.play().catch(() => this.onStatus('TAP SOUND TO PLAY MUSIC'));
    this.status();
  }
  toggle() { this.muted = !this.muted; this.track.muted = this.muted; this.start(); this.status(); return this.muted; }
  tone(frequency, length = .1, type = 'triangle', gain = .04, when = 0) {
    if (!this.ctx || this.muted) return;
    const at = this.ctx.currentTime + when, osc = this.ctx.createOscillator(), amp = this.ctx.createGain();
    osc.type = type; osc.frequency.value = frequency; amp.gain.setValueAtTime(0, at);
    amp.gain.linearRampToValueAtTime(gain, at + .005); amp.gain.exponentialRampToValueAtTime(.001, at + length);
    osc.connect(amp); amp.connect(this.ctx.destination); osc.start(at); osc.stop(at + length + .02);
    osc.onended = () => { osc.disconnect(); amp.disconnect(); };
  }
  tick() {
    if (!this.started || !this.ctx || this.muted || this.hasTrack || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    if (now - this.lastBeat < .1172) return; this.lastBeat = now;
    const n = this.step++ % 128, root = [82.41, 110, 65.41, 98][Math.floor(n / 32)];
    if (n % 2 === 0) { this.tone(root, .14, 'sawtooth', .025); this.tone(root * 1.5, .11, 'sawtooth', .01); }
    if (n % 8 === 0 || n % 8 === 3) this.tone(52, .14, 'sine', .1);
    if (n % 8 === 4) { this.tone(170, .065, 'triangle', .07); this.tone(1800, .03, 'sawtooth', .01); }
    this.tone(n % 2 ? 7000 : 9000, .018, 'square', .004);
    if (n % 4 === 2) this.tone(root * [4, 6, 4, 8][Math.floor(n / 4) % 4], .13, 'triangle', .025);
  }
  effect(type) {
    const notes = { throw: [350,.07], impact: [80,.18], burn: [65,.4], hit: [120,.2], pickup: [880,.13], coffee: [740,.16], trick: [1100,.18], ollie: [380,.12], land: [85,.08], dash: [250,.12], reborn: [660,.3], won: [880,.4], transform: [200,.6] };
    if (notes[type]) this.tone(...notes[type], type === 'burn' ? 'sawtooth' : 'triangle', .075);
    if (['won','reborn','burn'].includes(type)) { this.tone(440,.15,'triangle',.05,.1); this.tone(660,.2,'triangle',.05,.25); }
  }
}
