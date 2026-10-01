// Les volts recalculés par le serveur (/xp_serveur/<compte>) : séances
// nouvelles seulement, règle des 15 min / 6 séries, plafond du jour, bornes
// des catégories non recalculées, badges secrets horaires contrôlés à
// l'heure du serveur.
//   node --test cloudflare/test/xp.test.mjs
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import { creerBase } from '../src/base.js';
import { creerMetier } from '../src/metier.js';
import { minute } from '../src/planif.js';
import * as X from '../src/xp.js';
import { fausseBase } from './fausse-base.mjs';

const vp = crypto.createECDH('prime256v1'); vp.generateKeys();
const VAPID = { publique: vp.getPublicKey().toString('base64url'), privee: vp.getPrivateKey().toString('base64url') };
const PARIS = (iso) => Date.parse(iso + '+02:00');
const J = 864e5;
const T = PARIS('2026-10-06T19:00:00');
const LEA = 'lea@t,fr';
// Une séance : `n` séries validées de `kg` sur un exercice, `min` minutes.
const S = (date, o) => {
  const x = Object.assign({ n: 6, kg: 100, min: 45, nom: 'Squat', tz: -120 }, o || {});
  return { date, duration: x.min, sets: x.n, setsPlanned: x.planned || x.n, tz: x.tz,
    data: { [x.nom]: { sets: Array.from({ length: x.n }, () => ({ weight: String(x.kg), reps: '5', done: true })) } } };
};

function monde(initial, t) {
  const F = fausseBase(initial);
  let n = 0;
  const fetchCompte = (u, i) => { n++; return F.fetchImpl(u, i); };
  const db = creerBase({ url: 'https://base.test', auth: 's', fetchImpl: fetchCompte });
  let horloge = t;
  const M = creerMetier({ db, vapid: VAPID, fetchImpl: fetchCompte, maintenant: () => horloge });
  M.coachsEtUsers = () => db.ref('users').shallow();
  M.abonnes = () => db.ref('push').shallow();
  let k = 0;
  const w = { F, M, avance: (ms) => { horloge += ms; }, get t() { return horloge; },
    minute: () => { n = 0; return minute({ db, M, compteur: () => n, maintenant: () => horloge }); } };
  // Dépose « seance_fin » comme l'app, puis laisse tourner la file.
  w.seanceFin = async (par) => {
    F.ecrire('evenements/e' + (horloge.toString(36)) + (k++).toString().padStart(4, '0'), { type: 'seance_fin', par, at: horloge, cible: '-' });
    for (let i = 0; i < 12 && F.lire('evenements'); i++) { await w.minute(); w.avance(60e3); }
    assert.equal(F.lire('evenements'), null, 'la file s’est vidée');
  };
  return w;
}

test('volts de séance : 100 V seulement si ≥ 15 min ET ≥ 6 séries validées, sinon séries × 10 (max 100)', () => {
  assert.equal(X.voltsSeance(S(T, { n: 6, min: 15 })), 100);
  assert.equal(X.voltsSeance(S(T, { n: 8, min: 10 })), 80, 'trop courte');
  assert.equal(X.voltsSeance(S(T, { n: 3, min: 60 })), 30, 'trop peu de séries');
  assert.equal(X.voltsSeance(S(T, { n: 14, min: 5 })), 100, 'plafonné à 100');
  assert.equal(X.voltsSeance({ date: T, duration: 1, sets: 1, data: {} }), 0, 'une séance d’une minute sans série ne vaut rien');
  // Les séries non validées ne comptent pas, quoi que dise le compteur du client.
  const s = S(T, { n: 6, min: 30 }); s.sets = 40; s.data.Squat.sets[0].done = false;
  assert.equal(X.seriesValidees(s), 5);
  assert.equal(X.voltsSeance(s), 50);
});

test('le calcul : records par exercice (alias compris), complète, plafond du jour', () => {
  const l = [S(T - 3 * J, { kg: 100 }), S(T - 2 * J, { kg: 105, nom: 'Squat ' }), S(T - J, { kg: 100, planned: 8 })];
  const e = X.avancer(null, l, null, T);
  assert.equal(e.n, 3);
  assert.deepEqual(e.s, { seance: 300, complete: 60, record: 50 });
  assert.equal(e.meilleurs.SQUAT, 105);
  // L'alias perso de l'athlète : deux noms, un exercice.
  const a = X.avancer(null, [S(T - 2 * J, { nom: 'Squat barre', kg: 80 }), S(T - J, { nom: 'Back squat', kg: 90 })], { 'BACK SQUAT': 'SQUAT BARRE' }, T);
  assert.equal(a.s.record, 50);
  // Cinq séances le même jour : le plafond de 400 V.
  const jour = Array.from({ length: 5 }, (_, i) => S(T - 5 * 3600e3 + i * 60e3, { kg: 50 + i }));
  const p = X.avancer(null, jour, null, T);
  assert.equal(p.s.seance + p.s.complete + p.s.record, 400);
  // Une séance datée dans le futur du serveur est ignorée.
  assert.equal(X.avancer(null, [S(T + J)], null, T).s.seance, 0);
});

