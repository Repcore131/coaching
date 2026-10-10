/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion (Fitness Park Niort). Tous droits réservés. Logiciel protégé (CPI art. L111-1, L112-2, L335-2) : toute reproduction, même partielle, est interdite. */
'use strict';
// ══ FIT PULSE — brief du matin ═══════════════════════════════════════════
// Les chiffres du brief, calculés UNE fois ici : la page Opportunités,
// l'accueil et l'e-mail de 7 h 30 (outils/fitpulse-brief.mjs, qui charge ce
// fichier) affichent les mêmes euros attendus.

// Les n actions les plus rentables (vue club pour un manager, ses actions pour un commercial).
function oppTop(clubId, scope = 'all', n = 5) { return oppsFor(clubId, scope).slice(0, n); }
const oppSum = L => Math.round(L.reduce((s, o) => s + (Number(o.eurosAttendus) || 0), 0));
// KPI de la veille, rythme du mois en jours ouvrés, 5 opportunités du club.
function briefData(clubId, jour = today()) {
  const mk = jour.slice(0, 7); const veille = veilleOuvree(jour); const debut = mk + '-01'; const fin = `${mk}-${pad(daysIn(mk))}`;
  const finRealise = veille >= debut ? veille : null;
  const ouvres = { total: joursOuvres(debut, fin), ecoules: finRealise ? joursOuvres(debut, finRealise) : 0 };
  ouvres.restants = ouvres.total - ouvres.ecoules;
  const membres = clubMembers(clubId);
  const kpis = kpiList().map(k => {
    const objectif = membres.reduce((s, u) => s + monthTarget(mk, u.id, k.id), 0);
    const mois = finRealise ? sumRange(clubId, null, k.id, debut, finRealise) : 0;
    const attendu = objectif * (ouvres.total ? ouvres.ecoules / ouvres.total : 0);
    return { id: k.id, label: k.label, unit: k.unit, veille: sumRange(clubId, null, k.id, veille, veille), mois, objectif, rythme: attendu > 0 ? mois / attendu : null };
  }).filter(k => k.objectif > 0 || k.veille > 0);
  const L = oppTop(clubId, 'all', 5);
  const top = L.map(o => ({ type: o.type, label: OPP_TYPES[o.type].label, titre: o.titre, client: o.client || '', euros: o.eurosAttendus, href: o.href }));
  return { club: (S.clubs[clubId] || {}).name || clubId, jour, veille, mk, ouvres, kpis, top, total: oppSum(L) };
}
