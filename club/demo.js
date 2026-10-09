/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion (Fitness Park Niort). Tous droits réservés. Logiciel protégé (CPI art. L111-1, L112-2, L335-2) : toute reproduction, même partielle, est interdite. */
'use strict';
// ══ FIT PULSE — mode démonstration (?demo=1) ═════════════════════════════
//
// Pour montrer l'appli a un prospect sans donnees reelles ni marque :
//  - aucune base Firebase (config.js laisse FITPULSE_CONFIG.firebase a null) ;
//  - tout ce que l'appli range dans le navigateur passe par UNE seule cle,
//    fp_demo : les vraies cles (fitpulse.v1, session, theme…) ne sont ni lues
//    ni modifiees ;
//  - jeu de donnees fictif genere par seedDemo() (demoState), connexion d'office ;
//  - bandeau fixe « Donnees fictives de demonstration » et bouton pour sortir ;
//  - ni logo ni nom de l'enseigne a l'ecran.
// L'adresse garde ?demo=1 : recharger la page reste en demonstration.

const DEMO = !!CFG.demo;
const DEMO_KEY = CFG.capture ? 'fp_capture' : 'fp_demo';
const DEMO_USER = 'u1'; // Directeur Démo

if (DEMO) {
  // Stockage cloisonne : un objet { cle: valeur } serialise sous fp_demo.
  let mem = null;
  const load = () => { if (mem) return mem; try { mem = JSON.parse(localStorage.getItem(DEMO_KEY) || '{}') || {}; } catch (e) { mem = {}; } return mem; };
  const save = () => { try { localStorage.setItem(DEMO_KEY, JSON.stringify(mem)); return true; } catch (e) { return false; } };
  safeLS.get = k => { const v = load()[k]; return v == null ? null : v; };
  safeLS.set = (k, v) => { load()[k] = String(v); return save(); };
  safeLS.del = k => { if (k in load()) { delete mem[k]; save(); } };
  APP.tagline = TXT.app.accroche;
  if (!CFG.capture) document.documentElement.classList.add('is-demo');
  else try { localStorage.removeItem(DEMO_KEY); } catch (e) { /* rien */ } // capture : jeu neuf à chaque chargement
}

// Reinitialiser : la demo repart de zero (memes donnees), sans quitter le mode demo.
function demoReset() { try { localStorage.removeItem(DEMO_KEY); } catch (e) { /* rien */ } location.reload(); }
// Sortie : la copie de demonstration est effacee, l'adresse perd ?demo=1.
function demoQuit() {
  try { localStorage.removeItem(DEMO_KEY); } catch (e) { /* rien */ }
  const q = new URLSearchParams(location.search); q.delete('demo');
  location.replace(location.pathname + (q.toString() ? '?' + q : ''));
}

// ── Jeu de donnees fictif ─────────────────────────────────────────────────
// La demo vendeur « Club Horizon » (demoState, core.js) : graine fixe, la meme
// demo a chaque chargement.
function seedDemo() { return CFG.capture ? captureState() : demoState(); }

// Demarrage en demonstration : donnees fictives si besoin, connexion d'office.
function demoStart() {
  if (CFG.capture || !S || !S.meta || S.meta.demoSeed !== DEMO_GRAINE || S.meta.capture) { S = normalizeState(seedDemo()); backend.replaceAll(); }
  if (!safeLS.get(SESSION_KEY) || !S.users[safeLS.get(SESSION_KEY)]) safeLS.set(SESSION_KEY, DEMO_USER);
  // Relève de la boîte accueil : toujours récente en démonstration (heure du chargement).
  const ms = deepGet(S, ['clubs', DEMO_CLUB.id, 'mailSync']); if (ms && !CFG.capture) ms.at = Date.now() - 25 * 60000;
}

// ── Bandeau fixe (pas en mode capture) ────────────────────────────────────
if (DEMO && !CFG.capture) {
  const bar = document.createElement('div');
  bar.id = 'demo-bar'; bar.setAttribute('role', 'status');
  bar.innerHTML = '<b>Données fictives de démonstration</b><button type="button" class="btn sm" data-demo="reset">Réinitialiser la démo</button><button type="button" class="btn sm" data-demo="quit">Quitter la démo</button>';
  bar.querySelector('[data-demo=quit]').addEventListener('click', demoQuit);
  bar.querySelector('[data-demo=reset]').addEventListener('click', demoReset);
  document.body.prepend(bar);
}

if (DEMO) {
  document.title = 'Fit Pulse · démonstration';
  const meta = document.querySelector('meta[name=description]'); if (meta) meta.setAttribute('content', 'Fit Pulse : le suivi commercial des clubs.');
}
