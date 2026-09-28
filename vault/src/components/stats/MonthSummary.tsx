import { formatEuro } from '../../domain/money';
import { savingsRate } from '../../domain/stats';
import type { MonthTotals } from '../../domain/types';

/** Rentrées, dépenses, taux d'épargne. */
export function MonthSummary({ totals }: { totals: MonthTotals }) {
  const rate = savingsRate(totals);
  return (
    <dl className="grid grid-cols-3 gap-2">
      <div className="card px-3 py-3">
        <dt className="label">Rentrées</dt>
        <dd className="num mt-2 truncate text-2xl text-white">{formatEuro(totals.income, { round: true })}</dd>
      </div>
      <div className="card px-3 py-3">
        <dt className="label">Dépenses</dt>
        <dd className="num mt-2 truncate text-2xl text-accent-text">{formatEuro(-totals.expense, { round: true })}</dd>
      </div>
      <div className="card px-3 py-3">
        <dt className="label">Taux</dt>
        <dd className={`num mt-2 text-2xl ${rate !== null && rate < 0 ? 'text-accent-text' : 'text-white'}`}>
          {rate === null ? '—' : `${rate < 0 ? '–' : ''}${Math.abs(rate)} %`}
        </dd>
      </div>
    </dl>
  );
}
