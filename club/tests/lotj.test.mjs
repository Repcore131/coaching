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

test('J4 : carte Arrivée des exports : manager et créateur seulement ; club sans configuration : Dépôt manuel seul, actif', () => {
  const run = appli(club(), 'm');
  const h = run('arriveeExportsCard()'); assert.match(h, /Arrivée des exports/);
  assert.deepEqual(J(run, 'ingestCanaux().map(c => [c.k, c.status])'), [['manual', 'actif']]);
  assert.equal(J(appli(club(), 'v'), 'arriveeExportsCard()'), '');
  assert.match(J(appli(club(), 'c'), 'arriveeExportsCard()'), /Dépôt manuel/);
  assert.match(readFileSync(new URL('../pages-data.js', import.meta.url), 'utf8'), /arriveeExportsCard\(\)/);
});
test('J4 : mode Cloud : 4 lignes avec état, dernier fichier et nombre du mois ; aucun secret enregistré', () => {
  const run = appli(club(), 'm'); run(`S.serveur = { ingestCloud: true }; REV++;`); const t = Date.now();
  const r = J(run, `ingestCanalOps('a', { api_status: 'en attente', mail_status: 'actif', drive_status: 'actif', drive_folder: '1AbCdEfGhIjKlMnOp', token: 'x', password: 'y' })`);
  run(`db.batch(${JSON.stringify(r.ops)}); S.rsm = { autoLog: { a: { l1: { at: ${t}, name: 'RSM_clients.csv', source: 'auto' }, l2: { at: ${t - 1000}, name: 'RSM_ventes.csv', canal: 'drive' } } } };
    S.imports = { i1: { id: 'i1', clubId: 'a', at: ${t - 5000}, name: 'RSM_paiements.csv', by: 'm' } }; REV++;`);
  const L = J(run, 'ingestCanaux().map(c => [c.k, c.status])'); assert.deepEqual(L, [['api', 'en attente'], ['mail', 'actif'], ['drive', 'actif'], ['manual', 'actif']]);
  const St = J(run, 'ingestStats()'); assert.equal(St.mail.dernier.name, 'RSM_clients.csv'); assert.equal(St.drive.ceMois, 1); assert.equal(St.manual.dernier.name, 'RSM_paiements.csv'); assert.equal(St.api.ceMois, 0);
  const cfg = J(run, `S.ingestConfig.a`); assert.match(cfg.mail.address, /^club-a-[a-z2-9]{4}@import\.fitpulse\.app$/);
  assert.doesNotMatch(JSON.stringify(cfg), /token|password|secret/i);
  const h = run('arriveeExportsCard()'); assert.equal((h.match(/<tr data-canal=/g) || []).length, 4);
  assert.doesNotMatch(h, /[–—]/);
});

test('J5 : aucun identifiant ni en-tête Resamania dans le front (sources du bundle et fichier construit)', async () => {
  const { existsSync } = await import('node:fs');
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const fichiers = html.match(/src="[a-z0-9-]+\.js"/g).map(s => s.slice(5, -1));
  const INTERDIT = /gravitee|RSM_API_KEY|RSM_CLIENT_(ID|SECRET)|RSM_HOOK_SECRET|client_secret|x-user-club-id|x-user-network-node-id|clientToken/i;
  for (const f of fichiers) assert.doesNotMatch(readFileSync(new URL('../' + f, import.meta.url), 'utf8'), INTERDIT, f);
  const dist = new URL('../_dist/fitpulse.html', import.meta.url);
  if (existsSync(dist)) assert.doesNotMatch(readFileSync(dist, 'utf8'), INTERDIT, '_dist/fitpulse.html');
});

