// Les écritures anonymes bornées (/metrics, /attribution) et les textes libres
// de users/ bornés à 4 000 caractères, sur l'ÉMULATEUR de la Realtime Database
// (pas dans `npm test`).
//   java -jar firebase-database-emulator-*.jar --port 9000
//   node cloudflare/test/regles-quotas.emu.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const BASE = process.env.EMU || 'http://127.0.0.1:9000';
const NS = 'quotas' + Date.now().toString(36);
let ok = 0;
const test = async (nom, fn) => { await fn(); ok++; console.log('ok  ', nom); };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jeton = (email) => b64({ alg: 'none', typ: 'JWT' }) + '.' + b64({ sub: email, user_id: email, email, email_verified: true,
  iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600, aud: NS, iss: 'https://securetoken.google.com/' + NS,
  firebase: { sign_in_provider: 'password' } }) + '.';
// qui : 'owner' (administrateur), null (anonyme), ou une adresse.
async function appel(qui, methode, chemin, corps) {
  const auth = qui === 'owner' || qui === null ? '' : '&auth=' + jeton(qui);
  const r = await fetch(BASE + '/' + chemin + '.json?ns=' + NS + auth, { method: methode,
    headers: Object.assign({ 'Content-Type': 'application/json' }, qui === 'owner' ? { Authorization: 'Bearer owner' } : {}),
    body: corps === undefined ? undefined : JSON.stringify(corps) });
  return { statut: r.status, corps: await r.text() };
}
const INC = (n) => ({ '.sv': { increment: n } });
const LEA = 'lea@t.fr', K = (e) => e.replace(/\./g, ',');
const JOUR = new Date().toISOString().slice(0, 10);
const regles = readFileSync(new URL('../../database.rules.json', import.meta.url), 'utf8');
assert.equal((await fetch(BASE + '/.settings/rules.json?ns=' + NS, { method: 'PUT', headers: { Authorization: 'Bearer owner' }, body: regles })).status, 200);
await appel('owner', 'PUT', '', {
  ambassadeurs: { LEAFIT: { nom: 'Léa', actif: true } },
  users: { [K(LEA)]: { id: 'l', email: LEA, role: 'athlete', updatedAt: 1 } } });

// ── /metrics ──────────────────────────────────────────────────────────────
await test('/metrics : +1 anonyme passe (création puis incrément)', async () => {
  assert.equal((await appel(null, 'PUT', 'metrics/' + JOUR + '/landing_view', INC(1))).statut, 200);
  assert.equal((await appel(null, 'PUT', 'metrics/' + JOUR + '/landing_view', INC(1))).statut, 200);
  assert.equal(JSON.parse((await appel('owner', 'GET', 'metrics/' + JOUR + '/landing_view')).corps), 2);
});
await test('/metrics : un incrément de +5 est REFUSÉ, une valeur posée aussi', async () => {
  assert.equal((await appel(null, 'PUT', 'metrics/' + JOUR + '/landing_view', INC(5))).statut, 401);
  assert.equal((await appel(null, 'PUT', 'metrics/' + JOUR + '/welcome_view', INC(5))).statut, 401, 'ni à la création');
  assert.equal((await appel(null, 'PUT', 'metrics/' + JOUR + '/landing_view', 9999999)).statut, 401);
  assert.equal((await appel(null, 'PUT', 'metrics/' + JOUR + '/landing_view', 3)).statut, 200, '+1 posé à la main : admis, c’est un pas de un');
});
await test('/metrics : clé inconnue refusée ; date impossible refusée', async () => {
  assert.equal((await appel(null, 'PUT', 'metrics/' + JOUR + '/pirate', INC(1))).statut, 401);
  assert.equal((await appel(null, 'PUT', 'metrics/2026-13-40/landing_view', INC(1))).statut, 401);
  assert.equal((await appel(null, 'PUT', 'metrics/1999-01-01/landing_view', INC(1))).statut, 401);
});
await test('/metrics : un compteur de capacité avance par paquet, d’un million au plus', async () => {
  assert.equal((await appel(null, 'PUT', 'metrics/' + JOUR + '/oct_in_ko', INC(450))).statut, 200);
  assert.equal((await appel(null, 'PUT', 'metrics/' + JOUR + '/oct_in_ko', INC(1000000))).statut, 200);
  assert.equal((await appel(null, 'PUT', 'metrics/' + JOUR + '/oct_in_ko', INC(1000001))).statut, 401);
  assert.equal((await appel(null, 'PUT', 'metrics/' + JOUR + '/cld_ko', INC(1000001))).statut, 401, 'ni à la création');
});

