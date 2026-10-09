/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion (Fitness Park Niort). Tous droits réservés. Logiciel protégé (CPI art. L111-1, L112-2, L335-2) : toute reproduction, même partielle, est interdite. */
'use strict';
// ══ FIT PULSE — Rapport ROI mensuel (Récapitulatif > Rapport ROI) ══════════
// Une feuille A4 portrait que le manager remet au directeur. Toute valeur estimée
// porte « estimation » ; une source manquante affiche « non calculable » plutôt que 0.
const ROI_DEFAUT = { minImport: 20, minClose: 3, minLog: 1, monthsKept: 12, minCall: 4 };
const roiCfg = (clubId = CLUB.id) => ({ ...ROI_DEFAUT, ...(deepGet(S, ['roiCfg', clubId]) || {}) });
const roiPrix = (clubId = CLUB.id) => Number(deepGet(S, ['billing', 'clubs', clubId, 'price'])) || Number(deepGet(S, ['billing', 'price'])) || null;
// Une régularisation, un encaissement : y a-t-il une action du club sur ce client avant ? (historique du dossier ou contact noté)
function actionAvant(c, avantMs) {
  if (!c) return false;
  if (((c.dunning || {}).history || []).some(h => h && h.at < avantMs && h.by && h.outcome !== 'paye' && h.outcome !== 'acompte' && !/^Récupéré|^Acompte/.test(h.label || ''))) return true;
  return Object.values(S.touches || {}).some(t => t && t.clientId === c.id && t.at < avantMs);
}
const clientParNum = (clubId, num) => num ? Object.values(S.clients).find(c => c.clubId === clubId && String(c.num || '') === String(num)) : null;
function roiFigures(clubId, mk) {
  const b = { from: mk + '-01', to: `${mk}-${daysIn(mk)}` }; const t0 = dateOf(b.from).getTime(), t1 = dateOf(addMonths(mk, 1) + '-01').getTime(); const cfg = roiCfg(clubId);
  // Source : un import Incidents actif couvrant le mois, ou des régularisations datées du mois.
  const incidents = Object.values(S.imports || {}).filter(i => i && i.clubId === clubId && i.defId === 'incidents' && i.active !== false && (!i.from || i.from <= b.to) && (!i.to || i.to >= b.from) && (i.from || i.to || (i.at >= t0 && i.at < t1)));
  const aIncidents = incidents.length > 0 || Object.values(S.recov || {}).some(x => x && x.clubId === clubId && x.date >= b.from && x.date <= b.to);
  // Récupéré : recupFP (encaissements de l'équipe précédés d'une action du club) + recupAuto (tout le reste) = total de la page Impayés.
  const total = recoveredFor(clubId, b);
  let recupFP = 0;
  Object.values(S.entries || {}).forEach(e => { if (!e || e.clubId !== clubId || e.kpiId !== 'impayes' || e.date < b.from || e.date > b.to || !entryCounts(e)) return;
    const c = e.clientId ? S.clients[e.clientId] : clientParNum(clubId, e.clientNum); if (actionAvant(c, dateOf(e.date).getTime() + 864e5)) recupFP += Number(e.value) || 0; });
  recupFP = Math.round(recupFP * 100) / 100; const recupAuto = Math.round((total - recupFP) * 100) / 100;
  // Gardés : sauvetages du mois, renouvellements après appel, J+30 joints ; valeur = mensualité x mois gardés.
  const gardes = []; const m = c => (c ? (typeof tarifMensuel === 'function' && tarifMensuel(c)) || mensualite(c, true) || 0 : 0);
  Object.values(S.entries || {}).forEach(e => { if (!e || e.clubId !== clubId || e.kpiId !== 'sauvetage' || e.date < b.from || e.date > b.to || !entryCounts(e)) return;
    const r = /^sv_/.test(e.id) ? S.resiliations[e.id.slice(3)] : null; const c = e.clientId ? S.clients[e.clientId] : r ? resClient(r) : null; gardes.push({ type: /^rn_/.test(e.id) ? 'renouvellement' : 'sauvetage', c, m: m(c) || (r ? valeurEnJeu(r).prix : 0) }); });
  Object.values(S.loyalty || {}).forEach(a => { if (!a || a.at < t0 || a.at >= t1) return; const c = S.clients[a.clientId]; if (!c || c.clubId !== clubId) return; const o = OUTCOMES[a.outcome] || {};
    if ((a.type === 'suivi30' || (a.type === 'suivi' && Number(a.step) === 30)) && o.done && !o.lost && !gardes.some(g => g.c === c && g.type === 'j30')) gardes.push({ type: 'j30', c, m: m(c) }); });
  const valeurGardee = Math.round(gardes.reduce((s, g) => s + g.m * cfg.monthsKept, 0) * 100) / 100;
  // Temps gagné (estimation) : imports automatiques, dossiers clos à l'import, relances notées.
  const importsAuto = Object.values(S.imports || {}).filter(i => i && i.clubId === clubId && i.auto && i.at >= t0 && i.at < t1).length;
  const closImport = Object.values(S.clients || {}).filter(c => c.clubId === clubId && c.dunning && c.dunning.auto && (c.dunning.recoveredAt || '') >= b.from && (c.dunning.recoveredAt || '') <= b.to).length
    + Object.values(S.resiliations || {}).filter(r => r && r.clubId === clubId && r.closedBy === 'resamania' && r.closedAt >= t0 && r.closedAt < t1).length;
  const relances = typeof appelsDu === 'function' ? appelsDu(clubId, mk) : 0;
  const tempsH = Math.round((importsAuto * cfg.minImport + closImport * cfg.minClose + relances * cfg.minLog) / 60 * 10) / 10;
  const prix = roiPrix(clubId); const roi = prix ? Math.round((recupFP + valeurGardee) / prix * 10) / 10 : null;
  const delai = recoveryDelay(clubId, mk), delaiPrec = recoveryDelay(clubId, addMonths(mk, -1));
  const sources = Object.values(S.imports || {}).filter(i => i && i.clubId === clubId && i.source === 'resamania' && i.active !== false && i.at >= t0 && i.at < t1).sort((a, b) => a.at - b.at);
  return { mk, aIncidents, total, recupFP, recupAuto, gardes, nGardes: gardes.length, valeurGardee, importsAuto, closImport, relances, tempsH, prix, roi, delai, delaiPrec, sources, cfg };
}
const roiMoisNom = mk => MOIS[Number(mk.slice(5)) - 1].toLowerCase();
function roiPhrase(R) {
  const rec = R.aIncidents ? `récupérer ${fmtE(R.recupFP)}` : 'suivre ses impayés';
  return `En ${roiMoisNom(R.mk)}, Fit Pulse a aidé l’équipe à ${rec} et à garder ${plur(R.nGardes, 'adhérent', 'adhérents')}${R.roi != null ? `, soit ${String(R.roi).replace('.', ',')} fois le prix de l’abonnement` : ''}.`;
}
function roiRapport(mk) {
  const C = CLUB.id; const R = roiFigures(C, mk); const nc = 'non calculable : importez Incidents';
  const months = Array.from({ length: 6 }, (_, i) => addMonths(mk, i - 5)); const H = months.map(m => roiFigures(C, m));
  const team = clubMembers(C).filter(u => !u.virtual).map(u => ({ u, ...resultatsLigne(C, mk, u.id) })).filter(x => x.rec || x.sauv || x.appels).sort((a, b) => b.garde - a.garde);
  const ecart = R.delai != null && R.delaiPrec != null ? R.delai - R.delaiPrec : null;
  const chiffre = (k, v, l, sub) => `<div class="roi-k" data-roi="${k}"><b class="roi-v">${v}</b><span class="roi-l">${l}</span><small>${sub}</small></div>`;
  return `<div class="roi-page" id="roi-page">
    <header class="roi-head"><div class="roi-brand">${logoMark(34)}<b>Fit Pulse</b></div><div class="roi-meta"><b>RAPPORT MENSUEL</b><span>${esc(monthLabel(mk))}</span></div><div class="roi-club">${esc(nomAffiche())}</div></header>
    <h1 class="roi-titre">Synthèse du mois</h1><p class="roi-phrase" data-phrase>${esc(roiPhrase(R))}</p>
    <div class="roi-kpis">
      ${chiffre('recup', R.aIncidents ? fmtE(R.recupFP) : '<span class="roi-nc">non calculable</span>', 'récupérés grâce à Fit Pulse', R.aIncidents ? `${fmtE(R.recupAuto)} sans action du club, à part` : nc)}
      ${chiffre('gardes', String(R.nGardes), plur(R.nGardes, 'adhérent gardé', 'adhérents gardés'), `${fmtE(R.valeurGardee)} de valeur, ${R.cfg.monthsKept} mois (estimation)`)}
      ${chiffre('delai', R.delai == null ? '<span class="roi-nc">n.d.</span>' : plur(R.delai, 'jour', 'jours'), 'de délai médian', R.delai == null ? (R.aIncidents ? 'moins de 3 régularisations équipe' : nc) : ecart == null ? 'de l’incident à la régularisation' : `${ecart === 0 ? 'stable' : Math.abs(ecart) + ' j de ' + (ecart < 0 ? 'moins' : 'plus')} que le mois précédent`)}
      ${chiffre('temps', String(R.tempsH).replace('.', ',') + ' h', 'gagnées', 'estimation')}</div>
    <section class="roi-bloc"><h2>Par commercial</h2>${team.length ? `<table class="t roi-t"><thead><tr><th>Commercial</th><th class="num">Récupérés</th><th class="num">Sauvés</th><th class="num">Délai médian</th><th class="num">Appels</th></tr></thead><tbody>${team.map(x => `<tr><td>${esc(fullName(x.u))}</td><td class="num">${fmtE(x.rec)}</td><td class="num">${fmtE(x.sauv)}</td><td class="num">${x.delai == null ? 'n.d.' : x.delai + ' j'}</td><td class="num">${x.appels}</td></tr>`).join('')}</tbody></table>` : '<p class="muted small">Aucune action notée ce mois-ci.</p>'}</section>
    <section class="roi-bloc"><h2>6 mois</h2>${monthBars(months, [{ label: 'Récupéré grâce à Fit Pulse', color: 'var(--roi-jaune-fonce)', values: H.map(x => x.aIncidents ? x.recupFP : 0) }, { label: 'Valeur gardée (estimation)', color: '#1d1d1f', values: H.map(x => x.valeurGardee) }], { fmt: v => fmtE(v), height: 150, width: 640 })}</section>
    <footer class="roi-pied">
      <p><b>Méthodologie.</b> Récupéré grâce à Fit Pulse : encaissements de l’équipe du mois dont le client avait une action notée avant le règlement (historique du dossier ou contact). Sans action du club : tous les autres encaissements, page Impayés (${fmtE(R.recupFP)} + ${fmtE(R.recupAuto)} = ${fmtE(R.total)}). Gardés : sauvetages, renouvellements après appel et suivis J+30 joints ; valeur = mensualité x ${R.cfg.monthsKept} mois. Temps gagné : ${R.importsAuto} import(s) automatique(s) x ${R.cfg.minImport} min + ${R.closImport} dossier(s) clos à l’import x ${R.cfg.minClose} min + ${R.relances} relance(s) notée(s) x ${R.cfg.minLog} min. ${R.prix ? `Multiple : (récupéré grâce à Fit Pulse + valeur gardée) / ${fmtE(R.prix)} d’abonnement.` : 'Prix de l’abonnement non renseigné : multiple masqué.'}</p>
      <p><b>Sources.</b> ${R.sources.length ? R.sources.map(i => `${esc(i.name || i.defId)} (${dmy(isoOf(new Date(i.at)))})`).join(', ') : 'aucun import Resamania ce mois-ci'}. Généré le ${dmy(today())} à ${timeOf(Date.now()).replace(':', ' h ')} par Fit Pulse.</p></footer>
  </div>`;
}
function roiOnglet() {
  const mk = UI.recapMonth || addMonths(curMonth(), -1);
  return `<div class="row wrap no-print" style="margin-bottom:12px;gap:8px">${monthNav('recapMonth', mk)}<span class="spacer"></span><a class="btn sm" href="#/members" data-act="ui" data-key="memTab" data-val="reglages">Réglages du rapport</a><button class="btn primary" data-act="roiPrint">${ico('download')} Imprimer ou PDF</button></div>${roiRapport(mk)}`;
}
ACTIONS.roiPrint = () => { document.body.classList.add('print-roi'); ACTIONS.recapPrint(); setTimeout(() => document.body.classList.remove('print-roi'), 1500); };

