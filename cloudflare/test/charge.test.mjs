// CHARGE SIMULÉE : 10, 100 et 1 000 abonnés aux notifications, sur la base en
// mémoire. Deux chemins : un défi publié à toute l'équipe (la file et ses
// sous-tâches) et la série du jeudi (un travail planifié, par lots).
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
    users[k] = { coachEmailKey: K, fname: 'A' + i, streak: 3, streakWeek: '2026-09-14' };
    push[k] = { x: Object.assign({}, MODELES[i % 8].abonnement, { endpoint: 'https://push.test/' + i }) };
    annuaire[k] = { email: k };
  }
  return { users, push, annuaire_coach: { [K]: annuaire },
    canaux: { [K]: { messages: { m1: { type: 'defi', titre: 'Défi', mesure: 'seances', objectif: 12, debut: t, fin: t + 7 * 864e5 } } } } };
}

async function simuler(n, scenario) {
  const t0 = scenario === 'defi' ? PARIS('2026-09-28T12:00:00') : PARIS('2026-10-01T18:00:30');   // un lundi ; un jeudi
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
  const f = (u, i) => { n0++; const a = performance.now(); const r = F.fetchImpl(u, i); cpuBase += performance.now() - a; return r; };
  const db = creerBase({ url: 'https://base.test', auth: 's', fetchImpl: f });
  const M = creerMetier({ db, vapid: VAPID, fetchImpl: f, maintenant: () => horloge });
  M.coachsEtUsers = () => db.ref('users').shallow();
  const reveils = [];
  const jourDe = (h) => new Date(h).toLocaleDateString('fr-CA', { timeZone: 'Europe/Paris' });
  let jourCourant = jour, servisLeJour = null;
  for (let i = 0; i < 5000; i++) {
    // Le lendemain de la série, les autres travaux sont faits aussi : seuls
    // comptent les rappels mis de côté pour 8 h 05.
    if (jourDe(horloge) !== jourCourant) {
      jourCourant = jourDe(horloge);
      if (servisLeJour === null) servisLeJour = F.recus.length;
      for (const j of ['stats_badges', 'ambassadeurs', 'fins_coachs', 'defis', 'acces']) F.ecrire('worker/jobs/' + j, { jour: jourCourant, fini: true });
    }
    n0 = 0; cpuBase = 0;
    // L'horloge fine plutôt que process.cpuUsage (15,6 ms de résolution sous
    // Windows) : rien n'attend le réseau ici, le temps écoulé est du calcul.
    const c0 = performance.now();
    const b = await minute({ db, M, compteur: () => n0, maintenant: () => horloge });
    reveils.push({ requetes: b.requetes, chiffrements: b.chiffrements, cpu: Math.max(0, performance.now() - c0 - cpuBase) });
    assert.ok(b.requetes <= 50, n + ' / ' + scenario + ' : ' + b.requetes + ' requêtes au réveil ' + i);
    assert.ok(b.chiffrements <= MAX_CHIFFREMENTS, n + ' / ' + scenario + ' : ' + b.chiffrements + ' chiffrements');
    // Fini : la file vidée (défi) ; la série du jeudi bouclée, et ce qu'elle a
    // mis de côté pour la nuit parti le lendemain matin.
    const vide = !F.lire('evenements') && !F.lire('push_attente');
    if (scenario === 'defi' ? vide : (F.lire('worker/jobs/serie/jour') === jour && F.lire('worker/jobs/serie/fini') && vide)) break;
    horloge += 60e3;
  }
  assert.equal(new Set(F.recus.map((r) => r.endpoint)).size, F.recus.length, 'jamais deux fois');
  // Ce qui tombe après 21 h attend 8 h 05 : rien ne se perd.
  assert.equal(F.recus.length, n, 'tout le monde reçoit');
  const lendemain = jourDe(horloge) !== jour;
  const cpu = reveils.map((r) => r.cpu).sort((a, b) => a - b);
  return { n, scenario, reveils: reveils.length, servis: F.recus.length, servisLeJour: lendemain ? servisLeJour : null,
    finParis: (lendemain ? 'lendemain ' : '') + new Date(horloge).toLocaleTimeString('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' }), requetesMax: Math.max(...reveils.map((r) => r.requetes)),
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

console.log('\nChiffrement d’un push (Node) : ' + msPush.toFixed(2) + ' ms ; au plus ' + MAX_CHIFFREMENTS + ' par réveil = '
  + (msPush * MAX_CHIFFREMENTS).toFixed(1) + ' ms (plafond du plan gratuit : 10 ms).');
console.log('Budget : ' + BUDGET + ' requêtes par réveil (plafond 50), ~' + COUT_PUSH + ' par push.\n');
console.log('| abonnés | chemin | réveils (minutes) | fini à | servis | requêtes max / réveil | requêtes en tout | chiffrements max / réveil | calcul médian / max |');
console.log('|---|---|---|---|---|---|---|---|---|');
for (const l of lignes)
  console.log('| ' + l.n + ' | ' + (l.scenario === 'defi' ? 'défi publié (12 h)' : 'série (jeudi 18 h)') + ' | ' + l.reveils + ' | ' + l.finParis
    + ' | ' + l.servis + (l.servisLeJour !== null ? ' (' + l.servisLeJour + ' le jour même)' : '') + ' | ' + l.requetesMax + ' | ' + l.requetesTotal + ' | ' + l.chiffrementsMax + ' | '
    + l.cpuMedian.toFixed(1) + ' / ' + l.cpuMax.toFixed(1) + ' ms |');
console.log('\n' + lignes.length + ' simulations : jamais plus de 50 requêtes ni de ' + MAX_CHIFFREMENTS + ' chiffrements par réveil, personne servi deux fois.');
