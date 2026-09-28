// Les événements saisonniers (/saisons), sur la fausse base : le compteur
// collectif chaque heure, les badges Édition, les quatre annonces.
//   node --test cloudflare/test/saisons.test.mjs
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import { creerBase } from '../src/base.js';
import { creerMetier } from '../src/metier.js';
import { minute, travaux } from '../src/planif.js';
import * as SA from '../src/saisons.js';
import { fausseBase, appareil } from './fausse-base.mjs';

const vp = crypto.createECDH('prime256v1'); vp.generateKeys();
const VAPID = { publique: vp.getPublicKey().toString('base64url'), privee: vp.getPrivateKey().toString('base64url') };
const PARIS = (iso) => Date.parse(iso + '+02:00');
const J = 864e5;
const LEA = 'lea@t,fr', TOM = 'tom@t,fr', ZOE = 'zoe@t,fr', ID = 'hiver-2026';
const DEBUT = PARIS('2026-10-05T00:00:00'), FIN = PARIS('2026-10-25T23:59:59');
const SAISON = { nom: 'Hiver de fer', debut: DEBUT, fin: FIN, mesure: 'seances', objectifPerso: 10, objectifCollectif: 100,
  badgeCle: 'hiver', couleurAccent: '#3aa0ff', texteAccueil: 'Dix séances avant la Toussaint.' };

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
  // Les travaux d'avant prennent leur part du budget : on laisse tourner les
  // minutes jusqu'à ce que celui des saisons soit fini (comme en production).
  w.jusquAuxSaisons = async () => {
    for (let i = 0; i < 8; i++) { const b = await w.minute(); if (b.travaux.saisons === 'fini') return b; w.avance(60e3); }
    throw new Error('travail « saisons » jamais fini');
  };
  // Les push qui dépassaient le budget de la minute sont différés dans la
  // file : ils partent aux minutes suivantes.
  w.vider = async () => {
    await w.jusquAuxSaisons();
    for (let i = 0; i < 10 && w.F.lire('evenements'); i++) { w.avance(60e3); await w.minute(); }
    assert.equal(w.F.lire('evenements'), null, 'la file des push différés s’est vidée');
  };
  return w;
}
const tels = { [LEA]: appareil('https://push.test/lea'), [TOM]: appareil('https://push.test/tom'), [ZOE]: appareil('https://push.test/zoe') };
const push = Object.fromEntries(Object.keys(tels).map((k) => [k, { a: tels[k].abonnement }]));
const recus = (w) => w.F.recus.map((r) => { const k = Object.keys(tels).find((x) => r.endpoint === tels[x].abonnement.endpoint); return { k, m: tels[k].lire(r.init.body) }; });

test('le calcul : compteur collectif, finis, annonces dans l’ordre', () => {
  const v = SA.valeurs({ [LEA]: { valeur: 12 }, [TOM]: { valeur: 4 }, [ZOE]: { valeur: -2 }, x: { valeur: 'abc' } });
  assert.deepEqual(v, { [LEA]: 12, [TOM]: 4 });
  const st = SA.statsSaison(SAISON, v, 5);
  assert.deepEqual(st, { total: 16, participants: 2, finis: 1, objectifCollectif: 100, part: 0.16, maj: 5 });
  assert.deepEqual(SA.nouveauxFinis(SAISON, v, {}), [LEA]);
  assert.deepEqual(SA.nouveauxFinis(SAISON, v, { [LEA]: 1 }), []);
  assert.equal(SA.annonceSaison(SAISON, {}, DEBUT - 1), null);
  assert.equal(SA.annonceSaison(SAISON, {}, DEBUT + 1), 'lancement');
  const mi = DEBUT + (FIN - DEBUT) / 2 + 1;
  assert.equal(SA.annonceSaison(SAISON, { lancement: 1 }, mi), 'mi');
  assert.equal(SA.annonceSaison(SAISON, { lancement: 1, mi: 1 }, FIN - J), 'j2');
  assert.equal(SA.annonceSaison(SAISON, { lancement: 1, mi: 1, j2: 1 }, FIN + 1), 'fin');
  assert.equal(SA.annonceSaison(SAISON, { fin: 1 }, FIN + 1), null);
  // Les destinataires.
  const ab = [LEA, TOM, ZOE];
  assert.deepEqual(SA.destinataires('mi', SAISON, ab, v), [TOM, ZOE], 'les retardataires : moins de la moitié');
  assert.deepEqual(SA.destinataires('j2', SAISON, ab, v), [TOM, ZOE]);
  assert.deepEqual(SA.destinataires('fin', SAISON, ab, v), [LEA, TOM], 'la fin, aux participants');
  assert.equal(SA.resultatSaison(ID, SAISON, 9).annee, '2026');
  assert.equal(SA.saisonSuivie(SAISON, FIN + 3 * J), false);
  assert.equal(SA.saisonValide(Object.assign({}, SAISON, { mesure: 'poids' })), false);
});

