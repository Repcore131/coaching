import { useState } from 'react';
import { BottomSheet } from './BottomSheet';

interface Props {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  /** Si présent, l'utilisateur doit taper ce mot pour confirmer. */
  typeToConfirm?: string;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmDialog({ open, title, message, confirmLabel, typeToConfirm, onConfirm, onClose }: Props) {
  const [typed, setTyped] = useState('');
  const blocked = typeToConfirm !== undefined && typed.trim().toUpperCase() !== typeToConfirm;
  const close = () => { setTyped(''); onClose(); };
  return (
    <BottomSheet open={open} title={title} onClose={close}>
      <h2 className="font-display text-3xl tracking-wide">{title}</h2>
      <p className="mt-2 text-sm text-sub">{message}</p>
      {typeToConfirm && (
        <label className="mt-4 block">
          <span className="label">Tape « {typeToConfirm} » pour confirmer</span>
          <input
            className="field mt-2 uppercase"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoCapitalize="characters"
            autoComplete="off"
          />
        </label>
      )}
      <div className="mt-5 grid grid-cols-2 gap-3">
        <button className="btn-ghost" onClick={close}>Annuler</button>
        <button className="btn-red" disabled={blocked} onClick={() => { setTyped(''); onConfirm(); }}>
          {confirmLabel}
        </button>
      </div>
    </BottomSheet>
  );
}
