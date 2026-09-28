import type { ReactNode } from 'react';

export function StatTile({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="card px-4 py-4">
      <p className="label">{label}</p>
      <div className="num mt-2 text-3xl">{children}</div>
      {hint && <p className="mt-1 text-xs font-semibold text-sub">{hint}</p>}
    </div>
  );
}
