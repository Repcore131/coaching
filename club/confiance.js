/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion (Fitness Park Niort). Tous droits réservés. Logiciel protégé (CPI art. L111-1, L112-2, L335-2) : toute reproduction, même partielle, est interdite. */
'use strict';
// ══ FIT PULSE — « Vos chiffres sont-ils justes ? » (#/confiance) ══════════
// Pour chaque KPI du mois : la valeur Fit Pulse (celle de sumRange) et son détail
// par source (saisies manuelles, imports actifs, corrections de manager), la valeur
// de contrôle Resamania quand un export la donne (controleRows de fiabilite.js),
// l'écart, et les doublons probables : même commercial, même KPI, même date, une
// saisie manuelle ET une saisie importée. Une seule lecture des saisies du mois.

// Valeur de contrôle Resamania par KPI (mêmes sources que #/controle).
function controleParKpi(clubId, mk) {
  const C = deepGet(S, ['rsm', 'controls', clubId]) || {}; const out = {};
  controleRows(clubId, mk).forEach(l => { if (l.rsm != null && S.kpis[l.kpi]) out[l.kpi] = { v: l.rsm, source: l.source }; });
  const ca = deepGet(C, ['ca', mk]) || {};
  ['nutrition', 'accessoires'].forEach(k => { if (ca[k] != null && S.kpis[k]) out[k] = { v: Number(ca[k]), source: 'Chiffre d’affaires' }; });
  return out;
}
function confianceData(clubId, mk) {
  const from = mk + '-01', to = `${mk}-${pad(daysIn(mk))}`; const cover = idx().cover;
  const parKpi = new Map(); const cles = new Map();
  for (const e of Object.values(S.entries)) {
    if (!e || e.clubId !== clubId || !e.date || e.date < from || e.date > to) continue;
    let L = parKpi.get(e.kpiId); if (!L) parKpi.set(e.kpiId, L = []); L.push(e);
    if (!e.suppressed) { const k = `${e.userId}|${e.kpiId}|${e.date}`; let c = cles.get(k); if (!c) cles.set(k, c = { m: 0, i: 0 }); if (isImported(e)) c.i++; else if (!e.adjust) c.m++; }
  }
  const doublon = e => { const c = cles.get(`${e.userId}|${e.kpiId}|${e.date}`); return !!c && c.m > 0 && c.i > 0 && !e.adjust; };
  const ctrl = controleParKpi(clubId, mk);
  const lignes = kpiList().filter(k => k.enabled !== false).map(k => {
    const L = parKpi.get(k.id) || []; const comptees = L.filter(e => entryCounts(e) && !replacedByImport(e, cover));
    const c = arr => Math.round(arr.reduce((s, e) => s + Math.round((Number(e.value) || 0) * 100), 0)) / 100;
    const manuel = c(comptees.filter(e => !isImported(e) && !e.adjust)), imports = c(comptees.filter(e => isImported(e))), corrections = c(comptees.filter(e => e.adjust));
    const fp = sumRange(clubId, null, k.id, from, to); const ref = ctrl[k.id] || null;
    const ecart = ref ? Math.round((fp - ref.v) * 100) / 100 : null; const pct = ref && ref.v ? Math.abs(ecart) / Math.abs(ref.v) : ref ? (ecart ? 1 : 0) : null;
    const pastille = ref == null ? null : Math.abs(ecart) < 0.005 ? 'vert' : pct < 0.02 ? 'orange' : 'rouge';
    const doublons = L.filter(doublon).length;
    return { k, fp, manuel, imports, corrections, ref, ecart, pct, pastille, doublons, n: L.length };
  });
  return { mk, lignes, doublon, parKpi };
}
// Badge de l'accueil : tous les KPI contrôlés sont verts, sans doublon probable.
function chiffresVerifies(clubId) {
  const mk = addMonths(curMonth(), -1); const D = confianceData(clubId, mk); const ctl = D.lignes.filter(l => l.ref);
  if (!ctl.length || !ctl.every(l => l.pastille === 'vert') || D.lignes.some(l => l.doublons)) return null;
  const at = Math.max(0, ...Object.values(S.imports || {}).filter(i => i.clubId === clubId && i.active !== false).map(i => Number(i.at) || 0));
  return at ? isoOf(new Date(at)) : today();
}
function badgeVerifies(clubId) { const d = isManager() ? chiffresVerifies(clubId) : null; return d ? `<a class="badge ok verif-badge" href="#/confiance" title="Tous les KPI contrôlés sont égaux aux exports Resamania">${ico('check', 'ico ico-xs')} Chiffres vérifiés le ${esc(d.slice(8, 10) + '/' + d.slice(5, 7))}</a>` : ''; }

