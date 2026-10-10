/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion (Fitness Park Niort). Tous droits réservés. Logiciel protégé (CPI art. L111-1, L112-2, L335-2) : toute reproduction, même partielle, est interdite. */
'use strict';
// ══ FIT PULSE — fiabilité des chiffres ═══════════════════════════════════
// 1. « D'où vient ce chiffre » : chaque chiffre marqué traceAttr() s'ouvre sur
//    ses lignes sources (fichier, ligne, date, montant, saisie ou import) et
//    leur total recalculé, qui doit être exactement la valeur affichée.
// 2. #/controle : écart entre Fit Pulse et les totaux Resamania, par KPI.
// 3. Comparaison N et N-1 à jours égaux (compareN1).
// 4. ?tests=1 : la suite de tests intégrée (cas confirmés), rejouée dans le navigateur.

// Saisies comptées : EXACTEMENT le filtre de l'index (idx) qui alimente sumRange.
// Sans commercial : les membres du périmètre (vue club du tableau de bord, comme statsFor) ;
// avec { tous: true }, toutes les saisies du club (comme sumRange(club, null, …)).
function entriesFor(clubId, userId, kpiId, from, to, { tous = false } = {}) {
  const ids = userId || tous ? null : new Set(perimeterMembers(clubId, from, to).map(u => u.id));
  return Object.values(S.entries || {}).filter(e => e && e.date && e.clubId === clubId && e.kpiId === kpiId && e.date >= from && e.date <= to && (userId ? e.userId === userId : tous || ids.has(e.userId)) && entryCounts(e) && !replacedByImport(e));
}
const cents = L => L.reduce((s, x) => s + Math.round((Number(x.montant) || 0) * 100), 0) / 100;
function traceLigne(e) {
  const impId = e.importId || (e.importIds && Object.keys(e.importIds).find(impActive)) || null; const imp = impId && S.imports[impId];
  return { date: e.date, montant: Number(e.value) || 0, origine: isImported(e) ? 'Import' : 'Saisie manuelle', fichier: imp ? imp.name : isImported(e) ? 'import' : '', ligne: e.line || null, qui: fullName(S.users[e.userId]), ref: e.id };
}
// Lignes sources d'un chiffre. spec : { t: 'kpi', club, user, kpi, from, to } | { t: 'recov', club, from, to, canal } | { t: 'ca', club, user, from, to }
function traceItems(spec) {
  const club = spec.club || CLUB.id;
  if (spec.t === 'kpi') { const L = entriesFor(club, spec.user || null, spec.kpi, spec.from, spec.to, { tous: !!spec.tous }).map(traceLigne); return { titre: (S.kpis[spec.kpi] || {}).label || spec.kpi, unit: (S.kpis[spec.kpi] || {}).unit, lignes: L, total: cents(L) }; }
  if (spec.t === 'ca') { const L = kpiList().filter(k => k.unit === 'eur' && isRevenue(k)).flatMap(k => entriesFor(club, spec.user || null, k.id, spec.from, spec.to, { tous: true }).map(e => ({ ...traceLigne(e), kpi: k.label }))); return { titre: 'Ventes boutique', unit: 'eur', lignes: L, total: cents(L) }; }
  if (spec.t === 'recov') {
    const canal = spec.canal || 'all'; const r = { from: spec.from, to: spec.to };
    // équipe : toutes les saisies du club au KPI Impayés récupérés (comme recoveredFor, sumRange club)
    const teamAll = canal === 'all' || canal === 'equipe' ? Object.values(S.entries || {}).filter(e => e && e.clubId === club && e.kpiId === 'impayes' && e.date >= spec.from && e.date <= spec.to && entryCounts(e) && !replacedByImport(e)).map(e => ({ ...traceLigne(e), canal: 'Équipe' })) : [];
    const rec = (typeof recovList === 'function' ? recovList(club, spec.from, spec.to) : []).filter(x => { const k = x.canal === 'equipe' ? (x.userId ? null : 'equipe_na') : x.canal; return k && (canal === 'all' || canal === k); })
      .map(x => { const imp = x.importId && S.imports[x.importId]; return { date: x.date, montant: Number(x.amount) || 0, origine: 'Import', fichier: imp ? imp.name : 'import', ligne: x.line || null, qui: (RECOV_CHANNELS[x.canal === 'equipe' ? 'equipe_na' : x.canal] || {}).label || x.canal, canal: (RECOV_CHANNELS[x.canal] || {}).label || x.canal, ref: x.id }; });
    const L = [...teamAll, ...rec].sort((a, b) => a.date.localeCompare(b.date));
    return { titre: canal === 'equipe' ? 'Impayés récupérés par l’équipe' : 'Impayés récupérés', unit: 'eur', lignes: L, total: cents(L), attendu: recoveredFor(club, r, canal) };
  }
  return { titre: '', lignes: [], total: 0 };
}
// Attributs à poser sur un chiffre pour le rendre cliquable.
const traceAttr = spec => ` data-act="trace" data-spec="${esc(JSON.stringify(spec))}" role="button" tabindex="0" title="D’où vient ce chiffre ?"`;
ACTIONS.trace = el => {
  let spec; try { spec = JSON.parse(el.dataset.spec); } catch (e) { return; }
  const T = traceItems(spec); const f = v => T.unit === 'eur' ? fmtE(v) : fmtN(v);
  const shown = spec.v != null ? Number(spec.v) : null; const same = shown == null || Math.abs(shown - T.total) < 0.005;
  openModal({ title: 'D’où vient ce chiffre', drawer: true, body: `<p class="muted small" style="margin-top:0">${esc(T.titre)} · du ${esc(dmy(spec.from))} au ${esc(dmy(spec.to))}${spec.user ? ' · ' + esc(fullName(S.users[spec.user])) : ''}</p>
    <div class="trace-tot"><span>Total recalculé</span><b>${f(T.total)}</b>${shown != null ? `<span class="badge ${same ? 'ok' : 'bad'}">${same ? 'égal à la valeur affichée' : 'écart avec la valeur affichée : ' + f(shown)}</span>` : ''}</div>
    ${T.lignes.length ? `<div class="table-wrap"><table class="t trace-t"><thead><tr><th>Date</th><th class="num">${T.unit === 'eur' ? 'Montant' : 'Valeur'}</th><th>Origine</th><th>Fichier</th><th>Ligne</th><th>${spec.t === 'recov' ? 'Canal' : 'Qui'}</th></tr></thead><tbody>
      ${T.lignes.map(x => `<tr><td class="nowrap">${esc(dm(x.date))}</td><td class="num">${f(x.montant)}</td><td>${esc(x.origine)}${x.kpi ? ' · ' + esc(x.kpi) : ''}</td><td class="small">${esc(x.fichier || '')}</td><td class="num">${x.ligne || '<span class="muted">n.d.</span>'}</td><td class="small">${esc(spec.t === 'recov' ? x.canal : x.qui)}</td></tr>`).join('')}
    </tbody></table></div>` : '<p class="muted">Aucune ligne : le chiffre vaut zéro.</p>'}
    <p class="muted small">Une saisie annulée, retirée par un import plus récent ou remplacée par l’import du mois n’est pas listée : elle ne compte pas.</p>`, foot: '<button class="btn" data-close>Fermer</button>' });
};
document.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target && e.target.dataset && e.target.dataset.act === 'trace') { e.preventDefault(); ACTIONS.trace(e.target); } });

