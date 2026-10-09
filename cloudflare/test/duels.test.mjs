// Les duels, de bout en bout, sur la fausse base : l'arrivée de l'invité, le
// démarrage à sa première séance, les scores, J-2, la clôture et le CHAMPION.
//   node --test cloudflare/test/duels.test.mjs
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import test from 'node:test';
import { creerBase } from '../src/base.js';
import { creerMetier } from '../src/metier.js';
import { minute, travaux } from '../src/planif.js';
import * as DU from '../src/duels.js';
import { fausseBase, appareil } from './fausse-base.mjs';

const vp = crypto.createECDH('prime256v1'); vp.generateKeys();
const VAPID = { publique: vp.getPublicKey().toString('base64url'), privee: vp.getPrivateKey().toString('base64url') };
const PARIS = (iso) => Date.parse(iso + '+02:00');
const J = 864e5;
const LEA = 'lea@t,fr', TOM = 'tom@t,fr', ID = 'dabc123def456';

function monde(initial, t) {
  const F = fausseBase(initial);
  let n = 0;
  const fetchCompte = (u, i) => { n++; return F.fetchImpl(u, i); };
  const db = creerBase({ url: 'https://base.test', auth: 's', fetchImpl: fetchCompte });
  let horloge = t;
  const M = creerMetier({ db, vapid: VAPID, fetchImpl: fetchCompte, maintenant: () => horloge });
  M.coachsEtUsers = () => db.ref('users').shallow();
  return { F, M, avance: (ms) => { horloge += ms; }, get t() { return horloge; },
    minute: () => { n = 0; return minute({ db, M, compteur: () => n, maintenant: () => horloge }); } };
}
let ne = 0;
const ev = (type, par, t) => ({ ['e' + (1000000000 + ne++).toString(36)]: { type, par, cible: ID, at: t } });
const telL = appareil('https://push.test/lea'), telT = appareil('https://push.test/tom');
const pushs = { [LEA]: { a: telL.abonnement }, [TOM]: { b: telT.abonnement } };
const duel = (x) => Object.assign({ createur: LEA, createurNom: 'Léa', mesure: 'seances', duree: 14, creeLe: 1, statut: 'attente' }, x);
const titres = (w) => w.F.recus.map((r) => (r.endpoint.endsWith('/lea') ? telL : telT).lire(r.init.body).title);

test('les textes : « 14 jours de régularité », les scores lisibles, le gagnant', () => {
  assert.equal(DU.texteDuel('seances', 14), '14 jours de régularité');
  assert.equal(DU.texteDuel('tonnage', 7), '7 jours de volume');
  assert.equal(DU.texteDuel('progressionPct', 28), '28 jours de progression');
  assert.equal(DU.texteDuel('inconnu', 99), '14 jours de régularité');
  assert.equal(DU.texteScore('tonnage', 12500), '12,5 t');
  assert.equal(DU.texteScore('seances', 1), '1 séance');
  assert.equal(DU.gagnantDe({ createur: 3, invite: 2 }), 'createur');
  assert.equal(DU.gagnantDe({ createur: 2, invite: 5 }), 'invite');
  assert.equal(DU.gagnantDe({ createur: 4, invite: 4 }), 'egalite');
  assert.deepEqual(DU.scoresDe({ createur: LEA, invite: TOM, progres: { [LEA]: { valeur: 5 }, [TOM]: { valeur: -3 }, x: { valeur: 99 } } }), { createur: 5, invite: 0 });
});

test('l’invité rejoint : le duel est accepté, le créateur prévenu, suivi dans duels_actifs', async () => {
  const t = PARIS('2026-09-28T12:00:00');
  const w = monde({ push: pushs, duels: { [ID]: duel({ invite: TOM, inviteNom: 'Tom' }) }, evenements: ev('duel_rejoint', TOM, t) }, t);
  await w.minute();
  assert.equal(w.F.lire('duels/' + ID + '/statut'), 'accepte');
  assert.equal(w.F.lire('duels/' + ID + '/rejointLe'), t);
  assert.deepEqual(w.F.lire('duels_actifs/' + ID), { fin: 0, depuis: t });
  assert.deepEqual(titres(w), ['Tom relève ton duel ⚡']);
  // Rejoué : rien de plus.
  w.F.ecrire('evenements', ev('duel_rejoint', TOM, t)); w.avance(J);
  await w.minute();
  assert.equal(w.F.recus.length, 1);
});

