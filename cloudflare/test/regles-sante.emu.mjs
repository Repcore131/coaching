// Les règles de /sante_jetons et /sante_sync, sur l'ÉMULATEUR de la
// Realtime Database (pas dans `npm test` : il faut Java et l'émulateur).
//   java -jar firebase-database-emulator-*.jar --port 9000
//   node cloudflare/test/regles-sante.emu.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const BASE = process.env.EMU || 'http://127.0.0.1:9000';
const NS = 'sante' + Date.now().toString(36);
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
const KEV = 'kev@t.fr', LEA = 'lea@t.fr', TOM = 'tom@t.fr', K = (e) => e.replace(/\./g, ',');
const regles = readFileSync(new URL('../../database.rules.json', import.meta.url), 'utf8');
assert.equal((await fetch(BASE + '/.settings/rules.json?ns=' + NS, { method: 'PUT', headers: { Authorization: 'Bearer owner' }, body: regles })).status, 200);
const initial = () => appel('owner', 'PUT', '', { users: { [K(LEA)]: { coachEmailKey: K(KEV) }, [K(TOM)]: {} },
  sante_jetons: { abc: { cle: K(LEA), creeLe: 1 } },
  sante_sync: { [K(LEA)]: { meta: { empreinte: 'abc', creeLe: 1 }, jours: { '2026-10-15': { pas: 100 } } } } });
await initial();

await test('sante_jetons : fermé à tous, propriétaire compris', async () => {
  assert.equal((await appel(LEA, 'GET', 'sante_jetons/abc')).statut, 401);
  assert.equal((await appel(LEA, 'GET', 'sante_jetons')).statut, 401);
  assert.equal((await appel(LEA, 'PUT', 'sante_jetons/zzz', { cle: K(LEA) })).statut, 401);
});
await test('sante_sync : lu par le propriétaire et son coach, pas par un autre', async () => {
  assert.equal((await appel(LEA, 'GET', 'sante_sync/' + K(LEA))).statut, 200);
  assert.equal((await appel(KEV, 'GET', 'sante_sync/' + K(LEA))).statut, 200);
  assert.equal((await appel(TOM, 'GET', 'sante_sync/' + K(LEA))).statut, 401);
  assert.equal((await appel(LEA, 'GET', 'sante_sync')).statut, 401);
});
await test('sante_sync : personne n’écrit les jours ni la meta, pas même le propriétaire', async () => {
  assert.equal((await appel(LEA, 'PUT', 'sante_sync/' + K(LEA) + '/jours/2026-10-15/pas', 99999)).statut, 401);
  assert.equal((await appel(LEA, 'PUT', 'sante_sync/' + K(LEA) + '/meta/empreinte', 'x')).statut, 401);
  assert.equal((await appel(KEV, 'PUT', 'sante_sync/' + K(LEA) + '/consomme', Date.now())).statut, 401);
  assert.equal((await appel(LEA, 'DELETE', 'sante_sync/' + K(LEA) + '/jours')).statut, 401);
});
await test('consomme : le propriétaire l’écrit, un nombre pas dans le futur', async () => {
  assert.equal((await appel(LEA, 'PUT', 'sante_sync/' + K(LEA) + '/consomme', Date.now())).statut, 200);
  assert.equal((await appel(LEA, 'PUT', 'sante_sync/' + K(LEA) + '/consomme', 'hier')).statut, 401);
  assert.equal((await appel(LEA, 'PUT', 'sante_sync/' + K(LEA) + '/consomme', Date.now() + 864e5)).statut, 401);
});
await test('l’effacement du nœud entier par son propriétaire passe (révocation), pas par le coach', async () => {
  assert.equal((await appel(KEV, 'DELETE', 'sante_sync/' + K(LEA))).statut, 401);
  assert.equal((await appel(LEA, 'DELETE', 'sante_sync/' + K(LEA))).statut, 200);
  assert.equal((await appel('owner', 'GET', 'sante_sync/' + K(LEA))).corps, 'null');
});
console.log(ok + ' tests de règles santé passés');
