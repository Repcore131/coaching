// Le serveur léger de bout en bout, sur une base en mémoire (API REST) et un
// faux service de push qui déchiffre ce qu'il reçoit.
//   node cloudflare/test/metier.test.mjs
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { creerBase } from '../src/base.js';
import { creerMetier, paris, serieDuJour } from '../src/metier.js';
import { minute, BUDGET } from '../src/planif.js';
import { fausseBase, appareil } from './fausse-base.mjs';

const vp = crypto.createECDH('prime256v1'); vp.generateKeys();
const VAPID = { publique: vp.getPublicKey().toString('base64url'), privee: vp.getPrivateKey().toString('base64url') };
// Heures de Paris fixées (septembre : UTC+2).
const PARIS = (iso) => Date.parse(iso + '+02:00');
let ok = 0;
const test = async (nom, fn) => { await fn(); ok++; console.log('ok  ', nom); };

function monde(initial, t) {
  const F = fausseBase(initial);
  let n = 0;
  const fetchCompte = (u, i) => { n++; return F.fetchImpl(u, i); };
  const db = creerBase({ url: 'https://base.test', auth: 's', fetchImpl: fetchCompte });
  let horloge = t;
  const M = creerMetier({ db, vapid: VAPID, fetchImpl: fetchCompte, maintenant: () => horloge });
  M.coachsEtUsers = () => db.ref('users').shallow();
  return { F, db, M, compteur: () => n, remise: () => { n = 0; }, avance: (ms) => { horloge += ms; }, get t() { return horloge; },
    minute: () => { n = 0; return minute({ db, M, compteur: () => n, maintenant: () => horloge }); } };
}
const A1 = 'lea@t,fr', C1 = 'kevin@t,fr';
const tel = appareil('https://push.test/lea1');

await test('réponse du coach : le push part, chiffré, avec le bon texte', async () => {
  const w = monde({ users: { [A1]: { coachEmailKey: C1, fname: 'Léa', bilans: [{ date: 1, reponseCoach: 'Belle régularité, on garde le cap.' }] } },
    push: { [A1]: { a1b2c3: tel.abonnement } },
    evenements: { e1: { type: 'reponse_bilan', par: C1, dest: A1, i: '0', at: 1 } } }, PARIS('2026-09-28T12:00:00'));
  const b = await w.minute();
  assert.equal(b.evenements, 1);
  assert.equal(w.F.recus.length, 1);
  const m = tel.lire(w.F.recus[0].init.body);
  assert.equal(m.title, 'Ton coach a répondu à ton bilan');
  assert.match(m.body, /Belle régularité/);
  assert.equal(w.F.lire('evenements'), null, 'l’événement est consommé');
  assert.equal(w.F.lire('push_log/' + A1).jour, '2026-09-28');
});

await test('réponse VOCALE seule : relue en base, le même push, qui dit sa durée', async () => {
  const w = monde({ users: { [A1]: { coachEmailKey: C1, fname: 'Léa', bilans: [{ date: 1, reponseAudio: { url: 'https://res.cloudinary.com/x/a.webm', duree: 83, at: 2 } }] } },
    push: { [A1]: { a1b2c3: tel.abonnement } },
    evenements: { e1: { type: 'reponse_bilan', par: C1, dest: A1, i: '0', at: 1 } } }, PARIS('2026-09-28T12:00:00'));
  await w.minute();
  assert.equal(w.F.recus.length, 1);
  const m = tel.lire(w.F.recus[0].init.body);
  assert.equal(m.title, 'Ton coach a répondu à ton bilan');
  assert.equal(m.body, 'Une réponse vocale (1:23) t’attend dans l’app.');
  // Sans texte ni voix : rien ne part.
  const w2 = monde({ users: { [A1]: { coachEmailKey: C1, bilans: [{ date: 1, reponseAudio: {} }] } }, push: { [A1]: { a1b2c3: tel.abonnement } },
    evenements: { e1: { type: 'reponse_bilan', par: C1, dest: A1, i: '0', at: 1 } } }, PARIS('2026-09-28T12:00:00'));
  await w2.minute();
  assert.equal(w2.F.recus.length, 0);
});

