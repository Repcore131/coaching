import { Icon, type IconName } from '../ui/Icon';

export type Tab = 'month' | 'progress' | 'breakdown' | 'settings';

const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'month', label: 'Mois', icon: 'month' },
  { id: 'progress', label: 'Progression', icon: 'chart' },
  { id: 'breakdown', label: 'Répartition', icon: 'pie' },
  { id: 'settings', label: 'Réglages', icon: 'gear' },
];

export function TabBar({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  return (
    <nav className="grid grid-cols-4 border-t border-line" aria-label="Navigation principale">
      {TABS.map((t) => {
        const on = t.id === tab;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            aria-current={on ? 'page' : undefined}
            className={`flex flex-col items-center gap-1 py-2.5 text-[10px] font-bold uppercase tracking-wider transition ${
              on ? 'text-white' : 'text-[#8a8a8a]'
            }`}
          >
            <Icon name={t.icon} className={`h-5 w-5 ${on ? 'text-accent' : ''}`} />
            {t.label}
          </button>
        );
      })}
    </nav>
  );
}