test('badges secrets horaires : prouvés par l’heure du serveur, pas par l’horloge du téléphone', () => {
  // Séance finie à 5 h 40 (Paris), début 4 h 55 : AUBE. Reçue par le serveur à 5 h 41.
  const aube = S(PARIS('2026-10-06T05:40:00'), { min: 45 });
  assert.deepEqual(X.secretsDeSeance(aube), ['aube']);
  const ok = X.avancer(null, [aube], null, PARIS('2026-10-06T05:41:00'));
  assert.ok(ok.secrets.aube > 0);
  // Téléphone réglé à 5 h 40 alors qu'il est 18 h chez le serveur : non prouvé.
  const triche = X.avancer(null, [aube], null, PARIS('2026-10-06T18:00:00'));
  assert.equal(triche.secrets.aube, undefined);
  // Le fuseau de l'appareil compte : 23 h 30 à Montréal (tz 240).
  const nuit = S(Date.parse('2026-10-06T23:30:00-04:00'), { min: 30, tz: 240 });
  assert.deepEqual(X.secretsDeSeance(nuit), ['nuit']);
  assert.deepEqual(X.secretsDeSeance(S(Date.parse('2026-12-25T10:00:00+01:00'), { tz: -60 })), ['noel']);
  assert.deepEqual(X.secretsDeSeance(S(Date.parse('2026-11-13T18:00:00+01:00'), { tz: -60 })), ['vendredi13']);
  // Les badges : un secret horaire non prouvé ne compte pas ; ancien, il reste.
  const b = X.valeurBadges({ aube: { at: T }, nuit: { at: X.XP_SERVEUR_DEPUIS - J }, assidu_1: { at: T }, assidu_4: { at: T } }, {});
  assert.equal(b.v, 40 + 40 + 200);
  assert.deepEqual(b.nonVerifies, ['aube']);
  assert.equal(X.valeurBadges({ aube: { at: T } }, { aube: T }).v, 40);
});

test('les catégories non recalculées : la valeur du client, jamais au-delà de ce que le dossier permet', () => {
  const e = X.avancer(null, [S(T - J)], null, T);
  const honnete = { seance: 100, complete: 30, record: 0, bilan: 160, badge: 40, nutrition: 45, sommeil: 10, checkin: 20, semaine: 150, parcours: 50, archive: 0 };
  const r = X.totalServeur(e, honnete, { nBilans: 2, badges: { assidu_1: { at: T } }, debut: T - 10 * J }, T);
  assert.equal(r.total, 605, 'client honnête : même total');
  const gonfle = Object.assign({}, honnete, { seance: 99999, bilan: 8000, badge: 5000, nutrition: 99999, parcours: 9999 });
  const g = X.totalServeur(e, gonfle, { nBilans: 2, badges: { assidu_1: { at: T } }, debut: T - 10 * J }, T);
  assert.equal(g.cat.seance, 100, 'les séances viennent du serveur');
  assert.equal(g.cat.bilan, 160);
  assert.equal(g.cat.badge, 40);
  assert.equal(g.cat.nutrition, 11 * 15);
  assert.equal(g.cat.parcours, 300);
  assert.deepEqual(X.rangDe(3800).rang.nom, 'VOLTAGE');
});

test('à chaque séance terminée : /xp_serveur/<compte>, séances nouvelles seulement, écart client/serveur visible', async () => {
  const users = { [LEA]: { createdAt: T - 20 * J, sessions: [S(T - 3 * J, { kg: 100 }), S(T - 2 * J, { kg: 105 }), S(T - J, { n: 2, min: 5 })],
    xpDetail: { total: 99999, seance: 99999, badge: 0, bilan: 0 }, badges: {}, bilans: [] } };
  const w = monde({ users }, T);
  await w.seanceFin(LEA);
  const x = w.F.lire('xp_serveur/' + LEA);
  assert.equal(x.cat.seance, 220, '100 + 100 + 20 (une séance de 5 min à 2 séries)');
  assert.equal(x.cat.record, 50);
  assert.equal(x.total, 220 + 90 + 50);
  assert.equal(x.client, 99999, 'le total annoncé par le client est gardé : l’écart se lit');
  assert.equal(x.rang.nom, 'ÉTINCELLE');
  assert.equal(w.F.lire('xp_etat/' + LEA).n, 3);
  // Une séance de plus : seule la nouvelle est lue.
  w.F.ecrire('users/' + LEA + '/sessions/3', S(w.t - 60e3, { kg: 110 }));
  await w.seanceFin(LEA);
  const y = w.F.lire('xp_serveur/' + LEA);
  assert.equal(y.seances, 4);
  assert.equal(y.cat.record, 100);
  assert.equal(y.cat.seance, 320);
});

