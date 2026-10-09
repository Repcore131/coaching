// La file et la minute sous contrainte : budget dans les boucles internes,
// échecs en fin de file puis evenements_ko, verrou, /reveil, purge PayPal,
// /sante?cles=1 et la limite par IP de /arrivee.
//   node cloudflare/test/planif.test.mjs
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { creerBase } from '../src/base.js';
import { creerMetier, MAX_CHIFFREMENTS } from '../src/metier.js';
import { creerPaypal } from '../src/paypal.js';
import { minute, BUDGET, ESSAIS_MAX, VERROU_MS, travaux } from '../src/planif.js';
import { paris, CLE_CREATEUR_PUSH } from '../src/metier.js';
import worker from '../src/index.js';
import { fausseBase, appareil } from './fausse-base.mjs';

const vp = crypto.createECDH('prime256v1'); vp.generateKeys();
const VAPID = { publique: vp.getPublicKey().toString('base64url'), privee: vp.getPrivateKey().toString('base64url') };
const PARIS = (iso) => Date.parse(iso + '+02:00');
let ok = 0;
const test = async (nom, fn) => { await fn(); ok++; console.log('ok  ', nom); };

// Un Worker : sa base (partagée si `F` est donné), son compteur, son horloge.
function monde(initial, t, F0) {
  const F = F0 || fausseBase(initial);
  let n = 0, horloge = t;
  const fetchCompte = (u, i) => { n++; return F.fetchImpl(u, i); };
  const db = creerBase({ url: 'https://base.test', auth: 's', fetchImpl: fetchCompte });
  const M = creerMetier({ db, vapid: VAPID, fetchImpl: fetchCompte, maintenant: () => horloge });
  M.coachsEtUsers = () => db.ref('users').shallow();
  M.paypal = creerPaypal({ db, M, env: {}, fetchImpl: fetchCompte, maintenant: () => horloge });
  return { F, db, M, get t() { return horloge; }, avance: (ms) => { horloge += ms; },
    minute: (o) => { n = 0; return minute(Object.assign({ db, M, compteur: () => n, maintenant: () => horloge }, o)); } };
}
const cles = (o) => Object.keys(o || {});
const K = 'kev@t,fr';

await test('un événement qui échoue repart EN FIN DE FILE, sans bloquer les suivants ; au 5e échec, evenements_ko', async () => {
  const t = PARIS('2026-09-28T12:00:00');
  const w = monde({ users: { 'lea@t,fr': {} },
    parrainage: { demandes: { 'p1@t,fr': { code: 'KEVIN7X9', le: t } } },
    evenements: {
      e0000000001: { type: 'defi_maj', par: 'lea@t,fr', coach: K, id: 'd1', cible: 'd1', at: t },
      e0000000002: { type: 'parrainage_demande', par: 'p1@t,fr', cible: '-', at: t } },
    evenements_attente: { 'lea@t,fr': { defi_maj: { d1: { id: 'e0000000001', at: t } } } } }, t);
  // Le défi casse : sa lecture lève.
  const vrai = w.M.recalculerDefi;
  w.M.evenement = async () => { throw new Error('base 500 sur canaux'); };
  const b = await w.minute();
  assert.equal(b.echecs, 1);
  assert.equal(w.F.lire('parrainage/demandes/p1@t,fr/etat'), 'refuse', 'le suivant est passé');
  const file = w.F.lire('evenements');
  assert.equal(cles(file).length, 1);
  const [id] = cles(file);
  assert.ok(id > 'e0000000002', 'en fin de file');
  assert.match(id, /^e[a-z0-9]{8,24}$/, 'au format des règles');
  assert.equal(file[id].essais, 1);
  assert.equal(file[id].erreur, 'base 500 sur canaux');
  assert.equal(w.F.lire('evenements_attente/lea@t,fr/defi_maj/d1/id'), id, 'le verrou suit : toujours « en attente »');
  for (let i = 2; i <= ESSAIS_MAX; i++) { w.avance(60e3); await w.minute(); }
  assert.equal(w.F.lire('evenements'), null, 'sorti de la file');
  const ko = w.F.lire('evenements_ko');
  assert.equal(cles(ko).length, 1);
  const x = Object.values(ko)[0];
  assert.equal(x.essais, ESSAIS_MAX); assert.equal(x.type, 'defi_maj'); assert.equal(x.par, 'lea@t,fr');
  assert.equal(x.erreur, 'base 500 sur canaux'); assert.equal(x.le, w.t);
  assert.ok(vrai);
});

