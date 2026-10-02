// ══ LE CRÉATEUR, RECONNU PAR SON UID ET NON PAR SON ADRESSE (01/10/2026) ══
//
// Une adresse e-mail n'identifie pas un compte : un compte Google, Apple ou
// lié peut porter la même adresse sous un autre UID, et une adresse se saisit
// sans être prouvée. Les droits d'administration se fondent donc sur l'UID
// Firebase du compte créateur (console Firebase → Authentication → colonne
// « UID utilisateur ») ET sur une adresse vérifiée, lue dans le jeton signé
// par Google.
//
// ⚠ UNE SEULE CONSTANTE, RECOPIÉE MOT POUR MOT dans database.rules.json
//   (`auth.uid === '<UID>' && auth.token.email_verified === true`).
//   scripts/verif/regles.mjs vérifie que chaque `auth.uid === '…'` des
//   règles vaut exactement CREATEUR_UID, et REFUSE de laisser déployer tant
//   qu'elle vaut le texte de remplacement ci-dessous : des règles déployées
//   avec lui ne reconnaîtraient plus personne comme créateur.
//
// Pour la poser : remplacer la valeur ici, puis
//   node scripts/poser_uid_createur.mjs
// qui la recopie dans les règles.
export const UID_A_POSER = 'UID_CREATEUR_A_POSER';
export const CREATEUR_UID = 'UID_CREATEUR_A_POSER';

// L'appelant (jeton vérifié par appels.js : {email, uid, emailVerifie}) est-il
// le créateur ? L'UID ET l'adresse vérifiée, jamais l'adresse seule.
export function estCreateur(auth) {
  return reconnaitCreateur(CREATEUR_UID)(auth);
}
// La même règle pour un UID donné (tests, et tant que la constante attend).
export function reconnaitCreateur(uid) {
  return (auth) => !!auth && !!uid && uid !== UID_A_POSER && auth.uid === uid && auth.emailVerifie === true;
}
