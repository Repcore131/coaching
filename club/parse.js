/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion (Fitness Park Niort). Tous droits réservés. Logiciel protégé (CPI art. L111-1, L112-2, L335-2) : toute reproduction, même partielle, est interdite. */
'use strict';
// ══ FIT PULSE — lecture des montants et des dates (fonctions pures, testees) ══
// Charge avant les pages ; teste par tests/parse.test.mjs (node --test).
const p2 = n => String(n).padStart(2, '0');
// Montants : « 1 234,56 », « 1.234,56 », « 1,234.56 », « -12,00 € », « 12,00- »,
// « (12,00) », « EUR 12,50 », « ¤ 12,50 ». Le dernier separateur rencontre est
// la decimale ; un point seul suivi de 3 chiffres est un separateur de milliers.
// Illisible : NaN (l'appelant ecarte la ligne et le dit), jamais 0 en silence.
function parseMontant(s) {
  if (s == null) return NaN;
  if (typeof s === 'number') return Number.isFinite(s) ? s : NaN;
  let t = String(s).trim();
  if (!t) return NaN;
  let neg = false;
  if (/^\(.*\)$/.test(t)) { neg = true; t = t.slice(1, -1); }
  t = t.replace(/[\s\u00A0\u202F]/g, '').replace(/€|¤|EUR|TTC|HT/gi, '');
  if (t.endsWith('-')) { neg = true; t = t.slice(0, -1); }
  if (t.startsWith('-')) { neg = true; t = t.slice(1); } else if (t.startsWith('+')) t = t.slice(1);
  if (!/^[0-9.,]+$/.test(t) || !/\d/.test(t)) return NaN;
  const lc = t.lastIndexOf(','), lp = t.lastIndexOf('.');
  if (lc >= 0 && lp >= 0) { const dec = lc > lp ? ',' : '.'; const mil = dec === ',' ? '.' : ','; t = t.split(mil).join('').replace(dec, '.'); }
  else if (lp >= 0) { if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.split('.').join(''); else if ((t.match(/\./g) || []).length > 1) return NaN; }
  else if (lc >= 0) { if ((t.match(/,/g) || []).length > 1) { if (/^\d{1,3}(,\d{3})+$/.test(t)) t = t.split(',').join(''); else return NaN; } else t = t.replace(',', '.'); }
  const n = Number(t);
  return Number.isFinite(n) ? (neg ? -n : n) : NaN;
}
const toNum = s => { const n = parseMontant(s); return Number.isNaN(n) ? 0 : n; };
// Dates : AAAA-MM-JJ, JJ/MM/AAAA, JJ-MM-AAAA, JJ.MM.AAAA, JJ/MM/AA, numero de
// serie Excel, ISO avec heure (convertie en date locale). Une date impossible
// (31/02, mois 13) donne null : la ligne est ecartee, jamais rangee hors mois.
function parseDate(s) {
  if (s == null || s === '') return null;
  if (s instanceof Date) return isNaN(s) ? null : `${s.getFullYear()}-${p2(s.getMonth() + 1)}-${p2(s.getDate())}`;
  s = String(s).trim();
  const ok = (y, m, d) => { y = Number(y); m = Number(m); d = Number(d); if (!(m >= 1 && m <= 12 && d >= 1 && d <= new Date(y, m, 0).getDate() && y >= 1900 && y <= 2100)) return null; return `${y}-${p2(m)}-${p2(d)}`; };
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/);
  if (m) { const d = new Date(s); return isNaN(d) ? null : `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`; }
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); if (m) return ok(m[1], m[2], m[3]);
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\b/); if (m) return ok(m[3], m[2], m[1]);
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2})\b/);
  if (m) { const yy = Number(m[3]), pivot = (new Date().getFullYear() % 100) + 1; return ok((yy <= pivot ? 2000 : 1900) + yy, m[2], m[1]); }
  if (/^\d{5}(\.\d+)?$/.test(s)) { const n = Math.floor(Number(s)); const d = new Date(1899, 11, 30 + n); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`; }
  return null;
}
const toDate = parseDate;
if (typeof module !== 'undefined') module.exports = { parseMontant, parseDate, toNum };