await test('un événement déposé par quelqu’un qui n’est pas le coach n’envoie rien', async () => {
  const w = monde({ users: { [A1]: { coachEmailKey: C1, bilans: [{ reponseCoach: 'x' }] } }, push: { [A1]: { a1b2c3: tel.abonnement } },
    evenements: { e1: { type: 'reponse_bilan', par: 'autre@t,fr', dest: A1, i: '0', at: 1 } } }, PARIS('2026-09-28T12:00:00'));
  await w.minute();
  assert.equal(w.F.recus.length, 0);
  assert.equal(w.F.lire('evenements'), null);
});

await test('un push par jour au plus, et rien de parti ne compte pas', async () => {
  const w = monde({ users: { [A1]: {} }, push: { [A1]: { a1b2c3: tel.abonnement } } }, PARIS('2026-09-28T12:00:00'));
  const r1 = await w.M.envoyerPush(A1, { type: 'coach', title: 'a' });
  const r2 = await w.M.envoyerPush(A1, { type: 'coach', title: 'b' });
  assert.equal(r1.envoye, 1); assert.equal(r2.raison, 'plafond');
  const w2 = monde({ users: { [A1]: {} }, push: { [A1]: { a1b2c3: tel.abonnement } } }, PARIS('2026-09-28T12:00:00'));
  w2.F.pushStatut = 500;
  assert.equal((await w2.M.envoyerPush(A1, { type: 'coach', title: 'a' })).envoye, 0);
  assert.equal(w2.F.lire('push_log/' + A1), null, 'la place du jour est rendue');
});

await test('un abonnement mort (410) est supprimé', async () => {
  const w = monde({ users: { [A1]: {} }, push: { [A1]: { a1b2c3: tel.abonnement } } }, PARIS('2026-09-28T12:00:00'));
  w.F.pushStatut = 410;
  await w.M.envoyerPush(A1, { type: 'coach', title: 'a' });
  assert.equal(w.F.lire('push/' + A1), null);
});

await test('la nuit, le message attend 8 h 05, puis part', async () => {
  const w = monde({ users: { [A1]: { coachEmailKey: C1, bilans: [{ reponseCoach: 'Bravo' }] } }, push: { [A1]: { a1b2c3: tel.abonnement } },
    evenements: { e1: { type: 'reponse_bilan', par: C1, dest: A1, i: '0', at: 1 } } }, PARIS('2026-09-28T23:30:00'));
  await w.minute();
  assert.equal(w.F.recus.length, 0);
  assert.ok(w.F.lire('push_attente/' + A1));
  w.avance(8 * 3600e3 + 40 * 60e3);            // 8 h 10 le lendemain
  await w.minute();
  // Passé en sous-tâche dans la même écriture qui le retire de push_attente…
  assert.equal(w.F.lire('push_attente/' + A1), null);
  assert.equal(Object.values(w.F.lire('evenements')).filter((e) => e.type === 'tache' && e.uid === A1).length, 1);
  // … et parti au réveil suivant.
  w.avance(60e3);
  await w.minute();
  assert.equal(w.F.recus.length, 1);
  assert.equal(w.F.lire('evenements'), null);
});

await test('jeudi 18 h : la série en danger, par lots, reprise d’une minute à l’autre', async () => {
  const users = {}, push = {}, tels = {};
  for (let i = 0; i < 9; i++) {
    const k = 'a' + i + '@t,fr';
    users[k] = { streak: 3, streakWeek: '2026-09-21', lastSession: PARIS('2026-09-26T10:00:00'), fname: 'A' + i };
    tels[k] = appareil('https://push.test/' + i);
    push[k] = { a1b2c3: tels[k].abonnement };
  }
  users['a0@t,fr'].streakWeek = '2026-09-28';     // semaine déjà validée : rien
  // Un jeudi 1er : le Wrapped du mois est marqué fait, on ne mesure que la série.
  const w = monde({ users, push, worker: { jobs: { wrapped: { jour: '2026-10-01', fini: true } } } }, PARIS('2026-10-01T18:01:00'));
  assert.equal(paris(w.t).joursem, 4);
  let tours = 0;
  while (tours++ < 20) {
    const b = await w.minute();
    assert.ok(b.requetes <= 50, 'jamais plus de 50 requêtes : ' + b.requetes);
    if (b.travaux.serie === 'fini') break;
  }
  assert.ok(tours > 1, 'le travail s’est bien étalé sur plusieurs minutes');
  assert.equal(w.F.recus.length, 8);
  const m = tels['a3@t,fr'].lire(w.F.recus.find((r) => r.endpoint.endsWith('/3')).init.body);
  assert.match(m.title, /Ta série de 3 semaines est en danger/);
  // Et le lendemain rien ne repart : le travail est fini pour ce jeudi-là.
  const avant = w.F.recus.length;
  await w.minute();
  assert.equal(w.F.recus.length, avant);
});

