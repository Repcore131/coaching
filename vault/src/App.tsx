import { useCallback, useEffect, useRef, useState } from 'react';
import { TabBar, type Tab } from './components/layout/TabBar';
import { QuickAddBar } from './components/transactions/QuickAddBar';
import { TransactionForm, type FormTarget } from './components/transactions/TransactionForm';
import { BottomSheet } from './components/ui/BottomSheet';
import { Toast, type ToastData } from './components/ui/Toast';
import { repo } from './data';
import { currentMonth, dayInMonth, todayKey } from './domain/dates';
import type { Kind, MonthKey, Transaction } from './domain/types';
import { useVaultData } from './hooks/useVaultData';
import { BreakdownScreen } from './screens/BreakdownScreen';
import { HomeScreen } from './screens/HomeScreen';
import { ProgressScreen } from './screens/ProgressScreen';
import { SettingsScreen } from './screens/SettingsScreen';

export default function App() {
  const { ready, error } = useVaultData();
  const [tab, setTab] = useState<Tab>('month');
  const [month, setMonth] = useState<MonthKey>(currentMonth());
  const [form, setForm] = useState<FormTarget | null>(null);
  const [toast, setToast] = useState<ToastData | null>(null);
  const [focusGoal, setFocusGoal] = useState(false);
  const toastTimer = useRef<number>();

  const notify = useCallback((message: string, action?: ToastData['action']) => {
    window.clearTimeout(toastTimer.current);
    setToast({ id: Date.now(), message, action });
    toastTimer.current = window.setTimeout(() => setToast(null), action ? 5000 : 2200);
  }, []);
  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  const openAdd = (kind: Kind) => {
    // Mois en cours : aujourd'hui. Autre mois affiché : même jour, dans ce mois-là.
    const today = todayKey();
    const date = month === currentMonth() ? today : dayInMonth(month, Number(today.slice(8, 10)));
    setForm({ mode: 'add', kind, date });
  };

  const remove = async (tx: Transaction) => {
    setForm(null);
    await repo.deleteTransaction(tx.id);
    notify('Opération supprimée', { label: 'Annuler', run: () => repo.restoreTransaction(tx) });
  };

  const changeTab = (t: Tab) => {
    setFocusGoal(false);
    setTab(t);
    window.scrollTo({ top: 0 });
  };

  if (error) {
    return <p className="p-6 text-center text-sm text-accent-text" role="alert">{error}</p>;
  }
  if (!ready) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <p className="font-display text-4xl tracking-[0.3em] text-white/80">VAULT</p>
      </div>
    );
  }

  const showQuickAdd = tab !== 'settings';

  return (
    <div className="mx-auto min-h-dvh max-w-md">
      <main
        className={`px-4 pt-[calc(16px+env(safe-area-inset-top))] ${
          showQuickAdd ? 'pb-[calc(160px+env(safe-area-inset-bottom))]' : 'pb-[calc(90px+env(safe-area-inset-bottom))]'
        }`}
      >
        {tab === 'month' && (
          <HomeScreen
            month={month}
            onMonthChange={setMonth}
            onEdit={(tx) => setForm({ mode: 'edit', tx })}
            onDelete={remove}
            onSetGoal={() => { changeTab('settings'); setFocusGoal(true); }}
          />
        )}
        {tab === 'progress' && <ProgressScreen />}
        {tab === 'breakdown' && <BreakdownScreen month={month} onMonthChange={setMonth} />}
        {tab === 'settings' && <SettingsScreen notify={notify} focusGoal={focusGoal} />}
      </main>

      <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md border-t border-line bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        {showQuickAdd && <QuickAddBar onAdd={openAdd} />}
        <TabBar tab={tab} onChange={changeTab} />
      </div>

      <BottomSheet
        open={form !== null}
        title={form?.mode === 'edit' ? 'Modifier une opération' : 'Nouvelle opération'}
        onClose={() => setForm(null)}
      >
        {form && (
          <TransactionForm
            key={form.mode === 'edit' ? form.tx.id : `${form.kind}-${form.date}`}
            target={form}
            onDelete={remove}
            onDone={(msg) => { setForm(null); notify(msg); }}
          />
        )}
      </BottomSheet>

      <Toast toast={toast} raised={showQuickAdd} onDone={() => setToast(null)} />
    </div>
  );
}