test('un long historique se rattrape par lots, en sous-tâches', async () => {
  const ses = Array.from({ length: 95 }, (_, i) => S(T - (100 - i) * J, { kg: 60 + i * 0.5 }));
  const w = monde({ users: { [LEA]: { createdAt: T - 200 * J, sessions: ses } } }, T);
  await w.seanceFin(LEA);
  const x = w.F.lire('xp_serveur/' + LEA);
  assert.equal(x.seances, 95);
  assert.equal(x.cat.seance, 9500);
  assert.equal(x.cat.record, 94 * 50);
});

test('la page publique lit /volts_publics/<pseudo> — seulement le sien, seulement si le rang est montré', async () => {
  const ses = [S(T - J)];
  const w = monde({ users: { [LEA]: { sessions: ses, pagePublique: { pseudo: 'lea_fer' } }, 'tom@t,fr': { sessions: ses, pagePublique: { pseudo: 'lea_fer' } } },
    pseudos: { lea_fer: LEA }, profils_publics: { lea_fer: { prenom: 'Léa', rang: { n: 1, nom: 'ÉTINCELLE' } } } }, T);
  await w.seanceFin(LEA);
  const v = w.F.lire('volts_publics/lea_fer');
  assert.equal(v.xp, 130);
  assert.equal(v.rang.nom, 'ÉTINCELLE');
  assert.equal(v.a, 1800);
  // Tom prétend au même pseudo : rien n'est écrit pour lui.
  w.F.ecrire('volts_publics/lea_fer', { xp: 1 });
  await w.seanceFin('tom@t,fr');
  assert.equal(w.F.lire('volts_publics/lea_fer').xp, 1);
  // Le rang retiré de la page : la jauge serveur s'efface ; restent les
  // volts de la semaine, pour le classement entre amis (lot D).
  w.F.ecrire('profils_publics/lea_fer/rang', null);
  await w.seanceFin(LEA);
  const v2 = w.F.lire('volts_publics/lea_fer');
  assert.equal(v2.rang, undefined); assert.equal(v2.xp, undefined);
  assert.ok(v2.sem && Object.keys(v2.sem).length === 1);
});

test('la page publique : le rang du serveur prime, les secrets non prouvés disparaissent', async () => {
  const { ficheAvecServeur } = await import('../src/pages.js');
  const fiche = { prenom: 'Léa', rang: { n: 5, nom: 'ÉLITE' }, volts: { xp: 15000, de: 14000, a: 20000 },
    badges: [{ id: 'aube', nom: 'AUBE' }, { id: 'assidu_1', nom: 'ASSIDU I' }] };
  const f = ficheAvecServeur(fiche, { rang: { n: 2, nom: 'IMPULSION' }, xp: 2100, de: 1800, a: 3800, masquer: ['aube'] });
  assert.deepEqual(f.rang, { n: 2, nom: 'IMPULSION' });
  assert.deepEqual(f.volts, { xp: 2100, de: 1800, a: 3800 });
  assert.deepEqual(f.badges.map((b) => b.id), ['assidu_1']);
  assert.equal(ficheAvecServeur(fiche, null), fiche);
  // Le rang caché par l'athlète reste caché.
  assert.equal(ficheAvecServeur({ prenom: 'Tom' }, { rang: { n: 3, nom: 'VOLTAGE' }, xp: 4000 }).rang, undefined);
});

test('l’événement arrivé avant le dossier : on relève, la file réessaie, la séance est comptée', async () => {
  const users = { [LEA]: { sessions: [S(T - 2 * J)] } };
  const w = monde({ users }, T);
  await w.seanceFin(LEA);
  assert.equal(w.F.lire('xp_serveur/' + LEA).seances, 1);
  // Nouvelle séance annoncée (lastSession), dossier pas encore envoyé.
  w.F.ecrire('users/' + LEA + '/lastSession', w.t);
  w.F.ecrire('evenements/ezzzzzzzz1', { type: 'seance_fin', par: LEA, at: w.t, cible: '-' });
  await w.minute();
  assert.ok(w.F.lire('evenements'), 'toujours dans la file');
  w.F.ecrire('users/' + LEA + '/sessions/1', S(w.t - 60e3));
  for (let i = 0; i < 6 && w.F.lire('evenements'); i++) { w.avance(60e3); await w.minute(); }
  assert.equal(w.F.lire('xp_serveur/' + LEA).seances, 2);
});

