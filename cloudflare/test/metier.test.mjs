// Le serveur léger de bout en bout, sur une base en mémoire (API REST) et un
// faux service de push qui déchiffre ce qu'il reçoit.
//   node cloudflare/test/metier.test.mjs
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { creerBase } from '../src/base.js';
import { creerMetier, paris } from '../src/metier.js';
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
  assert.equal(w.F.recus.length, 1);
  assert.equal(w.F.lire('push_attente/' + A1), null);
});

await test('jeudi 18 h : la série en danger, par lots, reprise d’une minute à l’autre', async () => {
  const users = {}, push = {}, tels = {};
  for (let i = 0; i < 9; i++) {
    const k = 'a' + i + '@t,fr';
    users[k] = { streak: 3, streakWeek: '2026-09-14', fname: 'A' + i };
    tels[k] = appareil('https://push.test/' + i);
    push[k] = { a1b2c3: tels[k].abonnement };
  }
  users['a0@t,fr'].streakWeek = '2026-09-28';     // semaine déjà validée : rien
  const w = monde({ users, push }, PARIS('2026-10-01T18:01:00'));   // un jeudi
  assert.equal(paris(w.t).joursem, 4);
  let tours = 0;
  while (tours++ < 10) {
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

await test('parrainage : la demande est jugée, le filleul rattaché, le parrain prévenu', async () => {
  const P1 = 'parrain@t,fr', F1 = 'filleul@t,fr';
  const telP = appareil('https://push.test/p');
  const t = PARIS('2026-09-28T12:00:00');
  const w = monde({
    users: { [P1]: { fname: 'Kev' }, [F1]: { fname: 'Julie', createdAt: t - 864e5 } },
    push: { [P1]: { a1b2c3: telP.abonnement } },
    parrainage: { codes: { KEVIN7X9: P1 }, demandes: { [F1]: { code: 'KEVIN7X9', le: t, appareil: 'abc123' } } },
    evenements: { e1: { type: 'parrainage_demande', par: F1, at: t } } }, t);
  await w.minute();
  assert.equal(w.F.lire('parrainage/demandes/' + F1 + '/etat'), 'accepte');
  assert.equal(w.F.lire('parrainage/liens/' + F1).parrain, P1);
  // Le serveur n'écrit RIEN dans droits/ : un nœud non vide y primerait sur le dossier.
  assert.equal(w.F.lire('droits'), null);
  const m = telP.lire(w.F.recus[0].init.body);
  assert.match(m.title, /Julie vient de s’inscrire avec ton code/);
  // Son premier paiement : 1 mois au parrain, une seule fois.
  const r = await w.M.parrainagePaiement(F1, 'test');
  assert.ok(r);
  assert.equal(w.F.lire('parrainage/comptes/' + P1 + '/moisGagnes'), 1);
  assert.equal(w.F.lire('droits'), null, 'toujours rien dans droits/');
  assert.equal(await w.M.parrainagePaiement(F1, 'test'), null, 'idempotent');
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
    'c@t,fr': {}, 'coach@t,fr': { role: 'coach', badges: { assidu1: { at: 1 } } } } }, PARIS('2026-09-28T03:20:00'));
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

console.log(ok + ' tests passés — budget par réveil : ' + BUDGET + ' requêtes');
