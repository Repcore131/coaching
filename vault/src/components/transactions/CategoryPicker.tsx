import type { Category } from '../../domain/types';

interface Props {
  categories: Category[];
  value: string | null;
  onChange: (id: string) => void;
  error?: string;
}

/** Pastilles : une catégorie en un seul appui. */
export function CategoryPicker({ categories, value, onChange, error }: Props) {
  return (
    <fieldset>
      <legend className="label">Catégorie</legend>
      <div className="mt-2 flex flex-wrap gap-2" role="radiogroup">
        {categories.map((c) => {
          const on = c.id === value;
          return (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(c.id)}
              className={`min-h-[40px] rounded-full border px-4 text-sm font-bold transition ${
                on ? 'border-white bg-white text-black' : 'border-line bg-bg text-white'
              }`}
            >
              {c.name}
            </button>
          );
        })}
      </div>
      {error && <p className="mt-2 text-sm font-semibold text-accent-text">{error}</p>}
    </fieldset>
  );
}
