// ══ LES FORMULES D'UN COACH EXTERNE : SES PRIX, BORNÉS (10/10/2026) ═══════
//
// Un coach externe fixe ses prix lui-même : coachs/<coach>/formules/<id> =
// {lib, prixCts, mois, comprend}, recopiées sur sa vitrine publique
// (vitrines/<slug>/offres/<id>). Ce module, sans dépendance, dit ce qu'est une
// formule valable ; la vitrine (prospects.js), l'encaissement direct
// (paiements-coach.js), l'app (rc-core) et les règles RTDB suivent les mêmes
// bornes. Jamais de repli sur les prix de Kevin (tarifs.json) : une formule
// absente ou invalide ne s'affiche pas.
export const FORMULE_ID_RE = /^[a-z0-9_-]{2,24}$/;
export const PRIX_MAX_CTS = 200000;        // 2 000 €
export const PRIX_MIN_PAYABLE_CTS = 100;   // 1 € : PayPal n'encaisse pas 0
export const MOIS_MAX = 12;
export const FORMULES_MAX = 8;
/**
 * PURE. Une formule saisie par le coach, bornée, ou null : libellé de 1 à 60
 * caractères, prix entier de 0 à 2 000 € (en centimes), durée de 1 à 12 mois,
 * ce qu'elle comprend en 300 caractères au plus.
 */
export function formuleCoach(f) {
  const x = f && typeof f === 'object' ? f : null;
  if (!x) return null;
  if (typeof x.prixCts !== 'number' || typeof x.mois !== 'number') return null;
  const lib = String(x.lib == null ? '' : x.lib).trim();
  const prixCts = Number(x.prixCts), mois = Number(x.mois);
  if (!lib || lib.length > 60) return null;
  if (!Number.isInteger(prixCts) || prixCts < 0 || prixCts > PRIX_MAX_CTS) return null;
  if (!Number.isInteger(mois) || mois < 1 || mois > MOIS_MAX) return null;
  const comprend = String(x.comprend == null ? '' : x.comprend).trim();
  if (comprend.length > 300) return null;
  return { lib, prixCts, mois, comprend };
}
/** PURE. Payable dans l'app : au moins 1 €. Une formule gratuite s'affiche, sans bouton Payer. */
export const payable = (f) => !!(f && f.prixCts >= PRIX_MIN_PAYABLE_CTS);
