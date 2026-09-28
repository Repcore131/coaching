// La rétention (/stats/retention) : cohortes J1/J7/J30, DAU/WAU/MAU,
// entonnoir par source, effet des leviers — par lots, sans donnée personnelle.
//   node --test cloudflare/test/retention.test.mjs
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import { creerBase } from '../src/base.js';
import { creerMetier } from '../src/metier.js';
import { minute, travaux } from '../src/planif.js';
import * as RT from '../src/retention.js';
import { fausseBase } from './fausse-base.mjs';

const vp = crypto.createECDH('prime256v1'); vp.generateKeys();
const VAPID = { publique: vp.getPublicKey().toString('base64url'), privee: vp.getPrivateKey().toString('base64url') };
const T = Date.parse('2026-11-20T04:35:00+01:00');       // la nuit du 20 novembre
const J = 864e5;
const jour = (t) => new Date(t).toLocaleDateString('fr-CA', { timeZone: 'Europe/Paris' });
// Un résumé : inscrit il y a `age` jours, actif les jours `debut`, la bande
// des 30 derniers jours posée à `anc` jours d'ici.
const R = (age, o) => Object.assign({ inscrit: jour(T - age * J), sem: jour(T - age * J), src: 'direct', debut: [0], jour: jour(T - J), j30: '0'.repeat(30),
  seance1: false, parcours: false, finEssai: 0, payant: false, lev: {} }, o || {});
const bande = (actifs) => { const b = Array(30).fill('0'); for (const n of actifs) b[29 - n] = '1'; return b.join(''); };

test('les cohortes : J1, J7, J30 — seulement quand la fenêtre est passée', () => {
  let a = RT.accVide();
  a = RT.accumuler(a, R(40, { sem: '2026-10-05', debut: [0, 1, 8, 31] }), T);
  a = RT.accumuler(a, R(40, { sem: '2026-10-05', debut: [0, 2] }), T);
  a = RT.accumuler(a, R(10, { sem: '2026-11-09', debut: [0, 1, 8] }), T);    // J30 inconnu, J7 pas fini
  a = RT.accumuler(a, R(1, { sem: '2026-11-16' }), T);                        // J1 pas encore mesurable
  const r = RT.resultat(a, T);
  const c = Object.fromEntries(r.cohortes.map((x) => [x.sem, x]));
  assert.deepEqual([c['2026-10-05'].j1, c['2026-10-05'].j7, c['2026-10-05'].j30], [50, 50, 50]);
  assert.equal(c['2026-11-09'].j1, 100);
  assert.equal(c['2026-11-09'].j7, null, 'la 2e semaine n’est pas finie');
  assert.equal(c['2026-11-09'].j30, null);
  assert.equal(c['2026-11-16'].j1, null);
  assert.equal(RT.accumuler(RT.accVide(), { inscrit: 'hier' }, T).c && Object.keys(RT.accumuler(RT.accVide(), { inscrit: 'hier' }, T).c).length, 0, 'résumé illisible ignoré');
});

test('DAU / WAU / MAU à la veille du serveur, bande décalée si le résumé est ancien', () => {
  let a = RT.accVide();
  a = RT.accumuler(a, R(60, { j30: bande([0]) }), T);                         // actif hier
  a = RT.accumuler(a, R(60, { j30: bande([3]) }), T);                         // il y a 3 jours
  a = RT.accumuler(a, R(60, { j30: bande([20]) }), T);                        // il y a 20 jours
  a = RT.accumuler(a, R(60, { jour: jour(T - 11 * J), j30: bande([0]) }), T); // résumé posé il y a 10 jours : actif il y a 10 jours
  a = RT.accumuler(a, R(60, { jour: jour(T - 50 * J), j30: bande([0]) }), T); // trop ancien
  const r = RT.resultat(a, T).actifs;
  assert.deepEqual(r, { dau: 1, wau: 2, mau: 4, dauMau: 25 });
});

test('l’entonnoir par source, et l’effet des leviers avec l’alerte sous 30 personnes', () => {
  let a = RT.accVide();
  for (let i = 0; i < 40; i++) a = RT.accumuler(a, R(45, { src: 'amb', seance1: true, parcours: i < 30, finEssai: T - J, payant: i < 10,
    debut: i < 30 ? [0, 31] : [0], lev: { parcours: i < 30 } }), T);
  for (let i = 0; i < 35; i++) a = RT.accumuler(a, R(45, { src: 'Story!', seance1: i < 20, debut: i < 7 ? [0, 31] : [0], lev: {} }), T);
  const r = RT.resultat(a, T);
  const amb = r.entonnoir.sources.find((x) => x.src === 'amb');
  assert.deepEqual([amb.inscrits, amb.seance1, amb.parcours, amb.finEssai, amb.payant], [40, 40, 30, 40, 10]);
  assert.ok(r.entonnoir.sources.find((x) => x.src === 'story'), 'source nettoyée');
  assert.equal(r.entonnoir.total.inscrits, 75);
  const p = r.leviers.find((x) => x.cle === 'parcours');
  assert.deepEqual(p.avec, { n: 30, j30: 100 });
  assert.deepEqual(p.sans, { n: 45, j30: Math.round(7 / 45 * 1000) / 10 });
  assert.equal(p.alerte, false);
  assert.equal(r.leviers.find((x) => x.cle === 'duel').alerte, true, 'personne avec : groupe trop petit');
  assert.equal(r.seuilGroupe, 30);
});

test('la nuit : par lots dans le budget, /stats/retention publié, aucune donnée personnelle', async () => {
  const activite = {};
  for (let i = 0; i < 120; i++) activite['athlete' + i + '@exemple,fr'] = R(20 + (i % 30), { debut: [0, 1, 8], j30: bande([0, 5]), src: i % 2 ? 'amb' : 'direct' });
  const F = fausseBase({ activite });
  let n = 0;
  const f = (u, x) => { n++; return F.fetchImpl(u, x); };
  const db = creerBase({ url: 'https://b.t', auth: 's', fetchImpl: f });
  let h = T;
  const M = creerMetier({ db, vapid: VAPID, fetchImpl: f, maintenant: () => h });
  M.coachsEtUsers = () => db.ref('users').shallow(); M.abonnes = () => db.ref('push').shallow();
  assert.ok(travaux(M).some((w) => w.nom === 'retention'));
  let tours = 0, fini = false;
  while (tours++ < 30 && !fini) {
    n = 0;
    const b = await minute({ db, M, compteur: () => n, maintenant: () => h });
    assert.ok(b.requetes <= 50, 'budget : ' + b.requetes);
    fini = b.travaux.retention === 'fini';
    h += 60e3;
  }
  assert.ok(fini && tours > 2, 'plusieurs minutes, puis fini');
  const s = F.lire('stats/retention');
  assert.equal(s.comptes, 120);
  assert.equal(s.actifs.dau, 120);
  assert.equal(s.entonnoir.total.inscrits, 120);
  const txt = JSON.stringify(s);
  assert.ok(!/athlete|exemple|@|,fr/.test(txt), 'aucune clé de compte dans les statistiques');
});
