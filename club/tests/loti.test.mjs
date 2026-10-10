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
// Formulaire simulé : les champs d'un formulaire de l'appli, lus par formData.
const formulaire = (run, sel, champs) => run(`document.querySelector = s => (s === '${sel}' ? { querySelectorAll: () => ${JSON.stringify(Object.entries(champs).map(([name, value]) => ({ name, value, type: 'text' })))} } : null)`);
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
function deuxClubs() {
  const clubs = { a: { id: 'a', name: 'Club Petit' }, b: { id: 'b', name: 'Club Grand' } }, users = {};
  users.ma = { id: 'ma', first: 'Manager', last: 'A', role: 'manager', status: 'active', clubs: ['a'] }; users.mb = { id: 'mb', first: 'Manager', last: 'B', role: 'manager', status: 'active', clubs: ['b'] };
  for (let i = 0; i < 3; i++) users['a' + i] = { id: 'a' + i, first: 'Alpha' + i, last: 'X', role: 'membre', status: 'active', clubs: ['a'] };
  for (let i = 0; i < 9; i++) users['b' + i] = { id: 'b' + i, first: 'Bravo' + i, last: 'Y', role: 'membre', status: 'active', clubs: ['b'] };
  return { clubs, users, kpis };
}
test('I2 : duel proposé puis accepté : sur l’accueil des deux clubs, deux pourcentages ; 3 contre 9 vendeurs comparés au pourcentage', () => {
  const run = appli(deuxClubs(), 'ma'); const mk = run('curMonth()');
  run(`S.targets = { '${mk}': Object.fromEntries(Object.keys(S.users).filter(id => /^[ab]\\d$/.test(id)).map(id => [id, { contrats: 30 }])) }; REV++`);
  formulaire(run, '#duel-f', { club: 'b', kpi: 'contrats', reward: 'Petit déjeuner' }); run('ACTIONS.duelProposer()');
  const id = run('Object.keys(S.duels)[0]'); assert.equal(run(`S.duels['${id}'].status`), 'pending');
  run(`ME = S.users.mb; CLUB = S.clubs.b; ACTIONS.duelAccepter({ dataset: { id: '${id}' } })`); assert.equal(run(`S.duels['${id}'].status`), 'live');
  // club A : 3 vendeurs à 2 contrats ; club B : 9 vendeurs, 1 contrat chacun pour 8 d'entre eux (plus de volume, moins de %)
  run(`S.duels['${id}'].start -= 2 * 864e5; const t = S.duels['${id}'].start + 3600e3; ['a0','a1','a2'].forEach(u => { S.entries['e'+u] = { id: 'e'+u, userId: u, clubId: 'a', kpiId: 'contrats', date: today(), value: 2, source: 'manual', at: t }; });
    ['b0','b1','b2','b3','b4','b5','b6','b7'].forEach(u => { S.entries['e'+u] = { id: 'e'+u, userId: u, clubId: 'b', kpiId: 'contrats', date: today(), value: 1, source: 'manual', at: t }; }); S.duels['${id}'].end = Date.now() + 864e5; REV++`);
  for (const [qui, club] of [['a0', 'a'], ['b0', 'b']]) { run(`ME = S.users.${qui}; CLUB = S.clubs.${club}`); const h = run('duelCard()'); assert.match(h, /Duel en cours/); assert.equal((h.match(/\d+ %/g) || []).length, 2, h); assert.doesNotMatch(h, /Alpha|Bravo|€/); }
  assert.ok(J(run, `duelClub(S.duels['${id}'], 'a').pct`) > J(run, `duelClub(S.duels['${id}'], 'b').pct`));
  assert.match(run(`ME = S.users.b0; CLUB = S.clubs.b; duelCard()`), /il manque \d+ contrats? pour repasser devant/i);
  // fin : trophée « Duel gagné » aux seuls contributeurs du club vainqueur ; événement dans le fil des deux clubs
  run(`S.duels['${id}'].end = Date.now() - 1000; S.entries.ea2.value = 0; REV++`);
  const T = J(run, `allTrophies().filter(t => t.duel).map(t => t.userId).sort()`); assert.deepEqual(T, ['a0', 'a1']);
  assert.ok(J(run, `feedEvents(['a']).some(e => /Duel gagné contre Club Grand/.test(e.label))`)); assert.ok(J(run, `feedEvents(['b']).some(e => /Duel perdu contre Club Petit/.test(e.label))`));
});
test('I2 : défi d’équipe, barre commune et réussite partagée', () => {
  const run = appli(deuxClubs(), 'ma');
  formulaire(run, '#defi-f', { kpi: 'contrats', target: '5', jours: '7' }); run('ACTIONS.defiEquipeCreer()');
  const ch = J(run, 'Object.values(S.challenges)[0]'); assert.equal(ch.type, 'team');
  run(`['a0','a1'].forEach((u, i) => { S.entries['t'+u] = { id: 't'+u, userId: u, clubId: 'a', kpiId: 'contrats', date: today(), value: 3, source: 'manual', at: ${ch.start} + 1000 }; }); REV++`);
  assert.equal(J(run, `defiEquipeEtat(S.challenges['${ch.id}']).reussi`), true);
  run(`ME = S.users.a2; CLUB = S.clubs.a`); assert.match(run('defiEnCoursCard()'), /6 contrats sur 5 contrats ensemble/);
  run(`S.challenges['${ch.id}'].start -= 3600e3; S.entries.ta0.at -= 3600e3; S.entries.ta1.at -= 3600e3; S.challenges['${ch.id}'].end = Date.now() - 1000; REV++`);
  assert.deepEqual(J(run, `allTrophies().filter(t => /Défi d’équipe réussi/.test(t.label)).map(t => t.userId).sort()`), ['a0', 'a1']);
});
test('I3 : féliciter en 2 taps depuis l’accueil manager ; fil et profil ; pas à soi-même', () => {
  const run = appli(reseau(), 'ma');
  run(`S.entries.x1 = { id: 'x1', userId: 'a1', clubId: 'a', kpiId: 'contrats', date: today(), value: 1, source: 'manual', at: Date.now() }; REV++; globalThis.OUV = null; openModal = o => { globalThis.OUV = o; }`);
  const tuile = run('bienJoueTile()'); assert.match(tuile, /Bien joué aujourd’hui/); assert.match(tuile, /data-act="kudosOuvrir" data-u="a1"/);
  run(`ACTIONS.kudosOuvrir({ dataset: { u: 'a1' } })`); assert.match(run('OUV.body'), /data-act="kudosEnvoyer" data-u="a1" data-r="vente"/); // tap 1
  run(`ACTIONS.kudosEnvoyer({ dataset: { u: 'a1', r: 'vente' } })`); // tap 2, sans texte
  const k = J(run, 'Object.values(S.kudos)'); assert.equal(k.length, 1); assert.equal(k[0].to, 'a1'); assert.equal(k[0].reason, 'vente');
  assert.ok(J(run, `feedEvents(['a']).some(e => e.type === 'kudos' && /félicite/.test(e.label))`));
  run(`ME = S.users.a1; UI.profTab = 'perf'`); assert.match(run('PAGES.profile.render()'), /Félicitations reçues ce mois : 1/);
  run(`ME = S.users.ma`); assert.equal(J(run, `kudosOps('ma', 'vente')`).length, 0);
  run(`ACTIONS.kudosEpingler({ dataset: { id: '${k[0].id}' } })`); assert.equal(J(run, `feedEvents(['a']).find(e => e.type === 'kudos').pinned`), true);
});
test('I3 : un collègue ne peut pas envoyer un quatrième bravo dans la journée ; trophée Coup de coeur', () => {
  const run = appli(reseau(), 'a0'); let msg = '';
  run(`globalThis.MSG = ''; toast = m => { globalThis.MSG = m; }; ['a1','a2','a3','a4'].forEach((u, i) => { S.entries['r' + i] = { id: 'r' + i, userId: u, clubId: 'a', kpiId: 'contrats', date: today(), value: 1, source: 'manual', at: Date.now() }; }); REV++`);
  for (let i = 0; i < 4; i++) run(`ACTIONS.react({ dataset: { id: 'r${i}', em: 'bravo' } })`);
  msg = run('MSG'); assert.equal(J(run, `bravosDonnes()`), 3); assert.match(msg, /^3 bravos par jour au plus/);
  assert.equal(run(`!!(S.reactions.r3 && S.reactions.r3.bravo && S.reactions.r3.bravo.a0)`), false);
  run(`ME = S.users.ma; CLUB = S.clubs.a; db.set(['clubs', 'a', 'coeur', addMonths(curMonth(), -1)], 'a2')`);
  assert.ok(J(run, `allTrophies().some(t => t.userId === 'a2' && /^Coup de coeur du manager/.test(t.label))`));
});
test('I4 : Partager à l’équipe crée une carte dans le fil ; image du bilan sans euro ; commentaire notifié à l’auteur', () => {
  const run = appli(reseau(), 'a0'); const mk = run('addMonths(curMonth(), -1)');
  run(`S.targets = { '${mk}': { a0: { contrats: 10 } } }; S.entries.w1 = { id: 'w1', userId: 'a0', clubId: 'a', kpiId: 'contrats', date: '${mk}-10', value: 8, source: 'manual', at: 1 };
    S.entries.w2 = { id: 'w2', userId: 'a0', clubId: 'a', kpiId: 'impayes', date: '${mk}-10', value: 250, source: 'manual', at: 1 }; REV++`);
  assert.match(run(`PAGES.wrap.render(['${mk}', 'a0'])`), /data-act="bilanPartager"[\s\S]*Partager à l’équipe[\s\S]*Enregistrer l’image/);
  run(`ACTIONS.bilanPartager({ dataset: { mk: '${mk}' } })`);
  const ev = J(run, `feedEvents(['a']).find(e => e.id.startsWith('wr_'))`); assert.ok(ev); assert.match(ev.label, /partage son bilan/); assert.doesNotMatch(ev.label, /€/);
  assert.doesNotMatch(run(`(() => { UI.chatCh = 'a'; return PAGES.chat ? PAGES.chat.render() : ''; })()`), /partage son bilan/);
  // image : on relève tout ce qui est écrit sur le canvas
  const ecrit = J(run, `(() => { const T = []; const ctx = new Proxy({}, { get: (o, k) => k === 'fillText' ? (t => T.push(String(t))) : k === 'measureText' ? (() => ({ width: 10 })) : (() => {}), set: () => true }); drawWrapCard('a0', '${mk}', { getContext: () => ctx }); return T; })()`);
  assert.ok(ecrit.length > 5); assert.ok(ecrit.every(t => !/€|[–—]/.test(t)), ecrit.join(' | ')); assert.ok(ecrit.some(t => /%/.test(t)));
  // commentaire d'un collègue sur mon événement
  run(`ME = S.users.a1; db.batch(commentOps('${ev.id}', 'a0', 'Superbe mois'))`);
  const c = J(run, `commentairesDe('${ev.id}')`); assert.equal(c.length, 1); assert.equal(c[0].to, 'a0');
  assert.equal(J(run, `commentOps('x', 'a0', 'y'.repeat(300))`)[0][1].text.length, 140);
});
