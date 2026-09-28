// La relance des inactifs (push « retour ») : J+7, J+14, J+30, puis silence.
//   node --test cloudflare/test/retour.test.mjs
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import { creerBase } from '../src/base.js';
import { creerMetier, PUSH_TYPES } from '../src/metier.js';
import { minute, travaux } from '../src/planif.js';
import * as RE from '../src/retour.js';
import { fausseBase, appareil } from './fausse-base.mjs';

const vp = crypto.createECDH('prime256v1'); vp.generateKeys();
const VAPID = { publique: vp.getPublicKey().toString('base64url'), privee: vp.getPrivateKey().toString('base64url') };
const PARIS = (iso) => Date.parse(iso + '+02:00');
const J = 864e5;
const MARDI = PARIS('2026-10-06T11:05:00');
const der = (n) => PARIS('2026-10-06T19:00:00') - n * J;   // la dernière séance, il y a n jours (au soir)

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

test('les paliers : 7, 14 et 30 jours de Paris, et rien entre', () => {
  assert.equal(RE.palierDuJour(der(7), MARDI), 7);
  assert.equal(RE.palierDuJour(der(14), MARDI), 14);
  assert.equal(RE.palierDuJour(der(30), MARDI), 30);
  for (const n of [0, 1, 6, 8, 13, 15, 29, 31, 60]) assert.equal(RE.palierDuJour(der(n), MARDI), 0, 'J+' + n);
  assert.equal(RE.palierDuJour(0, MARDI), 0);
  // Une séance à 0 h 30 compte pour son jour de Paris (pas pour la veille en UTC).
  assert.equal(RE.palierDuJour(PARIS('2026-09-29T00:30:00'), MARDI), 7);
  assert.ok(PUSH_TYPES.includes('retour'));
});

test('les textes portent les vraies données : rang et série, tonnage et équivalent, reprise -10 %', () => {
  const a = RE.messageRetour(7, { fname: 'Léa', xpRang: 3, streak: 5 });
  assert.equal(a.type, 'retour');
  assert.equal(a.title, 'Léa, ta semaine t’attend');
  assert.equal(a.body, 'Une séance suffit à garder ton rang VOLTAGE et ta série de 5 semaines.');
  assert.equal(RE.messageRetour(7, {}).body, 'Une séance suffit pour repartir.');
  const b = RE.messageRetour(14, { tonnageTotal: 84000 });
  assert.equal(b.title, 'Tu as soulevé 84 t avec nous');
  assert.match(b.body, /^Soit 7 bus\. /);
  assert.equal(RE.equivalentTonnage(6000), '1 éléphant');
  assert.equal(RE.tonnageTexte(950), '950 kg');
  assert.equal(RE.messageRetour(14, {}).title, 'Deux semaines sans toi');
  const c = RE.messageRetour(30, {});
  assert.equal(c.title, 'Reprise en douceur');
  assert.match(c.body, /baisser tes charges de 10 %/);
  assert.equal(c.url, './?reprise=1');
});

test('les règles : suspension, un par palier, trois au plus, pas juste après la série', () => {
  const t = MARDI;
  const e = RE.etatPeriode(null, der(7));
  assert.deepEqual(RE.retourAutorise({ palier: 7, etat: e, t }), { ok: true, raison: null });
  assert.equal(RE.retourAutorise({ palier: 7, etat: e, suspension: { actif: true }, t }).raison, 'suspension');
  assert.equal(RE.retourAutorise({ palier: 7, etat: { depuis: 1, paliers: { 7: 1 } }, t }).raison, 'deja');
  assert.equal(RE.retourAutorise({ palier: 30, etat: { depuis: 1, paliers: { 7: 1, 14: 1, 99: 1 } }, t }).raison, 'max');
  assert.equal(RE.retourAutorise({ palier: 7, etat: e, logPush: { type: 'serie', at: t - 2 * J }, t }).raison, 'serie');
  assert.equal(RE.retourAutorise({ palier: 7, etat: e, logPush: { type: 'serie', at: t - 5 * J }, t }).ok, true);
  assert.equal(RE.retourAutorise({ palier: 7, etat: e, logPush: { type: 'bilan', at: t - J }, t }).ok, true);
  // Une nouvelle séance ouvre une nouvelle période.
  assert.deepEqual(RE.etatPeriode({ depuis: 5, paliers: { 7: 1 } }, 9), { depuis: 9, paliers: {} });
});