await test('erreur puis réussite : l’événement réessayé passe, et n’est plus dans la file', async () => {
  const t = PARIS('2026-09-28T12:00:00');
  const w = monde({ evenements: { e0000000001: { type: 'reponse_bilan', par: K, dest: 'lea@t,fr', i: '0', cible: 'lea@t,fr', at: t } } }, t);
  let n = 0;
  w.M.evenement = async () => { if (n++ === 0) throw new Error('coupure'); return 'envoye'; };
  await w.minute();
  assert.equal(cles(w.F.lire('evenements')).length, 1);
  w.avance(60e3);
  const b = await w.minute();
  assert.equal(b.echecs, 0);
  assert.equal(w.F.lire('evenements'), null);
  assert.equal(w.F.lire('evenements_ko'), null);
});

await test('verrou : deux exécutions simultanées, une seule traite la file ; un bail échu se reprend', async () => {
  const t = PARIS('2026-09-28T12:00:00');
  const a = monde({ evenements: { e0000000001: { type: 'defi_maj', par: 'x@t,fr', coach: K, id: 'd1', cible: 'd1', at: t } } }, t);
  const b = monde(null, t, a.F);
  let traites = 0;
  a.M.evenement = b.M.evenement = async () => { traites++; return 'ok'; };
  const [ra, rb] = await Promise.all([a.minute(), b.minute({ source: 'reveil' })]);
  assert.deepEqual([ra.verrou, rb.verrou].sort(), ['occupe', 'pris']);
  assert.equal(traites, 1);
  assert.equal(a.F.lire('worker/verrou/jusqua'), 0, 'rendu à la fin');
  // Une exécution morte en route laisse son bail : il bloque 55 s, pas plus.
  a.F.ecrire('worker/verrou', { jusqua: t + VERROU_MS, id: 'mort' });
  assert.equal((await a.minute()).verrou, 'occupe');
  a.avance(VERROU_MS + 1);
  assert.equal((await a.minute()).verrou, 'pris');
});

await test('/reveil : sans effet si la file a été parcourue il y a moins de 30 s ; la minute, elle, passe toujours', async () => {
  const t = PARIS('2026-09-28T12:00:00');
  const w = monde({}, t);
  await w.minute();
  w.avance(10e3);
  const r = await w.minute({ source: 'reveil' });
  assert.equal(r.verrou, 'recent');
  assert.ok(r.requetes <= 2, 'une transaction, rien d’autre : ' + r.requetes);
  assert.equal((await w.minute()).verrou, 'pris');
  w.avance(31e3);
  assert.equal((await w.minute({ source: 'reveil' })).verrou, 'pris');
});

// Un coach, N athlètes abonnés aux notifications.
function equipe(n) {
  const users = { [K]: { role: 'coach' } }, push = {}, annuaire = {}, tels = {};
  for (let i = 0; i < n; i++) {
    const k = 'a' + String(i).padStart(4, '0') + '@t,fr';
    users[k] = { coachEmailKey: K, fname: 'A' + i };
    tels[k] = appareil('https://push.test/' + i);
    push[k] = { x: tels[k].abonnement };
    annuaire[k] = { email: k.replace(/,/g, '.') };
  }
  return { users, push, annuaire, tels };
}

