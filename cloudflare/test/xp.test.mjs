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
  // Le rang retiré de la page : la jauge serveur s'efface.
  w.F.ecrire('profils_publics/lea_fer/rang', null);
  await w.seanceFin(LEA);
  assert.equal(w.F.lire('volts_publics/lea_fer'), null);
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
test('parrainage : quatre séances faites donnent un mois au parrain, une fois ; trois, ou des séances vides, rien', async () => {
  const w = mondeFilleul();
  for (let k = 0; k < 3; k++) await w.faire();
  await w.faire({ n: 0 });               // une séance sans série validée ne compte pas
  assert.equal(w.F.lire('parrainage/comptes/' + KEV + '/moisGagnes'), null, 'trois séances : rien');
  assert.equal(w.F.lire('droits/' + KEV), null);
  await w.faire();
  assert.equal(w.F.lire('parrainage/comptes/' + KEV + '/moisGagnes'), 1);
  assert.equal(w.F.lire('parrainage/comptes/' + KEV + '/filleuls/f1/creditE'), true);
  assert.equal(w.F.lire('droits/' + KEV + '/palier'), 'essentielle', 'le mois s’applique');
  assert.equal(w.F.lire('parrainage/credits_seances/' + LEA).mode, 'mois_ouvert');
  // Rejoué, et même sans la marque du compteur : la marque creditE tient.
  await w.faire();
  w.F.ecrire('xp_etat/' + LEA + '/parr', null);
  await w.faire();
  assert.equal(w.F.lire('parrainage/comptes/' + KEV + '/moisGagnes'), 1, 'jamais deux fois');
  // Son premier paiement ensuite : pas de second mois.
  const r = await w.M.parrainagePaiement(LEA, 'test');
  assert.equal(r.credit, false);
  assert.equal(w.F.lire('parrainage/comptes/' + KEV + '/moisGagnes'), 1);
  assert.equal(w.F.lire('parrainage/comptes/' + KEV + '/filleuls/f1/statut'), 'payant');
  assert.equal(w.F.lire('parrainage/credits/' + LEA), null, 'rien à reprendre au remboursement');
});
test('parrainage : payé avant ses quatre séances, le filleul a donné son mois au paiement ; les séances n’en redonnent pas', async () => {
  const w = mondeFilleul();
  await w.faire();
  assert.equal((await w.M.parrainagePaiement(LEA, 'test')).credit, true);
  assert.equal(w.F.lire('parrainage/comptes/' + KEV + '/moisGagnes'), 1);
  for (let k = 0; k < 4; k++) await w.faire();
  assert.equal(w.F.lire('parrainage/comptes/' + KEV + '/moisGagnes'), 1);
});
test('parrainage : un parrain encore à l’essai voit sa fin d’essai reculer d’un mois', async () => {
  const fin = T + 25 * J;
  const w = mondeFilleul((b) => ({ users: Object.assign(b.users, { [KEV]: { fname: 'Kev', essai: { ouvertLe: T - 5 * J, finit: fin } } }) }));
  for (let k = 0; k < 4; k++) await w.faire();
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
