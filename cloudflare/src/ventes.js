// LE RAPPORT DES VENTES (GET /stats/ventes), pour la routine du lundi (10/10/2026).
//
// Kevin reçoit chaque lundi un rapport : visites, inscriptions, premières
// séances, essais finis, payants, chiffre d'affaires par offre, résiliations
// et motifs, par source et par ambassadeur. Tout cela EXISTE déjà dans la
// base, en compteurs agrégés ; ce module ne fait que les relire et les
// additionner sur une semaine. Il n'écrit rien, et ne rend AUCUNE donnée
// personnelle : ni adresse, ni clé de compte, ni identifiant d'abonnement.
//
// D'OÙ VIENNENT LES CHIFFRES :
//   metrics/<jour>/<événement>            les compteurs de l'app (rcm) ;
//   attribution/jours/<jour>/src|amb/...  clics, inscriptions, payants par origine ;
//   paypal_transactions/<id>              les encaissements (montant en centimes) ;
//   paypal_fins/<clé>                     les abonnements qui s'arrêtent ;
//   stats/resiliations/<AAAA-MM>/<motif>  les motifs, comptés PAR MOIS.
//
// ⚠ FERMÉ SANS JETON. La route ne répond que si le secret STATS_TOKEN est posé
//   sur le Worker ET présenté par l'appelant (en-tête Authorization: Bearer,
//   ou ?token=). Sans secret posé, elle répond 404, comme si elle n'existait pas.
// ⚠ UNE SEMAINE = sept jours de Paris, du lundi au dimanche. La semaine rendue
//   est la dernière semaine COMPLÈTE avant `jusqu` (aujourd'hui par défaut).

const JOUR_MS = 864e5;
export const jourParis = (t) => new Date(t).toLocaleDateString('fr-CA', { timeZone: 'Europe/Paris' });
const nb = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/** PURE. Les sept jours (AAAA-MM-JJ, Paris) de la dernière semaine complète avant l'instant t, lundi d'abord. */
export function semaineAvant(t, reculSemaines) {
  // Midi de Paris du jour : à l'abri des changements d'heure.
  const [a, m, j] = jourParis(t).split('-').map(Number);
  const midi = Date.UTC(a, m - 1, j, 12);
  const js = new Date(midi).getUTCDay();          // 0 = dimanche
  const depuisLundi = (js + 6) % 7;                 // lundi = 0
  const lundiCourant = midi - depuisLundi * JOUR_MS;
  const lundi = lundiCourant - (1 + nb(reculSemaines)) * 7 * JOUR_MS;
  const iso = (x) => new Date(x).toISOString().slice(0, 10);
  return Array.from({ length: 7 }, (_, i) => iso(lundi + i * JOUR_MS));
}

// Les étapes de l'entonnoir, et le compteur de l'app qui les porte.
export const ENTONNOIR = Object.freeze([
  ['visites', 'landing_view'], ['ecran_installation', 'install_ecran_vu'], ['installations', 'install_fait'],
  ['install_invite_montree', 'install_invite_montree'], ['install_accepte', 'install_accepte'], ['install_refuse', 'install_refuse'],
  ['install_guide_ios', 'install_guide_ios'], ['lancements_autonomes', 'lancement_autonome'], ['accueil_vu', 'welcome_view'],
  ['inscriptions_commencees', 'register_started'], ['inscriptions', 'register_completed'],
  ['premieres_seances_commencees', 'first_workout_started'], ['premieres_seances', 'first_workout_completed'],
  ['premiers_bilans', 'first_bilan_completed'], ['retours_j1', 'retour_j1'], ['jamais_demarre_7j', 'jamais_demarre_7j'],
  ['fins_essai_vues', 'trial_end_viewed'], ['fins_essai_offre_cliquee', 'trial_end_offer_clicked'],
  ['ecran_abonnement_vu', 'subscribe_viewed'], ['paypal_clique', 'paypal_clicked'], ['abonnements_actives', 'subscription_activated'],
]);

/** PURE. L'entonnoir d'une semaine : la somme des compteurs de ses sept jours. */
export function entonnoir(metriquesParJour, jours) {
  const out = {};
  for (const [nom, cle] of ENTONNOIR) out[nom] = jours.reduce((s, j) => s + nb((metriquesParJour[j] || {})[cle]), 0);
  return out;
}

/** PURE. L'attribution d'une semaine : par source et par ambassadeur, les compteurs additionnés. */
export function attribution(attributionParJour, jours) {
  const out = { sources: {}, ambassadeurs: {} };
  for (const j of jours) {
    const a = attributionParJour[j] || {};
    for (const [branche, cible] of [['src', out.sources], ['amb', out.ambassadeurs]]) {
      const b = a[branche] || {};
      for (const k of Object.keys(b)) {
        if (!/^[A-Za-z0-9_-]{1,24}$/.test(k)) continue;
        const c = cible[k] || (cible[k] = {});
        for (const m of Object.keys(b[k] || {})) if (/^[a-z_]{1,20}$/.test(m)) c[m] = nb(c[m]) + nb(b[k][m]);
      }
    }
  }
  return out;
}

/** PURE. L'offre d'un encaissement, sans rien qui désigne la personne. */
export function offreDe(tr) {
  if (!tr) return 'inconnue';
  if (tr.type === 'coaching') return 'coaching_' + String(tr.formule || 'inconnue').replace(/[^a-z0-9_]/gi, '').slice(0, 24);
  if (tr.type === 'programme') return 'programme';
  if (tr.type === 'abonnement') return tr.role === 'coach' ? 'abonnement_coach' : 'abonnement';
  return String(tr.type || 'inconnue').replace(/[^a-z0-9_]/gi, '').slice(0, 24) || 'inconnue';
}

