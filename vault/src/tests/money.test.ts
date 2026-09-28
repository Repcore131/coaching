import { describe, expect, it } from 'vitest';
import { centsToInput, formatEuro, parseAmount } from '../domain/money';

const ok = (s: string) => {
  const r = parseAmount(s);
  if (!r.ok) throw new Error(`${s}: ${r.error}`);
  return r.cents;
};
const ko = (s: string) => parseAmount(s).ok === false;

describe('parseAmount', () => {
  it('accepte virgule et point', () => {
    expect(ok('12')).toBe(1200);
    expect(ok('12,5')).toBe(1250);
    expect(ok('12.5')).toBe(1250);
    expect(ok('12,05')).toBe(1205);
    expect(ok('0,01')).toBe(1);
    expect(ok(',5')).toBe(50);
    expect(ok('12,')).toBe(1200);
  });
  it('gère les séparateurs de milliers', () => {
    expect(ok('1 250,50')).toBe(125050);
    expect(ok('1 250,50 €')).toBe(125050);
    expect(ok('1.250,50')).toBe(125050);
    expect(ok('1,250.50')).toBe(125050);
    expect(ko('1.250')).toBe(true); // ambigu : refusé plutôt que deviné
    expect(ok('1.000.000')).toBe(100000000);
  });
  it('pas d’erreur d’arrondi flottant', () => {
    expect(ok('0,29')).toBe(29);
    expect(ok('1,15')).toBe(115);
    expect(ok('19,99')).toBe(1999);
  });
  it('refuse les saisies invalides', () => {
    expect(ko('')).toBe(true);
    expect(ko('   ')).toBe(true);
    expect(ko('-5')).toBe(true);
    expect(ko('–5')).toBe(true);
    expect(ko('0')).toBe(true);
    expect(ko('0,00')).toBe(true);
    expect(ko('12,345')).toBe(true);
    expect(ko('abc')).toBe(true);
    expect(ko('1e5')).toBe(true);
    expect(ko(',')).toBe(true);
    expect(ko('1,2,3')).toBe(true);
    expect(ko('1000001')).toBe(true);
  });
});

describe('formatEuro', () => {
  const n = (s: string) => s.replace(/ /g, ' ');
  it('format français', () => {
    expect(n(formatEuro(125050))).toBe('1 250,50 €');
    expect(n(formatEuro(0))).toBe('0,00 €');
    expect(n(formatEuro(-8500))).toBe('– 85,00 €');
    expect(n(formatEuro(8500, { sign: true }))).toBe('+ 85,00 €');
    expect(n(formatEuro(125050, { round: true }))).toBe('1 251 €');
    expect(n(formatEuro(-40, { round: true }))).toBe('0 €');
  });
  it('centsToInput', () => {
    expect(centsToInput(125050)).toBe('1250,50');
    expect(centsToInput(1200)).toBe('12');
    expect(centsToInput(1205)).toBe('12,05');
  });
});
