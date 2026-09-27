// Le point d'entrée du Worker (fetch) : la pré-vérification CORS et un appel
// sans jeton, tels que le navigateur les envoie à /fn/cloudinaryDestroy.
//   node cloudflare/test/index.test.mjs
//
// POURQUOI. Une réponse 204 construite avec un corps ('') lève « Invalid
// response status code 204 » : l'exception sortait sans en-têtes CORS, le
// navigateur y voyait « Impossible de joindre le serveur », et l'app coupait
// toutes les suppressions de la session (_cldIndispo).
import assert from 'node:assert/strict';
import worker from '../src/index.js';

let ok = 0;
const test = async (nom, fn) => { await fn(); ok++; console.log('ok  ', nom); };

const ENV = { FIREBASE_DB_URL: 'https://base-essai.firebaseio.com', FIREBASE_DB_SECRET: 'x' };
const CTX = { waitUntil() {} };
const ORIGINE = 'https://repcore-sync.web.app';
const corsPresent = (r) => {
  assert.equal(r.headers.get('Access-Control-Allow-Origin'), '*');
  assert.match(r.headers.get('Access-Control-Allow-Methods') || '', /POST/);
  assert.match(r.headers.get('Access-Control-Allow-Headers') || '', /Authorization/i);
};

await test('OPTIONS /fn/cloudinaryDestroy : 204, sans corps, avec les en-têtes CORS', async () => {
  const r = await worker.fetch(new Request('https://s.t/fn/cloudinaryDestroy', { method: 'OPTIONS',
    headers: { Origin: ORIGINE, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization, content-type' } }), ENV, CTX);
  assert.equal(r.status, 204);
  corsPresent(r);
  assert.equal(await r.text(), '');
});

await test('POST /fn/cloudinaryDestroy sans jeton : 401, avec les en-têtes CORS', async () => {
  const r = await worker.fetch(new Request('https://s.t/fn/cloudinaryDestroy', { method: 'POST',
    headers: { Origin: ORIGINE, 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: { publicId: 'repcore/u_lea/v1', resourceType: 'image' } }) }), ENV, CTX);
  assert.equal(r.status, 401);
  corsPresent(r);
  const j = await r.json();
  assert.equal(j.error.status, 'UNAUTHENTICATED');
});

await test('les autres réponses sans corps (arrivée par un lien, 204) passent aussi', async () => {
  const r = await worker.fetch(new Request('https://s.t/arrivee?src=story'), ENV, CTX);
  assert.equal(r.status, 204);
  corsPresent(r);
});

await test('une URL illisible ne sort jamais sans CORS', async () => {
  const faux = { method: 'GET', url: 'pas une url', headers: new Headers() };
  const r = await worker.fetch(faux, ENV, CTX);
  assert.equal(r.status, 500);
  corsPresent(r);
});

await test('/sante dit quel accès à la base sert : compte de service, ou l’ancien secret à retirer', async () => {
  const lire = async (env) => (await (await worker.fetch(new Request('https://s.t/sante'), env, CTX)).json()).acces;
  assert.equal(await lire(ENV), 'secret_historique');
  const compte = JSON.stringify({ client_email: 'w@p.iam.gserviceaccount.com', private_key: '-----BEGIN PRIVATE KEY-----\nx\n-----END PRIVATE KEY-----\n' });
  assert.equal(await lire(Object.assign({}, ENV, { FIREBASE_SERVICE_ACCOUNT: compte })), 'compte_service');
  assert.equal(await lire({ FIREBASE_DB_URL: 'https://b' }), 'aucun');
});

console.log(ok + ' tests passés');