// ── La série du jeudi, recalculée à la date du jour ──────────────────────
const JEUDI = PARIS('2026-10-01T18:01:00');          // semaine du lundi 28/09
const J = 864e5;
const trois = [{ active: true }, { active: true }, { active: true }, { active: false }];   // écart normal : 4 jours
await test('série : la règle de l’app — vivante, périmée, sauvée par un joker, ancienne, gelée', () => {
  const u = (o) => Object.assign({ streak: 6, streakWeek: '2026-09-21', sessions_config: trois }, o);
  // 3 créneaux : périmée au-delà de 4 + 7 = 11 jours d'absence.
  assert.equal(serieDuJour(u({ lastSession: JEUDI - 11 * J }), JEUDI).etat, 'vivante');
  assert.equal(serieDuJour(u({ lastSession: JEUDI - 12 * J }), JEUDI).etat, 'cassee');
  // Un seul créneau : écart 8, périmée au-delà de 15 jours — mais plus de 14 : ancienne.
  assert.equal(serieDuJour(u({ lastSession: JEUDI - 13 * J, sessions_config: [{ active: true }] }), JEUDI).etat, 'vivante');
  assert.equal(serieDuJour(u({ lastSession: JEUDI - 15 * J, sessions_config: [{ active: true }] }), JEUDI).etat, 'ancienne');
  // Un joker couvre la semaine du 21/09 manquée (streakWeek du 14/09).
  const perimee = u({ lastSession: JEUDI - 12 * J, streakWeek: '2026-09-14' });
  assert.equal(serieDuJour(perimee, JEUDI).etat, 'cassee');
  assert.equal(serieDuJour(Object.assign({}, perimee, { streakJokers: 1 }), JEUDI).etat, 'sauvee');
  assert.equal(serieDuJour(Object.assign({}, perimee, { streakWeek: '2026-09-07', streakJokers: 1 }), JEUDI).etat, 'cassee', 'deux semaines manquées, un joker');
  // Le décompte repart d'une suspension levée, ou du joker.
  assert.equal(serieDuJour(u({ lastSession: JEUDI - 13 * J, suspension: { actif: false, fin: JEUDI - 3 * J } }), JEUDI).etat, 'vivante');
  assert.equal(serieDuJour(u({ lastSession: JEUDI - 13 * J, streakJokerLe: JEUDI - 2 * J }), JEUDI).etat, 'vivante');
  assert.equal(serieDuJour(u({ lastSession: JEUDI - 30 * J, suspension: { actif: true } }), JEUDI).etat, 'gel');
  assert.equal(serieDuJour(u({ streak: 0, lastSession: JEUDI }), JEUDI).etat, 'aucune');
});
await test('jeudi 18 h : rien pour une série cassée ou une dernière séance de plus de 14 jours ; le bon chiffre sinon', async () => {
  const users = {
    'vivante@t,fr': { streak: 5, streakWeek: '2026-09-21', lastSession: JEUDI - 3 * J, sessions_config: trois, fname: 'Vi' },
    'cassee@t,fr': { streak: 9, streakWeek: '2026-09-14', lastSession: JEUDI - 12 * J, sessions_config: trois },
    'ancienne@t,fr': { streak: 4, streakWeek: '2026-09-21', lastSession: JEUDI - 15 * J, sessions_config: [{ active: true }] },
    'sauvee@t,fr': { streak: 7, streakWeek: '2026-09-14', lastSession: JEUDI - 12 * J, sessions_config: trois, streakJokers: 1 },
    'validee@t,fr': { streak: 2, streakWeek: '2026-09-28', lastSession: JEUDI - J, sessions_config: trois },
  };
  const tels = {}, push = {};
  for (const k of Object.keys(users)) { tels[k] = appareil('https://push.test/' + k); push[k] = { x: tels[k].abonnement }; }
  const w = monde({ users, push, worker: { jobs: { wrapped: { jour: '2026-10-01', fini: true } } } }, JEUDI);
  for (let i = 0; i < 10; i++) { const b = await w.minute(); if (b.travaux.serie === 'fini') break; }
  const recu = (k) => w.F.recus.filter((r) => r.endpoint === 'https://push.test/' + k).map((r) => tels[k].lire(r.init.body));
  assert.equal(recu('vivante@t,fr').length, 1);
  assert.match(recu('vivante@t,fr')[0].title, /Ta série de 5 semaines est en danger/);
  assert.equal(recu('sauvee@t,fr').length, 1, 'sauvée par un joker : elle est toujours là');
  assert.match(recu('sauvee@t,fr')[0].body, /joker/);
  assert.equal(recu('cassee@t,fr').length, 0, 'cassée : l’app affiche 0, on ne parle pas d’une série de 9');
  assert.equal(recu('ancienne@t,fr').length, 0, 'dernière séance de plus de 14 jours');
  assert.equal(recu('validee@t,fr').length, 0, 'semaine déjà validée');
});
await test('samedi 10 h : le rappel de bilan seulement avec un coach ET un premier bilan', async () => {
  const SAMEDI = PARIS('2026-10-03T10:01:00');
  const vieux = [{ date: SAMEDI - 20 * J }];
  const users = {
    'suivi@t,fr': { coachEmailKey: C1, bilans: vieux, fname: 'Su' },
    'recent@t,fr': { coachEmailKey: C1, bilans: [{ date: SAMEDI - 5 * J }] },
    'jamais@t,fr': { coachEmailKey: C1, fname: 'Ja' },
    'seul@t,fr': { bilans: vieux, fname: 'Se' },
    [C1]: { role: 'coach', coachEmailKey: 'x@t,fr', bilans: vieux },
  };
  const tels = {}, push = {};
  for (const k of Object.keys(users)) { tels[k] = appareil('https://push.test/' + k); push[k] = { x: tels[k].abonnement }; }
  const w = monde({ users, push }, SAMEDI);
  for (let i = 0; i < 10; i++) { const b = await w.minute(); if (b.travaux.bilan === 'fini') break; }
  const qui = w.F.recus.map((r) => r.endpoint.replace('https://push.test/', ''));
  assert.deepEqual(qui, ['suivi@t,fr']);
  assert.match(tels['suivi@t,fr'].lire(w.F.recus[0].init.body).title, /C’est l’heure de ton bilan/);
});

