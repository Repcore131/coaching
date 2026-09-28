import { useEffect, useState } from 'react';
import type { BreakdownRow } from '../../domain/breakdown';
import { formatEuro } from '../../domain/money';

/** Classement des dépenses par catégorie, en barres horizontales. */
export function CategoryBars({ rows }: { rows: BreakdownRow[] }) {
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const max = rows[0]?.amount ?? 1;

  return (
    <ol className="card divide-y divide-line">
      {rows.map((r, i) => (
        <li key={r.categoryId} className="px-4 py-3.5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="flex min-w-0 items-baseline gap-2">
              <span className="num w-5 shrink-0 text-lg text-sub">{i + 1}</span>
              <span className="truncate text-[15px] font-bold">{r.name}</span>
            </span>
            <span className="shrink-0 text-[15px] font-extrabold tabular-nums">
              {formatEuro(r.amount)}
              <span className="ml-2 inline-block w-10 text-right text-xs font-bold text-sub">{r.percent} %</span>
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-line" aria-hidden="true">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-700 ease-out"
              style={{ width: grown ? `${(r.amount / max) * 100}%` : 0 }}
            />
          </div>
        </li>
      ))}
    </ol>
  );
}
