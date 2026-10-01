// CHARGE SIMULÉE : 10, 100 et 1 000 abonnés aux notifications, sur la base en
// mémoire. Deux chemins : un défi publié à toute l'équipe (la file et ses
// sous-tâches) et la série du jeudi (un travail planifié, par lots).
// Et trois épreuves (01/10/2026) :
//   (a) TOUS les travaux actifs, jeudi 18 h, 300 abonnés, rien de pré-marqué :
//       300 servis sur 300 avant 21 h ;
//   (b) la fenêtre de 21 h : personne n'est compté « traité » sans push, et
//       la liste inachevée écrit `sautes` (et une ligne dans evenements_ko) ;
//   (c) la tenue de livre : base vide, 1 440 minutes, moins de 8 000
//       sous-requêtes dans la journée (minute() et l'alerte de quota).
// Mesuré à chaque réveil : les sous-requêtes (plafond Cloudflare : 50), les
// chiffrements de push (plafond du Worker : MAX_CHIFFREMENTS), le temps de
// calcul, et le nombre de réveils (de minutes) jusqu'au dernier envoi.
//   node cloudflare/test/charge.test.mjs
//
// ⚠ LE TEMPS DE CALCUL EST CELUI DE NODE, hors base simulée (décomptée) : une
//   estimation, pas la mesure d'un Worker. Le chiffrement seul est mesuré à
//   part : c'est lui qui pèse.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { creerBase } from '../src/base.js';
import { creerMetier, MAX_CHIFFREMENTS, COUT_PUSH } from '../src/metier.js';
import { minute, BUDGET } from '../src/planif.js';
import { surveillerQuota } from '../src/pouls.js';
import { chiffrer } from '../src/push.js';
import { fausseBase, appareil } from './fausse-base.mjs';

const vp = crypto.createECDH('prime256v1'); vp.generateKeys();
const VAPID = { publique: vp.getPublicKey().toString('base64url'), privee: vp.getPrivateKey().toString('base64url') };
const PARIS = (iso) => Date.parse(iso + '+02:00');
const K = 'kev@t,fr';
// 1 000 prend quelques minutes : à la demande (CHARGE=10,100,1000).
const TAILLES = (process.env.CHARGE || '10,100').split(',').map(Number);

// Les appareils coûtent cher à fabriquer : une poignée, partagés (le service de
// push simulé ne regarde que l'adresse, unique par athlète).
const MODELES = Array.from({ length: 8 }, (_, i) => appareil('https://push.test/m' + i));
function donnees(n, t) {
  const users = { [K]: { role: 'coach' } }, push = {}, annuaire = {};
  for (let i = 0; i < n; i++) {
    const k = 'a' + String(i).padStart(5, '0') + '@t,fr';
    // Une série vivante, pas encore validée cette semaine, une séance il y a
    // trois jours (ni « ancienne » pour la série, ni due pour le retour).
    users[k] = { coachEmailKey: K, fname: 'A' + i, streak: 3, streakWeek: '2026-09-21', lastSession: t - 3 * 864e5 };
    push[k] = { x: Object.assign({}, MODELES[i % 8].abonnement, { endpoint: 'https://push.test/' + i }) };
    annuaire[k] = { email: k };
  }
  return { users, push, annuaire_coach: { [K]: annuaire },
    canaux: { [K]: { messages: { m1: { type: 'defi', titre: 'Défi', mesure: 'seances', objectif: 12, debut: t, fin: t + 7 * 864e5 } } } } };
}

