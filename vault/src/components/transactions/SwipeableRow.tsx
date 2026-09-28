import { useRef, useState, type ReactNode, type PointerEvent } from 'react';
import { Icon } from '../ui/Icon';

interface Props {
  children: ReactNode;
  label: string;
  onOpen: () => void;
  onDelete: () => void;
}

const REVEAL = 104; // largeur du bouton Supprimer
const FULL = 200; // au-delà : suppression directe

/**
 * Ligne glissable : vers la gauche pour révéler "Supprimer", appui pour modifier.
 * Le glissement n'est qu'un raccourci : la suppression est aussi dans le formulaire.
 */
export function SwipeableRow({ children, label, onOpen, onDelete }: Props) {
  const [x, setX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ px: number; py: number; x: number; axis: 'x' | 'y' | null } | null>(null);
  const moved = useRef(false);

  const down = (e: PointerEvent) => {
    start.current = { px: e.clientX, py: e.clientY, x, axis: null };
    moved.current = false;
  };
  const move = (e: PointerEvent) => {
    const s = start.current;
    if (!s) return;
    const dx = e.clientX - s.px;
    const dy = e.clientY - s.py;
    if (!s.axis) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      s.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      if (s.axis === 'x') (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
    if (s.axis !== 'x') return;
    moved.current = true;
    setDragging(true);
    setX(Math.min(0, Math.max(-FULL - 40, s.x + dx)));
  };
  const up = () => {
    const s = start.current;
    start.current = null;
    setDragging(false);
    if (!s || s.axis !== 'x') return;
    if (x <= -FULL) { setX(0); onDelete(); }
    else setX(x < -REVEAL / 2 ? -REVEAL : 0);
  };

  return (
    <li className="relative overflow-hidden">
      <button
        type="button"
        tabIndex={x === 0 ? -1 : 0}
        aria-hidden={x === 0}
        onClick={() => { setX(0); onDelete(); }}
        className="absolute inset-y-0 right-0 flex items-center justify-end gap-1.5 bg-accent pr-4 text-[11px] font-extrabold uppercase tracking-wider text-white"
        style={{ width: Math.max(REVEAL, -x) }}
      >
        <Icon name="trash" className="h-4 w-4" />
        Supprimer
      </button>
      <button
        type="button"
        aria-label={label}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onClick={() => {
          if (moved.current) return;
          if (x !== 0) setX(0);
          else onOpen();
        }}
        className={`relative block w-full bg-card text-left ${dragging ? '' : 'transition-transform duration-200'}`}
        style={{ transform: `translateX(${x}px)`, touchAction: 'pan-y' }}
      >
        {children}
      </button>
    </li>
  );
}
