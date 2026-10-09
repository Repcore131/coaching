// Lot G (impayés et rétention : confiance des chiffres, acomptes, un dossier, cadences, 3 taps,
// résultats, rapport ROI, démo). Vrai code de l'appli.
//   TZ=Europe/Paris node --test club/tests/lotg.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chargerAppli } from '../outils/fitpulse-rapport.mjs';

const base = (extra = {}) => ({ clubs: { k: { id: 'k', name: 'Club' } }, kpis: { impayes: { id: 'impayes', label: 'Impayés récupérés', unit: 'eur', enabled: true } }, users: { u: { id: 'u', first: 'Alex', last: 'M', role: 'manager', status: 'active', clubs: ['k'] }, v: { id: 'v', first: 'Léa', last: 'B', role: 'membre', status: 'active', clubs: ['k'] } }, ...extra });
const appli = (extra) => { const run = chargerAppli(base(extra)); run(`CLUB = S.clubs.k; ME = S.users.u; toast = () => {}; closeModal = () => {};`); return run; };
const J = (run, code) => JSON.parse(run(`JSON.stringify(${code})`));
const client = (o = {}) => ({ id: 'c1', clubId: 'k', name: 'Paul Exemple', num: '5001', phone: '0611223344', balance: 80, balanceAt: '2026-10-01', ...o });

