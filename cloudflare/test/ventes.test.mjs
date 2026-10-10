// Le rapport des ventes (/stats/ventes) : la semaine complète, des agrégats, fermé sans jeton.
//   node --test cloudflare/test/ventes.test.mjs
import assert from 'node:assert/strict';
import test from 'node:test';
import { creerBase } from '../src/base.js';
import * as V from '../src/ventes.js';
import worker from '../src/index.js';
import { fausseBase } from './fausse-base.mjs';

// Samedi 10 octobre 2026, 9 h à Paris : la dernière semaine complète va du lundi 28/09 au dimanche 04/10.
const T = Date.parse('2026-10-10T09:00:00+02:00');

test('la semaine rendue est la dernière semaine COMPLÈTE, du lundi au dimanche, à Paris', () => {
  assert.deepEqual(V.semaineAvant(T, 0), ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']);
  assert.equal(V.semaineAvant(T, 1)[0], '2026-09-21');
  // Un lundi matin : la semaine qui vient de finir, pas celle qui commence.
  assert.deepEqual([V.semaineAvant(Date.parse('2026-10-12T07:45:00+02:00'), 0)[0], V.semaineAvant(Date.parse('2026-10-12T07:45:00+02:00'), 0)[6]], ['2026-10-05', '2026-10-11']);
  // Le changement d'heure (25/10/2026) ne décale rien.
  assert.equal(V.semaineAvant(Date.parse('2026-10-27T00:30:00+01:00'), 0)[0], '2026-10-19');
  assert.equal(new Date(V.debutJourParis('2026-10-05')).toISOString(), '2026-10-04T22:00:00.000Z');
  assert.equal(new Date(V.debutJourParis('2026-11-02')).toISOString(), '2026-11-01T23:00:00.000Z');
});

test('l’entonnoir et l’attribution additionnent les sept jours, et rien d’autre', () => {
  const jours = V.semaineAvant(T, 0);
  const met = { '2026-09-28': { landing_view: 10, register_completed: 2 }, '2026-10-04': { landing_view: 5, first_workout_completed: 1 }, '2026-10-05': { landing_view: 99 } };
  const e = V.entonnoir(met, jours);
  assert.equal(e.visites, 15); assert.equal(e.inscriptions, 2); assert.equal(e.premieres_seances, 1); assert.equal(e.abonnements_actives, 0);
  const att = { '2026-09-29': { src: { story: { clic: 4, inscription: 1 }, direct: { clic: 2 } }, amb: { LEAFIT: { clic: 3, payant: 1 } } },
    '2026-10-01': { src: { story: { clic: 1, payant: 1 } } }, '2026-09-20': { src: { story: { clic: 50 } } } };
  const a = V.attribution(att, jours);
  assert.deepEqual(a.sources.story, { clic: 5, inscription: 1, payant: 1 });
  assert.deepEqual(a.ambassadeurs.LEAFIT, { clic: 3, payant: 1 });
});

test('les ventes : par offre, premiers paiements, renouvellements, remboursements à LEUR date ; aucune donnée personnelle', () => {
  const d = V.debutJourParis('2026-09-28'), f = V.debutJourParis('2026-10-04') + 864e5;
  const trs = {
    A: { cle: 'lea@t,fr', abo: 'I-AAA', type: 'abonnement', premier: true, montant: 1490, devise: 'EUR', le: d + 3600e3 },
    B: { cle: 'tom@t,fr', abo: 'I-BBB', type: 'abonnement', premier: false, montant: 2490, devise: 'EUR', le: d + 2 * 864e5 },
    C: { cle: 'zoe@t,fr', type: 'programme', premier: true, montant: 1490, devise: 'EUR', le: f - 1 },
    D: { cle: 'max@t,fr', type: 'coaching', formule: 'evolution', premier: false, montant: 60000, devise: 'EUR', le: d + 864e5 },
    E: { cle: 'old@t,fr', type: 'abonnement', premier: true, montant: 1490, le: d - 10 * 864e5, annuleLe: d + 5 * 864e5 },   // vendu avant, remboursé cette semaine
    F: { cle: 'nex@t,fr', type: 'abonnement', premier: true, montant: 1490, le: f + 1 },                                      // la semaine d'après
  };
  const v = V.ventes(trs, d, f);
  assert.equal(v.transactions, 4); assert.equal(v.encaisse_cts, 1490 + 2490 + 1490 + 60000);
  assert.equal(v.premiers_paiements, 2); assert.equal(v.renouvellements, 1);
  assert.equal(v.remboursements, 1); assert.equal(v.rembourse_cts, 1490);
  assert.deepEqual(v.par_offre, { abonnement: { n: 2, cts: 3980 }, programme: { n: 1, cts: 1490 }, coaching_evolution: { n: 1, cts: 60000 } });
  assert.doesNotMatch(JSON.stringify(v), /@|,fr|I-AAA|I-BBB/, 'ni adresse, ni identifiant d’abonnement');
  const ar = V.arrets({ 'lea@t,fr': { type: 'BILLING.SUBSCRIPTION.CANCELLED', le: d + 1 }, 'tom@t,fr': { type: 'BILLING.SUBSCRIPTION.CANCELLED', le: d - 1 } }, d, f);
  assert.equal(ar.total, 1); assert.doesNotMatch(JSON.stringify(ar), /@/);
});

test('le rapport complet lit la base, rend la semaine et les quatre d’avant, et dit ce qui manque', async () => {
  const F = fausseBase({ metrics: { '2026-09-30': { landing_view: 7 }, '2026-09-22': { landing_view: 3 }, '2026-08-01': { landing_view: 1000 } },
    attribution: { jours: { '2026-10-02': { src: { direct: { clic: 2 } } } } },
    paypal_transactions: { A: { cle: 'lea@t,fr', type: 'abonnement', premier: true, montant: 1490, devise: 'EUR', le: Date.parse('2026-09-30T12:00:00+02:00') } },
    stats: { resiliations: { '2026-09': { prix: 2 }, '2026-10': { temps: 1 } } } });
  const db = creerBase({ url: 'https://b.t', auth: 's', fetchImpl: F.fetchImpl });
  const r = await V.rapportVentes({ db, maintenant: T });
  assert.equal(r.semaine.du, '2026-09-28'); assert.equal(r.semaine.au, '2026-10-04');
  assert.equal(r.semaine.entonnoir.visites, 7); assert.equal(r.semaine.ventes.encaisse_cts, 1490);
  assert.equal(r.precedentes.length, 4); assert.equal(r.precedentes[0].entonnoir.visites, 3);
  assert.deepEqual(r.motifs_resiliation_du_mois, { '2026-09': { prix: 2 }, '2026-10': { temps: 1 } });
  assert.deepEqual(r.indisponibles, []);
  assert.doesNotMatch(JSON.stringify(r), /lea@|,fr/);
});

test('la route : 404 sans secret posé, 401 avec un mauvais jeton, 200 avec le bon (en-tête ou ?token=)', async () => {
  const CTX = { waitUntil() {} };
  const base = { FIREBASE_DB_URL: 'https://base-essai.firebaseio.com', FIREBASE_DB_SECRET: 'x' };
  const vrai = globalThis.fetch;
  globalThis.fetch = async () => new Response('null', { status: 200, headers: { 'Content-Type': 'application/json' } });
  try {
    assert.equal((await worker.fetch(new Request('https://s.t/stats/ventes?token=abc'), base, CTX)).status, 404);
    const ENV = Object.assign({ STATS_TOKEN: 'le-bon-jeton-de-test' }, base);
    assert.equal((await worker.fetch(new Request('https://s.t/stats/ventes'), ENV, CTX)).status, 401);
    assert.equal((await worker.fetch(new Request('https://s.t/stats/ventes?token=faux'), ENV, CTX)).status, 401);
    const r = await worker.fetch(new Request('https://s.t/stats/ventes?token=le-bon-jeton-de-test'), ENV, CTX);
    assert.equal(r.status, 200); assert.equal(r.headers.get('Cache-Control'), 'no-store');
    const j = await r.json(); assert.ok(j.semaine && j.semaine.du && Array.isArray(j.precedentes));
    const r2 = await worker.fetch(new Request('https://s.t/stats/ventes', { headers: { Authorization: 'Bearer le-bon-jeton-de-test' } }), ENV, CTX);
    assert.equal(r2.status, 200);
    assert.equal((await worker.fetch(new Request('https://s.t/stats/ventes?token=le-bon-jeton-de-test', { method: 'POST' }), ENV, CTX)).status, 404);
  } finally { globalThis.fetch = vrai; }
});