await test('un défi publié à 30 athlètes : le budget est tenu, la suite part en sous-tâches (une par athlète), tous le reçoivent une fois', async () => {
  const t = PARIS('2026-09-28T12:00:00');
  const eq = equipe(30);
  const w = monde({ users: eq.users, push: eq.push, annuaire_coach: { [K]: eq.annuaire },
    canaux: { [K]: { messages: { m1: { type: 'defi', titre: '12 séances', mesure: 'seances', objectif: 12, debut: t, fin: t + 7 * 864e5 } } } },
    evenements: { e0000000001: { type: 'defi_publie', par: K, msg: 'm1', cible: 'm1', at: t } } }, t);
  const b1 = await w.minute();
  assert.ok(b1.requetes <= 50, b1.requetes);
  assert.ok(b1.chiffrements <= MAX_CHIFFREMENTS, 'chiffrements : ' + b1.chiffrements);
  const taches = Object.values(w.F.lire('evenements') || {});
  assert.ok(taches.length > 0 && taches.length < 30, 'une partie envoyée, le reste différé : ' + taches.length);
  assert.ok(taches.every((x) => x.type === 'tache' && x.quoi === 'push' && x.uid && x.message.tag === 'defi-m1'));
  assert.equal(new Set(taches.map((x) => x.uid)).size, taches.length, 'une sous-tâche par athlète');
  let tours = 1;
  while (w.F.lire('evenements') && tours++ < 40) {
    w.avance(60e3);
    const b = await w.minute();
    assert.ok(b.requetes <= 50, 'jamais plus de 50 requêtes : ' + b.requetes);
    assert.ok(b.chiffrements <= MAX_CHIFFREMENTS, 'chiffrements : ' + b.chiffrements);
  }
  assert.equal(w.F.lire('evenements'), null, 'tout est parti');
  assert.equal(w.F.recus.length, 30);
  assert.equal(new Set(w.F.recus.map((r) => r.endpoint)).size, 30, 'une fois chacun');
});

await test('rappel des 48 h d’un défi à 20 participants : noté une fois, la suite en sous-tâches', async () => {
  const t = PARIS('2026-09-28T09:01:00');
  const eq = equipe(20);
  const parts = {};
  for (const k of cles(eq.push)) parts[k] = { inscription: { le: t, prenom: 'x' }, valeur: 1 };
  const w = monde({ users: eq.users, push: eq.push,
    canaux: { [K]: { messages: { d1: { type: 'defi', titre: 'Défi', mesure: 'seances', objectif: 12, debut: t - 5 * 864e5, fin: t + 30 * 3600e3 } },
      defis: { d1: { participants: parts } } } } }, t);
  let tours = 0;
  while (tours++ < 30) {
    const b = await w.minute();
    assert.ok(b.requetes <= 50, b.requetes);
    if (b.travaux.defis === 'fini' && !w.F.lire('evenements')) break;
    w.avance(60e3);
  }
  assert.equal(w.F.lire('canaux/' + K + '/defis/d1/etat/rappel48'), true);
  assert.equal(w.F.recus.length, 20);
  assert.equal(new Set(w.F.recus.map((r) => r.endpoint)).size, 20);
});

await test('ambassadeurs : au-delà du budget, un ambassadeur par sous-tâche ; toutes les vues sont refaites', async () => {
  const t = PARIS('2026-09-28T06:21:00');
  const amb = {}, pub = {};
  for (let i = 0; i < 25; i++) {
    const c = 'AMB' + String.fromCharCode(65 + i) + 'X';
    amb[c] = { nom: c, secret: crypto.randomBytes(12).toString('hex') };
    pub[c] = true;
  }
  const w = monde({ ambassadeurs: amb, ambassadeurs_publics: pub }, t);
  const b = await w.minute();
  assert.ok(b.requetes <= 50, b.requetes);
  assert.ok(Object.values(w.F.lire('evenements') || {}).some((x) => x.quoi === 'amb_vue'), 'la suite est différée');
  for (let i = 0; i < 10 && w.F.lire('evenements'); i++) { w.avance(60e3); assert.ok((await w.minute()).requetes <= 50); }
  assert.equal(cles(w.F.lire('ambassadeurs_vue')).length, 25);
});

