// Le serveur léger de bout en bout, sur une base en mémoire (API REST) et un
// faux service de push qui déchiffre ce qu'il reçoit.
//   node cloudflare/test/metier.test.mjs
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { creerBase } from '../src/base.js';
import { creerMetier, indicateurs, paris, serieDuJour, heureLocale, heuresCalmes, pushAutorise, fuseauValide } from '../src/metier.js';
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

// ══ LE FUSEAU DE L'ATHLÈTE (01/10/2026) ═══════════════════════════════════
await test('fuseau : Réunion à 19 h Paris = heures calmes ; Montréal à 14 h Paris = 8 h locales, envoi autorisé', async () => {
  const t19 = PARIS('2026-10-01T19:00:00'), t14 = PARIS('2026-10-01T14:00:00');
  assert.equal(heureLocale(t19, 'Indian/Reunion').heure, 21);
  assert.equal(heuresCalmes(t19, 'Indian/Reunion'), true);
  assert.equal(heuresCalmes(t19), false, 'à Paris, 19 h n’est pas calme');
  assert.equal(pushAutorise('coach', null, null, t19, 'Indian/Reunion').raison, 'calme');
  assert.equal(heureLocale(t14, 'America/Montreal').heure, 8);
  assert.deepEqual(pushAutorise('coach', null, null, t14, 'America/Montreal'), { ok: true, raison: null });
  assert.equal(pushAutorise('coach', null, null, PARIS('2026-10-01T13:59:00'), 'America/Montreal').raison, 'calme', '7 h 59 à Montréal');
  // Un fuseau mal formé, ou inconnu d'Intl : Paris.
  for (const x of ['Mars/Olympus', '../etc', 'europe/paris', '', null, 42, 'A'.repeat(70)]) assert.equal(fuseauValide(x), 'Europe/Paris', String(x));
  assert.equal(fuseauValide('America/Argentina/Salta'), 'America/Argentina/Salta');
});

await test('le changement d’heure du 25/10/2026 ne décale pas le jour du plafond', async () => {
  // 00 h 30 et 23 h 30 à Paris le 25 : le même jour, alors que l'écart à UTC passe de 2 h à 1 h.
  const matin = Date.parse('2026-10-24T22:30:00Z'), soir = Date.parse('2026-10-25T22:30:00Z');
  assert.equal(paris(matin).jour, '2026-10-25'); assert.equal(paris(matin).heure, 0);
  assert.equal(paris(soir).jour, '2026-10-25'); assert.equal(paris(soir).heure, 23);
  const log = { jour: paris(matin).jour };
  assert.equal(pushAutorise('coach', null, log, soir).raison, 'calme');
  assert.equal(pushAutorise('coach', null, log, Date.parse('2026-10-25T18:00:00Z')).raison, 'plafond', '19 h, même jour : plafond');
  assert.deepEqual(pushAutorise('coach', null, log, Date.parse('2026-10-26T08:00:00Z')), { ok: true, raison: null }, 'le lendemain : libre');
  // Bout à bout : un push le 25 au matin, un autre le 25 au soir (après le changement d'heure).
  const w = monde({ users: { [A1]: { tz: 'Europe/Paris' } }, push: { [A1]: { a1b2c3: tel.abonnement } } }, Date.parse('2026-10-25T07:30:00Z'));
  assert.equal((await w.M.envoyerPush(A1, { type: 'coach', title: 'a' })).envoye, 1);
  assert.equal(w.F.lire('push_log/' + A1 + '/jour'), '2026-10-25');
  w.avance(11 * 3600e3);                         // 19 h 30 à Paris, heure d'hiver
  assert.equal((await w.M.envoyerPush(A1, { type: 'coach', title: 'b' })).raison, 'plafond');
});

