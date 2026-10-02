// La boutique (fiche publique / contenu vendu) et le catalogue d'exercices,
// sur l'ÉMULATEUR de la Realtime Database (pas dans `npm test`).
//   java -jar firebase-database-emulator-*.jar --port 9000
//   node cloudflare/test/regles-boutique.emu.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CREATEUR_UID } from '../src/createur.js';

const BASE = process.env.EMU || 'http://127.0.0.1:9000';
const NS = 'boutique' + Date.now().toString(36);
let ok = 0;
const test = async (nom, fn) => { await fn(); ok++; console.log('ok  ', nom); };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
// Le créateur se présente sous SON UID (createur.js) : les règles ne le
// reconnaissent plus à son adresse. Un autre UID se force par UID_FORCE.
const UID_FORCE = new Map();
const uidDe = (email) => UID_FORCE.get(email) || (email === 'guellec.coachingpro@gmail.com' ? CREATEUR_UID : email);
const jeton = (email, verifie = true) => b64({ alg: 'none', typ: 'JWT' }) + '.' + b64({ sub: uidDe(email), user_id: uidDe(email), email, email_verified: verifie,
  iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600, aud: NS, iss: 'https://securetoken.google.com/' + NS,
  firebase: { sign_in_provider: 'password' } }) + '.';
async function appel(qui, methode, chemin, corps, verifie) {
  const r = await fetch(BASE + '/' + chemin + '.json?ns=' + NS + (qui === 'owner' ? '' : '&auth=' + jeton(qui, verifie)), { method: methode,
    headers: Object.assign({ 'Content-Type': 'application/json' }, qui === 'owner' ? { Authorization: 'Bearer owner' } : {}),
    body: corps === undefined ? undefined : JSON.stringify(corps) });
  return { statut: r.status, corps: await r.text() };
}
const GRATUIT = 'gratuit@t.fr', ACHETEUR = 'acheteur@t.fr', TRICHE = 'triche@t.fr', COACH = 'coach@t.fr', CREA = 'guellec.coachingpro@gmail.com';
const K = (e) => e.replace(/\./g, ',');
const regles = readFileSync(new URL('../../database.rules.json', import.meta.url), 'utf8');
assert.equal((await fetch(BASE + '/.settings/rules.json?ns=' + NS, { method: 'PUT', headers: { Authorization: 'Bearer owner' }, body: regles })).status, 200);
const SEANCES = JSON.stringify({ H: [{ name: 'Push', exercises: [{ name: 'Développé couché' }] }] });
await appel('owner', 'PUT', '', {
  boutique: { p1: { nom: 'Programme 1', prixCts: 1490, accroche: 'Fort', aContenu: true, maj: 1 } },
  boutique_contenu: { p1: { seances: SEANCES, maj: 1 } },
  droits: { [K(ACHETEUR)]: { palier: 'aucun', echeance: 0, source: 'paypal', programmes: { p1: 1 } },
    [K(GRATUIT)]: { palier: 'aucun', echeance: 0, source: 'paypal' } },
  users: { [K(GRATUIT)]: { id: 'g', email: GRATUIT, role: 'athlete', updatedAt: 1 },
    [K(TRICHE)]: { id: 't', email: TRICHE, role: 'coach', updatedAt: 1 },
    [K(COACH)]: { id: 'c', email: COACH, role: 'coach', updatedAt: 1 } },
  coachs_registre: { [K(COACH)]: { plan: 'libre', le: 1 } },
  exercices: { squat: { nom: 'Squat' } } });

