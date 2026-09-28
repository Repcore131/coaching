import { useEffect, useState } from 'react';

interface Props {
  /** Entre 0 et 1. */
  value: number;
  label: string;
}

/** Barre qui se remplit à l'affichage. */
export function ProgressBar({ value, label }: Props) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(value));
    return () => cancelAnimationFrame(id);
  }, [value]);
  const pct = Math.round(value * 100);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className="h-2.5 w-full overflow-hidden rounded-full bg-line"
    >
      <div
        className="h-full rounded-full bg-accent transition-[width] duration-700 ease-out"
        style={{ width: `${shown * 100}%` }}
      />
    </div>
  );
}
