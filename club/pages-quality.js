/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion (Fitness Park Niort). Tous droits réservés. Logiciel protégé (CPI art. L111-1, L112-2, L335-2) : toute reproduction, même partielle, est interdite. */
'use strict';
// ══ FIT PULSE — contrôle qualité des données (manager) ═════════════════════
// Chaque chiffre se rapproche de Resamania et remonte jusqu'à ses lignes.

PAGES.quality = {
  title: 'Contrôle qualité', manager: true,
  render() {
    const mk = UI.qMonth || curMonth(); const r = rangeOf('month', mk); const C = deepGet(S, ['rsm', 'controls', CLUB.id]) || {};
    const st = (v, ref) => { if (ref == null || v == null) return { cls: '', l: 'Pas de référence' }; const e = Math.abs(v - ref); const p = ref ? e / ref : (e ? 1 : 0); return e <= 1 || p <= 0.01 ? { cls: 'is-ok', l: 'Conforme' } : p <= 0.03 ? { cls: 'is-warn', l: 'Petit écart' } : { cls: 'is-bad', l: 'Écart à vérifier' }; };
    const perf = C.perf && C.perf[mk]; const perfTot = perf ? Object.values(perf).reduce((s, v) => s + (Number(v) || 0), 0) : null;
    const tti = C.tti && C.tti[mk]; const ttiTr = tti ? Object.values(tti).reduce((s, v) => s + (Number(v.transformed) || 0), 0) : null;
    const evo = C.evo && C.evo[mk] || {};
    const fp = k => sumRange(CLUB.id, null, k, r.from, r.to);
    const enc = encaisseMois(CLUB.id, mk);
    const lines = [
      ['Contrats signés', fp('contrats'), perfTot, 'Performances commerciales', 'contrats'],
      ['Prospects transformés', fp('contrats'), ttiTr, 'Taux de transformation', null],
      ['Nouveaux entrants', fp('contrats'), evo.gained != null ? Number(evo.gained) : null, 'Évolution clients', null],
      ['Encaissements', null, enc, 'Paiements (référence seule)', null],
    ];
    // Contrôles automatiques
    const alerts = [];
    const live = Object.values(S.entries).filter(e => e.clubId === CLUB.id && e.date >= r.from && e.date <= r.to);
    const repl = live.filter(e => entryCounts(e) && replacedByImport(e));
    if (repl.length) alerts.push(['is-info', `${plur(repl.length, 'saisie manuelle remplacée', 'saisies manuelles remplacées')} par l’import du même mois (pas de double compte).`]);
    const removed = live.filter(e => e.removedBy && impActive(e.removedBy));
    if (removed.length) alerts.push(['is-warn', `${plur(removed.length, 'vente retirée', 'ventes retirées')} : absentes du dernier export de gestion, sans doute annulées dans Resamania.`]);
    for (const k of kpiList()) { const na = unassigned(CLUB.id, k.id, r.from, r.to); if (Math.abs(na) > 0.004) alerts.push(['is-warn', `${esc(k.label)} : ${fmtV(na, k.unit)} non attribué (créateur, autre club ou membre archivé avant le mois).`]); }
    const arch = clubMembers(CLUB.id, { all: true }).filter(u => u.status === 'archived' && live.some(e => e.userId === u.id && entryCounts(e)));
    if (arch.length) alerts.push(['is-info', `Saisies de membres archivés ce mois : ${arch.map(u => esc(fullName(u))).join(', ')}.`]);
    const unk = perf ? Object.keys(perf).filter(k => k.startsWith('x:')) : [];
    if (unk.length) alerts.push(['is-warn', `${plur(unk.length, 'vendeur Resamania non rattaché', 'vendeurs Resamania non rattachés')} : voir Équipe > Correspondances Resamania.`]);
    const check = deepGet(S, ['entries']) && kpiList().every(k => { const tot = sumRange(CLUB.id, null, k.id, r.from, r.to); const rk = perimeterMembers(CLUB.id, r.from, r.to).reduce((s, u) => s + sumRange(CLUB.id, u.id, k.id, r.from, r.to), 0); return Math.abs(tot - rk - unassigned(CLUB.id, k.id, r.from, r.to)) < 0.01; });
    if (!check) alerts.push(['is-bad', 'La somme du classement ne correspond pas au total club : contactez le support.']);
    return `<div class="page-head"><div><h1>Contrôle qualité</h1><p>${esc(CLUB.name)} · chaque chiffre rapproché de Resamania et traçable jusqu’à sa ligne.</p></div><span class="spacer"></span>${monthNav('qMonth', mk)}</div>
      <div class="card"><h3>Rapprochement avec Resamania</h3>
        <div class="table-wrap"><table class="t"><thead><tr><th>Indicateur</th><th class="num">Fit Pulse</th><th class="num">Resamania</th><th class="num">Écart</th><th>Source</th><th>Statut</th></tr></thead><tbody>
        ${lines.map(([l, v, ref, src, kpi]) => { const s = st(v, ref); return `<tr><td>${l}</td><td class="num">${v == null ? '' : kpi ? `<a href="javascript:void 0" data-act="qTrace" data-k="${kpi}">${fmtN(v)}</a>` : fmtN(v)}</td><td class="num">${ref == null ? '<span class="muted">non importé</span>' : fmtN(ref)}</td><td class="num">${v != null && ref != null ? (v - ref > 0 ? '+' : '') + fmtN(v - ref) : ''}</td><td class="small muted">${src}</td><td><span class="tag ${s.cls}">${s.l}</span></td></tr>`; }).join('')}
        </tbody></table></div>
        ${perf ? `<h3 style="margin-top:16px">Contrats par commercial</h3><div class="table-wrap"><table class="t"><thead><tr><th>Commercial</th><th class="num">Fit Pulse</th><th class="num">Resamania</th><th class="num">Écart</th></tr></thead><tbody>
          ${perimeterMembers(CLUB.id, r.from, r.to).map(u => { const v = sumRange(CLUB.id, u.id, 'contrats', r.from, r.to), ref = Number(perf[u.id]) || 0; const tol = Math.max(1, ref * 0.05); return `<tr><td>${esc(fullName(u))}</td><td class="num">${fmtN(v)}</td><td class="num">${fmtN(ref)}</td><td class="num ${Math.abs(v - ref) > tol ? 'bad' : ''}">${(v - ref > 0 ? '+' : '') + fmtN(v - ref)}</td></tr>`; }).join('')}
        </tbody></table></div>` : ''}
      </div>
      <div class="card"><h3>Contrôles automatiques</h3>${alerts.length ? alerts.map(([c, t]) => `<div class="q-alert"><span class="tag ${c}">${c === 'is-bad' ? 'À corriger' : c === 'is-warn' ? 'À vérifier' : 'Info'}</span><span>${t}</span></div>`).join('') : '<p class="muted">Rien à signaler pour ce mois.</p>'}</div>
      <div class="card"><h3>D’où viennent les chiffres</h3><p class="muted small">Cliquez un KPI pour voir chaque saisie qui le compose : date, membre, source, fichier.</p>
        <div class="row wrap">${kpiList().map(k => `<button class="btn sm" data-act="qTrace" data-k="${k.id}">${kpiIcon(k, 'ico ico-xs')} ${esc(k.label)} · ${fmtV(fp(k.id), k.unit)}</button>`).join('')}</div>
        <div class="row" style="margin-top:12px"><button class="btn sm" data-act="qExport">${ico('download')} Exporter les saisies du mois (CSV)</button></div></div>`;
  },
};
function qRows(kpiId, mk) {
  const from = mk + '-01', to = `${mk}-${daysIn(mk)}`;
  return Object.values(S.entries).filter(e => e.clubId === CLUB.id && e.date >= from && e.date <= to && (!kpiId || e.kpiId === kpiId)).sort((a, b) => a.date.localeCompare(b.date))
    .map(e => { const imp = S.imports[e.importId]; const counts = entryCounts(e) && !replacedByImport(e); return { e, imp, counts, why: !entryCounts(e) ? (e.removedBy ? 'retirée par un import plus récent' : e.suppressed ? 'doublon écarté' : 'import annulé') : replacedByImport(e) ? 'remplacée par l’import' : '' }; });
}
ACTIONS.qTrace = el => {
  const k = S.kpis[el.dataset.k]; const mk = UI.qMonth || curMonth(); const rows = qRows(el.dataset.k, mk);
  openModal({ title: `${k ? k.label : ''} · ${monthLabel(mk)}`, drawer: true, body: `<p class="muted small">Total compté : <b>${fmtV(rows.filter(x => x.counts).reduce((s, x) => s + Number(x.e.value || 0), 0), k ? k.unit : 'qty')}</b> sur ${plur(rows.length, 'ligne', 'lignes')}.</p>
    <div class="table-wrap"><table class="t"><thead><tr><th>Date</th><th>Membre</th><th class="num">Valeur</th><th>Source</th></tr></thead><tbody>
    ${rows.map(x => `<tr class="${x.counts ? '' : 'muted'}"><td class="nowrap">${dm(x.e.date)}</td><td>${S.users[x.e.userId] ? esc(fullName(S.users[x.e.userId])) : 'Non attribué'}</td><td class="num">${fmtV(Number(x.e.value) || 0, k ? k.unit : 'qty')}</td><td class="small">${x.e.adjust ? 'Correction manager' : isImported(x.e) ? 'Import ' + esc(x.imp ? x.imp.name || '' : '') : 'Saisie manuelle'}${x.e.rowKey ? `<br><span class="muted">${esc(String(x.e.rowKey).slice(0, 60))}</span>` : ''}${x.why ? `<br><b>${x.why}</b>` : ''}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">Aucune saisie.</td></tr>'}
    </tbody></table></div>` });
};
ACTIONS.qExport = () => {
  const mk = UI.qMonth || curMonth();
  const rows = qRows(null, mk).map(x => [x.e.date, S.users[x.e.userId] ? fullName(S.users[x.e.userId]) : 'Non attribué', S.kpis[x.e.kpiId] ? S.kpis[x.e.kpiId].label : x.e.kpiId, csvNum(x.e.value), x.e.adjust ? 'Correction' : isImported(x.e) ? 'Import' : 'Manuelle', x.imp ? x.imp.name || '' : '', x.counts ? 'oui' : 'non', x.why]);
  downloadFile(`fitpulse-saisies-${CLUB.id}-${mk}-CONFIDENTIEL.csv`, toCsv(['Date', 'Membre', 'KPI', 'Valeur', 'Source', 'Fichier', 'Comptée', 'Pourquoi'], rows), 'text/csv;charset=utf-8');
  db.set(['audit', newId()], { at: Date.now(), by: ME.id, action: 'export_csv', club: CLUB.id, type: 'saisies', lignes: rows.length });
};