await test('fins de coachs : au-delà du budget, un compte par sous-tâche, relu avant d’agir', async () => {
  const t = PARIS('2026-09-28T06:01:00');
  const fins = {}, users = {};
  for (let i = 0; i < 20; i++) {
    const k = 'c' + i + '@t,fr';
    users[k] = { role: 'coach', coachPlan: 'pro', coachSubActive: true };
    fins[k] = { fin: t - 1000, role: 'coach' };
  }
  // La rareté des badges de la nuit est faite : la minute va droit aux fins.
  const w = monde({ users, paypal_fins: fins, worker: { jobs: { stats_badges: { jour: '2026-09-28', fini: true } } } }, t);
  await w.minute();
  // Un coach différé reprend son abonnement entre-temps : sa fin est retirée avant que la sous-tâche passe.
  const differees = Object.values(w.F.lire('evenements') || {}).filter((x) => x.quoi === 'fin_paypal').map((x) => x.cle);
  assert.ok(differees.length > 0 && differees.length < 20, 'différées : ' + differees.length);
  const repris = differees[differees.length - 1];
  w.F.ecrire('paypal_fins/' + repris, null);
  for (let i = 0; i < 10 && w.F.lire('evenements'); i++) { w.avance(60e3); assert.ok((await w.minute()).requetes <= 50); }
  assert.equal(w.F.lire('paypal_fins'), null);
  const fermes = cles(users).filter((k) => w.F.lire('users/' + k + '/coachPlan') === 'libre');
  assert.equal(fermes.length, 19);
  assert.equal(w.F.lire('users/' + repris + '/coachPlan'), 'pro', 'celui qui a repris n’est pas fermé');
});

await test('purge mensuelle : le 1er, les paypal_evenements de plus de 90 jours partent, par lots, les récents restent', async () => {
  const t = PARIS('2026-10-01T04:11:00');
  const ev = {};
  for (let i = 0; i < 450; i++) ev['WH-V' + i] = { etat: 'fait', at: t - 91 * 864e5 - i * 1000 };
  for (let i = 0; i < 5; i++) ev['WH-R' + i] = { etat: 'fait', at: t - 10 * 864e5 };
  ev['WH-LIMITE'] = { etat: 'fait', at: t - 89 * 864e5 };
  const w = monde({ paypal_evenements: ev }, t);
  let tours = 0;
  while (tours++ < 10) {
    const b = await w.minute();
    assert.ok(b.requetes <= 50);
    if (b.travaux.purge_paypal === 'fini') break;
    w.avance(60e3);
  }
  assert.deepEqual(cles(w.F.lire('paypal_evenements')).sort(), ['WH-LIMITE', 'WH-R0', 'WH-R1', 'WH-R2', 'WH-R3', 'WH-R4']);
  // Un autre jour du mois, rien ne se lance.
  const w2 = monde({ paypal_evenements: { 'WH-V': { at: 1 } } }, PARIS('2026-10-02T04:11:00'));
  await w2.minute();
  assert.ok(w2.F.lire('paypal_evenements/WH-V'));
});

await test('un travail du jour qui lève cinq fois de suite : rangé dans evenements_ko, il ne tourne plus', async () => {
  const t = PARIS('2026-10-01T04:11:00');
  const w = monde({}, t);
  w.M.paypal.purgerEvenements = async () => { throw new Error('Index not defined'); };
  for (let i = 0; i < 7; i++) { await w.minute(); w.avance(60e3); }
  const ko = Object.values(w.F.lire('evenements_ko') || {});
  assert.equal(ko.length, 1);
  assert.equal(ko[0].type, 'travail'); assert.equal(ko[0].nom, 'purge_paypal'); assert.equal(ko[0].erreur, 'Index not defined');
  assert.equal(w.F.lire('worker/jobs/purge_paypal/fini'), true);
});

// ── Le point d'entrée ─────────────────────────────────────────────────────
const CTX = { waitUntil() {} };
const ENV = { FIREBASE_DB_URL: 'https://base-essai.firebaseio.com', FIREBASE_DB_SECRET: 'x' };

