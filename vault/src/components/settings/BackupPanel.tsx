import { useRef, useState } from 'react';
import { repo } from '../../data';
import { backupFileName, parseBackup, type Backup } from '../../domain/backup';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Section } from './Section';

export function BackupPanel({ notify }: { notify: (msg: string) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Backup | null>(null);
  const [error, setError] = useState<string>();

  async function exportJson() {
    const data = await repo.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = backupFileName();
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify('Sauvegarde téléchargée');
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(undefined);
    const check = parseBackup(await file.text());
    if (fileRef.current) fileRef.current.value = '';
    if (!check.ok) return setError(check.error);
    setPending(check.data);
  }

  return (
    <Section title="Sauvegarde" id="backup">
      <div className="card p-4">
        <div className="grid grid-cols-2 gap-3">
          <button className="btn-ghost" onClick={exportJson}>Exporter</button>
          <button className="btn-ghost" onClick={() => fileRef.current?.click()}>Importer</button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
        {error && <p className="mt-3 text-sm font-semibold text-accent-text" role="alert">{error}</p>}
        <p className="mt-3 text-xs text-sub">
          Tes données restent sur ce téléphone. Exporte régulièrement un fichier pour ne rien perdre.
        </p>
      </div>
      <ConfirmDialog
        open={pending !== null}
        title="Importer ?"
        message={
          pending
            ? `Ce fichier contient ${pending.transactions.length} opération(s). Il remplacera TOUTES les données actuelles.`
            : ''
        }
        confirmLabel="Remplacer"
        onClose={() => setPending(null)}
        onConfirm={async () => {
          if (!pending) return;
          await repo.importAll(pending);
          setPending(null);
          notify('Données importées');
        }}
      />
    </Section>
  );
}