await test('parrainage : la demande est jugée, le filleul rattaché, le parrain prévenu', async () => {
  const P1 = 'parrain@t,fr', F1 = 'filleul@t,fr';
  const telP = appareil('https://push.test/p');
  const t = PARIS('2026-09-28T12:00:00');
  const w = monde({
    users: { [P1]: { fname: 'Kev' }, [F1]: { fname: 'Julie', createdAt: t - 864e5,
      sessions: [12, 8, 4, 1].map((k) => ({ date: t - k * 864e5, data: { Squat: { sets: [{ done: true }] } } })) } },
    push: { [P1]: { a1b2c3: telP.abonnement } },
    parrainage: { verifies: { [F1]: 1 }, codes: { KEVIN7X9: P1 }, demandes: { [F1]: { code: 'KEVIN7X9', le: t, appareil: 'abc123' } } },
    evenements: { e1: { type: 'parrainage_demande', par: F1, at: t } } }, t);
  await w.minute();
  assert.equal(w.F.lire('parrainage/demandes/' + F1 + '/etat'), 'accepte');
  assert.equal(w.F.lire('parrainage/liens/' + F1).parrain, P1);
  // L'inscription avec un code n'écrit rien dans droits/ : l'essai du filleul
  // vit dans son dossier (essaiOuvrir), et un nœud sans palier le fermerait.
  assert.equal(w.F.lire('droits'), null);
  const m = telP.lire(w.F.recus[0].init.body);
  assert.match(m.title, /Julie vient de s’inscrire avec ton code/);
  // Son premier paiement : 1 mois au parrain, une seule fois.
  const r = await w.M.parrainagePaiement(F1, 'test');
  assert.ok(r);
  assert.equal(w.F.lire('parrainage/comptes/' + P1 + '/moisGagnes'), 1);
  // Le mois offert au parrain sans accès s'écrit dans droits/ (source parrainage) : c'est ce que l'app lit d'abord.
  assert.equal(w.F.lire('droits/' + F1), null, 'rien chez le filleul');
  assert.equal(w.F.lire('droits/' + P1 + '/palier'), 'essentielle');
  assert.equal(w.F.lire('droits/' + P1 + '/source'), 'parrainage');
  assert.equal(await w.M.parrainagePaiement(F1, 'test'), null, 'idempotent');
});

