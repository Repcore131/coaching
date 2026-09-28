import type { Backup } from '../domain/backup';
import type { Category, Kind, MonthKey, RecurringRule, Settings, Transaction } from '../domain/types';

/** Ce que l'UI envoie pour créer / modifier une opération. */
export interface TransactionInput {
  kind: Kind;
  amount: number;
  categoryId: string;
  date: string;
  note?: string;
}

/**
 * Contrat d'accès aux données. L'UI ne connaît QUE cette interface :
 * passer à Firebase = écrire une autre implémentation, sans toucher aux écrans.
 */
export interface VaultRepository {
  init(): Promise<void>;

  addTransaction(input: TransactionInput, opts?: { recurring?: boolean }): Promise<Transaction>;
  updateTransaction(id: string, input: TransactionInput): Promise<void>;
  deleteTransaction(id: string): Promise<void>;
  restoreTransaction(tx: Transaction): Promise<void>;

  /** Crée les opérations récurrentes manquantes jusqu'au mois donné. */
  generateRecurring(upTo: MonthKey): Promise<number>;
  stopRecurring(ruleId: string): Promise<void>;

  saveCategory(cat: Category): Promise<void>;
  addCategory(kind: Kind, name: string): Promise<Category>;

  saveSettings(patch: Partial<Omit<Settings, 'id'>>): Promise<void>;

  exportAll(): Promise<Backup>;
  importAll(data: Backup): Promise<void>;
  resetAll(): Promise<void>;

  /** Abonnements temps réel (liveQuery pour Dexie, onSnapshot pour Firebase). */
  watchTransactions(cb: (txs: Transaction[]) => void): () => void;
  watchCategories(cb: (cats: Category[]) => void): () => void;
  watchRecurring(cb: (rules: RecurringRule[]) => void): () => void;
  watchSettings(cb: (s: Settings) => void): () => void;
}
