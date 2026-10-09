/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion (Fitness Park Niort). Tous droits réservés. Logiciel protégé (CPI art. L111-1, L112-2, L335-2) : toute reproduction, même partielle, est interdite. */
'use strict';
// ══ FIT PULSE — « Ce que Fit Pulse a rapporté » (#/rapporte) ═════════════
// Le mois, ligne par ligne et vérifiable : chaque euro renvoie à un dossier.
//  1. impayés régularisés par l'équipe (saisies du KPI Impayés récupérés) ;
//  2. résiliations sauvées x valeur restante du contrat ;
//  3. renouvellements obtenus après une relance (contact noté dans les 45 jours avant) ;
//  4. ventes boutique saisies par l'équipe.
// Total comparé au prix de l'abonnement Fit Pulse (réglage de la société).

const RAP_FENETRE_RELANCE = 45; // jours : un renouvellement compte s'il suit un contact noté dans cette fenêtre
const cts = v => Math.round((Number(v) || 0) * 100);
// Une ligne : ses dossiers, et leur somme exacte au centime.
const rapLigne = (cle, titre, explication, dossiers) => ({ cle, titre, explication, dossiers, total: dossiers.reduce((s, d) => s + cts(d.euros), 0) / 100 });
function rapporteMois(clubId, mk) {
  const from = mk + '-01', to = `${mk}-${pad(daysIn(mk))}`; const t0 = dateOf(from).getTime(), t1 = dateOf(to).getTime() + 864e5;
  const lienClient = id => id && S.clients[id] ? `#/client/${id}` : null;
  // 1. Impayés régularisés par l'équipe
  const imp = entriesFor(clubId, null, 'impayes', from, to, { tous: true }).map(e => { const c = e.clientId ? S.clients[e.clientId] : e.clientNum ? clubClients(clubId).find(x => String(x.num || '') === String(e.clientNum)) : null;
    return { ref: e.id, date: e.date, libelle: c ? c.name : e.clientNum ? `Adhérent n° ${e.clientNum}` : 'Saisie du KPI, sans fiche adhérent', detail: `${isImported(e) ? 'import Resamania' : 'saisie'} · ${fullName(S.users[e.userId])}`, euros: Number(e.value) || 0, lien: lienClient(c && c.id) || '#/impayes' }; });
  // 2. Résiliations sauvées (date du sauvetage dans le mois) x valeur restante
  const sav = resList(clubId).filter(r => resStatus(r) === 'sauvee').map(r => ({ r, d: ((S.entries['sv_' + r.id] || {}).date) || r.date })).filter(x => x.d >= from && x.d <= to)
    .map(({ r, d }) => { const v = resValeur(r); return { ref: r.id, date: d, libelle: r.client || 'Adhérent', detail: `sauvé par ${fullName(S.users[r.ownerId])}${r.reason ? ' · motif ' + r.reason : ''}`, euros: v, lien: lienClient(r.clientId) || '#/resiliations' }; });
  // 3. Renouvellements après relance
  const contacts = id => [...Object.values(S.loyalty || {}).filter(a => a.clientId === id && a.type === 'renouvellement').map(a => a.at), ...Object.values(S.touches || {}).filter(x => x.clientId === id && x.kind === 'fincontrat').map(x => x.at)];
  const ren = clubClients(clubId).filter(c => c.renewedAt && c.renewedAt >= from && c.renewedAt <= to).map(c => {
    const at = dateOf(c.renewedAt).getTime(); const avant = contacts(c.id).filter(x => x <= at + 864e5 && x >= at - RAP_FENETRE_RELANCE * 864e5); if (!avant.length) return null;
    const mois = moisRestants(c.end, c.renewedAt) || 12; const prix = mensualite(c);
    return { ref: c.id, date: c.renewedAt, libelle: c.name, detail: `relancé le ${dm(isoOf(new Date(Math.max(...avant))))} · ${fmtE(prix)} x ${mois} mois${moisRestants(c.end, c.renewedAt) ? '' : ' (engagement annuel)'}`, euros: Math.round(prix * mois * 100) / 100, lien: lienClient(c.id) };
  }).filter(Boolean);
  // 4. Ventes boutique saisies
  const btq = kpiList().filter(k => k.unit === 'eur' && isRevenue(k)).flatMap(k => entriesFor(clubId, null, k.id, from, to, { tous: true }).filter(e => !isImported(e)).map(e => { const c = e.clientId ? S.clients[e.clientId] : null;
    return { ref: e.id, date: e.date, libelle: `${k.label}${c ? ' · ' + c.name : ''}`, detail: `saisie de ${fullName(S.users[e.userId])}`, euros: Number(e.value) || 0, lien: lienClient(c && c.id) || '#/dashboard' }; }));
  const lignes = [
    rapLigne('impayes', 'Impayés régularisés par l’équipe', 'Montants encaissés par l’équipe (Réglé dans Fit Pulse, ou canal équipe de la liste Incidents).', imp),
    rapLigne('sauvetages', 'Résiliations sauvées', 'Mensualités gardées jusqu’à la fin de l’engagement de chaque adhérent sauvé.', sav),
    rapLigne('renouvellements', 'Renouvellements obtenus après relance', `Nouvel engagement signé après un contact noté dans les ${RAP_FENETRE_RELANCE} jours précédents.`, ren),
    rapLigne('boutique', 'Ventes boutique saisies', 'Nutrition et accessoires saisis par l’équipe (les imports de factures ne sont pas comptés ici).', btq),
  ];
  const total = lignes.reduce((s, l) => s + cts(l.total), 0) / 100;
  return { mk, lignes, total, prix: prixFitPulse(clubId) };
}
// Prix mensuel de l'abonnement Fit Pulse : celui de l'espace (multi-salles), sinon le réglage du club.
function prixFitPulse(clubId) {
  return Number(deepGet(S, ['info', 'abonnement', 'prixMensuel'])) || Number(deepGet(S, ['clubs', clubId, 'prixFitPulse'])) || null;
}
PAGES.rapporte = {
  title: 'Ce que Fit Pulse a rapporté',
  manager: true,
  render() {
    const mk = UI.rapMonth || curMonth(); const R = rapporteMois(CLUB.id, mk); const ouvert = UI.rapOpen || '';
    return `<div class="page-head"><div><h1>Ce que Fit Pulse a rapporté</h1><p>${esc(CLUB.name)} · ${monthLabel(mk)} · chaque euro renvoie à son dossier.</p></div></div>
      <div class="row wrap" style="margin-bottom:12px">${monthNav('rapMonth', mk)}</div>
      <div class="rap-hero card"><div><span class="muted small">Rapporté en ${esc(monthLabel(mk).toLowerCase())}</span><b data-rap-total>${fmtE(R.total)}</b></div>
        ${R.prix ? `<div><span class="muted small">Abonnement Fit Pulse</span><b>${fmtE(R.prix)}</b><small>par mois</small></div><div><span class="muted small">Rapport</span><b>${R.total ? (Math.round(R.total / R.prix * 10) / 10).toString().replace('.', ',') + ' fois' : 'n.d.'}</b><small>le prix de l’abonnement</small></div>` : `<div class="muted small">${isManager() ? '<a href="#/rapporte" data-act="rapPrix">Indiquer le prix de l’abonnement Fit Pulse</a> pour comparer.' : ''}</div>`}</div>
      <div class="rap-lignes">${R.lignes.map(l => `<div class="card rap-l" data-ligne="${l.cle}">
        <div class="row" style="gap:10px"><div class="spacer"><b>${esc(l.titre)}</b><div class="muted small">${esc(l.explication)}</div></div><b class="rap-v" data-v="${l.total}">${fmtE(l.total)}</b>
        <button class="btn sm" data-act="ui" data-key="rapOpen" data-val="${ouvert === l.cle ? '' : l.cle}" aria-expanded="${ouvert === l.cle}">${plur(l.dossiers.length, 'dossier', 'dossiers')}</button></div>
        ${ouvert === l.cle ? (l.dossiers.length ? `<div class="table-wrap" style="margin-top:10px"><table class="t"><thead><tr><th>Date</th><th>Dossier</th><th>Détail</th><th class="num">Montant</th></tr></thead><tbody>${l.dossiers.sort((a, b) => a.date.localeCompare(b.date)).map(d => `<tr data-ref="${esc(d.ref)}"><td class="nowrap">${esc(dm(d.date))}</td><td>${d.lien ? `<a href="${esc(d.lien)}">${esc(d.libelle)}</a>` : esc(d.libelle)}</td><td class="small muted">${esc(d.detail)}</td><td class="num">${fmtE(d.euros)}</td></tr>`).join('')}
          <tr><td colspan="3"><b>Total</b></td><td class="num"><b>${fmtE(l.total)}</b></td></tr></tbody></table></div>` : '<p class="muted small" style="margin-top:8px">Aucun dossier ce mois-ci.</p>') : ''}</div>`).join('')}</div>
      <p class="muted small">Ne sont comptés que des montants rattachés à un dossier précis. Les ventes de contrats, déjà dans les objectifs, ne sont pas reprises ici.</p>`;
  },
};
ACTIONS.rapPrix = () => openModal({ title: 'Prix de l’abonnement Fit Pulse', body: `<label class="field"><span>Prix mensuel (€ HT)</span><input class="input" id="rap-prix" inputmode="decimal" value="${esc(String(deepGet(S, ['clubs', CLUB.id, 'prixFitPulse']) || ''))}"></label>`, foot: '<button class="btn" data-close>Annuler</button><button class="btn primary" data-act="rapPrixOk">Enregistrer</button>' });
ACTIONS.rapPrixOk = () => { const v = parseMontant($('#rap-prix').value); if (!(v > 0)) { toast('Prix invalide.'); return; } db.set(['clubs', CLUB.id, 'prixFitPulse'], Math.round(v * 100) / 100); closeModal(); };

