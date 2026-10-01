// Le pouls du Worker : les 429 servis, versés par heure ; l'alerte au créateur
// au-delà de 500 par heure, une seule fois ; le ménage des seaux et des jours
// posés dans le futur sous /metrics et /attribution.
//   node cloudflare/test/pouls.test.mjs
import assert from 'node:assert/strict';
import { creerBase } from '../src/base.js';
import { noter429, viderPouls, surveillerQuota, menage, heureUTC, SEUIL_429_HEURE, _reinitPouls, _enAttente } from '../src/pouls.js';
import { CLE_CREATEUR_PUSH } from '../src/metier.js';
import { fausseBase } from './fausse-base.mjs';

let ok = 0;
const test = async (nom, fn) => { await fn(); ok++; console.log('ok  ', nom); };
const monde = (initial) => {
  const F = fausseBase(initial);
  const db = creerBase({ url: 'https://base.test', auth: 's', fetchImpl: F.fetchImpl });
  const pushs = [];
  const M = { envoyerPush: async (uid, msg, o) => { pushs.push({ uid, msg, o }); return { envoye: 1 }; } };
  return { F, db, M, pushs };
};
const T = Date.parse('2026-10-01T14:05:00Z');

await test('noter429 : le compte attend en mémoire, et dit quand le verser (au plus une fois par minute)', async () => {
  _reinitPouls();
  const { F, db } = monde();
  assert.equal(noter429(T), true);
  await viderPouls(db, T);
  assert.equal(noter429(T + 1000), false);
  assert.equal(noter429(T + 2000), false);
  assert.equal(_enAttente(), 2);
  assert.equal(noter429(T + 61_000), true);
  await viderPouls(db, T + 61_000);
  assert.equal(F.lire('worker/pouls_429/2026100114'), 4);
  assert.equal(_enAttente(), 0);
});

await test('un versement qui échoue rend le compte à la mémoire', async () => {
  _reinitPouls();
  const panne = { ref: () => ({ transaction: async () => { throw new Error('réseau'); } }) };
  noter429(T); noter429(T);
  assert.equal(await viderPouls(panne, T), 0);
  assert.equal(_enAttente(), 2);
  _reinitPouls();
});

await test(SEUIL_429_HEURE + ' refus dans l’heure : pas d’alerte ; ' + (SEUIL_429_HEURE + 1) + ' : UN push urgent au créateur, pas deux', async () => {
  const w = monde({ worker: { pouls_429: { [heureUTC(T)]: SEUIL_429_HEURE } } });
  let b = await surveillerQuota({ db: w.db, M: w.M, t: T });
  assert.equal(b.alerte, false);
  assert.equal(w.pushs.length, 0);
  w.F.ecrire('worker/pouls_429/' + heureUTC(T), SEUIL_429_HEURE + 1);
  b = await surveillerQuota({ db: w.db, M: w.M, t: T + 60_000 });
  assert.equal(b.alerte, true);
  assert.equal(w.pushs.length, 1);
  assert.equal(w.pushs[0].uid, CLE_CREATEUR_PUSH);
  assert.equal(w.pushs[0].o.urgent, true);
  assert.match(w.pushs[0].msg.body, /501 requêtes refusées/);
  await surveillerQuota({ db: w.db, M: w.M, t: T + 120_000 });
  assert.equal(w.pushs.length, 1, 'une alerte par heure');
  // L'heure suivante repart de zéro.
  w.F.ecrire('worker/pouls_429/' + heureUTC(T + 3600e3), 900);
  await surveillerQuota({ db: w.db, M: w.M, t: T + 3600e3 });
  assert.equal(w.pushs.length, 2);
});

await test('le ménage : les seaux de plus de 48 h, et à 03:30 UTC les jours posés dans le futur (trois effacements au plus par passage)', async () => {
  const t = Date.parse('2026-10-01T03:30:00Z');
  const w = monde({
    worker: { pouls_429: { 2026092801: 3, 2026093004: 2, 2026100103: 9 }, pouls_alerte: { 2026092801: 1 } },
    metrics: { '2026-09-30': { landing_view: 1 }, '2026-10-01': { landing_view: 1 }, '2026-10-02': { landing_view: 1 }, '2026-10-09': { landing_view: 9 } },
    attribution: { jours: { '2026-10-01': { src: { bio: { clic: 1 } } }, '2027-01-01': { src: { bio: { clic: 1 } } } } },
  });
  const r1 = await menage(w.db, t, true);
  assert.deepEqual(r1, { seaux: 2, futurs: 1 });
  assert.deepEqual(Object.keys(w.F.lire('worker/pouls_429')).sort(), ['2026093004', '2026100103']);
  assert.equal(w.F.lire('worker/pouls_alerte'), null);
  assert.equal(w.F.lire('metrics/2026-10-09'), null, 'le futur lointain part');
  const r2 = await menage(w.db, t, true);
  assert.deepEqual(r2, { seaux: 0, futurs: 1 });
  assert.equal(w.F.lire('attribution/jours/2027-01-01'), null);
  assert.ok(w.F.lire('metrics/2026-10-02'), 'demain reste admis (un appareil à l’est y est déjà)');
  assert.ok(w.F.lire('metrics/2026-09-30') && w.F.lire('attribution/jours/2026-10-01'));
  // Hors de 03:30, les jours ne sont pas regardés.
  w.F.ecrire('metrics/2026-12-31', { landing_view: 1 });
  assert.deepEqual(await menage(w.db, t, false), { seaux: 0, futurs: 0 });
});

console.log(ok + ' tests passés');
