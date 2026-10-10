// Les droits ne s'écrivent que par le worker (10/10/2026), sur l'ÉMULATEUR de la
// Realtime Database (pas dans `npm test` : il faut Java et l'émulateur).
//   java -jar firebase-database-emulator-*.jar --port 9000
//   node cloudflare/test/regles-droits.emu.mjs
// « owner » joue le compte de service du worker : il passe outre les règles.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const BASE = process.env.EMU || 'http://127.0.0.1:9000';
const NS = 'droits' + Date.now().toString(36);
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
const ATH = 'lea@t.fr', COACH = 'sam@t.fr', AUTRE = 'zoe@t.fr', KEVIN = 'guellec.coachingpro@gmail.com';
const J = 864e5, T = Date.now();

const regles = readFileSync(new URL('../../database.rules.json', import.meta.url), 'utf8');
assert.equal((await fetch(BASE + '/.settings/rules.json?ns=' + NS, { method: 'PUT', headers: { Authorization: 'Bearer owner' }, body: regles })).status, 200);
// Le worker a ouvert l'essai de Léa et enregistré un programme ; Léa est suivie par Sam.
const DROITS = { palier: 'aucun', echeance: 0, source: 'essai', maj: T, essaiOuvertLe: T - 10 * J, essaiFinit: T + 20 * J,
  programmes: { fondations: { le: T - J, prixCts: 1490, source: 'paypal', ordre: 'ORD12345678' } } };
await appel('owner', 'PUT', 'users/' + K(ATH), { role: 'athlete', coachEmailKey: K(COACH) });
await appel('owner', 'PUT', 'droits/' + K(ATH), DROITS);
const lus = async () => JSON.parse((await appel('owner', 'GET', 'droits/' + K(ATH))).corps);

await test('le titulaire lit ses droits, son coach aussi, un autre compte non', async () => {
  assert.equal((await appel(ATH, 'GET', 'droits/' + K(ATH))).statut, 200);
  assert.equal((await appel(COACH, 'GET', 'droits/' + K(ATH))).statut, 200);
  assert.equal((await appel(AUTRE, 'GET', 'droits/' + K(ATH))).statut, 401);
});

await test('un client ne peut pas prolonger son essai : ni essaiFinit, ni essaiOuvertLe, ni le nœud entier', async () => {
  assert.equal((await appel(ATH, 'PUT', 'droits/' + K(ATH) + '/essaiFinit', T + 999 * J)).statut, 401);
  assert.equal((await appel(ATH, 'PATCH', 'droits/' + K(ATH), { essaiOuvertLe: T, essaiFinit: T + 30 * J })).statut, 401);
  assert.equal((await appel(ATH, 'PUT', 'droits/' + K(ATH), Object.assign({}, DROITS, { essaiFinit: T + 999 * J }))).statut, 401);
  assert.equal((await appel(ATH, 'DELETE', 'droits/' + K(ATH) + '/essaiOuvertLe')).statut, 401, 'effacer pour rouvrir un essai');
  // Un autre compte qui n'a pas encore de droits ne s'en crée pas.
  assert.equal((await appel(AUTRE, 'PUT', 'droits/' + K(AUTRE), { palier: 'aucun', echeance: 0, essaiOuvertLe: T, essaiFinit: T + 60 * J })).statut, 401);
  assert.equal((await lus()).essaiFinit, T + 20 * J);
});

await test('un client ne peut pas s’attribuer un programme, ni un palier, ni annuler un remboursement', async () => {
  assert.equal((await appel(ATH, 'PUT', 'droits/' + K(ATH) + '/programmes/force', { le: T, prixCts: 0, source: 'offert' })).statut, 401);
  assert.equal((await appel(ATH, 'PATCH', 'droits/' + K(ATH) + '/programmes', { force: { le: T, prixCts: 4900, source: 'paypal' } })).statut, 401);
  assert.equal((await appel(ATH, 'PATCH', 'droits/' + K(ATH), { palier: 'ultime' })).statut, 401);
  assert.equal((await appel(ATH, 'PUT', 'droits/' + K(ATH) + '/ultimeJusqu', T + 365 * J)).statut, 401);
  assert.deepEqual(Object.keys((await lus()).programmes), ['fondations']);
});

await test('le coach ne les écrit pas non plus, ni le créateur depuis l’app (il passe par /fn/droits)', async () => {
  assert.equal((await appel(COACH, 'PUT', 'droits/' + K(ATH) + '/programmes/cadeau', { le: T, prixCts: 0, source: 'offert' })).statut, 401);
  assert.equal((await appel(KEVIN, 'PATCH', 'droits/' + K(ATH), { palier: 'ultime', echeance: 0, source: 'main' })).statut, 401);
});

await test('le dossier, lui, reste au titulaire : y écrire un programme ou un essai ne touche pas à droits/', async () => {
  assert.equal((await appel(ATH, 'PATCH', 'users/' + K(ATH), { programmesAchetes: { force: { ordre: 'offert', prixCts: 0 } },
    essai: { ouvertLe: T, finit: T + 999 * J } })).statut, 200);
  const d = await lus();
  assert.deepEqual(Object.keys(d.programmes), ['fondations']);
  assert.equal(d.essaiFinit, T + 20 * J);
});

await test('le worker (compte de service) écrit, et ses champs sont décrits par les règles', async () => {
  assert.equal((await appel('owner', 'PATCH', 'droits/' + K(ATH) + '/programmes/fondations', { rembourseLe: T })).statut, 200);
  assert.equal((await appel('owner', 'PATCH', 'droits/' + K(ATH), { rattrapeLe: T, essaiBonus: true })).statut, 200);
});

console.log(ok + ' tests passés');
