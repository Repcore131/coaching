import { describe, expect, it } from 'vitest';
import { expenseBreakdown } from '../domain/breakdown';
import { addMonths, dayInMonth, deMonth, monthRange } from '../domain/dates';
import { pendingForRule } from '../domain/recurring';
import {
  bestMonth, compareWithPrevious, cumulativeSavings, goalProgress, goalStreak, savingsRate, totalsFor,
} from '../domain/stats';
import type { Kind, RecurringRule, Transaction } from '../domain/types';

let seq = 0;
const tx = (kind: Kind, amount: number, date: string, categoryId = 'c'): Transaction => ({
  id: String(seq++), kind, amount, categoryId, date, month: date.slice(0, 7), createdAt: 0, updatedAt: 0,
});

describe('dates', () => {
  it('addMonths passe les années', () => {
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(addMonths('2026-09', -12)).toBe('2025-09');
  });
  it('monthRange', () => {
    expect(monthRange('2026-11', '2027-02')).toEqual(['2026-11', '2026-12', '2027-01', '2027-02']);
    expect(monthRange('2026-05', '2026-04')).toEqual([]);
  });
  it('dayInMonth ramène au dernier jour', () => {
    expect(dayInMonth('2026-02', 31)).toBe('2026-02-28');
    expect(dayInMonth('2028-02', 31)).toBe('2028-02-29');
    expect(dayInMonth('2026-04', 31)).toBe('2026-04-30');
  });
  it('élision', () => {
    expect(deMonth('2026-08')).toBe("d'août");
    expect(deMonth('2026-10')).toBe("d'octobre");
    expect(deMonth('2026-09')).toBe('de septembre');
  });
});

describe('stats', () => {
  const data = [
    tx('income', 200000, '2026-07-01'), tx('expense', 150000, '2026-07-05'),
    tx('income', 200000, '2026-08-01'), tx('expense', 120000, '2026-08-05'),
    tx('income', 200000, '2026-09-01'), tx('expense', 111500, '2026-09-05'),
  ];
  it('totaux et taux', () => {
    const t = totalsFor('2026-09', data);
    expect(t).toEqual({ month: '2026-09', income: 200000, expense: 111500, savings: 88500 });
    expect(savingsRate(t)).toBe(44);
    expect(savingsRate(totalsFor('2026-10', data))).toBeNull();
  });
  it('progression bornée', () => {
    expect(goalProgress(50, 100)).toBe(0.5);
    expect(goalProgress(-50, 100)).toBe(0);
    expect(goalProgress(500, 100)).toBe(1);
    expect(goalProgress(500, 0)).toBe(0);
  });
  it('cumul, record, comparaison', () => {
    expect(cumulativeSavings(data, '2026-09')).toBe(50000 + 80000 + 88500);
    expect(cumulativeSavings(data, '2026-08')).toBe(130000);
    expect(bestMonth(data, '2026-09')?.month).toBe('2026-09');
    const c = compareWithPrevious(data, '2026-09');
    expect(c.diff).toBe(8500);
    expect(c.prev).toBe('2026-08');
  });
  it('série', () => {
    expect(goalStreak(data, '2026-09', 70000)).toBe(2);
    expect(goalStreak(data, '2026-09', 40000)).toBe(3);
    expect(goalStreak(data, '2026-09', 0)).toBe(0);
    // Mois en cours pas encore atteint : ne casse pas la série.
    expect(goalStreak(data, '2026-09', 85000 + 10000)).toBe(0);
    expect(goalStreak([...data, tx('expense', 1, '2026-10-01')], '2026-10', 70000)).toBe(2);
    // Mois vide au milieu : casse la série.
    const gap = [tx('income', 100, '2026-06-01'), tx('income', 100, '2026-08-01')];
    expect(goalStreak(gap, '2026-08', 100)).toBe(1);
  });
  it('répartition', () => {
    const rows = expenseBreakdown('2026-09', [
      tx('expense', 3000, '2026-09-01', 'a'), tx('expense', 1000, '2026-09-02', 'b'),
      tx('expense', 1000, '2026-09-03', 'a'), tx('income', 9999, '2026-09-03', 'a'),
    ], [{ id: 'a', kind: 'expense', name: 'Courses', order: 0, archived: false }]);
    expect(rows).toEqual([
      { categoryId: 'a', name: 'Courses', amount: 4000, percent: 80 },
      { categoryId: 'b', name: 'Sans catégorie', amount: 1000, percent: 20 },
    ]);
  });
});

describe('récurrent', () => {
  const rule: RecurringRule = {
    id: 'r', kind: 'expense', amount: 65000, categoryId: 'loyer', dayOfMonth: 31,
    startMonth: '2026-01', lastGeneratedMonth: '2026-01', active: true,
  };
  let i = 0;
  const id = () => `g${i++}`;
  it('rattrape les mois manquants', () => {
    const r = pendingForRule(rule, '2026-04', id, 0);
    expect(r.txs.map((t) => t.date)).toEqual(['2026-02-28', '2026-03-31', '2026-04-30']);
    expect(r.lastGeneratedMonth).toBe('2026-04');
    expect(r.txs.every((t) => t.recurringId === 'r')).toBe(true);
  });
  it('idempotent et inactif', () => {
    expect(pendingForRule({ ...rule, lastGeneratedMonth: '2026-04' }, '2026-04', id, 0).txs).toHaveLength(0);
    expect(pendingForRule({ ...rule, active: false }, '2026-04', id, 0).txs).toHaveLength(0);
  });
});
