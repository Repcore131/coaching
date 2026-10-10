// Les contacts e-mail vers Systeme.io : consentement, file, débit, erreurs, guide.
//   node cloudflare/test/systemeio.test.mjs
import assert from 'node:assert/strict';
import { creerBase } from '../src/base.js';
import { creerSystemeio, delaiEssai, aRetenter, emailValide, statutContact, SIO_PAR_MINUTE, SIO_ESSAIS_MAX, LEAD_PAR_IP_JOUR } from '../src/systemeio.js';
import { travaux } from '../src/planif.js';
import { fausseBase } from './fausse-base.mjs';

let ok = 0;
const test = async (nom, fn) => { await fn(); ok++; console.log('ok  ', nom); };
const T0 = Date.parse('2026-10-11T10:00:00+02:00');
const ENV = { SYSTEMEIO_API_KEY: 'k', SYSTEMEIO_TAG: 'repcore', LEAD_OUVERT: 'oui' };

// Un faux Systeme.io : contacts en mémoire, réponses forçables par étape.
function monde(initial, o) {
  const opt = o || {};
  const F = fausseBase(initial);
  const w = { F, t: T0, appels: [], contacts: {}, suivant: 100, tags: opt.tags || [{ id: 7, name: 'repcore' }], forcer: opt.forcer || {} };
  const repondre = (statut, corps, entetes) => ({ ok: statut < 400, status: statut, json: async () => corps,
    headers: { get: (k) => (entetes || {})[k] || null } });
  const fetchImpl = async (url, init) => {
    const u = String(url);
    if (!u.startsWith('https://api.systeme.io/api')) return F.fetchImpl(url, init);
    const chemin = u.slice('https://api.systeme.io/api'.length), m = init.method || 'GET';
    const etape = m + ' ' + chemin.split('?')[0].replace(/\/\d+/g, '/:id');
    w.appels.push(etape);
    const f = w.forcer[etape];
    if (f) { const r = typeof f === 'function' ? f(init) : f; if (r) return r === 'reseau' ? Promise.reject(new Error('réseau')) : repondre(r.statut, r.corps || {}, r.entetes); }
    if (etape === 'GET /contacts') {
      const e = decodeURIComponent(chemin.split('email=')[1] || '');
      const c = Object.values(w.contacts).find((x) => x.email === e);
      return repondre(200, { items: c ? [c] : [] });
    }
    if (etape === 'POST /contacts') { const b = JSON.parse(init.body); const c = { id: w.suivant++, email: b.email, fields: b.fields, tags: [] }; w.contacts[c.id] = c; return repondre(201, c); }
    if (etape === 'PATCH /contacts/:id') { const id = Number(chemin.split('/')[2]); w.contacts[id].fields = JSON.parse(init.body).fields; return repondre(200, w.contacts[id]); }
    if (etape === 'DELETE /contacts/:id') { delete w.contacts[Number(chemin.split('/')[2])]; return repondre(204, null); }
    if (etape === 'GET /tags') return repondre(200, { items: w.tags });
    if (etape === 'POST /tags') { const t = { id: 9, name: JSON.parse(init.body).name }; w.tags.push(t); return repondre(201, t); }
    if (etape === 'POST /contacts/:id/tags') { const id = Number(chemin.split('/')[2]); w.contacts[id].tags.push(JSON.parse(init.body).tagId); return repondre(204, null); }
    return repondre(404, {});
  };
  const db = creerBase({ url: 'https://b.t', auth: 's', fetchImpl });
  let reste = opt.reste === undefined ? Infinity : opt.reste;
  w.S = creerSystemeio({ db, env: opt.env || ENV, fetchImpl, maintenant: () => w.t, reste: () => reste });
  w.minute = () => w.S.minute(w.t);
  w.file = () => w.F.lire('sio_file') || {};
  return w;
}
const user = (plus) => Object.assign({ role: 'athlete', status: 'FREE', fname: 'Léa', email: 'lea@t.fr', origine: { src: 'insta' } }, plus || {});

