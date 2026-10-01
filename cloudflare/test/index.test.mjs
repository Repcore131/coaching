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
import { fausseBase } from './fausse-base.mjs';
import { _reinitPouls } from '../src/pouls.js';

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

await test('/sante?cles=1 (administrateur) dit toujours le mode d’accès : compte de service, ou l’ancien secret à retirer', async () => {
  const vrai = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('hors ligne'); };
  try {
    const lire = async (env) => (await (await worker.fetch(new Request('https://s.t/sante?cles=1', { headers: { Authorization: 'Bearer secret-admin-assez-long' } }),
      Object.assign({ ADMIN_SECRET: 'secret-admin-assez-long' }, env), CTX)).json()).acces;
    assert.equal(await lire(ENV), 'secret_historique');
    const compte = JSON.stringify({ client_email: 'w@p.iam.gserviceaccount.com', private_key: '-----BEGIN PRIVATE KEY-----\nx\n-----END PRIVATE KEY-----\n' });
    assert.equal(await lire(Object.assign({}, ENV, { FIREBASE_SERVICE_ACCOUNT: compte })), 'compte_service');
    assert.equal(await lire({ FIREBASE_DB_URL: 'https://b' }), 'aucun');
  } finally { globalThis.fetch = vrai; }
});

// ══ LES LIMITES (01/10/2026) : aucune route publique sans limite ═══════════
// Un limiteur factice qui imite [[ratelimits]] : `limit` appels par fenêtre de
// `periode` ms, par clé (l'adresse IP), sur une horloge qu'on avance à la main.
function limiteur(limit, periode, horloge) {
  const vus = {};
  return { async limit({ key }) {
    const t = horloge();
    const l = (vus[key] || []).filter((x) => t - x < periode);
    l.push(t); vus[key] = l;
    return { success: l.length <= limit };
  } };
}
// La base des tests : rien ne part sur le réseau, ce que le Worker écrit
// (le seau des 429) atterrit dans une base en mémoire.
const F = fausseBase({ worker: { verrou: { jusqua: Date.now() + 3600e3 } } });
const fetchReel = globalThis.fetch;
globalThis.fetch = (u, i) => F.fetchImpl(String(u), i);
const enAttente = [];
const CTX2 = { waitUntil(p) { enAttente.push(p); } };
const ENV2 = { FIREBASE_DB_URL: 'https://base.test', FIREBASE_DB_SECRET: 's' };

await test('/reveil en GET : 405, avec les en-têtes CORS ; en POST : 202', async () => {
  const g = await worker.fetch(new Request('https://s.t/reveil'), ENV2, CTX2);
  assert.equal(g.status, 405);
  corsPresent(g);
  const p = await worker.fetch(new Request('https://s.t/reveil', { method: 'POST' }), ENV2, CTX2);
  assert.equal(p.status, 202);
  await Promise.all(enAttente.splice(0));
});

await test('/reveil : 6 appels en 60 s passent, le 7e reçoit 429 ; une autre IP passe ; une minute plus tard, ça repasse', async () => {
  let t = 1_000_000;
  const env = Object.assign({}, ENV2, { LIMITE_REVEIL: limiteur(6, 60_000, () => t) });
  const appel = (ip) => worker.fetch(new Request('https://s.t/reveil', { method: 'POST', headers: { 'CF-Connecting-IP': ip } }), env, CTX2);
  for (let i = 0; i < 6; i++) { assert.equal((await appel('1.2.3.4')).status, 202, 'appel ' + (i + 1)); t += 5_000; }
  const r7 = await appel('1.2.3.4');
  assert.equal(r7.status, 429);
  corsPresent(r7);
  assert.equal((await appel('5.6.7.8')).status, 202);
  t += 60_000;
  assert.equal((await appel('1.2.3.4')).status, 202);
  await Promise.all(enAttente.splice(0));
});

await test('LIMITE_ROUTES couvre toute route (pages, santé, fonctions), mais jamais la pré-vérification OPTIONS', async () => {
  const env = Object.assign({}, ENV2, { LIMITE_ROUTES: { async limit() { return { success: false }; } } });
  for (const [m, c] of [['GET', '/sante'], ['GET', '/@lea'], ['POST', '/fn/redeemCode'], ['POST', '/paypal'], ['GET', '/arrivee'], ['POST', '/sante/i']]) {
    const r = await worker.fetch(new Request('https://s.t' + c, { method: m }), env, CTX2);
    assert.equal(r.status, 429, m + ' ' + c);
  }
  assert.equal((await worker.fetch(new Request('https://s.t/fn/redeemCode', { method: 'OPTIONS' }), env, CTX2)).status, 204);
  await Promise.all(enAttente.splice(0));
});

