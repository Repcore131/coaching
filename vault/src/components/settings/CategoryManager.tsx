import { useState, type FormEvent } from 'react';
import { repo } from '../../data';
import type { Kind } from '../../domain/types';
import { useVaultData } from '../../hooks/useVaultData';
import { Section } from './Section';

export function CategoryManager() {
  const { categories } = useVaultData();
  const [kind, setKind] = useState<Kind>('expense');
  const [name, setName] = useState('');
  const list = categories.filter((c) => c.kind === kind);

  async function add(e: FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    await repo.addCategory(kind, n);
    setName('');
  }

  return (
    <Section title="Catégories" id="cats">
      <div className="card p-4">
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-bg p-1" role="tablist">
          {(['expense', 'income'] as Kind[]).map((k) => (
            <button
              key={k}
              role="tab"
              aria-selected={kind === k}
              onClick={() => setKind(k)}
              className={`rounded-lg py-2 text-xs font-extrabold uppercase tracking-wider ${kind === k ? 'bg-card text-white' : 'text-sub'}`}
            >
              {k === 'expense' ? 'Dépenses' : 'Rentrées'}
            </button>
          ))}
        </div>

        <ul className="mt-3 divide-y divide-line">
          {list.map((c) => (
            <li key={`${c.id}:${c.name}`} className="flex items-center gap-2 py-2">
              <input
                className={`min-w-0 flex-1 rounded-lg bg-transparent px-2 py-2 text-[15px] font-bold focus:bg-bg focus:outline-none ${c.archived ? 'text-[#6a6a6a] line-through' : ''}`}
                defaultValue={c.name}
                maxLength={40}
                aria-label={`Renommer ${c.name}`}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (!v) e.target.value = c.name;
                  else if (v !== c.name) repo.saveCategory({ ...c, name: v });
                }}
                onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
              />
              <button
                className="shrink-0 rounded-lg border border-line px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-sub"
                onClick={() => repo.saveCategory({ ...c, archived: !c.archived })}
                aria-label={c.archived ? `Réafficher ${c.name}` : `Masquer ${c.name}`}
              >
                {c.archived ? 'Réafficher' : 'Masquer'}
              </button>
            </li>
          ))}
        </ul>

        <form onSubmit={add} className="mt-3 flex gap-2">
          <input
            className="field"
            placeholder="Nouvelle catégorie"
            value={name}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
            aria-label="Nom de la nouvelle catégorie"
          />
          <button className="btn-ghost shrink-0" type="submit" disabled={!name.trim()}>Ajouter</button>
        </form>
        <p className="mt-3 text-xs text-sub">Une catégorie masquée disparaît des choix mais reste dans l'historique.</p>
      </div>
    </Section>
  );
}
