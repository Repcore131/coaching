// node --test scripts/verif/rapport_erreurs.test.mjs — sur une fausse base.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rapportErreurs, texteRapport } from '../rapport_erreurs.mjs';

const E = (n, m) => ({ n, m: m || 'x is undefined', ou: 'js', s: 'rc-core.js:1' });
test('nouvelle, doublée, stable ; quota 72 %', () => {
  const parJour = {
    '2026-10-05': { 1937: { a: E(2), b: E(10) } },
    '2026-10-06': { 1937: { a: E(2), b: E(10) } },
    '2026-10-07': { 1937: { a: E(5), b: E(11), c: E(1, 'nouvelle erreur') } },
  };
  const r = rapportErreurs(parJour, { '2026-10-01': { oct_out_ko: 7.2e6 }, '2026-09-30': { oct_out_ko: 9e6 } }, '2026-10-07', '2026-10');
  assert.deepEqual(r.nouvelles.map((x) => x.h), ['c']);
  assert.deepEqual(r.doublees.map((x) => x.h), ['a']);
  assert.equal(r.quota.seuil, 70);
  assert.equal(r.envoyer, true);
  assert.match(texteRapport(r, '2026-10-07'), /Nouvelles \(1\)[\s\S]*En hausse \(1\)[\s\S]*au-delà de 70 %/);
});
test('rien de neuf et quota bas : pas de courriel', () => {
  const r = rapportErreurs({ '2026-10-06': { 1937: { a: E(3) } }, '2026-10-07': { 1937: { a: E(3) } } }, { '2026-10-01': { oct_out_ko: 1e6 } }, '2026-10-07', '2026-10');
  assert.equal(r.envoyer, false);
});
