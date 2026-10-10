/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion. Tous droits réservés. */
'use strict';
// ══ FIT PULSE : retours sensoriels (FX) ══════════════════════════════════
// Un seul module, gradué en 5 niveaux. Chaque retour combine un texte (toujours),
// une vibration (si prefs.sense.haptics et si l'appareil vibre) et un son (si
// prefs.sense.sound, coupé par défaut ; jamais page en arrière-plan, jamais
// avant un premier geste de l'utilisateur, donc jamais à l'ouverture).
//   tap    saisie simple        10 ms
//   step   étape franchie       [15, 40, 15, 40, 15]   son 80 ms
//   win    palier d'équipe      [30, 50, 40, 50, 60]   son 300 ms, célébration 1,8 s au plus
//   kudos  félicitation reçue   15 ms
//   error  erreur de formulaire [30, 60, 30]
// Animations réduites (prefers-reduced-motion ou prefs.sense.motion = 'reduced') :
// aucune animation, le texte seul.
const FX_VIBRATIONS = { tap: 10, step: [15, 40, 15, 40, 15], win: [30, 50, 40, 50, 60], kudos: 15, error: [30, 60, 30] };
// Notes (Hz) et durée totale (ms) de chaque son.
const FX_SONS = { tap: [[660], 60], step: [[660, 880], 80], win: [[523, 659, 784], 300], kudos: [[784, 988], 80], error: [[247, 196], 120] };
const FX_VOLUME = 0.15;
const FX_WIN_MS = 1800;
let FX_GESTE = false; // un son ne joue qu'après un premier geste (jamais à l'ouverture)
['pointerdown', 'keydown'].forEach(t => document.addEventListener(t, () => { FX_GESTE = true; }, { capture: true, passive: true }));
let FX_AUDIO = null;
const FX_JOURNAL = [];

function fxSens() { try { return (ME && typeof prefsOf === 'function' ? prefsOf().sense : null) || { haptics: true, sound: false, motion: 'auto' }; } catch (_) { return { haptics: true, sound: false, motion: 'auto' }; } }
function fxMouvementReduit() {
  if (fxSens().motion === 'reduced') return true;
  try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (_) { return false; }
}
function fxVibrer(niveau) {
  const s = fxSens(); if (!s.haptics || typeof navigator === 'undefined' || !navigator.vibrate) return false;
  try { navigator.vibrate(FX_VIBRATIONS[niveau]); return true; } catch (_) { return false; }
}
function fxSon(niveau) {
  const s = fxSens(); if (!s.sound || !FX_GESTE || (typeof document !== 'undefined' && document.hidden)) return false;
  try {
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return false; FX_AUDIO = FX_AUDIO || new C();
    const [notes, ms] = FX_SONS[niveau]; const pas = ms / 1000 / notes.length; const t0 = FX_AUDIO.currentTime;
    notes.forEach((f, i) => {
      const o = FX_AUDIO.createOscillator(); const g = FX_AUDIO.createGain(); o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(FX_VOLUME, t0 + i * pas); g.gain.exponentialRampToValueAtTime(0.0001, t0 + (i + 1) * pas);
      o.connect(g); g.connect(FX_AUDIO.destination); o.start(t0 + i * pas); o.stop(t0 + (i + 1) * pas);
    });
    return true;
  } catch (_) { return false; }
}
function fxJouer(niveau, texte) {
  const r = { niveau, texte: texte || '', vibre: fxVibrer(niveau), son: fxSon(niveau), anime: !fxMouvementReduit(), at: Date.now() };
  FX_JOURNAL.push(r); if (FX_JOURNAL.length > 30) FX_JOURNAL.shift();
  return r;
}
// Bandeau d'étape (texte annoncé, sans animation si mouvement réduit).
function fxBandeau(t, ms = 1600) {
  if (typeof CFG !== 'undefined' && CFG.capture) return;
  const el = document.createElement('div'); el.className = 'step-banner'; el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite'); el.textContent = t;
  document.body.appendChild(el); setTimeout(() => el.remove(), ms);
}
// Célébration plein écran : role alert, fermée à Échap, au tap, et seule au bout de 1,8 s.
// Elle laisse passer le geste suivant (pointer-events: none hors de la carte).
let FX_CELEBRATION = null;
function fxFermerCelebration() { if (FX_CELEBRATION) { clearTimeout(FX_CELEBRATION.minuteur); FX_CELEBRATION.el.remove(); FX_CELEBRATION = null; } }
function fxCelebration(titre, sous, art = '') {
  fxFermerCelebration();
  if (typeof CFG !== 'undefined' && CFG.capture) return null;
  const reduit = fxMouvementReduit();
  const el = document.createElement('div'); el.className = 'celebrate' + (reduit ? ' fx-texte' : ''); el.setAttribute('role', 'alert');
  el.innerHTML = `<div class="celebrate-in card">${art && !reduit ? `<div class="cel-art" aria-hidden="true">${art}</div>` : ''}<div class="celebrate-t">${esc(titre)}</div><div class="celebrate-s">${esc(sous || '')}</div><div class="row" style="justify-content:center;gap:8px;margin-top:12px"><button class="btn sm cel-share" data-act="celShare">Partager au fil</button><button class="btn sm primary" data-cel-fermer>Fermer</button></div></div>`;
  el.dataset.title = titre; el.dataset.sub = sous || '';
  document.body.appendChild(el);
  FX_CELEBRATION = { el, minuteur: setTimeout(fxFermerCelebration, FX_WIN_MS) };
  return el;
}
document.addEventListener('keydown', e => { if (e.key === 'Escape' && FX_CELEBRATION) fxFermerCelebration(); });
document.addEventListener('pointerdown', e => {
  if (!FX_CELEBRATION) return;
  if (e.target.closest && e.target.closest('.cel-share')) return; // le bouton Partager garde la carte le temps du clic
  fxFermerCelebration();
}, true);

const fx = {
  // Saisie simple : la vibration courte, le texte vient du toast de la saisie.
  tap: texte => fxJouer('tap', texte),
  // Étape d'objectif franchie (25, 50, 75 %) : bandeau texte.
  step: texte => { const r = fxJouer('step', texte); if (texte) fxBandeau(texte); return r; },
  // Palier d'équipe : célébration (texte seul si mouvement réduit).
  win: (titre, sous = '', art = '') => { const r = fxJouer('win', sous ? `${titre} : ${sous}` : titre); fxCelebration(titre, sous, art); return r; },
  // Félicitation reçue : toast.
  kudos: texte => { const r = fxJouer('kudos', texte); if (texte) toast(texte); return r; },
  // Erreur de formulaire : toast et vibration double.
  error: texte => { const r = fxJouer('error', texte); if (texte) toast(texte); return r; },
};
// Compatibilité : anciens appels.
function vibrer(motif) { try { if (ME && fxSens().haptics && navigator.vibrate) navigator.vibrate(motif); } catch (_) { /* pas de vibreur */ } }
function bip(fort = false) { return fxSon(fort ? 'step' : 'tap'); }

// Champ invalide (validation du navigateur) : retour d'erreur et texte du champ.
document.addEventListener('invalid', e => {
  const c = e.target; if (!c || !c.closest || !c.closest('#app, #modal-root')) return;
  if (Date.now() - (fx._dernErr || 0) < 800) return; fx._dernErr = Date.now();
  const lib = (c.closest('label') && c.closest('label').querySelector('span') ? c.closest('label').querySelector('span').textContent : c.getAttribute('aria-label') || c.name || 'Champ').trim();
  fx.error(`${lib} : ${c.validationMessage || 'valeur à corriger'}`);
}, true);
