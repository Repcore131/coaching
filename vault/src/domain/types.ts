export type Kind = 'income' | 'expense';

/** "2026-09" */
export type MonthKey = string;
/** "2026-09-28" — date locale, sans fuseau horaire. */
export type DateKey = string;

export interface Category {
  id: string;
  kind: Kind;
  name: string;
  order: number;
  archived: boolean;
}

export interface Transaction {
  id: string;
  kind: Kind;
  /** Centimes, entier strictement positif. Le signe vient de `kind`. */
  amount: number;
  categoryId: string;
  date: DateKey;
  month: MonthKey;
  note?: string;
  /** Présent si l'opération a été créée par une règle récurrente. */
  recurringId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface RecurringRule {
  id: string;
  kind: Kind;
  amount: number;
  categoryId: string;
  note?: string;
  /** Jour du mois voulu (1–31), ramené au dernier jour si le mois est plus court. */
  dayOfMonth: number;
  startMonth: MonthKey;
  /** Dernier mois pour lequel l'opération a été générée. */
  lastGeneratedMonth: MonthKey;
  active: boolean;
}

export interface Settings {
  id: 'main';
  /** Objectif d'épargne mensuel, en centimes (0 = pas d'objectif). */
  monthlyGoal: number;
}

export interface MonthTotals {
  month: MonthKey;
  income: number;
  expense: number;
  savings: number;
}