await test('fuseau, bout à bout : à la Réunion, le message du soir attend SON 8 h (6 h à Paris), pas celui de Paris', async () => {
  const B = 'reunion@t,fr', tel2 = appareil('https://push.test/reunion');
  const w = monde({ users: { [A1]: {}, [B]: { tz: 'Indian/Reunion' } }, push: { [A1]: { a1b2c3: tel.abonnement }, [B]: { x: tel2.abonnement } } },
    PARIS('2026-10-01T19:30:00'));
  // 19 h 30 à Paris : Léa reçoit, la Réunionnaise (21 h 30) attend.
  assert.equal((await w.M.envoyerPush(A1, { type: 'coach', title: 'a' })).envoye, 1);
  const r = await w.M.envoyerPush(B, { type: 'coach', title: 'b' });
  assert.equal(r.raison, 'calme');
  assert.equal(w.F.lire('push_attente/' + B + '/tz'), 'Indian/Reunion');
  // 6 h 05 à Paris = 8 h 05 à la Réunion : le travail horaire la libère.
  w.avance(10 * 3600e3 + 35 * 60e3);
  await w.minute(); await w.minute();
  assert.equal(w.F.recus.filter((x) => x.endpoint === tel2.abonnement.endpoint).length, 1);
  assert.equal(w.F.lire('push_attente/' + B), null);
});

await test('un rappel planifié (accès) à 19 h Paris pour la Réunion : déposé pour son matin, compté une fois, pas renvoyé le lendemain', async () => {
  const B = 'reunion@t,fr', t = PARIS('2026-10-01T19:00:00');
  const w = monde({ users: { [B]: { tz: 'Indian/Reunion', status: 'COACHING_SUIVI', accessExpiry: t + 2 * 864e5, fname: 'Zoé' } },
    push: { [B]: { x: appareil('https://push.test/r').abonnement } } }, t);
  await w.M.planifies.acces(B, t);
  assert.equal(w.F.recus.length, 0, 'rien à 21 h à la Réunion');
  assert.equal(w.F.lire('push_attente/' + B + '/message/type'), 'acces');
  assert.equal(w.F.lire('worker/relances_acces/' + B), t + 2 * 864e5, 'compté comme parti');
  await w.M.planifies.acces(B, t + 864e5);
  assert.equal(w.F.lire('push_attente/' + B + '/cumul'), 1, 'pas redéposé le lendemain');
});

