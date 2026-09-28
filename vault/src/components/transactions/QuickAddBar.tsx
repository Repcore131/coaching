import type { Kind } from '../../domain/types';

/** Les deux gros boutons, toujours sous le pouce. */
export function QuickAddBar({ onAdd }: { onAdd: (kind: Kind) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3 px-4 pb-3 pt-3">
      <button className="btn-white py-4 text-base" onClick={() => onAdd('income')}>
        + Rentrée
      </button>
      <button className="btn-red py-4 text-base" onClick={() => onAdd('expense')}>
        – Dépense
      </button>
    </div>
  );
}
