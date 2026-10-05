// ══ CONFIGURATION FIT PULSE ══════════════════════════════════════════════
//
// MODE PARTAGE (site en ligne fitpulse-niort.web.app) : toute l'equipe lit et
// ecrit la meme base Firebase (projet repcore-sync, noeud /pulse). On se
// connecte avec son e-mail + son code personnel, depuis n'importe quel
// appareil. Les regles d'acces sont posees par club/outils/fitpulse-serveur.mjs.
//
// MODE LOCAL (fichier ouvert en local, tests, ou ?demo=1) : les donnees vivent
// dans le navigateur, chaque appareil a sa propre copie.
(function () {
  const h = location.hostname, q = new URLSearchParams(location.search);
  const enLigne = /\.(web\.app|firebaseapp\.com)$/.test(h) || q.get('partage') === '1';
  window.PARKPULSE_FIREBASE = enLigne && q.get('demo') !== '1' ? {
    apiKey: 'AIzaSyDQ_9jqpYMD6_32LRz1s7xyJOvEUPyr9K0',
    authDomain: 'repcore-sync.firebaseapp.com',
    databaseURL: 'https://repcore-sync-default-rtdb.firebaseio.com',
    projectId: 'repcore-sync',
  } : null;
})();

// Envoi AUTOMATIQUE du bel e-mail d'invitation a la creation d'un code
// (.github/workflows/fitpulse-mail.yml, toutes les 5 minutes). GitHub ne lance
// les taches programmees que depuis la branche main : a passer a true une fois
// ce workflow present sur main. En attendant, le bouton « Envoyer par e-mail »
// de la fenetre du code ouvre l'invitation prete a partir.
window.PARKPULSE_MAIL_AUTO = false;

// ══ COMPTES DE DEPART ═════════════════════════════════════════════════════
// Crees automatiquement au premier lancement (et ajoutes a une base existante
// s'ils manquent). Seule l'EMPREINTE du code est ici (SHA-256 sale) : le code
// lui-meme n'est ecrit nulle part dans le depot. bootKey = SHA-256(e-mail|code),
// la cle de connexion en mode partage (ouvre /pulse_boot, voir core.js). Pour changer un code : Mon
// profil > Securite, ou un createur depuis Membres.
window.PARKPULSE_CLUB = { id: 'niort', name: 'Fitness Park Niort', address: '600 Av. de Paris', city: '79000 Niort' };
window.PARKPULSE_ACCOUNTS = [
  { id: 'kg-createur', first: 'Kévin', last: 'GUELLEC', email: 'guellec.coachingpro@gmail.com', role: 'createur', salt: 'c1e2c0f885e88133', codeHash: '18c5a02277b8bab8d72fa5eb511ae202b15025f066067d09208c3c4210c7b358', bootKey: 'bcb94d3b291bacdcdff6c95889640de19eca876a' },
  { id: 'kg-manager', first: 'Kévin', last: 'GUELLEC', email: 'guellec.coachingpro@gmail.com', role: 'manager', salt: 'd8a29558ba1fbce4', codeHash: '223ecb32cf76b5fe1560af2119eaf86285531e09858aee8b5f59c862142e7440', bootKey: 'b6b8b10beaaa9ffe3dd08b5d97efe10de1c6fd04' },
];

// ══ VISUELS ═══════════════════════════════════════════════════════════════
// Images d'ambiance (Canva) et logo officiel du club. Pour passer en haute
// définition : exporter les images depuis Canva et remplacer les fichiers de
// club/assets/ sous le même nom. logo : null pour n'afficher que Fit Pulse.
window.PARKPULSE_ASSETS = {
  wordmark: 'assets/fitpulse-logo.png',
  icon: 'favicon.png',
  banner: 'assets/hero-banner.jpg',
  login: 'assets/hero-login.jpg',
  logo: 'assets/logo-fitness-park.svg',
};