test('quelqu’un qui n’est pas du duel ne change rien', async () => {
  const t = PARIS('2026-09-28T12:00:00');
  const w = monde({ push: pushs, duels: { [ID]: duel({ invite: TOM, inviteNom: 'Tom' }) }, evenements: ev('duel_rejoint', 'zoe@t,fr', t) }, t);
  await w.minute();
  assert.equal(w.F.lire('duels/' + ID + '/statut'), 'attente');
  assert.equal(w.F.recus.length, 0);
  // Le créateur ne peut pas « rejoindre » son propre duel.
  const w2 = monde({ push: pushs, duels: { [ID]: duel({ invite: TOM }) }, evenements: ev('duel_rejoint', LEA, t) }, t);
  await w2.minute();
  assert.equal(w2.F.lire('duels/' + ID + '/statut'), 'attente');
});

test('démarrage à la 1re séance de l’invité (pas du créateur), progression d’avant effacée, push aux deux', async () => {
  const t = PARIS('2026-09-29T19:00:00');
  const d = duel({ invite: TOM, inviteNom: 'Tom', statut: 'accepte', rejointLe: t - J, progres: { [LEA]: { valeur: 50, maj: 1 } } });
  const w = monde({ push: pushs, duels: { [ID]: d }, duels_actifs: { [ID]: { fin: 0 } }, evenements: ev('duel_maj', LEA, t) }, t);
  await w.minute();
  assert.equal(w.F.lire('duels/' + ID + '/statut'), 'accepte', 'le créateur ne déclenche pas le départ');
  w.F.ecrire('evenements', ev('duel_maj', TOM, t)); w.avance(60e3);
  await w.minute();
  const x = w.F.lire('duels/' + ID);
  assert.equal(x.statut, 'en_cours');
  assert.equal(x.debut, t - 4 * 3600e3);
  assert.equal(x.fin, x.debut + 14 * J);
  assert.equal(x.progres, undefined, 'la progression d’avant le début est effacée');
  assert.deepEqual(x.scores, { createur: 0, invite: 0 });
  assert.deepEqual(w.F.lire('duels_actifs/' + ID), { fin: x.fin });
  assert.deepEqual(titres(w).sort(), ['Le duel commence ⚡', 'Le duel commence ⚡']);
});

test('les scores suivent la progression écrite par chacun ; la clôture donne le CHAMPION au gagnant', async () => {
  const t = PARIS('2026-10-01T12:00:00'), debut = t - 3 * J;
  const d = duel({ invite: TOM, inviteNom: 'Tom', statut: 'en_cours', rejointLe: debut - J, debut, fin: debut + 14 * J,
    progres: { [LEA]: { valeur: 4, maj: t }, [TOM]: { valeur: 6, maj: t } } });
  const w = monde({ push: pushs, duels: { [ID]: d }, duels_actifs: { [ID]: { fin: d.fin } }, evenements: ev('duel_maj', LEA, t) }, t);
  await w.minute();
  assert.deepEqual(w.F.lire('duels/' + ID + '/scores'), { createur: 4, invite: 6 });
  assert.equal(w.F.recus.length, 0, 'une mise à jour de score ne pousse rien');
  // Après la fin : l'événement suivant clôture.
  w.F.ecrire('duels/' + ID + '/progres/' + LEA + '/valeur', 9);
  w.avance(12 * J);
  w.F.ecrire('evenements', ev('duel_maj', LEA, w.t));
  await w.minute();
  const x = w.F.lire('duels/' + ID);
  assert.equal(x.statut, 'termine');
  assert.equal(x.gagnant, 'createur');
  assert.deepEqual(x.scores, { createur: 9, invite: 6 });
  assert.equal(w.F.lire('duels_actifs/' + ID), null);
  const rL = w.F.lire('defis_resultats/' + LEA + '/' + ID), rT = w.F.lire('defis_resultats/' + TOM + '/' + ID);
  assert.equal(rL.champion, true); assert.equal(rT.champion, false);
  assert.equal(rL.duel, true); assert.equal(rL.titre, 'Duel contre Tom');
  assert.deepEqual(titres(w).sort(), ['Léa remporte le duel', 'Tu as gagné ton duel ⚡']);
});