await test('PURE : délais 1, 2, 4… 60 min ; quoi retenter ; e-mail ; statut', async () => {
  assert.deepEqual([1, 2, 3, 4, 7, 12].map((n) => delaiEssai(n) / 60e3), [1, 2, 4, 8, 60, 60]);
  assert.deepEqual([0, 429, 500, 503, 400, 404, 422].map(aRetenter), [true, true, true, true, false, false, false]);
  assert.ok(emailValide('a@b.fr') && !emailValide('a@b') && !emailValide('a b@c.fr') && !emailValide(''));
  assert.equal(statutContact({ status: 'AUTONOMIE_PREMIUM' }), 'payant');
  assert.equal(statutContact({ status: 'FREE' }), 'essai');
});

await test('CONSENTEMENT ABSENT → aucune synchro (le drapeau seul ne suffit pas)', async () => {
  const w = monde({ users: { 'lea@t,fr': user(), 'non@t,fr': user({ email: 'non@t.fr', consentements: { email: { accepte: false, le: T0 } } }) },
    email_optin: { 'lea@t,fr': { le: T0, accepte: true }, 'non@t,fr': { le: T0, accepte: true } } });
  const b = await w.minute();
  assert.deepEqual(b.optins, { 'lea@t,fr': 'sans_consentement', 'non@t,fr': 'sans_consentement' });
  assert.deepEqual(w.appels, []);
  assert.deepEqual(w.file(), {});
  assert.ok(w.F.lire('email_optin/lea@t,fr'));                      // récent : gardé (le dossier peut arriver après)
  w.t += 3600e3 + 1;
  await w.minute();
  assert.deepEqual(w.appels, []);
  assert.deepEqual(w.file(), {});
  assert.equal(w.F.lire('email_optin'), null);                      // une heure plus tard : oublié, toujours rien de synchronisé
});

await test('CONSENTEMENT DONNÉ → contact créé avec source, date, statut, et l’étiquette du plan gratuit', async () => {
  const w = monde({ users: { 'lea@t,fr': user({ consentements: { email: { accepte: true, le: T0 } } }) }, email_optin: { 'lea@t,fr': { le: T0, accepte: true } } });
  const b = await w.minute();
  assert.equal(b.faites, 1);
  const c = Object.values(w.contacts)[0];
  assert.equal(c.email, 'lea@t.fr');
  assert.deepEqual(c.fields, [{ slug: 'first_name', value: 'Léa' }, { slug: 'source', value: 'insta' }, { slug: 'date_inscription', value: '2026-10-11' }, { slug: 'statut', value: 'essai' }]);
  assert.deepEqual(c.tags, [7]);
  assert.deepEqual(w.file(), {});
  // Une seconde fois (paiement) : mise à jour, pas de doublon ; l'étiquette est gardée en mémoire.
  await w.S.contactDuCompte('lea@t,fr', 'payant');
  w.appels.length = 0;
  await w.minute();
  assert.deepEqual(w.appels, ['GET /contacts', 'PATCH /contacts/:id', 'POST /contacts/:id/tags']);
  assert.equal(Object.keys(w.contacts).length, 1);
  assert.equal(Object.values(w.contacts)[0].fields[3].value, 'payant');
});

await test('LIMITE DE DÉBIT : 30 requêtes par minute au plus, même sur deux exécutions ; la suite à la minute d’après', async () => {
  const w = monde({});
  for (let i = 0; i < 20; i++) await w.S.enfiler({ op: 'contact', email: 'x' + i + '@t.fr', statut: 'prospect' });
  await w.minute();
  assert.ok(w.appels.length <= SIO_PAR_MINUTE, w.appels.length + ' appels');
  const n1 = w.appels.length;
  await w.minute();                                               // même minute : plus rien ou presque
  assert.ok(w.appels.length <= SIO_PAR_MINUTE, 'deuxième exécution : ' + w.appels.length);
  const avant = Object.keys(w.file()).length;
  assert.ok(avant > 0 && n1 > 0);
  w.t += 60e3;
  await w.minute();
  assert.ok(Object.keys(w.file()).length < avant);
  // Et jamais au-delà du budget de l'exécution (sous-requêtes Cloudflare).
  const p = monde({}, { reste: 8 });
  await p.S.enfiler({ op: 'contact', email: 'a@t.fr' });
  await p.minute();
  assert.deepEqual(p.appels, []);
});

