// Lot H, point 6 : catalogue des notifications commerciales (appli et serveur d'envoi).
//   TZ=Europe/Paris node --test club/tests/notifs-catalogue.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { chargerAppli } from '../outils/fitpulse-rapport.mjs';
import { plan, passagePush, pausesAuto } from '../outils/fitpulse-push.mjs';

const S0 = () => ({ clubs: { k: { id: 'k', name: 'Club' } }, kpis: { contrats: { id: 'contrats', label: 'Contrats signés', unit: 'qty', enabled: true, required: true, points: 1000, order: 1 } },
  users: { v: { id: 'v', first: 'Léa', last: 'B', role: 'membre', status: 'active', clubs: ['k'] } }, entries: {}, prefs: {} });
// Un mardi de travail, à 11 h, heure de Paris
const mardi = h => new Date(`2026-10-13T${h}:00+02:00`);
const cat = n => (uid, ctx) => ({ W: ctx.W, items: [...Array(n)].map((_, i) => ({ type: 't' + i, key: `t${i}_${ctx.jour}`, title: 'Titre', body: '1 relance due.', url: '#/relances', on: true, priority: 'normal', cooldownMin: 0 })) });

test('chaque type ouvre l’écran indiqué ; aucun montant ni nom de client', () => {
  const run = chargerAppli(S0()); run(`CLUB = S.clubs.k; ME = S.users.v`);
  const L = JSON.parse(run(`JSON.stringify(Object.entries(NOTIF_TYPES).map(([id, T]) => [id, T.ex, T.label]))`));
  assert.deepEqual(L.map(x => x[0]), ['dayStart', 'dueFollowup', 'overtaken', 'challengeStart', 'kudos', 'palierNear', 'dayWrap', 'wrapReady']);
  const urls = JSON.parse(run(`JSON.stringify(Object.values(NOTIF_TYPES).map(T => T.build({ n: 2, r: 1, qui: 'Lucas', k: 'contrats', d: 1, t: 'Défi', end: Date.now() + 36e5, reste: 3, f: 2, s: 12, mk: '2026-09', uid: 'v' })))`));
  for (const u of urls) { const route = u.url.replace(/^#\//, '').split('/')[0]; assert.equal(run(`!!PAGES['${route}']`), true, u.url); assert.doesNotMatch(u.title + u.body, /€|[–—]|\p{Extended_Pictographic}/u); }
  assert.equal(urls[1].body, '2 relances dues.');
});
test('au plus 6 push par jour, jamais entre 20 h 30 et 8 h, rien un jour de repos', async () => {
  const S = S0(); const ecdh = crypto.createECDH('prime256v1'); ecdh.generateKeys();
  const sub = { endpoint: 'https://push.exemple/abc', keys: { p256dh: ecdh.getPublicKey().toString('base64url'), auth: crypto.randomBytes(16).toString('base64url') } };
  const db = { fitpulse_secret: { watch: {}, lastRun: Date.now() - 6e5 }, pulse_push: { v: { h1: sub } } }; const ecrits = [];
  const api = async (tk, path, o = {}) => { if (o.method) ecrits.push([path, o.method, o.body]); const k = path.replace('.json', '').split('?')[0]; return { json: async () => (k === 'fitpulse_secret' ? db.fitpulse_secret : k === 'pulse_push' ? db.pulse_push : k === 'pulse_inbox' ? {} : null) }; };
  const envoyes = []; globalThis.fetch = async (url) => { envoyes.push(url); return { status: 201 }; };
  const r = await passagePush(api, 't', S, null, { catalogue: cat(10), now: mardi('11:00') });
  assert.equal(r.sent, 6); assert.equal(r.inbox, 10);
  const nuit = plan(S, { watch: {} }, mardi('21:00'), { catalogue: cat(2) }); assert.ok(nuit.items.length === 2 && nuit.items.every(x => !x.push));
  const tot = plan(S, { watch: {} }, mardi('07:30'), { catalogue: cat(2) }); assert.ok(tot.items.every(x => !x.push));
  const repos = plan(S, { watch: {} }, mardi('11:00'), { catalogue: (u, c) => ({ ...cat(2)(u, c), repos: true }) }); assert.ok(repos.items.every(x => !x.push));
});
test('regroupement : 2 événements du même type en moins de 10 minutes = 1 seule alerte', async () => {
  const S = S0(); const ecdh = crypto.createECDH('prime256v1'); ecdh.generateKeys();
  const sub = { endpoint: 'https://push.exemple/abc', keys: { p256dh: ecdh.getPublicKey().toString('base64url'), auth: crypto.randomBytes(16).toString('base64url') } };
  const db = { fitpulse_secret: { watch: {}, lastRun: Date.now() - 6e5 }, pulse_push: { v: { h1: sub } } };
  const api = async (tk, path) => { const k = path.replace('.json', '').split('?')[0]; return { json: async () => (k === 'fitpulse_secret' ? db.fitpulse_secret : k === 'pulse_push' ? db.pulse_push : null) }; };
  globalThis.fetch = async () => ({ status: 201 });
  const deux = (uid, ctx) => ({ W: ctx.W, items: [1, 2].map(i => ({ type: 'kudos', key: 'kd' + i, title: 'Bravo', body: '1 bravo reçu.', url: '#/pouls', on: true, priority: 'normal', cooldownMin: 0 })) });
  const r = await passagePush(api, 't', S, null, { catalogue: deux, now: mardi('11:00') });
  assert.equal(r.sent, 1); assert.equal(r.inbox, 2);
});
test('type décoché : plus envoyé ; prioritaire, il reste dans la boîte de réception', () => {
  const S = S0();
  const c = (uid, ctx) => ({ W: ctx.W, items: [{ type: 'dueFollowup', key: 'due', title: 'Relances', body: '1 relance due.', url: '#/relances', on: false, priority: 'high' }, { type: 'kudos', key: 'kd', title: 'Bravo', body: '1 bravo reçu.', url: '#/pouls', on: false, priority: 'normal' }] });
  const p = plan(S, { watch: {} }, mardi('11:00'), { catalogue: c });
  assert.deepEqual(p.items.map(x => [x.rule, x.push]), [['dueFollowup', false]]);
});
test('catalogue de l’appli : jour de repos sans rien ; relances dues sans nom ni montant', () => {
  const S = S0(); S.clients = { c1: { id: 'c1', clubId: 'k', name: 'Paul Exemple', phone: '0611223344', balance: 80, dunning: { ownerId: 'v', next: '2026-10-01', status: 'relance' } } };
  const run = chargerAppli(S);
  const r = JSON.parse(run(`JSON.stringify(notifCatalogue('v', { jour: today(), hm: '10:45', last: 0, W: {} }))`));
  if (r.repos) assert.equal(r.items.length, 0);
  else { const d = r.items.find(x => x.type === 'dueFollowup'); if (d) { assert.match(d.body, /^\d+ relances? dues?\.$/); assert.doesNotMatch(d.body, /Paul|80/); } }
  const dim = JSON.parse(run(`JSON.stringify(notifCatalogue('v', { jour: '2026-10-11', hm: '10:45', last: 0, W: {} }))`)); assert.equal(dim.repos, true); assert.equal(dim.items.length, 0);
});
test('mesure : moins de 5 % d’ouverture sur 30 jours = type mis en pause et message dans la boîte', () => {
  const now = Date.now(); const L = {}; for (let i = 0; i < 25; i++) L['n' + i] = { kind: 'kudos', at: now - i * 864e5 / 2, push: true, ...(i === 0 ? { readAt: now } : {}) };
  for (let i = 0; i < 25; i++) L['m' + i] = { kind: 'dayStart', at: now - i * 864e5 / 2, push: true, ...(i < 5 ? { readAt: now } : {}) };
  const pz = pausesAuto({ prefs: {} }, { v: L }, now, { kudos: 'Bravos reçus' });
  assert.deepEqual(Object.keys(pz.prefs).sort(), ['v/notif/pauses/kudos', 'v/notif/rules/kudos']);
  assert.match(pz.inbox['v/pause_kudos'].body, /^Nous avons mis en pause ce type de notification : Bravos reçus\./);
});
