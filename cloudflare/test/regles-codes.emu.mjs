// La durée d'un code d'accès suit la formule du coach (09/10/2026), sur
// l'ÉMULATEUR de la Realtime Database (pas dans `npm test` : il faut Java et
// l'émulateur).
//   java -jar firebase-database-emulator-*.jar --port 9000
//   node cloudflare/test/regles-codes.emu.mjs
// Les valeurs viennent de tarifs.json → quotas_coach (1 / 6 / 12 mois).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const BASE = process.env.EMU || 'http://127.0.0.1:9000';
const NS = 'codes' + Date.now().toString(36);
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
const K = (e) => e.replace(/\./g, ',');
const LIBRE = 'libre@t.fr', COACH = 'coach@t.fr', PRO = 'pro@t.fr', KEVIN = 'guellec.coachingpro@gmail.com', ATH = 'ath@t.fr';
const Q = JSON.parse(readFileSync(new URL('../../tarifs.json', import.meta.url), 'utf8')).quotas_coach;
const MOIS = 30 * 864e5;
const code = (qui, mois, extra) => Object.assign({ coachEmailKey: K(qui), coachId: 'id_' + K(qui), months: mois,
  expiry: Date.now() + mois * MOIS, type: 'athlete', active: true, redeemed: false, token: 'x', etat: 'envoye' }, extra || {});

const regles = readFileSync(new URL('../../database.rules.json', import.meta.url), 'utf8');
assert.equal((await fetch(BASE + '/.settings/rules.json?ns=' + NS, { method: 'PUT', headers: { Authorization: 'Bearer owner' }, body: regles })).status, 200);
// Le worker (compte de service) a écrit la formule payée des deux coachs payants.
await appel('owner', 'PUT', 'coach_paliers', { [K(COACH)]: { palier: 'coach', maj: 1, source: 'paypal' }, [K(PRO)]: { palier: 'pro', maj: 1, source: 'paypal' } });

let n = 0;
const id = () => 'RC-T' + String(++n).padStart(3, '0') + '-AAAA';

await test('Libre : un code de ' + Q.libre.moisCode + ' mois passe, un code plus long est refusé', async () => {
  assert.equal((await appel(LIBRE, 'PUT', 'rc_codes/' + id(), code(LIBRE, Q.libre.moisCode))).statut, 200);
  assert.equal((await appel(LIBRE, 'PUT', 'rc_codes/' + id(), code(LIBRE, Q.libre.moisCode + 2))).statut, 401);
});
await test('Coach : ' + Q.coach.moisCode + ' mois passent, ' + Q.pro.moisCode + ' sont refusés', async () => {
  assert.equal((await appel(COACH, 'PUT', 'rc_codes/' + id(), code(COACH, Q.coach.moisCode))).statut, 200);
  assert.equal((await appel(COACH, 'PUT', 'rc_codes/' + id(), code(COACH, Q.pro.moisCode))).statut, 401);
});
await test('Pro : ' + Q.pro.moisCode + ' mois passent, 13 sont refusés', async () => {
  assert.equal((await appel(PRO, 'PUT', 'rc_codes/' + id(), code(PRO, Q.pro.moisCode))).statut, 200);
  assert.equal((await appel(PRO, 'PUT', 'rc_codes/' + id(), code(PRO, 13))).statut, 401);
});
await test('le créateur n’a pas de plafond', async () => {
  assert.equal((await appel(KEVIN, 'PUT', 'rc_codes/' + id(), code(KEVIN, 24))).statut, 200);
});
await test('un coach ne s’écrit pas sa formule : ni coach_paliers, ni users/coachPlan ne l’aident', async () => {
  assert.equal((await appel(LIBRE, 'PUT', 'coach_paliers/' + K(LIBRE), { palier: 'pro', maj: 1, source: 'moi' })).statut, 401);
  await appel('owner', 'PUT', 'users/' + K(LIBRE) + '/coachPlan', 'pro');
  assert.equal((await appel(LIBRE, 'PUT', 'rc_codes/' + id(), code(LIBRE, 12))).statut, 401);
});
await test('une expiration plus lointaine que la durée annoncée est refusée', async () => {
  assert.equal((await appel(COACH, 'PUT', 'rc_codes/' + id(), code(COACH, 1, { expiry: Date.now() + 6 * MOIS }))).statut, 401);
});
await test('la prolongation par le coach reste dans la formule', async () => {
  const c = id();
  assert.equal((await appel(COACH, 'PUT', 'rc_codes/' + c, code(COACH, 3))).statut, 200);
  assert.equal((await appel(COACH, 'PATCH', 'rc_codes/' + c, { months: 6, expiry: Date.now() + 6 * MOIS })).statut, 200);
  assert.equal((await appel(COACH, 'PATCH', 'rc_codes/' + c, { months: 9, expiry: Date.now() + 9 * MOIS })).statut, 401);
});
await test('les codes déjà créés restent utilisables : le rachat par l’athlète ne touche pas à la durée', async () => {
  // Un code de 12 mois posé avant la règle, chez un coach aujourd'hui Libre.
  const c = id();
  await appel('owner', 'PUT', 'rc_codes/' + c, code(LIBRE, 12));
  assert.equal((await appel(ATH, 'PATCH', 'rc_codes/' + c, { redeemed: true, athleteEmail: ATH, usedBy: 'Ath', etat: 'cree', creeLe: new Date().toISOString() })).statut, 200);
  // Et le coach peut encore le désactiver.
  assert.equal((await appel(LIBRE, 'PATCH', 'rc_codes/' + c, { active: false })).statut, 200);
});

console.log('\n' + ok + ' tests de règles verts (rc_codes/months, coach_paliers).');