// ── Membres > Réglages > ROI ───────────────────────────────────────────────
function roiCard() {
  const c = roiCfg(); const p = roiPrix();
  const champ = (k, l, unit) => `<label class="field"><span>${l}</span><input class="input" type="number" min="0" step="1" name="${k}" value="${c[k]}" data-change="roiSet" data-k="${k}"><small class="muted">${unit}</small></label>`;
  return `<div class="card" id="roi-cfg"><h3>Rapport ROI</h3><p class="muted small">Paramètres du rapport mensuel (Récapitulatif > Rapport ROI). Les durées servent à l’estimation du temps gagné.</p>
    <div class="form-grid">${champ('minImport', 'Import automatique', 'minutes gagnées par import')}${champ('minClose', 'Dossier clos à l’import', 'minutes gagnées par dossier')}${champ('minLog', 'Relance notée', 'minutes gagnées par relance')}${champ('monthsKept', 'Mois gardés', 'par adhérent gardé')}${champ('minCall', 'Durée d’un appel', 'minutes (euros par heure)')}
    <label class="field"><span>Prix de l’abonnement Fit Pulse</span><input class="input" inputmode="decimal" value="${p ? String(p).replace('.', ',') : ''}" placeholder="non renseigné" data-change="roiPrixSet"><small class="muted">€ par mois ; vide : multiple masqué</small></label></div></div>`;
}
ACTIONS.roiSet = el => { const v = Math.max(0, Math.min(600, Number(el.value) || 0)); db.set(['roiCfg', CLUB.id, el.dataset.k], v); toast(`Paramètre enregistré : ${v}`); };
ACTIONS.roiPrixSet = el => { const v = parseMontant(el.value); db.set(['billing', 'price'], Number.isFinite(v) && v > 0 ? Math.round(v * 100) / 100 : null); toast(Number.isFinite(v) && v > 0 ? `Prix enregistré : ${fmtE(v)}` : 'Prix effacé : multiple masqué'); };
