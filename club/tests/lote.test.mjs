// Lot E (résiliations : import Resamania, phases, sauvetage, relève de la boîte accueil). Vrai code de l'appli.
//   TZ=Europe/Paris node --test club/tests/lote.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { chargerAppli } from '../outils/fitpulse-rapport.mjs';

const base = (extra = {}) => ({ clubs: { k: { id: 'k', name: 'Club' } }, users: { u: { id: 'u', first: 'Alex', last: 'M', role: 'manager', status: 'active', clubs: ['k'] }, v: { id: 'v', first: 'Sam', last: 'B', role: 'membre', status: 'active', clubs: ['k'] } }, ...extra });
const appli = (extra) => { const run = chargerAppli(base(extra)); run(`CLUB = S.clubs.k; ME = S.users.u;`); return run; };
const J = (run, code) => JSON.parse(run(`JSON.stringify(${code})`));
// Import d'un fichier Resamania par le vrai chemin (analyse puis plan d'écriture), appliqué à S.
const importer = (run, csv) => run(`(() => { const t = { name: 'RSM_resiliations.csv', ...parseCSV(${JSON.stringify(csv)}) }; const B = [analyzeTable(t, { clubId: 'k', month: curMonth() })];
  if (!B[0].def || B[0].def.id !== 'resil') throw new Error('fichier non reconnu : ' + (B[0].def && B[0].def.id)); const P = rsmCommitPlan(B, { club: 'k', by: 'u' }); db.batch(P.ops || P); REV++; return Object.keys(S.resiliations).length; })()`);
const ENTETE = 'Date de création;Etat;Motif;Créateur;Nom;Prénom';
const hier = run => run(`addDays(today(), -1)`);
const jj = iso => iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4);

