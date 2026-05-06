// Util — shared helpers
window.FP = window.FP || {};
FP.util = {
  clamp: (v, lo, hi) => Math.max(lo, Math.min(hi, v)),
  lerp: (a, b, t) => a + (b - a) * t,
  rand: (a, b) => a + Math.random() * (b - a),
  randInt: (a, b) => Math.floor(a + Math.random() * (b - a + 1)),
  pick: (arr) => arr[Math.floor(Math.random() * arr.length)],
  dist: (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1),
  ease: {
    outCubic: t => 1 - Math.pow(1 - t, 3),
    outBack: t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t-1, 3) + c1 * Math.pow(t-1, 2); },
  },
};

// Greek letter abbreviator
FP.greekAbbr = (name) => {
  const map = { Alpha:'Α',Beta:'Β',Gamma:'Γ',Delta:'Δ',Epsilon:'Ε',Zeta:'Ζ',Eta:'Η',Theta:'Θ',
    Iota:'Ι',Kappa:'Κ',Lambda:'Λ',Mu:'Μ',Nu:'Ν',Xi:'Ξ',Omicron:'Ο',Pi:'Π',Rho:'Ρ',Sigma:'Σ',
    Tau:'Τ',Upsilon:'Υ',Phi:'Φ',Chi:'Χ',Psi:'Ψ',Omega:'Ω' };
  return name.split(' ').map(w => map[w] || (w === 'Order' ? '' : w[0])).join('');
};

FP.UNIVERSITIES = {
  'USC': ['Sigma Chi','Pi Kappa Alpha','Sigma Alpha Epsilon','Phi Delta Theta','Beta Theta Pi','Kappa Sigma','Lambda Chi Alpha','Theta Chi','Delta Tau Delta','Sigma Phi Epsilon','Phi Kappa Psi','Zeta Beta Tau','Sigma Nu','Delta Chi','Alpha Tau Omega','Kappa Alpha Order','Alpha Epsilon Pi'],
  'UCLA': ['Sigma Chi','Phi Delta Theta','Theta Chi','Sigma Alpha Epsilon','Beta Theta Pi','Phi Gamma Delta','Lambda Chi Alpha','Sigma Nu','Pi Kappa Phi','Zeta Psi','Delta Tau Delta','Sigma Phi Epsilon','Phi Kappa Psi','Theta Delta Chi','Zeta Beta Tau','Alpha Epsilon Pi'],
  'UC Berkeley': ['Chi Phi','Delta Kappa Epsilon','Sigma Chi','Phi Gamma Delta','Sigma Alpha Epsilon','Pi Kappa Alpha','Beta Theta Pi','Theta Chi','Sigma Phi Epsilon','Kappa Sigma','Delta Tau Delta','Phi Kappa Psi','Lambda Chi Alpha','Sigma Nu','Zeta Psi','Psi Upsilon'],
  'University of Texas': ['Sigma Chi','Phi Gamma Delta','Phi Delta Theta','Pi Kappa Alpha','Sigma Alpha Epsilon','Beta Theta Pi','Lambda Chi Alpha','Sigma Phi Epsilon','Delta Tau Delta','Tau Kappa Epsilon','Kappa Sigma','Phi Kappa Psi','Theta Chi','Delta Chi','Zeta Beta Tau'],
  'University of Michigan': ['Sigma Chi','Phi Delta Theta','Beta Theta Pi','Sigma Alpha Epsilon','Pi Kappa Alpha','Phi Gamma Delta','Theta Chi','Delta Tau Delta','Lambda Chi Alpha','Kappa Sigma','Phi Kappa Psi','Sigma Phi Epsilon','Zeta Psi','Psi Upsilon','Chi Phi','Theta Xi'],
};
