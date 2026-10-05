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
  for (const f of ['config.js', 'core.js', 'parse.js', 'resamania.js', 'calc.js']) vm.runInContext(readFileSync(new URL(f, dir), 'utf8'), ctx, { filename: f });
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
test('niveaux recalibrés', () => {
  assert.deepEqual(JSON.parse(run('JSON.stringify(LEVELS.map(l => l.min))')), [0, 3000, 10000, 25000, 50000]);
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
