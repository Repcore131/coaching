import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { repo } from '../data';
import { currentMonth } from '../domain/dates';
import type { Category, RecurringRule, Settings, Transaction } from '../domain/types';

interface VaultData {
  ready: boolean;
  error: string | null;
  transactions: Transaction[];
  categories: Category[];
  recurring: RecurringRule[];
  settings: Settings;
}

const Ctx = createContext<VaultData | null>(null);

export function VaultDataProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [recurring, setRecurring] = useState<RecurringRule[]>([]);
  const [settings, setSettings] = useState<Settings>({ id: 'main', monthlyGoal: 0 });

  useEffect(() => {
    let alive = true;
    const subs: Array<() => void> = [];
    // Au retour dans l'appli (ex. ouverte la veille, on a changé de mois) : on rattrape les récurrences.
    const catchUp = () => repo.generateRecurring(currentMonth()).catch(console.error);
    const onVisible = () => document.visibilityState === 'visible' && catchUp();

    repo
      .init()
      .then(catchUp)
      .then(() => {
        if (!alive) return;
        subs.push(repo.watchTransactions(setTransactions));
        subs.push(repo.watchCategories(setCategories));
        subs.push(repo.watchRecurring(setRecurring));
        subs.push(repo.watchSettings(setSettings));
        document.addEventListener('visibilitychange', onVisible);
        setReady(true);
      })
      .catch((e) => {
        console.error(e);
        setError("Impossible d'ouvrir le stockage local. Vérifie que le navigateur n'est pas en navigation privée.");
      });
    return () => {
      alive = false;
      subs.forEach((u) => u());
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return (
    <Ctx.Provider value={{ ready, error, transactions, categories, recurring, settings }}>{children}</Ctx.Provider>
  );
}

export function useVaultData(): VaultData {
  const v = useContext(Ctx);
  if (!v) throw new Error('useVaultData hors de VaultDataProvider');
  return v;
}