test('les constantes du serveur sont celles de l’app (rc-core)', async () => {
  const fs = await import('node:fs');
  const dir = new URL('../../app/', import.meta.url);
  const f = fs.readdirSync(dir).find((x) => /^rc-core\.\d+\.js$/.test(x));
  const src = fs.readFileSync(new URL(f, dir), 'utf8');
  assert.match(src, new RegExp('const XP_PLAFOND_JOUR=' + X.XP_PLAFOND_JOUR + ';'));
  assert.match(src, new RegExp('const SEANCE_VOLTS_MIN_MIN=' + X.SEANCE_MIN_MIN + ', SEANCE_VOLTS_MIN_SERIES=' + X.SEANCE_MIN_SERIES + ', VOLTS_PAR_SERIE=' + X.VOLTS_PAR_SERIE + ';'));
  for (const r of X.RANGS) assert.match(src, new RegExp('\\{n:' + r.n + ',\\s*nom:\'' + r.nom + '\',\\s*seuil:' + r.seuil + '\\}'), r.nom);
  for (const [k, v] of Object.entries({ seance: 100, complete: 30, record: 50, bilan: 80, badge: 40, badgePalier4: 200, checkin: 10 }))
    assert.match(src, new RegExp('\\b' + k + ':' + v + '[,\\s]'), k);
  assert.equal(X.XP.seance, 100);
  // Lot N2 : la cible tenue, 40 V par jour, bornée par le nombre de jours.
  assert.equal(X.XP.cible, 40);
  // UN SEUL instant : deux Date.now() à une milliseconde d'écart donnaient
  // 2 jours + 1 ms, arrondis à 3, donc 4 jours (160) — échec au hasard.
  const t0 = Date.now();
  assert.equal(X.totalServeur(X.etatVide(), { cible: 400 }, { debut: t0 - 2 * 864e5 }, t0).cat.cible, 120);
  // Lot N4 : la semaine d'assiette, 75 V, une par semaine au plus (comme la semaine d'entraînement).
  assert.equal(X.XP.semaineAssiette, 75);
  assert.match(src, /\bsemaineAssiette:75\b/);
  assert.equal(X.totalServeur(X.etatVide(), { semaineAssiette: 75 * 9 }, { debut: t0 - 10 * 864e5 }, t0).cat.semaineAssiette, 150);
});

