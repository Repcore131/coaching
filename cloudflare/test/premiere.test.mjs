// Les inscrits sans première séance : J1, J3, J6 à 17 h, la séance du jour.
//   node cloudflare/test/premiere.test.mjs
import assert from 'node:assert/strict';
import { creerBase } from '../src/base.js';
import { creerMetier } from '../src/metier.js';
import { creerPremiere, palierPremiere, seancePremiere, messagePremiere } from '../src/premiere.js';
import { bilanPremiere, ajouterPremiere, tauxPremiere, resultat, accVide } from '../src/retention.js';
import { travaux } from '../src/planif.js';
import crypto from 'node:crypto';
import { fausseBase, appareil } from './fausse-base.mjs';

const vp = crypto.createECDH('prime256v1'); vp.generateKeys();
const VAPID = { publique: vp.getPublicKey().toString('base64url'), privee: vp.getPrivateKey().toString('base64url') };

let ok = 0;
const test = async (nom, fn) => { await fn(); ok++; console.log('ok  ', nom); };
const J = 864e5;
// Dimanche 11 octobre 2026, 17 h à Paris.
const T0 = Date.parse('2026-10-11T15:00:00Z');
const PROG = [
  { day: 'Lundi', name: 'Haut du corps', active: true, exercises: [{ name: 'DEVELOPPE COUCHE BARRE' }, { name: 'TRACTIONS' }] },
  { day: 'Mardi', active: false, exercises: [] }, { day: 'Mercredi', active: false, exercises: [] },
  { day: 'Jeudi', active: false, exercises: [] }, { day: 'Vendredi', active: false, exercises: [] },
  { day: 'Samedi', active: false, exercises: [] },
  { day: 'Dimanche', name: 'Jambes', active: true, exercises: [{ name: 'SQUAT' }, { name: 'FENTES' }, { name: 'MOLLETS' }] },
];
const act = (inscrit, plus) => Object.assign({ v: 1, inscrit, sem: '2026-10-05', src: 'direct', jour: inscrit, j30: '0'.repeat(30), seance1: false, payant: false }, plus || {});

// Le VRAI envoyerPush (metier.js) : préférences, plafond commun, abonnement,
// chiffrement. `abos` : les comptes qui ont un appareil abonné.
function monde(initial, abos) {
  const tels = {}, push = {};
  for (const k of abos || []) { tels[k] = appareil('https://push.test/' + k); push[k] = { x: tels[k].abonnement }; }
  const F = fausseBase(Object.assign({}, initial, { push }));
  const db = creerBase({ url: 'https://b.t', auth: 's', fetchImpl: F.fetchImpl });
  const M = creerMetier({ db, vapid: VAPID, fetchImpl: F.fetchImpl, maintenant: () => T0 });
  const P = creerPremiere({ db, M, maintenant: () => T0 });
  M.premiere = P;
  const w = { F, M, P };
  Object.defineProperty(w, 'envois', { get: () => F.recus.filter((r) => r.endpoint && tels[r.endpoint.slice('https://push.test/'.length)])
    .map((r) => tels[r.endpoint.slice('https://push.test/'.length)].lire(r.init.body)) });
  return w;
}

await test('PURE palierPremiere : 1, 3 et 6 jours de calendrier à Paris, rien d’autre', async () => {
  assert.equal(palierPremiere('2026-10-10', T0), 1);
  assert.equal(palierPremiere('2026-10-08', T0), 3);
  assert.equal(palierPremiere('2026-10-05', T0), 6);
  for (const j of ['2026-10-11', '2026-10-09', '2026-10-07', '2026-10-04', 'x', '']) assert.equal(palierPremiere(j, T0), 0, j);
});

await test('PURE seancePremiere : le créneau du jour, sinon le suivant ; null sans programme', async () => {
  assert.deepEqual(seancePremiere(PROG, 0), { idx: 6, nom: 'Jambes', n: 3, aujourdhui: true });       // dimanche
  assert.deepEqual(seancePremiere(PROG, 3), { idx: 6, nom: 'Jambes', n: 3, aujourdhui: false });      // mercredi → dimanche
  assert.deepEqual(seancePremiere(PROG, 1), { idx: 0, nom: 'Haut du corps', n: 2, aujourdhui: true }); // lundi
  assert.equal(seancePremiere(null, 0), null);
  assert.equal(seancePremiere([{ active: true, exercises: [] }], 1), null);
  assert.equal(seancePremiere({ 0: PROG[0] }, 1).idx, 0);                                             // la base rend parfois un objet
});

