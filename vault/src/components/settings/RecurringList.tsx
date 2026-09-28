import { repo } from '../../data';
import { formatEuro } from '../../domain/money';
import { useCategoryMap } from '../../hooks/useCategoryMap';
import { useVaultData } from '../../hooks/useVaultData';
import { Section } from './Section';

export function RecurringList() {
  const { recurring } = useVaultData();
  const cats = useCategoryMap();
  const active = recurring.filter((r) => r.active);

  return (
    <Section title="Opérations mensuelles" id="rec">
      <div className="card p-4">
        {active.length === 0 ? (
          <p className="text-sm text-sub">
            Aucune. Coche « Tous les mois » en ajoutant un loyer, un salaire ou un abonnement.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {active.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-bold">{cats.get(r.categoryId)?.name ?? 'Sans catégorie'}</p>
                  <p className="text-xs text-sub">le {r.dayOfMonth} du mois</p>
                </div>
                <span className={`shrink-0 text-sm font-extrabold tabular-nums ${r.kind === 'expense' ? 'text-accent-text' : ''}`}>
                  {formatEuro(r.kind === 'expense' ? -r.amount : r.amount)}
                </span>
                <button
                  className="shrink-0 rounded-lg border border-line px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-sub"
                  onClick={() => repo.stopRecurring(r.id)}
                >
                  Arrêter
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Section>
  );
}
