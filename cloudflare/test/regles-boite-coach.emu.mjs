// La boîte du coach (/boite_coach), sur l'ÉMULATEUR de la Realtime Database
// (pas dans `npm test` : il faut Java et l'émulateur).
//   java -jar firebase-database-emulator-*.jar --port 9000
//   node cloudflare/test/regles-boite-coach.emu.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const BASE = process.env.EMU || 'http://127.0.0.1:9000';
const NS = 'boite' + Date.now().toString(36);
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
const A = 'lea@t.fr', B = 'tom@t.fr', C1 = 'coach1@t.fr', C2 = 'coach2@t.fr', K = (e) => e.replace(/\./g, ',');
const regles = readFileSync(new URL('../../database.rules.json', import.meta.url), 'utf8');
assert.equal((await fetch(BASE + '/.settings/rules.json?ns=' + NS, { method: 'PUT', headers: { Authorization: 'Bearer owner' }, body: regles })).status, 200);
await appel('owner', 'PUT', 'users', { [K(A)]: { email: A, coachEmailKey: K(C1) }, [K(B)]: { email: B, coachEmailKey: K(C1) } });

await test('l’athlète écrit SA clé sous SON coach', async () => {
  assert.equal((await appel(A, 'PUT', 'boite_coach/' + K(C1) + '/' + K(A), 1234)).statut, 200);
});
await test('l’athlète A ne peut pas écrire dans la boîte d’un autre coach', async () => {
  assert.equal((await appel(A, 'PUT', 'boite_coach/' + K(C2) + '/' + K(A), 1234)).statut, 401);
});
await test('l’athlète A ne peut pas écrire sous la clé d’un autre athlète', async () => {
  assert.equal((await appel(A, 'PUT', 'boite_coach/' + K(C1) + '/' + K(B), 1234)).statut, 401);
  assert.equal((await appel(A, 'PATCH', 'boite_coach/' + K(C1), { [K(A)]: 5, [K(B)]: 5 })).statut, 401, 'pas en lot non plus');
});
await test('un nombre positif, rien d’autre', async () => {
  assert.equal((await appel(A, 'PUT', 'boite_coach/' + K(C1) + '/' + K(A), { seance: 'x' })).statut, 401);
  assert.equal((await appel(A, 'PUT', 'boite_coach/' + K(C1) + '/' + K(A), 'texte')).statut, 401);
  assert.equal((await appel(A, 'PUT', 'boite_coach/' + K(C1) + '/' + K(A), -3)).statut, 401);
});
await test('le coach lit sa boîte ; ni l’autre coach ni l’athlète ne la lisent', async () => {
  assert.equal((await appel(C1, 'GET', 'boite_coach/' + K(C1))).statut, 200);
  assert.equal((await appel(C2, 'GET', 'boite_coach/' + K(C1))).statut, 401);
  assert.equal((await appel(A, 'GET', 'boite_coach/' + K(C1))).statut, 401);
});
await test('rattaché à un autre coach : l’ancienne boîte se ferme', async () => {
  await appel('owner', 'PUT', 'users/' + K(A) + '/coachEmailKey', K(C2));
  assert.equal((await appel(A, 'PUT', 'boite_coach/' + K(C1) + '/' + K(A), 99)).statut, 401);
  assert.equal((await appel(A, 'PUT', 'boite_coach/' + K(C2) + '/' + K(A), 99)).statut, 200);
});
await test('le coach n’écrit pas dans sa boîte, un inconnu non plus', async () => {
  assert.equal((await appel(C1, 'PUT', 'boite_coach/' + K(C1) + '/' + K(B), 7)).statut, 401);
  const r = await fetch(BASE + '/boite_coach/' + K(C1) + '/' + K(B) + '.json?ns=' + NS, { method: 'PUT', body: '7' });
  assert.equal(r.status, 401);
});
console.log(ok + ' tests passés');