async function simuler(n, scenario) {
  const t0 = scenario === 'defi' ? PARIS('2026-09-28T12:00:00') : PARIS('2026-10-01T17:00:30');   // un lundi ; un jeudi (la série part à 17 h)
  const init = donnees(n, t0);
  // Les autres travaux du jour sont faits : on mesure ce chemin-là seul.
  const jour = t0 ? new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris' }).format(new Date(t0)) : '';
  init.worker = { jobs: Object.fromEntries(['stats_badges', 'ambassadeurs', 'fins_coachs', 'attente', 'defis', 'acces']
    .map((j) => [j, { jour, fini: true }])) };
  if (scenario === 'defi') init.evenements = { e0000000001: { type: 'defi_publie', par: K, msg: 'm1', cible: 'm1', at: t0 } };
  const F = fausseBase(init);
  let n0 = 0, horloge = t0, cpuBase = 0;
  // Le temps passé DANS la base simulée est décompté : il n'existe pas dans
  // un Worker (là, c'est une attente réseau, qui ne compte pas).
  const f = (u, i) => { n0++; const a = process.cpuUsage(); const r = F.fetchImpl(u, i); const d = process.cpuUsage(a); cpuBase += (d.user + d.system) / 1000; return r; };
  const db = creerBase({ url: 'https://base.test', auth: 's', fetchImpl: f });
  const M = creerMetier({ db, vapid: VAPID, fetchImpl: f, maintenant: () => horloge });
  M.coachsEtUsers = () => db.ref('users').shallow();
  const reveils = [];
  for (let i = 0; i < 5000; i++) {
    n0 = 0; cpuBase = 0;
    const c0 = process.cpuUsage();
    const b = await minute({ db, M, compteur: () => n0, maintenant: () => horloge });
    const c = process.cpuUsage(c0);
    reveils.push({ requetes: b.requetes, chiffrements: b.chiffrements, cpu: Math.max(0, (c.user + c.system) / 1000 - cpuBase) });
    assert.ok(b.requetes <= 50, n + ' / ' + scenario + ' : ' + b.requetes + ' requêtes au réveil ' + i);
    assert.ok(b.chiffrements <= MAX_CHIFFREMENTS, n + ' / ' + scenario + ' : ' + b.chiffrements + ' chiffrements');
    // Fini : la file vidée (défi), le travail du jeudi bouclé (série).
    if (scenario === 'defi' ? !F.lire('evenements') : F.lire('worker/jobs/serie/fini')) break;
    horloge += 60e3;
    // La série s'arrête à 21 h : ce qui n'est pas parti est compté dans `sautes`.
    if (scenario === 'serie' && (F.lire('worker/jobs/serie/sautes') != null
      || new Date(horloge).toLocaleDateString('fr-CA', { timeZone: 'Europe/Paris' }) !== jour)) break;
  }
  assert.equal(new Set(F.recus.map((r) => r.endpoint)).size, F.recus.length, 'jamais deux fois');
  // Le défi passe par la file : ce qui tombe après 21 h attend 8 h 05, rien ne se perd.
  if (scenario === 'defi') assert.equal(F.recus.length, n, 'tout le monde reçoit');
  const cpu = reveils.map((r) => r.cpu).sort((a, b) => a - b);
  return { n, scenario, reveils: reveils.length, servis: F.recus.length,
    finParis: new Date(horloge).toLocaleTimeString('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' }), requetesMax: Math.max(...reveils.map((r) => r.requetes)),
    requetesTotal: reveils.reduce((a, r) => a + r.requetes, 0), chiffrementsMax: Math.max(...reveils.map((r) => r.chiffrements)),
    cpuMedian: cpu[Math.floor(cpu.length / 2)], cpuMax: cpu[cpu.length - 1] };
}

// Le chiffrement seul, par message (RFC 8291 : paire ECDH, HKDF, AES-GCM).
const ua = crypto.createECDH('prime256v1'); ua.generateKeys();
const p256 = ua.getPublicKey().toString('base64url'), auth = crypto.randomBytes(16).toString('base64url');
for (let i = 0; i < 20; i++) await chiffrer('{"title":"x"}', p256, auth);
const c0 = process.cpuUsage();
for (let i = 0; i < 200; i++) await chiffrer(JSON.stringify({ title: 'Nouveau défi : 12 séances', body: 'x'.repeat(120), url: './?canal=1', tag: 'defi-m1', type: 'defi' }), p256, auth);
const c1 = process.cpuUsage(c0);
const msPush = (c1.user + c1.system) / 1000 / 200;