test('11 h : J+7, J+14, J+30 reçoivent chacun leur message ; les autres rien ; jamais deux fois', async () => {
  const users = {
    'j7@t,fr': { lastSession: der(7), fname: 'Léa', xpRang: 4, streak: 3 },
    'j14@t,fr': { lastSession: der(14), tonnageTotal: 84000 },
    'j30@t,fr': { lastSession: der(30) },
    'j8@t,fr': { lastSession: der(8) },
    'actif@t,fr': { lastSession: der(1) },
    'jamais@t,fr': {},
    'susp@t,fr': { lastSession: der(7), suspension: { actif: true } },
  };
  const { push, recus } = abonnes(users);
  const w = monde({ users, push }, MARDI);
  assert.ok(travaux(w.M).some((x) => x.nom === 'retour'));
  await w.jusqua('retour');
  assert.equal(recus(w, 'j7@t,fr').length, 1);
  assert.equal(recus(w, 'j7@t,fr')[0].body, 'Une séance suffit à garder ton rang MACHINE et ta série de 3 semaines.');
  assert.equal(recus(w, 'j14@t,fr')[0].title, 'Tu as soulevé 84 t avec nous');
  assert.equal(recus(w, 'j30@t,fr')[0].url, './?reprise=1');
  for (const k of ['j8@t,fr', 'actif@t,fr', 'jamais@t,fr']) assert.equal(recus(w, k).length, 0, k);
  assert.equal(recus(w, 'susp@t,fr').length, 0, 'pas de relance pendant une suspension');
  assert.equal(w.F.lire('retour_etat/j7@t,fr').paliers[7] > 0, true);
  // Relancé le même jour : le travail est fini ; forcé, le palier est déjà envoyé.
  assert.equal(await w.M.retourUn('j7@t,fr', w.t), 'deja');
  assert.equal(w.F.recus.length, 3);
});

test('une période : J+7 puis J+14 puis J+30, puis silence ; une séance la referme', async () => {
  const k = 'lea@t,fr';
  const users = { [k]: { lastSession: der(7), xpRang: 2, tonnageTotal: 5000 } };
  const { push, recus } = abonnes(users);
  const w = monde({ users, push }, MARDI);
  // Les instants sont écrits à l'heure de Paris : le 25 octobre, on passe à l'heure d'hiver.
  const a = (iso) => w.avance(Date.parse(iso) - w.t);
  await w.jusqua('retour');
  a('2026-10-13T11:05:00+02:00'); await w.jusqua('retour');
  a('2026-10-29T11:05:00+01:00'); await w.jusqua('retour');
  const l = recus(w, k).map((m) => m.tag);
  assert.deepEqual(l, ['retour-7', 'retour-14', 'retour-30']);
  // Puis silence : J+60 n'est pas un palier, et la période est pleine.
  a('2026-11-28T11:05:00+01:00'); await w.jusqua('retour');
  assert.equal(recus(w, k).length, 3);
  assert.equal(await w.M.retourUn(k, w.t), 'rien');
  // Une séance, puis sept jours : une nouvelle période.
  w.F.ecrire('users/' + k + '/lastSession', w.t - 7 * J);
  w.avance(J); w.avance(-J);
  assert.equal(await w.M.retourUn(k, w.t), 'envoye');
  assert.equal(w.F.lire('retour_etat/' + k).depuis, w.t - 7 * J);
});

test('pas de doublon avec la série en danger, dans les deux sens', async () => {
  // 1. La série est partie le jeudi : le J+7 du samedi se tait.
  const k = 'tom@t,fr';
  const samedi = PARIS('2026-10-03T11:05:00');
  const users = { [k]: { lastSession: samedi - 7 * J, streak: 4 } };
  const { push, recus } = abonnes(users);
  const w = monde({ users, push, push_log: { [k]: { jour: '2026-10-01', at: samedi - 2 * J, type: 'serie' } } }, samedi);
  await w.jusqua('retour');
  assert.equal(recus(w, k).length, 0, 'la relance de série a déjà parlé');
  assert.equal(await w.M.retourUn(k, w.t), 'serie');
  // 2. Le J+7 est parti le mardi : la série du jeudi se tait.
  const JEUDI = PARIS('2026-10-01T18:01:00');
  const z = 'zoe@t,fr';
  const u2 = { [z]: { streak: 5, streakWeek: '2026-09-21', lastSession: JEUDI - 9 * J, sessions_config: [{ active: true }, { active: true }] } };
  const a2 = abonnes(u2);
  const w2 = monde({ users: u2, push: a2.push, retour_etat: { [z]: { depuis: JEUDI - 9 * J, paliers: { 7: JEUDI - 2 * J } } },
    worker: { jobs: { wrapped: { jour: '2026-10-01', fini: true }, retour: { jour: '2026-10-01', fini: true } } } }, JEUDI);
  await w2.jusqua('serie');
  assert.equal(a2.recus(w2, z).length, 0, 'la relance « retour » vient de partir');
  // Témoin : sans relance récente, la série parle.
  const w3 = monde({ users: u2, push: a2.push, worker: { jobs: { wrapped: { jour: '2026-10-01', fini: true }, retour: { jour: '2026-10-01', fini: true } } } }, JEUDI);
  await w3.jusqua('serie');
  assert.equal(a2.recus(w3, z).length, 1);
  assert.match(a2.recus(w3, z)[0].title, /Ta série de 5 semaines est en danger/);
});

test('le type « retour » se coupe dans les réglages (pushPrefs)', async () => {
  const k = 'off@t,fr';
  const users = { [k]: { lastSession: der(7), pushPrefs: { retour: false } } };
  const { push, recus } = abonnes(users);
  const w = monde({ users, push }, MARDI);
  await w.jusqua('retour');
  assert.equal(recus(w, k).length, 0);
  assert.equal(w.F.lire('retour_etat/' + k), null, 'rien de noté : le palier n’est pas parti');
});