await test('ERREURS : 5xx et réseau retentés plus tard, 4xx définitif, 429 suspend la file, abandon au 8e échec', async () => {
  const w = monde({}, { forcer: { 'GET /contacts': { statut: 503 } } });
  await w.S.enfiler({ op: 'contact', email: 'a@t.fr' });
  const b = await w.minute();
  assert.equal(b.reportees, 1);
  const op = Object.values(w.file())[0];
  assert.equal(op.essais, 1); assert.equal(op.prochain, T0 + 60e3);
  // Pas avant l'heure.
  w.appels.length = 0; await w.minute(); assert.deepEqual(w.appels, []);
  // Au 8e échec : sio_echecs.
  for (let i = 0; i < SIO_ESSAIS_MAX; i++) { w.t += 3600e3; await w.minute(); }
  assert.deepEqual(w.file(), {});
  assert.equal(Object.values(w.F.lire('sio_echecs'))[0].statut, 503);
  // Réseau coupé : retenté.
  const r = monde({}, { forcer: { 'GET /contacts': 'reseau' } });
  await r.S.enfiler({ op: 'contact', email: 'a@t.fr' });
  assert.equal((await r.minute()).reportees, 1);
  // 400 : définitif tout de suite.
  const d = monde({}, { forcer: { 'POST /contacts': { statut: 400 } } });
  await d.S.enfiler({ op: 'contact', email: 'a@t.fr' });
  assert.equal((await d.minute()).echecs, 1);
  assert.equal(Object.values(d.F.lire('sio_echecs'))[0].etape, 'creation');
  // 429 : la file entière attend ce que Systeme.io demande.
  const q = monde({}, { forcer: { 'GET /contacts': { statut: 429, entetes: { 'Retry-After': '120' } } } });
  await q.S.enfiler({ op: 'contact', email: 'a@t.fr' }); await q.S.enfiler({ op: 'contact', email: 'b@t.fr' });
  await q.minute();
  assert.equal(q.appels.length, 1);
  assert.equal(q.F.lire('worker/sio/debit/pauseJusqua'), T0 + 120e3);
  q.appels.length = 0; q.t += 60e3; assert.equal((await q.minute()).etat, 'pause_429');
  assert.deepEqual(q.appels, []);
});

await test('422 sur les champs personnalisés (pas créés dans Systeme.io) : le contact passe sans eux, l’échec est noté', async () => {
  let n = 0;
  const w = monde({}, { forcer: { 'POST /contacts': () => (n++ === 0 ? { statut: 422, corps: { detail: 'field' } } : null) } });
  await w.S.enfiler({ op: 'contact', email: 'a@t.fr', prenom: 'A', source: 'x', statut: 'essai' });
  await w.minute();
  assert.equal(Object.keys(w.contacts).length, 1);
  assert.deepEqual(Object.values(w.contacts)[0].fields, [{ slug: 'first_name', value: 'A' }]);
  assert.equal(Object.values(w.F.lire('sio_echecs'))[0].raison, 'champs_refuses');
  assert.deepEqual(w.file(), {});
});

await test('ÉTIQUETTE absente chez Systeme.io : créée une fois, puis gardée', async () => {
  const w = monde({}, { tags: [] });
  await w.S.enfiler({ op: 'contact', email: 'a@t.fr' }); await w.S.enfiler({ op: 'contact', email: 'b@t.fr' });
  await w.minute();
  assert.equal(w.appels.filter((x) => x === 'POST /tags').length, 1);
  assert.equal(w.appels.filter((x) => x === 'GET /tags').length, 1);
  assert.equal(w.F.lire('worker/sio/tags/repcore'), 9);
});

await test('NON CONFIGURÉ (pas de clé) : rien ne part, la file attend', async () => {
  const w = monde({}, { env: {} });
  await w.S.enfiler({ op: 'contact', email: 'a@t.fr' });
  assert.equal((await w.minute()).etat, 'non_configure');
  assert.deepEqual(w.appels, []);
  assert.equal(Object.keys(w.file()).length, 1);
});