// ══ 01/10/2026 — FILLEUL QUALIFIÉ, AU PAIEMENT, ET PLAFOND DU PARRAIN ══════
const qualifiees = (t) => [12, 8, 4, 1].map((k) => ({ date: t - k * 864e5, data: { Squat: { sets: [{ done: true }] } } }));
const CREA = 'guellec,coachingpro@gmail,com';
await test('au paiement : séances qualifiées seules → rien ; le webhook de premier paiement → le mois', async () => {
  const P1 = 'parrain@t,fr', F1 = 'filleul@t,fr', t = PARIS('2026-10-01T12:00:00');
  const w = monde({ users: { [P1]: { fname: 'Kev' }, [F1]: { fname: 'Julie', sessions: qualifiees(t) } },
    parrainage: { verifies: { [F1]: t - 864e5 }, liens: { [F1]: { parrain: P1, id: 'f1' } },
      comptes: { [P1]: { filleuls: { f1: { statut: 'inscrit', prenom: 'Julie' } } } } } }, t);
  assert.equal(await w.M.parrainageSeuil(F1, t), 'attente_paiement', 'qualifié, pas encore payé');
  assert.ok(!w.F.lire('parrainage/comptes/' + P1 + '/moisGagnes'));
  assert.equal(w.F.lire('droits/' + P1), null);
  const r = await w.M.parrainagePaiement(F1, 'webhook');
  assert.equal(r.credit, true);
  assert.equal(w.F.lire('parrainage/comptes/' + P1 + '/moisGagnes'), 1);
  assert.equal(w.F.lire('droits/' + P1 + '/palier'), 'essentielle');
});
await test('plafond : 6 mois déjà offerts sur 12 mois → pas de 7e ; journal parrainage_plafond écrit, créateur prévenu', async () => {
  const P1 = 'parrain@t,fr', F1 = 'filleul@t,fr', t = PARIS('2026-10-01T12:00:00');
  const telC = appareil('https://push.test/createur');
  const six = Object.fromEntries([1, 2, 3, 4, 5, 6].map((i) => ['g' + i, { statut: 'payant', creditE: true, creditLe: t - i * 30 * 864e5 }]));
  const w = monde({ users: { [P1]: { fname: 'Kev' }, [F1]: { fname: 'Julie', sessions: qualifiees(t) } },
    push: { [CREA]: { c0: telC.abonnement } },
    parrainage: { verifies: { [F1]: t - 864e5 }, liens: { [F1]: { parrain: P1, id: 'f1' } },
      comptes: { [P1]: { moisGagnes: 6, filleuls: Object.assign({ f1: { statut: 'inscrit', prenom: 'Julie' } }, six) } } } }, t);
  const r = await w.M.parrainagePaiement(F1, 'webhook');
  assert.equal(r.credit, false); assert.equal(r.plafond, true);
  assert.equal(w.F.lire('parrainage/comptes/' + P1 + '/moisGagnes'), 6, 'aucun mois de plus');
  assert.equal(w.F.lire('droits/' + P1), null, 'rien d’ouvert');
  assert.equal(w.F.lire('parrainage/credits/' + F1), null);
  const j = Object.values(w.F.lire('parrainage_plafond/' + P1) || {});
  assert.equal(j.length, 1); assert.equal(j[0].filleul, 'f1'); assert.equal(j[0].max, 6);
  const alerte = w.F.recus.find((x) => /createur/.test(x.endpoint));
  assert.ok(alerte, 'le créateur est prévenu');
  const m = telC.lire(alerte.init.body);
  assert.match(m.title, /plafond/i);
  assert.ok(!/@|,fr/.test(m.body), 'aucune adresse dans le message');
  // Rejoué (séances suivantes) : ni second journal, ni second push.
  const n = w.F.recus.length;
  assert.notEqual(await w.M.parrainageSeuil(F1, t + 864e5), 'credite');
  assert.equal(Object.keys(w.F.lire('parrainage_plafond/' + P1) || {}).length, 1);
  assert.equal(w.F.recus.length, n);
  // Des mois plus anciens que 12 mois glissants ne comptent plus : ici trois
  // des six sont dans l'année (320, 340, 360 jours), le 7e passe.
  const w2 = monde({ users: { [P1]: { fname: 'Kev' }, [F1]: { fname: 'Julie', sessions: qualifiees(t) } },
    parrainage: { verifies: { [F1]: 1 }, liens: { [F1]: { parrain: P1, id: 'f1' } },
      comptes: { [P1]: { filleuls: Object.assign({ f1: { statut: 'inscrit' } },
        Object.fromEntries([1, 2, 3, 4, 5, 6].map((i) => ['g' + i, { creditE: true, creditLe: t - (300 + i * 20) * 864e5 }]))) } } } }, t);
  const r2 = await w2.M.parrainagePaiement(F1, 'webhook');
  assert.equal(r2.plafond, false);
  assert.equal(r2.credit, true);
});
await test('première séance d’un filleul : son parrain est prévenu une fois, après relecture', async () => {
  const P1 = 'parrain@t,fr', F1 = 'julie@t,fr', t = PARIS('2026-09-28T12:00:00');
  const telP = appareil('https://push.test/p');
  const ev = (id) => ({ ['e00000000' + id]: { type: 'filleul_seance', par: F1, cible: '-', at: t } });
  const w = monde({ users: { [F1]: { fname: 'Julie' } }, push: { [P1]: { x: telP.abonnement } },
    parrainage: { liens: { [F1]: { parrain: P1, id: 'f1' } }, comptes: { [P1]: { filleuls: { f1: { statut: 'inscrit', date: t } } } } },
    evenements: ev(1) }, t);
  // Le dossier n'est pas encore là : l'événement repart en fin de file.
  const b1 = await w.minute();
  assert.equal(b1.echecs, 1);
  assert.equal(w.F.recus.length, 0);
  w.F.ecrire('users/' + F1 + '/lastSession', t);
  w.avance(60e3);
  await w.minute();
  assert.equal(w.F.recus.length, 1);
  const m = telP.lire(w.F.recus[0].init.body);
  assert.equal(m.title, 'Julie a fait sa première séance');
  assert.equal(m.type, 'filleul');
  assert.ok(w.F.lire('parrainage/comptes/' + P1 + '/filleuls/f1/premiereSeance') > 0);
  // Une deuxième fois (autre appareil, rejoué) : rien.
  w.F.ecrire('evenements', ev(2));
  w.avance(864e5);
  await w.minute();
  assert.equal(w.F.recus.length, 1);
  // Sans lien de parrainage : rien.
  const w2 = monde({ users: { 'x@t,fr': { lastSession: t } }, evenements: { e000000001: { type: 'filleul_seance', par: 'x@t,fr', cible: '-', at: t } } }, t);
  await w2.minute();
  assert.equal(w2.F.recus.length, 0);
  assert.equal(w2.F.lire('evenements'), null);
});

