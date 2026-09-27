// L'accès à la base par un compte de service : jeton OAuth en en-tête, plus
// de secret dans l'URL.   node cloudflare/test/google.test.mjs
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { lireCompteService, jetonCompteService, oublierJetonGoogle } from '../src/google.js';
import { creerBase } from '../src/base.js';
import { fausseBase } from './fausse-base.mjs';

let ok = 0;
const test = async (nom, fn) => { await fn(); ok++; console.log('ok  ', nom); };
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const JSON_COMPTE = JSON.stringify({ type: 'service_account', client_email: 'worker@repcore-sync.iam.gserviceaccount.com',
  private_key_id: 'kid1', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }), token_uri: 'https://oauth2.googleapis.com/token' });

// Un faux Google qui VÉRIFIE la signature et les champs du jeton JWT.
function google() {
  const vus = [];
  const fetchImpl = async (url, init) => {
    const p = new URLSearchParams(init.body);
    const [t, c, s] = p.get('assertion').split('.');
    const ok = crypto.verify('sha256', Buffer.from(t + '.' + c), publicKey, Buffer.from(s, 'base64url'));
    vus.push({ url, grant: p.get('grant_type'), tete: JSON.parse(Buffer.from(t, 'base64url')), charge: JSON.parse(Buffer.from(c, 'base64url')), ok });
    return { ok: true, status: 200, json: async () => ({ access_token: 'ya29.jeton' + vus.length, expires_in: 3599 }) };
  };
  return { vus, fetchImpl };
}

await test('le JSON du compte de service est lu, y compris une clé aux \\n échappés', async () => {
  const c = lireCompteService(JSON_COMPTE);
  assert.equal(c.email, 'worker@repcore-sync.iam.gserviceaccount.com');
  assert.match(c.cle, /^-----BEGIN PRIVATE KEY-----\n/);
  assert.equal(lireCompteService('pas du json'), null);
  assert.equal(lireCompteService(undefined), null);
  assert.equal(lireCompteService(JSON.stringify({ client_email: 'x' })), null);
});

await test('le jeton JWT est signé par la clé du compte, pour la base, et échangé chez Google', async () => {
  oublierJetonGoogle();
  const g = google();
  const j = await jetonCompteService(lireCompteService(JSON_COMPTE), { fetchImpl: g.fetchImpl });
  assert.equal(j, 'ya29.jeton1');
  const v = g.vus[0];
  assert.ok(v.ok, 'signature RS256 vérifiée avec la clé publique');
  assert.equal(v.url, 'https://oauth2.googleapis.com/token');
  assert.equal(v.grant, 'urn:ietf:params:oauth:grant-type:jwt-bearer');
  assert.deepEqual([v.tete.alg, v.tete.kid], ['RS256', 'kid1']);
  assert.equal(v.charge.iss, 'worker@repcore-sync.iam.gserviceaccount.com');
  assert.match(v.charge.scope, /auth\/firebase\.database/);
  assert.match(v.charge.scope, /auth\/userinfo\.email/);
  assert.equal(v.charge.exp - v.charge.iat, 3600);
});

await test('le jeton est gardé jusqu’à cinq minutes de son expiration, puis redemandé', async () => {
  oublierJetonGoogle();
  const g = google();
  let t = 1_000_000_000_000;
  const o = { fetchImpl: g.fetchImpl, maintenant: () => t };
  const c = lireCompteService(JSON_COMPTE);
  await Promise.all([jetonCompteService(c, o), jetonCompteService(c, o)]);
  await jetonCompteService(c, o);
  assert.equal(g.vus.length, 1, 'un seul échange pour trois demandes');
  t += 54 * 60e3;
  await jetonCompteService(c, o);
  assert.equal(g.vus.length, 1, 'encore bon à 54 minutes');
  t += 2 * 60e3;
  assert.equal(await jetonCompteService(c, o), 'ya29.jeton2', 'redemandé à 56 minutes');
});

await test('la base : jeton dans l’en-tête Authorization, plus rien dans l’URL', async () => {
  const F = fausseBase({ a: { b: 1 } });
  const vus = [];
  const fetchImpl = (url, init) => { vus.push({ url, h: init.headers }); return F.fetchImpl(url, init); };
  const db = creerBase({ url: 'https://b.t', auth: 'ANCIEN-SECRET', jeton: async () => 'ya29.x', fetchImpl });
  assert.equal((await db.ref('a/b').get()).val(), 1);
  await db.ref('a/c').set(2);
  for (const v of vus) {
    assert.equal(v.h.Authorization, 'Bearer ya29.x');
    assert.doesNotMatch(v.url, /auth=|ANCIEN-SECRET/);
  }
  // Sans compte de service, l'ancien secret sert encore (bascule), dans l'URL.
  vus.length = 0;
  const vieux = creerBase({ url: 'https://b.t', auth: 'ANCIEN-SECRET', fetchImpl });
  await vieux.ref('a/b').get();
  assert.match(vus[0].url, /auth=ANCIEN-SECRET/);
  assert.equal(vus[0].h.Authorization, undefined);
});

console.log(ok + ' tests passés');