// ══ LE QUOTA D'UN COACH, APPLIQUÉ (02/10/2026) ════════════════════════════
{
  const { readFileSync } = await import('node:fs');
  const QC = await import('../src/quota-coach.js');
  const CO = 'max@t,fr', AA = 'ana@t,fr', BB = 'bob@t,fr', CC = 'cyd@t,fr', DD = 'dan@t,fr';
  const t = PARIS('2026-10-15T06:31:00');
  const jr = { '2026-10-10': { n: 1 } };
  const droitsCode = { palier: 'suivi', source: 'code_coach', echeance: 0, maj: 1 };
  const base = (cycles, plan, extra) => Object.assign({
    coachs_registre: { [CO]: { plan: plan || 'libre', le: 1, actifJusqu: plan && plan !== 'libre' ? t + 30 * 864e5 : 0, quota: { cycles, mois: '2026-09' } } },
    annuaire_coach: { [CO]: { [AA]: { email: 'ana@t.fr', maj: 1 }, [BB]: { email: 'bob@t.fr', maj: 1 }, [CC]: { email: 'cyd@t.fr', maj: 1 }, [DD]: { email: 'dan@t.fr', maj: 1 } } },
    users: { [CO]: { role: 'coach', clients: ['b', 'a', 'c'] },
      [AA]: { id: 'a', coachEmailKey: CO, rattacheLe: 200 }, [BB]: { id: 'b', coachEmailKey: CO, rattacheLe: 100 },
      [CC]: { id: 'c', coachEmailKey: CO },                 // sans droits/ : rien ne s'y écrit
      [DD]: { id: 'd', coachEmailKey: 'autre@t,fr' } },    // parti chez un autre coach
    droits: { [AA]: droitsCode, [BB]: droitsCode, [DD]: droitsCode },
    xp_etat: { [AA]: { jr }, [BB]: { jr }, [CC]: { jr }, [DD]: { jr } } }, extra || {});

  await test('quota coach : pendant la grâce (2e mois au-dessus), tout le monde reste couvert', async () => {
    const w = monde(base(1), t);
    const r = await w.M.couvertureCoach(CO, t);
    assert.equal(r.enGrace, true);
    for (const a of [AA, BB]) assert.equal(w.F.lire('droits/' + a + '/couvertParCoach/jusqu'), t + QC.COUVERT_MARGE_MS, a);
    // L'offre du coach voyage avec la couverture : l'app de l'athlète l'y lit (photo du repas).
    for (const a of [AA, BB]) assert.equal(w.F.lire('droits/' + a + '/couvertParCoach/plan'), 'libre', a);
    assert.equal(w.F.lire('droits/' + CC), null, 'aucun droits/ créé');
    assert.equal(w.F.lire('droits/' + DD + '/couvertParCoach'), null, 'l’ancien athlète n’est pas touché');
    assert.deepEqual(w.F.lire('coachs_registre/' + CO + '/quota/cycles'), 2);
  });

  await test('quota coach : après la grâce (3e mois), une place au premier rattaché ; recopie dans droits/, coupure stable', async () => {
    const w = monde(base(2), t);
    const r = await w.M.couvertureCoach(CO, t);
    assert.equal(r.enGrace, false);
    assert.deepEqual(r.horsQuota.sort(), [AA, CC].sort());
    assert.equal(w.F.lire('droits/' + BB + '/couvertParCoach/jusqu'), t + QC.COUVERT_MARGE_MS, 'Bob, rattaché le premier, est couvert');
    assert.equal(w.F.lire('droits/' + AA + '/couvertParCoach/jusqu'), t, 'Ana est hors quota depuis maintenant');
    assert.deepEqual(w.F.lire('droits/' + AA + '/rattache'), { coach: CO, le: 200 });
    assert.deepEqual(w.F.lire('droits/' + BB + '/rattache'), { coach: CO, le: 100 });
    assert.equal(w.F.lire('droits/' + AA + '/palier'), 'suivi', 'le palier n’est pas réécrit : l’app décide');
    const q = w.F.lire('coachs_registre/' + CO + '/quota');
    assert.equal(q.cycles, 3); assert.equal(q.mois, '2026-10'); assert.equal(q.n, 3); assert.equal(q.horsQuota, 2); assert.equal(q.quota, 1);
    // Le lendemain : la date de coupure ne bouge pas, et Ana ne peut pas s'antidater.
    await w.db.ref('users/' + AA + '/rattacheLe').set(1);
    w.avance(864e5);
    await w.M.couvertureCoach(CO, w.t);
    assert.equal(w.F.lire('droits/' + AA + '/couvertParCoach/jusqu'), t, 'coupure inchangée');
    assert.deepEqual(w.F.lire('droits/' + AA + '/rattache'), { coach: CO, le: 200 }, 'le rang du serveur fait foi : pas d’antidate');
    assert.equal(w.F.lire('droits/' + BB + '/couvertParCoach/jusqu'), w.t + QC.COUVERT_MARGE_MS);
  });

  await test('quota coach : redescendu sous son quota (ou passé Pro), il rend l’accès au passage suivant', async () => {
    const w = monde(base(5), t);
    await w.M.couvertureCoach(CO, t);
    assert.equal(w.F.lire('droits/' + AA + '/couvertParCoach/jusqu'), t);
    const w2 = monde(base(5, 'pro'), t);
    const r = await w2.M.couvertureCoach(CO, t);
    assert.equal(r.horsQuota.length, 0);
    assert.equal(w2.F.lire('droits/' + AA + '/couvertParCoach/jusqu'), t + QC.COUVERT_MARGE_MS);
    assert.equal(w2.F.lire('coachs_registre/' + CO + '/quota/cycles'), 0, 'le compteur repart de zéro');
    // Ana et Cyd inactifs depuis 60 jours : Bob seul reste, sous le quota.
    const w3 = monde(base(5, 'libre', { xp_etat: { [BB]: { jr }, [AA]: { jr: { '2026-07-01': { n: 1 } } } } }), t);
    const r3 = await w3.M.couvertureCoach(CO, t);
    assert.equal(r3.n, 1); assert.equal(r3.horsQuota.length, 0);
    assert.equal(w3.F.lire('droits/' + AA + '/couvertParCoach/jusqu'), t + QC.COUVERT_MARGE_MS, 'un inactif reste couvert');
  });

  await test('quota coach : le créateur n’a pas de quota ; un coach hors registre n’est pas touché', async () => {
    const CR = 'guellec,coachingpro@gmail,com';
    const b = base(9);
    b.annuaire_coach = { [CR]: b.annuaire_coach[CO] };
    for (const a of [AA, BB, CC]) b.users[a].coachEmailKey = CR;
    delete b.coachs_registre;
    const w = monde(b, t);
    const r = await w.M.couvertureCoach(CR, t);
    assert.equal(r.horsQuota.length, 0);
    for (const a of [AA, BB]) assert.equal(w.F.lire('droits/' + a + '/couvertParCoach/jusqu'), t + QC.COUVERT_MARGE_MS);
    assert.equal(w.F.lire('coachs_registre/' + CR), null, 'pas de compteur pour le créateur');
    const w2 = monde(Object.assign(base(9), { coachs_registre: null }), t);
    assert.equal(await w2.M.couvertureCoach(CO, t), null);
    assert.equal(w2.F.lire('droits/' + AA + '/couvertParCoach'), null);
  });

  await test('quota coach : le travail du jour (6 h 30), athlète par athlète, dans le budget', async () => {
    const w = monde(base(2), t);
    for (let i = 0; i < 6; i++) await w.minute();
    assert.equal(w.F.lire('worker/jobs/couverture_coachs/fini'), true);
    assert.equal(w.F.lire('droits/' + AA + '/couvertParCoach/jusqu') > 0, true);
    assert.equal(w.F.lire('droits/' + BB + '/couvertParCoach/jusqu') > w.F.lire('droits/' + AA + '/couvertParCoach/jusqu'), true);
  });

  await test('quota coach : les miroirs — quotas et grâce comme l’app, relance après un changement de formule PayPal', () => {
    const app = readFileSync(new URL('../../src/core/001-debut.js', import.meta.url), 'utf8');
    for (const [cle, q] of [['libre', '1'], ['coach', '15'], ['pro', 'Infinity']])
      assert.match(app, new RegExp("cle:'" + cle + "'[^\\n]*quota:" + q + ','), cle);
    assert.equal(QC.QUOTAS.libre, 1); assert.equal(QC.QUOTAS.coach, 15); assert.equal(QC.QUOTAS.pro, Infinity);
    const a2 = readFileSync(new URL('../../src/core/002-l-essai-athlete-symetrique-de-la-promesse-coach.js', import.meta.url), 'utf8');
    assert.equal(QC.CYCLES_GRACE, Number(/const PALIERS_CYCLES_AVANT_PROPOSITION=(\d+);/.exec(a2)[1]) + 1);
    assert.match(app, new RegExp('const QUOTA_CYCLES_GRACE=' + QC.CYCLES_GRACE + ';'));
    const pp = readFileSync(new URL('../src/paypal.js', import.meta.url), 'utf8');
    // Paiement, remboursement, fin, et le changement de formule (Coach ↔ Pro, BILLING.SUBSCRIPTION.UPDATED).
    assert.equal((pp.match(/worker\/jobs\/couverture_coachs/g) || []).length, 4, 'les quatre changements de formule relancent le calcul');
    assert.deepEqual(QC.cyclesSuivants({ cycles: 2, mois: '2026-09' }, true, '2026-10'), { cycles: 3, mois: '2026-10' });
    assert.deepEqual(QC.cyclesSuivants({ cycles: 3, mois: '2026-10' }, true, '2026-10'), { cycles: 3, mois: '2026-10' });
    assert.deepEqual(QC.cyclesSuivants({ cycles: 3, mois: '2026-10' }, false, '2026-10'), { cycles: 0, mois: '2026-10' });
  });
}

