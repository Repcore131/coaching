/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion (Fitness Park Niort). Tous droits réservés. Logiciel protégé (CPI art. L111-1, L112-2, L335-2) : toute reproduction, même partielle, est interdite. */
// ══ CONFIGURATION FIT PULSE ══════════════════════════════════════════════
//
// MODE PARTAGE (site en ligne du club) : toute l'equipe lit et
// ecrit la meme base Firebase (projet repcore-sync, noeud /pulse). On se
// connecte avec son e-mail + son code personnel, depuis n'importe quel
// appareil. Les regles d'acces sont posees par club/outils/fitpulse-serveur.mjs.
//
// MODE MULTI-SALLES (docs/multi-salles.md) : ajouter multi: true et l'adresse d'une base en
// europe-west1 ; chaque société a son espace /orgs/{org}, la base historique /pulse n'est plus lue.
//
// MODE LOCAL (fichier ouvert en local, tests, ou ?demo=1) : les donnees vivent
// dans le navigateur, chaque appareil a sa propre copie.
// Tout passe par window.FITPULSE_CONFIG = { demo, firebase, mailAuto, assets } (lu par core.js : CFG).
const FITPULSE_CONFIG = window.FITPULSE_CONFIG = { demo: false, firebase: null, mailAuto: false, assets: {} };
(function () {
  const h = location.hostname, q = new URLSearchParams(location.search);
  const enLigne = /\.(web\.app|firebaseapp\.com)$/.test(h) || q.get('partage') === '1';
  // MODE DEMONSTRATION (?demo=1) : donnees fictives, aucune base, voir demo.js.
  FITPULSE_CONFIG.demo = q.get('demo') === '1';
  FITPULSE_CONFIG.firebase = enLigne && !FITPULSE_CONFIG.demo ? {
    apiKey: 'AIzaSyDQ_9jqpYMD6_32LRz1s7xyJOvEUPyr9K0',
    authDomain: 'repcore-sync.firebaseapp.com',
    databaseURL: 'https://repcore-sync-default-rtdb.firebaseio.com',
    projectId: 'repcore-sync',
  } : null;
  // Essais du mode multi-salles sur le simulateur Firebase, en local seulement :
  // http://localhost:8765/?emu=fitpulse-e2e (base et authentification simulées).
  if (/^(localhost|127\.0\.0\.1)$/.test(h) && /^[a-z0-9-]{3,40}$/.test(q.get('emu') || '')) {
    FITPULSE_CONFIG.firebase = { apiKey: 'demo-cle', projectId: 'demo-fitpulse', authDomain: 'localhost', databaseURL: `https://${q.get('emu')}.firebaseio.com`, multi: true, emulateurs: { db: ['127.0.0.1', 9000], auth: 'http://127.0.0.1:9099' } };
  }
})();

// Envoi AUTOMATIQUE du bel e-mail d'invitation a la creation d'un code
// (.github/workflows/fitpulse-mail.yml, toutes les 5 minutes). GitHub ne lance
// les taches programmees que depuis la branche main : a passer a true une fois
// ce workflow present sur main. En attendant, le bouton « Envoyer par e-mail »
// de la fenetre du code ouvre l'invitation prete a partir.
FITPULSE_CONFIG.mailAuto = false;

// ══ COMPTES DE DEPART ═════════════════════════════════════════════════════
// Aucun compte ni club dans le fichier livre : une base neuve est vide jusqu'au
// formulaire de creation (nom du club, enseigne, societe, couleur, premier
// manager). Les comptes de depart d'un deploiement donne sont dans
// tools/bootstrap.js, lu par le serveur (outils/fitpulse-serveur.mjs), jamais
// charge par le navigateur.

// ══ VISUELS ═══════════════════════════════════════════════════════════════
// Images d'ambiance (Canva). Le logo du club se regle dans Club et reglages. Pour passer en haute
// définition : exporter les images depuis Canva et remplacer les fichiers de
// club/assets/ sous le même nom. logo : null pour n'afficher que Fit Pulse.
FITPULSE_CONFIG.assets = {
  wordmark: 'assets/logo/fitpulse-horizontal-fond-sombre.svg',
  icon: 'favicon.png',
  banner: 'assets/hero-banner.jpg',
  login: 'assets/hero-login.jpg',
  logo: null, // logo du club : réglé par club (Club et réglages), aucun par défaut
};

// Demonstration : ni comptes reels, ni club reel, ni logo.
if (FITPULSE_CONFIG.demo) {
  FITPULSE_CONFIG.assets.logo = null;
  FITPULSE_CONFIG.mailAuto = false;
}
