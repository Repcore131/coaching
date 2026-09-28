import { useEffect, useRef, useState, type FormEvent } from 'react';
import { repo } from '../../data';
import { isValidDateKey } from '../../domain/dates';
import { centsToInput, parseAmount } from '../../domain/money';
import type { Kind, Transaction } from '../../domain/types';
import { useActiveCategories } from '../../hooks/useCategoryMap';
import { useVaultData } from '../../hooks/useVaultData';
import { Icon } from '../ui/Icon';
import { AmountInput } from './AmountInput';
import { CategoryPicker } from './CategoryPicker';

export type FormTarget = { mode: 'add'; kind: Kind; date: string } | { mode: 'edit'; tx: Transaction };

interface Props {
  target: FormTarget;
  onDone: (message: string) => void;
  onDelete: (tx: Transaction) => void;
}

const LAST_CAT_KEY = (k: Kind) => `vault:last-cat:${k}`;
const readLast = (k: Kind) => { try { return localStorage.getItem(LAST_CAT_KEY(k)); } catch { return null; } };
const writeLast = (k: Kind, id: string) => { try { localStorage.setItem(LAST_CAT_KEY(k), id); } catch { /* sans effet */ } };

export function TransactionForm({ target, onDone, onDelete }: Props) {
  const editing = target.mode === 'edit' ? target.tx : null;
  const kind: Kind = editing ? editing.kind : (target as { kind: Kind }).kind;
  const cats = useActiveCategories(kind);
  const { recurring } = useVaultData();

  const [amount, setAmount] = useState(editing ? centsToInput(editing.amount) : '');
  const [categoryId, setCategoryId] = useState<string | null>(() => {
    if (editing) return editing.categoryId;
    const last = readLast(kind);
    return last && cats.some((c) => c.id === last) ? last : null;
  });
  const [date, setDate] = useState(editing ? editing.date : (target as { date: string }).date);
  const [note, setNote] = useState(editing?.note ?? '');
  const [isRecurring, setIsRecurring] = useState(false);
  const [errors, setErrors] = useState<{ amount?: string; category?: string; date?: string }>({});
  const [saving, setSaving] = useState(false);
  const amountRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) amountRef.current?.focus();
  }, [editing]);

  // Une catégorie archivée reste affichée en modification pour ne pas perdre l'info.
  const { categories: allCats } = useVaultData();
  const shown = editing && !cats.some((c) => c.id === editing.categoryId)
    ? [...cats, ...allCats.filter((c) => c.id === editing.categoryId)]
    : cats;

  const rule = editing?.recurringId ? recurring.find((r) => r.id === editing.recurringId) : undefined;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    const parsed = parseAmount(amount);
    const next: typeof errors = {};
    if (!parsed.ok) next.amount = parsed.error;
    if (!categoryId) next.category = 'Choisis une catégorie';
    if (!isValidDateKey(date)) next.date = 'Date invalide';
    setErrors(next);
    if (!parsed.ok || !categoryId || next.date) return;

    setSaving(true);
    try {
      const input = { kind, amount: parsed.cents, categoryId, date, note };
      if (editing) await repo.updateTransaction(editing.id, input);
      else await repo.addTransaction(input, { recurring: isRecurring });
      writeLast(kind, categoryId);
      onDone(editing ? 'Modifié' : kind === 'income' ? 'Rentrée ajoutée' : 'Dépense ajoutée');
    } catch (err) {
      console.error(err);
      setErrors({ amount: "L'enregistrement a échoué. Réessaie." });
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <h2 className="font-display text-3xl tracking-wide">
        {editing ? 'Modifier' : kind === 'income' ? 'Nouvelle rentrée' : 'Nouvelle dépense'}
      </h2>

      <AmountInput
        ref={amountRef}
        kind={kind}
        value={amount}
        onChange={(v) => { setAmount(v); if (errors.amount) setErrors((e) => ({ ...e, amount: undefined })); }}
        error={errors.amount}
      />

      <CategoryPicker
        categories={shown}
        value={categoryId}
        onChange={(id) => { setCategoryId(id); setErrors((e) => ({ ...e, category: undefined })); }}
        error={errors.category}
      />

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="label">Date</span>
          <input
            type="date"
            className="field mt-2"
            value={date}
            required
            onChange={(e) => setDate(e.target.value)}
            aria-invalid={!!errors.date}
          />
          {errors.date && <span className="mt-1 block text-sm font-semibold text-accent-text">{errors.date}</span>}
        </label>
        <label className="block">
          <span className="label">Note</span>
          <input
            className="field mt-2"
            value={note}
            maxLength={120}
            placeholder="Facultatif"
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
      </div>

      {!editing && (
        <label className="flex cursor-pointer items-center justify-between rounded-xl border border-line bg-bg px-4 py-3">
          <span className="flex items-center gap-3 text-sm font-bold">
            <Icon name="repeat" className="h-4 w-4 text-sub" />
            Tous les mois
          </span>
          <input
            type="checkbox"
            role="switch"
            checked={isRecurring}
            onChange={(e) => setIsRecurring(e.target.checked)}
            className="peer sr-only"
          />
          <span
            aria-hidden="true"
            className="relative h-6 w-11 rounded-full bg-line transition peer-checked:bg-accent peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-white after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-5"
          />
        </label>
      )}

      {rule && (
        <div className="flex items-center justify-between rounded-xl border border-line bg-bg px-4 py-3 text-sm">
          <span className="flex items-center gap-2 text-sub">
            <Icon name="repeat" className="h-4 w-4" />
            {rule.active ? 'Revient chaque mois' : 'Récurrence arrêtée'}
          </span>
          {rule.active && (
            <button type="button" className="font-bold text-accent-text" onClick={() => repo.stopRecurring(rule.id)}>
              Arrêter
            </button>
          )}
        </div>
      )}

      <div className={editing ? 'grid grid-cols-[auto_1fr] gap-3' : ''}>
        {editing && (
          <button type="button" className="btn-ghost px-4" onClick={() => onDelete(editing)} aria-label="Supprimer">
            <Icon name="trash" />
          </button>
        )}
        <button type="submit" disabled={saving} className={`${kind === 'expense' ? 'btn-red' : 'btn-white'} w-full py-4 text-base`}>
          Valider
        </button>
      </div>
    </form>
  );
}
