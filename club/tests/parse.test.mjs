// node --test club/tests  (TZ=Europe/Paris)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const { parseMontant, parseDate } = createRequire(import.meta.url)('../parse.js');

test('montants', () => {
  const cas = { '1 234,56': 1234.56, '1 234,56': 1234.56, '1.234,56': 1234.56, '1,234.56': 1234.56, '1.234.567,89': 1234567.89,
    '-12,00 €': -12, '12,00-': -12, '(12,00)': -12, '¤ 12,50': 12.5, '12,50 ¤': 12.5, 'EUR 12,50': 12.5, '0,5': 0.5, '2 000': 2000,
    '1.234': 1234, '1234,5': 1234.5, '59,90': 59.9, '12': 12 };
  for (const [s, v] of Object.entries(cas)) assert.equal(parseMontant(s), v, s);
  assert.ok(Number.isNaN(parseMontant('abc'))); assert.ok(Number.isNaN(parseMontant('')));
  assert.equal(parseMontant('1,234'), 1.234, 'CSV francais : la virgule est decimale');
});
test('dates', () => {
  assert.equal(parseDate('05/10/26'), '2026-10-05');
  assert.equal(parseDate('05/10/2026'), '2026-10-05');
  assert.equal(parseDate('2026-10-05'), '2026-10-05');
  assert.equal(parseDate('31/02/2026'), null);
  assert.equal(parseDate('10/25/26'), null);
  assert.equal(parseDate('12/03/85'), '1985-03-12');
  assert.equal(parseDate('45935'), '2025-10-05');
  assert.equal(parseDate('2026-10-05T23:30:00Z'), '2026-10-06');
  assert.equal(parseDate('2026-13-01'), null);
});