// ── Point 9 : moteur d'import pur ──────────────────────────────────────────
const demo = () => { const run = chargerAppli({}); run(`S = normalizeState(demoState()); ME = Object.values(S.users).find(u => u.role === 'manager'); CLUB = S.clubs[DEMO_CLUB.id]; REV++; toast = () => {};`); return run; };
const viaAncien = (run, nom, csv) => J(run, `(() => { const B = [analyzeTable({ name: ${JSON.stringify(nom)}, ...parseCSV(${JSON.stringify(csv)}) }, { clubId: CLUB.id, month: addMonths(curMonth(), -1) })]; return rsmCommitPlan(B, { club: CLUB.id, by: 'u1', now: 1 }).summary; })()`);
const viaMoteur = async (run, nom, csv, by = 'u1', choices = {}) => JSON.parse(await run(`(async () => { const b = new TextEncoder().encode(${JSON.stringify(csv)}); const B = await analyzeFile(b, ${JSON.stringify(nom)}, { clubId: CLUB.id, state: S }); const P = planImport(B, S, {}, { club: CLUB.id, by: ${JSON.stringify(by)}, choices: ${JSON.stringify(choices)}, now: 1 }); return JSON.stringify({ summary: P.summary, pending: P.pending, ops: P.ops, lignes: lignesVendeur(B, (P.pending.find(p => p.kind === 'seller') || {}).keys) }); })()`));

