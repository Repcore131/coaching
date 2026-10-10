// Lot I (ligues, duels, félicitations, réactions, photo, démo commerciale).
//   TZ=Europe/Paris node --test club/tests/loti.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chargerAppli } from '../outils/fitpulse-rapport.mjs';

const J = (run, code) => JSON.parse(run(`JSON.stringify(${code})`));
const kpis = { contrats: { id: 'contrats', label: 'Contrats signés', unit: 'qty', enabled: true, required: true, points: 1000, order: 1 } };
// 3 clubs, 15 commerciaux (5 par club) et un manager par club.
function reseau(n = 5) {
  const clubs = {}, users = {};
  ['a', 'b', 'c'].forEach((c, ci) => { clubs[c] = { id: c, name: 'Club ' + c.toUpperCase() }; users['m' + c] = { id: 'm' + c, first: 'Manager', last: c.toUpperCase(), role: 'manager', status: 'active', clubs: [c] };
    for (let i = 0; i < n; i++) users[c + i] = { id: c + i, first: 'Vendeur' + ci + i, last: 'Nom' + c, role: 'membre', status: 'active', clubs: [c] }; });
  return { clubs, users, kpis };
}
const appli = (data, qui) => { const run = chargerAppli(data); run(`ME = S.users['${qui}']; CLUB = S.clubs[ME.clubs[0]]; toast = () => {};`); return run; };

test('I1 : 3 clubs, 15 commerciaux : groupes équilibrés, jamais d’un seul club ; un club qui refuse n’apparaît nulle part', () => {
  const run = appli(reseau(), 'ma'); const lundi = run('weekStart(today())');
  run('db.batch(repartitionOps())');
  const G = J(run, `S.leagues['${lundi}'].divisions.bronze`);
  assert.equal(G.flat().length, 15); assert.ok(G.every(g => g.length >= 7 && g.length <= 12), JSON.stringify(G.map(g => g.length)));
  for (const g of G) assert.ok(new Set(g.map(id => id[0])).size > 1, 'groupe d’un seul club');
  // 24 commerciaux : groupes de 8 à 12
  const run2 = appli(reseau(8), 'ma'); run2('db.batch(repartitionOps())');
  const G2 = J(run2, `S.leagues[weekStart(today())].divisions.bronze`); assert.ok(G2.every(g => g.length >= 8 && g.length <= 12), JSON.stringify(G2.map(g => g.length)));
  assert.deepEqual(J(run2, `repartitionOps()`), []); // idempotente
  const run3 = appli({ ...reseau(), clubs: { ...reseau().clubs, c: { id: 'c', name: 'Club C', leagueOptIn: false } } }, 'ma'); run3('db.batch(repartitionOps())');
  const tous = J(run3, `Object.values(S.leagues[weekStart(today())].divisions).flat(2)`); assert.ok(tous.length === 10 && tous.every(id => id[0] !== 'c'));
});
test('I1 : le lundi suivant, les 3 premiers d’un groupe argent sont en or ; les 2 derniers redescendent', () => {
  const data = reseau(4); const run = appli(data, 'ma'); const lundi = run('weekStart(today())'); const prec = run(`addDays(weekStart(today()), -7)`);
  const ids = Object.keys(data.users).filter(id => /^[abc]\d$/.test(id));
  run(`S.leagueMember = ${JSON.stringify(Object.fromEntries(ids.map(id => [id, { division: 'argent', since: '2026-01-05', optIn: true }])))};
    S.leagues['${prec}'] = { divisions: { argent: [${JSON.stringify(ids)}] } };
    S.targets = { '${prec.slice(0, 7)}': Object.fromEntries(${JSON.stringify(ids)}.map(id => [id, { contrats: 400 }])), '${run(`addDays(weekStart(today()), -1)`).slice(0, 7)}': Object.fromEntries(${JSON.stringify(ids)}.map(id => [id, { contrats: 400 }])) };
    ${JSON.stringify(ids)}.forEach((id, i) => { S.entries['e' + id] = { id: 'e' + id, userId: id, clubId: id[0], kpiId: 'contrats', date: addDays('${prec}', 1), value: 12 - i, source: 'manual', at: 1 }; }); REV++`);
  run('db.batch(repartitionOps())');
  const ordre = J(run, `classementGroupe(S.leagues['${prec}'].divisions.argent[0], '${prec}').map(x => x.uid)`);
  for (const id of ordre.slice(0, 3)) assert.equal(run(`S.leagueMember['${id}'].division`), 'or');
  for (const id of ordre.slice(-2)) assert.equal(run(`S.leagueMember['${id}'].division`), 'bronze');
  assert.equal(run(`S.leagueMember['${ordre[5]}'].division`), 'argent');
  assert.ok(J(run, `allTrophies().filter(t => t.ligue && t.label.startsWith('Montée en Or')).length`) === 3);
});
test('I1 : écran Ma ligue : zone de montée, autres clubs en prénom et initiale, aucun montant', () => {
  const run = appli(reseau(), 'a0'); run('db.batch(repartitionOps())'); run(`UI.lbTab = 'ligue'`);
  const h = run('PAGES.leaderboard.render()');
  assert.match(h, /Ligue Bronze, groupe/); assert.match(h, /data-zone="monte"/); assert.doesNotMatch(h, /€/);
  assert.match(h, /Vendeur\d+ N\.|Commercial/); assert.match(h, /Masquer mon nom hors de mon club/);
});
