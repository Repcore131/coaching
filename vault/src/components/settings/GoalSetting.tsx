import { useEffect, useState, type FormEvent } from 'react';
import { repo } from '../../data';
import { centsToInput, parseAmount } from '../../domain/money';
import { useVaultData } from '../../hooks/useVaultData';
import { Section } from './Section';

export function GoalSetting({ onSaved, autoFocus }: { onSaved: (msg: string) => void; autoFocus?: boolean }) {
  const { settings } = useVaultData();
  const [value, setValue] = useState(settings.monthlyGoal ? centsToInput(settings.monthlyGoal) : '');
  const [error, setError] = useState<string>();

  useEffect(() => {
    setValue(settings.monthlyGoal ? centsToInput(settings.monthlyGoal) : '');
  }, [settings.monthlyGoal]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    // Vide ou 0 : pas d'objectif.
    if (trimmed === '' || /^0+([.,]0*)?$/.test(trimmed)) {
      await repo.saveSettings({ monthlyGoal: 0 });
      setError(undefined);
      onSaved('Objectif retiré');
      return;
    }
    const r = parseAmount(trimmed);
    if (!r.ok) return setError(r.error);
    setError(undefined);
    await repo.saveSettings({ monthlyGoal: r.cents });
    onSaved('Objectif enregistré');
  }

  return (
    <Section title="Objectif d'épargne mensuel" id="goal">
      <form onSubmit={submit} className="card p-4" noValidate>
        <div className="flex gap-3">
          <label className="relative flex-1">
            <span className="sr-only">Objectif en euros</span>
            <input
              className="field pr-8 text-lg font-bold"
              inputMode="decimal"
              placeholder="Ex. 500"
              value={value}
              autoFocus={autoFocus}
              onChange={(e) => setValue(e.target.value.replace(/[^\d.,\s]/g, ''))}
              aria-invalid={!!error}
              aria-describedby={error ? 'goal-error' : undefined}
            />
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 font-bold text-sub">€</span>
          </label>
          <button className="btn-red" type="submit">OK</button>
        </div>
        {error && <p id="goal-error" className="mt-2 text-sm font-semibold text-accent-text">{error}</p>}
      </form>
    </Section>
  );
}