test('le travail du jour : J-2 une fois, la clôture, l’annulation d’un duel jamais commencé', async () => {
  // Un mercredi : ni la série (jeudi) ni le bilan (samedi) ne passent avant.
  const t = PARIS('2026-10-07T18:40:00'), debut = t - 12.5 * J;   // fin dans un jour et demi
  const d1 = duel({ invite: TOM, inviteNom: 'Tom', statut: 'en_cours', debut, fin: debut + 14 * J, scores: { createur: 2, invite: 2 },
    progres: { [LEA]: { valeur: 3, maj: t }, [TOM]: { valeur: 2, maj: t } } });
  const D2 = 'dzzz999yyy888', D3 = 'dqqq111www222';
  const d3 = duel({ invite: 'zoe@t,fr', inviteNom: 'Zoé', statut: 'accepte', rejointLe: t - 31 * J });
  const w = monde({ push: pushs, duels: { [ID]: d1, [D3]: d3 }, duels_actifs: { [ID]: { fin: d1.fin }, [D2]: { fin: 1 }, [D3]: { fin: 0 } } }, t);
  // Les travaux d'avant (accès, défis…) prennent leur part du budget : les
  // duels passent dans la minute où ils ont la leur, comme en production.
  const jusquAuxDuels = async () => { for (let i = 0; i < 6; i++) { const b = await w.minute(); if (b.travaux.duels === 'fini') return; w.avance(60e3); } throw new Error('travail « duels » jamais fini'); };
  await jusquAuxDuels();
  assert.equal(w.F.lire('duels/' + ID + '/rappel'), true);
  const ts = titres(w);
  assert.equal(ts.length, 2);
  assert.ok(ts.every((x) => /^Plus que 2 jours contre (Tom|Léa)$/.test(x)), ts.join());
  const corpsLea = telL.lire(w.F.recus.find((r) => r.endpoint.endsWith('/lea')).init.body).body;
  assert.match(corpsLea, /^Tu mènes : 3 séances contre 2 séances/);
  assert.equal(w.F.lire('duels_actifs/' + D2), null, 'un index sans duel est oublié');
  assert.equal(w.F.lire('duels/' + D3 + '/statut'), 'annule');
  assert.equal(w.F.lire('duels_actifs/' + D3), null);
  // Le lendemain, même heure : pas de second rappel ; le surlendemain, la clôture.
  w.avance(J);
  await jusquAuxDuels();
  assert.equal(w.F.recus.length, 2);
  w.avance(J + 3600e3);
  await jusquAuxDuels();
  assert.equal(w.F.lire('duels/' + ID + '/statut'), 'termine');
  assert.equal(w.F.lire('duels/' + ID + '/gagnant'), 'createur');
});

test('égalité : pas de CHAMPION, « Revanche ? »', async () => {
  const t = PARIS('2026-10-20T12:00:00');
  const d = duel({ id: ID, invite: TOM, inviteNom: 'Tom', statut: 'en_cours', debut: t - 15 * J, fin: t - J,
    progres: { [LEA]: { valeur: 5, maj: t }, [TOM]: { valeur: 5, maj: t } } });
  const w = monde({ push: pushs, duels: { [ID]: d }, duels_actifs: { [ID]: { fin: d.fin } }, evenements: ev('duel_maj', TOM, t) }, t);
  await w.minute();
  assert.equal(w.F.lire('duels/' + ID + '/gagnant'), 'egalite');
  assert.equal(w.F.lire('defis_resultats/' + LEA + '/' + ID).champion, false);
  assert.equal(w.F.lire('defis_resultats/' + TOM + '/' + ID).champion, false);
  assert.ok(titres(w).every((x) => x === 'Égalité contre Tom' || x === 'Égalité contre Léa'));
});

test('le budget : un événement de duel coûte peu, et le travail du jour a son coût déclaré', async () => {
  const t = PARIS('2026-10-01T12:00:00');
  const d = duel({ invite: TOM, inviteNom: 'Tom', statut: 'en_cours', debut: t - J, fin: t + 13 * J, progres: { [LEA]: { valeur: 1, maj: t } } });
  // Le même monde sans l'événement : la différence est le coût du duel.
  const w0 = monde({ duels: { [ID]: d } }, t);
  const b0 = await w0.minute();
  const w = monde({ duels: { [ID]: d }, evenements: ev('duel_maj', LEA, t) }, t);
  const b = await w.minute();
  // Le duel lu (1), les scores écrits (1), l'événement retiré (1).
  assert.ok(b.requetes - b0.requetes <= 4, 'requêtes du duel : ' + (b.requetes - b0.requetes));
  assert.deepEqual(w.F.lire('duels/' + ID + '/scores'), { createur: 1, invite: 0 });
  const job = travaux(w.M).find((x) => x.nom === 'duels');
  assert.ok(job && job.push && job.cout >= 8, 'travail « duels » déclaré avec son coût');
});

