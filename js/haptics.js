// ─── Haptic + Motion engine ──────────────────────────────────────────────────
const Haptic = {
  _v: (p) => { try { navigator.vibrate?.(p); } catch (_) {} },
  tap:     function() { this._v(8); },
  soft:    function() { this._v(5); },
  medium:  function() { this._v(16); },
  heavy:   function() { this._v(30); },
  select:  function() { this._v(6); },
  success: function() { this._v([10, 50, 15]); },
  error:   function() { this._v([35, 25, 35]); },
};

const Motion = (() => {
  const cbs = [];
  let _g = 0, _b = 0, _active = false;
  const handle = (e) => { _g = e.gamma || 0; _b = e.beta || 0; cbs.forEach(f => f(_g, _b)); };
  const start = async () => {
    if (typeof DeviceOrientationEvent?.requestPermission === 'function') {
      if (await DeviceOrientationEvent.requestPermission() !== 'granted') return false;
    }
    window.addEventListener('deviceorientation', handle, { passive: true });
    _active = true;
    return true;
  };
  return {
    onTilt: (fn) => cbs.push(fn),
    start,
    get gamma() { return _g; },
    get beta() { return _b; },
    get active() { return _active; },
    needsPermission: () => typeof DeviceOrientationEvent?.requestPermission === 'function',
    isMobile: () => 'ontouchstart' in window,
  };
})();