// ══ LE MOIS DU PARRAIN : LES QUATRE PREMIÈRES SÉANCES DU FILLEUL (lot C) ══
const KEV = 'kev@t,fr';
function mondeFilleul(extra) {
  const base = { users: { [LEA]: { fname: 'Léa', createdAt: T - 2 * J }, [KEV]: { fname: 'Kev' } },
    parrainage: { liens: { [LEA]: { parrain: KEV, id: 'f1' } }, comptes: { [KEV]: { filleuls: { f1: { statut: 'inscrit', date: T - 2 * J } } } } } };
  const w = monde(Object.assign(base, extra ? extra(base) : {}), T);
  let i = 0;
  w.faire = async (o) => {
    w.F.ecrire('users/' + LEA + '/sessions/' + (i++), S(w.t - 60e3, o));
    w.F.ecrire('users/' + LEA + '/lastSession', w.t - 60e3);
    await w.seanceFin(LEA); w.avance(J);
  };
  return w;
}
// ⚠ DEPUIS LE 01/10/2026 : le mois part au PREMIER PAIEMENT du filleul
//   (PARRAINAGE_AU_PAIEMENT), et seulement s'il est QUALIFIÉ — adresse
//   vérifiée vue par le serveur, quatre séances validées sur quatre jours
//   distincts, étalées sur au moins dix jours.
const verifier = (w) => w.F.ecrire('parrainage/verifies/' + LEA, T);
// Quatre séances, une tous les quatre jours : douze jours d'étalement.
const quatreEtalees = async (w, o) => { for (let k = 0; k < 4; k++) { await w.faire(o); w.avance(3 * J); } };
test('parrainage : quatre séances qualifiées SANS paiement ne donnent rien ; le premier paiement donne le mois, une fois', async () => {
  const w = mondeFilleul();
  verifier(w);
  await quatreEtalees(w);
  assert.ok(!w.F.lire('parrainage/comptes/' + KEV + '/moisGagnes'), 'pas de mois sans paiement');
  assert.equal(w.F.lire('xp_etat/' + LEA + '/parr'), null, 'on repassera');
  const r = await w.M.parrainagePaiement(LEA, 'test');
  assert.equal(r.credit, true);
  assert.equal(w.F.lire('parrainage/comptes/' + KEV + '/moisGagnes'), 1);
  assert.equal(w.F.lire('droits/' + KEV + '/palier'), 'essentielle', 'le mois s’applique');
  assert.ok(w.F.lire('parrainage/credits/' + LEA), 'repris au remboursement');
  await w.faire();
  assert.equal(await w.M.parrainagePaiement(LEA, 'test'), null);
  assert.equal(w.F.lire('parrainage/comptes/' + KEV + '/moisGagnes'), 1, 'jamais deux fois');
});
test('parrainage : 4 séances le même jour, sur moins de 10 jours, vides, ou adresse non vérifiée → pas qualifié, pas de mois', async () => {
  // Même jour.
  let w = mondeFilleul(); verifier(w);
  for (let k = 0; k < 4; k++) { w.F.ecrire('users/' + LEA + '/sessions/' + k, S(w.t - 60e3 - k * 3600e3)); }
  await w.seanceFin(LEA);
  assert.equal((await w.M.parrainagePaiement(LEA, 'test')).credit, false);
  assert.equal(w.F.lire('parrainage/comptes/' + KEV + '/filleuls/f1/enAttente'), true);
  // Quatre jours de suite (trois jours d'étalement).
  w = mondeFilleul(); verifier(w);
  for (let k = 0; k < 4; k++) await w.faire();
  assert.equal((await w.M.parrainagePaiement(LEA, 'test')).credit, false);
  // Bien étalées, mais l'adresse n'est pas vérifiée.
  w = mondeFilleul();
  await quatreEtalees(w);
  assert.equal((await w.M.parrainagePaiement(LEA, 'test')).credit, false);
  assert.ok(!w.F.lire('parrainage/comptes/' + KEV + '/moisGagnes'));
  assert.equal(w.F.lire('droits/' + KEV), null);
});
test('parrainage : payé AVANT d’être qualifié → en attente ; la qualification (séances, adresse) donne alors le mois', async () => {
  const w = mondeFilleul();
  await w.faire();
  const r = await w.M.parrainagePaiement(LEA, 'test');
  assert.equal(r.credit, false); assert.equal(r.enAttente, true);
  assert.ok(!w.F.lire('parrainage/comptes/' + KEV + '/moisGagnes'));
  w.avance(3 * J);
  for (let k = 0; k < 3; k++) { await w.faire(); w.avance(3 * J); }
  assert.ok(!w.F.lire('parrainage/comptes/' + KEV + '/moisGagnes'), 'adresse pas encore vérifiée');
  verifier(w);
  await w.faire();
  assert.equal(w.F.lire('parrainage/comptes/' + KEV + '/moisGagnes'), 1);
  assert.ok(w.F.lire('parrainage/credits/' + LEA), 'payant : le mois se reprend au remboursement');
  assert.ok(w.F.lire('xp_etat/' + LEA + '/parr'), 'réglé');
});
test('parrainage : un parrain encore à l’essai voit sa fin d’essai reculer d’un mois', async () => {
  const fin = T + 45 * J;
  const w = mondeFilleul((b) => ({ users: Object.assign(b.users, { [KEV]: { fname: 'Kev', essai: { ouvertLe: T - 5 * J, finit: fin } } }) }));
  verifier(w);
  await quatreEtalees(w);
  await w.M.parrainagePaiement(LEA, 'test');
  const d = w.F.lire('droits/' + KEV);
  assert.equal(d.palier, 'ultime');
  assert.equal(d.source, 'essai');
  assert.equal(d.essaiFinit, fin + 30 * J);
  assert.equal(d.echeance, fin + 30 * J);
  assert.equal(w.F.lire('users/' + KEV + '/essai/finit'), fin + 30 * J);
});
test('parrainage : inscrit depuis le téléphone du parrain, le filleul ne crédite jamais', async () => {
  const w = mondeFilleul((b) => ({ parrainage: { codes: { KEVIN7X9: KEV }, appareils: { abc123: KEV },
    demandes: { [LEA]: { code: 'KEVIN7X9', le: T, appareil: 'abc123' } } } }));
  assert.equal((await w.M.parrainageDemande(LEA, { code: 'KEVIN7X9', appareil: 'abc123' })).raison, 'meme_appareil');
  for (let k = 0; k < 4; k++) await w.faire();
  assert.equal(w.F.lire('parrainage/comptes/' + KEV), null);
  assert.equal(w.F.lire('droits/' + KEV), null);
});

