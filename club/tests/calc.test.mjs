// Tests du moteur de calcul Fit Pulse : le vrai code (core, parse, calc) chargé dans un contexte isolé.
// Lancer : TZ=Europe/Paris node --test club/tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';

const dir = new URL('..', import.meta.url);
function boot() {
  const noop = () => {};
  const ctx = { console, Date, Math, Intl, JSON, URLSearchParams, URL, setTimeout, clearTimeout, setInterval: noop, queueMicrotask, crypto: webcrypto, TextEncoder,
    navigator: { onLine: true, userAgent: 'node' }, addEventListener: noop, matchMedia: () => ({ matches: false }), requestAnimationFrame: noop,
    document: { addEventListener: noop, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ style: {} }), body: { appendChild: noop } },
    location: { hostname: 'localhost', search: '', hash: '' }, indexedDB: undefined };
  ctx.window = ctx; vm.createContext(ctx);
  for (const f of ['config.js', 'txt.js', 'core.js', 'parse.js', 'resamania.js', 'calc.js']) vm.runInContext(readFileSync(new URL(f, dir), 'utf8'), ctx, { filename: f });
  vm.runInContext('S = normalizeState(demoState()); REV++;', ctx);
  return (code) => vm.runInContext(code, ctx);
}
const run = boot();

test('étapes de points : 25, 50, 75, 100 %', () => {
  assert.equal(run('tierOf(0.24)'), 0);
  assert.equal(run('tierOf(0.59)'), 0.5);
  assert.equal(run('tierOf(0.60)'), 0.5);
  assert.equal(run('tierOf(0.75)'), 0.75);
  assert.equal(run('tierOf(1.4)'), 1);
});
test('plafond du score à 150 %', () => { assert.equal(run('SCORE_CAP'), 1.5); });
test('bonus de dépassement : +10 % par tranche de 10 %, plafonné à 150 %', () => {
  assert.equal(run("overBonus({ rows: [{ pct: 1.25, k: { points: 1000 } }] })"), 200);
  assert.equal(run("overBonus({ rows: [{ pct: 3, k: { points: 1000 } }] })"), 500);
  assert.equal(run("overBonus({ rows: [{ pct: 0.9, k: { points: 1000 } }] })"), 0);
});
test('niveaux : Recrue, Confirmé, Expert, Référent à 0, 2, 6, 12 mois à 100 %', () => {
  assert.deepEqual(JSON.parse(run('JSON.stringify(LEVELS.map(z => [z.label, z.min]))')), [['Recrue', 0], ['Confirmé', 2], ['Expert', 6], ['Référent', 12]]);
  assert.deepEqual(JSON.parse(run('JSON.stringify([0, 1, 2, 5, 6, 11, 12, 30].map(n => zoneDe(n).label))')), ['Recrue', 'Recrue', 'Confirmé', 'Confirmé', 'Expert', 'Expert', 'Référent', 'Référent']);
});
test('un commercial avec 3 mois à 100 % ou plus est Confirmé', () => {
  const r = boot();
  // Six mois : trois à 100 % ou plus, deux juste en dessous, un sans objectif.
  r(`(() => { const u = Object.values(S.users).find(x => x.role === 'membre' && !x.virtual); globalThis.UID = u.id; u.clubs = [u.clubs[0]];
    const mois = [5, 4, 3, 2, 1, 0].map(n => addMonths(curMonth(), -n)); pastMonths = () => mois; const scores = [1, 1.2, 0.99, 0.95, null, 1.01]; globalThis.SC = Object.fromEntries(mois.map((m, i) => [m, scores[i]]));
    statsFor = (c, uid, rg) => ({ score: SC[rg.from.slice(0, 7)] ?? null, rows: [] }); REV++; })()`);
  assert.equal(r('moisValides(UID).length'), 3);
  assert.equal(r('levelOf(UID).label'), 'Confirmé');
  assert.equal(r('levelOf(UID).next.label'), 'Expert');
});
test('compte à rebours : jours ouvrés restants, lundi au samedi, sans férié (2026 et 2027)', () => {
  // 9 octobre 2026 (vendredi) : 23 jours aujourd'hui compris moins 3 dimanches.
  assert.equal(run("compteRebours('2026-10-09').texte"), '20 jours ouvrés restants');
  assert.equal(run("compteRebours('2026-10-31').texte"), '1 jour ouvré restant');
  // Décembre 2026 : le 25 (vendredi) est férié ; du 24 au 31 : 8 jours, moins le 27 (dimanche) et le 25.
  assert.equal(run("compteRebours('2026-12-24').texte"), '6 jours ouvrés restants');
  // Lundi de Pâques 2027 (29 mars) et Ascension 2027 (6 mai) sont fériés.
  assert.equal(run("estFerie('2027-03-29') && estFerie('2027-05-06') && estFerie('2027-05-17')"), true);
});
test('montants français', () => {
  assert.equal(run("parseMontant('1 234,50 €')"), 1234.5);
  assert.equal(run("parseMontant('12,5')"), 12.5);
});
test('points d’action : 300 par semaine au plus, une fiche par jour', () => {
  const pts = run(`(() => { const uid = 'u3'; for (let i = 0; i < 60; i++) { const id = 't' + i; S.loyalty[id] = { id, clientId: 'cx' + i, type: 'suivi', userId: uid, outcome: 'ok', at: Date.now() - i * 1000 }; }
    S.loyalty.dup = { id: 'dup', clientId: 'cx0', type: 'suivi', userId: uid, outcome: 'ok', at: Date.now() - 500 }; REV++; return actionPoints(uid, weekStart(today()), today()); })()`);
  assert.ok(pts <= 300, `obtenu ${pts}`);
});
test('le score du classement ne dépend pas des points d’action', () => {
  const before = run("statsFor('niort', 'u3', rangeOf('month', curMonth()), { requiredOnly: true }).score");
  run("S.loyalty.extra = { id: 'extra', clientId: 'cz', type: 'suivi', userId: 'u3', outcome: 'paid', at: Date.now() }; REV++;");
  assert.equal(run("statsFor('niort', 'u3', rangeOf('month', curMonth()), { requiredOnly: true }).score"), before);
});
test('une vente absente du dernier import ne compte plus, et revient si cet import est annulé', () => {
  run("S.imports.imp1 = { id: 'imp1', active: true }; S.imports.imp2 = { id: 'imp2', active: true }; REV++;");
  assert.equal(run("entryCounts({ removedBy: 'imp2', source: 'import', importIds: { imp1: true } })"), false);
  run("S.imports.imp2.active = false; REV++;");
  assert.equal(run("entryCounts({ removedBy: 'imp2', source: 'import', importIds: { imp1: true } })"), true);
});
