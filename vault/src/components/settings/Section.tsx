import type { ReactNode } from 'react';

export function Section({ title, children, id }: { title: string; children: ReactNode; id?: string }) {
  return (
    <section className="space-y-3" id={id} aria-labelledby={id ? `${id}-t` : undefined}>
      <h2 id={id ? `${id}-t` : undefined} className="label px-1">{title}</h2>
      {children}
    </section>
  );
}
