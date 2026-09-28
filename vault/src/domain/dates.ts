import type { DateKey, MonthKey } from './types';

const pad = (n: number) => String(n).padStart(2, '0');

export function toDateKey(d: Date): DateKey {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayKey(): DateKey {
  return toDateKey(new Date());
}

export function monthOf(date: DateKey): MonthKey {
  return date.slice(0, 7);
}

export function currentMonth(): MonthKey {
  return monthOf(todayKey());
}

export function addMonths(month: MonthKey, delta: number): MonthKey {
  const [y, m] = month.split('-').map(Number);
  const idx = y * 12 + (m - 1) + delta;
  return `${Math.floor(idx / 12)}-${pad((idx % 12) + 1)}`;
}

/** Liste des mois de `from` à `to` inclus (vide si from > to). */
export function monthRange(from: MonthKey, to: MonthKey): MonthKey[] {
  const out: MonthKey[] = [];
  for (let m = from; m <= to; m = addMonths(m, 1)) out.push(m);
  return out;
}

export function daysInMonth(month: MonthKey): number {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

/** Date d'un jour donné dans un mois, ramenée au dernier jour si besoin (31 → 30 ou 28). */
export function dayInMonth(month: MonthKey, day: number): DateKey {
  return `${month}-${pad(Math.min(Math.max(1, day), daysInMonth(month)))}`;
}

const MONTHS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];
const MONTHS_SHORT = ['janv', 'févr', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc'];

/** "2026-09" → "septembre" */
export function monthName(month: MonthKey): string {
  return MONTHS[Number(month.slice(5, 7)) - 1];
}

/** "2026-09" → "septembre 2026" */
export function monthLabel(month: MonthKey): string {
  return `${monthName(month)} ${month.slice(0, 4)}`;
}

/** "2026-09" → "sept" */
export function monthShort(month: MonthKey): string {
  return MONTHS_SHORT[Number(month.slice(5, 7)) - 1];
}

/** "d'août" / "de septembre" */
export function deMonth(month: MonthKey): string {
  const n = monthName(month);
  return /^[aeiouéo]/.test(n) ? `d'${n}` : `de ${n}`;
}

/** "2026-09-28" → "Lundi 28 septembre" ; "Aujourd'hui" / "Hier" si pertinent. */
export function dayLabel(date: DateKey, today: DateKey = todayKey()): string {
  if (date === today) return "Aujourd'hui";
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const [ty, tm, td] = today.split('-').map(Number);
  const yesterday = toDateKey(new Date(ty, tm - 1, td - 1));
  if (date === yesterday) return 'Hier';
  const s = dt.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function isValidDateKey(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}
