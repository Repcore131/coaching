// La présence (/presence/<clé>) et le relevé des connexions (/stats/connexions),
// sur l'ÉMULATEUR de la Realtime Database (pas dans `npm test`).
//   java -jar firebase-database-emulator-*.jar --port 9000
//   node cloudflare/test/regles-presence.emu.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const BASE = process.env.EMU || 'http://127.0.0.1:9000';
const NS = 'presence' + Date.now().toString(36);
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
  return r.status;
}
const regles = readFileSync(new URL('../../database.rules.json', import.meta.url), 'utf8');
assert.equal((await fetch(BASE + '/.settings/rules.json?ns=' + NS, { method: 'PUT', headers: { Authorization: 'Bearer owner' }, body: regles })).status, 200);
const LEA = 'lea@t.fr', K = 'lea@t,fr', KEVIN = 'guellec.coachingpro@gmail.com';

await test('le titulaire écrit sa présence (heure serveur, flux 0/1) et l’efface', async () => {
  assert.equal(await appel(LEA, 'PUT', 'presence/' + K, { t: { '.sv': 'timestamp' }, f: 1 }), 200);
  assert.equal(await appel(LEA, 'DELETE', 'presence/' + K), 200);
});
await test('pas la présence d’un autre, pas de champ en trop, pas d’heure future', async () => {
  assert.equal(await appel('autre@t.fr', 'PUT', 'presence/' + K, { t: { '.sv': 'timestamp' } }), 401);
  assert.equal(await appel(LEA, 'PUT', 'presence/' + K, { t: { '.sv': 'timestamp' }, nom: 'Léa' }), 401);
  assert.equal(await appel(LEA, 'PUT', 'presence/' + K, { t: Date.now() + 864e5 }), 401);
  assert.equal(await appel(LEA, 'PUT', 'presence/' + K, { t: { '.sv': 'timestamp' }, f: 2 }), 401);
});
await test('personne ne lit les présences ; stats/connexions : Kevin seul', async () => {
  assert.equal(await appel(LEA, 'GET', 'presence/' + K), 401);
  await appel('owner', 'PUT', 'stats/connexions', { maj: 1, estime: 3 });
  assert.equal(await appel(LEA, 'GET', 'stats/connexions'), 401);
  assert.equal(await appel(KEVIN, 'GET', 'stats/connexions'), 200);
  assert.equal(await appel(KEVIN, 'PUT', 'stats/connexions', { estime: 0 }), 401);
});
console.log('\n' + ok + ' tests de règles verts (presence, stats/connexions).');