await test('CRITÈRE : GET /boutique.json avec un jeton gratuit ne renvoie aucun champ seances', async () => {
  const r = await appel(GRATUIT, 'GET', 'boutique');
  assert.equal(r.statut, 200);
  assert.ok(!/seances/.test(r.corps), 'seances présent : ' + r.corps.slice(0, 120));
  assert.equal(JSON.parse(r.corps).p1.prixCts, 1490, 'la fiche, elle, se lit');
});
await test('un compte gratuit ne lit pas boutique_contenu/<id> ; un acheteur le lit ; le créateur (adresse vérifiée) aussi', async () => {
  assert.equal((await appel(GRATUIT, 'GET', 'boutique_contenu/p1')).statut, 401);
  assert.equal((await appel(GRATUIT, 'GET', 'boutique_contenu')).statut, 401, 'ni le nœud entier');
  const a = await appel(ACHETEUR, 'GET', 'boutique_contenu/p1');
  assert.equal(a.statut, 200);
  assert.equal(JSON.parse(a.corps).seances, SEANCES);
  assert.equal((await appel(CREA, 'GET', 'boutique_contenu/p1')).statut, 200);
  assert.equal((await appel(CREA, 'GET', 'boutique_contenu/p1', undefined, false)).statut, 401, 'adresse non vérifiée');
});
await test('personne d’autre que le créateur n’écrit le contenu, ni ne s’accorde un achat', async () => {
  assert.equal((await appel(GRATUIT, 'PUT', 'boutique_contenu/p1', { seances: '[]', maj: 2 })).statut, 401);
  assert.equal((await appel(GRATUIT, 'PUT', 'droits/' + K(GRATUIT) + '/programmes/p1', 5)).statut, 401);
  assert.equal((await appel(GRATUIT, 'GET', 'boutique_contenu/p1')).statut, 401);
  assert.equal((await appel(CREA, 'PUT', 'boutique_contenu/p2', { seances: SEANCES, maj: 2 })).statut, 200);
});
await test('la fiche publique n’accepte plus de séances, même du créateur', async () => {
  assert.equal((await appel(CREA, 'PUT', 'boutique/p3', { nom: 'P3', prixCts: 990, seances: SEANCES })).statut, 401);
  assert.equal((await appel(CREA, 'PUT', 'boutique/p3', { nom: 'P3', prixCts: 990, aContenu: true, semaines: 8, niveau: 'Intermédiaire', maj: 3 })).statut, 200);
});
await test('exercices : un compte qui s’écrit role:"coach" ne lit pas le catalogue ; un coach au registre le lit', async () => {
  assert.equal((await appel(GRATUIT, 'PUT', 'users/' + K(GRATUIT) + '/role', 'coach')).statut, 401, 'le rôle est gelé');
  assert.equal((await appel(GRATUIT, 'GET', 'exercices')).statut, 401);
  // Un rôle « coach » posé AVANT le gel, sans registre : plus rien.
  assert.equal((await appel(TRICHE, 'GET', 'exercices')).statut, 401);
  assert.equal((await appel(COACH, 'GET', 'exercices')).statut, 200);
});
await test('CRITÈRE : l’adresse du créateur sous un AUTRE UID n’écrit pas /boutique ; le vrai UID, adresse vérifiée, l’écrit', async () => {
  const FICHE = { nom: 'Programme 9', prixCts: 1990, accroche: 'Solide', aContenu: false, maj: 9 };
  // Un compte Google, Apple ou lié qui porte la même adresse, adresse vérifiée.
  UID_FORCE.set(CREA, 'un-autre-uid-0000000000000000');
  assert.equal((await appel(CREA, 'PUT', 'boutique/p9', FICHE)).statut, 401);
  assert.equal((await appel(CREA, 'PUT', 'boutique_contenu/p9', { seances: SEANCES, maj: 9 })).statut, 401, 'ni le contenu vendu');
  assert.equal((await appel(CREA, 'PUT', 'droits/' + K(GRATUIT), { palier: 'ultime', echeance: 0, source: 'x' })).statut, 401, 'ni un droit');
  UID_FORCE.delete(CREA);
  // Le vrai UID, mais une adresse NON vérifiée : refusé aussi.
  assert.equal((await appel(CREA, 'PUT', 'boutique/p9', FICHE, false)).statut, 401);
  // Le vrai UID, adresse vérifiée : accepté.
  assert.equal((await appel(CREA, 'PUT', 'boutique/p9', FICHE)).statut, 200);
  assert.equal(JSON.parse((await appel('owner', 'GET', 'boutique/p9/nom')).corps), 'Programme 9');
});
console.log(ok + ' tests passés');