// ══ LA REVANCHE (lot B, 29/09/2026) : un duel né « accepte » entre amis ══
const revanche = (x) => duel(Object.assign({ statut: 'accepte', createurPseudo: 'lea', invitePseudo: 'tom__fit' }, x));
const amisDeTom = { pseudos: { lea: LEA, tom__fit: TOM }, amis: { [TOM]: { lea: { le: 1, prenom: 'Léa' } } },
  profils_publics: { tom__fit: { prenom: 'Tom' } } };

test('revanche : le Worker rattache l’invité, le prévient une fois, et le duel suit le cycle habituel', async () => {
  const t = PARIS('2026-09-29T12:00:00');
  const w = monde(Object.assign({ push: pushs, duels: { [ID]: revanche() }, evenements: ev('duel_cree', LEA, t) }, amisDeTom), t);
  await w.minute();
  const x = w.F.lire('duels/' + ID);
  assert.equal(x.invite, TOM);
  assert.equal(x.inviteNom, 'Tom');
  assert.equal(x.statut, 'accepte');
  assert.equal(x.rejointLe, t);
  assert.deepEqual(w.F.lire('duels_actifs/' + ID), { fin: 0, depuis: t });
  assert.equal(w.F.lire('duels_recus/' + TOM + '/' + ID + '/de'), 'Léa');
  assert.deepEqual(titres(w), ['Léa te défie en revanche ⚡']);
  // Rejoué : rien de plus (l'invité est déjà rattaché).
  w.F.ecrire('evenements', ev('duel_cree', LEA, t)); w.avance(60e3);
  await w.minute();
  assert.equal(w.F.recus.length, 1);
  // La première séance de l'invité lance le compte, comme un duel relevé par lien.
  w.F.ecrire('evenements', ev('duel_maj', TOM, w.t)); w.avance(60e3);
  await w.minute();
  const y = w.F.lire('duels/' + ID);
  assert.equal(y.statut, 'en_cours');
  assert.equal(y.fin, y.debut + 14 * J);
  assert.deepEqual(y.scores, { createur: 0, invite: 0 });
  // La clôture : le gagnant et le CHAMPION.
  w.F.ecrire('duels/' + ID + '/progres/' + LEA, { valeur: 2, maj: w.t });
  w.F.ecrire('duels/' + ID + '/progres/' + TOM, { valeur: 5, maj: w.t });
  w.avance(15 * J);
  w.F.ecrire('evenements', ev('duel_maj', LEA, w.t));
  await w.minute();
  assert.equal(w.F.lire('duels/' + ID + '/statut'), 'termine');
  assert.equal(w.F.lire('duels/' + ID + '/gagnant'), 'invite');
  assert.equal(w.F.lire('defis_resultats/' + TOM + '/' + ID + '/champion'), true);
});

test('revanche : sans suivi de l’invité, le duel est annulé et personne n’est prévenu', async () => {
  const t = PARIS('2026-09-29T12:00:00');
  const w = monde({ push: pushs, pseudos: { lea: LEA, tom__fit: TOM }, amis: {}, duels: { [ID]: revanche() },
    evenements: ev('duel_cree', LEA, t) }, t);
  await w.minute();
  assert.equal(w.F.lire('duels/' + ID + '/statut'), 'annule');
  assert.equal(w.F.lire('duels/' + ID + '/invite'), null);
  assert.equal(w.F.lire('duels_recus/' + TOM), null);
  assert.equal(w.F.recus.length, 0);
  // Seul le créateur peut déclencher le rattachement.
  const w2 = monde(Object.assign({ push: pushs, duels: { [ID]: revanche() }, evenements: ev('duel_cree', TOM, t) }, amisDeTom), t);
  await w2.minute();
  assert.equal(w2.F.lire('duels/' + ID + '/invite'), null);
});

test('revanche : jamais commencée, elle s’annule après 30 jours comme les autres', async () => {
  const t = PARIS('2026-10-07T18:40:00');
  const d = revanche({ invite: TOM, inviteNom: 'Tom', rejointLe: t - 31 * J });
  const w = monde({ push: pushs, duels: { [ID]: d }, duels_actifs: { [ID]: { fin: 0 } } }, t);
  for (let i = 0; i < 6; i++) { const b = await w.minute(); if (b.travaux.duels === 'fini') break; w.avance(60e3); }
  assert.equal(w.F.lire('duels/' + ID + '/statut'), 'annule');
});

