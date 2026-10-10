// Lot J (retours sensoriels, mesure d'usage, canaux d'import).
//   TZ=Europe/Paris node --test club/tests/lotj.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chargerAppli } from '../outils/fitpulse-rapport.mjs';

const J = (run, code) => JSON.parse(run(`JSON.stringify(${code})`));
const kpis = { contrats: { id: 'contrats', label: 'Contrats signés', unit: 'qty', enabled: true, required: true, points: 1000, order: 1 } };
const club = () => ({ clubs: { a: { id: 'a', name: 'Club A' } }, kpis, users: {
  m: { id: 'm', first: 'Manon', last: 'M', role: 'manager', status: 'active', clubs: ['a'] },
  v: { id: 'v', first: 'Victor', last: 'V', role: 'membre', status: 'active', clubs: ['a'] },
  w: { id: 'w', first: 'Wassim', last: 'W', role: 'membre', status: 'active', clubs: ['a'] },
  c: { id: 'c', first: 'Chloé', last: 'C', role: 'createur', status: 'active', clubs: ['a'] } } });
const appli = (data, qui) => { const run = chargerAppli(data); run(`ME = S.users['${qui}']; CLUB = S.clubs[ME.clubs[0]]; TOASTS = []; toast = t => TOASTS.push(t);`); return run; };
const CSS = readFileSync(new URL('../pulse.css', import.meta.url), 'utf8');