// ══ LES INDICATEURS DU CRÉATEUR (02/10/2026) ═══════════════════════════════
// Un jeu inventé, et les valeurs attendues calculées À LA MAIN :
//   mensuels actifs : ess1 9,50 + ult1 24,90 + ess2 9,95 (ancien tarif, réellement prélevé)  = 44,35
//   annuel actif    : ann1 Ultime 249 € / 12                                                  = 20,75
//   demi actif      : demi1, premier mois réellement prélevé                                  = 12,45
//   coachs          : Coach 19 + Pro 39                                                       = 58,00
//   résilié en cours (echeance future), remboursé (echeance passée) : exclus
//   MRR = 44,35 + 20,75 + 12,45 + 58 = 135,55
{
  const T = PARIS('2026-10-15T07:00:00'), J = 864e5;
  const ESS = 'P-95N51603RD882780YNJKS2QA', ULT = 'P-2W777608239063532NK2LZXA', ULT_AN = 'P-4R440392FL765935VNK732WI', DEMI = 'P-57P40267XP026613FNK2LZXQ';
  const droits = {
    'ess1': { palier: 'essentielle', echeance: 0, source: 'paypal', abo: 'I-ESS1', essaiOuvertLe: T - 60 * J },
    'ult1': { palier: 'ultime', echeance: 0, source: 'paypal', abo: 'I-ULT1', essaiOuvertLe: T - 50 * J },
    'ess2': { palier: 'essentielle', echeance: 0, source: 'paypal', abo: 'I-ESS2' },
    'ann1': { palier: 'ultime', echeance: 0, source: 'paypal', abo: 'I-ANN1' },
    'demi1': { palier: 'ultime', echeance: 0, source: 'paypal', abo: 'I-DEMI1' },
    'res1': { palier: 'essentielle', echeance: T + 20 * J, source: 'paypal', abo: 'I-RES1', essaiOuvertLe: T - 90 * J },
    'remb1': { palier: 'essentielle', echeance: T - 2 * J, source: 'paypal', abo: 'I-REMB1' },
    'eva': { palier: 'aucun', echeance: 0, source: 'essai', essaiOuvertLe: T - 10 * J },
    'suivi1': { palier: 'suivi', echeance: 0, source: 'code_coach' },
  };
  const v = (cle, abo, cts, plan, le, o) => Object.assign({ cle, abo, type: 'abonnement', montant: cts, plan, le, premier: false }, o || {});
  const transactions = {
    S1: v('ess1', 'I-ESS1', 950, ESS, T - 30 * J), S1b: v('ess1', 'I-ESS1', 950, ESS, T - 5 * J),
    S2: v('ult1', 'I-ULT1', 2490, ULT, T - 3 * J),
    S3: v('ess2', 'I-ESS2', 995, null, T - 8 * J),             // vente d'avant le plan noté : 9,95 au mois
    S4: v('ann1', 'I-ANN1', 24900, ULT_AN, T - 100 * J),
    S5: v('demi1', 'I-DEMI1', 1245, DEMI, T - 6 * J),
    S6: v('res1', 'I-RES1', 950, ESS, T - 10 * J),
    S7: v('remb1', 'I-REMB1', 950, ESS, T - 2 * J, { annuleLe: T - 2 * J, rembourses: { R1: 950 } }),
    P1: { cle: 'eva', type: 'programme', montant: 1490, le: T - 4 * J },
  };
  const users = { 'kev,coach': { coachPlan: 'coach', coachSubActive: true }, 'lou,pro': { coachPlan: 'pro', coachSubActive: true },
    'max,libre': { coachPlan: 'libre', coachSubActive: false }, 'old,coach': { coachPlan: 'coach', coachSubActive: false } };
  const fins = { res1: { fin: T + 20 * J, le: T - 1 * J, role: 'athlete' } };

  await test('indicateurs : MRR au centime près sur le jeu de test (135,55 €), résiliés et remboursés exclus', async () => {
    const r = indicateurs(droits, transactions, users, T, fins);
    assert.equal(r.mrrTTC, 135.55);
    assert.deepEqual(r.mrrParFormule, { essentielle: 19.45, ultime: 58.1, coach: 19, pro: 39 });
    assert.equal(r.abonnesActifs, 7, '5 athlètes + 2 coachs');
    assert.equal(r.resiliesEnCours, 1);
    assert.equal(r.churnMois, 12.5, '1 résiliation ce mois / (7 + 1)');
    assert.equal(r.conversionEssai, 75, 'ess1, ult1, res1 ont payé ; eva non : 3 / 4');
    assert.equal(r.partAnnuel, 20, '1 annuel sur 5 athlètes');
    assert.equal(r.revenuParCoach, 29, '(19 + 39) / 2');
    assert.equal(r.remboursesMois, 9.5);
  });

  await test('indicateurs : un coach résilié (fin notée) sort du MRR ; un abonné sans vente connue compte au prix de la table', async () => {
    const r = indicateurs(droits, transactions, users, T, Object.assign({}, fins, { 'lou,pro': { fin: T + 9 * J, le: T, role: 'coach' } }));
    assert.equal(r.mrrTTC, 96.55);
    assert.equal(r.resiliesEnCours, 2);
    const r2 = indicateurs({ x: { palier: 'ultime', echeance: 0, source: 'paypal', abo: 'I-X' } }, {}, {}, T, {});
    assert.equal(r2.mrrTTC, 24.9);
    assert.equal(r2.conversionEssai, null, 'pas d’essai : pas de taux inventé');
  });

  await test('indicateursJour : écrit indicateurs/<jour> depuis droits/, paypal_transactions, coachs_registre et paypal_fins ; travail planifié', async () => {
    const w = monde({ droits, paypal_transactions: transactions, paypal_fins: fins,
      coachs_registre: { 'kev,coach': { plan: 'coach', actifJusqu: T + 30 * J }, 'lou,pro': { plan: 'pro', actifJusqu: T + 30 * J }, 'old,coach': { plan: 'coach', actifJusqu: T - J } } }, T);
    const r = await w.M.indicateursJour(T);
    assert.equal(r.mrrTTC, 135.55);
    const ecrit = w.F.lire('indicateurs/2026-10-15');
    assert.equal(ecrit.mrrTTC, 135.55);
    assert.equal(ecrit.maj, T);
    assert.ok(w.compteur() <= 6, w.compteur() + ' requêtes');
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(new URL('../src/planif.js', import.meta.url), 'utf8');
    assert.match(src, /nom: 'indicateurs', quand: \(p\) => apres\(p, 6, 50\), une: \(t\) => \(M\.indicateursJour \? M\.indicateursJour\(t\) : null\)/);
    const regles = readFileSync(new URL('../../database.rules.json', import.meta.url), 'utf8');
    assert.match(regles, /"indicateurs": \{\n\s+"\.read": "auth != null && \(auth\.uid === '[^']+' && auth\.token\.email_verified === true\)",\n\s+"\.write": false\n\s+\}/);
  });

  await test('finUne : la fin d’un athlète atteinte écrit aussi paymentStatus = cancelled', async () => {
    const { creerPaypal } = await import('../src/paypal.js');
    const w = monde({ users: { 'lea,fr': { role: 'athlete', status: 'AUTONOMIE_PREMIUM', paymentStatus: 'active' } },
      paypal_fins: { 'lea,fr': { fin: T - J, role: 'athlete', reserve: 0, le: T - 30 * J } } }, T);
    const PP = creerPaypal({ db: w.db, M: w.M, env: {}, maintenant: () => T });
    assert.equal(await PP.fins(), 1);
    assert.equal(w.F.lire('users/lea,fr/paymentStatus'), 'cancelled');
    assert.equal(w.F.lire('users/lea,fr/updatedAt'), T);
    assert.equal(w.F.lire('paypal_fins/lea,fr'), null);
  });
}

console.log(ok + ' tests passés — budget par réveil : ' + BUDGET + ' requêtes');