// ── /attribution ──────────────────────────────────────────────────────────
await test('/attribution : +1 sur un src connu passe ; +5 refusé ; src inconnu refusé', async () => {
  const c = 'attribution/jours/' + JOUR + '/src/';
  assert.equal((await appel(null, 'PUT', c + 'story/partage', INC(1))).statut, 200);
  assert.equal((await appel(null, 'PUT', c + 'autre/partage', INC(1))).statut, 200);
  assert.equal((await appel(null, 'PUT', c + 'story/partage', INC(5))).statut, 401);
  assert.equal((await appel(null, 'PUT', c + 'zzz/partage', INC(1))).statut, 401);
  assert.equal((await appel(null, 'PUT', c + 'story/pirate', INC(1))).statut, 401);
  assert.equal((await appel(null, 'PUT', 'attribution/jours/' + JOUR + '/pirate/x', INC(1))).statut, 401, 'profondeur fixe');
});
await test('/attribution : un code ambassadeur qui n’existe pas est refusé', async () => {
  const c = 'attribution/jours/' + JOUR + '/amb/';
  assert.equal((await appel(null, 'PUT', c + 'LEAFIT/clic', INC(1))).statut, 200);
  assert.equal((await appel(null, 'PUT', c + 'FANTOME/clic', INC(1))).statut, 401);
  assert.equal((await appel(null, 'PUT', 'attribution/semaines/' + JOUR + '/actifs', INC(1))).statut, 200);
  assert.equal((await appel(null, 'PUT', 'attribution/semaines/' + JOUR + '/actifs', INC(3))).statut, 401);
});

// ── users/$emailKey ──────────────────────────────────────────────────────
const U = 'users/' + K(LEA);
await test('users : une note de 10 000 caractères est refusée ; 4 000 passent', async () => {
  assert.equal((await appel(LEA, 'PUT', U + '/sessions/0/notes', 'x'.repeat(10000))).statut, 401);
  assert.equal((await appel(LEA, 'PUT', U + '/sessions/0/notes', 'x'.repeat(4000))).statut, 200);
  assert.equal((await appel(LEA, 'PUT', U + '/bio', 'x'.repeat(10000))).statut, 401);
  assert.equal((await appel(LEA, 'PUT', U + '/videos/0/feedback', 'x'.repeat(10000))).statut, 401);
});
await test('users : une réponse de bilan de 10 000 caractères est refusée, une photo base64 encore en migration passe', async () => {
  assert.equal((await appel(LEA, 'PUT', U + '/bilans/0', { date: JOUR, 'deb-ressenti': 'x'.repeat(10000) })).statut, 401);
  assert.equal((await appel(LEA, 'PUT', U + '/bilans/0', { date: JOUR, 'deb-ressenti': 'bien', 'deb-photo-face': 'data:image/jpeg;base64,' + 'A'.repeat(9000), 'deb-weight': 72 })).statut, 200);
});
await test('users : modèles de message, schéma fermé (clé inconnue refusée, corps borné)', async () => {
  const t = { id: 't1', cat: 'technique', titre: 'Bravo', corps: 'Belle séance', createdAt: 1 };
  assert.equal((await appel(LEA, 'PUT', U + '/msgTemplates/0', t)).statut, 200);
  assert.equal((await appel(LEA, 'PUT', U + '/msgTemplates/1', Object.assign({}, t, { intrus: 1 }))).statut, 401);
  assert.equal((await appel(LEA, 'PUT', U + '/msgTemplates/1', Object.assign({}, t, { corps: 'x'.repeat(10000) }))).statut, 401);
  assert.equal((await appel(LEA, 'PUT', U + '/quickComments/0', { id: 'q', label: 'L', text: 'T', pos: 1, vieux: true })).statut, 401);
});
await test('users : le dossier entier, comme l’app l’envoie, passe toujours', async () => {
  const doc = JSON.parse((await appel('owner', 'GET', U)).corps);
  doc.updatedAt = 2; doc.vision = 'Courir un marathon';
  assert.equal((await appel(LEA, 'PUT', U, doc)).statut, 200);
});

await test('users : le fuseau (tz) — un nom IANA passe, le reste est refusé', async () => {
  for (const ok of ['Europe/Paris', 'America/Montreal', 'Indian/Reunion', 'America/Argentina/Salta', 'UTC', 'Etc/GMT+5'])
    assert.equal((await appel(LEA, 'PUT', U + '/tz', ok)).statut, 200, ok);
  for (const ko of ['../etc', 'europe/paris', 'Paris', 'A'.repeat(70) + '/B', 12, 'Europe/Paris/x/y'])
    assert.equal((await appel(LEA, 'PUT', U + '/tz', ko)).statut, 401, String(ko));
});

console.log(ok + ' tests passés');
