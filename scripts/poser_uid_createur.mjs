// Recopie CREATEUR_UID (cloudflare/src/createur.js) dans database.rules.json,
// à chaque `auth.uid === '…'`. Une seule source : on change la constante,
// on lance ce script, et scripts/verif/regles.mjs confirme.
//   node scripts/poser_uid_createur.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const src = readFileSync('cloudflare/src/createur.js', 'utf8');
const m = src.match(/export const CREATEUR_UID = '([^']*)';/);
const a = src.match(/export const UID_A_POSER = '([^']*)';/);
if (!m) { console.error('CREATEUR_UID introuvable dans cloudflare/src/createur.js'); process.exit(1); }
const uid = m[1];
if (a && uid === a[1]) { console.error('CREATEUR_UID vaut encore le texte de remplacement : pose d’abord l’UID (console Firebase → Authentication).'); process.exit(1); }
// Un UID Firebase : 1 à 128 caractères, sans apostrophe ni barre (ceux de la
// console font 28 caractères alphanumériques).
if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid)) { console.error('UID mal formé : ' + JSON.stringify(uid)); process.exit(1); }
const regles = readFileSync('database.rules.json', 'utf8');
let n = 0;
const sortie = regles.replace(/auth\.uid === '[^']*'/g, () => { n++; return "auth.uid === '" + uid + "'"; });
if (!n) { console.error('aucune condition auth.uid dans les règles'); process.exit(1); }
writeFileSync('database.rules.json', sortie);
console.log(n + ' condition(s) posée(s) sur l’UID ' + uid.slice(0, 4) + '…');