test('J1 : réglages par défaut, une saisie vibre 10 ms, aucun son, et le toast annonce « 1 contrat enregistré »', () => {
  const run = appli(club(), 'v');
  run(`VIB = []; navigator.vibrate = m => { VIB.push(m); return true; }; FX_GESTE = true; window.AudioContext = function () { throw new Error('aucun son attendu'); };
    toastUndo = m => TOASTS.push(m); quickAdd('contrats', 1);`);
  assert.deepEqual(J(run, 'VIB'), [10]);
  const r = J(run, 'FX_JOURNAL.at(-1)'); assert.equal(r.niveau, 'tap'); assert.equal(r.son, false);
  assert.match(J(run, 'TOASTS').join(' '), /^1 contrat enregistré/);
  assert.deepEqual(J(run, `[prefsOf().sense.sound, prefsOf().sense.haptics]`), [false, true]);
});
test('J1 : motifs de vibration du tableau ; vibrations coupées ou appareil sans vibreur : rien', () => {
  const run = appli(club(), 'v');
  run(`VIB = []; navigator.vibrate = m => { VIB.push(m); return true; }; fxBandeau = () => {}; fxCelebration = () => {}; fx.tap(); fx.step('x'); fx.win('Palier 1 atteint'); fx.kudos('Bravo'); fx.error('Erreur');`);
  assert.deepEqual(J(run, 'VIB'), [10, [15, 40, 15, 40, 15], [30, 50, 40, 50, 60], 15, [30, 60, 30]]);
  run(`S.prefs.v = { v: 2, sense: { haptics: false, sound: false, motion: 'auto' } }; REV++; VIB = []; fx.tap();`);
  assert.deepEqual(J(run, 'VIB'), []);
  run(`S.prefs.v = {}; REV++; delete navigator.vibrate; fx.tap();`); assert.equal(J(run, 'FX_JOURNAL.at(-1).vibre'), false);
});
test('J1 : son seulement si activé, après un geste, page au premier plan ; volume 0,15 ; 80 ms (step) et 300 ms (win)', () => {
  const run = appli(club(), 'v');
  run(`OSC = []; window.AudioContext = function () { this.currentTime = 0; this.destination = {}; this.createOscillator = () => { const o = { frequency: {}, connect() {}, start(t) { o.t0 = t; }, stop(t) { o.t1 = t; OSC.push(o); } }; return o; };
    this.createGain = () => ({ gain: { setValueAtTime(v) { GAIN = v; }, exponentialRampToValueAtTime() {} }, connect() {} }); };
    S.prefs.v = { v: 2, sense: { haptics: true, sound: true, motion: 'auto' } }; REV++; fxBandeau = () => {}; fxCelebration = () => {};`);
  assert.equal(J(run, `fxSon('step')`), false, 'aucun son avant un premier geste (ouverture de l’appli)');
  run(`FX_GESTE = true; document.hidden = true;`); assert.equal(J(run, `fxSon('win')`), false, 'jamais en arrière-plan');
  run(`document.hidden = false; OSC = []; fx.step('Étape');`);
  assert.equal(J(run, 'Math.round(Math.max(...OSC.map(o => o.t1)) * 1000)'), 80); assert.equal(J(run, 'GAIN'), 0.15);
  run(`OSC = []; fx.win('Palier 2 atteint');`); assert.equal(J(run, 'Math.round(Math.max(...OSC.map(o => o.t1)) * 1000)'), 300);
});
test('J1 : mouvement réduit (préférence ou système) : aucune animation CSS, célébration en texte seul, 1,8 s au plus et fermée à Échap', () => {
  assert.match(CSS, /@media \(prefers-reduced-motion: reduce\) \{\s*\*, \*::before, \*::after \{ animation: none !important; transition: none !important;/);
  assert.match(CSS, /html\[data-motion=reduced\] \*[^{]*\{ animation: none !important; transition: none !important;/);
  for (const m of CSS.matchAll(/animation: [a-zA-Z-]+ ([\d.]+)(m?s)/g)) {
    const ms = m[2] === 's' ? Number(m[1]) * 1000 : Number(m[1]); if (/lgspin/.test(m[0])) continue; // indicateur de chargement
    assert.ok(ms >= 120 && ms <= 1800, m[0]); if (!/drop/.test(m[0])) assert.ok(ms <= 300, m[0]);
  }
  const run = appli(club(), 'v');
  run(`S.prefs.v = { v: 2, sense: { haptics: true, sound: false, motion: 'reduced' } }; REV++; CORPS = []; document.body.appendChild = el => CORPS.push(el); MINUTEURS = []; setTimeout = (f, ms) => { MINUTEURS.push(ms); return MINUTEURS.length; }; fx.win('Palier 1 atteint', 'Contrats : 100', '<svg></svg>');`);
  const el = J(run, `{ cls: CORPS[0].className, role: CORPS[0].attrs ? CORPS[0].attrs.role : CORPS[0].getAttribute && CORPS[0].getAttribute('role'), html: CORPS[0].innerHTML }`);
  assert.match(el.cls, /fx-texte/); assert.doesNotMatch(el.html, /cel-art/); assert.match(el.html, /Palier 1 atteint/);
  assert.ok(J(run, 'MINUTEURS').includes(1800)); assert.ok(J(run, 'Math.max(...MINUTEURS)') <= 1800);
  const src = readFileSync(new URL('../fx.js', import.meta.url), 'utf8');
  assert.match(src, /setAttribute\('role', 'alert'\)/); assert.match(src, /e\.key === 'Escape' && FX_CELEBRATION\) fxFermerCelebration\(\)/);
  run(`FX_CELEBRATION = { el: { remove() { RETIRE = true; } }, minuteur: 0 }; fxFermerCelebration();`); assert.equal(J(run, 'RETIRE'), true);
});
test('J1 : accessibilité : #toasts poli, cibles de 44 px, pastilles avec libellé, erreurs de formulaire', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /<div id="toasts" role="status" aria-live="polite"><\/div>/);
  assert.match(CSS, /\.reacts button, \.msg \.tools button\[data-em\] \{ min-height: 44px; min-width: 44px;/); assert.match(CSS, /\.pad button \{ min-height: 44px; min-width: 44px; \}/);
  assert.match(readFileSync(new URL('../ui.js', import.meta.url), 'utf8'), /t\.className = 'hdot-t'; t\.textContent = i\.title/);
  const run = appli(club(), 'm'); run(`VIB = []; navigator.vibrate = m => { VIB.push(m); return true; };`);
  run(`fx.error('Indiquez le nom du client.')`); assert.deepEqual(J(run, 'VIB'), [[30, 60, 30]]); assert.deepEqual(J(run, 'TOASTS'), ['Indiquez le nom du client.']);
});

test('J2 : trois retours au premier plan espacés de 6 minutes donnent opens = 3 ; 2 minutes d’écart ne comptent pas ; une écriture par minute au plus', () => {
  const run = appli(club(), 'v');
  run(`T0 = Date.parse(today() + 'T09:00:00'); NOW = T0; Date.now = () => NOW; ECR = 0; const set0 = db.set; db.set = (p, v) => { if (p[0] === 'usage') ECR++; return set0(p, v); }; MIN = []; setTimeout = (f, ms) => { MIN.push(f); return MIN.length; }; clearTimeout = () => {};`);
  run(`usageNote(null, true); NOW += 2 * 60000; usageNote(null, true); NOW += 4 * 60000; usageNote(null, true); NOW += 6 * 60000; usageNote(null, true); MIN.splice(0).forEach(f => f());`);
  assert.equal(J(run, `S.usage.v[today()].opens`), 3);
  run(`usageNote('home'); usageNote('pouls'); usageAction(); usageAction(); const avant = ECR; usageNote('home'); APRES = ECR - avant;`);
  assert.equal(J(run, 'APRES'), 0, 'regroupé : rien n’est écrit avant la minute');
  run(`NOW += 61000; MIN.splice(0).forEach(f => f());`);
  const u = J(run, `S.usage.v[today()]`); assert.deepEqual(u.screens, { home: 2, pouls: 1 }); assert.equal(u.actions, 2); assert.ok(u.firstAt <= u.lastAt);
});
test('J2 : saisie, réaction et issue de relance comptent comme actions ; purge de l’usage de plus de 13 mois', () => {
  const run = appli(club(), 'v'); run(`usageAction = n => { ACT = (typeof ACT === 'number' ? ACT : 0) + (n || 1); }; toastUndo = () => {}; quickAdd('contrats', 1);`);
  assert.equal(J(run, 'ACT'), 1);
  assert.deepEqual(J(run, `['react', 'chatReact', 'relQuick', 'loySessOut'].map(a => USAGE_ACTIONS.has(a))`), [true, true, true, true]);
  run(`S.usage = { v: { '2025-08-31': { opens: 1 }, '2025-09-15': { opens: 1 }, '2026-10-01': { opens: 2 } } }; REV++;`);
  assert.deepEqual(J(run, `usagePurgeOps('v', '2026-10-10').map(o => o[0][2])`), ['2025-08-31']);
});
test('J2 : la page Engagement n’est visible que des managers et du créateur ; moyennes et indicateurs produit', () => {
  const run = appli(club(), 'm');
  run(`const t = today(); S.usage = { v: { [t]: { opens: 4, actions: 6 } }, w: { [t]: { opens: 2, actions: 0 } }, m: { [t]: { opens: 1 } } }; S.serveur = { ouvertures: { at: 1, types: { kudos: { n: 10, o: 4 } } } }; REV++;`);
  assert.equal(J(run, `PAGES.engagement.manager`), true);
  const E = J(run, `engagementEquipe('a')`); assert.equal(E.L.length, 2);
  const v = E.L.find(x => x.uid === 'v'); assert.ok(v.actifs >= 1);
  const html = run(`PAGES.engagement.render()`); assert.match(html, /Engagement de l’équipe/); assert.match(html, /Moyenne de l’équipe/); assert.doesNotMatch(html, /Indicateurs produit/);
  const run2 = appli(club(), 'c'); run2(`const t = today(); S.usage = { v: { [t]: { opens: 4 } }, w: { [addDays(t, -2)]: { opens: 1 } } }; S.serveur = { ouvertures: { at: 1, types: { kudos: { n: 10, o: 4 } } } }; REV++;`);
  const P = J(run2, 'indicateursProduit()'); assert.equal(P.dau, 1); assert.equal(P.wau, 2); assert.equal(P.notifs[0].o / P.notifs[0].n, 0.4);
  assert.match(run2(`PAGES.engagement.render()`), /Ouverture des notifications par type/);
  // Commercial : la page est refusée par le routeur (manager: true).
  const src = readFileSync(new URL('../ui.js', import.meta.url), 'utf8'); assert.match(src, /if \(PAGES\[r\]\.manager && !isManager\(\)\) \{ r = 'home';/);
  assert.equal(J(appli(club(), 'v'), 'isManager()'), false);
});
test('J2 : aucun script tiers de mesure d’audience ; mention dans Profil > Compte', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.doesNotMatch(html, /google-analytics|googletagmanager|gtag\(|matomo|plausible|hotjar|segment\.(com|io)|mixpanel|amplitude|clarity\.ms|facebook\.net/i);
  for (const f of html.match(/src="[^"]+"/g)) assert.doesNotMatch(f, /^src="https?:/, f);
  assert.match(readFileSync(new URL('../pages-team.js', import.meta.url), 'utf8'), /Fit Pulse mesure vos ouvertures pour améliorer l’outil\. Aucun outil publicitaire\./);
});
test('J2 : serveur : taux d’ouverture par type sur 30 jours et purge de l’usage de plus de 13 mois', async () => {
  const { ouverturesParType, usagePurge } = await import('../outils/fitpulse-push.mjs');
  const now = Date.parse('2026-10-10T03:00:00Z');
  const ib = { v: { a: { push: true, kind: 'kudos', at: now - 864e5, readAt: now }, b: { push: true, kind: 'kudos', at: now - 864e5 }, c: { push: true, kind: 'kudos', at: now - 40 * 864e5, readAt: now }, d: { kind: 'info', at: now } } };
  assert.deepEqual(ouverturesParType(ib, now), { kudos: { n: 2, o: 1 } });
  assert.deepEqual(usagePurge({ usage: { v: { '2025-09-09': {}, '2025-09-10': {}, '2026-01-01': {} } } }, '2026-10-10'), { 'v/2025-09-09': null });
});
