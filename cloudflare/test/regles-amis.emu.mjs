// Les règles des amis (lot A) et de la revanche (lot B), sur l'ÉMULATEUR de
// la Realtime Database (pas dans `npm test` : il faut Java et l'émulateur).
//   java -jar firebase-database-emulator-*.jar --port 9000
//   node cloudflare/test/regles-amis.emu.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const BASE = process.env.EMU || 'http://127.0.0.1:9000';
const NS = 'amis' + Date.now().toString(36);
let ok = 0;
const test = async (nom, fn) => { await fn(); ok++; console.log('ok  ', nom); };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jeton = (email) => b64({ alg: 'none', typ: 'JWT' }) + '.' + b64({ sub: email, user_id: email, email, email_verified: true,
  iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600, aud: NS, iss: 'https://securetoken.google.com/' + NS,
  firebase: { sign_in_provider: 'password' } }) + '.';
async function appel(qui, methode, chemin, corps) {
  const r = await fetch(BASE + '/' + chemin + '.json?ns=' + NS + (qui === 'owner' ? '' : '&auth=' + jeton(qui)), { method: methode,
    headers: Object.assign({ 'Content-Type': 'application/json' }, qui === 'owner' ? { Authorization: 'Bearer owner' } : {}),
    body: corps === undefined ? undefined : JSON.stringify(corps) });
  return { statut: r.status, corps: await r.text() };
}
const LEA = 'lea@t.fr', TOM = 'tom@t.fr', ZOE = 'zoe@t.fr', K = (e) => e.replace(/\./g, ',');
const regles = readFileSync(new URL('../../database.rules.json', import.meta.url), 'utf8');
assert.equal((await fetch(BASE + '/.settings/rules.json?ns=' + NS, { method: 'PUT', headers: { Authorization: 'Bearer owner' }, body: regles })).status, 200);
await appel('owner', 'PUT', '', { pseudos: { lea: K(LEA), tom__fit: K(TOM), zoe: K(ZOE) } });

await test('le carnet : écrit et lu par son titulaire seul, liste blanche fermée', async () => {
  assert.equal((await appel(LEA, 'PUT', 'amis/' + K(LEA) + '/tom__fit', { le: Date.now(), prenom: 'Tom' })).statut, 200);
  assert.equal((await appel(LEA, 'GET', 'amis/' + K(LEA))).statut, 200);
  assert.equal((await appel(TOM, 'GET', 'amis/' + K(LEA))).statut, 401, 'le carnet d’un autre ne se lit pas');
  assert.equal((await appel(TOM, 'PUT', 'amis/' + K(LEA) + '/zoe', { le: Date.now(), prenom: 'Zoé' })).statut, 401);
  assert.equal((await appel(LEA, 'PUT', 'amis/' + K(LEA) + '/zoe', { le: Date.now(), prenom: 'Zoé', rang: 3 })).statut, 401, 'rien d’autre que le et prenom');
  assert.equal((await appel(LEA, 'PUT', 'amis/' + K(LEA) + '/Zoé!', { le: Date.now(), prenom: 'Zoé' })).statut, 401, 'le motif des pseudos');
});

await test('les abonnés : écrits par qui suit (son propre pseudo), lus par le seul suivi', async () => {
  assert.equal((await appel(LEA, 'PUT', 'abonnes/tom__fit/lea', { le: Date.now() })).statut, 200);
  assert.equal((await appel(ZOE, 'PUT', 'abonnes/tom__fit/lea', { le: Date.now() })).statut, 401, 'on ne suit pas au nom d’un autre');
  assert.equal((await appel(TOM, 'GET', 'abonnes/tom__fit')).statut, 200);
  assert.equal((await appel(LEA, 'GET', 'abonnes/tom__fit')).statut, 401);
  assert.equal((await appel(LEA, 'DELETE', 'abonnes/tom__fit/lea')).statut, 200, 'ne plus suivre efface');
});

const ID = 'drev' + Date.now().toString(36);
const rev = (x) => Object.assign({ createur: K(LEA), createurNom: 'Léa', mesure: 'seances', duree: 14, creeLe: Date.now(), statut: 'accepte',
  createurPseudo: 'lea', invitePseudo: 'tom__fit' }, x);

await test('revanche : REFUSÉE quand l’invité ne suit pas le créateur', async () => {
  await appel('owner', 'DELETE', 'amis/' + K(TOM));
  assert.equal((await appel(LEA, 'PUT', 'duels/' + ID + 'a', rev())).statut, 401);
});
await test('revanche : ACCEPTÉE quand l’invité suit le créateur', async () => {
  await appel('owner', 'PUT', 'amis/' + K(TOM) + '/lea', { le: 1, prenom: 'Léa' });
  assert.equal((await appel(LEA, 'PUT', 'duels/' + ID + 'b', rev())).statut, 200);
});
await test('revanche : refusée si createurPseudo n’est pas le pseudo du créateur', async () => {
  await appel('owner', 'PUT', 'amis/' + K(TOM) + '/zoe', { le: 1, prenom: 'Zoé' });
  assert.equal((await appel(LEA, 'PUT', 'duels/' + ID + 'c', rev({ createurPseudo: 'zoe' }))).statut, 401);
});
await test('revanche : jamais avec « invite » posé par le créateur, ni des scores', async () => {
  assert.equal((await appel(LEA, 'PUT', 'duels/' + ID + 'd', rev({ invite: K(TOM) }))).statut, 401);
  assert.equal((await appel(LEA, 'PUT', 'duels/' + ID + 'e', rev({ scores: { createur: 9, invite: 0 } }))).statut, 401);
});
await test('un duel par lien (« attente ») reste possible sans aucun pseudo', async () => {
  const d = rev({ statut: 'attente' }); delete d.createurPseudo; delete d.invitePseudo;
  assert.equal((await appel(LEA, 'PUT', 'duels/' + ID + 'f', d)).statut, 200);
});
await test('les revanches reçues : lues par l’invité seul, jamais écrites par un client', async () => {
  await appel('owner', 'PUT', 'duels_recus/' + K(TOM) + '/' + ID + 'b', { le: 1, de: 'Léa' });
  assert.equal((await appel(TOM, 'GET', 'duels_recus/' + K(TOM))).statut, 200);
  assert.equal((await appel(LEA, 'GET', 'duels_recus/' + K(TOM))).statut, 401);
  assert.equal((await appel(TOM, 'PUT', 'duels_recus/' + K(TOM) + '/x', { le: 1 })).statut, 401);
});

let n = 0;
const nid = () => 'e' + Date.now().toString(36) + (n++).toString(36).padStart(4, '0');
const deposer = (qui, ev) => {
  const id = nid();
  return appel(qui, 'PATCH', '', { ['evenements/' + id]: Object.assign({ par: K(qui), at: Date.now() }, ev),
    ['evenements_attente/' + K(qui) + '/' + ev.type + '/' + ev.cible]: { id, at: { '.sv': 'timestamp' } } });
};
await test('l’événement duel_cree : le créateur seul, sur une revanche', async () => {
  assert.equal((await deposer(LEA, { type: 'duel_cree', cible: ID + 'b' })).statut, 200);
  assert.equal((await deposer(TOM, { type: 'duel_cree', cible: ID + 'b' })).statut, 401, 'l’invité ne le dépose pas');
  assert.equal((await deposer(LEA, { type: 'duel_cree', cible: ID + 'f' })).statut, 401, 'pas sur un duel par lien');
});

console.log(ok + ' tests passés (émulateur)');
