// Les appels de l'app : le jeton Firebase (RS256) et la suppression Cloudinary.
//   node cloudflare/test/appels.test.mjs
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { verifierJeton, repondreAppel } from '../src/appels.js';
import { cloudinaryDestroy } from '../src/medias.js';
import { creerBase } from '../src/base.js';
import { fausseBase } from './fausse-base.mjs';

let ok = 0;
const test = async (nom, fn) => { await fn(); ok++; console.log('ok  ', nom); };

// Une paire RSA « Google » d'essai, et de quoi signer des jetons.
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = Object.assign(publicKey.export({ format: 'jwk' }), { kid: 'k1', alg: 'RS256', use: 'sig' });
const cleVerif = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
const CLES = { k1: cleVerif };
const PROJET = 'repcore-sync';
function jeton(corps, o) {
  const b = (x) => Buffer.from(JSON.stringify(x)).toString('base64url');
  const s = Math.floor(Date.now() / 1000);
  const t = b({ alg: 'RS256', kid: (o && o.kid) || 'k1' }) + '.' + b(Object.assign({ aud: PROJET, iss: 'https://securetoken.google.com/' + PROJET,
    iat: s - 10, exp: s + 3600, sub: 'uid1', email: 'Lea@T.fr' }, corps));
  return t + '.' + crypto.sign('sha256', Buffer.from(t), privateKey).toString('base64url');
}

await test('un jeton Firebase valide rend l’adresse, en minuscules', async () => {
  const r = await verifierJeton(jeton({}), PROJET, { cles: CLES });
  assert.equal(r.email, 'lea@t.fr');
});
await test('refusés : autre projet, expiré, signature falsifiée, clé inconnue, sans adresse', async () => {
  const s = Math.floor(Date.now() / 1000);
  for (const [nom, j] of [['projet', jeton({ aud: 'autre' })], ['expiré', jeton({ exp: s - 1 })],
    ['clé', jeton({}, { kid: 'k9' })], ['adresse', jeton({ email: '' })]])
    await assert.rejects(() => verifierJeton(j, PROJET, { cles: CLES }), undefined, nom);
  const j = jeton({}); const faux = j.slice(0, -4) + (j.endsWith('AAAA') ? 'BBBB' : 'AAAA');
  await assert.rejects(() => verifierJeton(faux, PROJET, { cles: CLES }), undefined, 'signature');
  // Et un corps réécrit avec la signature d'origine.
  const [t, , sig] = j.split('.');
  const autre = Buffer.from(JSON.stringify({ aud: PROJET, iss: 'https://securetoken.google.com/' + PROJET, iat: s, exp: s + 99, sub: 'x', email: 'pirate@t.fr' })).toString('base64url');
  await assert.rejects(() => verifierJeton(t + '.' + autre + '.' + sig, PROJET, { cles: CLES }), undefined, 'corps réécrit');
});

// La suppression : une base, un faux Cloudinary qui vérifie la signature.
function monde(users) {
  const F = fausseBase({ users });
  const vus = [];
  const fetchImpl = async (url, init) => {
    if (String(url).startsWith('https://api.cloudinary.com/')) {
      const p = Object.fromEntries(new URLSearchParams(init.body));
      const attendu = crypto.createHash('sha1').update('invalidate=true&public_id=' + p.public_id + '&timestamp=' + p.timestamp + 'SECRET').digest('hex');
      vus.push({ url, p, signatureOk: p.signature === attendu });
      return { status: 200, json: async () => ({ result: 'ok' }) };
    }
    return F.fetchImpl(url, init);
  };
  const db = creerBase({ url: 'https://b.t', auth: 's', fetchImpl });
  return { db, vus, ctx: { db, env: { CLOUDINARY_API_KEY: 'KEY', CLOUDINARY_API_SECRET: 'SECRET\n' }, fetchImpl, projet: PROJET, cles: CLES } };
}
const USERS = { 'lea@t,fr': { id: 'u_lea', role: 'athlete', coachId: 'u_kev' }, 'kev@t,fr': { id: 'u_kev', role: 'coach' },
  'autre@t,fr': { id: 'u_autre', role: 'coach' } };

await test('son propre média : détruit, signature Cloudinary exacte (secret nettoyé)', async () => {
  const w = monde(USERS);
  const r = await cloudinaryDestroy({ auth: { email: 'lea@t.fr' }, data: { publicId: 'repcore/u_lea/v1', resourceType: 'video' } }, w.ctx);
  assert.equal(r.result, 'ok');
  assert.equal(w.vus.length, 1);
  assert.ok(w.vus[0].signatureOk, 'signature SHA-1 des paramètres triés + secret');
  assert.match(w.vus[0].url, /\/dntu57ml\/video\/destroy$/);
});
await test('le coach désigné détruit le média de son athlète ; un autre coach, non', async () => {
  const w = monde(USERS);
  const r = await cloudinaryDestroy({ auth: { email: 'kev@t.fr' }, data: { publicId: 'repcore/u_lea/p1', resourceType: 'image', proprietaire: 'lea@t.fr' } }, w.ctx);
  assert.equal(r.result, 'ok');
  await assert.rejects(() => cloudinaryDestroy({ auth: { email: 'autre@t.fr' }, data: { publicId: 'repcore/u_lea/p1', resourceType: 'image', proprietaire: 'lea@t.fr' } }, w.ctx),
    /pas dans ta liste/);
  await assert.rejects(() => cloudinaryDestroy({ auth: { email: 'autre@t.fr' }, data: { publicId: 'repcore/u_lea/p1', resourceType: 'image' } }, w.ctx),
    /pas le tien/);
  assert.equal(w.vus.length, 1, 'aucune destruction pour les refus');
});
await test('identifiants refusés : hors repcore/, remontée de chemin, type inconnu', async () => {
  const w = monde(USERS);
  for (const [pid, t] of [['autre/u_lea/x', 'video'], ['repcore/../x', 'video'], ['repcore/u_lea/x', 'raw']])
    await assert.rejects(() => cloudinaryDestroy({ auth: { email: 'lea@t.fr' }, data: { publicId: pid, resourceType: t } }, w.ctx));
  assert.equal(w.vus.length, 0);
});
await test('sans secrets Cloudinary : « indisponible », et la file de l’app attend', async () => {
  const w = monde(USERS); w.ctx.env = {};
  await assert.rejects(() => cloudinaryDestroy({ auth: { email: 'lea@t.fr' }, data: { publicId: 'repcore/u_lea/v1', resourceType: 'video' } }, w.ctx),
    (e) => e.statut === 503);
});
await test('le protocole onCall : 401 sans jeton, {result} avec', async () => {
  const w = monde(USERS);
  const req = (h) => new Request('https://s.t/fn/cloudinaryDestroy', { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, h),
    body: JSON.stringify({ data: { publicId: 'repcore/u_lea/v1', resourceType: 'video' } }) });
  const sans = await repondreAppel(req({}), { cloudinaryDestroy }, w.ctx);
  assert.equal(sans.status, 401);
  const avec = await repondreAppel(req({ Authorization: 'Bearer ' + jeton({}) }), { cloudinaryDestroy }, w.ctx);
  assert.equal(avec.status, 200);
  assert.deepEqual(await avec.json(), { result: { result: 'ok', publicId: 'repcore/u_lea/v1' } });
  const inconnu = await repondreAppel(new Request('https://s.t/fn/rien', { method: 'POST', body: '{}' }), { cloudinaryDestroy }, w.ctx);
  assert.equal(inconnu.status, 404);
});

console.log(ok + ' tests passés');
