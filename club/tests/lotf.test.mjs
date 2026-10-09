// Lot F (résiliations : à vérifier, rattachement client, doublons, clôture automatique, carte, modèles,
// données privées, indicateurs, démonstration). Vrai code de l'appli.
//   TZ=Europe/Paris node --test club/tests/lotf.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chargerAppli } from '../outils/fitpulse-rapport.mjs';

const base = (extra = {}) => ({ clubs: { k: { id: 'k', name: 'Club' } }, users: { u: { id: 'u', first: 'Alex', last: 'M', role: 'manager', status: 'active', clubs: ['k'] }, v: { id: 'v', first: 'Sam', last: 'B', role: 'membre', status: 'active', clubs: ['k'] } }, ...extra });
const appli = (extra) => { const run = chargerAppli(base(extra)); run(`CLUB = S.clubs.k; ME = S.users.u; toast = () => {}; resToastUndo = () => {};`); return run; };
const J = (run, code) => JSON.parse(run(`JSON.stringify(${code})`));
const importer = (run, csv) => run(`(() => { const t = { name: 'RSM_resiliations.csv', ...parseCSV(${JSON.stringify(csv)}) }; const B = [analyzeTable(t, { clubId: 'k', month: curMonth() })];
  const P = rsmCommitPlan(B, { club: 'k', by: 'u' }); db.batch(P.ops); resDedupe('k'); resAutoClose('k'); REV++; return P.summary; })()`);
const jj = iso => iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4);
const H = 3600000;
// Dossier relevé dans la boîte accueil (même forme que la fonction ingestResiliations).
const mailDossier = (id, o = {}) => ({ id, clubId: 'k', client: 'Paul Exemple', date: '2026-10-01', status: 'nouvelle', source: 'mail', receivedAt: Date.now() - 2 * H, mail: { threadId: 't' + id, link: 'https://mail.google.com/x', subject: 'Résiliation', firstInAt: Date.now() - 2 * H, lastInAt: Date.now() - 2 * H, awaitingReply: true, inCount: 1, outCount: 0 }, ...o });

