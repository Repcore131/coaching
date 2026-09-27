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
function monde(users, extra) {
  const F = fausseBase(Object.assign({ users }, extra || {}));
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
  return { F, db, vus, ctx: { db, env: { CLOUDINARY_API_KEY: 'KEY', CLOUDINARY_API_SECRET: 'SECRET\n' }, fetchImpl, projet: PROJET, cles: CLES } };
}
// Léa est l'athlète de Kev : elle le désigne, et il l'a inscrite dans sa liste.
const USERS = { 'lea@t,fr': { id: 'u_lea', role: 'athlete', coachId: 'u_kev', coachEmailKey: 'kev@t,fr' },
  'kev@t,fr': { id: 'u_kev', role: 'coach' }, 'autre@t,fr': { id: 'u_autre', role: 'coach' } };
const INDEX = { medias_proprio: { u_lea: 'lea@t,fr', u_kev: 'kev@t,fr', u_autre: 'autre@t,fr' },
  coachs: { 'kev@t,fr': { clients: { 'lea@t,fr': true } } } };
const detruire = (w, email, publicId, extra) =>
  cloudinaryDestroy({ auth: { email }, data: Object.assign({ publicId, resourceType: 'image' }, extra) }, w.ctx);
const refus = (statut) => (e) => e.statut === statut;

await test('propriétaire : détruit, signature Cloudinary exacte (secret nettoyé)', async () => {
  const w = monde(USERS, INDEX);
  const r = await cloudinaryDestroy({ auth: { email: 'lea@t.fr' }, data: { publicId: 'repcore/u_lea/v1', resourceType: 'video' } }, w.ctx);
  assert.equal(r.result, 'ok');
  assert.equal(w.vus.length, 1);
  assert.ok(w.vus[0].signatureOk, 'signature SHA-1 des paramètres triés + secret');
  assert.match(w.vus[0].url, /\/dntu57ml\/video\/destroy$/);
  // Un ancien envoi rangé sous l'adresse appartient à l'adresse.
  assert.equal((await detruire(w, 'lea@t.fr', 'repcore/lea@t.fr/p0')).result, 'ok');
});
await test('coach réel (désigné ET inscrit dans sa liste) : détruit', async () => {
  const w = monde(USERS, INDEX);
  assert.equal((await detruire(w, 'kev@t.fr', 'repcore/u_lea/p1')).result, 'ok');
  assert.equal(w.vus.length, 1);
});
await test('id usurpé : 403', async () => {
  // 1. L'appelant nomme le média d'un autre.
  let w = monde(USERS, INDEX);
  await assert.rejects(() => detruire(w, 'autre@t.fr', 'repcore/u_lea/p1'), refus(403));
  // 2. Le champ « proprietaire » de l'appel n'est plus cru.
  await assert.rejects(() => detruire(w, 'autre@t.fr', 'repcore/u_lea/p1', { proprietaire: 'autre@t.fr' }), refus(403));
  // 3. Un compte neuf recopie l'id de Léa dans son dossier et réclame l'index avant elle.
  w = monde(Object.assign({}, USERS, { 'pirate@t,fr': { id: 'u_lea', role: 'athlete' } }),
    Object.assign({}, INDEX, { medias_proprio: { u_lea: 'pirate@t,fr' } }));
  await assert.rejects(() => detruire(w, 'pirate@t.fr', 'repcore/u_lea/p1'), refus(403));
  // 4. L'index désigne un dossier dont l'id n'est pas celui-là.
  w = monde(USERS, Object.assign({}, INDEX, { medias_proprio: { u_lea: 'autre@t,fr' } }));
  await assert.rejects(() => detruire(w, 'autre@t.fr', 'repcore/u_lea/p1'), refus(403));
  // 5. L'adresse d'un autre en guise de dossier.
  await assert.rejects(() => detruire(w, 'autre@t.fr', 'repcore/lea@t.fr/p1'), refus(403));
  assert.equal(w.vus.length, 0, 'aucune destruction pour les refus');
});
await test('coach usurpé : 403', async () => {
  // 1. L'athlète désigne un coach qui ne l'a jamais inscrite (champ écrit par elle seule).
  let w = monde(Object.assign({}, USERS, { 'lea@t,fr': Object.assign({}, USERS['lea@t,fr'], { coachEmailKey: 'autre@t,fr' }) }), INDEX);
  await assert.rejects(() => detruire(w, 'autre@t.fr', 'repcore/u_lea/p1'), refus(403));
  // 2. Un coach s'inscrit Léa dans sa liste, alors qu'elle ne le désigne pas.
  w = monde(USERS, Object.assign({}, INDEX, { coachs: { 'kev@t,fr': { clients: { 'lea@t,fr': true } }, 'autre@t,fr': { clients: { 'lea@t,fr': true } } } }));
  await assert.rejects(() => detruire(w, 'autre@t.fr', 'repcore/u_lea/p1'), refus(403));
  // 3. Le coach d'avant : Léa ne le désigne plus, même s'il l'a gardée dans sa liste.
  w = monde(Object.assign({}, USERS, { 'lea@t,fr': Object.assign({}, USERS['lea@t,fr'], { coachEmailKey: null }) }), INDEX);
  await assert.rejects(() => detruire(w, 'kev@t.fr', 'repcore/u_lea/p1'), refus(403));
  assert.equal(w.vus.length, 0);
});
await test('index absent (compte d’avant l’index) : 409, la file de l’app attend', async () => {
  const w = monde(USERS);
  await assert.rejects(() => detruire(w, 'lea@t.fr', 'repcore/u_lea/p1'), refus(409));
});
await test('le compte Cloudinary vient du worker, jamais de l’appel', async () => {
  const w = monde(USERS, INDEX);
  await detruire(w, 'lea@t.fr', 'repcore/u_lea/p1', { cloudName: 'pirate' });
  assert.match(w.vus[0].url, /\/dntu57ml\/image\/destroy$/);
  w.ctx.env.CLOUDINARY_CLOUD_NAME = 'moncompte';
  await detruire(w, 'lea@t.fr', 'repcore/u_lea/p2', { cloudName: 'pirate' });
  assert.match(w.vus[1].url, /\/moncompte\/image\/destroy$/);
});
await test('identifiants refusés : hors repcore/, remontée de chemin, type inconnu', async () => {
  const w = monde(USERS);
  for (const [pid, t] of [['autre/u_lea/x', 'video'], ['repcore/../x', 'video'], ['repcore/u_lea/x', 'raw'], ['repcore/a[b]/x', 'image'], ['repcore/x@y#z/x', 'image']])
    await assert.rejects(() => cloudinaryDestroy({ auth: { email: 'lea@t.fr' }, data: { publicId: pid, resourceType: t } }, w.ctx), refus(400));
  assert.equal(w.vus.length, 0);
});
await test('sans secrets Cloudinary : « indisponible », et la file de l’app attend', async () => {
  const w = monde(USERS); w.ctx.env = {};
  await assert.rejects(() => cloudinaryDestroy({ auth: { email: 'lea@t.fr' }, data: { publicId: 'repcore/u_lea/v1', resourceType: 'video' } }, w.ctx),
    (e) => e.statut === 503);
});
await test('le protocole onCall : 401 sans jeton, {result} avec', async () => {
  const w = monde(USERS, INDEX);
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