test('J9 : les fichiers de démonstration donnent le même résumé avant et après le moteur commun', async () => {
  for (const [type, nom] of [['ventes', 'RSM_ventes-abonnements_exemple.csv'], ['incidents', 'RSM_clients-en-incident_exemple.csv'], ['resiliations', 'RSM_resiliations_exemple.csv']]) {
    const run = demo(); const csv = run(`demoCsv(${JSON.stringify(type)})`);
    const avant = viaAncien(run, nom, csv); const apres = (await viaMoteur(demo(), nom, csv)).summary;
    assert.deepEqual(apres, avant, type); assert.ok(avant.files === 1, type);
  }
});
test('J9 : import automatique, vendeur inconnu : aucune saisie à son nom, une ligne en attente, rejouée au rattachement sans doublon', async () => {
  const run = demo(); const d = run(`addDays(today(), -3).split('-').reverse().join('/')`);
  const csv = ['Numéro du client;Date de création;Prénom;Nom;Nom du produit;Nom de l’offre;Échéancier;État;Canal;Prix toutes taxes;Prénom du commercial initial;Nom du commercial initial;Code du commercial initial',
    `90001;${d};Lina;Petit;Abonnement Premium;Premium;Mensuel;Validé;Club;39,99;Zoé;Inconnue;ZINC`, `90002;${d};Marc;Roux;Abonnement Premium;Premium;Mensuel;Validé;Club;39,99;Zoé;Inconnue;ZINC`].join('\r\n');
  const P = await viaMoteur(run, 'RSM_ventes.csv', csv, 'auto:mail');
  const vendeur = P.pending.find(p => p.kind === 'seller'); assert.ok(vendeur, JSON.stringify(P.pending)); assert.equal(vendeur.count, 2);
  assert.equal(P.ops.filter(([p]) => p[0] === 'entries' && p.length === 2).length, 0, 'aucune saisie au nom d’un vendeur inconnu');
  assert.equal(P.lignes[0].entries.length, 2);
  assert.equal(P.ops.find(([p]) => p[0] === 'imports' && p.length === 2)[1].by, 'auto:mail');
  // Le manager rattache le vendeur : les lignes en attente sont rejouées, une fois.
  const uid = run(`commerciaux(CLUB.id).find(u => u.role === 'membre').id`);
  const ops1 = J(run, `rejouerOps(${JSON.stringify({ id: 'p1', label: vendeur.label, lignes: P.lignes })}, '${uid}', { club: CLUB.id, by: ME.id, now: 2, state: S })`);
  assert.equal(ops1.filter(([p]) => p[0] === 'entries').length, 2);
  run(`db.batch(${JSON.stringify(ops1)}); REV++;`);
  const ops2 = J(run, `rejouerOps(${JSON.stringify({ id: 'p1', label: vendeur.label, lignes: P.lignes })}, '${uid}', { club: CLUB.id, by: ME.id, now: 3, state: S })`);
  assert.deepEqual(ops2, [], 'rejouer une deuxième fois ne change rien');
  // Le même fichier, une fois le vendeur connu : mêmes clés de saisie (hkey), aucune nouvelle ligne.
  const P2 = await viaMoteur(run, 'RSM_ventes.csv', csv, 'auto:mail', { [vendeur.keys[0]]: uid });
  assert.deepEqual(P2.ops.filter(([p]) => p[0] === 'entries' && p.length === 2).map(([p]) => p[1]).sort(), ops1.filter(([p]) => p[0] === 'entries').map(([p]) => p[1]).sort());
  assert.equal(P2.summary.entries, 0); assert.equal(P2.summary.updated, 2);
  assert.throws(() => run(`planImport([], S, {}, { club: CLUB.id, by: 'auto:fax' })`) && run(`planImport([], S, {}, { club: CLUB.id, by: 'n’importe quoi' })`));
});
test('J9 : le moteur ne touche ni au DOM ni à l’état de l’appli ; rsmCommit applique simplement le plan', () => {
  const src = readFileSync(new URL('../resamania-core.js', import.meta.url), 'utf8').replace(/\/\/.*$/gm, '');
  const pur = src.slice(0, src.indexOf('function applyOps'));
  assert.doesNotMatch(pur, /document\.|window\.|\$\(|UI\.|ME\.|CLUB\.|render\(/);
  const run = demo(); const avant = run(`JSON.stringify(S)`); run(`planImport([], S, {}, { club: CLUB.id, by: 'auto:api' })`); assert.equal(run(`JSON.stringify(S)`), avant);
  assert.match(readFileSync(new URL('../pages-resamania.js', import.meta.url), 'utf8'), /applyOps\(plan\.ops\);/);
});

test('J10 : onglet Imports > Automatique : 30 derniers rapports, filtre par statut, lignes en attente rattachées', () => {
  const run = appli(club(), 'm');
  run(`INGEST_RAPPORTS.a = Object.fromEntries(Array.from({ length: 35 }, (_, i) => ['r' + i, { file: 'f' + i + '.csv', canal: i % 2 ? 'drive' : 'mail', rowsRead: 10, rowsImported: 8, pending: i === 34 ? 2 : 0, ms: 1200, status: i === 34 ? 'done_with_pending' : i === 33 ? 'failed' : 'done', receivedAt: i * 1000, at: i * 1000, warnings: [] }]));
    INGEST_ATTENTES.a = { p1: { id: 'p1', kind: 'seller', label: 'Zoé Inconnue', keys: ['zinc', 'zoe inconnue'], count: 2, file: 'f34.csv' } }; REV++;`);
  const h = run('ingestAutoTab()'); assert.equal((h.match(/<tr data-statut=/g) || []).length, 30); assert.match(h, /Voir les lignes en attente \(2\)/);
  assert.match(h, /f34\.csv/); assert.doesNotMatch(h, /f4\.csv/);
  run(`UI.ingFiltre = 'failed'`); const h2 = run('ingestAutoTab()'); assert.equal((h2.match(/<tr data-statut="failed"/g) || []).length, 1); assert.equal((h2.match(/<tr data-statut=/g) || []).length, 1);
  assert.deepEqual(J(run, `ingestRattacherOps(INGEST_ATTENTES.a.p1, 'v')`), [[['rsm', 'aliases', 'zinc'], 'v'], [['rsm', 'aliases', 'zoe inconnue'], 'v']]);
  assert.deepEqual(J(run, `ingestRattacherOps(INGEST_ATTENTES.a.p1, 'inconnu')`), []);
  assert.match(readFileSync(new URL('../pages-data.js', import.meta.url), 'utf8'), /\[\['automatique', 'Automatique'\]\]/);
});
test('J6 : adresse d’import {slugClub}-{4 caractères}@import.fitpulse.app, régénérable ; liste blanche', () => {
  const run = appli({ ...club(), clubs: { a: { id: 'a', name: 'Club Énergie Niort-Est' } } }, 'm');
  const adr = J(run, `ingestAdresse('a')`); assert.match(adr, /^club-energie-niort-est-[a-z2-9]{4}@import\.fitpulse\.app$/);
  run(`db.batch(1 ? ingestCanalOps('a', { mail_status: 'actif', mail_allow: 'exports@resamania.example, @club.example, pas-une-adresse' }).ops : []); REV++;`);
  const m1 = J(run, `S.ingestConfig.a.mail`); assert.deepEqual(Object.values(m1.allow), ['exports@resamania.example', '@club.example']);
  run(`db.batch(ingestRegenererOps('a', 5)); REV++;`); const m2 = J(run, `S.ingestConfig.a.mail`);
  assert.notEqual(m2.address, m1.address); assert.equal(m2.rotatedAt, 5); assert.deepEqual(m2.allow, m1.allow);
  assert.deepEqual(J(run, `ingestAutoriserOps('a', 'Nouveau@Exemple.fr')`), [[['ingestConfig', 'a', 'mail', 'allow', '2'], 'nouveau@exemple.fr']]);
});
test('J6 : page d’aide « Créer la règle de transfert » (Gmail et Outlook), réservée aux managers', () => {
  const run = appli(club(), 'm'); run(`S.serveur = { ingestCloud: true }; db.batch(ingestCanalOps('a', { mail_status: 'actif' }).ops); REV++;`);
  assert.equal(J(run, `PAGES['aide-transfert'].manager`), true);
  const h = run(`PAGES['aide-transfert'].render()`); const adr = J(run, `S.ingestConfig.a.mail.address`);
  assert.match(h, /Gmail/); assert.match(h, /Outlook/); assert.ok(h.includes(adr)); assert.match(h, /Capture 1 à venir/); assert.doesNotMatch(h, /[–—]/);
  assert.match(run('arriveeExportsCard()'), /#\/aide-transfert/);
});

test('Mode gratuit : sans fonctions Cloud, la carte montre la boîte Gmail et le Drive du club relevés par le serveur, jamais l’adresse payante', () => {
  const run = appli(club(), 'm');
  assert.deepEqual(J(run, 'ingestCanaux().map(c => [c.k, c.status])'), [['manual', 'actif']]);
  run(`S.clubs.a.rsmAuto = { label: 'Resamania', driveFolder: '1AbCdEfGhIjKl' }; REV++;`);
  assert.deepEqual(J(run, 'ingestCanaux().map(c => [c.k, c.status])'), [['mail', 'en attente'], ['drive', 'en attente'], ['manual', 'actif']]);
  run(`S.rsm = { autoMeta: { a: { lastRunAt: 5 } }, autoLog: { a: { l1: { at: Date.now(), name: 'RSM_clients.csv', source: 'mail' } } } }; REV++;`);
  assert.equal(J(run, 'ingestCanaux()[0].status'), 'actif');
  const h = run('arriveeExportsCard()');
  assert.match(h, /Boîte Gmail du club/); assert.match(h, /Libellé Gmail « Resamania »/); assert.match(h, /data-act="rsmAutoCfg"/);
  assert.doesNotMatch(h, /import\.fitpulse\.app|ingestJeton|aide-transfert|Régénérer/);
  assert.match(h, /Sans frais/); assert.match(h, /RSM_clients\.csv/);
});
test('Mode gratuit : boîte de l’accueil reliée sans réglage d’import : relevée par défaut, affichée sur la carte', () => {
  const run = appli(club(), 'm'); run(`S.clubs.a.mailSources = { inbox: 'accueil@club.example' }; REV++;`);
  const L = J(run, 'ingestCanaux()'); assert.deepEqual(L.map(c => [c.k, c.status]), [['mail', 'en attente'], ['manual', 'actif']]);
  assert.match(L[0].detail, /boîte de l’accueil/);
});