await test('/sante?cles=1 : 401 sans le secret d’administration, ou avec un faux ; ouvert avec le bon', async () => {
  const appel = (env, h) => worker.fetch(new Request('https://s.t/sante?cles=1', { headers: h || {} }), env, CTX);
  assert.equal((await appel(ENV)).status, 401, 'aucun secret posé : fermé');
  const env = Object.assign({}, ENV, { ADMIN_SECRET: 'un-long-secret-d-administration' });
  assert.equal((await appel(env)).status, 401);
  assert.equal((await appel(env, { Authorization: 'Bearer un-long-secret-d-administratioN' })).status, 401);
  assert.equal((await appel(env, { Authorization: 'Bearer un-long' })).status, 401);
  const vrai = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('hors ligne'); };
  try {
    const r = await appel(env, { Authorization: 'Bearer un-long-secret-d-administration' });
    assert.equal(r.status, 200);
    const j = await r.json();
    assert.ok('paypal' in j && 'cloudinary' in j);
  } finally { globalThis.fetch = vrai; }
  // /sante tout court reste public : le pouls et des compteurs, rien sur les clés.
  // (Base injoignable ici : 503, et toujours aucun secret dans la réponse.)
  globalThis.fetch = async () => { throw new Error('hors ligne'); };
  try {
    const s = await worker.fetch(new Request('https://s.t/sante'), ENV, CTX);
    assert.equal(s.status, 503);
    assert.ok(!/paypal|cloudinary|acces/.test(await s.text()));
  } finally { globalThis.fetch = vrai; }
});

await test('/arrivee et /amb-clic : limités par adresse IP (429), les autres IP passent', async () => {
  const vus = {};
  const LIMITE_ARRIVEES = { async limit({ key }) { vus[key] = (vus[key] || 0) + 1; return { success: vus[key] <= 3 }; } };
  const env = Object.assign({}, ENV, { LIMITE_ARRIVEES });
  const appel = (ip, chemin) => worker.fetch(new Request('https://s.t' + chemin, { headers: { 'CF-Connecting-IP': ip } }), env, CTX);
  for (let i = 0; i < 3; i++) assert.equal((await appel('1.2.3.4', '/arrivee?src=story')).status, 204);
  const r = await appel('1.2.3.4', '/amb-clic?c=MAXFIT');
  assert.equal(r.status, 429);
  assert.equal(r.headers.get('Access-Control-Allow-Origin'), '*');
  assert.equal((await appel('5.6.7.8', '/arrivee?src=story')).status, 204);
  const panne = Object.assign({}, ENV, { LIMITE_ARRIVEES: { async limit() { throw new Error('limiteur absent'); } } });
  assert.equal((await worker.fetch(new Request('https://s.t/arrivee?src=story'), panne, CTX)).status, 204, 'une panne du limiteur laisse passer');
});

await test('la série en danger : jeudi de 17 h à 21 h ; les travaux qui envoient sans attendre s’arrêtent à 21 h', async () => {
  const T = travaux({ planifies: {}, abonnes: () => [] });
  const w = (n) => T.find((x) => x.nom === n);
  const q = (n, iso) => w(n).quand(paris(PARIS(iso)));
  assert.equal(q('serie', '2026-10-01T16:59:00'), false);
  assert.equal(q('serie', '2026-10-01T17:00:00'), true);
  assert.equal(q('serie', '2026-10-01T20:59:00'), true);
  assert.equal(q('serie', '2026-10-01T21:00:00'), false);
  assert.equal(q('serie', '2026-10-02T17:30:00'), false, 'le jeudi seulement');
  for (const n of ['serie', 'retour', 'bilan', 'wrapped', 'badge', 'duels']) assert.equal(w(n).fenetre, true, n);
  assert.equal(q('retour', '2026-10-01T21:00:00'), false);
  assert.equal(q('duels', '2026-10-01T21:10:00'), false);
});

