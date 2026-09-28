import { addMonths, currentMonth, monthLabel } from '../../domain/dates';
import type { MonthKey } from '../../domain/types';
import { Icon } from '../ui/Icon';

interface Props {
  month: MonthKey;
  onChange: (m: MonthKey) => void;
}

const MAX_AHEAD = 12;

export function MonthNav({ month, onChange }: Props) {
  const now = currentMonth();
  const canNext = month < addMonths(now, MAX_AHEAD);
  const prev = addMonths(month, -1);
  const next = addMonths(month, 1);
  return (
    <nav className="flex items-center justify-between" aria-label="Changer de mois">
      <button className="grid h-11 w-11 place-items-center rounded-full border border-line" onClick={() => onChange(prev)} aria-label={`Mois précédent, ${monthLabel(prev)}`}>
        <Icon name="left" />
      </button>
      <button
        className="font-display text-2xl tracking-[0.08em] uppercase"
        onClick={() => onChange(now)}
        aria-label={month === now ? monthLabel(month) : `${monthLabel(month)}. Revenir au mois en cours`}
      >
        {monthLabel(month)}
        {month !== now && <span className="ml-2 align-middle text-[10px] font-sans font-bold text-sub">↺</span>}
      </button>
      <button
        className="grid h-11 w-11 place-items-center rounded-full border border-line disabled:opacity-30"
        onClick={() => onChange(next)}
        disabled={!canNext}
        aria-label={`Mois suivant, ${monthLabel(next)}`}
      >
        <Icon name="right" />
      </button>
    </nav>
  );
}