// ── Comparaison N et N-1, toujours à jours égaux ──────────────────────────
// Du 1er janvier au jour J contre la même période un an plus tôt ; pour le mois
// en cours, du 1er au jour J des deux côtés (le 9 octobre : 9 jours contre 9).
function memeJourAnPasse(iso) { const y = Number(iso.slice(0, 4)) - 1; const mk = `${y}-${iso.slice(5, 7)}`; return `${mk}-${pad(Math.min(Number(iso.slice(8)), daysIn(mk)))}`; }
function compareN1(clubId, userId, kpiId, jour = today()) {
  const y = jour.slice(0, 4); const debut = `${y}-01-01`; const jourN1 = memeJourAnPasse(jour); const debutN1 = `${Number(y) - 1}-01-01`;
  const mk = jour.slice(0, 7); const mkN1 = jourN1.slice(0, 7);
  return {
    jour, jourN1, jours: Number(jour.slice(8)), joursN1: Number(jourN1.slice(8)),
    n: sumRange(clubId, userId, kpiId, debut, jour), n1: sumRange(clubId, userId, kpiId, debutN1, jourN1),
    moisN: sumRange(clubId, userId, kpiId, mk + '-01', jour), moisN1: sumRange(clubId, userId, kpiId, mkN1 + '-01', jourN1),
  };
}

