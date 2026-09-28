import type { Category, Kind } from './types';

const INCOME = ['Salaire', 'Coaching', 'Prime', 'Autre'];
const EXPENSE = ['Loyer', 'Courses', 'Transport', 'Abonnements', 'Sorties', 'Compléments', 'Autre'];

export function defaultCategories(): Category[] {
  const make = (kind: Kind, names: string[]) =>
    names.map((name, order) => ({ id: `${kind}-${order}`, kind, name, order, archived: false }));
  return [...make('income', INCOME), ...make('expense', EXPENSE)];
}
