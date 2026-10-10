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
