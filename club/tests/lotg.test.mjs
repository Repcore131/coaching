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
  run(`ACTIONS.loyAct({ dataset: { c: 'c1', t: 'impaye', o: 'paid', s: '', v: 80 } })`);
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