// ══ LES VOLTS DE LA SEMAINE (lot D) ══
test('la semaine : lundi en dates, changements d’heure compris', () => {
  assert.equal(X.lundiDuJour('2026-10-05'), '2026-10-05', 'un lundi');
  assert.equal(X.lundiDuJour('2026-10-04'), '2026-09-28', 'un dimanche');
  assert.equal(X.lundiDuJour('2026-10-25'), '2026-10-19', 'le dimanche de 25 heures');
  assert.equal(X.lundiDuJour('2026-10-26'), '2026-10-26');
  assert.equal(X.lundiDuJour('2027-03-28'), '2027-03-22', 'le dimanche de 23 heures');
  assert.equal(X.lundiDuJour('2027-01-01'), '2026-12-28', 'à cheval sur deux années');
});
test('la semaine : incrémentée à chaque séance, jamais deux fois pour un événement rejoué, treize semaines gardées', async () => {
  const ses = [S(T - J)];
  const w = monde({ users: { [LEA]: { sessions: ses, pagePublique: { pseudo: 'lea_fer' } } }, pseudos: { lea_fer: LEA },
    profils_publics: { lea_fer: { prenom: 'Léa' } } }, T);
  await w.seanceFin(LEA);
  const lu = X.lundiDuJour(X.heureLocale(T - J, -120).jour);
  assert.deepEqual(w.F.lire('volts_publics/lea_fer/sem/' + lu), { v: 130, n: 1 });
  // Rejoué : rien de plus.
  await w.seanceFin(LEA);
  assert.deepEqual(w.F.lire('volts_publics/lea_fer/sem/' + lu), { v: 130, n: 1 });
  // Une séance vide compte zéro volt et zéro séance.
  w.F.ecrire('users/' + LEA + '/sessions/1', { date: w.t - 60e3, duration: 1, sets: 0, data: {}, tz: -120 });
  await w.seanceFin(LEA);
  assert.equal(w.F.lire('volts_publics/lea_fer/sem/' + lu).n, 1);
  const e = X.avancer({ n: 0, sem: Object.fromEntries(Array.from({ length: 20 }, (_, i) => [X.lundiDuJour(new Date(T - (i + 3) * 7 * J).toISOString().slice(0, 10)), { v: 1, n: 1 }])) }, [S(T - J)], null, T);
  assert.equal(Object.keys(e.sem).length, 13);
  assert.ok(e.sem[lu]);
});
test('réactions : l’événement note sans pousser ; le soir, UNE poussée groupée, puis plus rien', async () => {
  const { appareil } = await import('./fausse-base.mjs');
  const tel = appareil('https://push.test/tom');
  const TOM = 'tom@t,fr';
  const w = monde({ users: { [LEA]: { pagePublique: { pseudo: 'lea_fer' } }, 'max@t,fr': { pagePublique: { pseudo: 'max' } }, [TOM]: {} },
    pseudos: { tom__fit: TOM, lea_fer: LEA, max: 'max@t,fr' }, push: { [TOM]: { a: tel.abonnement } },
    profils_publics: { lea_fer: { prenom: 'Léa' }, max: { prenom: 'Max' } },
    reactions: { tom__fit: { '2026-10-05': { lea_fer: '🔥', max: '💪' } } } }, T);
  assert.equal(await w.M.reactionEvenement({ par: LEA, cible: 'tom__fit', jour: '2026-10-05' }, w.t), 'note');
  assert.equal(await w.M.reactionEvenement({ par: 'max@t,fr', cible: 'tom__fit', jour: '2026-10-05' }, w.t), 'note');
  assert.equal(w.F.recus.length, 0, 'jamais une poussée par réaction');
  assert.equal(await w.M.reactionEvenement({ par: LEA, cible: 'tom__fit', jour: '2026-10-04' }, w.t), 'sans_reaction');
  assert.equal(await w.M.reactionsPushUn(TOM, w.t), 'envoye');
  assert.equal(w.F.recus.length, 1);
  const m = tel.lire(w.F.recus[0].init.body);
  assert.match(m.title, /^(Léa|Max) et 1 autre ont réagi à ta séance$/);
  assert.doesNotMatch(m.title + m.body, /kg|squat|série/i, 'rien de ce qu’il y avait dans la séance');
  assert.equal(await w.M.reactionsPushUn(TOM, w.t), 'rien', 'une fois');
});

// ══ LES SCORES CALCULÉS PAR LE SERVEUR (valeurServeur, 01/10/2026) ═══════
// LES MÊMES FIXTURES que functions/test/defis.test.js (et que la suite du
// client) : deux séances en septembre, avant le défi ; quatre en octobre,
// dont deux la semaine du 5 ; deux créneaux actifs. Mêmes résultats attendus.
const TZ = (iso) => Date.parse(iso);
const DEBUT_D = TZ('2026-09-30T22:00:00Z'), FIN_D = TZ('2026-10-31T22:59:59Z');
const SD = (iso, squat, rowing, volume) => ({ date: TZ(iso), volume,
  data: { 'Squat': { sets: [{ weight: String(squat), reps: '5', done: true }] }, 'Rowing barre': { sets: [{ weight: String(rowing), reps: '8', done: true }] } } });
