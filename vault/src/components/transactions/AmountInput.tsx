import { forwardRef } from 'react';
import type { Kind } from '../../domain/types';

interface Props {
  kind: Kind;
  value: string;
  error?: string;
  onChange: (v: string) => void;
}

/** Gros champ montant, clavier numérique avec virgule. */
export const AmountInput = forwardRef<HTMLInputElement, Props>(function AmountInput(
  { kind, value, error, onChange },
  ref,
) {
  return (
    <div>
      <label htmlFor="amount" className="label">Montant</label>
      <div className="mt-1 flex items-baseline gap-2 border-b-2 border-line pb-1 focus-within:border-white/70">
        <span className={`num text-5xl ${kind === 'expense' ? 'text-accent' : 'text-white'}`} aria-hidden="true">
          {kind === 'expense' ? '–' : '+'}
        </span>
        <input
          ref={ref}
          id="amount"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          enterKeyHint="done"
          placeholder="0,00"
          value={value}
          // On ne garde que chiffres, virgule, point et espaces : un "-" collé ne passe pas.
          onChange={(e) => onChange(e.target.value.replace(/[^\d.,\s]/g, ''))}
          aria-invalid={!!error}
          aria-describedby={error ? 'amount-error' : undefined}
          className="num w-full min-w-0 bg-transparent text-6xl text-white placeholder:text-[#3a3a3a] focus:outline-none"
        />
        <span className="num text-4xl text-sub" aria-hidden="true">€</span>
      </div>
      {error && <p id="amount-error" className="mt-2 text-sm font-semibold text-accent-text">{error}</p>}
    </div>
  );
});