test('point 3 : 80 € récupéré depuis Rétention puis depuis Impayés le même jour : une seule saisie de 80 €', () => {
  const run = appli({ clients: { c1: client() } });
  // Rétention : une carte impayé ouvre la feuille du dossier ; « Payé » y passe par markPaid.
  run(`globalThis.OUV = null; openModal = o => { globalThis.OUV = o; }; ACTIONS.loyAct({ dataset: { c: 'c1', t: 'impaye', o: 'paid', s: '', v: 80 } })`);
  assert.match(run('OUV.body'), /data-act="dunOut" data-o="paye"/);
  run(`db.batch(markPaid(S.clients.c1, 80, { author: ME.id, from: 'retention' }))`);
  run(`db.batch(markPaid(S.clients.c1, 80, { author: ME.id, from: 'impayes' }))`);
  const E = J(run, `Object.values(S.entries).filter(e => e.kpiId === 'impayes')`);
  assert.equal(E.length, 1); assert.equal(E[0].value, 80); assert.equal(E[0].clientId, 'c1');
});
test('point 3 : crédit au responsable du dossier, sinon à l’auteur', () => {
  const run = appli({ clients: { c1: client({ dunning: { ownerId: 'v' } }), c2: client({ id: 'c2', num: '5002' }) } });
  run(`db.batch(markPaid(S.clients.c1, 80, { author: 'u' })); db.batch(markPaid(S.clients.c2, 50, { author: 'u' }))`);
  assert.deepEqual(J(run, `Object.values(S.entries).map(e => [e.clientId, e.userId]).sort()`), [['c1', 'v'], ['c2', 'u']]);
  assert.doesNotMatch(readFileSync(new URL('../pages-data.js', import.meta.url), 'utf8'), /markPaidOps\([^)]*ME\.id/);
});
test('point 3 : pavé rapide sans Impayés ; saisie détaillée exige un client', () => {
  const run = appli({ clients: { c1: client() } });
  assert.doesNotMatch(run(`JSON.stringify(QUICK_EUR)`), /impayes/);
  assert.equal(run(`saisieClientTrouve('5001') && saisieClientTrouve('5001').id`), 'c1'); assert.equal(run(`saisieClientTrouve('')`), null);
  assert.match(run(`saisieClientImpaye()`), /Client \(obligatoire pour un impayé\)/);
});
test('point 3 : Membres > Contrôles liste les saisies sans client et propose la fusion ; totaux identiques', () => {
  const run = appli({ clients: { c1: client() } }); const d = run(`today()`);
  run(`S.entries.m1 = { id: 'm1', userId: 'v', clubId: 'k', kpiId: 'impayes', date: '${d}', value: 45, source: 'manual', at: 1 };
    S.imports.i1 = { id: 'i1', active: true, defId: 'incidents' }; S.entries.r1 = { id: 'r1', userId: 'v', clubId: 'k', kpiId: 'impayes', date: '${d}', value: 45, source: 'import', importId: 'i1', at: 1 }; REV++`);
  const K = J(run, `ctlImpayes('k', curMonth())`); assert.equal(K.sansClient.length, 1); assert.equal(K.sansClient[0].cand[0].id, 'r1');
  assert.match(run(`memControles()`), /Fusionner avec l’import/);
  run(`ACTIONS.ctlFusion({ dataset: { id: 'm1', imp: 'r1' } })`);
  const mk = run('curMonth()'); const rg = `{ from: '${mk}-01', to: '${mk}-31' }`;
  assert.equal(run(`recoveredFor('k', ${rg}, 'equipe')`), 45);
  assert.equal(run(`monthFigures('k', '${mk}').recEquipe`), run(`recoveredFor('k', ${rg}, 'equipe')`));
});
test('point 4 : 120 €, acompte de 50 € : reste 70 €, badge « Acompte reçu » ; 120 € soldent le dossier', () => {
  const run = appli({ clients: { c1: client({ balance: 120 }), c2: client({ id: 'c2', num: '5002', balance: 120 }) } });
  run(`db.batch(markPaid(S.clients.c1, 50, { author: 'u' }))`);
  const c = J(run, `S.clients.c1`); assert.equal(c.balance, 70); assert.equal(c.dunning.status, 'partiel'); assert.equal(c.dunning.paid, 50);
  assert.equal(c.dunning.history.slice(-1)[0].label, run(`'Acompte ' + fmtEc(50) + ', reste ' + fmtEc(70)`)); assert.match(c.dunning.history.slice(-1)[0].label, /^Acompte 50,00.€, reste 70,00.€$/);
  assert.equal(run(`DUN_STATUS.partiel.label`), 'Acompte reçu'); assert.equal(run(`dunStatus(S.clients.c1)`), 'partiel');
  run(`UI.dunFilter = 'todo'`); assert.match(run(`dunTable()`), /data-badge="acompte">Acompte reçu</);
  run(`db.batch(markPaid(S.clients.c2, 120, { author: 'u' }))`); assert.equal(run(`S.clients.c2.dunning.status`), 'recupere'); assert.equal(run(`S.clients.c2.balance`), 0);
});
test('point 4 : deux acomptes de 30 € le même jour : deux saisies distinctes', () => {
  const run = appli({ clients: { c1: client({ balance: 120 }) } });
  run(`db.batch(markPaid(S.clients.c1, 30, { author: 'u' })); db.batch(markPaid(S.clients.c1, 30, { author: 'u' }))`);
  const E = J(run, `Object.values(S.entries).filter(e => e.kpiId === 'impayes').map(e => e.id).sort()`);
  assert.equal(E.length, 2); assert.notEqual(E[0], E[1]); assert.match(E[0], /^dn_c1_\d{4}-\d{2}-\d{2}_0$/); assert.equal(run(`S.clients.c1.balance`), 60);
});
const INC = 'Date de l\'incident;Type d\'incident;Prénom;Nom;Num client;Moyen de paiement;Numéro du paiement;Montant du paiement;Statut;Date de régularisation;Auteur de la régularisation';
const fr = iso => iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4);
const importInc = (run, csv) => run(`(() => { const B = [analyzeTable({ name: 'RSM_incidents.csv', ...parseCSV(${JSON.stringify(csv)}) }, { clubId: 'k', month: curMonth() })]; if (!B[0].def || B[0].def.id !== 'incidents') throw new Error('non reconnu ' + (B[0].def && B[0].def.id)); db.batch(rsmCommitPlan(B, { club: 'k', by: 'u' }).ops); REV++; })()`);
test('point 5 : incident depuis 69 jours, acompte : « 69 j », firstIncidentAt inchangé ; réimport identique', () => {
  const run = appli({}); const t = run('today()'); const d0 = run(`addDays(today(), -69)`); const d1 = run(`addDays(today(), -20)`); const mk = t.slice(0, 7);
  const r1 = run(`addDays(curMonth() + '-01', 0)`);
  const csv = `${INC}\n${fr(d0)};Rejet;Paul;EXEMPLE;5001;Prélèvement;P1;70,00;En cours;;\n${fr(d1)};Rejet;Paul;EXEMPLE;5001;Prélèvement;P2;50,00;En cours;;\n`
    + [1, 2, 3].map(i => `${fr(run(`addDays('${r1}', -${10 * i})`))};Rejet;Ana;N${i};600${i};Prélèvement;R${i};${20 * i},00;Régularisé;${fr(r1)};Léa B`).join('\n') + '\n';
  importInc(run, csv); const id = run(`Object.values(S.clients).find(c => c.num === '5001').id`);
  assert.equal(run(`S.clients['${id}'].firstIncidentAt`), d0); assert.equal(run(`S.clients['${id}'].balance`), 120);
  run(`db.batch(markPaid(S.clients['${id}'], 50, { author: 'u' }))`);
  assert.equal(run(`S.clients['${id}'].firstIncidentAt`), d0); assert.equal(run(`incidentDepuis(S.clients['${id}'])`), 69);
  run(`UI.dunFilter = 'todo'`); assert.match(run(`dunTable()`), /data-depuis="69">69 j</);
  assert.equal(run(`incidentDepuis({ firstIncidentAt: '2026-08-01' }, '2026-10-09')`), 69);
  const del = run(`recoveryDelay('k', '${r1.slice(0, 7)}')`); assert.equal(del, 20);
  importInc(run, csv); assert.equal(run(`S.clients['${id}'].firstIncidentAt`), d0); assert.equal(run(`recoveryDelay('k', '${r1.slice(0, 7)}')`), del);
  assert.equal(run(`recoveryDelay('k', '1999-01')`), null);
});
test('point 6 : « Pas de réponse » noté dans Rétention apparaît côté Impayés ; aucun « Joint, OK » ; mêmes comptes', () => {
  const run = appli({ clients: { c1: client(), c2: client({ id: 'c2', num: '5002', balance: 30 }), c3: client({ id: 'c3', num: '5003', balance: 0 }) } });
  run(`db.batch(dunIssueOps(S.clients.c1, 'pasreponse'))`);
  const h = J(run, `S.clients.c1.dunning.history.slice(-1)[0]`); assert.equal(h.outcome, 'pasreponse'); assert.equal(h.by, 'u'); assert.ok(h.at);
  assert.equal(run(`S.clients.c1.dunning.status`), 'relance'); assert.ok(run(`S.clients.c1.dunning.next`));
  const t = J(run, `loyaltyTasks('k').find(x => x.type === 'impaye' && x.client.id === 'c1').acts[0].outcome`); assert.equal(t, 'pasreponse');
  run(`UI.loyTab = 'today'`); const html = run(`PAGES.loyalty.render()`);
  assert.doesNotMatch(html, /data-o="ok"|Joint, renouvelle|RDV pris|Joint, OK/); assert.match(html, /data-act="dunSheet" data-id="c2"/); run(`UI.loyTab = 'avenir'`); assert.match(html + run(`PAGES.loyalty.render()`), /data-act="dunSheet" data-id="c1"/);
  assert.equal(run(`loyaltyTasks('k').filter(t => t.type === 'impaye' && t.state === 'todo').length`), run(`dunRows('k').filter(c => Number(c.balance) > 0 && dunStatus(c) !== 'perdu').length`));
  assert.match(run(`(() => { UI.dunFilter = 'todo'; return dunTable(); })()`), /data-act="dunHistOpen"/);
  assert.equal(J(run, `Object.keys(DUN_OUTCOMES).filter(k => /joint|rdv/i.test(k) && DUN_OUT_ORDRE.includes(k))`).length, 0);
});
test('point 6 : migration des anciennes actions Rétention de type impayé, une seule fois', () => {
  const run = appli({ clients: { c1: client() }, loyalty: { l1: { id: 'l1', clientId: 'c1', type: 'impaye', outcome: 'noanswer', userId: 'v', at: 1000 }, l2: { id: 'l2', clientId: 'c1', type: 'suivi', outcome: 'ok', userId: 'v', at: 2000 } } });
  run(`db.batch(migrerLoyaltyImpayes())`); assert.equal(run(`S.clients.c1.dunning.migratedLoyalty`), true);
  assert.deepEqual(J(run, `S.clients.c1.dunning.history.map(h => h.outcome)`), ['pasreponse']);
  assert.equal(J(run, `migrerLoyaltyImpayes()`).length, 0);
});
test('point 7 : inscrit il y a 30 jours avec un J+15 joint : un J+30 à faire', () => {
  const run = appli({}); run(`S.clients.n1 = { id: 'n1', clubId: 'k', name: 'Nina Exemple', start: addDays(today(), -30), phone: '0600000001' };
    S.loyalty.a1 = { id: 'a1', clientId: 'n1', type: 'suivi15', step: 15, outcome: 'ok', userId: 'v', at: dateOf(addDays(today(), -15)).getTime() + 36e6 }; REV++`);
  const T = J(run, `loyaltyTasks('k').filter(t => t.client.id === 'n1').map(t => [t.type, t.state])`);
  assert.deepEqual(T, [['suivi30', 'todo']]);
  assert.equal(run(`suivisRealises('k', curMonth()).j15 + suivisRealises('k', addMonths(curMonth(), -1)).j15`), 1);
});
test('point 7 : trois « Pas de réponse » en 2 minutes = une tentative ; bouton « Déjà tenté à »', () => {
  const run = appli({}); run(`S.clients.n1 = { id: 'n1', clubId: 'k', name: 'Nina Exemple', start: addDays(today(), -16), phone: '0600000001' }; REV++`);
  run(`const t0 = Date.now() - 120000; [0, 60000, 120000].forEach((d, i) => { S.loyalty['p' + i] = { id: 'p' + i, clientId: 'n1', type: 'suivi15', step: 15, outcome: 'noanswer', userId: 'v', at: t0 + d }; }); REV++`);
  const t = J(run, `(({ failed, state, aConfirmer }) => ({ failed, state, aConfirmer }))(loyaltyTasks('k').find(t => t.client.id === 'n1'))`);
  assert.deepEqual(t, { failed: 1, state: 'todo', aConfirmer: false });
  let msg = ''; run(`toast = m => { globalThis.MSG = m; }`); run(`ACTIONS.loyAct({ dataset: { c: 'n1', t: 'suivi15', s: '15', o: 'noanswer', v: 0 } })`); msg = run('MSG');
  assert.match(msg, /^Déjà tenté à \d\d h \d\d$/); assert.equal(run(`Object.keys(S.loyalty).length`), 3);
});
test('point 7 : aucun passage en Perdus sans la fenêtre de confirmation', () => {
  const run = appli({}); run(`S.clients.n1 = { id: 'n1', clubId: 'k', name: 'Nina Exemple', start: addDays(today(), -16), phone: '0600000001' }; REV++`);
  run(`[3, 2, 1].forEach((d, i) => { S.loyalty['p' + i] = { id: 'p' + i, clientId: 'n1', type: 'suivi15', step: 15, outcome: 'noanswer', userId: 'v', at: dateOf(addDays(today(), -d)).getTime() + 36e6 }; }); REV++`);
  const t = J(run, `(({ failed, state, aConfirmer }) => ({ failed, state, aConfirmer }))(loyaltyTasks('k').find(t => t.client.id === 'n1'))`);
  assert.deepEqual(t, { failed: 3, state: 'todo', aConfirmer: true });
  run(`globalThis.OUV = null; openModal = o => { globalThis.OUV = o; }`);
  run(`ACTIONS.loyAct({ dataset: { c: 'n1', t: 'suivi15', s: '15', o: 'lost', v: 0 } })`);
  assert.equal(run(`loyaltyTasks('k').find(t => t.client.id === 'n1').state`), 'todo');
  const body = run('OUV.body + OUV.foot'); assert.match(body, /data-essais="3"/); assert.match(body, /Programmer un SMS/); assert.match(body, /Classer perdu/);
  run(`ACTIONS.loyPerdreOk({ dataset: { c: 'n1', t: 'suivi15', s: '15' } })`); assert.equal(run(`loyaltyTasks('k').find(t => t.client.id === 'n1').state`), 'lost');
});