test('import : Etat submitted, créée hier, sans date effective : dossier « nouvelle » visible dans À traiter', () => {
  const run = appli({});
  importer(run, `${ENTETE}\n${jj(hier(run))};submitted;Prix;Alex M;MARTIN;Léa\n`);
  const r = J(run, `Object.values(S.resiliations)[0]`);
  assert.equal(r.status, 'nouvelle'); assert.equal(r.rsm.state, 'submitted'); assert.equal(r.source, 'resamania');
  assert.equal(J(run, `resToHandle('k').length`), 1); assert.equal(run(`resPhase(Object.values(S.resiliations)[0])`), 'attente');
  assert.equal(r.receivedAt, run(`minuitParis(addDays(today(), -1))`), 'réception : minuit à Paris de la date de création');
});
test('import : un dossier en traitement garde son statut, r.at reste l’heure de création', () => {
  const run = appli({}); const csv = `${ENTETE}\n${jj(hier(run))};submitted;Prix;Alex M;MARTIN;Léa\n`;
  importer(run, csv); const id = run(`Object.keys(S.resiliations)[0]`); const at0 = run(`S.resiliations['${id}'].at`);
  run(`S.resiliations['${id}'].status = 'traitement'; S.resiliations['${id}'].ownerId = 'v'; REV++`);
  importer(run, csv); assert.equal(run(`S.resiliations['${id}'].status`), 'traitement'); assert.equal(run(`S.resiliations['${id}'].ownerId`), 'v'); assert.equal(run(`S.resiliations['${id}'].at`), at0);
});
test('import : états accepted, canceled, rejected et vide', () => {
  const run = appli({}); const d = hier(run); const passe = run(`addDays(today(), -3)`); const futur = run(`addDays(today(), 20)`);
  importer(run, `${ENTETE};Date d'effet\n${jj(d)};accepted;Prix;Alex M;A;Un;${jj(passe)}\n${jj(d)};accepted;Santé;Alex M;B;Deux;${jj(futur)}\n${jj(d)};canceled;Prix;Alex M;C;Trois;\n${jj(d)};rejected;Prix;Alex M;D;Quatre;\n${jj(d)};;Prix;Alex M;E;Cinq;\n`);
  const L = J(run, `Object.fromEntries(Object.values(S.resiliations).map(r => [r.client, [r.status, r.rsm.state]]))`);
  assert.deepEqual(L, { 'Un A': ['resiliee', 'accepted'], 'Deux B': ['nouvelle', 'accepted'], 'Trois C': ['sauvee', 'canceled'], 'Cinq E': ['nouvelle', 'submitted'] });
});
test('fusion des statuts : jamais de rétrogradation', () => {
  const run = appli({});
  assert.deepEqual(J(run, `[resStatutFusion('traitement', 'nouvelle'), resStatutFusion('sauvee', 'nouvelle'), resStatutFusion('resiliee', 'sauvee'), resStatutFusion('traitement', 'sauvee'), resStatutFusion('nouvelle', 'resiliee')]`), ['traitement', 'sauvee', 'resiliee', 'sauvee', 'resiliee']);
});
test('appli : accepted, Canal member, date d’effet dans 20 jours : « nouvelle », badge Appli et mention', () => {
  const run = appli({}); const futur = run(`addDays(today(), 20)`);
  importer(run, `${ENTETE};Canal de saisie;Date d'effet\n${jj(hier(run))};accepted;Prix;Alex M;MARTIN;Léa;member;${jj(futur)}\n`);
  const r = J(run, `Object.values(S.resiliations)[0]`); assert.equal(r.status, 'nouvelle'); assert.equal(r.source, 'appli'); assert.equal(r.channel, 'member');
  const h = run(`resCard(Object.values(S.resiliations)[0])`);
  assert.match(h, /data-badge="appli">Appli</); assert.match(h, new RegExp(`Acceptée dans Resamania, effective le ${futur.slice(8, 10)}/${futur.slice(5, 7)} : appeler avant`)); assert.match(h, /ph-attente/);
});
test('colonnes facultatives : numéro client et date de réception', () => {
  const run = appli({}); const rec = run(`addDays(today(), -4)`);
  importer(run, `${ENTETE};Numéro client;Date de réception\n${jj(hier(run))};submitted;Prix;Alex M;MARTIN;Léa;520777;${jj(rec)}\n`);
  const r = J(run, `Object.values(S.resiliations)[0]`); assert.equal(r.clientNum, '520777'); assert.equal(r.receivedAt, run(`minuitParis('${rec}')`));
  assert.match(J(run, `RSM_DEFS.find(d => d.id === 'resil').note`), /Ajoutez la colonne Canal de saisie si elle est disponible/);
});
test('prise en charge : reçu lundi 9 h, appelé lundi 15 h : 0,25 j', () => {
  const run = appli({}); const lun9 = Date.UTC(2026, 9, 12, 7); // lundi 12 octobre 2026, 9 h à Paris
  run(`S.resiliations.r1 = { id: 'r1', clubId: 'k', client: 'A', date: '2026-10-12', status: 'traitement', receivedAt: ${lun9}, log: { a: { at: ${lun9 + 3600000}, by: 'u', label: 'Prise en charge' }, b: { at: ${lun9 + 6 * 3600000}, by: 'u', label: 'Pas de réponse' } } }; REV++`);
  assert.equal(run(`resDelai(S.resiliations.r1)`), 0.25);
  run(`S.resiliations.r2 = { id: 'r2', clubId: 'k', client: 'B', date: '2026-10-12', status: 'nouvelle', receivedAt: ${lun9}, actions: [{ at: ${lun9 + 600000}, by: 'u', label: 'Demande enregistrée' }] }; REV++`);
  assert.equal(run(`resDelai(S.resiliations.r2)`), null);
});
test('phases : rouge en attente, orange après la réponse, rouge si l’adhérent réécrit', () => {
  const run = appli({}); const t = Date.now() - 864e5;
  run(`S.resiliations.m1 = { id: 'm1', clubId: 'k', client: 'A', date: today(), status: 'nouvelle', receivedAt: ${t}, mail: { threadId: 'x', firstInAt: ${t}, lastInAt: ${t}, awaitingReply: true } };
    S.resiliations.o1 = { id: 'o1', clubId: 'k', client: 'B', date: today(), status: 'traitement', receivedAt: ${t - 9e6}, effective: addDays(today(), 3), log: { a: { at: ${t}, by: 'u', label: 'Message laissé' } } }; REV++`);
  assert.equal(run(`resPhase(S.resiliations.m1)`), 'attente'); assert.equal(run(`resPhase(S.resiliations.o1)`), 'encours');
  assert.deepEqual(J(run, `resToHandle('k').sort((a, b) => (resPhase(a) === 'attente' ? 0 : 1) - (resPhase(b) === 'attente' ? 0 : 1)).map(r => r.id)`), ['m1', 'o1']);
  assert.match(run(`resCard(S.resiliations.m1)`), /ph-attente/); assert.match(run(`resCard(S.resiliations.o1)`), /ph-encours/);
  run(`Object.assign(S.resiliations.m1.mail, { awaitingReply: false, firstReplyAt: ${t + 3600000}, lastOutAt: ${t + 3600000} }); REV++`); assert.equal(run(`resPhase(S.resiliations.m1)`), 'encours');
  run(`Object.assign(S.resiliations.m1.mail, { lastInAt: ${t + 7200000} }); REV++`); assert.equal(run(`resPhase(S.resiliations.m1)`), 'attente');
  run(`S.resiliations.m1.outcome = 'faux_positif'; REV++`); assert.equal(run(`resPhase(S.resiliations.m1)`), 'close');
});
test('dossiers de démonstration : toutes les cartes s’affichent', () => {
  const run = chargerAppli('demo'); run(`CLUB = S.clubs.horizon; ME = S.users.u1;`);
  const n = run(`resList('horizon').filter(resOpen).map(resCard).filter(h => /class="card dossier ph-(attente|encours)"/.test(h)).length`);
  assert.ok(n >= 9, `${n} cartes`); assert.equal(run(`resList('horizon').filter(r => r.mail && resPhase(r) === 'attente').length`), 1);
});
test('sauvetage : déclaratif, confirmé par Resamania, « À confirmer » après 15 jours', () => {
  const run = appli({});
  run(`S.resiliations.r1 = { id: 'r1', clubId: 'k', client: 'Léa Martin', date: addDays(today(), -20), status: 'sauvee', saved: true, ownerId: 'v' };
    S.entries.sv_r1 = { id: 'sv_r1', userId: 'v', clubId: 'k', kpiId: 'sauvetage', date: addDays(today(), -20), value: 1, source: 'manual', at: Date.now() - 20 * 864e5, proof: 'declaratif' }; REV++`);
  assert.equal(run(`resAConfirmer(S.resiliations.r1)`), true); assert.equal(run(`sumRange('k', 'v', 'sauvetage', addDays(today(), -30), today())`), 1);
  run(`S.entries.sv_r1.at = Date.now() - 5 * 864e5; REV++`); assert.equal(run(`resAConfirmer(S.resiliations.r1)`), false);
  // l'import qui lit « canceled » pour ce dossier confirme le sauvetage
  const run2 = appli({}); const d = hier(run2); const csv = `${ENTETE}\n${jj(d)};submitted;Prix;Alex M;MARTIN;Léa\n`;
  importer(run2, csv); const id = run2(`Object.keys(S.resiliations)[0]`);
  run2(`S.resiliations['${id}'].status = 'sauvee'; S.entries['sv_${id}'] = { id: 'sv_${id}', userId: 'v', clubId: 'k', kpiId: 'sauvetage', date: today(), value: 1, at: Date.now() - 20 * 864e5, proof: 'declaratif' }; REV++`);
  assert.equal(run2(`resAConfirmer(S.resiliations['${id}'])`), true);
  importer(run2, csv.replace('submitted', 'canceled'));
  assert.equal(run2(`S.entries['sv_${id}'].proof`), 'resamania'); assert.equal(run2(`resAConfirmer(S.resiliations['${id}'])`), false);
});
test('module Résiliations : aucun emoji, aucun tiret cadratin ni demi-cadratin dans les chaînes', () => {
  for (const f of ['pages-ops.js', 'resamania.js', 'pages-resamania.js', 'demandes.js', 'releve.js', 'moteur-mail.js', 'apps-script/Code.gs', 'apps-script/README.txt']) {
    const s = readFileSync(new URL('../' + f, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    assert.doesNotMatch(s, /\p{Extended_Pictographic}/u, f); assert.doesNotMatch(s.replace(/\/\/.*$/gm, ''), /[–—]/, f);
  }
  const run = chargerAppli(base()); assert.equal(run(`S.kpis.sauvetage.emoji || ''`), '');
});
test('moteur de détection : critères du banc d’essai', () => {
  const M = createRequire(import.meta.url)('../moteur-mail.js');
  const a = M.testMailRules('Objet : Résiliation. Bonjour, je souhaite mettre fin à mon abonnement, je déménage. N° client 123456');
  assert.equal(a.score, 7); assert.equal(a.kind, 'adherent'); assert.equal(a.motif, 'Déménagement'); assert.equal(a.clientNum, '123456'); assert.equal(a.type, 'resiliation');
  const b = M.testMailRules('De : Lettre du club <news@marque.fr>\nObjet : Newsletter d’octobre\nNos conseils sur la résiliation de vos contrats. Pour vous désabonner : se désabonner.');
  assert.ok(b.score < b.seuil, `score ${b.score}`);
  const s = M.testMailRules('Objet : Pause\nBonjour, je voudrais mettre en pause mon abonnement pendant deux mois.');
  assert.equal(s.type, 'suspension');
  assert.match(M.blocScript(null, { endpoint: 'https://x', clubId: 'niort' }), /const CFG = \{[\s\S]*CLUB_ID: "niort"[\s\S]*const RULES = \[/);
});
