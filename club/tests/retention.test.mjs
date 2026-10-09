// Rétention : valeur en jeu, valeur protégée, J+15 / J+30 (vrai code de l'appli).
//   TZ=Europe/Paris node club/tests/retention.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chargerAppli } from '../outils/fitpulse-rapport.mjs';

const appli = () => { const run = chargerAppli({ clubs: { k: { id: 'k', name: 'Club' } }, users: { u: { id: 'u', role: 'manager', status: 'active', clubs: ['k'] } } }); run(`CLUB = S.clubs.k; ME = S.users.u;`); return run; };
const J = (run, code) => JSON.parse(run(`JSON.stringify(${code})`));

test('39,90 € avec 8 mois d’engagement restants : 319,20 € en jeu', () => {
  const run = appli();
  assert.equal(J(run, `valueAtStake({ type: 'renouvellement', client: { id: 'c', clubId: 'k', price: 39.9, end: (() => { const d = dateOf(today()); d.setMonth(d.getMonth() + 8); d.setDate(d.getDate() + 2); return isoOf(d); })() } })`), 319.2);
});
test('fin d’engagement inconnue : 3 mois ; impayé : montant dû', () => {
  const run = appli();
  assert.equal(J(run, `valueAtStake({ type: 'suivi', client: { id: 'c', clubId: 'k', price: 30 } })`), 90);
  assert.equal(J(run, `valueAtStake({ type: 'impaye', amount: 59.9, client: { id: 'c', clubId: 'k', price: 30, balance: 59.9 } })`), 59.9);
});
test('chaque tâche porte valeurEnJeu', () => {
  const run = appli();
  run(`S.clients.c1 = { id: 'c1', clubId: 'k', name: 'A B', price: 25, balance: 40, balanceAt: today() }; REV++;`);
  const t = J(run, `loyaltyTasks('k').map(t => [t.type, t.valeurEnJeu])`);
  assert.deepEqual(t, [['impaye', 40]]);
});
test('après un J+15 OK, le J+30 apparaît à sa date', () => {
  const run = appli();
  run(`S.clients.c = { id: 'c', clubId: 'k', name: 'Ana Test', start: addDays(today(), -14), price: 30 }; REV++;`);
  assert.deepEqual(J(run, `loyaltyTasks('k').map(t => [t.step, t.state])`), [[15, 'todo']]);
  run(`S.loyalty.a1 = { id: 'a1', clientId: 'c', type: 'suivi', step: 15, outcome: 'ok', at: Date.now() }; REV++;`);
  assert.deepEqual(J(run, `loyaltyTasks('k').map(t => [t.step, t.state])`), [[15, 'done']]);
  // 16 jours plus tard : le J+30 est à faire, le J+15 réussi ne le ferme pas
  run(`S.clients.c.start = addDays(today(), -30); S.loyalty.a1.at = dateOf(addDays(today(), -15)).getTime(); REV++;`);
  assert.deepEqual(J(run, `loyaltyTasks('k').map(t => [t.step, t.state, t.due === S.clients.c.start.replace(/.*/, addDays(S.clients.c.start, 30))])`), [[30, 'todo', true]]);
  // ancienne action sans étape, faite à J+16 : comptée pour le J+15, pas pour le J+30
  run(`delete S.loyalty.a1; S.loyalty.a2 = { id: 'a2', clientId: 'c', type: 'suivi', outcome: 'ok', at: dateOf(addDays(today(), -14)).getTime() }; REV++;`);
  assert.deepEqual(J(run, `loyaltyTasks('k').map(t => [t.step, t.state])`), [[30, 'todo']]);
  run(`S.loyalty.a3 = { id: 'a3', clientId: 'c', type: 'suivi', step: 30, outcome: 'rdv', at: Date.now() }; REV++;`);
  assert.deepEqual(J(run, `loyaltyTasks('k').map(t => [t.step, t.state])`), [[30, 'done']]);
});
test('Valeur protégée = somme des tâches marquées OK ou RDV', () => {
  const run = appli();
  run(`['c1','c2','c3','c4'].forEach(id => { S.clients[id] = { id, clubId: 'k', name: id, price: 30 }; });
    const n = Date.now();
    S.loyalty = { a: { id: 'a', clientId: 'c1', type: 'renouvellement', outcome: 'ok', value: 319.2, at: n }, b: { id: 'b', clientId: 'c2', type: 'suivi', step: 15, outcome: 'rdv', value: 90, at: n },
      c: { id: 'c', clientId: 'c3', type: 'suivi', step: 15, outcome: 'noanswer', value: 90, at: n }, d: { id: 'd', clientId: 'c4', type: 'renouvellement', outcome: 'lost', value: 50, at: n } }; REV++;`);
  const p = J(run, `loyProtected('k', curMonth())`);
  assert.equal(p.total, 409.2); assert.equal(p.n, 2);
});
