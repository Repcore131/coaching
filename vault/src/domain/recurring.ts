import { addMonths, dayInMonth, monthRange } from './dates';
import type { MonthKey, RecurringRule, Transaction } from './types';

/**
 * Opérations à créer pour rattraper une règle récurrente jusqu'au mois `upTo` inclus.
 * Pure : ne touche à rien, renvoie les opérations et le nouveau `lastGeneratedMonth`.
 */
export function pendingForRule(
  rule: RecurringRule,
  upTo: MonthKey,
  newId: () => string,
  now: number,
): { txs: Transaction[]; lastGeneratedMonth: MonthKey } {
  if (!rule.active || rule.lastGeneratedMonth >= upTo) {
    return { txs: [], lastGeneratedMonth: rule.lastGeneratedMonth };
  }
  const from = addMonths(rule.lastGeneratedMonth, 1);
  const txs = monthRange(from, upTo).map((month) => ({
    id: newId(),
    kind: rule.kind,
    amount: rule.amount,
    categoryId: rule.categoryId,
    date: dayInMonth(month, rule.dayOfMonth),
    month,
    note: rule.note,
    recurringId: rule.id,
    createdAt: now,
    updatedAt: now,
  }));
  return { txs, lastGeneratedMonth: upTo };
}
