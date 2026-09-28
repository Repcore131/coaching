import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { parseBackup } from '../domain/backup';
import { VaultDB } from '../data/db';
import { DexieRepository } from '../data/dexieRepository';

describe('dépôt Dexie + sauvegarde', () => {
  it('aller-retour export / import', async () => {
    const repo = new DexieRepository(new VaultDB('t1'));
    await repo.init();
    await repo.addTransaction({ kind: 'expense', amount: 1250, categoryId: 'expense-1', date: '2026-09-02', note: ' pain ' });
    await repo.saveSettings({ monthlyGoal: 50000 });
    const json = JSON.stringify(await repo.exportAll());

    const check = parseBackup(json);
    expect(check.ok).toBe(true);
    if (!check.ok) return;
    expect(check.data.transactions[0].note).toBe('pain');

    const other = new DexieRepository(new VaultDB('t2'));
    await other.init();
    await other.importAll(check.data);
    const again = await other.exportAll();
    expect(again.transactions).toHaveLength(1);
    expect(again.settings.monthlyGoal).toBe(50000);
    expect(again.categories).toHaveLength(11);
  });

  it('récurrence rattrapée à la création', async () => {
    const repo = new DexieRepository(new VaultDB('t3'));
    await repo.init();
    await repo.addTransaction(
      { kind: 'expense', amount: 65000, categoryId: 'expense-0', date: '2020-01-31' },
      { recurring: true },
    );
    const all = (await repo.exportAll()).transactions;
    expect(all.length).toBeGreaterThan(12);
    expect(all.some((t) => t.date === '2020-02-29')).toBe(true);
    // Deuxième appel : rien de plus.
    expect(await repo.generateRecurring('2020-05')).toBe(0);
  });

  it('refuse les fichiers invalides', () => {
    expect(parseBackup('pas du json').ok).toBe(false);
    expect(parseBackup('{"app":"autre"}').ok).toBe(false);
    const base = { app: 'vault', version: 1, categories: [{ id: 'a', kind: 'expense', name: 'X' }], recurring: [], settings: { monthlyGoal: 0 } };
    expect(parseBackup(JSON.stringify({ ...base, transactions: [{ id: '1', kind: 'expense', amount: -5, categoryId: 'a', date: '2026-01-01' }] })).ok).toBe(false);
    expect(parseBackup(JSON.stringify({ ...base, transactions: [{ id: '1', kind: 'expense', amount: 12.5, categoryId: 'a', date: '2026-01-01' }] })).ok).toBe(false);
    expect(parseBackup(JSON.stringify({ ...base, transactions: [{ id: '1', kind: 'expense', amount: 500, categoryId: 'zz', date: '2026-01-01' }] })).ok).toBe(false);
    expect(parseBackup(JSON.stringify({ ...base, transactions: [{ id: '1', kind: 'expense', amount: 500, categoryId: 'a', date: '2026-02-30' }] })).ok).toBe(false);
    expect(parseBackup(JSON.stringify({ ...base, transactions: [] })).ok).toBe(true);
  });
});
