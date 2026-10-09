// Les ligues (01/10/2026) : le classement d'un groupe se lit par ses SEULS
// membres (ligues_membres/<moi> = {lundi, groupe}), cette semaine-là ; rien
// ne s'écrit depuis un client. Sur l'ÉMULATEUR (pas dans `npm test`).
//   java -jar firebase-database-emulator-*.jar --port 9000
//   node cloudflare/test/regles-ligues.emu.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const BASE = process.env.EMU || 'http://127.0.0.1:9000';
const NS = 'ligues' + Date.now().toString(36);
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
const LEA = 'lea@t.fr', TOM = 'tom@t.fr', ZOE = 'zoe@t.fr';
const K = (e) => e.replace(/\./g, ',');
const L1 = '2026-10-12', L0 = '2026-10-05';
const regles = readFileSync(new URL('../../database.rules.json', import.meta.url), 'utf8');
assert.equal((await fetch(BASE + '/.settings/rules.json?ns=' + NS, { method: 'PUT', headers: { Authorization: 'Bearer owner' }, body: regles })).status, 200);
await appel('owner', 'PUT', '', {
  ligues_membres: { [K(LEA)]: { lundi: L1, groupe: 'foudre-1', division: 'foudre', nom: 'lea.fit' },
    [K(TOM)]: { lundi: L1, groupe: 'foudre-1', division: 'foudre', nom: 'Athlète 2' },
    [K(ZOE)]: { lundi: L1, groupe: 'foudre-2', division: 'foudre', nom: 'Athlète 1' } },
  ligues: { [L1]: { 'foudre-1': { division: 'foudre', membres: { lea__fit: true, 'Athlète_2': true }, n: 2 },
    'foudre-2': { division: 'foudre', membres: { 'Athlète_1': true }, n: 1 } },
    [L0]: { 'foudre-1': { division: 'foudre', membres: { x: true }, n: 1 } } },
  ligues_public: { [L1]: { 'foudre-1': { lea__fit: { nom: 'lea.fit', v: 300, n: 2 }, 'Athlète_2': { nom: 'Athlète 2', v: 100, n: 1 } },
    'foudre-2': { 'Athlète_1': { nom: 'Athlète 1', v: 50, n: 1 } } },
    [L0]: { 'foudre-1': { x: { nom: 'x', v: 1, n: 1 } } } },
  ligues_resultats: { [K(LEA)]: { [L0]: { division: 'voltage', vers: 'foudre', place: 2, mouvement: 'monte', taille: 20, at: 1 } } },
  ligues_prive: { [L1]: { 'foudre-1': { [K(LEA)]: { nom: 'lea.fit', division: 'foudre' } } } },
  ligues_index: { [L1]: { foudre: { 'foudre-1': 2, 'foudre-2': 1 } } },
});

await test('un membre lit le classement et le groupe de SA ligue, cette semaine', async () => {
  const p = await appel(LEA, 'GET', 'ligues_public/' + L1 + '/foudre-1');
  assert.equal(p.statut, 200); assert.equal(JSON.parse(p.corps).lea__fit.v, 300);
  assert.equal((await appel(TOM, 'GET', 'ligues/' + L1 + '/foudre-1')).statut, 200);
  assert.equal((await appel(LEA, 'GET', 'ligues_membres/' + K(LEA))).statut, 200);
  assert.equal((await appel(LEA, 'GET', 'ligues_resultats/' + K(LEA))).statut, 200);
});
await test('un autre groupe, une autre semaine, la ligue ou les résultats d’un autre : refusés', async () => {
  assert.equal((await appel(ZOE, 'GET', 'ligues_public/' + L1 + '/foudre-1')).statut, 401);
  assert.equal((await appel(ZOE, 'GET', 'ligues/' + L1 + '/foudre-1')).statut, 401);
  assert.equal((await appel(LEA, 'GET', 'ligues_public/' + L0 + '/foudre-1')).statut, 401, 'la semaine passée n’est plus la sienne');
  assert.equal((await appel(LEA, 'GET', 'ligues_public/' + L1)).statut, 401, 'pas tous les groupes d’un coup');
  assert.equal((await appel(LEA, 'GET', 'ligues_membres/' + K(TOM))).statut, 401);
  assert.equal((await appel(TOM, 'GET', 'ligues_resultats/' + K(LEA))).statut, 401);
  // Les clés de compte (ligues_prive) et l'index ne se lisent jamais.
  assert.equal((await appel(LEA, 'GET', 'ligues_prive/' + L1 + '/foudre-1')).statut, 401);
  assert.equal((await appel(LEA, 'GET', 'ligues_index/' + L1)).statut, 401);
});
await test('aucune écriture client : ni son score, ni sa ligue, ni son résultat, ni le groupe', async () => {
  assert.equal((await appel(LEA, 'PUT', 'ligues_public/' + L1 + '/foudre-1/lea__fit', { nom: 'lea.fit', v: 99999, n: 9 })).statut, 401);
  assert.equal((await appel(ZOE, 'PUT', 'ligues_membres/' + K(ZOE), { lundi: L1, groupe: 'foudre-1', division: 'legende', nom: 'z' })).statut, 401);
  assert.equal((await appel(LEA, 'PUT', 'ligues_resultats/' + K(LEA) + '/' + L1, { mouvement: 'monte', vers: 'legende', place: 1 })).statut, 401);
  assert.equal((await appel(ZOE, 'PATCH', 'ligues/' + L1 + '/foudre-1/membres', { 'Athlète_9': true })).statut, 401);
  assert.equal((await appel(LEA, 'PUT', 'ligues_index/' + L1 + '/foudre/foudre-1', 0)).statut, 401);
  const p = await appel('owner', 'GET', 'ligues_public/' + L1 + '/foudre-1/lea__fit');
  assert.equal(JSON.parse(p.corps).v, 300, 'le score du serveur est intact');
});
console.log(ok + ' tests passés (émulateur)');
