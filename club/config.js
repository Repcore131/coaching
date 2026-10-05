// ══ CONFIGURATION FIT PULSE ══════════════════════════════════════════════
//
// MODE LOCAL (par defaut, PARKPULSE_FIREBASE = null) : les donnees vivent dans
// le navigateur qui ouvre la page. Parfait pour essayer, mais chaque appareil
// a sa propre copie : l'equipe ne partage rien.
//
// MODE PARTAGE : renseigner ici la configuration web d'un projet Firebase
// (console Firebase > Parametres du projet > Vos applications > Config) et
// deployer les regles de club/database.rules.pulse.json. Toute l'equipe lit
// et ecrit alors la meme base, et SEULES les adresses listees dans
// /pulse/team y ont acces : aucun autre club, aucun editeur tiers.
//
// window.PARKPULSE_FIREBASE = {
//   apiKey: '...',
//   authDomain: '....firebaseapp.com',
//   databaseURL: 'https://....firebasedatabase.app',
//   projectId: '...',
// };
window.PARKPULSE_FIREBASE = null;

// ══ COMPTES DE DEPART ═════════════════════════════════════════════════════
// Crees automatiquement au premier lancement (et ajoutes a une base existante
// s'ils manquent). Seule l'EMPREINTE du code est ici (SHA-256 sale) : le code
// lui-meme n'est ecrit nulle part dans le depot. Pour changer un code : Mon
// profil > Securite, ou un createur depuis Membres.
window.PARKPULSE_CLUB = { id: 'niort', name: 'Fitness Park Niort', address: '600 Av. de Paris', city: '79000 Niort' };
window.PARKPULSE_ACCOUNTS = [
  { id: 'kg-createur', first: 'Kévin', last: 'GUELLEC', email: 'guellec.coachingpro@gmail.com', role: 'createur', salt: 'c1e2c0f885e88133', codeHash: '18c5a02277b8bab8d72fa5eb511ae202b15025f066067d09208c3c4210c7b358' },
  { id: 'kg-manager', first: 'Kévin', last: 'GUELLEC', email: 'guellec.coachingpro@gmail.com', role: 'manager', salt: 'd8a29558ba1fbce4', codeHash: '223ecb32cf76b5fe1560af2119eaf86285531e09858aee8b5f59c862142e7440' },
];