// ── #/controle : Fit Pulse face aux totaux Resamania ──────────────────────
// Totaux Resamania disponibles : performances commerciales (contrats), CA de
// l'export Évolution / Factures (boutique), liste Incidents (impayés de l'équipe),
// taux de transformation (prospects créés).
function controleRows(clubId, mk) {
  const C = deepGet(S, ['rsm', 'controls', clubId]) || {}; const r = { from: mk + '-01', to: `${mk}-${daysIn(mk)}` };
  const somme = o => o ? Math.round(Object.values(o).reduce((s, v) => s + (typeof v === 'object' && v ? Number(v.created || 0) : Number(v || 0)), 0) * 100) / 100 : null;
  const recRsm = (typeof recovList === 'function' ? recovList(clubId, r.from, r.to) : []).filter(x => x.canal === 'equipe' && x.importId);
  const ca = deepGet(C, ['ca', mk]);
  const lignes = [
    { kpi: 'contrats', label: 'Contrats signés', fp: sumRange(clubId, null, 'contrats', r.from, r.to), rsm: somme(deepGet(C, ['perf', mk])), source: 'Performances commerciales' },
    { kpi: 'boutique', label: 'Ventes boutique (nutrition, accessoires)', fp: Math.round(caMonth(clubId, mk) * 100) / 100, rsm: ca && ca.boutique != null ? Number(ca.boutique) : null, source: 'Chiffre d’affaires (boutique)', t: 'ca' },
    { kpi: 'impayes', label: 'Impayés récupérés par l’équipe', fp: recoveredFor(clubId, r, 'equipe'), rsm: recRsm.length ? Math.round(recRsm.reduce((s, x) => s + Number(x.amount || 0), 0) * 100) / 100 : null, source: 'Liste Incidents (auteur équipe)' },
    { kpi: 'prospects', label: 'Prospects créés', fp: sumRange(clubId, null, 'prospects', r.from, r.to), rsm: somme(deepGet(C, ['tti', mk])), source: 'Taux de transformation par commerciaux' },
  ];
  return lignes.map(l => ({ ...l, ecart: l.rsm == null ? null : Math.round((l.fp - l.rsm) * 100) / 100, certifie: l.rsm != null && Math.abs(l.fp - l.rsm) < 0.005, r }));
}
PAGES.controle = {
  title: 'Contrôle des chiffres',
  manager: true,
  render() {
    const mk = UI.ctrlMonth || addMonths(curMonth(), -1); const L = controleRows(CLUB.id, mk);
    const fv = (l, v) => v == null ? '<span class="muted">pas d’export</span>' : l.kpi === 'boutique' || l.kpi === 'impayes' ? fmtE(v) : fmtN(v);
    const spec = l => l.t === 'ca' ? { t: 'ca', club: CLUB.id, from: l.r.from, to: l.r.to, v: l.fp } : l.kpi === 'impayes' ? { t: 'recov', canal: 'equipe', club: CLUB.id, from: l.r.from, to: l.r.to, v: l.fp } : { t: 'kpi', kpi: l.kpi, tous: true, club: CLUB.id, from: l.r.from, to: l.r.to, v: l.fp };
    return `<div class="page-head"><div><h1>Contrôle des chiffres</h1><p>${esc(nomAffiche())} · Fit Pulse face aux totaux des exports Resamania du mois. Un écart nul vaut le badge « Certifié ».</p></div></div>
      <div class="row wrap" style="margin-bottom:12px">${monthNav('ctrlMonth', mk)}<span class="spacer"></span><span class="badge ${L.every(l => l.certifie || l.rsm == null) && L.some(l => l.certifie) ? 'ok' : ''}">${L.filter(l => l.certifie).length} / ${L.filter(l => l.rsm != null).length} certifiés</span></div>
      <div class="card"><div class="table-wrap"><table class="t ctrl-t"><thead><tr><th>Indicateur</th><th class="num">Fit Pulse</th><th class="num">Resamania</th><th class="num">Écart</th><th>Source Resamania</th><th></th></tr></thead><tbody>
      ${L.map(l => `<tr data-kpi="${l.kpi}"><td><b>${esc(l.label)}</b></td><td class="num"><span class="trace-n"${traceAttr(spec(l))}>${fv(l, l.fp)}</span></td><td class="num">${fv(l, l.rsm)}</td><td class="num">${l.ecart == null ? '' : `<b class="${l.certifie ? 'ok' : 'bad'}">${l.ecart > 0 ? '+' : ''}${fv(l, l.ecart)}</b>`}</td><td class="small muted">${esc(l.source)}</td><td>${l.certifie ? '<span class="badge ok">Certifié</span>' : l.rsm == null ? '<span class="badge">À importer</span>' : '<span class="badge bad">Écart à expliquer</span>'}</td></tr>`).join('')}
      </tbody></table></div></div>
      <p class="muted small">Cliquez un chiffre Fit Pulse pour voir ses lignes sources. Un écart vient le plus souvent d’une saisie manuelle non reprise par Resamania, d’un vendeur non rattaché (Correspondances Resamania) ou d’un export incomplet (liste de 2 000 lignes).</p>`;
  },
};

