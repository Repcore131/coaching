// L'aperçu des pages publiques (/@<pseudo>, /coach/<slug>), servi par le Worker.
// Le gabarit est le VRAI p/index.html (et c/index.html) du dépôt.
//   node --test cloudflare/test/pages.test.mjs
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { analyserChemin, ogAthlete, ogCoach, injecterOg, servirPagePublique, _viderMemoire, ORIGINE, CACHE_S } from '../src/pages.js';
import worker from '../src/index.js';

const racine = new URL('../../', import.meta.url);
const P = readFileSync(new URL('p/index.html', racine), 'utf8');
const C = readFileSync(new URL('c/index.html', racine), 'utf8');
const BASE = 'https://base.test';
const JULIE = { prenom: 'Julie', rang: { n: 3, nom: 'VOLTAGE' }, volts: { xp: 4100, de: 3800, a: 7500 }, seances: 42, serie: 6,
  semaines: '011111101111', meilleurs: [{ exo: 'SQUAT', kg: 100, date: 1 }] };

// Un faux réseau : l'hébergement (les gabarits) et la base (lecture publique).
function reseau(fiches, o) {
  const vus = [];
  const f = async (url) => {
    vus.push(String(url));
    if (o && o.panne) throw new Error('réseau');
    if (url === ORIGINE + '/p/index.html') return new Response(P, { status: 200 });
    if (url === ORIGINE + '/c/index.html') return new Response(C, { status: 200 });
    const m = /^https:\/\/base\.test\/(profils_publics|vitrines)\/([^.]+)\.json$/.exec(url);
    if (m) return new Response(JSON.stringify((fiches[m[1]] || {})[decodeURIComponent(m[2])] ?? null), { status: 200 });
    return new Response('?', { status: 404 });
  };
  return { f, vus };
}
// Un cache comme caches.default.
function fauxCache() {
  const m = new Map();
  return { m, match: async (r) => { const x = m.get(r.url); return x ? new Response(x) : undefined; },
    put: async (r, rep) => { m.set(r.url, await rep.text()); } };
}
const ctx = () => { const p = []; return { p, waitUntil: (x) => p.push(x) }; };
const req = (chemin, methode) => new Request('https://repcore-serveur.repcore.workers.dev' + chemin, { method: methode || 'GET' });
const og = (html, prop) => { const m = new RegExp('<meta (?:property|name)="' + prop + '" content="([^"]*)"').exec(html); return m ? m[1] : null; };

test('le chemin : /@pseudo et /coach/slug, rien d’autre', () => {
  assert.deepEqual(analyserChemin('/@julie.fit'), { type: 'athlete', cle: 'julie.fit' });
  assert.deepEqual(analyserChemin('/@Julie/'), { type: 'athlete', cle: 'julie' });
  assert.deepEqual(analyserChemin('/coach/kevin-guellec'), { type: 'coach', cle: 'kevin-guellec' });
  for (const x of ['/@ab', '/@a/b', '/coach/', '/coach/x', '/@%E0%A4%A', '/sante', '/@../x']) assert.equal(analyserChemin(x), null, x);
});

test('l’aperçu d’un athlète : prénom, rang, emblème 1200×630 — jamais une charge', () => {
  const o = ogAthlete('julie', JULIE);
  assert.equal(o.titre, 'Julie · rang VOLTAGE sur RepCore');
  assert.equal(o.image, ORIGINE + '/app/img/rangs/rang_3-og.jpg');
  assert.match(o.description, /42 séances · 6 semaines d’affilée/);
  assert.doesNotMatch(JSON.stringify(o), /100|kg|SQUAT/);
  assert.equal(ogAthlete('x', null), null);
  assert.equal(ogAthlete('x', { prenom: 'Lou' }).image, ORIGINE + '/og-image.png');
  assert.equal(ogCoach('k', { nom: 'Kévin', photo: 'http://pas-https' }).image, ORIGINE + '/og-image.png');
});

