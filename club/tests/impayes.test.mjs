// Impayés : jours d'ouverture, médiane, promesses échues, calcul unique des montants récupérés.
//   TZ=Europe/Paris node club/tests/impayes.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chargerAppli } from '../outils/fitpulse-rapport.mjs';

const J = (run, code) => JSON.parse(run(`JSON.stringify(${code})`));
const appli = (d = 'demo') => { const run = chargerAppli(d); run(`CLUB = S.clubs.niort || Object.values(S.clubs)[0]; ME = S.users.u1 || Object.values(S.users)[0];`); return run; };

test('médiane de 3 dossiers ouverts 2, 5 et 20 jours : 5', () => {
  const run = appli({ clubs: { k: { id: 'k', name: 'K' } } });
  run(`const mk = curMonth(); const rec = d => addDays(today(), 0);
    [[2, 'a'], [5, 'b'], [20, 'c']].forEach(([n, id]) => { S.clients[id] = { id, clubId: 'k', name: id, balance: 0, balanceAt: addDays(today(), -n), dunning: { status: 'recupere', recoveredAt: today(), amount: 30 } }; }); REV++;`);
  assert.deepEqual(J(run, `['a','b','c'].map(id => joursOuvert(S.clients[id]))`), [2, 5, 20]);
  assert.equal(J(run, `dunStats('k', curMonth()).medianJours`), 5);
  assert.equal(J(run, `medianOf([2, 5, 20])`), 5);
});

test('joursOuvert : régularisation, ou aujourd’hui pour un dossier ouvert', () => {
  const run = appli({ clubs: { k: { id: 'k', name: 'K' } } });
  run(`S.clients.o = { id: 'o', clubId: 'k', name: 'o', balance: 50, oldestIncident: addDays(today(), -12) }; REV++;`);
  assert.equal(J(run, `joursOuvert(S.clients.o)`), 12);
});

test('promesse au 10 non réglée : « À relancer » le 11, pas avant', () => {
  const run = appli({ clubs: { k: { id: 'k', name: 'K' } } });
  run(`S.clients.p = { id: 'p', clubId: 'k', name: 'p', balance: 80, balanceAt: addDays(today(), -9), dunning: { status: 'promesse', promiseDate: '2026-10-10' } }; REV++;`);
  assert.equal(J(run, `dunPromiseLate(S.clients.p, '2026-10-10')`), false);
  assert.equal(J(run, `dunPromiseLate(S.clients.p, '2026-10-11')`), true);
  // avec la date du jour réelle : promesse d'hier échue, promesse d'aujourd'hui en cours
  run(`S.clients.p.dunning.promiseDate = addDays(today(), -1); REV++;`);
  assert.equal(J(run, `[dunStatus(S.clients.p), dunDue(S.clients.p), dunStats('k', curMonth()).promessesEchues]`).join(), 'arelancer,true,1');
  run(`S.clients.p.dunning.promiseDate = today(); REV++;`);
  assert.equal(J(run, `dunStatus(S.clients.p)`), 'promesse');
  // réglée : plus d'impayé, plus de promesse échue
  run(`S.clients.p.dunning.promiseDate = addDays(today(), -1); S.clients.p.balance = 0; REV++;`);
  assert.equal(J(run, `dunPromiseLate(S.clients.p)`), false);
});

test('même mois, même montant récupéré : accueil, tableau de bord, classement, récap', () => {
  const run = appli();
  const v = J(run, `(() => { const mk = addMonths(curMonth(), -1); const r = rangeOf('month', mk); const rg = { from: mk + '-01', to: mk + '-' + daysIn(mk) };
    const membres = clubMembers(CLUB.id).reduce((s, u) => s + sumRange(CLUB.id, u.id, 'impayes', r.from, r.to), 0);
    const F = monthFigures(CLUB.id, mk);
    return { all: recoveredFor(CLUB.id, r), equipe: recoveredFor(CLUB.id, r, 'equipe'), classement: Math.round(membres * 100) / 100, recapAll: F.recupere, recapEquipe: F.recEquipe, recapKpi: Math.round(F.impayesEquipe * 100) / 100, parts: Math.round(Object.values(recoveredParts(CLUB.id, rg)).reduce((s, x) => s + x, 0) * 100) / 100 }; })()`);
  assert.ok(v.all > 0 && v.equipe > 0);
  assert.equal(v.classement, v.equipe); assert.equal(v.recapEquipe, v.equipe); assert.equal(v.recapKpi, v.equipe);
  assert.equal(v.recapAll, v.all); assert.equal(v.parts, v.all);
});
