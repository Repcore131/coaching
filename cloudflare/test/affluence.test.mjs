// Les connexions simultanées comptées chaque minute, et l'alerte à 70.
//   node cloudflare/test/affluence.test.mjs
import assert from 'node:assert/strict';
import { creerBase } from '../src/base.js';
import { creerAffluence, estimerConnexions, alerteDue, texteAlerte, SEUIL_ALERTE, LIMITE_SPARK, PRESENCE_FENETRE_MS, ALERTE_ESPACEMENT_MS } from '../src/affluence.js';
import { travaux } from '../src/planif.js';
import { fausseBase } from './fausse-base.mjs';

let ok = 0;
const test = async (nom, fn) => { await fn(); ok++; console.log('ok  ', nom); };
const T0 = Date.parse('2026-10-09T18:00:00Z');
const KEVIN = 'guellec,coachingpro@gmail,com';

function monde(initial) {
  const F = fausseBase(initial);
  const db = creerBase({ url: 'https://b.t', auth: 's', fetchImpl: F.fetchImpl });
  const w = { F, pushs: [], t: T0, telephone: true };
  const M = { planifies: {}, envoyerPush: async (uid, m, o) => { w.pushs.push({ uid, m, o }); return { envoye: w.telephone ? 1 : 0 }; } };
  w.A = creerAffluence({ db, M, maintenant: () => w.t });
  M.affluence = w.A;
  w.M = M;
  return w;
}
const presences = (n, t, flux) => {
  const o = {};
  for (let i = 0; i < n; i++) o['u' + i + '@t,fr'] = { t, f: i < (flux || 0) ? 1 : 0 };
  return o;
};

await test('PURE estimerConnexions : la fenêtre de 6 minutes, les flux, l’estimation majorante', async () => {
  const p = Object.assign(presences(3, T0 - 60000, 1), { 'vieux@t,fr': { t: T0 - PRESENCE_FENETRE_MS - 1, f: 1 }, 'sans@t,fr': {} });
  assert.deepEqual(estimerConnexions(p, T0), { actifs: 3, flux: 1, estime: 3 });
  assert.deepEqual(estimerConnexions(null, T0), { actifs: 0, flux: 0, estime: 0 });
});

await test('PURE alerteDue : à 70, pas à 69, au plus une par heure', async () => {
  assert.equal(SEUIL_ALERTE, 70);
  assert.equal(alerteDue(69, 0, T0), false);
  assert.equal(alerteDue(70, 0, T0), true);
  assert.equal(alerteDue(90, T0 - ALERTE_ESPACEMENT_MS + 1, T0), false);
  assert.equal(alerteDue(90, T0 - ALERTE_ESPACEMENT_MS, T0), true);
  const x = texteAlerte({ estime: 72, flux: 9 });
  assert.match(x.title, /72 connexions simultanées estimées/);
  assert.match(x.body, new RegExp('Limite du plan gratuit : ' + LIMITE_SPARK));
  assert.match(x.body, /BASCULE-BLAZE/);
});

await test('sous le seuil : stats/connexions publié, pas d’alerte', async () => {
  const w = monde({ presence: presences(12, T0 - 120000, 2) });
  const r = await w.A.minute(T0);
  assert.equal(r.estime, 12); assert.equal(r.alerte, false);
  const s = w.F.lire('stats/connexions');
  assert.equal(s.actifs, 12); assert.equal(s.flux, 2); assert.equal(s.estime, 12); assert.equal(s.seuil, 70);
  assert.deepEqual(s.pic, { v: 12, le: T0, jour: '2026-10-09' });
  assert.equal(w.pushs.length, 0);
});

await test('à 70 estimées : notification urgente à Kevin, une seule dans l’heure', async () => {
  const w = monde({ presence: presences(70, T0 - 30000, 5) });
  const r = await w.A.minute(T0);
  assert.equal(r.alerte, true);
  assert.equal(w.pushs.length, 1);
  assert.equal(w.pushs[0].uid, KEVIN);
  assert.equal(w.pushs[0].o.urgent, true);
  assert.match(w.pushs[0].m.title, /70 connexions/);
  assert.equal(w.F.lire('stats/connexions/alerteLe'), T0);
  w.t = T0 + 60000;
  await w.A.minute(w.t);
  assert.equal(w.pushs.length, 1);
  w.t = T0 + ALERTE_ESPACEMENT_MS;
  w.F.ecrire('presence', presences(75, w.t - 1000));
  await w.A.minute(w.t);
  assert.equal(w.pushs.length, 2);
});

await test('le pic du jour est gardé quand le niveau redescend', async () => {
  const w = monde({ presence: presences(40, T0 - 1000) });
  await w.A.minute(T0);
  w.F.ecrire('presence', presences(10, T0 + 60000 - 1000));
  w.t = T0 + 60000;
  await w.A.minute(w.t);
  const s = w.F.lire('stats/connexions');
  assert.equal(s.estime, 10); assert.equal(s.pic.v, 40);
});

await test('rien de changé : aucune écriture', async () => {
  const w = monde({ presence: presences(5, T0 - 1000) });
  await w.A.minute(T0);
  const maj = w.F.lire('stats/connexions/maj');
  w.t = T0 + 60000;
  await w.A.minute(w.t);
  assert.equal(w.F.lire('stats/connexions/maj'), maj);
});

await test('la purge efface les présences de plus de 24 h, garde les autres', async () => {
  const w = monde({ presence: { 'a@t,fr': { t: T0 - 25 * 3600e3 }, 'b@t,fr': { t: T0 - 3600e3 } } });
  assert.equal(await w.A.purger(T0), 1);
  assert.equal(w.F.lire('presence/a@t,fr'), null);
  assert.ok(w.F.lire('presence/b@t,fr'));
});

await test('planif : « affluence » tourne chaque minute, la purge la nuit', async () => {
  const w = monde({});
  const job = travaux(w.M).find((x) => x.nom === 'affluence');
  assert.ok(job && job.minute && job.quand({ heure: 3, minute: 7 }));
  const pg = travaux(w.M).find((x) => x.nom === 'presence_purge');
  assert.ok(pg && pg.quand({ heure: 4, minute: 41 }) && !pg.quand({ heure: 4, minute: 39 }));
});

console.log('\n' + ok + ' tests verts (connexions simultanées).');
