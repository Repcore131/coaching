import { useMemo } from 'react';
import { MonthNav } from '../components/layout/MonthNav';
import { GoalProgress } from '../components/stats/GoalProgress';
import { MonthSummary } from '../components/stats/MonthSummary';
import { SavingsHero } from '../components/stats/SavingsHero';
import { TransactionList } from '../components/transactions/TransactionList';
import { currentMonth } from '../domain/dates';
import { totalsFor } from '../domain/stats';
import type { MonthKey, Transaction } from '../domain/types';
import { useVaultData } from '../hooks/useVaultData';

interface Props {
  month: MonthKey;
  onMonthChange: (m: MonthKey) => void;
  onEdit: (tx: Transaction) => void;
  onDelete: (tx: Transaction) => void;
  onSetGoal: () => void;
}

export function HomeScreen({ month, onMonthChange, onEdit, onDelete, onSetGoal }: Props) {
  const { transactions, settings } = useVaultData();
  const monthTxs = useMemo(() => transactions.filter((t) => t.month === month), [transactions, month]);
  const totals = useMemo(() => totalsFor(month, monthTxs), [month, monthTxs]);

  return (
    <div className="space-y-5">
      <MonthNav month={month} onChange={onMonthChange} />
      <SavingsHero savings={totals.savings} isCurrent={month === currentMonth()} />
      <MonthSummary totals={totals} />
      <GoalProgress savings={totals.savings} goal={settings.monthlyGoal} onSetGoal={onSetGoal} />
      <div>
        <h2 className="label mb-3 mt-2 px-1">Opérations</h2>
        <TransactionList transactions={monthTxs} onEdit={onEdit} onDelete={onDelete} />
        {monthTxs.length > 0 && (
          <p className="mt-3 text-center text-[11px] text-[#6a6a6a]">Glisse vers la gauche pour supprimer</p>
        )}
      </div>
    </div>
  );
}