const SEPT = [SD('2026-09-20T17:00:00Z', 100, 60, 3000), SD('2026-09-25T17:00:00Z', 100, 64, 3100)];
const OCT = [SD('2026-10-05T17:00:00Z', 105, 64, 3200), SD('2026-10-07T17:00:00Z', 110, 66, 3300),
  SD('2026-10-14T17:00:00Z', 110, 68, 3400), SD('2026-10-28T17:00:00Z', 112, 70, 3500)];
const QUOTA = 2;   // sessions_config : deux créneaux actifs sur trois
const FUTUR = TZ('2027-01-01T00:00:00Z');

test('valeurServeur : séances 4, tonnage 13 400, série 1, progression +10,7 % (les fixtures des défis du Canal)', () => {
  const e0 = X.avancer(X.etatVide(), SEPT, null, FUTUR);
  // Le défi s'ouvre : l'instantané « avant » est figé sur l'état d'avant les séances d'octobre.
  let e = X.avancer(e0, OCT, null, FUTUR);
  e = X.figerRef(e0, e, 'm1', DEBUT_D + 3600e3);
  assert.equal(X.valeurServeur(e, 'seances', DEBUT_D, FIN_D, QUOTA), 4);
  assert.equal(X.valeurServeur(e, 'tonnage', DEBUT_D, FIN_D, QUOTA), 13400);
  assert.equal(X.valeurServeur(e, 'serie', DEBUT_D, FIN_D, QUOTA), 1);
  // Squat 100 → 112 (+12 %), rowing 64 → 70 (+9,375 %) : moyenne 10,7 %.
  assert.equal(X.valeurServeur(e, 'progressionPct', DEBUT_D, FIN_D, QUOTA, 'm1'), 10.7);
  // Le classement : jamais aux kilos.
  assert.equal(X.metriqueServeur(e, 'tonnage', DEBUT_D, FIN_D, QUOTA), 4);
  // Un instantané déjà pris ne se refige pas.
  assert.deepEqual(X.figerRef(e, e, 'm1', FIN_D).ref.m1, e.ref.m1);
});

test('valeurServeur : une séance à 0 série ne compte jamais ; le journal ne garde que 40 jours', () => {
  const vide = { date: TZ('2026-10-06T17:00:00Z'), volume: 999, data: { Squat: { sets: [{ weight: '200', reps: '5', done: false }] } } };
  const e = X.avancer(X.etatVide(), [OCT[0], vide], null, FUTUR);
  assert.equal(X.valeurServeur(e, 'seances', DEBUT_D, FIN_D, 1), 1);
  assert.equal(X.valeurServeur(e, 'tonnage', DEBUT_D, FIN_D, 1), 3200, 'les 999 kg d’une séance sans série validée ne comptent pas');
  const loin = X.avancer(e, [SD('2026-12-20T17:00:00Z', 100, 60, 1000)], null, FUTUR);
  assert.deepEqual(Object.keys(loin.jr), ['2026-12-20'], 'plus de 40 jours : purgé');
  assert.equal(X.tonnageSeance({ data: { A: { sets: [{ weight: '50', reps: '10', done: true }, { weight: '50', reps: '10', done: false }] } } }), 500);
});

