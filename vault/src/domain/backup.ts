import { isValidDateKey, monthOf } from './dates';
import { MAX_AMOUNT } from './money';
import type { Category, RecurringRule, Settings, Transaction } from './types';

export const BACKUP_VERSION = 1;

export interface Backup {
  app: 'vault';
  version: number;
  exportedAt: string;
  categories: Category[];
  transactions: Transaction[];
  recurring: RecurringRule[];
  settings: Settings;
}

export type BackupCheck = { ok: true; data: Backup } | { ok: false; error: string };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const isKind = (v: unknown) => v === 'income' || v === 'expense';
const isCents = (v: unknown) => Number.isInteger(v) && (v as number) > 0 && (v as number) <= MAX_AMOUNT;
const isMonth = (v: unknown) => typeof v === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);

/** Valide un fichier de sauvegarde ENTIER avant toute écriture. */
export function parseBackup(text: string): BackupCheck {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "Ce fichier n'est pas un JSON valide." };
  }
  if (!isObj(raw) || raw.app !== 'vault') return { ok: false, error: "Ce fichier n'est pas une sauvegarde VAULT." };
  if (typeof raw.version !== 'number' || raw.version > BACKUP_VERSION) {
    return { ok: false, error: 'Version de sauvegarde non prise en charge.' };
  }
  const { categories, transactions, recurring, settings } = raw;
  if (!Array.isArray(categories) || !Array.isArray(transactions) || !Array.isArray(recurring) || !isObj(settings)) {
    return { ok: false, error: 'Sauvegarde incomplète.' };
  }

  for (const c of categories) {
    if (!isObj(c) || typeof c.id !== 'string' || !isKind(c.kind) || typeof c.name !== 'string') {
      return { ok: false, error: 'Catégorie invalide dans la sauvegarde.' };
    }
  }
  const catIds = new Set(categories.map((c) => (c as Category).id));
  for (const t of transactions) {
    if (
      !isObj(t) || typeof t.id !== 'string' || !isKind(t.kind) || !isCents(t.amount) ||
      typeof t.date !== 'string' || !isValidDateKey(t.date) || typeof t.categoryId !== 'string' ||
      !catIds.has(t.categoryId)
    ) {
      return { ok: false, error: 'Opération invalide dans la sauvegarde.' };
    }
  }
  for (const r of recurring) {
    if (!isObj(r) || typeof r.id !== 'string' || !isKind(r.kind) || !isCents(r.amount) ||
      !isMonth(r.startMonth) || !isMonth(r.lastGeneratedMonth) || typeof r.dayOfMonth !== 'number') {
      return { ok: false, error: 'Récurrence invalide dans la sauvegarde.' };
    }
  }
  const goal = settings.monthlyGoal;
  if (!(Number.isInteger(goal) && (goal as number) >= 0)) return { ok: false, error: 'Objectif invalide dans la sauvegarde.' };

  const now = Date.now();
  return {
    ok: true,
    data: {
      app: 'vault',
      version: BACKUP_VERSION,
      exportedAt: String(raw.exportedAt ?? ''),
      categories: (categories as Category[]).map((c, i) => ({
        id: c.id, kind: c.kind, name: c.name.trim().slice(0, 40) || 'Sans nom',
        order: Number.isFinite(c.order) ? c.order : i, archived: Boolean(c.archived),
      })),
      transactions: (transactions as Transaction[]).map((t) => ({
        id: t.id, kind: t.kind, amount: t.amount, categoryId: t.categoryId, date: t.date,
        month: monthOf(t.date), // recalculé : jamais pris tel quel du fichier
        note: typeof t.note === 'string' && t.note ? t.note.slice(0, 120) : undefined,
        recurringId: typeof t.recurringId === 'string' ? t.recurringId : undefined,
        createdAt: Number.isFinite(t.createdAt) ? t.createdAt : now,
        updatedAt: Number.isFinite(t.updatedAt) ? t.updatedAt : now,
      })),
      recurring: (recurring as RecurringRule[]).map((r) => ({
        id: r.id, kind: r.kind, amount: r.amount, categoryId: r.categoryId,
        note: typeof r.note === 'string' && r.note ? r.note : undefined,
        dayOfMonth: Math.min(31, Math.max(1, Math.round(r.dayOfMonth))),
        startMonth: r.startMonth, lastGeneratedMonth: r.lastGeneratedMonth, active: r.active !== false,
      })),
      settings: { id: 'main', monthlyGoal: goal as number },
    },
  };
}

export function backupFileName(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `vault-sauvegarde-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.json`;
}