test('les rangs 1 à 10 ont chacun leur image og en 1200×630', () => {
  for (let n = 1; n <= 10; n++) {
    const b = readFileSync(new URL('app/img/rangs/rang_' + n + '-og.jpg', racine));
    // Le marqueur SOF du JPEG donne la taille.
    let i = 2, w = 0, h = 0;
    while (i < b.length) {
      const mk = b[i + 1], l = b.readUInt16BE(i + 2);
      if (mk >= 0xc0 && mk <= 0xc2) { h = b.readUInt16BE(i + 5); w = b.readUInt16BE(i + 7); break; }
      i += 2 + l;
    }
    assert.deepEqual([w, h], [1200, 630], 'rang ' + n);
  }
});

test('la page servie : le gabarit du dépôt, l’aperçu de Julie, <base> vers l’hébergement, 6 h de cache', async () => {
  _viderMemoire();
  const { f } = reseau({ profils_publics: { julie: JULIE } });
  const r = await servirPagePublique(req('/@julie?ref=JULIE7K2&src=bio'), { env: { FIREBASE_DB_URL: BASE }, fetchImpl: f, cache: null });
  assert.equal(r.status, 200);
  assert.match(r.headers.get('Content-Type'), /text\/html/);
  assert.equal(r.headers.get('Cache-Control'), 'public, max-age=' + CACHE_S + ', s-maxage=' + CACHE_S);
  assert.equal(CACHE_S, 21600);
  const h = await r.text();
  assert.equal(og(h, 'og:title'), 'Julie · rang VOLTAGE sur RepCore');
  assert.equal(og(h, 'og:image'), ORIGINE + '/app/img/rangs/rang_3-og.jpg');
  assert.equal(og(h, 'og:image:width'), '1200');
  assert.equal(og(h, 'og:url'), ORIGINE + '/@julie');
  assert.match(h, /<title>Julie · rang VOLTAGE sur RepCore<\/title>/);
  assert.match(h, /<head>\n<base href="https:\/\/repcore-sync\.web\.app\/">/);
  // Un seul bloc d'aperçu, et le reste de la page intact (le script qui la remplit).
  assert.equal((h.match(/og:title/g) || []).length, 1);
  assert.ok(h.includes(P.slice(P.indexOf('<!--og:fin-->'))));
});

test('une personne inconnue : la page, avec l’aperçu par défaut', async () => {
  _viderMemoire();
  const { f } = reseau({});
  const h = await (await servirPagePublique(req('/@personne'), { env: { FIREBASE_DB_URL: BASE }, fetchImpl: f, cache: null })).text();
  assert.equal(og(h, 'og:title'), 'Rejoins-moi sur RepCore');
});