await test('PURE messagePremiere : prénom, séance du jour, lien profond ; sans programme, aucun détail inventé', async () => {
  const m = messagePremiere(1, { prenom: 'Léa', seance: { idx: 6, nom: 'Jambes', n: 3, aujourdhui: true } });
  assert.equal(m.type, 'premiere');
  assert.equal(m.title, 'Léa, ta première séance t’attend');
  assert.equal(m.body, 'Au programme aujourd’hui : Jambes · 3 exercices. Un appui et elle s’ouvre.');
  assert.equal(m.url, './?wo=1&i=6');
  assert.match(messagePremiere(3, {}).title, /^On s’y met/);
  const v = messagePremiere(6, { prenom: 'Zoé' });
  assert.equal(v.url, './?wo=1');
  assert.doesNotMatch(v.body, /\d/);
  assert.doesNotMatch(JSON.stringify([m, v]), /garanti|résultat|kg perdu/i);
});

await test('SÉLECTION : J1, J3, J6 sans séance seulement — ni J2, ni déjà commencé, ni coach, ni suspension', async () => {
  const users = {};
  const activite = {};
  const poser = (k, inscrit, u, a) => { activite[k] = act(inscrit, a); users[k] = Object.assign({ role: 'athlete', fname: k.split('@')[0], sessions_config: PROG }, u || {}); };
  poser('j1@t,fr', '2026-10-10');
  poser('j3@t,fr', '2026-10-08');
  poser('j6@t,fr', '2026-10-05');
  poser('j2@t,fr', '2026-10-09');
  poser('fait@t,fr', '2026-10-10', {}, { seance1: true });
  poser('relu@t,fr', '2026-10-08', { lastSession: T0 - 3600e3 });               // résumé en retard : la séance est relue
  poser('coach@t,fr', '2026-10-10', { role: 'coach' });
  poser('pause@t,fr', '2026-10-10', { suspension: { actif: true } });
  const w = monde({ activite, users }, Object.keys(users));
  const b = await w.P.quotidien(T0);
  assert.equal(b['j1@t,fr'], 'envoye'); assert.equal(b['j3@t,fr'], 'envoye'); assert.equal(b['j6@t,fr'], 'envoye');
  assert.equal(b['fait@t,fr'], 'deja_commence'); assert.equal(b['relu@t,fr'], 'deja_commence');
  assert.equal(b['coach@t,fr'], 'coach'); assert.equal(b['pause@t,fr'], 'suspension');
  assert.equal(b['j2@t,fr'], 'hors_palier');
  assert.equal(w.envois.length, 3);
  const e1 = w.envois.find((x) => x.tag === 'premiere-j1');
  assert.equal(e1.title, 'j1, ta première séance t’attend');
  assert.equal(e1.url, './?wo=1&i=6');
  assert.equal(w.F.lire('premiere_trace/j1@t,fr/j1'), T0);
  assert.equal(w.F.lire('premiere_trace/j1@t,fr/inscrit'), '2026-10-10');
  // Relancé le même jour : rien ne repart.
  await w.P.quotidien(T0);
  assert.equal(w.envois.length, 3);
});

await test('PLAFOND COMMUN : un autre push parti aujourd’hui → rien, et pas de trace', async () => {
  const w = monde({ activite: { 'a@t,fr': act('2026-10-10') }, users: { 'a@t,fr': { role: 'athlete' } },
    push_log: { 'a@t,fr': { jour: '2026-10-11', at: T0 - 3600e3, type: 'acces' } } }, ['a@t,fr']);
  const b = await w.P.quotidien(T0);
  assert.equal(b['a@t,fr'], 'plafond');
  assert.equal(w.envois.length, 0);
  assert.equal(w.F.lire('premiere_trace/a@t,fr'), null);
  // Et l'inverse : après le push « premiere », le plafond tient les autres types.
  const w2 = monde({ activite: { 'b@t,fr': act('2026-10-10') }, users: { 'b@t,fr': { role: 'athlete' } } }, ['b@t,fr']);
  await w2.P.quotidien(T0);
  const r = await w2.M.envoyerPush('b@t,fr', { type: 'retour', title: 'x' }, { attendre: false });
  assert.equal(r.raison, 'plafond');
  assert.equal(w2.envois.length, 1);
});