// ── Compteur du mois (Récap et Ma journée, managers) ──────────────────────
// Euros : résiliations sauvées (valeur de chaque dossier) + impayés récupérés par
// l'équipe (canal « équipe ») + boutique (nutrition et accessoires). Le temps
// gagné est affiché à part : il n'est jamais additionné aux euros.
const MINUTES_JOUR_DEFAUT = 59;
function rapporteCompteurData(clubId, mk = curMonth(), t = today()) {
  const from = mk + '-01', to = `${mk}-${pad(daysIn(mk))}`; const rg = { from, to };
  const sauvees = resList(clubId).filter(r => resStatus(r) === 'sauvee' && ((S.entries['sv_' + r.id] || {}).date || r.date || '').slice(0, 7) === mk);
  const sauve = Math.round(sauvees.reduce((s, r) => s + resValeur(r), 0) * 100) / 100;
  const impayes = Math.round(recoveredFor(clubId, rg, 'equipe') * 100) / 100;
  const boutiqueK = ['nutrition', 'accessoires'].filter(k => S.kpis[k]);
  const boutique = Math.round(boutiqueK.reduce((s, k) => s + sumRange(clubId, null, k, from, to), 0) * 100) / 100;
  const minutes = Number(reglage('minutesGagneesJour', MINUTES_JOUR_DEFAUT)) || MINUTES_JOUR_DEFAUT;
  const jours = joursOuvres(from, t < to ? t : to); const heures = Math.round(jours * minutes / 6) / 10;
  return { mk, sauve, nSauvees: sauvees.length, impayes, boutique, total: Math.round((sauve + impayes + boutique) * 100) / 100, jours, minutes, heures, panier: panierMoyen(), panierRegle: !!Number(deepGet(S, ['settings', 'panierMoyen'])) };
}
function rapporteCompteur(clubId, mk) {
  if (!isManager()) return '';
  const R = rapporteCompteurData(clubId, mk); const heures = String(R.heures).replace('.', ',');
  return `<div class="card rap-compteur" data-total="${R.total}"><div class="row wrap"><div class="spacer"><div class="eyebrow">${esc(monthLabel(R.mk))}</div><h3>Ce que Fit Pulse a rapporté ce mois</h3></div><b class="rc-total">${fmtE(R.total)}</b></div>
    <div class="rc-lignes">
      <div class="row small"><span class="spacer">Résiliations sauvées (${R.nSauvees})</span><b>${fmtE(R.sauve)}</b></div>
      <div class="row small"><span class="spacer">Impayés récupérés par l’équipe</span><b>${fmtE(R.impayes)}</b></div>
      <div class="row small"><span class="spacer">Boutique : nutrition et accessoires</span><b>${fmtE(R.boutique)}</b></div>
      <div class="row small"><span class="spacer">Temps gagné, hors total en euros</span><b>${heures} h</b></div></div>
    <details class="small rc-hyp"><summary>Hypothèses</summary><ul>
      <li>Résiliation sauvée : prix mensuel du client multiplié par les mois d’engagement restants à la date de la demande (au moins 1) ; sans engagement, 12 mois. Prix inconnu : panier moyen de ${fmtE(R.panier)}${R.panierRegle ? ' (réglage du club)' : ' (valeur par défaut, réglable dans Club et réglages)'}.</li>
      <li>Impayés : régularisations du canal « équipe du club » dans la liste Incidents, et règlements notés dans Fit Pulse.</li>
      <li>Boutique : saisies et imports des KPI nutrition et accessoires du mois.</li>
      <li>Temps gagné : ${plur(R.jours, 'jour ouvré écoulé', 'jours ouvrés écoulés')} x ${R.minutes} minutes = ${heures} heures. Ce temps n’est pas converti en euros.</li></ul></details>
    <a class="small" href="#/rapporte">Voir chaque dossier</a></div>`;
}
