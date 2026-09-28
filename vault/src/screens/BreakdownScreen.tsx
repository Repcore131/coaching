import { useMemo } from 'react';
import { CategoryBars } from '../components/breakdown/CategoryBars';
import { MonthNav } from '../components/layout/MonthNav';
import { expenseBreakdown } from '../domain/breakdown';
import { formatEuro } from '../domain/money';
import type { MonthKey } from '../domain/types';
import { useVaultData } from '../hooks/useVaultData';

interface Props {
  month: MonthKey;
  onMonthChange: (m: MonthKey) => void;
}

export function BreakdownScreen({ month, onMonthChange }: Props) {
  const { transactions, categories } = useVaultData();
  const rows = useMemo(() => expenseBreakdown(month, transactions, categories), [month, transactions, categories]);
  const total = rows.reduce((s, r) => s + r.amount, 0);

  return (
    <div className="space-y-5">
      <MonthNav month={month} onChange={onMonthChange} />
      <section className="text-center">
        <p className="label">Dépenses du mois</p>
        <p className="num mt-2 text-6xl text-accent">{formatEuro(-total, { round: true })}</p>
      </section>
      {rows.length === 0 ? (
        <p className="card px-5 py-8 text-center text-sm text-sub">Aucune dépense ce mois-ci.</p>
      ) : (
        // key : relance l'animation des barres à chaque changement de mois.
        <CategoryBars key={month} rows={rows} />
      )}
    </div>
  );
}