// ══ LA PRIORITÉ DES PUSH (01/10/2026) : le duel passe en second push du jour ══
test('(c) un duel clôturé alors qu’un push est déjà parti : le résultat part quand même (2e du jour, priorité 90)', async () => {
  const t = PARIS('2026-10-20T18:40:00');
  const d = duel({ invite: TOM, inviteNom: 'Tom', statut: 'en_cours', debut: t - 15 * J, fin: t - 3600e3,
    progres: { [LEA]: { valeur: 4, maj: t }, [TOM]: { valeur: 2, maj: t } } });
  // Un défi est parti à 9 h chez l'un comme chez l'autre : le plafond d'un par
  // jour aurait jeté le résultat.
  const matin = { jour: '2026-10-20', n: 1, at: PARIS('2026-10-20T09:00:00'), type: 'defi', prio: 70 };
  const w = monde({ push: pushs, duels: { [ID]: d }, duels_actifs: { [ID]: { fin: d.fin } },
    push_log: { [LEA]: matin, [TOM]: matin } }, t);
  for (let i = 0; i < 6; i++) { const b = await w.minute(); if (b.travaux.duels === 'fini') break; w.avance(60e3); }
  assert.equal(w.F.lire('duels/' + ID + '/statut'), 'termine');
  assert.deepEqual(titres(w).sort(), ['Léa remporte le duel', 'Tu as gagné ton duel ⚡']);
  for (const k of [LEA, TOM]) {
    const l = w.F.lire('push_log/' + k);
    assert.equal(l.n, 2); assert.equal(l.prio, 90); assert.equal(l.type, 'defi', 'le type ne change pas');
  }
});

test('(d) le J-2 refusé en heures calmes : duels/<id>/rappel reste absent, et il repart le lendemain', async () => {
  const t = PARIS('2026-10-07T18:40:00'), debut = t - 11.5 * J;   // fin dans deux jours et demi
  const d = duel({ invite: TOM, inviteNom: 'Tom', statut: 'en_cours', debut, fin: debut + 14 * J,
    progres: { [LEA]: { valeur: 3, maj: t }, [TOM]: { valeur: 2, maj: t } } });
  // Les deux vivent à Tokyo : 18 h 40 à Paris, 1 h 40 chez eux.
  const w = monde({ push: pushs, users: { [LEA]: { tz: 'Asia/Tokyo' }, [TOM]: { tz: 'Asia/Tokyo' } },
    duels: { [ID]: d }, duels_actifs: { [ID]: { fin: d.fin } } }, t);
  for (let i = 0; i < 6; i++) { const b = await w.minute(); if (b.travaux.duels === 'fini') break; w.avance(60e3); }
  assert.equal(w.F.recus.length, 0, 'rien en pleine nuit');
  assert.equal(w.F.lire('duels/' + ID + '/rappel'), null, 'le rappel n’est pas consommé');
  assert.equal(w.F.lire('duels/' + ID + '/rappelPour'), null);
  // Tokyo déménage à Paris : le travail du lendemain le fait partir, une fois.
  w.F.ecrire('users/' + LEA + '/tz', 'Europe/Paris'); w.F.ecrire('users/' + TOM + '/tz', 'Europe/Paris');
  w.avance(J);
  assert.equal(await w.M.duelQuotidienUn(ID, w.t), 'rappel');
  assert.equal(w.F.lire('duels/' + ID + '/rappel'), true);
  await w.minute();                                // les sous-tâches (hors réveil, le budget est à zéro)
  assert.deepEqual(titres(w).sort(), ['Plus que 2 jours contre Léa', 'Plus que 2 jours contre Tom']);
  // Dans les 12 dernières heures, un refus n'est plus retenté : le rappel est posé.
  const w2 = monde({ push: pushs, users: { [LEA]: { tz: 'Asia/Tokyo' }, [TOM]: { tz: 'Asia/Tokyo' } },
    duels: { [ID]: Object.assign({}, d, { fin: t + 10 * 3600e3 }) }, duels_actifs: { [ID]: { fin: t + 10 * 3600e3 } } }, t);
  assert.equal(await w2.M.duelQuotidienUn(ID, t), 'rappel_a_reprendre');
  assert.equal(w2.F.lire('duels/' + ID + '/rappel'), true);
});

