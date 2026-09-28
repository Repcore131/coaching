import { useState } from 'react';
import { repo } from '../../data';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Section } from './Section';

export function DangerZone({ notify }: { notify: (msg: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Section title="Réinitialisation" id="reset">
      <div className="card p-4">
        <button className="btn-ghost w-full border-accent/60 text-accent-text" onClick={() => setOpen(true)}>
          Tout effacer
        </button>
      </div>
      <ConfirmDialog
        open={open}
        title="Tout effacer ?"
        message="Toutes les opérations, catégories et réglages seront supprimés de ce téléphone. Exporte une sauvegarde avant si tu veux les garder."
        confirmLabel="Effacer"
        typeToConfirm="EFFACER"
        onClose={() => setOpen(false)}
        onConfirm={async () => {
          await repo.resetAll();
          setOpen(false);
          notify('Données effacées');
        }}
      />
    </Section>
  );
}