test('à vérifier : onglet « À vérifier (N) », « C’est une demande » et « Ignorer »', () => {
  const run = appli({ resiliations: { a: mailDossier('a', { status: 'averifier' }), b: mailDossier('b', { status: 'averifier', client: 'Léa Exemple' }) } });
  let h = run(`PAGES.resiliations.render()`); assert.match(h, /À vérifier \(2\)/); assert.match(h, /À traiter \(0\)/);
  run(`UI.resTab = 'verif'`); h = run(`PAGES.resiliations.render()`); assert.match(h, /C’est une demande/); assert.match(h, /Ignorer/);
  run(`ACTIONS.resVerifOui({ dataset: { id: 'a' } }); ACTIONS.resVerifNon({ dataset: { id: 'b' } })`);
  assert.equal(run(`S.resiliations.a.status`), 'nouvelle'); assert.equal(run(`resPhase(S.resiliations.a)`), 'attente');
  assert.equal(run(`S.resiliations.b.outcome`), 'faux_positif'); assert.equal(run(`S.resiliations.b.hidden`), true);
  assert.equal(J(run, `resList('k').map(r => r.id)`).join(), 'a');
});
test('suspension : badge « Suspension » et bouton « Valider la suspension »', () => {
  const run = appli({ resiliations: { s: mailDossier('s', { type: 'suspension' }) } });
  const h = run(`resCard(S.resiliations.s)`); assert.match(h, />Suspension</); assert.match(h, /Valider la suspension/); assert.doesNotMatch(h, /Valider la résiliation/);
});
test('rattachement : e-mail du client, lien automatique et téléphone sur la carte', () => {
  const run = appli({ clients: { c1: { id: 'c1', clubId: 'k', name: 'P. Exemple', email: 'paul.exemple@mail.fr', phone: '0611223344' } } });
  assert.deepEqual(J(run, `RES_ENGINE.matchClient(S.clients, 'k', { email: 'Paul.Exemple@mail.fr', name: 'Paul X' })`), { clientId: 'c1', confidence: 'forte', candidates: ['c1'] });
  run(`S.resiliations.m = ${JSON.stringify(mailDossier('m'))}; Object.assign(S.resiliations.m, resLienAuto('k', { email: 'paul.exemple@mail.fr', name: 'Paul Exemple' })); REV++`);
  assert.equal(run(`S.resiliations.m.clientId`), 'c1');
  const h = run(`resCard(S.resiliations.m)`); assert.match(h, /href="#\/client\/c1"/); assert.match(h, /data-tel="1">06 11 22 33 44</);
});
test('homonymes : deux « Martin Durand », aucun lien, deux suggestions', () => {
  const run = appli({ clients: { a: { id: 'a', clubId: 'k', name: 'Martin Durand' }, b: { id: 'b', clubId: 'k', name: 'DURAND Martin' } } });
  const m = J(run, `RES_ENGINE.matchClient(S.clients, 'k', { name: 'Martin Durand' })`); assert.equal(m.clientId, null); assert.equal(m.candidates.length, 2);
  run(`S.resiliations.d = ${JSON.stringify(mailDossier('d', { client: 'Martin Durand' }))}; REV++`);
  const h = run(`resCard(S.resiliations.d)`); assert.match(h, /Associer à :/); assert.equal((h.match(/data-act="resAssoc"/g) || []).length, 2); assert.match(h, /Créer la fiche/);
  run(`ACTIONS.resAssoc({ dataset: { id: 'd', c: 'b' } })`); assert.equal(run(`S.resiliations.d.clientId`), 'b'); assert.equal(run(`S.resiliations.d.clientConfidence`), 'forte');
});
test('un e-mail puis l’import Resamania du même client 5 jours plus tard : un seul dossier, « E-mail, Resamania »', () => {
  const run = appli({}); const j5 = run(`addDays(today(), -5)`);
  run(`S.resiliations.m = ${JSON.stringify(mailDossier('m', { client: 'Paul Exemple', date: '__' }))}; S.resiliations.m.date = '${j5}'; S.resiliations.m.receivedAt = minuitParis('${j5}') + 10 * 3600000; REV++`);
  const d = run(`today()`);
  importer(run, `Date de création;Etat;Motif;Créateur;Nom;Prénom\n${jj(d)};submitted;Prix;Alex M;EXEMPLE;Paul\n`);
  assert.equal(J(run, `resList('k').length`), 1); assert.equal(run(`S.resiliations.m.rsm.state`), 'submitted');
  assert.equal(run(`RES_ENGINE.sourceLabel(S.resiliations.m)`), 'E-mail, Resamania'); assert.match(run(`resCard(S.resiliations.m)`), /E-mail<\/span><span class="badge src" data-badge="src-resamania">Resamania/);
  // Doublon tardif (deux dossiers ouverts du même client) : fusion dans le plus ancien.
  run(`S.resiliations.x = { id: 'x', clubId: 'k', client: 'Paul Exemple', clientId: 'c9', status: 'nouvelle', receivedAt: Date.now(), source: 'accueil', date: today() }; S.resiliations.m.clientId = 'c9'; REV++; resDedupe('k')`);
  assert.equal(run(`S.resiliations.x.outcome`), 'doublon'); assert.match(J(run, `resActions(S.resiliations.m).map(a => a.label)`).join('|'), /Dossier fusionné \(source : Accueil\)/);
});
test('clôture automatique : Etat canceled ferme en « Sauvée » avec « Sauvetage confirmé par Resamania »', () => {
  const run = appli({}); const csv = s => `Date de création;Etat;Motif;Créateur;Nom;Prénom\n${jj(run('today()'))};${s};Prix;Alex M;MARTIN;Léa\n`;
  importer(run, csv('submitted')); const id = run(`Object.keys(S.resiliations)[0]`); run(`S.resiliations['${id}'].ownerId = 'v'; REV++`);
  importer(run, csv('canceled'));
  const r = J(run, `S.resiliations['${id}']`); assert.equal(r.status, 'sauvee'); assert.equal(r.outcome, 'sauvee'); assert.equal(r.closedReason, 'resamania');
  assert.ok(J(run, `resActions(S.resiliations['${id}']).map(a => a.label)`).includes('Sauvetage confirmé par Resamania'));
  assert.equal(run(`S.entries['sv_${id}'].proof`), 'resamania'); assert.equal(run(`resFermePar(S.resiliations['${id}'])`), 'Resamania');
  run(`UI.resTab = 'all'`); assert.match(run(`PAGES.resiliations.render()`), /<th>Fermé par<\/th>[\s\S]*data-ferme-par="Resamania"/);
});
test('clôture automatique : acceptée et effective passée ; sans contact 7 jours après la date d’effet', () => {
  const run = appli({ resiliations: { a: { id: 'a', clubId: 'k', client: 'A', date: '2026-01-01', status: 'nouvelle', effective: '2026-01-31', rsm: { state: 'accepted' } }, s: { id: 's', clubId: 'k', client: 'B', date: '2026-01-01', status: 'nouvelle', effective: '2026-01-31' }, t: { id: 't', clubId: 'k', client: 'C', date: '2026-01-01', status: 'nouvelle', effective: run0() } } });
  function run0() { return '2099-01-01'; }
  run(`resAutoClose('k')`);
  assert.equal(run(`S.resiliations.a.closedReason`), 'resamania'); assert.equal(run(`S.resiliations.s.closedReason`), 'sans_contact');
  assert.ok(J(run, `resActions(S.resiliations.s).map(a => a.label)`).includes('Clôturé sans contact')); assert.equal(run(`resFermePar(S.resiliations.s)`), 'Automatique');
  assert.equal(run(`S.resiliations.t.outcome || ''`), '');
});
test('appel noté : la carte rouge devient orange ; badge de navigation 3 puis 2 après une réponse de l’accueil', () => {
  const run = appli({ resiliations: { a: mailDossier('a'), b: mailDossier('b'), c: mailDossier('c') } });
  assert.match(run(`resCard(S.resiliations.a)`), /ph-attente/); assert.deepEqual(J(run, `resCompteurs('k')`), { attente: 3, encours: 0 });
  run(`db.batch([resLogOp(S.resiliations.a, 'Pas de réponse', { out: 'noanswer' })])`);
  assert.match(run(`resCard(S.resiliations.a)`), /ph-encours/); assert.deepEqual(J(run, `resCompteurs('k')`), { attente: 2, encours: 1 });
  // Relève suivante : réponse partie depuis la boîte accueil.
  run(`Object.assign(S.resiliations.b.mail, { awaitingReply: false, lastOutAt: Date.now(), firstReplyAt: Date.now(), outCount: 1 }); REV++`);
  assert.deepEqual(J(run, `resCompteurs('k')`), { attente: 1, encours: 2 });
});
test('Valider la résiliation : la carte sort de la liste et entre dans l’historique', () => {
  const run = appli({ resiliations: { a: mailDossier('a', { effective: '2026-12-31', date: '2026-10-01' }) } });
  run(`UI.resTab = 'todo'`); assert.match(run(`PAGES.resiliations.render()`), /data-id="a"/);
  run(`resValider(S.resiliations.a, { effective: '2026-12-31', dernier: '2026-12-05', reason: 'Prix' })`);
  const r = J(run, `S.resiliations.a`); assert.equal(r.status, 'resiliee'); assert.equal(r.outcome, 'resiliee'); assert.ok(r.closedAt);
  assert.ok(J(run, `resActions(S.resiliations.a).map(a => a.label)`).includes('Résiliation validée, confirmation à envoyer'));
  assert.doesNotMatch(run(`PAGES.resiliations.render()`), /class="card dossier ph-[a-z]+" data-phase="[a-z]+" data-id="a"/);
  run(`UI.resTab = 'all'; UI.resMonth = isoOf(new Date()).slice(0, 7)`); assert.match(run(`PAGES.resiliations.render()`), /data-act="resOpen" data-id="a"/);
});
test('modèles : variables remplacées ; sans date de fin, [à compléter] et Copier désactivé', () => {
  const run = appli({ resiliations: { a: mailDossier('a', { effective: '2026-12-31', dernierPrelevement: '2026-12-05', ownerId: 'v' }), b: mailDossier('b', { ownerId: 'v' }) } });
  run(`S.clubs.k.phone = '05 00 00 00 00'; REV++`);
  const f = J(run, `resRemplir('email2', S.resiliations.a)`); assert.deepEqual(f.manquantes, []); assert.doesNotMatch(f.text, /\{|\[à compléter\]/);
  assert.match(f.text, /prendra fin le 31\/12\/2026/); assert.match(f.text, /^Bonjour Paul,/); assert.match(f.text, /Sam, Club$/);
  const g = J(run, `resRemplir('email2', S.resiliations.b)`); assert.ok(g.manquantes.includes('date_fin')); assert.match(g.html, /<mark class="tpl-manque">\[à compléter\]<\/mark>/);
  assert.match(run(`resTplMontrer(resRemplir('email2', S.resiliations.b))`), /data-act="resTplCopie" data-tpl="email2" disabled/);
  for (const k of ['sms1', 'sms2', 'sms3']) assert.ok(run(`resRemplir('${k}', S.resiliations.a, { offre: 'Suspension' }).text.length`) <= 300, k);
  assert.deepEqual(J(run, `Object.keys(RES_TEMPLATES).filter(k => resTplErreurs(k, RES_TEMPLATES[k].text).length)`), []);
  assert.ok(J(run, `resTplErreurs('email2', 'Profitez de notre offre')`).length > 0); assert.ok(J(run, `resTplErreurs('sms1', 'x'.repeat(301))`).length > 0);
});
test('indicateurs : 10 dossiers (1, 2, 3, 5, 8, 12, 20, 30, 50 h, 1 sans réponse) : médiane 8 h, 70 % sous 24 h, 1 sans réponse', () => {
  const run = appli({}); const t0 = run(`minuitParis(isoOf(new Date()).slice(0, 7) + '-01') + 8 * 3600000`);
  run(`[1, 2, 3, 5, 8, 12, 20, 30, 50, null].forEach((h, i) => { const r = { id: 'd' + i, clubId: 'k', client: 'C ' + i, date: today(), status: 'traitement', receivedAt: ${t0}, mail: { threadId: 't' + i, firstInAt: ${t0}, lastInAt: ${t0}, awaitingReply: h == null, outCount: h == null ? 0 : 1, firstReplyAt: h == null ? null : ${t0} + h * 3600000, lastOutAt: h == null ? null : ${t0} + h * 3600000 } }; S.resiliations[r.id] = r; }); REV++`);
  const K = J(run, `resIndicateurs('k', isoOf(new Date()).slice(0, 7))`);
  assert.equal(K.delaiMedianMs, 8 * H); assert.equal(K.repondues, 9); assert.equal(Math.round(K.repondues24 * 100), 70); assert.equal(K.sansReponse, 1);
  const h = run(`PAGES.resiliations.render()`); assert.match(h, /Délai médian de 1re réponse<\/span><b>8 h<\/b>/); assert.match(h, /Répondues sous 24 h<\/span><b>70 %<\/b>/);
  // Faux positifs et doublons exclus partout.
  run(`S.resiliations.fp = { id: 'fp', clubId: 'k', client: 'X', date: today(), outcome: 'faux_positif', hidden: true, receivedAt: ${t0} }; REV++`);
  assert.equal(J(run, `resIndicateurs('k', isoOf(new Date()).slice(0, 7))`).recues, 10);
  const F = J(run, `monthFigures('k', isoOf(new Date()).slice(0, 7))`); assert.equal(F.delaiMedianH, 8); assert.equal(F.sansReponse, 1); assert.ok('eurosSauves' in F);
});
test('conformité : résiliation validée sans réponse écrite après 24 h, ligne rouge', () => {
  const run = appli({ resiliations: { a: mailDossier('a', { status: 'resiliee', outcome: 'resiliee', validatedAt: Date.now() - 30 * H, closedAt: Date.now() - 30 * H, ownerId: 'u' }), b: mailDossier('b', { status: 'resiliee', outcome: 'resiliee', validatedAt: Date.now() - 30 * H, closedAt: Date.now() - 30 * H }) } });
  run(`S.resiliations.b.mail.lastOutAt = Date.now() - 2 * 3600000; REV++`);
  assert.deepEqual(J(run, `resConformite('k')`), { total: 2, envoyees: 1, manquantes: 1, taux: 0.5 });
  const h = run(`PAGES.resiliations.render()`); assert.match(h, /1 résiliation\(s\) validée\(s\) sans confirmation écrite/); assert.match(h, /Confirmation de résiliation non envoyée/);
});
test('données privées : e-mail et téléphone hors du dossier, purge au-delà de la durée de conservation', () => {
  const run = appli({ resiliations: { a: { id: 'a', clubId: 'k', client: 'A', date: '2023-01-01', status: 'resiliee', outcome: 'resiliee', closedAt: Date.UTC(2023, 1, 1) } }, private: { resiliations: { k: { a: { email: 'a@exemple.fr', phone: '0600000001' } } } } });
  assert.equal(run(`resEmail(S.resiliations.a)`), 'a@exemple.fr');
  const p = J(run, `purgePlan().ops.map(o => o[0].join('/'))`); assert.ok(p.includes('resiliations/a')); assert.ok(p.includes('private/resiliations/k/a'));
});
test('démonstration : 3 cartes rouges, 2 orange, « Dernière relève : il y a 12 min », 4 indicateurs renseignés', () => {
  const run = chargerAppli({ clubs: { k: { id: 'k' } }, users: {} }); run(`toast = () => {}; S = normalizeState(demoState()); demoRecaler(S); REV++; CLUB = S.clubs.horizon; ME = S.users.u1; UI.resTab = 'todo';`);
  const h = run(`PAGES.resiliations.render()`);
  assert.equal((h.match(/class="card dossier ph-attente"/g) || []).length, 3); assert.equal((h.match(/class="card dossier ph-encours"/g) || []).length, 2);
  assert.match(h, /Dernière relève : il y a 12 min/); assert.match(h, /En retard de 3 h/); assert.match(h, /À vérifier \(1\)/);
  for (const k of ['sans-reponse', 'delai-median', 'repondues24', 'sauvetage']) assert.doesNotMatch(h.split(`data-tuile="${k}"`)[1].slice(0, 200), /<b[^>]*>(n\.d\.|)<\/b>/, k);
  assert.doesNotMatch(JSON.stringify(J(run, `Object.values(S.resiliations).filter(r => r.receivedAt).map(r => r.client)`)), /^(?!.*Exemple)/);
  assert.ok(J(run, `Object.values(S.private.resiliations.horizon).every(p => !p.phone || /^06 00 00 00 0\\d$/.test(p.phone))`));
});
test('module Résiliations : aucun emoji, aucun tiret cadratin ni demi-cadratin', () => {
  for (const f of ['res-moteur.js', 'res-suivi.js', 'res-modeles.js', 'res-analyse.js', 'cloud/src/resPlans.ts', 'cloud/src/notify.ts', 'cloud/src/resPlanifie.ts']) {
    const s = readFileSync(new URL('../' + f, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    assert.doesNotMatch(s, /\p{Extended_Pictographic}/u, f); assert.doesNotMatch(s.replace(/\/\/.*$/gm, ''), /[–—]/, f);
  }
});