await test('parrainage : son propre code est refusé', async () => {
  const P1 = 'parrain@t,fr';
  const w = monde({ users: { [P1]: {} }, parrainage: { codes: { KEVIN7X9: P1 }, demandes: { [P1]: { code: 'KEVIN7X9', le: 1 } } },
    evenements: { e1: { type: 'parrainage_demande', par: P1, at: 1 } } }, PARIS('2026-09-28T12:00:00'));
  await w.minute();
  assert.equal(w.F.lire('parrainage/demandes/' + P1 + '/etat'), 'refuse');
  assert.equal(w.F.lire('parrainage/liens/' + P1), null);
});

await test('défi : les valeurs écrites par les athlètes font le résumé public, puis le podium', async () => {
  const t = PARIS('2026-09-28T12:00:00');
  const defi = { at: t - 5 * 864e5, type: 'defi', titre: '12 séances', mesure: 'seances', objectif: 12, collectif: false,
    debut: t - 5 * 864e5, fin: t + 864e5 };
  const w = monde({ canaux: { [C1]: { messages: { d1: defi }, defis: { d1: { participants: {
    [A1]: { inscription: { le: t, classement: true, prenom: 'Léa' }, valeur: 12, metrique: 12 },
    'tom@t,fr': { inscription: { le: t, classement: true, prenom: 'Tom' }, valeur: 5, metrique: 5 } } } } } },
    evenements: { e1: { type: 'defi_maj', par: A1, coach: C1, id: 'd1', at: t } } }, t);
  await w.minute();
  const pub = w.F.lire('canaux/' + C1 + '/defis/d1/public');
  assert.ok(pub && pub.maj, 'résumé public écrit');
  assert.equal(w.F.lire('canaux/' + C1 + '/defis/d1/participants/' + A1 + '/termine'), true);
  // Deux jours plus tard, 9 h : clôture, podium et résultat de Léa.
  w.avance(2 * 864e5 - 3 * 3600e3);
  let tours = 0; while (tours++ < 5) { const b = await w.minute(); if (b.travaux.defis === 'fini') break; }
  assert.equal(w.F.lire('canaux/' + C1 + '/defis/d1/etat/clos'), true);
  assert.equal(w.F.lire('defis_resultats/' + A1 + '/d1').champion, true);
  const sys = Object.values(w.F.lire('canaux/' + C1 + '/messages')).filter((m) => m.type === 'systeme');
  assert.ok(sys.length >= 1, 'le podium est publié dans le Canal');
});