// ══ LE POULS ET L'ALERTE DES ÉCHECS (01/10/2026) ═══════════════════════════
// Tous les travaux faits pour la période : le jour, ou l'heure pour les travaux horaires.
const tousFinis = (jour, heure) => Object.fromEntries(travaux({ planifies: {}, abonnes: () => [] })
  .map((x) => [x.nom, { jour: x.heure && heure != null ? jour + 'h' + heure : jour, fini: true }]));
await test('le pouls est écrit dans worker/verrou SANS requête de plus : une minute à vide en coûte toujours 5', async () => {
  const t = PARIS('2026-09-29T15:00:20');   // un mardi : aucun travail horaire neuf à 15 h 00 (déjà marqués)
  const p = paris(t);
  const jobs = tousFinis(p.jour, p.heure);
  const w = monde({ worker: { jobs } }, t);
  const b = await w.minute();
  assert.equal(b.requetes, 5, 'verrou (2), file (1), travaux (1), écriture finale (1)');
  const v = w.F.lire('worker/verrou');
  assert.equal(v.jusqua, 0);
  // erreur: null n'est pas gardé par Firebase (un null efface le champ).
  assert.deepEqual(v.pouls, { t, requetes: 4, evenements: 0, echecs: 0, source: 'cron' });
  // Par /reveil : la source le dit.
  w.avance(60e3);
  const b2 = await w.minute({ source: 'reveil' });
  assert.equal(b2.requetes, 5);
  assert.equal(w.F.lire('worker/verrou/pouls/source'), 'reveil');
});
await test('un réveil trop long rend le bail par transaction, et y écrit aussi le pouls', async () => {
  const t = PARIS('2026-09-29T15:00:20');
  const p = paris(t);
  const jobs = tousFinis(p.jour, p.heure);
  const w = monde({ worker: { jobs } }, t);
  let appels = 0;
  // La première lecture de l'horloge vaut t, les suivantes t + 45 s.
  const b = await w.minute({ maintenant: () => (appels++ === 0 ? t : t + 45e3) });
  assert.equal(b.requetes, 6, 'verrou (2), file (1), travaux (1), transaction de rendu (2)');
  const v = w.F.lire('worker/verrou');
  assert.equal(v.jusqua, 0); assert.equal(v.pouls.t, t + 45e3); assert.equal(v.pouls.requetes, 4);
});
await test('un événement rangé dans evenements_ko prévient le créateur (push urgent), une fois par heure au plus', async () => {
  const t = PARIS('2026-09-28T23:10:00');   // en pleine nuit : l'urgent passe les heures calmes
  const w = monde({ users: { 'lea@t,fr': {} },
    push: { [CLE_CREATEUR_PUSH]: { x: Object.assign({}, appareil('https://push.test/crea').abonnement) } },
    evenements: { e0000000001: { type: 'message', par: 'lea@t,fr', cible: 'c1', at: t, essais: ESSAIS_MAX - 1 },
      e0000000002: { type: 'reaction', par: 'lea@t,fr', cible: 'c2', at: t, essais: ESSAIS_MAX - 1 } } }, t);
  w.M.evenement = async () => { throw new Error('base 500 sur canaux'); };
  const b = await w.minute();
  assert.equal(b.echecs, 2);
  assert.equal(cles(w.F.lire('evenements_ko')).length, 2);
  assert.equal(w.F.recus.length, 1, 'un seul push pour deux échecs dans la même heure');
  assert.equal(w.F.recus[0].endpoint, 'https://push.test/crea');
  assert.equal(w.F.lire('worker/alerte_ko'), paris(t).jour + 'h' + paris(t).heure);
  assert.ok(b.requetes <= 50, b.requetes + ' requêtes');
  // L'heure suivante, un nouvel échec repart.
  w.F.ecrire('evenements/e0000000003', { type: 'message', par: 'lea@t,fr', cible: 'c3', at: t, essais: ESSAIS_MAX - 1 });
  w.avance(3600e3);
  await w.minute();
  assert.equal(w.F.recus.length, 2);
});

console.log(ok + ' tests passés — budget par réveil : ' + BUDGET + ' requêtes, ' + MAX_CHIFFREMENTS + ' chiffrements');