// ══ LES SCORES CALCULÉS PAR LE WORKER (01/10/2026) ═══════════════════════
// L'app n'écrit plus duels/<id>/progres : les règles le refusent au client, et
// le Worker l'écrit depuis xp_etat après chaque séance.
const seance = (date, n, kg) => ({ date, duration: 40, sets: n, setsPlanned: n, tz: -120,
  data: { Squat: { sets: Array.from({ length: n }, () => ({ weight: String(kg), reps: '5', done: true })) } } });

test('un client qui écrit 999 est refusé par les règles ; le score suit les séances, calculé par le Worker', async () => {
  // 1. Les règles : plus aucune écriture client sur duels/$id/progres/$k.
  const regles = JSON.parse(fs.readFileSync(new URL('../../database.rules.json', import.meta.url), 'utf8')
    .replace(/^\s*\/\/.*$/gm, ''));
  const progres = regles.rules.duels.$id.progres.$k;
  assert.equal(progres['.write'], undefined, 'progres/$k : écrit par le Worker seul');
  assert.equal(regles.rules.saisons_progres.$id.$k['.write'], undefined, 'saisons_progres : idem');
  const parts = regles.rules.canaux.$coachKey.defis.$msgId.participants.$athleteKey;
  assert.equal(parts.valeur['.write'], undefined); assert.equal(parts.metrique['.write'], undefined);
  // 2. Le Worker : la progression vient des séances, pas de ce qu'a écrit le client.
  const t = PARIS('2026-10-07T12:00:00');
  const d = duel({ invite: TOM, inviteNom: 'Tom', statut: 'en_cours', debut: t - 2 * J, fin: t + 12 * J,
    progres: { [TOM]: { valeur: 999, maj: t - J } } });         // écrit avant la fermeture des règles
  const w = monde({ duels: { [ID]: d }, duels_actifs: { [ID]: { fin: d.fin } },
    duels_joueur: { [LEA]: { [ID]: true }, [TOM]: { [ID]: true } },
    users: { [LEA]: { sessions: [seance(t - 3 * J, 4, 80), seance(t - J, 4, 80), seance(t - 3600e3, 0, 80)] },
      [TOM]: { sessions: [seance(t - 2 * 3600e3, 5, 90)] } } }, t);
  const fin = async (par) => {
    w.F.ecrire('evenements/e' + (1000000000 + ne++).toString(36), { type: 'seance_fin', par, at: w.t, cible: '-' });
    for (let i = 0; i < 8 && w.F.lire('evenements'); i++) { await w.minute(); w.avance(60e3); }
    assert.equal(w.F.lire('evenements'), null, 'la file s’est vidée');
  };
  await fin(LEA);
  // Léa : la séance d'avant le début ne compte pas, celle à 0 série non plus.
  assert.deepEqual(w.F.lire('duels/' + ID + '/progres/' + LEA), { valeur: 1, maj: w.F.lire('duels/' + ID + '/progres/' + LEA).maj, srv: true });
  await fin(TOM);
  assert.equal(w.F.lire('duels/' + ID + '/progres/' + TOM).valeur, 1, 'les 999 du client sont remplacés par la valeur des séances');
  assert.deepEqual(w.F.lire('duels/' + ID + '/scores'), { createur: 1, invite: 1 });
  // Une séance de plus pour Léa : le score suit.
  w.F.ecrire('users/' + LEA + '/sessions/3', seance(w.t, 6, 85));
  await fin(LEA);
  assert.deepEqual(w.F.lire('duels/' + ID + '/scores'), { createur: 2, invite: 1 });
  // Le duel clos, l'index du joueur est oublié.
  w.avance(13 * J);
  await w.M.duelQuotidienUn(ID, w.t);
  assert.equal(w.F.lire('duels/' + ID + '/statut'), 'termine');
  assert.equal(w.F.lire('duels/' + ID + '/gagnant'), 'createur');
  assert.equal(w.F.lire('duels_joueur/' + LEA), null);
});

