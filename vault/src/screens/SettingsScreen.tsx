import { BackupPanel } from '../components/settings/BackupPanel';
import { CategoryManager } from '../components/settings/CategoryManager';
import { DangerZone } from '../components/settings/DangerZone';
import { GoalSetting } from '../components/settings/GoalSetting';
import { RecurringList } from '../components/settings/RecurringList';

export function SettingsScreen({ notify, focusGoal }: { notify: (msg: string) => void; focusGoal?: boolean }) {
  return (
    <div className="space-y-7">
      <h1 className="font-display text-4xl tracking-wide">Réglages</h1>
      <GoalSetting onSaved={notify} autoFocus={focusGoal} />
      <RecurringList />
      <CategoryManager />
      <BackupPanel notify={notify} />
      <DangerZone notify={notify} />
      <p className="pb-2 text-center text-[11px] text-[#6a6a6a]">VAULT · données stockées uniquement sur cet appareil</p>
    </div>
  );
}
