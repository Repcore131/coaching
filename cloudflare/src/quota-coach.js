// ══ LE QUOTA D'UN COACH, APPLIQUÉ (02/10/2026) — MODULE PUR ═══════════════
//
// LE MODÈLE : le coach paie, l'athlète rattaché est gratuit. Libre couvre 1
// athlète actif, Coach 15, Pro sans limite (COACH_PALIERS dans l'app, prix
// dans tarifs.json). Jusqu'ici, dépasser n'était qu'une alerte : un coach
// Libre suivait vingt athlètes, tous au palier « suivi » gratuit.
//
// LA RÈGLE (la même que athleteCouvertParCoach dans l'app) :
//   · un athlète ACTIF (une séance au moins dans les 60 derniers jours)
//     occupe une place ; un athlète inactif n'en prend pas, et reste couvert ;
//   · les places vont aux actifs dans l'ordre de RATTACHEMENT (droits/<a>/
//     rattache.le, posé par le serveur ; repli sur l'ordre de coach.clients,
//     puis la clé) : les `quota` premiers sont couverts ;
//   · LA GRÂCE : tant que le coach n'a pas passé TROIS mois d'affilée
//     au-dessus de son quota (PALIERS_CYCLES_AVANT_PROPOSITION + 1 dans
//     l'app), tout le monde reste couvert. Le compteur est celui du SERVEUR
//     (coachs_registre/<coach>/quota), pas users/<coach>/paliers que le coach
//     peut réécrire depuis son navigateur ;
//   · le créateur (CREATOR_EMAIL) n'a pas de quota ; un plan inconnu ou
//     échu vaut Libre.
//
// metier.js lit, appelle ce module, et recopie le résultat dans
// droits/<athlète>/couvertParCoach = {jusqu} : palierDe (app) n'en tient
// compte que pour un « suivi » ouvert par un code de coach — un abonnement
// payé par l'athlète, un essai en cours, ne bougent pas.

export const QUOTAS = Object.freeze({ libre: 1, coach: 15, pro: Infinity });
export const ACTIF_JOURS = 60;
export const CYCLES_GRACE = 3;                   // PALIERS_CYCLES_AVANT_PROPOSITION (2) + 1
export const COUVERT_MARGE_MS = 36 * 3600000;    // un passage manqué ne coupe personne
export const CYCLES_MAX = 24;

/** Le mois (AAAA-MM) d'une date AAAA-MM-JJ ou d'un instant, à Paris. */
export function moisParis(t) {
  const p = {};
  for (const x of new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit' }).formatToParts(new Date(t))) p[x.type] = x.value;
  return p.year + '-' + p.month;
}
/** Le plan qui compte : celui du registre, Libre s'il est inconnu ou échu. */
export function planEffectif(registre, t) {
  const r = registre && typeof registre === 'object' ? registre : {};
  const plan = Object.prototype.hasOwnProperty.call(QUOTAS, r.plan) ? r.plan : 'libre';
  if (plan !== 'libre' && !(Number(r.actifJusqu) > t)) return 'libre';
  return plan;
}
/** Actif : un jour de séance (clé AAAA-MM-JJ du journal xp_etat/<a>/jr) dans les 60 derniers jours. */
export function estActif(joursSeance, aujourdhui) {
  const lim = new Date(Date.parse(aujourdhui + 'T00:00:00Z') - ACTIF_JOURS * 86400000).toISOString().slice(0, 10);
  return (joursSeance || []).some((j) => String(j) >= lim);
}
/**
 * Le compteur de mois au-dessus du quota, comme majCyclesPaliers dans l'app :
 * +1 au plus par mois tant que le coach dépasse, remis à zéro dès qu'il ne
 * dépasse plus. Rend le nouvel état {cycles, mois}.
 */
export function cyclesSuivants(etat, depasse, mois) {
  const e = { cycles: Math.max(0, Math.min(CYCLES_MAX, Math.round(Number(etat && etat.cycles) || 0))), mois: String((etat && etat.mois) || '') };
  if (!depasse) return { cycles: 0, mois: e.mois };
  if (e.mois === mois) return e;
  return { cycles: Math.min(CYCLES_MAX, e.cycles + 1), mois };
}
/**
 * PURE. Les places d'un coach. `athletes` : [{cle, actif, le, ordre}] (`le` :
 * date de rattachement, `ordre` : rang dans coach.clients, -1 sinon).
 * Rend {quota, n, enGrace, couverts:Set, horsQuota:[cles]}.
 */
export function placesCoach({ plan, createur, cycles, athletes }) {
  const quota = createur ? Infinity : (QUOTAS[plan] ?? 1);
  const liste = Array.isArray(athletes) ? athletes : [];
  const actifs = liste.filter((a) => a && a.actif).slice().sort((a, b) => {
    const la = Number(a.le) > 0 ? Number(a.le) : Infinity, lb = Number(b.le) > 0 ? Number(b.le) : Infinity;
    if (la !== lb) return la - lb;
    const oa = a.ordre >= 0 ? a.ordre : Infinity, ob = b.ordre >= 0 ? b.ordre : Infinity;
    if (oa !== ob) return oa - ob;
    return String(a.cle) < String(b.cle) ? -1 : 1;
  });
  const n = actifs.length;
  const enGrace = !(n > quota) || (Number(cycles) || 0) < CYCLES_GRACE;
  const couverts = new Set(liste.filter((a) => a && !a.actif).map((a) => a.cle));
  actifs.forEach((a, i) => { if (enGrace || i < quota) couverts.add(a.cle); });
  return { quota, n, enGrace, couverts, horsQuota: actifs.filter((a) => !couverts.has(a.cle)).map((a) => a.cle) };
}
