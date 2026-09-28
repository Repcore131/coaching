import { useMemo } from 'react';
import { MonthlyBarChart } from '../components/progress/MonthlyBarChart';
import { StatTile } from '../components/progress/StatTile';
import { AnimatedAmount } from '../components/ui/AnimatedAmount';
import { addMonths, currentMonth, monthLabel, monthName } from '../domain/dates';
import { formatEuro } from '../domain/money';
import { bestMonth, compareWithPrevious, cumulativeSavings, goalStreak, totalsByMonth } from '../domain/stats';
import { useVaultData } from '../hooks/useVaultData';

export function ProgressScreen() {
  const { transactions, settings } = useVaultData();
  const now = currentMonth();
  const goal = settings.monthlyGoal;

  const s = useMemo(() => ({
    rows: totalsByMonth(transactions, addMonths(now, -11), now),
    total: cumulativeSavings(transactions, now),
    streak: goalStreak(transactions, now, goal),
    best: bestMonth(transactions, now),
    cmp: compareWithPrevious(transactions, now),
  }), [transactions, now, goal]);

  if (transactions.length === 0) {
    return (
      <div className="space-y-5">
        <h1 className="font-display text-4xl tracking-wide">Progression</h1>
        <p className="card px-5 py-8 text-center text-sm text-sub">Ta progression apparaîtra ici dès ta première opération.</p>
      </div>
    );
  }

  const { cmp } = s;
  return (
    <div className="space-y-5">
      <h1 className="font-display text-4xl tracking-wide">Progression</h1>

      <section className="card px-4 py-5 text-center">
        <p className="label">Épargne cumulée</p>
        <AnimatedAmount
          cents={s.total}
          round
          className={`num mt-2 block text-[clamp(52px,17vw,80px)] ${s.total < 0 ? 'text-accent' : 'text-white'}`}
        />
        <p className="mt-1 text-xs font-semibold text-sub">depuis le début</p>
      </section>

      <section className="card px-4 py-4">
        <MonthlyBarChart rows={s.rows} goal={goal} />
      </section>

      <div className="grid grid-cols-2 gap-3">
        <StatTile label="Série" hint={goal > 0 ? "mois d'affilée à l'objectif" : 'fixe un objectif pour lancer ta série'}>
          {goal > 0 ? s.streak : '—'}
          {goal > 0 && <span className="ml-1 text-lg text-sub">mois</span>}
        </StatTile>
        <StatTile label="Record" hint={s.best ? monthLabel(s.best.month) : undefined}>
          <span className={s.best && s.best.savings < 0 ? 'text-accent-text' : ''}>
            {s.best ? formatEuro(s.best.savings, { round: true }) : '—'}
          </span>
        </StatTile>
      </div>

      {!cmp.prevEmpty && (
        <section className="card px-4 py-4">
          <p className="label">Par rapport au mois dernier</p>
          <p className="mt-2 text-lg font-extrabold">
            <span className={cmp.diff < 0 ? 'text-accent-text' : 'text-white'}>
              {cmp.diff === 0 ? 'Autant' : formatEuro(cmp.diff, { round: true, sign: true })}
            </span>{' '}
            <span className="text-sub">
              {cmp.diff === 0 ? `qu'en ${monthName(cmp.prev)}` : `par rapport à ${monthName(cmp.prev)}`}
            </span>
          </p>
        </section>
      )}
    </div>
  );
}
