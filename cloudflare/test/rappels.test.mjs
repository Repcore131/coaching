// La veille d'un créneau (19 h 30) et le badge proche élargi (dimanche 17 h).
//   node --test cloudflare/test/rappels.test.mjs
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import { creerBase } from '../src/base.js';
import { creerMetier, PUSH_PRIORITE } from '../src/metier.js';
import { minute, travaux } from '../src/planif.js';
import * as RA from '../src/rappels.js';
import { fausseBase, appareil } from './fausse-base.mjs';

const vp = crypto.createECDH('prime256v1'); vp.generateKeys();
const VAPID = { publique: vp.getPublicKey().toString('base64url'), privee: vp.getPrivateKey().toString('base64url') };
const PARIS = (iso) => Date.parse(iso + '+02:00');
const J = 864e5;
// Mardi 6 octobre 2026, 19 h 35 à Paris : demain, mercredi (index 2 de sessions_config).
const MARDI = PARIS('2026-10-06T19:35:00');
const CFG = [{ active: true, name: 'Bas du corps', exercises: [{ name: 'Squat' }] }, { active: false },
  { active: true, name: 'Haut du corps', exercises: [{ name: 'Développé couché' }, { name: 'Rowing barre' }] },
  { active: false }, { active: true, name: 'Full', exercises: [] }, { active: false }, { active: false }];

function monde(initial, t) {
  const F = fausseBase(initial);
  let n = 0;
  const fetchCompte = (u, i) => { n++; return F.fetchImpl(u, i); };
  const db = creerBase({ url: 'https://base.test', auth: 's', fetchImpl: fetchCompte });
  let horloge = t;
  const M = creerMetier({ db, vapid: VAPID, fetchImpl: fetchCompte, maintenant: () => horloge });
  M.coachsEtUsers = () => db.ref('users').shallow();
  M.abonnes = () => db.ref('push').shallow();
  const w = { F, M, avance: (ms) => { horloge += ms; }, get t() { return horloge; },
    minute: () => { n = 0; return minute({ db, M, compteur: () => n, maintenant: () => horloge }); } };
  w.jusqua = async (nom) => {
    for (let i = 0; i < 15; i++) { const b = await w.minute(); if (b.travaux[nom] === 'fini') return b; w.avance(60e3); }
    throw new Error('travail « ' + nom + ' » jamais fini');
  };
  return w;
}
function abonnes(users) {
  const tels = {}, push = {};
  for (const k of Object.keys(users)) { tels[k] = appareil('https://push.test/' + k); push[k] = { x: tels[k].abonnement }; }
  const recus = (w, k) => w.F.recus.filter((r) => r.endpoint === 'https://push.test/' + k).map((r) => tels[k].lire(r.init.body));
  return { push, recus };
}

test('veille (pur) : le créneau de demain, le record à portée à 97,5 %, deux par semaine', () => {
  assert.equal(RA.creneauDemain(CFG, 2).name, 'Haut du corps', 'mardi → mercredi');
  assert.equal(RA.creneauDemain(CFG, 0).name, 'Bas du corps', 'dimanche → lundi');
  assert.equal(RA.creneauDemain(CFG, 3), null, 'jeudi → vendredi inactif');
  assert.deepEqual(RA.exercicesDu(CFG[2]), ['Développé couché', 'Rowing barre']);
  const jr = { '2026-10-01': { pr: { 'DEVELOPPE COUCHE': 80, 'ROWING BARRE': 60 } }, '2026-10-05': { pr: { 'DEVELOPPE COUCHE': 97.5 } } };
  // La DERNIÈRE charge (5 oct., 97,5) contre le record (100) : 97,5 %, à portée.
  assert.deepEqual(RA.recordAPortee(['Développé couché', 'Rowing barre'], { 'DEVELOPPE COUCHE': 100, 'ROWING BARRE': 70 }, jr),
    { nom: 'Développé couché', charge: 97.5, record: 100 });
  assert.equal(RA.recordAPortee(['Développé couché'], { 'DEVELOPPE COUCHE': 101 }, jr), null, '96,5 % : pas à portée');
  assert.equal(RA.recordAPortee(['Squat'], { SQUAT: 100 }, jr), null, 'jamais fait dans le journal');
  const m = RA.messageVeille(CFG[2], { nom: 'Développé couché', charge: 97.5, record: 100 });
  assert.equal(m.title, 'Demain : Haut du corps');
  assert.equal(m.body, 'Développé couché : 97,5 kg, ton record est à portée');
  assert.equal(m.type, 'serie'); assert.equal(m.prio, 'veille'); assert.equal(PUSH_PRIORITE.veille, 50);
  assert.equal(RA.messageVeille({ active: true }, null).title, 'Demain : ta séance');
  assert.equal(RA.veillesDeLaSemaine(['2026-09-29', '2026-10-05', '2026-10-06'], '2026-10-05'), 2);
});