const lignes = [];
for (const n of TAILLES) for (const s of ['defi', 'serie']) lignes.push(await simuler(n, s));


// ══ LES ÉPREUVES DU 01/10/2026 ═════════════════════════════════════════════
// Un monde complet : la base, le compteur de la minute, le métier.
function monde(init, t0) {
  const F = fausseBase(init);
  let n0 = 0, horloge = t0, total = 0;
  const f = (u, i) => { n0++; total++; return F.fetchImpl(u, i); };
  const db = creerBase({ url: 'https://base.test', auth: 's', fetchImpl: f });
  const M = creerMetier({ db, vapid: VAPID, fetchImpl: f, maintenant: () => horloge });
  M.coachsEtUsers = () => db.ref('users').shallow();
  return { F, db, M, get t() { return horloge; }, avance() { horloge += 60e3; }, total: () => total,
    async minute() { n0 = 0; const b = await minute({ db, M, compteur: () => n0, maintenant: () => horloge }); return b; } };
}
const heureParis = (t) => new Date(t).toLocaleTimeString('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' });
const servisDe = (F) => new Set(F.recus.map((r) => r.endpoint));
const epreuves = [];

// (a) TOUS LES TRAVAUX, JEUDI 18 H, 300 ABONNÉS, RIEN DE PRÉ-MARQUÉ.
{
  const N = 300, t0 = PARIS('2026-10-01T18:00:30');
  const w = monde(donnees(N, t0), t0);
  let max = 0, fin = null, minutes = 0;
  while (minutes < 300) {
    const b = await w.minute();
    max = Math.max(max, b.requetes);
    assert.ok(b.requetes <= 50, '(a) ' + b.requetes + ' requêtes à ' + heureParis(w.t));
    minutes++;
    if (w.F.lire('worker/jobs/serie/fini') && !fin) { fin = w.t; break; }
    w.avance();
  }
  const servis = servisDe(w.F).size;
  assert.equal(servis, N, '(a) ' + servis + '/' + N + ' servis, série ' + JSON.stringify(w.F.lire('worker/jobs/serie')));
  assert.ok(fin && heureParis(fin) < '21:00', '(a) fini à ' + (fin ? heureParis(fin) : 'jamais'));
  assert.equal(w.F.recus.length, N, '(a) jamais deux fois');
  epreuves.push('(a) tous les travaux, jeudi 18 h, ' + N + ' abonnés : ' + servis + '/' + N + ' servis, fini à ' + heureParis(fin)
    + ', ' + minutes + ' réveils, au plus ' + max + ' requêtes par réveil, ' + w.total() + ' en tout');
  console.log('ok   ' + epreuves[epreuves.length - 1]);
}