test('le démarrage : la séance qui lance le duel compte, quel que soit l’ordre des événements', async () => {
  const t = PARIS('2026-10-07T12:00:00');
  const d = duel({ invite: TOM, inviteNom: 'Tom', statut: 'accepte', rejointLe: t - 3600e3 });
  const w = monde({ push: pushs, duels: { [ID]: d }, duels_actifs: { [ID]: { fin: 0 } },
    users: { [TOM]: { sessions: [seance(t - 10 * 60e3, 5, 90)] } } }, t);
  // La séance est recalculée AVANT l'événement du duel.
  w.F.ecrire('evenements/e' + (1000000000 + ne++).toString(36), { type: 'seance_fin', par: TOM, at: t, cible: '-' });
  w.F.ecrire('evenements/e' + (1000000000 + ne++).toString(36), { type: 'duel_maj', par: TOM, cible: ID, at: t });
  for (let i = 0; i < 8 && w.F.lire('evenements'); i++) { await w.minute(); w.avance(60e3); }
  assert.equal(w.F.lire('duels/' + ID + '/statut'), 'en_cours');
  assert.equal(w.F.lire('duels/' + ID + '/progres/' + TOM).valeur, 1, 'la séance de démarrage est comptée');
  assert.equal(w.F.lire('duels_joueur/' + TOM + '/' + ID), true);
});

test('saison, défi du Canal et trois duels : 4 écritures au plus par recalcul, la suite en sous-tâche ; le classement du défi suit', async () => {
  const t = PARIS('2026-10-07T12:00:00');
  const KEV = 'kev@t,fr';
  const ids = ['daaa000000001', 'dbbb000000002', 'dccc000000003'];
  const duels = {}, actifs = {}, index = {};
  for (const id of ids) {
    duels[id] = duel({ invite: TOM, inviteNom: 'Tom', statut: 'en_cours', debut: t - 2 * J, fin: t + 12 * J });
    actifs[id] = { fin: t + 12 * J }; index[id] = true;
  }
  const w = monde({ duels, duels_actifs: actifs, duels_joueur: { [LEA]: index },
    saisons: { 'hiver-2026': { nom: 'Hiver', debut: t - 5 * J, fin: t + 20 * J, mesure: 'tonnage', objectifPerso: 5000 } },
    canaux: { [KEV]: { messages: { m1: { type: 'defi', titre: 'Octobre', mesure: 'serie', objectif: 2, collectif: false, debut: t - 5 * J, fin: t + 20 * J } },
      defis: { m1: { participants: { [LEA]: { inscription: { le: 1, prenom: 'Léa', classement: true } } } } } } },
    users: { [LEA]: { coachEmailKey: KEV, sessions_config: [{ active: true }, { active: true }],
      sessions: [seance(t - J, 4, 80), seance(t - 3600e3, 3, 100)] } } }, t);
  w.F.ecrire('evenements/e' + (1000000000 + ne++).toString(36), { type: 'seance_fin', par: LEA, at: t, cible: '-' });
  await w.minute();
  const ecrits = () => ids.filter((id) => w.F.lire('duels/' + id + '/progres/' + LEA)).length
    + (w.F.lire('saisons_progres/hiver-2026/' + LEA) ? 1 : 0) + (w.F.lire('canaux/' + KEV + '/defis/m1/participants/' + LEA + '/valeur') != null ? 1 : 0);
  assert.equal(ecrits(), 4, 'quatre écritures dans le recalcul');
  assert.ok(Object.values(w.F.lire('evenements') || {}).some((e) => e.quoi === 'progres'), 'la cinquième en sous-tâche');
  for (let i = 0; i < 6 && w.F.lire('evenements'); i++) { w.avance(60e3); await w.minute(); }
  assert.equal(ecrits(), 5);
  // Tonnage : 4×80×5 + 3×100×5 = 3 100 kg ; série : deux séances la même semaine (quota 2) = 1.
  assert.equal(w.F.lire('saisons_progres/hiver-2026/' + LEA).valeur, 3100);
  const p = w.F.lire('canaux/' + KEV + '/defis/m1/participants/' + LEA);
  assert.equal(p.valeur, 1); assert.equal(p.metrique, 1); assert.equal(p.srv, true);
  assert.equal(w.F.lire('canaux/' + KEV + '/defis/m1/public/n'), 1, 'le classement est recalculé (sous-tâche defi_maj)');
});