test('veille 19 h 30 : demain actif et pas de séance aujourd’hui ; record à portée ; deux par semaine au plus', async () => {
  const jr = { '2026-10-05': { pr: { 'DEVELOPPE COUCHE': 98 } } };
  const users = {
    'lea@t,fr': { sessions_config: CFG, lastSession: MARDI - 2 * J },
    'tom@t,fr': { sessions_config: CFG, lastSession: MARDI - 3600e3 },         // s'est entraîné aujourd'hui
    'zoe@t,fr': { sessions_config: CFG.map((c, i) => (i === 2 ? { active: false } : c)), lastSession: MARDI - 2 * J }, // demain : repos
    'max@t,fr': { sessions_config: CFG, lastSession: MARDI - 2 * J },
    'coach@t,fr': { role: 'coach', sessions_config: CFG },
  };
  const { push, recus } = abonnes(users);
  const w = monde({ users, push, xp_etat: { 'lea@t,fr': { meilleurs: { 'DEVELOPPE COUCHE': 100 }, jr } },
    worker: { veille: { 'max@t,fr': ['2026-10-05', '2026-10-06'] } } }, MARDI);
  assert.ok(travaux(w.M).some((x) => x.nom === 'veille'));
  await w.jusqua('veille');
  assert.deepEqual(recus(w, 'lea@t,fr').map((m) => [m.title, m.body]), [['Demain : Haut du corps', 'Développé couché : 98 kg, ton record est à portée']]);
  for (const k of ['tom@t,fr', 'zoe@t,fr', 'max@t,fr', 'coach@t,fr']) assert.equal(recus(w, k).length, 0, k);
  assert.deepEqual(w.F.lire('worker/veille/lea@t,fr'), ['2026-10-06']);
});

test('veille : deux dans la même semaine (lundi–dimanche) bloquent la troisième ; la semaine suivante repart', async () => {
  const k = 'ana@t,fr';
  const users = { [k]: { sessions_config: CFG, lastSession: MARDI - 2 * J } };
  const { push, recus } = abonnes(users);
  // Le 4 est un dimanche (la semaine d'avant) : une seule veille compte cette semaine.
  const w = monde({ users, push, worker: { veille: { [k]: ['2026-10-04', '2026-10-05'] } } }, MARDI);
  assert.equal(await w.M.planifies.veille(k, w.t), 'envoye');
  assert.deepEqual(w.F.lire('worker/veille/' + k), ['2026-10-04', '2026-10-05', '2026-10-06']);
  // Dimanche 11 au soir (demain lundi, actif) : deux déjà cette semaine (le 5 et le 6).
  w.F.ecrire('push_log/' + k, null);
  w.avance(5 * J);
  assert.equal(await w.M.planifies.veille(k, w.t), 'deux_cette_semaine');
  // Mardi 13 au soir (demain mercredi) : nouvelle semaine.
  w.avance(2 * J);
  assert.equal(await w.M.planifies.veille(k, w.t), 'envoye');
  assert.equal(recus(w, k).length, 2);
});

test('badge proche (pur) : le plus proche d’ASSIDU, BRISEUR et d’un palier de série ; un seul', () => {
  assert.equal(RA.badgeProche({ faites: 8 }).title, 'Encore 2 séances pour ASSIDU I');
  assert.equal(RA.badgeProche({ faites: 7 }), null, 'à 3 séances : trop loin');
  assert.equal(RA.badgeProche({ records: 24 }).title, 'Encore 1 record pour BRISEUR DE RECORDS II');
  assert.equal(RA.badgeProche({ streak: 11 }).title, 'Une semaine de plus et tu passes 12 semaines d’affilée');
  assert.equal(RA.badgeProche({ streak: 10 }), null);
  // Le plus proche gagne : 1 record contre 2 séances.
  assert.equal(RA.badgeProche({ faites: 48, records: 4 }).cle, 'briseur');
  // À égalité (1 et 1), la série d'abord.
  assert.equal(RA.badgeProche({ faites: 49, records: 24, streak: 3 }).cle, 'serie');
  assert.equal(RA.badgeProche({ faites: 49, records: 24 }).cle, 'assidu');
  assert.equal(RA.badgeProche({ faites: 300, records: 200, streak: 60 }), null);
});

test('badge proche, dimanche 17 h : xp_etat.faites (pas les clés de séances), records, série', async () => {
  const users = {
    'a@t,fr': { streak: 1, sessions: Array.from({ length: 9 }, (_, i) => ({ date: i + 1 })) },   // 9 clés, mais 8 faites
    'b@t,fr': { streak: 7 },
    'c@t,fr': { streak: 2 },
  };
  const { push, recus } = abonnes(users);
  const DIM = PARIS('2026-10-04T17:05:00');
  const w = monde({ users, push, xp_etat: { 'a@t,fr': { faites: 8, s: { record: 3 * 50 } }, 'b@t,fr': { faites: 30, s: { record: 23 * 50 } },
    'c@t,fr': { faites: 30, s: { record: 0 } } } }, DIM);
  await w.jusqua('badge');
  assert.deepEqual(recus(w, 'a@t,fr').map((m) => m.title), ['Encore 2 séances pour ASSIDU I'], 'les séances FAITES, pas les clés');
  assert.deepEqual(recus(w, 'b@t,fr').map((m) => m.title), ['Une semaine de plus et tu passes 8 semaines d’affilée']);
  assert.equal(recus(w, 'c@t,fr').length, 0);
});

test('le planificateur : la veille à 19 h 30, jusqu’à la fenêtre de 21 h, par athlète avec profils', () => {
  const v = travaux({ planifies: {} }).find((x) => x.nom === 'veille');
  assert.ok(v && v.push && v.fenetre && v.profils && v.parAthlete);
  assert.equal(v.quand({ heure: 19, minute: 29 }), false);
  assert.equal(v.quand({ heure: 19, minute: 30 }), true);
  assert.equal(v.quand({ heure: 20, minute: 59 }), true);
  assert.equal(v.quand({ heure: 21, minute: 0 }), false);
});
