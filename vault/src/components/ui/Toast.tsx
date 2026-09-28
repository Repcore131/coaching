export interface ToastData {
  id: number;
  message: string;
  action?: { label: string; run: () => void };
}

interface Props {
  toast: ToastData | null;
  onDone: () => void;
  /** true quand les boutons d'ajout sont affichés : le toast passe au-dessus. */
  raised: boolean;
}

export function Toast({ toast, onDone, raised }: Props) {
  if (!toast) return null;
  return (
    <div
      key={toast.id}
      role="status"
      aria-live="polite"
      style={{ bottom: `calc(${raised ? 150 : 80}px + env(safe-area-inset-bottom))` }}
      className="anim-toast fixed left-1/2 z-40 flex w-[calc(100%-32px)] max-w-sm -translate-x-1/2 items-center justify-between gap-3 rounded-xl border border-line bg-[#1f1f1f] px-4 py-3 text-sm font-semibold shadow-2xl"
    >
      <span>{toast.message}</span>
      {toast.action && (
        <button
          className="font-extrabold uppercase tracking-wider text-accent-text"
          onClick={() => { toast.action!.run(); onDone(); }}
        >
          {toast.action.label}
        </button>
      )}
    </div>
  );
}
