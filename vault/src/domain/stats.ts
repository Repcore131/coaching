import { addMonths, monthRange } from './dates';
import type { MonthKey, MonthTotals, Transaction } from './types';

export function totalsFor(month: MonthKey, txs: Transaction[]): MonthTotals {
  let income = 0;
  let expense = 0;
  for (const t of txs) {
    if (t.month !== month) continue;
    if (t.kind === 'income') income += t.amount;
    else expense += t.amount;
  }
  return { month, income, expense, savings: income - expense };
}

/** Totaux par mois, pour tous les mois de `from` à `to` (les mois vides valent 0). */
export function totalsByMonth(txs: Transaction[], from: MonthKey, to: MonthKey): MonthTotals[] {
  const map = new Map<MonthKey, MonthTotals>();
  for (const m of monthRange(from, to)) map.set(m, { month: m, income: 0, expense: 0, savings: 0 });
  for (const t of txs) {
    const row = map.get(t.month);
    if (!row) continue;
    if (t.kind === 'income') row.income += t.amount;
    else row.expense += t.amount;
    row.savings = row.income - row.expense;
  }
  return [...map.values()];
}

/** Taux d'épargne en % (entier), ou null s'il n'y a aucune rentrée. */
export function savingsRate(t: MonthTotals): number | null {
  if (t.income <= 0) return null;
  return Math.round((t.savings / t.income) * 100);
}

/** Progression vers l'objectif, entre 0 et 1. */
export function goalProgress(savings: number, goal: number): number {
  if (goal <= 0) return 0;
  return Math.min(1, Math.max(0, savings / goal));
}

export function firstMonth(txs: Transaction[]): MonthKey | null {
  let min: MonthKey | null = null;
  for (const t of txs) if (min === null || t.month < min) min = t.month;
  return min;
}

/** Épargne cumulée depuis la première opération jusqu'au mois `upTo` inclus. */
export function cumulativeSavings(txs: Transaction[], upTo: MonthKey): number {
  let sum = 0;
  for (const t of txs) {
    if (t.month > upTo) continue;
    sum += t.kind === 'income' ? t.amount : -t.amount;
  }
  return sum;
}

/**
 * Nombre de mois d'affilée où l'objectif a été atteint, en remontant depuis `current`.
 * Le mois en cours compte s'il est déjà atteint ; s'il ne l'est pas encore, il ne casse pas la série
 * (le mois n'est pas fini).
 */
export function goalStreak(txs: Transaction[], current: MonthKey, goal: number): number {
  if (goal <= 0) return 0;
  const start = firstMonth(txs);
  if (!start) return 0;
  const rows = totalsByMonth(txs, start, current);
  let streak = 0;
  for (let i = rows.length - 1; i >= 0; i--) {
    const ok = rows[i].savings >= goal;
    if (ok) streak++;
    else if (rows[i].month === current) continue;
    else break;
  }
  return streak;
}

/** Meilleur mois d'épargne (hors mois sans aucune opération). */
export function bestMonth(txs: Transaction[], upTo: MonthKey): MonthTotals | null {
  const start = firstMonth(txs);
  if (!start || start > upTo) return null;
  let best: MonthTotals | null = null;
  for (const row of totalsByMonth(txs, start, upTo)) {
    if (row.income === 0 && row.expense === 0) continue;
    if (!best || row.savings > best.savings) best = row;
  }
  return best;
}

/** Différence d'épargne entre `month` et le mois précédent. */
export function compareWithPrevious(txs: Transaction[], month: MonthKey) {
  const prev = addMonths(month, -1);
  const a = totalsFor(month, txs);
  const b = totalsFor(prev, txs);
  const prevEmpty = b.income === 0 && b.expense === 0;
  return { prev, diff: a.savings - b.savings, prevEmpty };
}