test('lancement : le compteur est posé ; l’annonce attend 9 h, puis part à tous les abonnés, une fois', async () => {
  const nuit = DEBUT + 3600e3;
  const w0 = monde({ push, saisons: { [ID]: SAISON } }, nuit);
  await w0.jusquAuxSaisons();
  assert.equal(w0.F.recus.length, 0, 'pas de push à 1 h du matin');
  assert.equal(w0.F.lire('saisons_etat/' + ID + '/lancement'), null, 'l’annonce reste à faire');
  assert.equal(w0.F.lire('stats/saisons/' + ID).total, 0, 'le compteur, lui, est posé');
  const t = DEBUT + 10 * 3600e3;
  const w = monde({ push, saisons: { [ID]: SAISON } }, t);
  await w.vider();
  const st = w.F.lire('stats/saisons/' + ID);
  assert.equal(st.total, 0); assert.equal(st.objectifCollectif, 100);
  const r = recus(w);
  assert.equal(r.length, 3);
  assert.ok(r.every((x) => x.m.title === 'Hiver de fer commence ⚡' && /^Objectif : 10 séances d’ici le 25 octobre/.test(x.m.body)), JSON.stringify(r[0].m));
  assert.ok(w.F.lire('saisons_etat/' + ID + '/lancement') > 0);
  // L'heure suivante : le compteur suit, l'annonce ne repart pas.
  w.F.ecrire('saisons_progres/' + ID, { [LEA]: { valeur: 3, maj: t }, [TOM]: { valeur: 1, maj: t } });
  w.avance(3600e3);
  await w.jusquAuxSaisons();
  assert.equal(w.F.lire('stats/saisons/' + ID).total, 4);
  assert.equal(w.F.lire('stats/saisons/' + ID).participants, 2);
  assert.equal(w.F.recus.length, 3);
});

test('un travail HORAIRE : une fois par heure, pas plus', async () => {
  const t = PARIS('2026-10-06T10:05:00');
  const w = monde({ saisons: { [ID]: SAISON }, saisons_etat: { [ID]: { lancement: 1 } } }, t);
  await w.jusquAuxSaisons();
  const m1 = w.F.lire('stats/saisons/' + ID).maj;
  w.avance(20 * 60e3);
  const b = await w.minute();
  assert.equal(b.travaux.saisons, undefined, 'même heure : déjà fait');
  assert.equal(w.F.lire('stats/saisons/' + ID).maj, m1);
  w.avance(40 * 60e3);
  await w.jusquAuxSaisons();
  assert.ok(w.F.lire('stats/saisons/' + ID).maj > m1, 'l’heure suivante, recalculé');
  const job = travaux(w.M).find((x) => x.nom === 'saisons');
  assert.ok(job && job.heure === true);
});

test('bouclé : le badge Édition est écrit une fois, avec l’année', async () => {
  const t = PARIS('2026-10-10T14:00:00');
  const w = monde({ saisons: { [ID]: SAISON }, saisons_etat: { [ID]: { lancement: 1 } },
    saisons_progres: { [ID]: { [LEA]: { valeur: 10, maj: t }, [TOM]: { valeur: 9, maj: t } } } }, t);
  await w.jusquAuxSaisons();
  const r = w.F.lire('saisons_resultats/' + LEA + '/' + ID);
  assert.equal(r.nom, 'Hiver de fer'); assert.equal(r.annee, '2026'); assert.equal(r.badgeCle, 'hiver'); assert.equal(r.couleur, '#3aa0ff');
  assert.equal(w.F.lire('saisons_resultats/' + TOM), null);
  const le = r.termineLe;
  w.avance(3600e3);
  await w.jusquAuxSaisons();
  assert.equal(w.F.lire('saisons_resultats/' + LEA + '/' + ID).termineLe, le, 'pas réécrit');
});

test('mi-parcours aux retardataires seulement, J-2 à qui n’a pas bouclé, puis la fin', async () => {
  const mi = DEBUT + (FIN - DEBUT) / 2 + 3600e3;
  const w = monde({ push, saisons: { [ID]: SAISON }, saisons_etat: { [ID]: { lancement: 1 } },
    saisons_progres: { [ID]: { [LEA]: { valeur: 6, maj: 1 }, [TOM]: { valeur: 2, maj: 1 } } } }, mi);
  await w.vider();
  let r = recus(w);
  assert.deepEqual(r.map((x) => x.k).sort(), [TOM, ZOE]);
  assert.match(r.find((x) => x.k === TOM).m.body, /^Tu en es à 2 sur 10 séances/);
  // J-2 (le lendemain du plafond d'un push par jour).
  w.F.ecrire('saisons_progres/' + ID + '/' + TOM, { valeur: 10, maj: 1 });
  w.avance(FIN - 1.5 * J - w.t);
  await w.vider();
  r = recus(w).slice(2);
  assert.deepEqual(r.map((x) => x.k).sort(), [LEA, ZOE], 'Tom a bouclé : pas de J-2');
  assert.match(r.find((x) => x.k === LEA).m.body, /^Il te manque 4 pour 10 séances/);
  // Après la fin.
  w.avance(2 * J);
  await w.vider();
  r = recus(w).slice(4);
  assert.deepEqual(r.map((x) => x.k).sort(), [LEA, TOM]);
  assert.equal(r.find((x) => x.k === TOM).m.title, 'Tu as bouclé Hiver de fer ⚡');
  assert.equal(r.find((x) => x.k === LEA).m.title, 'Hiver de fer est terminé');
  // Au-delà de deux jours après la fin, plus rien n'est suivi.
  w.avance(3 * J);
  const b = await w.jusquAuxSaisons();
  assert.equal(recus(w).length, 6);
  assert.ok(b.requetes < 38);
});