/** PURE. Les ventes d'une semaine : encaissé, remboursé, par offre, premiers paiements et renouvellements. */
export function ventes(transactions, debutMs, finMs) {
  const out = { encaisse_cts: 0, rembourse_cts: 0, transactions: 0, premiers_paiements: 0, renouvellements: 0, remboursements: 0, par_offre: {}, devises: {} };
  for (const id of Object.keys(transactions || {})) {
    const tr = transactions[id];
    if (!tr || typeof tr !== 'object') continue;
    const le = nb(tr.le), cts = Math.round(nb(tr.montant));
    if (le >= debutMs && le < finMs && cts > 0) {
      out.transactions++; out.encaisse_cts += cts;
      if (tr.premier) out.premiers_paiements++; else if (tr.type === 'abonnement') out.renouvellements++;
      const o = offreDe(tr), po = out.par_offre[o] || (out.par_offre[o] = { n: 0, cts: 0 });
      po.n++; po.cts += cts;
      const d = String(tr.devise || 'EUR').toUpperCase().slice(0, 3); out.devises[d] = nb(out.devises[d]) + 1;
    }
    // Un remboursement se compte à SA date, quelle que soit celle de la vente.
    const an = nb(tr.annuleLe);
    if (an >= debutMs && an < finMs) { out.remboursements++; out.rembourse_cts += Math.round(nb(tr.rembourse != null ? tr.rembourse : tr.montant)); }
  }
  return out;
}

/** PURE. Les abonnements dont l'arrêt a été noté dans la semaine, par type (résilié, expiré, suspendu). */
export function arrets(fins, debutMs, finMs) {
  const out = { total: 0, par_type: {} };
  for (const k of Object.keys(fins || {})) {
    const f = fins[k];
    if (!f || typeof f !== 'object') continue;
    const le = nb(f.le);
    if (!(le >= debutMs && le < finMs)) continue;
    out.total++;
    const t = String(f.type || 'inconnu').replace(/[^A-Za-z_.]/g, '').slice(0, 40) || 'inconnu';
    out.par_type[t] = nb(out.par_type[t]) + 1;
  }
  return out;
}

/** Le début (00 h 00, Paris) d'un jour AAAA-MM-JJ, en millisecondes. */
export function debutJourParis(jour) {
  const [a, m, j] = jour.split('-').map(Number);
  // On cherche l'instant UTC dont la date de Paris est ce jour à 00 h 00 : UTC+1 ou UTC+2.
  for (const dec of [2, 1]) {
    const t = Date.UTC(a, m - 1, j, 0) - dec * 3600e3;
    if (jourParis(t) === jour && jourParis(t - 1) !== jour) return t;
  }
  return Date.UTC(a, m - 1, j, 0) - 3600e3;
}

/**
 * Le rapport : la dernière semaine complète, la précédente, et les quatre d'avant.
 * @param {{db:any, maintenant?:number, semaines?:number}} o
 */
export async function rapportVentes(o) {
  const t = nb(o.maintenant) || Date.now(), n = Math.min(Math.max(nb(o.semaines) || 5, 1), 9);
  const sems = Array.from({ length: n }, (_, k) => semaineAvant(t, k));
  const premier = sems[n - 1][0], dernier = sems[0][6];
  const lire = async (chemin) => { try { return (await o.db.ref(chemin).get()).val(); } catch (e) { return undefined; } };
  // Deux lectures bornées par clé (un jour = une clé), et trois lectures entières de petits nœuds.
  // (La base du Worker sait borner par le début ; la fin se filtre ici : six semaines de jours au plus.)
  const plage = async (chemin) => {
    try {
      const v = (await o.db.ref(chemin).orderByKey().startAt(premier).get()).val() || {};
      return Object.fromEntries(Object.entries(v).filter(([k]) => /^\d{4}-\d{2}-\d{2}$/.test(k) && k >= premier && k <= dernier));
    } catch (e) { return undefined; }
  };
  const [met, att, trs, fins] = await Promise.all([plage('metrics'), plage('attribution/jours'), lire('paypal_transactions'), lire('paypal_fins')]);
  const mois = [...new Set([sems[0][0].slice(0, 7), sems[0][6].slice(0, 7)])];
  const motifs = {};
  for (const m of mois) { const v = await lire('stats/resiliations/' + m); if (v && typeof v === 'object') motifs[m] = Object.fromEntries(Object.entries(v).filter(([k, x]) => /^[a-z_]{1,30}$/.test(k) && nb(x) > 0)); }
  const indisponibles = [];
  if (met === undefined) indisponibles.push('metrics');
  if (att === undefined) indisponibles.push('attribution');
  if (trs === undefined) indisponibles.push('paypal_transactions');
  if (fins === undefined) indisponibles.push('paypal_fins');
  const une = (jours) => {
    const d = debutJourParis(jours[0]), f = debutJourParis(jours[6]) + JOUR_MS;
    return { du: jours[0], au: jours[6], entonnoir: entonnoir(met || {}, jours), attribution: attribution(att || {}, jours),
      ventes: ventes(trs || {}, d, f), arrets: arrets(fins || {}, d, f) };
  };
  return { genere: new Date(t).toISOString(), fuseau: 'Europe/Paris', indisponibles,
    note: 'Compteurs agrégés, sans donnée personnelle. Montants en centimes. Les motifs de résiliation sont comptés par mois, pas par semaine.',
    semaine: une(sems[0]), precedentes: sems.slice(1).map(une), motifs_resiliation_du_mois: motifs };
}
