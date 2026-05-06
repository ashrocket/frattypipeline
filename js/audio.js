// Web Audio synth — chunky punchy SFX, no assets.
window.FP = window.FP || {};
(() => {
  let ctx = null;
  let muted = false;
  function get() {
    if (!ctx) {
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; }
    }
    return ctx;
  }
  function env(g, t, a, d, s, r, peak = 0.3, sus = 0.0) {
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.linearRampToValueAtTime(sus, t + a + d);
    g.gain.linearRampToValueAtTime(0, t + a + d + r);
  }
  function tone({ type='square', freq=440, freq2=null, dur=0.12, peak=0.18, a=0.005, d=0.03, r=0.05 }) {
    const c = get(); if (!c || muted) return;
    const t = c.currentTime;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (freq2 != null) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq2), t + dur);
    o.connect(g); g.connect(c.destination);
    env(g, t, a, d, dur, r, peak);
    o.start(t); o.stop(t + dur + r + 0.05);
  }
  function noise({ dur=0.15, peak=0.15, hp=200 }) {
    const c = get(); if (!c || muted) return;
    const t = c.currentTime;
    const buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = c.createBufferSource(); src.buffer = buf;
    const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp;
    const g = c.createGain(); g.gain.value = peak;
    src.connect(f); f.connect(g); g.connect(c.destination);
    src.start(t); src.stop(t + dur);
  }
  FP.audio = {
    resume() { const c = get(); if (c && c.state === 'suspended') c.resume(); },
    setMuted(v) { muted = v; },
    pickup() { tone({ freq: 660, freq2: 990, dur: 0.08, type: 'square', peak: 0.12 }); },
    bigPickup() { tone({ freq: 440, freq2: 880, dur: 0.12, type: 'square', peak: 0.16 }); tone({ freq: 880, freq2: 1320, dur: 0.1, peak: 0.1, a: 0.01 }); },
    step() { tone({ freq: 220, dur: 0.04, type: 'triangle', peak: 0.05 }); },
    dash() { tone({ freq: 220, freq2: 880, dur: 0.2, type: 'sawtooth', peak: 0.14 }); noise({ dur: 0.18, peak: 0.08 }); },
    hit() { tone({ freq: 180, freq2: 60, dur: 0.2, type: 'sawtooth', peak: 0.2 }); noise({ dur: 0.15, peak: 0.15 }); },
    burn() {
      tone({ freq: 80, freq2: 40, dur: 0.5, type: 'sawtooth', peak: 0.22 });
      tone({ freq: 160, freq2: 80, dur: 0.4, type: 'square', peak: 0.15 });
      noise({ dur: 0.6, peak: 0.18, hp: 100 });
    },
    cig() { tone({ freq: 880, freq2: 1760, dur: 0.18, type: 'square', peak: 0.16 }); tone({ freq: 1320, freq2: 2640, dur: 0.16, type: 'triangle', peak: 0.1, a: 0.04 }); },
    transform() { tone({ freq: 800, freq2: 200, dur: 0.4, type: 'sawtooth', peak: 0.2 }); noise({ dur: 0.4, peak: 0.12 }); },
    powerup() { tone({ freq: 330, freq2: 990, dur: 0.25, type: 'square', peak: 0.16 }); },
    combo(level) { tone({ freq: 440 + level * 80, dur: 0.06, type: 'square', peak: 0.1 }); },
    gameover() { tone({ freq: 300, freq2: 80, dur: 0.6, type: 'sawtooth', peak: 0.2 }); },
    boom() { tone({ freq: 100, freq2: 30, dur: 0.4, type: 'sawtooth', peak: 0.25 }); noise({ dur: 0.5, peak: 0.2, hp: 60 }); },
  };
})();