// ══ LA MISSION DU JOUR : LE COFFRE BORNÉ, LE JOKER DATÉ (01/10/2026) ═══════
test('mission du jour : cat.mission bornée à jours × 50, le joker accepté seulement s’il est daté', async () => {
  const t0 = PARIS('2026-10-10T12:00:00');
  assert.equal(X.XP.mission, 50);
  // Trois jours de compte : 150 V au plus, quoi que dise l'app.
  assert.equal(X.totalServeur(X.etatVide(), { mission: 5000 }, { debut: t0 - 2 * J }, t0).cat.mission, 150);
  assert.equal(X.totalServeur(X.etatVide(), { mission: 70 }, { debut: t0 - 2 * J }, t0).cat.mission, 70);
  assert.equal(X.totalServeur(X.etatVide(), { mission: -9 }, { debut: t0 - 2 * J }, t0).cat.mission, 0);
  // La constante de l'app (MISSION_VOLTS_MAX) est celle du serveur.
  const fs = await import('node:fs');
  const dir = new URL('../../app/', import.meta.url);
  const src = fs.readFileSync(new URL(fs.readdirSync(dir).find((x) => /^rc-core\.\d+\.js$/.test(x)), dir), 'utf8');
  assert.match(src, new RegExp('const MISSION_VOLTS_MAX=' + X.XP.mission + ';'));
  assert.match(src, new RegExp('const STREAK_JOKERS_MAX=' + X.JOKERS_MAX + ', STREAK_JOKER_TOUS=' + X.JOKER_TOUS + ';'));
  // LE JOKER : une série de 2 semaines n'en explique aucun.
  assert.equal(X.jokersAdmis({ streak: 2, streakJokers: 1 }), 0, 'joker sans coffre daté : refusé');
  assert.equal(X.jokersAdmis({ streak: 2, streakJokers: 1, missions: { '2026-10-08': { coffre: { gain: 'joker', at: t0 - 2 * J } } } }), 1);
  // Un coffre de volts, ou un joker sans date, n'explique rien.
  assert.equal(X.jokersAdmis({ streak: 2, streakJokers: 1, missions: { '2026-10-08': { coffre: { gain: 50, at: t0 } }, '2026-10-09': { coffre: { gain: 'joker' } } } }), 0);
  // Quatre semaines validées en expliquent un ; le coffre le second ; jamais plus de 2.
  assert.equal(X.jokersAdmis({ streak: 4, streakJokers: 2 }), 1);
  assert.equal(X.jokersAdmis({ streak: 4, streakJokers: 2, missions: { '2026-10-08': { coffre: { gain: 'joker', at: t0 } } } }), 2);
  assert.equal(X.jokersAdmis({ streak: 40, streakJokers: 9 }), 2);
  assert.equal(X.jokersAdmis({ streak: 0, streakJokers: 0 }), 0);
});

// ══ LA PART HORS ENTRAÎNEMENT BORNÉE, LES RANGS LISSÉS (01/10/2026) ═════════
test('la part hors entraînement : 40 % de l’entraînement + 150 V par semaine du compte, comme l’app ; rangs et prestige en miroir', async () => {
  const t0 = PARIS('2026-10-10T12:00:00');
  // Trois semaines, aucune séance : 3 × 150 V au plus, rabotés dans l'ordre de l'app.
  const r = X.totalServeur(X.etatVide(), { nutrition: 300, cible: 600, sommeil: 100, checkin: 200, semaineAssiette: 150 }, { debut: t0 - 20 * J }, t0);
  const hors = X.HORS.reduce((a, k) => a + r.cat[k], 0);
  assert.equal(hors, 450);
  assert.equal(r.cat.semaineAssiette, 0, 'la semaine d’assiette part la première');
  assert.equal(r.cat.sommeil, 100, 'la nuit, la dernière');
  // Avec de l'entraînement recalculé par le serveur : 40 % de plus.
  const e = X.avancer(null, Array.from({ length: 9 }, (_, i) => S(t0 - (18 - 2 * i) * J)), null, t0);
  const entr = e.s.seance + e.s.complete + e.s.record;
  const r2 = X.totalServeur(e, { nutrition: 300, cible: 600, sommeil: 100, checkin: 200 }, { debut: t0 - 20 * J }, t0);
  assert.equal(X.HORS.reduce((a, k) => a + r2.cat[k], 0), Math.min(1200, Math.floor(0.4 * entr + 450)));
  // Sous la borne : rien ne bouge.
  assert.equal(X.totalServeur(X.etatVide(), { nutrition: 45, checkin: 30 }, { debut: t0 - 6 * J }, t0).cat.nutrition, 45);
  // Les constantes de l'app.
  const fs = await import('node:fs');
  const dir = new URL('../../app/', import.meta.url);
  const src = fs.readFileSync(new URL(fs.readdirSync(dir).find((x) => /^rc-core\.\d+\.js$/.test(x)), dir), 'utf8');
  assert.match(src, new RegExp('const XP_HORS_PART=' + X.HORS_PART + ', XP_HORS_PLANCHER=' + X.HORS_PLANCHER + ', XP_HORS_FENETRE=7;'));
  assert.match(src, new RegExp('const PRESTIGE_TRANCHE=' + X.PRESTIGE_TRANCHE + ';'));
  assert.match(src, new RegExp("const XP_HORS=Object\\.freeze\\(\\[" + X.HORS.map((k) => "'" + k + "'").join(',') + '\\]\\);'));
  // Des écarts croissants entre les rangs.
  for (let i = 2; i < X.RANGS.length; i++) assert.ok(X.RANGS[i].seuil - X.RANGS[i - 1].seuil > X.RANGS[i - 1].seuil - X.RANGS[i - 2].seuil, X.RANGS[i].nom);
});