await test('DÉSINSCRIPTION : type coupé dans les réglages, ou aucun appareil abonné → rien ne part', async () => {
  const w = monde({ activite: { 'coupe@t,fr': act('2026-10-10'), 'sans@t,fr': act('2026-10-10') },
    users: { 'coupe@t,fr': { role: 'athlete', pushPrefs: { premiere: false } }, 'sans@t,fr': { role: 'athlete' } },
  }, ['coupe@t,fr']);
  const b = await w.P.quotidien(T0);
  assert.equal(b['coupe@t,fr'], 'coupe');
  assert.equal(b['sans@t,fr'], 'aucun_abonnement');
  assert.equal(w.envois.length, 0);
});

await test('PURE ATTRIBUTION : la 1re séance va au dernier push parti avant elle (7 jours) ; clôture à 14 jours', async () => {
  const tr = { inscrit: '2026-10-01', j1: Date.parse('2026-10-02T15:00:00Z'), j3: Date.parse('2026-10-04T15:00:00Z') };
  assert.deepEqual(bilanPremiere(tr, 0, Date.parse('2026-10-05T15:00:00Z')), { fini: false, envois: ['j1', 'j3'], attribue: null });
  assert.equal(bilanPremiere(tr, Date.parse('2026-10-04T19:00:00Z'), T0).attribue, 'j3');
  assert.equal(bilanPremiere(tr, Date.parse('2026-10-03T08:00:00Z'), T0).attribue, 'j1');
  assert.equal(bilanPremiere(tr, Date.parse('2026-10-02T08:00:00Z'), T0).attribue, null);   // avant tout push
  assert.equal(bilanPremiere(tr, Date.parse('2026-10-12T08:00:00Z'), T0).attribue, null);   // plus de 7 jours après
  const fin = bilanPremiere(tr, 0, Date.parse('2026-10-15T15:00:00Z'));
  assert.deepEqual(fin, { fini: true, envois: ['j1', 'j3'], attribue: null });
  const s0 = { j1: { e: 4, s: 1 } };
  const s1 = ajouterPremiere(s0, { fini: true, envois: ['j1', 'j3'], attribue: 'j3' });
  assert.deepEqual(s1, { j1: { e: 5, s: 1 }, j3: { e: 1, s: 1 }, j6: { e: 0, s: 0 } });
  assert.deepEqual(s0, { j1: { e: 4, s: 1 } });                                              // PURE
  const tx = tauxPremiere(s1);
  assert.deepEqual(tx[0], { levier: 'j1', envoyes: 5, seances: 1, taux: 20, alerte: true });
  assert.equal(tx[2].taux, null);
  assert.deepEqual(resultat(accVide(), T0, s1).premiereSeance, tx);
});

await test('CLÔTURE dans le travail : séance arrivée → compteurs, trace effacée ; en cours → gardée', async () => {
  const w = monde({
    premiere_trace: { 'ok@t,fr': { inscrit: '2026-10-05', j1: Date.parse('2026-10-06T15:00:00Z'), j3: Date.parse('2026-10-08T15:00:00Z') },
      'att@t,fr': { inscrit: '2026-10-10', j1: T0 - J } },
    users: { 'ok@t,fr': { lastSession: Date.parse('2026-10-09T18:00:00Z') }, 'att@t,fr': {} },
    stats: { relance_premiere: { j1: { e: 2, s: 0 } } } });
  const b = await w.P.quotidien(T0);
  assert.equal(b.closes, 1);
  assert.deepEqual(w.F.lire('stats/relance_premiere'), { j1: { e: 3, s: 0 }, j3: { e: 1, s: 1 }, j6: { e: 0, s: 0 } });
  assert.equal(w.F.lire('premiere_trace/ok@t,fr'), null);
  assert.ok(w.F.lire('premiere_trace/att@t,fr'));
});

await test('planif : « jamais_commence » à 17 h (Paris), pas après 21 h', async () => {
  const job = travaux({ planifies: {} }).find((x) => x.nom === 'jamais_commence');
  assert.ok(job && job.quand({ heure: 17, minute: 0 }) && !job.quand({ heure: 16, minute: 59 }) && !job.quand({ heure: 21, minute: 0 }));
});

console.log('\n' + ok + ' tests verts (première séance).');
