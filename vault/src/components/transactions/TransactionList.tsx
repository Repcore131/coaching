import { useMemo } from 'react';
import { dayLabel } from '../../domain/dates';
import { formatEuro } from '../../domain/money';
import type { Transaction } from '../../domain/types';
import { useCategoryMap } from '../../hooks/useCategoryMap';
import { Icon } from '../ui/Icon';
import { SwipeableRow } from './SwipeableRow';

interface Props {
  transactions: Transaction[];
  onEdit: (tx: Transaction) => void;
  onDelete: (tx: Transaction) => void;
}

/** Opérations du mois, groupées par jour, les plus récentes en haut. */
export function TransactionList({ transactions, onEdit, onDelete }: Props) {
  const cats = useCategoryMap();
  const groups = useMemo(() => {
    const sorted = [...transactions].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
    const out: { date: string; items: Transaction[] }[] = [];
    for (const t of sorted) {
      const last = out[out.length - 1];
      if (last && last.date === t.date) last.items.push(t);
      else out.push({ date: t.date, items: [t] });
    }
    return out;
  }, [transactions]);

  if (transactions.length === 0) {
    return (
      <p className="card px-5 py-8 text-center text-sm text-sub">
        Aucune opération ce mois-ci.
        <br />
        Ajoute ta première rentrée ou dépense.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <section key={g.date} aria-label={dayLabel(g.date)}>
          <h3 className="label mb-2 px-1">{dayLabel(g.date)}</h3>
          <ul className="card divide-y divide-line overflow-hidden">
            {g.items.map((t) => {
              const name = cats.get(t.categoryId)?.name ?? 'Sans catégorie';
              const amount = formatEuro(t.kind === 'expense' ? -t.amount : t.amount);
              return (
                <SwipeableRow
                  key={t.id}
                  label={`${name}, ${amount}${t.note ? `, ${t.note}` : ''}. Appuyer pour modifier.`}
                  onOpen={() => onEdit(t)}
                  onDelete={() => onDelete(t)}
                >
                  <div className="flex items-center justify-between gap-3 px-4 py-3.5">
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 truncate text-[15px] font-bold">
                        {name}
                        {t.recurringId && <Icon name="repeat" className="h-3.5 w-3.5 shrink-0 text-sub" />}
                      </p>
                      {t.note && <p className="truncate text-xs text-sub">{t.note}</p>}
                    </div>
                    <span
                      className={`shrink-0 text-[15px] font-extrabold tabular-nums ${
                        t.kind === 'expense' ? 'text-accent-text' : 'text-white'
                      }`}
                    >
                      {amount}
                    </span>
                  </div>
                </SwipeableRow>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
