// Les règles de la messagerie privée (06/10/2026) : l'index des fils
// (messagesIndex) et le retrait d'un message par le coach dans les 30 s
// (annulation de l'envoi groupé), sur l'ÉMULATEUR de la Realtime Database.
//   java -jar firebase-database-emulator-*.jar --port 9000
//   node cloudflare/test/regles-messages.emu.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const BASE = process.env.EMU || 'http://127.0.0.1:9000';
const NS = 'msg' + Date.now().toString(36);
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
const KEV = 'kevin@t.fr', LEA = 'lea@t.fr', TOM = 'tom@t.fr', K = (e) => e.replace(/\./g, ',');
const regles = readFileSync(new URL('../../database.rules.json', import.meta.url), 'utf8');
assert.equal((await fetch(BASE + '/.settings/rules.json?ns=' + NS, { method: 'PUT', headers: { Authorization: 'Bearer owner' }, body: regles })).status, 200);
await appel('owner', 'PUT', 'users', { [K(LEA)]: { coachEmailKey: K(KEV) }, [K(TOM)]: { coachEmailKey: 'autre,coach@t,fr' } });
const IDX = 'messagesIndex/' + K(KEV) + '/' + K(LEA);
const entree = (x) => Object.assign({ dernierTexte: 'Salut Léa', de: 'coach', at: Date.now(), nonLusCoach: 0, nonLusAthlete: 1 }, x);

await test('index : écrit par le coach et par son athlète, lu par eux seuls', async () => {
  assert.equal((await appel(KEV, 'PUT', IDX, entree())).statut, 200);
  assert.equal((await appel(LEA, 'PATCH', IDX, { nonLusAthlete: 0 })).statut, 200, 'l’athlète marque lu');
  assert.equal((await appel(KEV, 'GET', 'messagesIndex/' + K(KEV))).statut, 200, 'le coach lit tout son index en un appel');
  assert.equal((await appel(LEA, 'GET', IDX)).statut, 200, 'l’athlète lit son fil');
  assert.equal((await appel(LEA, 'GET', 'messagesIndex/' + K(KEV))).statut, 401, 'pas l’index entier');
  assert.equal((await appel(TOM, 'GET', IDX)).statut, 401, 'un autre athlète ne lit rien');
  assert.equal((await appel(TOM, 'PUT', 'messagesIndex/' + K(KEV) + '/' + K(TOM), entree({ de: 'athlete' }))).statut, 401, 'un athlète d’un autre coach n’écrit pas');
});
await test('index : l’incrément serveur passe, les types et les tailles sont tenus', async () => {
  assert.equal((await appel(LEA, 'PATCH', IDX, { dernierTexte: 'Merci !', de: 'athlete', at: Date.now(), nonLusCoach: { '.sv': { increment: 1 } } })).statut, 200);
  assert.equal(JSON.parse((await appel(KEV, 'GET', IDX + '/nonLusCoach')).corps), 1);
  assert.equal((await appel(KEV, 'PUT', IDX, entree({ dernierTexte: 'x'.repeat(81) }))).statut, 401, '80 caractères au plus');
  assert.equal((await appel(KEV, 'PUT', IDX, entree({ de: 'robot' }))).statut, 401);
  assert.equal((await appel(KEV, 'PUT', IDX, entree({ nonLusCoach: -1 }))).statut, 401);
  assert.equal((await appel(KEV, 'PUT', IDX, entree({ texte: 'pas un champ' }))).statut, 401, 'liste blanche fermée');
  assert.equal((await appel(KEV, 'PUT', IDX, { dernierTexte: 'sans de ni at' })).statut, 401);
  assert.equal((await appel(KEV, 'DELETE', IDX)).statut, 200, 'le détachement retire le fil');
});
const FIL = 'messages/' + K(KEV) + '/' + K(LEA) + '/';
await test('messages : le coach retire SON message dans les 30 s, pas au-delà, et pas celui de l’athlète', async () => {
  assert.equal((await appel(KEV, 'PUT', FIL + 'm0000000001a', { de: 'coach', texte: 'Salut', at: Date.now(), lu: false })).statut, 200);
  assert.equal((await appel(KEV, 'PUT', FIL + 'm0000000001a', { de: 'coach', texte: 'Autre', at: Date.now(), lu: false })).statut, 401, 'ne se réécrit pas');
  assert.equal((await appel(LEA, 'DELETE', FIL + 'm0000000001a')).statut, 401, 'l’athlète ne retire pas le message du coach');
  assert.equal((await appel(KEV, 'DELETE', FIL + 'm0000000001a')).statut, 200, 'annulation dans les 30 s');
  await appel('owner', 'PUT', FIL + 'm0000000002b', { de: 'coach', texte: 'Ancien', at: Date.now() - 60000, lu: false });
  assert.equal((await appel(KEV, 'DELETE', FIL + 'm0000000002b')).statut, 401, 'au-delà de 30 s, rien ne s’efface');
  assert.equal((await appel(LEA, 'PUT', FIL + 'm0000000003c', { de: 'athlete', texte: 'Coucou', at: Date.now(), lu: false })).statut, 200);
  assert.equal((await appel(KEV, 'DELETE', FIL + 'm0000000003c')).statut, 401, 'le coach ne retire pas le message de l’athlète');
});
console.log(ok + ' tests, règles de la messagerie : OK');