// (b) LA FENÊTRE DE 21 H : la série commence trop tard pour tout le monde.
{
  const N = 300, t0 = PARIS('2026-10-01T20:40:30');
  const init = donnees(N, t0);
  // Les autres travaux du jour sont faits : seule la série reste.
  const jour = '2026-10-01';
  init.worker = { jobs: Object.fromEntries(['stats_badges', 'ambassadeurs', 'fins_coachs', 'attente', 'defis', 'acces', 'retour', 'relances',
    'sante_rappel', 'accueil', 'parcours', 'duels', 'reactions', 'retention', 'wrapped', 'purge_paypal'].map((j) => [j, { jour, fini: true }])) };
  const w = monde(init, t0);
  for (let m = 0; m < 30; m++) { const b = await w.minute(); assert.ok(b.requetes <= 50, '(b) ' + b.requetes); w.avance(); }
  const job = w.F.lire('worker/jobs/serie');
  assert.ok(job && !job.fini, '(b) la série ne doit pas être déclarée finie : ' + JSON.stringify(job));
  assert.equal(job.sautes, N - job.curseur, '(b) sautes = clés restantes');
  assert.ok(job.sautes > 0, '(b) la fenêtre devait se fermer avant la fin');
  // Chaque athlète PASSÉ (clé <= dernier) a reçu son push ; aucun au-delà.
  const cles = Object.keys(init.push).sort();
  const parAthlete = new Map(cles.map((k, i) => [k, 'https://push.test/' + Number(k.slice(1, 6))]));
  const recus = servisDe(w.F);
  const passes = cles.filter((k) => k <= job.dernier);
  assert.equal(passes.length, job.curseur);
  for (const k of passes) assert.ok(recus.has(parAthlete.get(k)), '(b) ' + k + ' compté traité sans push');
  for (const k of cles.filter((k) => k > job.dernier)) assert.ok(!recus.has(parAthlete.get(k)), '(b) ' + k + ' servi après 21 h');
  const ko = Object.values(w.F.lire('evenements_ko') || {}).filter((e) => e.type === 'travail_incomplet');
  assert.equal(ko.length, 1, '(b) une seule ligne travail_incomplet');
  assert.equal(ko[0].nom, 'serie'); assert.equal(ko[0].sautes, job.sautes);
  epreuves.push('(b) fenêtre de 21 h : ' + job.curseur + ' servis, ' + job.sautes + ' sautés et consignés, aucun compté sans push');
  console.log('ok   ' + epreuves[epreuves.length - 1]);
}

// (c) LA TENUE DE LIVRE : base vide, une journée entière (un jeudi 1er du
//     mois : le plus de travaux possible), la minute ET l'alerte de quota.
{
  const t0 = PARIS('2026-10-01T00:00:10');
  const w = monde({}, t0);
  let max = 0;
  for (let m = 0; m < 1440; m++) {
    const b = await w.minute();
    max = Math.max(max, b.requetes);
    assert.ok(b.requetes <= 50, '(c) ' + b.requetes);
    await surveillerQuota({ db: w.db, M: w.M, t: w.t });
    w.avance();
  }
  assert.ok(w.total() < 8000, '(c) ' + w.total() + ' sous-requêtes dans la journée');
  epreuves.push('(c) base vide, 1 440 minutes : ' + w.total() + ' sous-requêtes (moins de 8 000), au plus ' + max + ' par réveil');
  console.log('ok   ' + epreuves[epreuves.length - 1]);
}

console.log('\nChiffrement d’un push (Node) : ' + msPush.toFixed(2) + ' ms ; au plus ' + MAX_CHIFFREMENTS + ' par réveil = '
  + (msPush * MAX_CHIFFREMENTS).toFixed(1) + ' ms (plafond du plan gratuit : 10 ms).');
console.log('Budget : ' + BUDGET + ' requêtes par réveil (plafond 50), ~' + COUT_PUSH + ' par push.\n');
console.log('| abonnés | chemin | réveils (minutes) | fini à | servis | requêtes max / réveil | requêtes en tout | chiffrements max / réveil | calcul médian / max |');
console.log('|---|---|---|---|---|---|---|---|---|');
for (const l of lignes)
  console.log('| ' + l.n + ' | ' + (l.scenario === 'defi' ? 'défi publié (12 h)' : 'série (jeudi 17 h)') + ' | ' + l.reveils + ' | ' + l.finParis
    + ' | ' + l.servis + ' | ' + l.requetesMax + ' | ' + l.requetesTotal + ' | ' + l.chiffrementsMax + ' | '
    + l.cpuMedian.toFixed(1) + ' / ' + l.cpuMax.toFixed(1) + ' ms |');
console.log('\n' + lignes.length + ' simulations : jamais plus de 50 requêtes ni de ' + MAX_CHIFFREMENTS + ' chiffrements par réveil, personne servi deux fois.');
for (const e of epreuves) console.log(e);