test('point 2 : page Rétention, onglets, tri par euros en jeu (240 € avant 3 x 29,99 €), tarifs, phrases interdites', () => {
  const run = appli({ clients: { c1: client({ balance: 240 }), f1: { id: 'f1', clubId: 'k', name: 'Fanny Exemple', offer: 'Confort', start: '2025-01-01', end: '', phone: '0600000002' } } });
  run(`S.clients.f1.end = addDays(today(), 12); const m = addMonths(curMonth(), 3); S.clients.f1.end = m + '-' + today().slice(8); S.tarifs = { k: { [tarifCle('Confort')]: { mensuel: 29.99 } } }; REV++`);
  // fin de contrat dans 3 mois : 3 x 29,99 € en jeu
  const f = J(run, `retEuros(loyaltyTasks('k').find(t => t.client.id === 'f1' && t.type === 'renouvellement') || { type: 'renouvellement', client: S.clients.f1 })`);
  assert.equal(Math.round(f.v * 100), Math.round(29.99 * 3 * 100));
  run(`S.clients.f1.end = addDays(today(), 12); REV++`); run(`UI.loyTab = 'today'`);
  const h = run(`PAGES.loyalty.render()`);
  assert.match(h, /<h1>Rétention<\/h1>/); for (const o of ['Aujourd’hui', 'À venir', 'Résultats', 'Clients perdus']) assert.ok(h.includes(o), o);
  const ordre = [...h.matchAll(/data-ret="([^"]+)" data-type="([^"]+)" data-euros="([\d.]+)"/g)].map(m => [m[1], m[2], Number(m[3])]);
  assert.equal(ordre[0][0], 'c1'); assert.ok(ordre.findIndex(x => x[0] === 'f1') > 0);
  assert.match(h, /Appeler/); assert.doesNotMatch(h, /\p{Extended_Pictographic}/u);
  run(`S.tarifs = {}; REV++`); assert.match(run(`PAGES.loyalty.render()`), /tarif à renseigner/);
  assert.match(run(`tarifsCard()`), /Confort/);
  const build = ['pages-data.js', 'retention.js', 'calc.js', 'relances.js'].map(f => readFileSync(new URL('../' + f, import.meta.url), 'utf8')).join('\n');
  for (const x of ['Rien à traiter sur cette vue pour le moment', 'le classement démarre au premier appel', 'Les dernières actions réalisées par le club']) assert.ok(!build.toLowerCase().includes(x.toLowerCase()), x);
  assert.match(run(`PAGES.loyalty.render.call(PAGES.loyalty) && (() => { S.clients = {}; REV++; return PAGES.loyalty.render(); })()`), /Importez Résumé clients/);
});
test('point 8 : carte impayé de l’accueil (Appeler tel:+33, SMS, sans Récupéré) ; promesse vendredi : relance samedi', () => {
  const run = appli({ clients: { c1: client({ dunning: { ownerId: 'u' }, firstIncidentAt: '2026-09-01' }), c2: client({ id: 'c2', num: '5002', phone: '', dunning: { ownerId: 'u' } }) } });
  run(`S.relances = {}; REV++`);
  const h = run(`todoList(10)`);
  assert.match(h, /href="tel:\+33611223344" data-act="retAppel" data-id="c1" data-t="impaye"/); assert.match(h, /href="sms:\+33611223344\?&body=/);
  assert.doesNotMatch(h, /Récupéré/); assert.match(h, /relance n° 1/); assert.match(h, /Numéro manquant/);
  // Promesse vendredi : prochaine relance le samedi ; si le solde n'a pas baissé, elle repasse en tête.
  const t = run('today()'); const ven = run(`addDays(today(), ((5 - dateOf(today()).getDay() + 7) % 7) || 7)`);
  run(`db.batch(dunIssueOps(S.clients.c1, 'promesse', { date: '${ven}' }))`);
  assert.equal(run(`S.clients.c1.dunning.next`), run(`addDays('${ven}', 1)`));
  assert.equal(run(`new Date(S.relances[dunRelKey(S.clients.c1)].nextAt).getDay()`), 6);
  run(`S.clients.c1.dunning.promiseDate = addDays(today(), -1); REV++`);
  assert.equal(run(`relQueue('k', 'mine').now[0].top.clientId`), 'c1'); assert.equal(run(`relQueue('k', 'mine').now[0].list.some(x => x.broken)`), true);
  assert.ok(t);
});
test('point 9 : fin de contrat dans 12 jours en 3 taps ; À rappeler demain 18 h ; badge Relances', () => {
  const run = appli({ clients: { f1: { id: 'f1', clubId: 'k', name: 'Fanny Exemple', offer: 'Confort', phone: '0600000002', sellerId: 'u', start: '2025-01-01' } } });
  run(`S.clients.f1.end = addDays(today(), 12); S.tarifs = { k: { [tarifCle('Confort')]: { mensuel: 30 } } }; REV++`);
  assert.ok(run(`relBadge()`) >= 1, 'badge inclut l’appel de rétention du jour');
  const h = run(`todoList(10)`); assert.match(h, /data-act="retAppel" data-id="f1" data-t="renouvellement"/);
  // tap 1 : Appeler (retour : feuille) ; tap 2 : À rappeler ; tap 3 : Demain 18 h
  run(`globalThis.OUV = null; openModal = o => { globalThis.OUV = o; }; retSheet('f1', 'renouvellement', '')`);
  assert.match(run('OUV.body'), /Renouvelle[\s\S]*RDV[\s\S]*À rappeler[\s\S]*Pas de réponse[\s\S]*Part/);
  const demain18 = run(`new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() + 1, 18).getTime()`);
  run(`retEnregistrer('f1', 'renouvellement', '', 'rappel', { nextAt: ${demain18} })`);
  assert.equal(run(`relQueue('k', 'all').now.some(r => r.top.clientId === 'f1')`), false);
  assert.equal(run(`relancesFor('k').find(r => r.clientId === 'f1').nextAt`), demain18);
  // Renouvelle : saisie sauvetage, valeur mensualité x 12
  run(`retEnregistrer('f1', 'renouvellement', '', 'renouvelle')`);
  const e = J(run, `Object.values(S.entries).find(e => e.kpiId === 'sauvetage')`); assert.equal(e.value, 1); assert.equal(e.saved_eur, 360);
  for (const k of ['suivi15', 'renouvellement', 'anniversaire']) assert.ok(J(run, `retIssues('${k}').length`) >= 1);
  assert.deepEqual(J(run, `retIssues('suivi15').map(x => x[1])`), ['Tout va bien', 'RDV coach', 'À rappeler', 'Pas de réponse', 'Insatisfait']);
  assert.deepEqual(J(run, `retIssues('anniversaire').map(x => x[1])`), ['Message envoyé']);
  run(`retEnregistrer('f1', 'renouvellement', '', 'part', { motif: 'Prix' })`); assert.equal(run(`Object.values(S.transferts)[0].motif`), 'Prix');
});
test('point 10 : 600 € en 30 appels = 300 € par heure ; taux de sauvetage = monthFigures ; Euros gardés après un Payé', () => {
  const run = appli({ clients: { c1: client({ balance: 120, dunning: { ownerId: 'v' } }) } });
  const d = run('today()'); const mk = d.slice(0, 7);
  run(`S.entries.e1 = { id: 'e1', userId: 'v', clubId: 'k', kpiId: 'impayes', date: '${d}', value: 600, source: 'manual', at: Date.now() };
    for (let i = 0; i < 30; i++) S.loyalty['a' + i] = { id: 'a' + i, clientId: 'c1', type: 'suivi15', outcome: 'noanswer', userId: 'v', at: Date.now() - i * 1000 }; REV++`);
  const L = J(run, `resultatsLigne('k', '${mk}', 'v')`); assert.equal(L.rec, 600); assert.equal(L.appels, 30); assert.equal(L.parHeure, 300);
  run(`UI.resuMonth = '${mk}'`); const h = run(`resultatsOnglet('retention')`);
  assert.match(h, new RegExp(`data-res="taux"[\\s\\S]*?<b>${run(`fmtP(monthFigures('k', '${mk}').tauxSauvetage)`).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</b>`));
  for (const k of ['recup', 'delai', 'parheure', 'sauves', 'taux']) assert.match(h, new RegExp(`data-res="${k}"><span class="has-tip" title="[^"]{10,}"`));
  const avant = J(run, `eurosGardesClassement('k', '${mk}').find(x => x.u.id === 'v').garde`);
  run(`db.batch(markPaid(S.clients.c1, 120, { author: 'u' }))`);
  assert.equal(J(run, `eurosGardesClassement('k', '${mk}').find(x => x.u.id === 'v').garde`), avant + 120);
  assert.match(run(`eurosGardesCard('${mk}')`), /data-eg="v"/);
  assert.match(run(`PAGES.leaderboard.render()`), /id="euros-gardes"/);
});
test('point 10 : script partagé au réseau sans nom d’adhérent', () => {
  const run = appli({}); run(`S.templates.t1 = { id: 't1', clubId: 'k', kind: 'impaye', channel: 'script', step: 1, text: 'Bonjour {prenom}, je vous appelle pour votre abonnement.', body: ['Bonjour {prenom}', '', ''], author: 'u', sharedNetwork: false }; REV++`);
  run(`ACTIONS.scriptPartage({ dataset: { id: 't1' } })`); const x = J(run, `Object.values(S.scriptsReseau)[0]`);
  assert.deepEqual(Object.keys(x).sort(), ['at', 'channel', 'kind', 'step', 'taux', 'text']); assert.equal(run(`S.templates.t1.sharedNetwork`), true);
});
test('point 11 : rapport ROI, non calculable sans Incidents, recupFP + recupAuto = total Impayés, temps mis à jour', () => {
  const run = appli({ clients: { c1: client({ balance: 80, dunning: { ownerId: 'v', history: [{ at: Date.now() - 864e5 * 3, by: 'v', outcome: 'pasreponse', label: 'Pas de réponse' }] } }), c2: client({ id: 'c2', num: '5002', balance: 50 }) } });
  const mk = run('curMonth()'); run(`UI.recapMonth = '${mk}'; UI.recapTab = 'roi'`);
  assert.match(run(`roiRapport('${mk}')`), /non calculable/);
  run(`db.batch(markPaid(S.clients.c1, 80, { author: 'v' })); db.batch(markPaid(S.clients.c2, 50, { author: 'u' }));
    S.imports.inc = { id: 'inc', clubId: 'k', defId: 'incidents', active: true, source: 'resamania', at: Date.now(), from: '${mk}-01', to: '${mk}-28', name: 'RSM_incidents.csv' };
    S.recov.r1 = { id: 'r1', clubId: 'k', date: '${mk}-02', amount: 35.5, canal: 'client', clientNum: '9' }; S.recov.r2 = { id: 'r2', clubId: 'k', date: '${mk}-03', amount: 12.25, canal: 'auto', clientNum: '8' }; REV++`);
  const R = J(run, `roiFigures('k', '${mk}')`); const rg = `{ from: '${mk}-01', to: '${mk}-${run(`daysIn('${mk}')`)}' }`;
  assert.equal(R.recupFP, 80); assert.equal(Math.round((R.recupFP + R.recupAuto) * 100), Math.round(run(`recoveredFor('k', ${rg})`) * 100));
  assert.doesNotMatch(run(`roiRapport('${mk}')`), /data-roi="recup"><b class="roi-v"><span class="roi-nc">non calculable/);
  run(`S.loyalty.x1 = { id: 'x1', clientId: 'c1', type: 'suivi15', outcome: 'noanswer', userId: 'v', at: Date.now() }; S.imports.a1 = { id: 'a1', clubId: 'k', auto: true, at: Date.now() }; REV++`);
  const t20 = J(run, `roiFigures('k', '${mk}').tempsH`); run(`db.set(['roiCfg', 'k', 'minImport'], 10)`); const t10 = J(run, `roiFigures('k', '${mk}').tempsH`);
  assert.ok(t10 < t20, `${t20} puis ${t10}`); assert.match(run(`roiRapport('${mk}')`), /estimation/);
  assert.equal(R.roi, null); run(`db.set(['billing', 'price'], 99)`); assert.match(run(`roiRapport('${mk}')`), /fois le prix de l’abonnement/);
  assert.match(run(`PAGES.recap.render()`), /Rapport ROI[\s\S]*Synthèse du mois/); assert.match(run(`roiCard()`), /minImport/);
});
