import { liveQuery } from 'dexie';
import { BACKUP_VERSION, type Backup } from '../domain/backup';
import { currentMonth, monthOf } from '../domain/dates';
import { defaultCategories } from '../domain/defaults';
import { pendingForRule } from '../domain/recurring';
import type { Category, Kind, MonthKey, Settings, Transaction } from '../domain/types';
import { VaultDB } from './db';
import type { TransactionInput, VaultRepository } from './repository';

const DEFAULT_SETTINGS: Settings = { id: 'main', monthlyGoal: 0 };

export const newId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

function clean(input: TransactionInput) {
  const note = input.note?.trim();
  return {
    kind: input.kind,
    amount: input.amount,
    categoryId: input.categoryId,
    date: input.date,
    month: monthOf(input.date),
    note: note ? note.slice(0, 120) : undefined,
  };
}

export class DexieRepository implements VaultRepository {
  constructor(private db = new VaultDB()) {}

  async init() {
    await this.db.transaction('rw', this.db.categories, this.db.settings, async () => {
      if ((await this.db.categories.count()) === 0) await this.db.categories.bulkAdd(defaultCategories());
      if (!(await this.db.settings.get('main'))) await this.db.settings.put(DEFAULT_SETTINGS);
    });
  }

  async addTransaction(input: TransactionInput, opts: { recurring?: boolean } = {}) {
    const now = Date.now();
    const data = clean(input);
    const tx: Transaction = { id: newId(), ...data, createdAt: now, updatedAt: now };
    await this.db.transaction('rw', this.db.transactions, this.db.recurring, async () => {
      if (opts.recurring) {
        const ruleId = newId();
        tx.recurringId = ruleId;
        await this.db.recurring.add({
          id: ruleId,
          kind: data.kind,
          amount: data.amount,
          categoryId: data.categoryId,
          note: data.note,
          dayOfMonth: Number(data.date.slice(8, 10)),
          startMonth: data.month,
          lastGeneratedMonth: data.month,
          active: true,
        });
      }
      await this.db.transactions.add(tx);
    });
    // Une récurrence saisie sur un mois passé est rattrapée tout de suite.
    if (opts.recurring) await this.generateRecurring(currentMonth());
    return tx;
  }

  async updateTransaction(id: string, input: TransactionInput) {
    await this.db.transactions.update(id, { ...clean(input), updatedAt: Date.now() });
  }

  async deleteTransaction(id: string) {
    await this.db.transactions.delete(id);
  }

  async restoreTransaction(tx: Transaction) {
    await this.db.transactions.put(tx);
  }

  async generateRecurring(upTo: MonthKey) {
    let created = 0;
    await this.db.transaction('rw', this.db.transactions, this.db.recurring, async () => {
      const rules = await this.db.recurring.toArray();
      const now = Date.now();
      for (const rule of rules) {
        const { txs, lastGeneratedMonth } = pendingForRule(rule, upTo, newId, now);
        if (txs.length === 0) continue;
        await this.db.transactions.bulkAdd(txs);
        await this.db.recurring.update(rule.id, { lastGeneratedMonth });
        created += txs.length;
      }
    });
    return created;
  }

  async stopRecurring(ruleId: string) {
    await this.db.recurring.update(ruleId, { active: false });
  }

  async saveCategory(cat: Category) {
    await this.db.categories.put({ ...cat, name: cat.name.trim().slice(0, 40) || 'Sans nom' });
  }

  async addCategory(kind: Kind, name: string) {
    const siblings = await this.db.categories.where('kind').equals(kind).toArray();
    const cat: Category = {
      id: newId(),
      kind,
      name: name.trim().slice(0, 40) || 'Sans nom',
      order: siblings.reduce((m, c) => Math.max(m, c.order), -1) + 1,
      archived: false,
    };
    await this.db.categories.add(cat);
    return cat;
  }

  async saveSettings(patch: Partial<Omit<Settings, 'id'>>) {
    const cur = (await this.db.settings.get('main')) ?? DEFAULT_SETTINGS;
    await this.db.settings.put({ ...cur, ...patch, id: 'main' });
  }

  async exportAll(): Promise<Backup> {
    const [categories, transactions, recurring, settings] = await Promise.all([
      this.db.categories.toArray(),
      this.db.transactions.toArray(),
      this.db.recurring.toArray(),
      this.db.settings.get('main'),
    ]);
    return {
      app: 'vault',
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      categories,
      transactions,
      recurring,
      settings: settings ?? DEFAULT_SETTINGS,
    };
  }

  async importAll(data: Backup) {
    const { db } = this;
    await db.transaction('rw', db.transactions, db.categories, db.recurring, db.settings, async () => {
      await Promise.all([db.transactions.clear(), db.categories.clear(), db.recurring.clear(), db.settings.clear()]);
      await db.categories.bulkAdd(data.categories);
      await db.transactions.bulkAdd(data.transactions);
      await db.recurring.bulkAdd(data.recurring);
      await db.settings.put(data.settings);
    });
  }

  async resetAll() {
    const { db } = this;
    await db.transaction('rw', db.transactions, db.categories, db.recurring, db.settings, async () => {
      await Promise.all([db.transactions.clear(), db.categories.clear(), db.recurring.clear(), db.settings.clear()]);
    });
    await this.init();
  }

  private watch<T>(query: () => Promise<T>, cb: (v: T) => void) {
    const sub = liveQuery(query).subscribe({ next: cb, error: (e) => console.error(e) });
    return () => sub.unsubscribe();
  }

  watchTransactions(cb: (txs: Transaction[]) => void) {
    return this.watch(() => this.db.transactions.toArray(), cb);
  }
  watchCategories(cb: (cats: Category[]) => void) {
    return this.watch(() => this.db.categories.orderBy('order').toArray(), cb);
  }
  watchRecurring(cb: Parameters<VaultRepository['watchRecurring']>[0]) {
    return this.watch(() => this.db.recurring.toArray(), cb);
  }
  watchSettings(cb: (s: Settings) => void) {
    return this.watch(async () => (await this.db.settings.get('main')) ?? DEFAULT_SETTINGS, cb);
  }
}
