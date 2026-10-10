// Lot H (préférences, accueil, fil, dernière visite, objectifs du jour, notifications, récompenses).
//   TZ=Europe/Paris node --test club/tests/loth.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chargerAppli } from '../outils/fitpulse-rapport.mjs';

const base = (extra = {}) => ({ clubs: { k: { id: 'k', name: 'Club' }, k2: { id: 'k2', name: 'Club 2' } }, users: { u: { id: 'u', first: 'Alex', last: 'M', role: 'manager', status: 'active', clubs: ['k', 'k2'] }, v: { id: 'v', first: 'Léa', last: 'B', role: 'membre', status: 'active', clubs: ['k'] } }, ...extra });
const appli = (extra, qui = 'u') => { const run = chargerAppli(base(extra)); run(`CLUB = S.clubs.k; ME = S.users.${qui}; toast = () => {}; closeModal = () => {};`); return run; };
const J = (run, code) => JSON.parse(run(`JSON.stringify(${code})`));

test('H1 : migration de l’ancien format (ordre KPI, non-lus, thème), une seule fois', () => {
  const run = appli({ prefs: { u: { kpiOrder: ['avis', 'contrats'], feedSeen: 111, chatSeen: 222, liveBanner: false, tipDrag: false, vibrate: false, notif: { rules: { record: false }, quiet: { from: '21:00', to: '07:30', sunday: false }, max: 3 }, onboarded: true } } });
  run(`safeLS.get = k => k === 'fitpulse.theme' ? 'dark' : null`);
  assert.equal(run('migrerPrefs()'), true);
  const P = J(run, 'prefsOf()');
  assert.deepEqual(P.kpiOrder, { k: ['avis', 'contrats'] }); assert.equal(P.seen.feed, 111); assert.equal(P.seen.chat, 222);
  assert.equal(P.notif.liveBanner, false); assert.equal(P.tips.drag, false); assert.equal(P.sense.haptics, false); assert.equal(P.theme, 'dark'); assert.equal(P.v, 2);
  assert.equal(P.notif.quietFrom, '21:00'); assert.equal(P.notif.maxPerDay, 3); assert.equal(P.notif.rules.record, false); assert.equal(P.notif.sunday, false);
  const brut = J(run, 'S.prefs.u'); assert.equal(brut.feedSeen, undefined); assert.equal(brut.onboarded, true);
  assert.equal(run('migrerPrefs()'), false);
  assert.equal(run(`pref('feedSeen', 0)`), 111); assert.equal(run(`unseenPouls()`), 0);
});
test('H1 : le thème du compte s’applique sur un autre appareil après connexion', () => {
  const run = appli({ prefs: { u: { v: 2, theme: 'dark' } } });
  run(`document.documentElement.dataset = {}; prefsSync()`);
  assert.equal(run('document.documentElement.dataset.theme'), 'dark');
  run(`S.prefs.u.theme = 'light'; REV++; prefsSync()`); assert.equal(run('document.documentElement.dataset.theme'), 'light');
  run(`render = () => {}; choisirTheme('auto')`); assert.equal(run('S.prefs.u.theme'), 'auto'); assert.equal(run('document.documentElement.dataset.theme'), undefined);
});
test('H1 : aucune case ne promet un envoi inexistant ; carte Mon appli', () => {
  const run = appli({ prefs: { u: { v: 2 } } });
  assert.doesNotMatch(run('notifCard()'), /data-id="digest"/);
  run(`S.serveur = { at: Date.now(), mail: true }`); assert.match(run('notifCard()'), /data-id="digest"/);
  const m = run('monAppliCard()'); for (const t of ['Thème', 'Vibrations', 'Sons', 'Animations réduites', 'Heures calmes']) assert.match(m, new RegExp(t));
  run(`ACTIONS.senseSet({ dataset: { k: 'motion' }, checked: true })`); assert.equal(run('S.prefs.u.sense.motion'), 'reduced');
});
test('H2 : cartes de l’accueil par compte, jamais de cockpit pour un membre, accueil conseillé', () => {
  const run = appli({ prefs: { v: { v: 2, home: { cards: ['cockpit', 'top', 'day'], hidden: [] } } } }, 'v');
  assert.deepEqual(J(run, 'homeCartes()'), ['top', 'day']);
  run(`UI.homeEdit = { ordre: homeToutes(), on: Object.fromEntries(homeToutes().map(id => [id, id !== 'top'])) }; ACTIONS.homeEditSave()`);
  assert.ok(!J(run, 'homeCartes()').includes('top')); assert.equal(run('!!(S.prefs.u && S.prefs.u.home)'), false);
  run(`ACTIONS.homeConseille()`); assert.deepEqual(J(run, 'homeCartes()'), J(run, 'HOME_CONSEILLE.membre'));
  run(`ME = S.users.u`); assert.equal(J(run, 'homeCartes()')[1], 'cockpit');
});
test('H2 : ordre des KPI par club dans prefs.kpiOrder', () => {
  const run = appli({ prefs: { u: { v: 2 } } });
  const club = J(run, 'kpiOrdreMoi("k")');
  run(`TRI_CIBLES.kpi(['avis', 'contrats'])`); run(`CLUB = S.clubs.k2`); run(`TRI_CIBLES.kpi(['impayes'])`);
  const o = J(run, 'S.prefs.u.kpiOrder'); assert.deepEqual(o.k.slice(0, 2), ['avis', 'contrats']); assert.equal(o.k2[0], 'impayes'); assert.equal(o.k.length, club.length);
  assert.deepEqual(J(run, 'kpiOrdreMoi("k")').slice(0, 2), ['avis', 'contrats']);
});
const kpis = { contrats: { id: 'contrats', label: 'Contrats signés', unit: 'qty', enabled: true, required: true, points: 1000, order: 1 }, avis: { id: 'avis', label: 'Avis Google', unit: 'qty', enabled: true, required: true, points: 100, order: 2 }, impayes: { id: 'impayes', label: 'Impayés récupérés', unit: 'eur', enabled: true, points: 750, order: 3 } };
const ent = (id, o) => [id, { id, clubId: 'k', kpiId: 'contrats', value: 1, source: 'manual', ...o }];
test('H3 : import Resamania = une carte par vendeur avec le total ; palier franchi une seule fois', () => {
  const run = appli({ kpis, paliers: {} }, 'v');
  const d = run('today()'), mk = run('curMonth()'), t0 = run('Date.now()') - 3600e3;
  const E = Object.fromEntries([...Array(4)].map((_, i) => ent('i' + i, { userId: 'v', date: d, source: 'import', importId: 'imp1', at: t0 + i })).concat([ent('j0', { userId: 'u', date: d, source: 'import', importId: 'imp1', value: 2, at: t0 })]).concat([0, 1, 2].map(i => ent('m' + i, { userId: 'u', kpiId: 'avis', date: d, at: t0 + 1000 + i, value: 2 }))));
  run(`S.entries = ${JSON.stringify(E)}; S.imports = { imp1: { id: 'imp1', active: true, at: ${t0 + 50} } }; S.paliers = { k: { '${mk}': { contrats: [{ target: 5 }, { target: 9 }], avis: [{ target: 4 }] } } }; REV++`);
  const L = J(run, `feedEvents(['k'])`);
  const imp = L.filter(e => e.type === 'import'); assert.equal(imp.length, 2);
  assert.match(imp.find(e => e.userId === 'v').label, /^Léa, 4 contrats importés$/);
  const pal = L.filter(e => e.type === 'palier'); assert.deepEqual(pal.map(e => e.label).sort(), ['Palier 1 atteint, 4 avis', 'Palier 1 atteint, 5 contrats']);
  assert.equal(J(run, `palierState('k', curMonth(), 'contrats').reached`), 1);
  run(`S.entries.m9 = ${JSON.stringify(ent('m9', { userId: 'u', kpiId: 'avis', date: d, at: t0 + 5000, value: 3 })[1])}; REV++`);
  assert.equal(J(run, `feedEvents(['k']).filter(e => e.type === 'palier' && e.kpiId === 'avis').length`), 1);
});
test('H3 : décocher Ventes masque les saisies dans le fil, le bandeau et le compteur ; bandeau sans emoji ni tiret', () => {
  const run = appli({ kpis, prefs: { v: { v: 2, seen: { feed: 1 } } } }, 'v');
  const d = run('today()'); const now = run('Date.now()');
  run(`S.entries = ${JSON.stringify(Object.fromEntries([ent('s1', { userId: 'u', date: d, at: now - 1000 }), ent('r1', { userId: 'u', date: d, at: now - 900, kpiId: 'impayes', value: 80 })]))}; REV++`);
  assert.equal(run('unseenPouls()'), 2);
  const t = run(`liveTexte(S.entries.s1)`); assert.equal(t, 'Alex · 1 contrat · Club'); assert.doesNotMatch(t, /[–—]|\p{Extended_Pictographic}/u);
  assert.equal(run(`liveTexte(S.entries.r1)`), 'Alex · a récupéré un impayé · Club');
  assert.doesNotMatch(run(`PAGES.pouls.render()`), /80/);
  run(`ACTIONS.filType({ dataset: { k: 'sale' }, checked: false })`);
  assert.equal(run('unseenPouls()'), 1); assert.equal(run(`liveTexte(S.entries.s1)`), null);
  assert.doesNotMatch(run(`PAGES.pouls.render()`), /data-type="sale"/);
  run(`ACTIONS.filPause()`); assert.equal(run('unseenPouls()'), 0);
});
const kpisJ = { ...kpis, nutrition: { id: 'nutrition', label: 'Nutrition', unit: 'eur', enabled: true, required: true, points: 500, order: 4 } };
test('H5 : toujours 3 objectifs ; vente importée du jour = objectif a fait ; 0,01 € ne valide pas', () => {
  const run = appli({ kpis: kpisJ }, 'v'); const mk = run('curMonth()'), d = run('today()');
  run(`S.targets = { '${mk}': { v: { nutrition: 400, contrats: 2, avis: 1 } } }; REV++`);
  const G = J(run, 'dailyGoals()'); assert.equal(G.length, 3);
  const a = G.find(g => g.id === 'a'); assert.equal(a.kpiId, 'nutrition'); assert.ok(a.target >= 5);
  run(`S.entries.n1 = { id: 'n1', userId: 'v', clubId: 'k', kpiId: 'nutrition', date: '${d}', value: 0.01, source: 'manual', at: Date.now() }; REV++`);
  assert.equal(J(run, `dailyGoals().find(g => g.id === 'a').done`), false);
  run(`S.targets = { '${mk}': { v: { contrats: 40 } } }; delete S.entries.n1; S.imports = { i1: { id: 'i1', active: true } }; S.entries.c1 = { id: 'c1', userId: 'v', clubId: 'k', kpiId: 'contrats', date: '${d}', value: 9, source: 'import', importId: 'i1', at: Date.now() }; REV++`);
  const a2 = J(run, `dailyGoals().find(g => g.id === 'a')`); assert.equal(a2.kpiId, 'contrats'); assert.equal(a2.done, true);
  run(`S.prefs.v = { v: 2, goal: { week: semaineIso(), kpiId: 'avis', target: 5 } }; REV++`);
  const c = J(run, `dailyGoals().find(g => g.id === 'c')`); assert.match(c.label, /^Défi perso/); assert.equal(J(run, 'dailyGoals()').length, 3);
});
test('H5 : du mardi au samedi, un objectif chaque jour : la série continue après le lundi ; joker', () => {
  const run = appli({ kpis }, 'v'); const d0 = run('today()');
  // l'équipe saisit tous les jours ouvrés (le lundi compris) ; Léa ne travaille jamais le lundi
  run(`S.clubs.k.openDays = [1, 2, 3, 4, 5, 6]; for (let i = 1; i <= 70; i++) { const d = addDays('${d0}', -i); const j = dateOf(d).getDay(); if (j === 0) continue;
    S.entries['u' + i] = { id: 'u' + i, userId: 'u', clubId: 'k', kpiId: 'avis', date: d, value: 1, source: 'manual', at: dateOf(d).getTime() + 36e6 };
    if (j !== 1) S.entries['v' + i] = { id: 'v' + i, userId: 'v', clubId: 'k', kpiId: 'contrats', date: d, value: 1, source: 'manual', at: dateOf(d).getTime() + 36e6 }; } REV++`);
  const s = J(run, 'serieJours()'); const attendu = run(`(() => { let n = 0; for (let i = 1; i <= 35; i++) { const j = dateOf(addDays('${d0}', -i)).getDay(); if (j !== 0 && j !== 1) n++; } return n; })()`);
  assert.ok(s.n >= attendu, `${s.n} jours, au moins ${attendu} attendus (5 semaines, lundis neutres)`); assert.equal(s.jokerDispo, true);
  assert.match(run('serieTexte(serieJours())'), /^Série : \d+ jours travaillés$/);
  // un mardi manqué : couvert par le joker, la série continue
  run(`for (const id of Object.keys(S.entries)) { const e = S.entries[id]; if (e.userId === 'v' && dateOf(e.date).getDay() === 2 && e.date >= addDays('${d0}', -7)) delete S.entries[id]; } REV++`);
  const s2 = J(run, 'serieJours()'); assert.equal(s2.jokerDispo, false); assert.equal(s2.n, s.n - 1); assert.match(run('jokerTexte(serieJours())'), /^Joker utilisé le \d+ /);
});
