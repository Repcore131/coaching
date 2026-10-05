// ══ CONFIGURATION PARK PULSE ══════════════════════════════════════════════
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
