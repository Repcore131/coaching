import Dexie, { type Table } from 'dexie';
import type { Category, RecurringRule, Settings, Transaction } from '../domain/types';

export class VaultDB extends Dexie {
  transactions!: Table<Transaction, string>;
  categories!: Table<Category, string>;
  recurring!: Table<RecurringRule, string>;
  settings!: Table<Settings, string>;

  constructor(name = 'vault') {
    super(name);
    this.version(1).stores({
      transactions: 'id, month, date, kind, categoryId, recurringId',
      categories: 'id, kind, order',
      recurring: 'id, active',
      settings: 'id',
    });
  }
}