// ── LES BATTLES STREET (build 1956) ─────────────────────────────────────────
test('battle street : textes, sens du chrono, score absent qui perd, mesure reconnue', () => {
  assert.equal(DU.formatStreet('street_the100'), 'the100');
  assert.equal(DU.formatStreet('street_inconnu'), null);
  assert.equal(DU.mesureValide('street_onTheBar'), true);
  assert.equal(DU.mesureValide('street_'), false);
  assert.equal(DU.texteDuel('street_the100', 7), 'Battle The 100 sur 7 jours');
  assert.equal(DU.texteScore('street_the100', 754), '12:34');
  assert.equal(DU.texteScore('street_the100', 0), 'pas de score');
  assert.equal(DU.texteScore('street_onTheBar', 23), '23 rép.');
  // Au chrono, le plus petit temps gagne ; aucun score posé perd.
  assert.equal(DU.gagnantDe({ createur: 600, invite: 540 }, 'street_the100'), 'invite');
  assert.equal(DU.gagnantDe({ createur: 600, invite: 0 }, 'street_the100'), 'createur');
  assert.equal(DU.gagnantDe({ createur: 0, invite: 0 }, 'street_the100'), 'egalite');
  // Aux répétitions, le plus grand.
  assert.equal(DU.gagnantDe({ createur: 20, invite: 25 }, 'street_onTheBar'), 'invite');
  // Les scores viennent de street/<clé>, bornés ; la progression est ignorée.
  assert.deepEqual(DU.scoresDe({ createur: LEA, invite: TOM, mesure: 'street_the100',
    street: { [LEA]: { score: 612 }, [TOM]: { score: 1e9 } }, progres: { [LEA]: { valeur: 3 } } }), { createur: 612, invite: 0 });
});

test('battle street : il démarre dès que l’invité rejoint, les scores suivent, le chrono le plus court est CHAMPION', async () => {
  const t = PARIS('2026-10-05T12:00:00');
  const w = monde({ push: pushs, duels: { [ID]: duel({ invite: TOM, inviteNom: 'Tom', mesure: 'street_the100', duree: 7 }) },
    evenements: ev('duel_rejoint', TOM, t) }, t);
  await w.minute();
  let x = w.F.lire('duels/' + ID);
  assert.equal(x.statut, 'en_cours', 'pas d’attente de séance');
  assert.equal(x.debut, t); assert.equal(x.fin, t + 7 * J);
  assert.deepEqual(w.F.lire('duels_actifs/' + ID), { fin: x.fin });
  // Chacun pose son meilleur temps ; l'événement fait suivre les scores.
  w.F.ecrire('duels/' + ID + '/street/' + LEA, { score: 700, certifie: false, at: t });
  w.F.ecrire('duels/' + ID + '/street/' + TOM, { score: 655, certifie: true, at: t });
  w.F.ecrire('evenements', ev('duel_maj', LEA, t)); w.avance(60e3);
  await w.minute();
  assert.deepEqual(w.F.lire('duels/' + ID + '/scores'), { createur: 700, invite: 655 });
  w.avance(8 * J);
  w.F.ecrire('evenements', ev('duel_maj', LEA, w.t));
  await w.minute();
  x = w.F.lire('duels/' + ID);
  assert.equal(x.statut, 'termine');
  assert.equal(x.gagnant, 'invite');
  assert.equal(w.F.lire('defis_resultats/' + TOM + '/' + ID).champion, true);
  assert.equal(w.F.lire('defis_resultats/' + TOM + '/' + ID).mesure, 'street_the100');
});

test('battle street : les formats et leur scoring sont ceux de l’app (src/core/061), et ceux des règles', () => {
  const src = fs.readFileSync(new URL('../../src/core/061-les-defis-street.js', import.meta.url), 'utf8');
  const app = {};
  for (const m of src.matchAll(/^  (\w+):_format\(\{cle:'(\w+)',nom:'([^']+)',scoring:'(temps|reps)'/mg)) { assert.equal(m[1], m[2]); app[m[2]] = [m[4], m[3]]; }
  assert.deepEqual(Object.keys(app), Object.keys(DU.STREET_FORMATS));
  for (const k of Object.keys(app)) { assert.equal(app[k][0], DU.STREET_FORMATS[k], k); assert.equal(app[k][1], DU.STREET_NOMS[k], k); }
  const regles = fs.readFileSync(new URL('../../database.rules.json', import.meta.url), 'utf8');
  const liste = Object.keys(app).join('|');
  assert.equal(regles.split('street_(' + liste + ')').length - 1, 2, 'duels et duels_publics');
  assert.equal(regles.split('(' + liste + ')$/').length - 1, 3, 'records, essais et classement');
  assert.equal(DU.STREET_RE.source, '^street_(' + liste + ')$');
});