await test('la nuit, 3 h 17 : la rareté des badges', async () => {
  const w = monde({ users: {
    'a@t,fr': { badges: { assidu1: { at: 5 } } }, 'b@t,fr': { badges: { assidu1: { at: 5 }, record: { at: 6 } } },
    'c@t,fr': { fname: 'C' }, 'coach@t,fr': { role: 'coach', badges: { assidu1: { at: 1 } } } } }, PARIS('2026-09-28T03:20:00'));
  let tours = 0; while (tours++ < 5) { const b = await w.minute(); if (b.travaux.stats_badges === 'fini') break; }
  const s = w.F.lire('stats/badges');
  assert.equal(s.total, 3);
  assert.equal(s.pct.assidu1, 66.7);
  assert.equal(s.pct.record, 33.3);
});

await test('l’arrivée par un lien compte un clic, et celui de l’ambassadeur actif', async () => {
  const w = monde({ ambassadeurs: { MAXFIT: { nom: 'Max', actif: true } } }, PARIS('2026-09-28T12:00:00'));
  await w.M.arrivee({ src: 'story', amb: 'MAXFIT' });
  assert.equal(w.F.lire('ambassadeurs/MAXFIT/stats/clics'), 1);
  const jour = w.F.lire('attribution/jours/2026-09-28');
  assert.ok(jour, 'compteur du jour');
});

await test('fin d’accès : 11 h, trois jours avant, une seule fois par échéance', async () => {
  const t0 = PARIS('2026-09-28T11:02:00');
  const w = monde({ users: { [A1]: { status: 'COACHING_SUIVI', accessExpiry: t0 + 2.5 * 864e5, fname: 'Léa' },
    'loin@t,fr': { status: 'COACHING_SUIVI', accessExpiry: t0 + 9 * 864e5 } },
    push: { [A1]: { a1b2c3: tel.abonnement }, 'loin@t,fr': { x: appareil('https://push.test/loin').abonnement } } }, t0);
  let tours = 0;
  while (tours++ < 10) { const b = await w.minute(); if (b.travaux.acces === 'fini') break; }
  const miens = w.F.recus.filter((r) => r.endpoint === 'https://push.test/lea1');
  assert.equal(miens.length, 1);
  assert.match(tel.lire(miens[0].init.body).title, /Ton accès se termine dans 3 jours/);
  assert.equal(w.F.recus.length, 1, 'l’échéance à 9 jours ne dit rien');
  // Le lendemain, même échéance : rien.
  w.avance(864e5);
  for (let i = 0; i < 10; i++) await w.minute();
  assert.equal(w.F.recus.filter((r) => r.endpoint === 'https://push.test/lea1').length, 1);
});

await test('l’événement « abonnement » va à PayPal (indexer), pas au métier', async () => {
  const w = monde({ evenements: { e1: { type: 'abonnement', par: A1, abo: 'I-ABC123', at: 1 } } }, PARIS('2026-09-28T12:00:00'));
  const vus = [];
  w.M.paypal = { indexer: async (c, a) => { vus.push([c, a]); }, finsCoachs: async () => {} };
  await w.minute();
  assert.deepEqual(vus, [[A1, 'I-ABC123']]);
  assert.equal(w.F.lire('evenements'), null);
});

console.log(ok + ' tests passés — budget par réveil : ' + BUDGET + ' requêtes');