await test('chaque 429 servi est compté dans worker/pouls_429/<heure UTC>', async () => {
  _reinitPouls();
  F.ecrire('worker/pouls_429', null);
  const env = Object.assign({}, ENV2, { LIMITE_ROUTES: { async limit() { return { success: false }; } } });
  for (let i = 0; i < 5; i++) await worker.fetch(new Request('https://s.t/sante'), env, CTX2);
  await Promise.all(enAttente.splice(0));
  const seaux = F.lire('worker/pouls_429') || {};
  const total = Object.values(seaux).reduce((a, n) => a + n, 0);
  // Le premier 429 verse le compte ; les suivants attendent la minute
  // suivante (ou la tâche programmée) pour être versés.
  assert.ok(total >= 1 && total <= 5, JSON.stringify(seaux));
  assert.match(Object.keys(seaux)[0], /^20\d{8}$/);
});

// ══ /sante : LE POULS (01/10/2026) ══════════════════════════════════════════
await test('/sante : 503 sans pouls, 503 si le pouls a plus de 5 min, 200 sinon ; jamais « acces » ni secret', async () => {
  const lire = async () => { const r = await worker.fetch(new Request('https://s.t/sante'), ENV2, CTX2); const texte = await r.text(); return { r, texte, j: JSON.parse(texte) }; };
  F.ecrire('worker/verrou', { jusqua: 0 });
  let x = await lire();
  assert.equal(x.r.status, 503); assert.equal(x.j.ok, false); assert.equal(x.j.raison, 'pouls_absent');
  corsPresent(x.r);
  F.ecrire('worker/verrou/pouls', { t: Date.now() - 6 * 60e3, requetes: 5, evenements: 0, echecs: 0, erreur: null, source: 'cron' });
  x = await lire();
  assert.equal(x.r.status, 503); assert.equal(x.j.raison, 'pouls_ancien'); assert.ok(x.j.derniereMinuteIlYA_s >= 360);
  F.ecrire('worker/verrou/pouls/t', Date.now() - 40e3);
  F.ecrire('evenements_ko', { k1: { type: 'message' }, k2: { type: 'reaction' } });
  F.ecrire('evenements', { e1: { type: 'x' }, e2: { type: 'y' }, e3: { type: 'z' } });
  x = await lire();
  assert.equal(x.r.status, 200, x.texte);
  assert.equal(x.j.ok, true); assert.equal(x.j.ko, 2); assert.equal(x.j.file, 3);
  assert.ok(x.j.derniereMinuteIlYA_s >= 40 && x.j.derniereMinuteIlYA_s < 60);
  assert.ok(!/acces|secret|paypal|cloudinary/.test(x.texte), x.texte);
  // Une file de plus de 50 : « 50+ », sans tout lire.
  F.ecrire('evenements', Object.fromEntries(Array.from({ length: 60 }, (_, i) => ['e' + String(i).padStart(3, '0'), { type: 'x' }])));
  assert.equal((await lire()).j.file, '50+');
  F.ecrire('evenements', null); F.ecrire('evenements_ko', null); F.ecrire('worker/verrou', null);
  await Promise.all(enAttente.splice(0));
});

await test('/sante : une base injoignable (secret faux, réseau) donne 503', async () => {
  const f0 = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, status: 401, headers: { get: () => null }, text: async () => '{"error":"Permission denied"}', json: async () => ({ error: 'Permission denied' }) });
  try {
    const r = await worker.fetch(new Request('https://s.t/sante'), ENV2, CTX2);
    assert.equal(r.status, 503);
    assert.equal((await r.json()).raison, 'base_injoignable');
  } finally { globalThis.fetch = f0; }
});

await test('/sante : une réponse calculée est gardée 30 s (caches.default) — pas de lecture de la base au second appel', async () => {
  const magasin = new Map();
  globalThis.caches = { default: { match: async (q) => (magasin.get(q.url) || undefined) && magasin.get(q.url).clone(),
    put: async (q, r) => { magasin.set(q.url, r); } } };
  try {
    F.ecrire('worker/verrou/pouls', { t: Date.now(), requetes: 5 });
    const avant = F.requetes();
    const r1 = await worker.fetch(new Request('https://s.t/sante'), ENV2, CTX2);
    await Promise.all(enAttente.splice(0));
    const lus = F.requetes() - avant;
    assert.equal(r1.status, 200);
    assert.ok(lus >= 1 && lus <= 3, lus + ' lectures');
    assert.match(magasin.get('https://s.t/sante').headers.get('Cache-Control'), /max-age=30/);
    const r2 = await worker.fetch(new Request('https://s.t/sante?x=1'), ENV2, CTX2);
    assert.equal(r2.status, 200);
    assert.equal(F.requetes() - avant, lus, 'servi par le cache');
  } finally { delete globalThis.caches; F.ecrire('worker/verrou', null); }
});
globalThis.fetch = fetchReel;

console.log(ok + ' tests passés');