test('le coach : nom, phrase, photo https', async () => {
  _viderMemoire();
  const { f } = reseau({ vitrines: { 'kevin-guellec': { nom: 'Kévin Guellec', phrase: 'La force, sans détour.', photo: 'https://res.cloudinary.com/k.jpg' } } });
  const h = await (await servirPagePublique(req('/coach/kevin-guellec'), { env: { FIREBASE_DB_URL: BASE }, fetchImpl: f, cache: null })).text();
  assert.equal(og(h, 'og:title'), 'Kévin Guellec : coaching sur RepCore');
  assert.equal(og(h, 'og:image'), 'https://res.cloudinary.com/k.jpg');
  assert.equal(og(h, 'og:description'), 'La force, sans détour.');
  assert.match(h, /\/vitrines\//);
});

test('mis en cache : la seconde demande ne relit ni la base ni l’hébergement', async () => {
  _viderMemoire();
  const { f, vus } = reseau({ profils_publics: { julie: JULIE } });
  const cache = fauxCache(), c = ctx();
  await servirPagePublique(req('/@julie'), { env: { FIREBASE_DB_URL: BASE }, fetchImpl: f, cache, ctx: c });
  await Promise.all(c.p);
  assert.equal(vus.length, 2);
  assert.ok(cache.m.has('https://repcore-serveur.repcore.workers.dev/@julie'));
  const r2 = await servirPagePublique(req('/@julie?src=story'), { env: { FIREBASE_DB_URL: BASE }, fetchImpl: f, cache, ctx: ctx() });
  assert.equal(r2.headers.get('X-RepCore-Apercu'), 'cache');
  assert.equal(vus.length, 2);
  // Sans cache Cloudflare (*.workers.dev) : la mémoire de l'instance, 6 h.
  let t = 1000;
  const r3 = await servirPagePublique(req('/@julie'), { env: { FIREBASE_DB_URL: BASE }, fetchImpl: f, cache: null, maintenant: () => t });
  assert.equal(r3.headers.get('X-RepCore-Apercu'), 'memoire');
  assert.equal(vus.length, 2);
  _viderMemoire();
  await servirPagePublique(req('/@julie'), { env: { FIREBASE_DB_URL: BASE }, fetchImpl: f, cache: null, maintenant: () => t });
  t += CACHE_S * 1000 + 1;
  const r4 = await servirPagePublique(req('/@julie'), { env: { FIREBASE_DB_URL: BASE }, fetchImpl: f, cache: null, maintenant: () => t });
  assert.equal(r4.headers.get('X-RepCore-Apercu'), 'neuf', 'au-delà de 6 h, relu');
});

test('en panne : redirection vers la page statique, paramètres gardés — jamais une 500', async () => {
  _viderMemoire();
  const { f } = reseau({}, { panne: true });
  const r = await servirPagePublique(req('/@julie?ref=JULIE7K2&src=bio'), { env: { FIREBASE_DB_URL: BASE }, fetchImpl: f, cache: null });
  assert.equal(r.status, 302);
  assert.equal(r.headers.get('Location'), ORIGINE + '/p/?u=julie&ref=JULIE7K2&src=bio');
  const r2 = await servirPagePublique(req('/coach/kevin-guellec'), { env: { FIREBASE_DB_URL: BASE }, fetchImpl: f, cache: null });
  assert.equal(r2.headers.get('Location'), ORIGINE + '/c/?s=kevin-guellec');
});

test('HEAD : les en-têtes sans le corps ; injecterOg sans aperçu garde la page', async () => {
  _viderMemoire();
  const { f } = reseau({ profils_publics: { julie: JULIE } });
  const r = await servirPagePublique(req('/@julie', 'HEAD'), { env: { FIREBASE_DB_URL: BASE }, fetchImpl: f, cache: null });
  assert.equal(r.status, 200);
  assert.equal(await r.text(), '');
  const x = injecterOg(P, null, 'athlete');
  assert.equal(x.replace('\n<base href="' + ORIGINE + '/">', ''), P);
});

test('le Worker route /@ et /coach/ vers la page, le reste ne change pas', async () => {
  _viderMemoire();
  const { f } = reseau({ profils_publics: { julie: JULIE } });
  const sv = globalThis.fetch;
  globalThis.fetch = f;
  try {
    const r = await worker.fetch(req('/@julie'), { FIREBASE_DB_URL: BASE }, ctx());
    assert.equal(r.status, 200);
    assert.match(await r.text(), /og:title" content="Julie · rang VOLTAGE/);
    const n = await worker.fetch(req('/@a'), { FIREBASE_DB_URL: BASE }, ctx());
    assert.equal(n.status, 404);
    const s = await worker.fetch(req('/sante'), { FIREBASE_DB_URL: BASE }, ctx());
    assert.equal(s.status, 200);
  } finally { globalThis.fetch = sv; }
});

test('firebase.json redirige /@ et /coach/ vers le Worker (et garde les réécritures en secours)', () => {
  const fj = JSON.parse(readFileSync(new URL('firebase.json', racine), 'utf8'));
  const red = fj.hosting.redirects || [];
  const a = red.find((x) => /\^\/@/.test(x.regex || '')), c = red.find((x) => /\^\/coach\//.test(x.regex || ''));
  assert.ok(a && c, 'redirections absentes');
  assert.equal(a.destination, 'https://repcore-serveur.repcore.workers.dev/@:pseudo');
  assert.equal(c.destination, 'https://repcore-serveur.repcore.workers.dev/coach/:slug');
  assert.equal(a.type, 302);
  // La regex prend les pseudos valides, pas un chemin plus profond.
  const re = new RegExp(a.regex.replace('?P<pseudo>', ''));
  assert.ok(re.test('/@julie.fit') && re.test('/@julie/') && !re.test('/@julie/x') && !re.test('/@ab'));
  assert.ok(fj.hosting.rewrites.some((x) => x.source === '/@*'));
});