await test('GUIDE (/lead) : champ piège, e-mail, accord, 5 par IP et par jour (IP hachée), fermé tant que non configuré', async () => {
  const w = monde({});
  const ok1 = await w.S.lead({ prenom: 'Zoé', email: 'Zoe@T.fr', accord: true, src: 'tiktok' }, '1.2.3.4');
  assert.equal(ok1.statut, 200);
  const op = Object.values(w.file())[0];
  assert.deepEqual([op.email, op.prenom, op.source, op.statut], ['zoe@t.fr', 'Zoé', 'guide_tiktok', 'prospect']);
  assert.equal(w.F.lire('leads/zoe@t,fr').texte, 'guide-cycle-v1');
  const ip = JSON.stringify(w.F.lire('lead_ip'));
  assert.ok(!ip.includes('1.2.3.4'));                               // jamais l'IP en clair
  // Piège rempli : « succès » pour le robot, rien en file.
  assert.deepEqual((await w.S.lead({ email: 'bot@t.fr', accord: true, site: 'http://x' }, '9.9.9.9')).corps, { ok: true });
  assert.equal(Object.keys(w.file()).length, 1);
  assert.equal((await w.S.lead({ email: 'pas-un-mail', accord: true }, '1.2.3.5')).statut, 400);
  assert.equal((await w.S.lead({ email: 'a@t.fr' }, '1.2.3.5')).corps.raison, 'accord');
  for (let i = 1; i < LEAD_PAR_IP_JOUR; i++) assert.equal((await w.S.lead({ email: 'a' + i + '@t.fr', accord: true }, '1.2.3.4')).statut, 200);
  assert.equal((await w.S.lead({ email: 'trop@t.fr', accord: true }, '1.2.3.4')).statut, 429);
  // Le lendemain, le compteur repart (et l'ancien est purgé).
  w.t += 864e5;
  assert.equal((await w.S.lead({ email: 'demain@t.fr', accord: true }, '1.2.3.4')).statut, 200);
  await w.minute();
  assert.deepEqual(Object.keys(w.F.lire('lead_ip')), ['2026-10-12']);
  const f = monde({}, { env: { SYSTEMEIO_API_KEY: 'k' } });
  assert.equal(f.S.leadOuvert(), false);
  assert.equal((await f.S.lead({ email: 'a@t.fr', accord: true }, '1')).statut, 503);
});

await test('SUPPRESSION DU COMPTE : le contact est supprimé chez Systeme.io (DELETE), et rien d’autre ne reste', async () => {
  const w = monde({ users: { 'lea@t,fr': user({ consentements: { email: { accepte: true, le: T0 } } }) }, email_optin: { 'lea@t,fr': { le: T0, accepte: true } } });
  await w.minute();
  assert.equal(Object.keys(w.contacts).length, 1);
  await w.S.contactDuCompte('lea@t,fr', 'payant');             // une mise à jour encore en file…
  const r = await w.S.appel({ auth: { email: 'lea@t.fr' }, data: { action: 'supprimer' } });
  assert.equal(r.ok, true);
  const ops = Object.values(w.file());
  assert.deepEqual(ops.map((x) => x.op), ['supprimer']);       // …retirée : elle ne recréerait pas le contact
  w.t += 60e3;
  await w.minute();
  assert.deepEqual(w.contacts, {});
  assert.ok(w.appels.includes('DELETE /contacts/:id'));
  // Un compte qui n'était pas contact : rien à supprimer, sans erreur.
  const v = monde({});
  await v.S.appel({ auth: { email: 'x@t.fr' }, data: { action: 'supprimer' } });
  assert.equal((await v.minute()).faites, 1);
});

await test('planif : « systemeio » chaque minute', async () => {
  const j = travaux({ planifies: {} }).find((x) => x.nom === 'systemeio');
  assert.ok(j && j.minute && j.quand({ heure: 3, minute: 7 }));
});

console.log('\n' + ok + ' tests verts (Systeme.io).');