// ── ?tests=1 : suite de tests intégrée ────────────────────────────────────
// Rejoue les cas confirmés sur une copie isolée des données : rien n'est écrit.
const TESTS_ON = /[?&]tests=1\b/.test(location.search);
async function fpTests() {
  const R = [];
  const t = async (nom, fn) => { try { const r = await fn(); R.push({ nom, ok: r === true, info: r === true ? '' : String(r) }); } catch (e) { R.push({ nom, ok: false, info: e.message }); } };
  const eq = (a, b) => (a === b ? true : `attendu ${JSON.stringify(b)}, obtenu ${JSON.stringify(a)}`);
  // Montants
  await t('« 1.234,56 » vaut 1 234,56', () => eq(parseMontant('1.234,56'), 1234.56));
  await t('« 1 234,56 € » vaut 1 234,56', () => eq(parseMontant('1 234,56 €'), 1234.56));
  await t('« 1,234.56 » vaut 1 234,56', () => eq(parseMontant('1,234.56'), 1234.56));
  await t('« (12,00) » vaut -12', () => eq(parseMontant('(12,00)'), -12));
  await t('montant illisible : NaN, jamais 0', () => eq(Number.isNaN(parseMontant('abc')), true));
  await t('centimes exacts : 3 x 29,90 + 10,30 = 100', () => eq(Math.round([29.9, 29.9, 29.9, 10.3].reduce((s, x) => s + Math.round(x * 100), 0)) / 100, 100));
  // Dates
  await t('date « 09/10/2026 » : 9 octobre', () => eq(parseDate('09/10/2026'), '2026-10-09'));
  await t('date impossible « 31/02/2026 » écartée', () => eq(parseDate('31/02/2026'), null));
  await t('numéro de série Excel 46304 : 9 octobre 2026', () => eq(parseDate('46304'), '2026-10-09'));
  await t('cellule date XLSX lue sans inverser jour et mois', async () => {
    await loadLib('xlsx'); const ws = XLSX.utils.aoa_to_sheet([['Date de création', 'Montant'], [new Date(2026, 9, 3), 12.5]], { cellDates: true }); ws.A2.z = 'm/d/yy';
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'F'); const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const T = await readXlsx('t.xlsx', new Uint8Array(buf)); return eq(T[0].rows[0][0], '2026-10-03');
  });
  // Sur une copie isolée : imports, double comptage, annulation
  const save = S, saveRev = REV;
  try {
    S = normalizeState(JSON.parse(JSON.stringify(save))); REV++;
    const club = Object.keys(S.clubs)[0]; const uid = clubMembers(club).find(u => !u.virtual) || Object.values(S.users)[0];
    if (!S.rsm) S.rsm = {}; if (!S.rsm.aliases) S.rsm.aliases = {}; S.rsm.aliases['c:TSTX'] = uid.id;
    const csv = ['Numéro du client;Nom du produit;Echéancier;Date de création;Nom de l’offre;Etat;Canal;Prix toutes taxes;Prénom;Nom;Prénom du commercial initial;Nom du commercial initial;Code du commercial initial',
      `990001;Abonnement Premium;Mensuel;${today()};Premium;Validé;Club;29,99;Test;UN;X;Y;TSTX`, `990002;Abonnement Basic;Mensuel;${today()};Basic;Validé;Club;24,99;Test;DEUX;X;Y;TSTX`].join('\n');
    const lire = async () => { const T = await readAnyFile({ name: 'test.csv', size: csv.length, arrayBuffer: async () => new TextEncoder().encode(csv).buffer }); return T.map(x => analyzeTable(x, { clubId: club, month: curMonth() })); };
    const appliquer = ops => { ops.forEach(([p, v]) => setPath(S, p, v)); REV++; };
    const total = () => sumRange(club, null, 'contrats', today(), today());
    const avant = total();
    const p1 = rsmCommitPlan(await lire(), { club, by: uid.id }); appliquer(p1.ops); const apres1 = total();
    await t('import : 2 contrats ajoutés', () => eq(apres1 - avant, 2));
    const p2 = rsmCommitPlan(await lire(), { club, by: uid.id }); appliquer(p2.ops);
    await t('pas de double comptage : réimporter le même fichier ne change rien', () => eq(total(), apres1));
    await t('numéro de ligne gardé pour « D’où vient ce chiffre »', () => eq(entriesFor(club, uid.id, 'contrats', today(), today()).filter(e => e.rowKey && /990001/.test(e.rowKey)).map(e => e.line).join(), '2'));
    const ids = p1.ops.filter(([p]) => p[0] === 'imports' && p.length === 2).map(([p]) => p[1]).concat(p2.ops.filter(([p]) => p[0] === 'imports' && p.length === 2).map(([p]) => p[1]));
    ids.forEach(id => { S.imports[id].active = false; }); REV++;
    await t('annulation des imports : les contrats retirés', () => eq(total(), avant));
    ids.slice(0, 1).forEach(id => { S.imports[id].active = true; }); REV++;
    await t('rétablir un import : les contrats reviennent, une seule fois', () => eq(total(), apres1));
    await t('détail d’un chiffre : somme égale à la valeur affichée', () => eq(traceItems({ t: 'kpi', club, kpi: 'contrats', from: curMonth() + '-01', to: today() }).total, statsFor(club, null, rangeOf('month', curMonth())).rows.find(x => x.k.id === 'contrats').real));
    await t('comparaison N et N-1 du 9 octobre : 9 jours contre 9 jours', () => { const c = compareN1(club, null, 'contrats', '2026-10-09'); return eq([c.jours, c.joursN1, c.jourN1].join(), '9,9,2025-10-09'); });
  } finally { S = save; REV = saveRev + 1; }
  return R;
}
function fpTestsPanel(R) {
  const ko = R.filter(x => !x.ok).length;
  let el = $('#fp-tests'); if (!el) { el = document.createElement('div'); el.id = 'fp-tests'; document.body.appendChild(el); }
  el.innerHTML = `<div class="fp-tests-h"><b>Tests intégrés</b><span class="badge ${ko ? 'bad' : 'ok'}">${ko ? ko + ' en échec' : 'tous au vert'} · ${R.length}</span><button class="btn sm ghost" onclick="this.closest('#fp-tests').remove()">Fermer</button></div>
    <ol>${R.map(x => `<li class="${x.ok ? 'ok' : 'bad'}" data-ok="${x.ok}">${x.ok ? 'Réussi' : 'Échec'} : ${esc(x.nom)}${x.info ? ` <span class="muted">(${esc(x.info)})</span>` : ''}</li>`).join('')}</ol>`;
}
if (TESTS_ON) addEventListener('load', () => setTimeout(async () => { if (!S) { const d = demoState(); S = normalizeState(d); REV++; } window.FP_TESTS = await fpTests(); fpTestsPanel(window.FP_TESTS); }, 800));
