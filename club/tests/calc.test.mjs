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
test('zones : 0, 2, 5, 9, 14 mois validés', () => {
  assert.deepEqual(JSON.parse(run('JSON.stringify(ZONES.map(z => [z.label, z.min]))')), [['Zone 1', 0], ['Zone 2', 2], ['Zone 3', 5], ['Zone 4', 9], ['Zone 5', 14]]);
  assert.deepEqual(JSON.parse(run('JSON.stringify([0, 1, 2, 4, 5, 8, 9, 13, 14, 30].map(n => zoneDe(n).label))')), ['Zone 1', 'Zone 1', 'Zone 2', 'Zone 2', 'Zone 3', 'Zone 3', 'Zone 4', 'Zone 4', 'Zone 5', 'Zone 5']);
});
test('un commercial à 4 mois validés (80 % de l’objectif) est en Zone 2', () => {
  const r = boot();
  // Six mois : quatre au-dessus de 80 %, un juste en dessous, un sans objectif.
  r(`(() => { const u = Object.values(S.users).find(x => x.role === 'membre' && !x.virtual); globalThis.UID = u.id; u.clubs = [u.clubs[0]];
    const mois = [5, 4, 3, 2, 1, 0].map(n => addMonths(curMonth(), -n)); pastMonths = () => mois; const scores = [0.8, 1.2, 0.79, 0.95, null, 0.81]; globalThis.SC = Object.fromEntries(mois.map((m, i) => [m, scores[i]]));
    statsFor = (c, uid, rg) => ({ score: SC[rg.from.slice(0, 7)] ?? null, rows: [] }); REV++; })()`);
  assert.equal(r('moisValides(UID).length'), 4);
  assert.equal(r('zoneOf(UID).label'), 'Zone 2');
  assert.equal(r('zoneOf(UID).next.label'), 'Zone 3');
});
test('compte à rebours : jours calendaires et jours ouvrés sans dimanche ni férié', () => {
  // 9 octobre 2026 (vendredi) : 22 jours jusqu'au 31, 23 jours aujourd'hui compris moins 3 dimanches.
  assert.equal(run("compteRebours('2026-10-09').texte"), 'J-22 · 20 jours ouvrés');
  // 28 octobre au 1er novembre exclu : 31 octobre est un samedi, pas de dimanche.
  assert.equal(run("compteRebours('2026-10-28').texte"), 'J-3 · 4 jours ouvrés');
  // Décembre 2026 : le 25 (vendredi) est férié ; du 24 au 31 : 8 jours, moins le 27 (dimanche) et le 25.
  assert.equal(run("compteRebours('2026-12-24').texte"), 'J-7 · 6 jours ouvrés');
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
