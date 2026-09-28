import type { Category, MonthKey, Transaction } from './types';

export interface BreakdownRow {
  categoryId: string;
  name: string;
  amount: number;
  /** Part du total des dépenses, en % entier. */
  percent: number;
}

/** Dépenses du mois par catégorie, de la plus grosse à la plus petite. */
export function expenseBreakdown(month: MonthKey, txs: Transaction[], categories: Category[]): BreakdownRow[] {
  const sums = new Map<string, number>();
  let total = 0;
  for (const t of txs) {
    if (t.month !== month || t.kind !== 'expense') continue;
    sums.set(t.categoryId, (sums.get(t.categoryId) ?? 0) + t.amount);
    total += t.amount;
  }
  const names = new Map(categories.map((c) => [c.id, c.name]));
  return [...sums.entries()]
    .map(([categoryId, amount]) => ({
      categoryId,
      name: names.get(categoryId) ?? 'Sans catégorie',
      amount,
      percent: total > 0 ? Math.round((amount / total) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
}
