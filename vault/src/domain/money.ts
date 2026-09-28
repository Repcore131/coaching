/** Plafond de saisie : 1 000 000 € (en centimes). */
export const MAX_AMOUNT = 100_000_000;

/** Signe moins typographique utilisé partout dans l'appli. */
export const MINUS = '–';

export type ParseResult =
  | { ok: true; cents: number }
  | { ok: false; error: string };

/**
 * Convertit une saisie utilisateur en centimes, sans jamais passer par un float.
 * Accepte : "12", "12,5", "12.50", ",5", "12,", "1 250,50", "1.250,50", "1,250.50".
 */
export function parseAmount(raw: string): ParseResult {
  let s = raw.replace(/[\s  €]/g, '');
  if (s === '') return { ok: false, error: 'Saisis un montant' };
  if (/^[-–−]/.test(s)) return { ok: false, error: 'Le montant doit être positif' };
  if (!/^[\d.,]+$/.test(s)) return { ok: false, error: 'Montant invalide' };

  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  if (lastDot >= 0 && lastComma >= 0) {
    // Les deux séparateurs : le dernier est décimal, l'autre sert aux milliers.
    const dec = lastDot > lastComma ? '.' : ',';
    const thousands = dec === '.' ? ',' : '.';
    s = s.split(thousands).join('').replace(dec, '.');
  } else {
    const sep = lastDot >= 0 ? '.' : lastComma >= 0 ? ',' : null;
    if (sep && s.split(sep).length > 2) {
      // Plusieurs fois le même séparateur : milliers ("1.250.000").
      if (!/^\d{1,3}([.,]\d{3})+$/.test(s)) return { ok: false, error: 'Montant invalide' };
      s = s.split(sep).join('');
    } else if (sep) {
      s = s.replace(sep, '.');
    }
  }

  if (/\.\d{3,}$/.test(s)) return { ok: false, error: '2 chiffres maximum après la virgule' };
  const m = /^(\d*)(?:\.(\d{0,2}))?$/.exec(s);
  if (!m || (m[1] === '' && !m[2])) return { ok: false, error: 'Montant invalide' };

  const euros = m[1] === '' ? 0 : Number(m[1]);
  const cents = euros * 100 + Number((m[2] ?? '').padEnd(2, '0'));
  if (!Number.isSafeInteger(cents) || cents > MAX_AMOUNT) return { ok: false, error: 'Montant trop élevé' };
  if (cents <= 0) return { ok: false, error: 'Le montant doit être supérieur à 0' };
  return { ok: true, cents };
}

const fmt = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const fmtRound = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

/**
 * 125050 → "1 250,50 €" ; -8500 → "– 85,00 €".
 * `round` : sans centimes. `sign` : ajoute "+" devant un montant positif.
 */
export function formatEuro(cents: number, opts: { round?: boolean; sign?: boolean } = {}): string {
  const abs = Math.abs(cents);
  const body = (opts.round ? fmtRound.format(Math.round(abs / 100)) : fmt.format(abs / 100))
    // Espace fine insécable → espace insécable : rendu identique sur tous les navigateurs.
    .replace(/ /g, ' ');
  const shown = opts.round ? Math.round(abs / 100) : abs;
  if (cents < 0 && shown !== 0) return `${MINUS} ${body}`;
  if (opts.sign && cents > 0 && shown !== 0) return `+ ${body}`;
  return body;
}

/** 125050 → "1250,50" (pour préremplir un champ en modification). */
export function centsToInput(cents: number): string {
  const e = Math.floor(cents / 100);
  const c = cents % 100;
  return c === 0 ? String(e) : `${e},${String(c).padStart(2, '0')}`;
}
