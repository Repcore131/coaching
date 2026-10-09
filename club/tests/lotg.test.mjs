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
  run(`UI.loyType = 'impaye'`); const html = run(`loyTasks(loyaltyTasks('k').filter(t => t.state === 'todo'))`);
  assert.doesNotMatch(html, /data-o="ok"|Joint, renouvelle|RDV pris/); assert.match(html, /data-act="dunSheet"/);
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
