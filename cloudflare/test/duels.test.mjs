// Les duels, de bout en bout, sur la fausse base : l'arrivée de l'invité, le
// démarrage à sa première séance, les scores, J-2, la clôture et le CHAMPION.
//   node --test cloudflare/test/duels.test.mjs
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
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
