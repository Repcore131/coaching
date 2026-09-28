import { formatEuro } from '../../domain/money';
import { goalProgress } from '../../domain/stats';
import { ProgressBar } from '../ui/ProgressBar';

interface Props {
  savings: number;
  goal: number;
  onSetGoal: () => void;
}

export function GoalProgress({ savings, goal, onSetGoal }: Props) {
  if (goal <= 0) {
    return (
      <button onClick={onSetGoal} className="card w-full px-4 py-4 text-left">
        <span className="label">Objectif</span>
        <span className="mt-1 block text-sm font-bold">Fixer un objectif d'épargne mensuel →</span>
      </button>
    );
  }
  const p = goalProgress(savings, goal);
  const reached = savings >= goal;
  const left = goal - Math.max(0, savings);
  return (
    <section className="card px-4 py-4" aria-label="Objectif du mois">
      <div className="mb-3 flex items-baseline justify-between">
        <span className="label">Objectif {formatEuro(goal, { round: true })}</span>
        <span className="num text-xl">{Math.round(p * 100)} %</span>
      </div>
      <ProgressBar value={p} label="Progression vers l'objectif" />
      <p className="mt-2 text-xs font-semibold text-sub">
        {reached ? 'Objectif atteint.' : `Encore ${formatEuro(left, { round: true })} à mettre de côté.`}
      </p>
    </section>
  );
}