PAGES.confiance = {
  title: 'Confiance des chiffres',
  manager: true,
  render() {
    const mk = UI.confMonth || addMonths(curMonth(), -1); const t0 = performance.now(); const D = confianceData(CLUB.id, mk); const ms = performance.now() - t0;
    const fv = (k, v) => fmtV(v, k.unit);
    const pt = p => p ? `<i class="hdot conf-${p}" title="${p === 'vert' ? 'Égal au contrôle' : p === 'orange' ? 'Écart de moins de 2 %' : 'Écart de 2 % ou plus'}" data-pastille="${p}"></i>` : '';
    return `<div class="page-head"><div><h1>Confiance des chiffres</h1><p>${esc(CLUB.name)} · vos chiffres sont-ils justes ? Chaque KPI, sa source et son contrôle Resamania.</p></div></div>
      <div class="row wrap" style="margin-bottom:12px">${monthNav('confMonth', mk)}<span class="spacer"></span><span class="muted small" data-ms="${Math.round(ms)}">calculé en ${Math.max(1, Math.round(ms))} ms</span></div>
      <div class="card"><div class="table-wrap"><table class="t conf-t"><thead><tr><th>KPI</th><th class="num">Fit Pulse</th><th>Détail par source</th><th class="num">Contrôle Resamania</th><th class="num">Écart</th><th></th></tr></thead><tbody>
      ${D.lignes.map(l => `<tr data-kpi="${l.k.id}"><td><b>${esc(l.k.label)}</b>${l.doublons ? `<div class="bad small" data-doublons="${l.doublons}">${plur(l.doublons, 'doublon probable', 'doublons probables')}</div>` : ''}</td>
        <td class="num"><b>${fv(l.k, l.fp)}</b></td>
        <td class="small">saisies ${fv(l.k, l.manuel)} · imports ${fv(l.k, l.imports)}${l.corrections ? ` · corrections ${fv(l.k, l.corrections)}` : ''}</td>
        <td class="num">${l.ref ? `${fv(l.k, l.ref.v)}<div class="muted small">${esc(l.ref.source)}</div>` : '<span class="muted small">pas de contrôle importé</span>'}</td>
        <td class="num nowrap">${l.ref ? `${pt(l.pastille)} ${l.ecart > 0 ? '+' : ''}${fv(l.k, l.ecart)} <span class="muted small">${(l.pct * 100).toFixed(1).replace('.', ',')} %</span>` : ''}</td>
        <td><button class="btn sm" data-act="confLignes" data-k="${l.k.id}" data-mk="${mk}" ${l.n ? '' : 'disabled'}>Voir les lignes</button></td></tr>`).join('')}</tbody></table></div></div>
      <p class="muted small">Pastille verte : égal au contrôle ; orange : écart de moins de 2 % ; rouge : 2 % ou plus. Un doublon probable est une saisie manuelle et une saisie importée du même commercial, pour le même KPI et le même jour ; sur un KPI alimenté par Resamania, la saisie manuelle est déjà remplacée par l’import.</p>`;
  },
};
ACTIONS.confLignes = el => {
  const mk = el.dataset.mk, kid = el.dataset.k, k = S.kpis[kid]; const D = confianceData(CLUB.id, mk); const cover = idx().cover;
  const L = (D.parKpi.get(kid) || []).slice().sort((a, b) => a.date.localeCompare(b.date) || String(a.userId).localeCompare(String(b.userId)));
  const etat = e => !entryCounts(e) ? 'non comptée (import annulé ou vente retirée)' : replacedByImport(e, cover) ? 'remplacée par l’import' : 'comptée';
  openModal({ title: `${k.label} · ${monthLabel(mk)}`, wide: true, body: `<div class="table-wrap"><table class="t"><thead><tr><th>Date</th><th>Commercial</th><th class="num">Valeur</th><th>Source</th><th>Import</th><th>État</th></tr></thead><tbody>
    ${L.map(e => { const imp = e.importId && S.imports[e.importId]; const d = D.doublon(e); return `<tr data-id="${esc(e.id)}" class="${d ? 'conf-doublon' : ''}"><td class="nowrap">${esc(dm(e.date))}</td><td>${esc(fullName(S.users[e.userId]))}</td><td class="num">${fmtV(Number(e.value) || 0, k.unit)}</td><td>${e.adjust ? 'Correction manager' : isImported(e) ? 'Import' : 'Saisie manuelle'}${d ? ' <b class="bad">doublon probable</b>' : ''}</td><td class="small">${imp ? esc(imp.name || imp.id) : isImported(e) ? 'import' : ''}</td><td class="small">${etat(e)}</td></tr>`; }).join('')}</tbody></table></div>` });
};
