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
  // Zoé n'a pas encore de séance, mais elle a dit « Je participe » (saisons_inscrits, 02/10/2026).
  const w = monde({ push, saisons: { [ID]: SAISON }, saisons_etat: { [ID]: { lancement: 1 } }, saisons_inscrits: { [ID]: { [ZOE]: true } },
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

// ══ LE CALENDRIER DES SAISONS : LA SAISON DU MOIS SUIVANT, LE 25 (02/10/2026) ══
import * as CS from '../src/calendrier-saisons.js';

test('calendrier : douze modèles valides, calibrés sur 3 séances par semaine à 80 %', () => {
  assert.deepEqual(CS.MODELES.map((m) => m.mois), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  for (const m of CS.MODELES) {
    assert.ok(SA.SAISON_MESURES.includes(m.mesure), m.nom);
    assert.ok(/^#[0-9a-fA-F]{6}$/.test(m.couleurAccent) && /^[a-z0-9-]{2,40}$/.test(m.badgeCle) && m.texteAccueil.length <= 200, m.nom);
    assert.ok(m.nom.length >= 3 && m.nom.length <= 60);
    assert.ok(m.objectifCollectifParParticipant > 0 && m.objectifCollectifParParticipant <= m.objectifPerso, m.nom);
    const jours = new Date(Date.UTC(2027, m.mois, 0)).getUTCDate(), seances = 3 * jours / 7;
    // Séances : au plus ce qu'un athlète à 3 par semaine fait sur le mois, et au moins 75 % de 80 %.
    if (m.mesure === 'seances') assert.ok(m.objectifPerso <= seances && m.objectifPerso >= 0.75 * 0.8 * seances, m.nom + ' ' + m.objectifPerso);
    if (m.mesure === 'serie') assert.ok(m.objectifPerso <= Math.floor(jours / 7) && m.objectifPerso >= 3, m.nom);
    if (m.mesure === 'tonnage') assert.ok(m.objectifPerso <= 0.8 * seances * 5000, m.nom);
  }
  assert.equal(CS.MODELES[0].nom, 'Résolution tenue');
  assert.equal(CS.MODELES[2].nom, 'Mars en fonte');
  assert.equal(CS.MODELES[11].nom, 'Finir fort');
});

test('calendrier : bornes du mois à Paris (1er 0 h → dernier jour 23 h 59), heure d’été et d’hiver', () => {
  const nov = CS.bornesMois(11, 2026);
  assert.equal(nov.debut, Date.parse('2026-11-01T00:00:00+01:00'));
  assert.equal(nov.fin, Date.parse('2026-11-30T23:59:00+01:00'));
  const juil = CS.bornesMois(7, 2027);
  assert.equal(juil.debut, Date.parse('2027-07-01T00:00:00+02:00'));
  assert.equal(juil.fin, Date.parse('2027-07-31T23:59:00+02:00'));
  // Le 25 décembre 2026 : le mois suivant est janvier 2027.
  assert.deepEqual(CS.moisSuivant(Date.parse('2026-12-25T12:00:00+01:00')), { mois: 1, annee: 2027 });
  assert.equal(CS.idSaison(1, 2027), 'janvier-2027');
  assert.equal(CS.idSaison(8, 2027), 'aout-2027');
});

test('calendrier (pur) : la saison du modèle, objectifCollectif ≥ 1, pas de doublon, la saison manuelle d’abord', () => {
  const t = Date.parse('2026-10-25T12:00:00+02:00');
  const a = CS.saisonAuto({}, t, 0);
  assert.equal(a.id, 'novembre-2026');
  assert.deepEqual([a.saison.nom, a.saison.mesure, a.saison.objectifPerso, a.saison.objectifCollectif, a.saison.auto],
    ['Novembre de fer', 'seances', 10, 1, true], 'aucun participant : 1 au moins');
  assert.ok(SA.saisonValide(a.saison));
  assert.equal(CS.saisonAuto({}, t, 40).saison.objectifCollectif, 40 * 8);
  // Déjà posée (automatique) : rien.
  assert.equal(CS.saisonAuto({ [a.id]: a.saison }, t, 0), null);
  // Une saison MANUELLE de Kevin qui commence en novembre (un autre id) : rien.
  const kevin = { nom: 'Novembre de Kevin', debut: Date.parse('2026-11-03T00:00:00+01:00'), fin: Date.parse('2026-11-20T23:00:00+01:00'),
    mesure: 'tonnage', objectifPerso: 30000, objectifCollectif: 0, badgeCle: 'kevin', couleurAccent: '#123456', texteAccueil: '' };
  assert.equal(CS.saisonAuto({ 'kevin-nov': kevin }, t, 0), null);
  // Posée ENSUITE par Kevin sur la même période : l'automatique s'efface.
  const eff = CS.saisonsEffectives({ [a.id]: a.saison, 'kevin-nov': kevin });
  assert.deepEqual(Object.keys(eff), ['kevin-nov']);
  assert.deepEqual(Object.keys(CS.saisonsEffectives({ [a.id]: a.saison })), [a.id]);
  // Décembre → janvier : changement d'année.
  const d = CS.saisonAuto({}, Date.parse('2026-12-25T12:00:00+01:00'), 3);
  assert.equal(d.id, 'janvier-2027');
  assert.equal(d.saison.nom, 'Résolution tenue');
  assert.equal(d.saison.debut, Date.parse('2027-01-01T00:00:00+01:00'));
  assert.equal(d.saison.objectifCollectif, 9);
});

test('le 25 à 12 h : le travail pose la saison du mois suivant, une fois ; les participants du mois en cours', async () => {
  // Le 25 octobre 2026, la France passe à l'heure d'hiver à 3 h : midi, c'est +01:00.
  const t = Date.parse('2026-10-25T12:00:30+01:00');
  // Douze participants en octobre (le compteur collectif est recalculé chaque heure depuis leurs valeurs).
  const progres = Object.fromEntries(Array.from({ length: 12 }, (_, i) => ['a' + i + '@t,fr', { valeur: 3, maj: 1 }]));
  const w = monde({ saisons: { [ID]: SAISON }, saisons_progres: { [ID]: progres } }, t);
  assert.ok(travaux(w.M).some((x) => x.nom === 'saisons_auto'));
  const q = travaux(w.M).find((x) => x.nom === 'saisons_auto').quand;
  assert.equal(q({ date: 25, heure: 11, minute: 59 }), false);
  assert.equal(q({ date: 25, heure: 12, minute: 0 }), true);
  assert.equal(q({ date: 24, heure: 12, minute: 0 }), false);
  for (let i = 0; i < 8 && !w.F.lire('saisons/novembre-2026'); i++) { await w.minute(); w.avance(60e3); }
  const s = w.F.lire('saisons/novembre-2026');
  assert.equal(s.nom, 'Novembre de fer');
  assert.equal(s.objectifCollectif, 12 * 8, 'participants d’octobre × objectif par participant');
  assert.equal(w.F.lire('worker/jobs/saisons_auto').fini, true);
  // Relancé : pas de doublon.
  assert.equal(await w.M.saisonsAuto(w.t), 'deja');
  assert.deepEqual(Object.keys(w.F.lire('saisons')).sort(), [ID, 'novembre-2026']);
});

test('saison manuelle posée pour le mois suivant : le travail n’en crée pas ; posée après : l’automatique se tait', async () => {
  const t = Date.parse('2026-10-25T12:00:30+02:00');
  const kevin = { nom: 'Novembre de Kevin', debut: Date.parse('2026-11-01T00:00:00+01:00'), fin: Date.parse('2026-11-30T23:00:00+01:00'),
    mesure: 'tonnage', objectifPerso: 30000, objectifCollectif: 0, badgeCle: 'kevin', couleurAccent: '#123456', texteAccueil: 'K' };
  const w = monde({ saisons: { 'kevin-nov': kevin } }, t);
  assert.equal(await w.M.saisonsAuto(w.t), 'deja');
  assert.equal(w.F.lire('saisons/novembre-2026'), null);
  // L'automatique existe déjà, Kevin pose la sienne ensuite : seule la sienne est annoncée.
  const auto = CS.saisonAuto({}, t, 0);
  const w2 = monde({ saisons: { [auto.id]: auto.saison, 'kevin-nov': kevin }, push }, Date.parse('2026-11-01T10:00:00+01:00'));
  await w2.vider();
  const titres = recus(w2).map((r) => r.m.title);
  assert.ok(titres.every((x) => /Novembre de Kevin/.test(x)) && titres.length === 3, titres.join(' | '));
  assert.equal(w2.F.lire('stats/saisons/' + auto.id), null);
});

test('« Je participe » : mi-parcours et J-2 vont aux inscrits et à ceux qui ont avancé', () => {
  const ab = [LEA, TOM, ZOE];
  // Sans liste d'inscrits (anciennes saisons) : comme avant.
  assert.deepEqual(SA.destinataires('mi', SAISON, ab, {}), ab);
  // Avec : ZOE inscrite, TOM a avancé, LEA ni l'un ni l'autre.
  assert.deepEqual(SA.destinataires('mi', SAISON, ab, { [TOM]: 2 }, { [ZOE]: true }), [TOM, ZOE]);
  assert.deepEqual(SA.destinataires('j2', SAISON, ab, { [TOM]: 2 }, { [ZOE]: true }), [TOM, ZOE]);
  assert.deepEqual(SA.destinataires('lancement', SAISON, ab, {}, {}), ab, 'le lancement va à tous');
});
