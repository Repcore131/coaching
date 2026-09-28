import { formatEuro } from '../../domain/money';
import { AnimatedAmount } from '../ui/AnimatedAmount';

/** L'épargne du mois, en très gros. */
export function SavingsHero({ savings, isCurrent }: { savings: number; isCurrent: boolean }) {
  const negative = savings < 0;
  // Les très gros montants rétrécissent pour tenir sur une ligne, même sur petit écran.
  const len = formatEuro(savings, { round: true }).length;
  const size = len > 10 ? 'text-[clamp(44px,15vw,76px)]' : len > 8 ? 'text-[clamp(54px,18vw,90px)]' : 'text-[clamp(64px,22vw,104px)]';
  return (
    <section className="pt-2 text-center" aria-label="Épargne du mois">
      <p className="label">{isCurrent ? 'Épargne du mois' : 'Épargne'}</p>
      <AnimatedAmount
        cents={savings}
        round
        className={`num mt-2 block whitespace-nowrap ${size} ${negative ? 'text-accent' : 'text-white'}`}
      />
      {negative && <p className="mt-1 text-xs text-sub">Les dépenses dépassent les rentrées ce mois-ci.</p>}
    </section>
  );
}
