/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion (Fitness Park Niort). Tous droits réservés. Logiciel protégé (CPI art. L111-1, L112-2, L335-2) : toute reproduction, même partielle, est interdite. */
'use strict';
// ══ FIT PULSE — primes simulées, comparatif des clubs, envoi au directeur ══
const PRIME_NOTE = 'Simulation indicative, non contractuelle. Seule la fiche de paie fait foi.';
const compOf = (clubId, mk) => deepGet(S, ['comp', clubId, mk]) || null;
function compRules(clubId, mk) { const c = compOf(clubId, mk); if (c) return c; const months = Object.keys(deepGet(S, ['comp', clubId]) || {}).filter(m => m < mk).sort(); return months.length ? S.comp[clubId][months.at(-1)] : { individual: {}, cap: null, prorataPresence: true }; }
function presenceRatio(clubId, uid, mk) { const r = rangeOf('month', mk); const tot = workdays(null, clubId, r.from, r.to) || 1; return workdays(uid, clubId, r.from, r.to) / tot; }
// Prime d'un membre pour un mois (extra : unités ajoutées par le simulateur).
function primeOf(clubId, uid, mk, extra = {}, { projete = false } = {}) {
  const R = compRules(clubId, mk); const r = rangeOf('month', mk); const exp = projete ? elapsed(r, clubId, uid) : 1; const lines = []; let ind = 0;
  Object.entries(R.individual || {}).forEach(([k, rule]) => {
    const K = S.kpis[k]; if (!K || !rule) return; const tgt = monthTarget(mk, uid, k);
    let real = sumRange(clubId, uid, k, r.from, r.to) + (Number(extra[k]) || 0); if (projete && exp > 0.05 && exp < 1) real = real / exp;
    const pct = tgt > 0 ? real / tgt : null; let p = 0, txt = '';
    if (rule.mode === 'paliers') { const t = (rule.tiers || []).filter(x => pct != null && pct >= Number(x.pct) / 100 - 1e-9).sort((a, b) => b.pct - a.pct)[0]; p = t ? Number(t.amount) : 0; txt = t ? `palier ${t.pct} % atteint` : `aucun palier (${fmtP(pct)})`; }
    else { const ok = pct != null && pct >= (Number(rule.minPct) || 0) / 100 - 1e-9; p = ok ? Math.floor(real) * (Number(rule.perUnit) || 0) : 0; txt = ok ? `${fmtN(Math.floor(real))} × ${fmtE(Number(rule.perUnit) || 0)}` : `seuil ${rule.minPct || 0} % non atteint (${fmtP(pct)})`; }
    ind += p; lines.push({ k: K, p, txt });
  });
  if (R.cap) ind = Math.min(ind, Number(R.cap));
  let col = 0; Object.keys(paliersFor(clubId, mk)).forEach(k => { const s = palierState(clubId, mk, k); if (!s) return; s.tiers.filter(t => s.real >= Number(t.target)).forEach(t => { col += Number(t.amount) || 0; }); });
  if (R.prorataPresence !== false) col = col * presenceRatio(clubId, uid, mk);
  return { ind: Math.round(ind * 100) / 100, col: Math.round(col * 100) / 100, total: Math.round((ind + col) * 100) / 100, lines };
}
// Carte membre : acquis, projeté, simulateur.
function primeCard(uid = ME.id) {
  const mk = curMonth(); const R = compRules(CLUB.id, mk); const ks = Object.keys(R.individual || {}).filter(k => S.kpis[k]);
  const hasCol = Object.values(paliersFor(CLUB.id, mk)).some(L => (L || []).some(t => Number(t.amount) > 0)); if (!ks.length && !hasCol) return '';
  const sim = UI.primeSim || {}; const now = primeOf(CLUB.id, uid, mk), proj = primeOf(CLUB.id, uid, mk, {}, { projete: true }), withSim = primeOf(CLUB.id, uid, mk, sim);
  const k0 = UI.primeK && ks.includes(UI.primeK) ? UI.primeK : ks[0];
  return `<div class="card prime-card"><div class="race-h"><div><div class="eyebrow">Estimation</div><h3>Ma prime estimée</h3></div></div>
    <div class="row wrap" style="gap:18px"><div><span class="muted small">Acquis à date</span><br><b class="num-l">${fmtE(now.total)}</b></div><div><span class="muted small">Projeté fin de mois</span><br><b class="num-l">${fmtE(proj.total)}</b></div></div>
    ${k0 ? `<div class="prime-sim">Si je fais encore <button class="btn icon sm" data-act="primeSim" data-k="${k0}" data-d="-1" aria-label="Moins">−</button><b>${Number(sim[k0]) || 0}</b><button class="btn icon sm" data-act="primeSim" data-k="${k0}" data-d="1" aria-label="Plus">+</button><select class="input sm" style="width:auto" data-change="primeK">${ks.map(k => `<option value="${k}" ${k === k0 ? 'selected' : ''}>${esc(S.kpis[k].label)}</option>`).join('')}</select> : <b>${fmtE(withSim.total)}</b></div>` : ''}
    <div class="small" style="margin-top:8px">${withSim.lines.map(l => `<div>${esc(l.k.label)} : ${esc(l.txt)} = <b>${fmtE(l.p)}</b></div>`).join('')}${withSim.col ? `<div>Part collective (paliers d’équipe${compRules(CLUB.id, mk).prorataPresence !== false ? ', au prorata de la présence' : ''}) : <b>${fmtE(withSim.col)}</b></div>` : ''}</div>
    <p class="muted small" style="margin:8px 0 0">${PRIME_NOTE}</p></div>`;
}
ACTIONS.primeSim = el => { const s = UI.primeSim = UI.primeSim || {}; s[el.dataset.k] = Math.max(0, (Number(s[el.dataset.k]) || 0) + Number(el.dataset.d)); render(); };
ACTIONS.primeK = el => { UI.primeK = el.value; render(); };
// Onglet Primes (manager) : règles du mois et tableau de l'équipe.
function memPrimes() {
  const mk = UI.primeMonth || curMonth(); const R = compRules(CLUB.id, mk); const saved = !!compOf(CLUB.id, mk);
  const kpis = kpiList().filter(k => k.points > 0 || k.id === 'contrats');
  const rows = clubMembers(CLUB.id).map(u => ({ u, p: primeOf(CLUB.id, u.id, mk), pr: primeOf(CLUB.id, u.id, mk, {}, { projete: true }) }));
  return `<div class="row wrap" style="margin-bottom:12px">${monthNav('primeMonth', mk)}<span class="spacer"></span>${saved ? '<span class="badge ok">Règles du mois enregistrées</span>' : '<span class="badge warn">Reprises du mois précédent</span>'}</div>
    <div class="card"><h3>Règles individuelles</h3><p class="muted small">Par unité : montant par unité dès un % de l’objectif. Par palier : un montant fixe au plus haut palier atteint (% de l’objectif). Les montants collectifs se règlent dans Paliers collectifs (€ par personne).</p>
      <div class="table-wrap"><table class="t"><thead><tr><th>KPI</th><th>Mode</th><th class="num">€ par unité</th><th class="num">Dès (%)</th><th>Paliers (% : €)</th></tr></thead><tbody>
      ${kpis.map(k => { const x = (R.individual || {})[k.id] || {}; return `<tr><td>${esc(k.label)}</td><td><select class="input sm" data-cp="${k.id}" data-f="mode"><option value="">Aucune prime</option><option value="unite" ${x.mode === 'unite' ? 'selected' : ''}>Par unité</option><option value="paliers" ${x.mode === 'paliers' ? 'selected' : ''}>Par palier</option></select></td><td class="num"><input class="cell" data-cp="${k.id}" data-f="perUnit" value="${x.perUnit ?? ''}"></td><td class="num"><input class="cell" data-cp="${k.id}" data-f="minPct" value="${x.minPct ?? ''}"></td><td><input class="input sm" data-cp="${k.id}" data-f="tiers" placeholder="80:50, 100:100, 120:150" value="${esc((x.tiers || []).map(t => `${t.pct}:${t.amount}`).join(', '))}"></td></tr>`; }).join('')}</tbody></table></div>
      <div class="row wrap" style="gap:12px;margin-top:10px"><label class="field" style="max-width:220px"><span>Plafond de la part individuelle (€)</span><input class="input" id="cp-cap" value="${R.cap ?? ''}" placeholder="aucun"></label><label class="row small"><input type="checkbox" id="cp-pro" ${R.prorataPresence !== false ? 'checked' : ''}> Part collective au prorata de la présence</label><span class="spacer"></span><button class="btn primary" data-act="compSave" data-mk="${mk}">Enregistrer les règles de ${monthLabel(mk).toLowerCase()}</button></div></div>
    <div class="card" style="margin-top:14px"><h3>L’équipe</h3><div class="table-wrap"><table class="t"><thead><tr><th>Membre</th><th class="num">Part individuelle</th><th class="num">Part collective</th><th class="num">Total à date</th><th class="num">Projection</th></tr></thead><tbody>
      ${rows.map(x => `<tr><td>${esc(fullName(x.u))}</td><td class="num">${fmtE(x.p.ind)}</td><td class="num">${fmtE(x.p.col)}</td><td class="num"><b>${fmtE(x.p.total)}</b></td><td class="num">${fmtE(x.pr.total)}</td></tr>`).join('')}
      <tr class="total"><td>Coût club</td><td class="num">${fmtE(rows.reduce((s, x) => s + x.p.ind, 0))}</td><td class="num">${fmtE(rows.reduce((s, x) => s + x.p.col, 0))}</td><td class="num">${fmtE(rows.reduce((s, x) => s + x.p.total, 0))}</td><td class="num">${fmtE(rows.reduce((s, x) => s + x.pr.total, 0))}</td></tr></tbody></table></div><p class="muted small">${PRIME_NOTE}</p></div>`;
}
ACTIONS.compSave = el => {
  const ind = {}; $$('[data-cp]').forEach(i => { const k = i.dataset.cp; const o = ind[k] = ind[k] || {}; const f = i.dataset.f; if (f === 'mode') o.mode = i.value; else if (f === 'tiers') o.tiers = i.value.split(',').map(x => x.split(':').map(s => parseMontant(s))).filter(([p, a]) => p > 0 && a >= 0).map(([pct, amount]) => ({ pct, amount })); else { const v = parseMontant(i.value); o[f] = Number.isNaN(v) ? null : v; } });
  Object.keys(ind).forEach(k => { if (!ind[k].mode) delete ind[k]; });
  const cap = parseMontant($('#cp-cap').value || '');
  db.batch([[['comp', CLUB.id, el.dataset.mk], { individual: ind, cap: Number.isNaN(cap) ? null : cap, prorataPresence: $('#cp-pro').checked }], [['audit', newId()], { at: Date.now(), by: ME.id, action: 'primes_regles', club: CLUB.id, mk: el.dataset.mk }]]);
  toast('Règles de prime enregistrées');
};

// ── Comparatif des clubs ──────────────────────────────────────────────────
function clubCompare() {
  const mk = UI.cmpMonth || addMonths(curMonth(), -1); const r = rangeOf('month', mk); const clubs = myClubs(); const cr = clubRanking(r);
  const req = kpiList().filter(k => k.required);
  const data = clubs.map(c => { const st = statsFor(c.id, null, r); const F = monthFigures(c.id, mk); const act = Number(deepGet(S, ['base', c.id, mk, 'actifs'])) || F.actifs || 0; const n = clubMembers(c.id).length || 1; const tti = deepGet(S, ['rsm', 'controls', c.id, 'tti', mk]); const tc = tti ? Object.values(tti).reduce((a, x) => a + Number(x.created || 0), 0) : 0, tt = tti ? Object.values(tti).reduce((a, x) => a + Number(x.transformed || 0), 0) : 0;
    const py = addMonths(mk, -12); const cN = sumRange(c.id, null, 'contrats', r.from, r.to), cN1 = sumRange(c.id, null, 'contrats', py + '-01', `${py}-${daysIn(py)}`);
    return { c, score: (cr.find(x => x.c.id === c.id) || {}).score, kp: Object.fromEntries(req.map(k => { const x = st.rows.find(y => y.k.id === k.id) || {}; return [k.id, { pct: x.pct, per: (x.real || 0) / n }]; })), per1000: act ? Math.round(cN / act * 10000) / 10 : null, resil: F.tauxResil, sauv: F.demandes ? F.sauvees / F.demandes : null, equipe: F.recupere ? F.impayesEquipe / F.recupere : null, tti: tc ? tt / tc : null, evo: cN1 ? (cN - cN1) / cN1 : null, act, contrats: cN }; });
  const ind = [['score', 'Score moyen', v => fmtP(v), 1], ...req.flatMap(k => [[`kp.${k.id}.pct`, `${k.label} (% objectif)`, v => fmtP(v), 1], [`kp.${k.id}.per`, `${k.label} par membre`, v => fmtV(v, k.unit), 1]]), ['per1000', 'Contrats pour 1 000 adhérents', v => (v == null ? 'n.d.' : String(v).replace('.', ',')), 1], ['resil', 'Taux de résiliation', v => (v == null ? 'n.d.' : (v * 100).toFixed(1).replace('.', ',') + ' %'), -1], ['sauv', 'Taux de sauvetage', v => fmtP(v), 1], ['equipe', 'Part équipe des impayés récupérés', v => fmtP(v), 1], ['tti', 'Taux de transformation', v => fmtP(v), 1], ['evo', 'Contrats N / N-1', v => (v == null ? 'n.d.' : (v >= 0 ? '+' : '') + Math.round(v * 100) + ' %'), 1]];
  const get = (d, path) => path.split('.').reduce((o, k) => (o == null ? null : o[k]), d);
  const best = ind.map(([p, , , dir]) => { const vals = data.map(d => get(d, p)).filter(v => v != null); return vals.length ? (dir > 0 ? Math.max(...vals) : Math.min(...vals)) : null; });
  const tips = []; ind.forEach(([p, l, f, dir], i) => { const vals = data.map(d => ({ d, v: get(d, p) })).filter(x => x.v != null); if (vals.length < 2) return; const s = vals.slice().sort((a, b) => dir * (b.v - a.v)); const hi = s[0], lo = s[s.length - 1]; if (hi.v && Math.abs(hi.v - lo.v) / Math.abs(hi.v) > 0.2) tips.push(`${hi.d.c.name} : ${l.toLowerCase()} ${f(hi.v)}, contre ${f(lo.v)} à ${lo.d.c.name}.`); });
  const totAct = data.reduce((s, d) => s + d.act, 0);
  UI._cmp = { ind, data, get };
  return `<div class="row wrap" style="margin-bottom:12px">${monthNav('cmpMonth', mk)}<span class="spacer"></span><button class="btn sm" data-act="cmpCsv">${ico('download')} CSV</button></div>
    <div class="table-wrap card"><table class="t"><thead><tr><th>Indicateur</th>${data.map(d => `<th class="num">${esc(d.c.name)}</th>`).join('')}<th class="num">Écart</th></tr></thead><tbody>
    ${ind.map(([p, l, f], i) => { const vals = data.map(d => get(d, p)); const fin = vals.filter(v => v != null); return `<tr><td>${esc(l)}</td>${vals.map(v => `<td class="num">${v != null && v === best[i] && fin.length > 1 ? `<b>${f(v)}</b>` : f(v)}</td>`).join('')}<td class="num muted">${fin.length > 1 && typeof fin[0] === 'number' && best[i] != null ? Math.round(Math.abs(Math.max(...fin) - Math.min(...fin)) * (p.includes('per') && !p.includes('pct') ? 1 : 100)) + (p.includes('per') && !p.includes('pct') ? '' : ' pts') : ''}</td></tr>`; }).join('')}
    <tr class="total"><td>Total nos clubs</td><td colspan="${data.length + 1}">${fmtN(data.reduce((s, d) => s + d.contrats, 0))} contrats · ${fmtN(totAct)} adhérents actifs${totAct ? ` · ${String(Math.round(data.reduce((s, d) => s + d.contrats, 0) / totAct * 10000) / 10).replace('.', ',')} contrats pour 1 000` : ''}</td></tr></tbody></table></div>
    ${tips.length ? `<div class="card" style="margin-top:14px"><h3>À dupliquer</h3>${tips.map(t => `<p class="small" style="margin:6px 0">${esc(t)}</p>`).join('')}<button class="btn sm" data-act="cmpShare">Partager dans le canal commun</button></div>` : ''}`;
}
ACTIONS.cmpCsv = () => { const C = UI._cmp; if (!C) return; downloadFile(`fitpulse-comparatif-${UI.cmpMonth || addMonths(curMonth(), -1)}.csv`, toCsv(['Indicateur', ...C.data.map(d => d.c.name)], C.ind.map(([p, l, f]) => [l, ...C.data.map(d => f(C.get(d, p)))])), 'text/csv;charset=utf-8'); };
ACTIONS.cmpShare = () => { const t = $$('.card h3').find(h => h.textContent === 'À dupliquer'); if (!t) return; const txt = [...t.parentElement.querySelectorAll('p')].map(p => p.textContent).join('\n'); const prev = UI.chatCh; UI.chatCh = 'all'; sendChat({ text: `Bonnes pratiques entre clubs\n${txt}` }); UI.chatCh = prev; toast('Partagé dans le canal commun'); };

// ── Envoi au directeur, exports, bilan individuel imprimable ─────────────
ACTIONS.recapMail = () => {
  const c = S.clubs[CLUB.id]; const mk = UI.recapMonth || addMonths(curMonth(), -1); const pm = addMonths(mk, -1);
  if (!c.directorEmail) { toast('Renseignez l’e-mail du directeur.'); ACTIONS.clubForm({ dataset: { id: CLUB.id } }); return; }
  const F = monthFigures(CLUB.id, mk), P = monthFigures(CLUB.id, pm);
  const d = (a, b, eur) => { if (a == null || b == null) return ''; const x = a - b; return ` (${x >= 0 ? '+' : ''}${eur ? fmtE(x) : fmtN(x)}${b ? `, ${x >= 0 ? '+' : ''}${Math.round(x / b * 100)} %` : ''})`; };
  const L = [`Récapitulatif ${c.name}, ${monthLabel(mk).toLowerCase()}`, '', `Contrats : ${fmtN(F.contrats)}${d(F.contrats, P.contrats)}`, `Nouveaux entrants : ${fmtN(F.entrants)}${d(F.entrants, P.entrants)}`, `Résiliations : ${fmtN(F.resiliees)}${d(F.resiliees, P.resiliees)}`, `Taux de résiliation : ${F.tauxResil == null ? 'n.d.' : (F.tauxResil * 100).toFixed(1).replace('.', ',') + ' %'}`, `Impayés en cours : ${F.du == null ? 'n.d.' : fmtE(F.du)}`, `Impayés récupérés par l’équipe : ${fmtE(F.impayesEquipe)}${d(F.impayesEquipe, P.impayesEquipe, true)}`, `Avis Google : ${fmtN(F.avis)}${d(F.avis, P.avis)}`, `Boutique : ${fmtE(F.boutique)}${d(F.boutique, P.boutique, true)}`, ''];
  const moves = [['Contrats', F.contrats, P.contrats], ['Avis Google', F.avis, P.avis], ['Boutique', F.boutique, P.boutique], ['Impayés récupérés', F.impayesEquipe, P.impayesEquipe]].filter(x => x[2]).map(x => [x[0], (x[1] - x[2]) / x[2]]).sort((a, b) => b[1] - a[1]);
  L.push('Faits marquants');
  if (moves.length) { L.push(`Meilleure hausse : ${moves[0][0]} (${moves[0][1] >= 0 ? '+' : ''}${Math.round(moves[0][1] * 100)} %)`); L.push(`Plus forte baisse : ${moves.at(-1)[0]} (${Math.round(moves.at(-1)[1] * 100)} %)`); }
  const pal = Object.keys(paliersFor(CLUB.id, mk)).map(k => { const s = palierState(CLUB.id, mk, k); return s && s.reached ? `${S.kpis[k].label} palier ${s.reached}` : null; }).filter(Boolean); L.push(`Paliers atteints : ${pal.join(', ') || 'aucun'}`);
  L.push('', 'PDF joint : Imprimer / PDF depuis Fit Pulse');
  const body = L.join('\n').slice(0, 1790);
  location.href = `mailto:${encodeURIComponent(c.directorEmail)}?subject=${encodeURIComponent(`Récapitulatif ${c.name} ${monthLabel(mk).toLowerCase()}`)}&body=${encodeURIComponent(body)}`;
};
ACTIONS.histCsv = () => {
  const mk = UI.histMonth || curMonth(); const r = rangeOf('month', mk); const kpis = kpiList(); const members = clubMembers(CLUB.id);
  downloadFile(`fitpulse-historique-${CLUB.id}-${mk}.csv`, toCsv(['Membre', ...kpis.flatMap(k => [k.label, 'Objectif', '%'])], members.map(u => [fullName(u), ...kpis.flatMap(k => { const v = sumRange(CLUB.id, u.id, k.id, r.from, r.to), t = monthTarget(mk, u.id, k.id); return [csvNum(v), csvNum(t), t ? Math.round(v / t * 100) + ' %' : '']; })])), 'text/csv;charset=utf-8');
};
ACTIONS.recapCsv = () => {
  const mk = UI.recapMonth || addMonths(curMonth(), -1); const r = rangeOf('month', mk); const team = clubMembers(CLUB.id, { all: true }).filter(u => u.status !== 'pending');
  const cols = [['contrats', 'Contrats'], ['avis', 'Avis Google'], ['nutrition', 'Nutrition'], ['accessoires', 'Accessoires'], ['impayes', 'Impayés récupérés'], ['sauvetage', 'Sauvetages']];
  downloadFile(`fitpulse-recap-${CLUB.id}-${mk}.csv`, toCsv(['Commercial', ...cols.map(c => c[1])], team.map(u => [fullName(u), ...cols.map(([k]) => csvNum(sumRange(CLUB.id, u.id, k, r.from, r.to)))])), 'text/csv;charset=utf-8');
};
// Bilan individuel A4, sobre, imprimable.
ACTIONS.bilanPdf = el => {
  const uid = el.dataset.u, mk = el.dataset.mk; const u = S.users[uid]; const r = rangeOf('month', mk);
  const st = statsFor(CLUB.id, uid, r), sR = statsFor(CLUB.id, uid, r, { requiredOnly: true }); const rk = ranking(CLUB.id, r).find(x => x.u.id === uid);
  const prev = statsFor(CLUB.id, uid, rangeOf('month', addMonths(mk, -1)), { requiredOnly: true }).score;
  const avg3 = [1, 2, 3].map(i => statsFor(CLUB.id, uid, rangeOf('month', addMonths(mk, -i)), { requiredOnly: true }).score).filter(x => x != null); const a3 = avg3.length ? avg3.reduce((s, x) => s + x, 0) / avg3.length : null;
  const note = Object.values(deepGet(S, ['coaching', uid, 'notes']) || {}).filter(n => n.shared).sort((a, b) => b.at - a.at)[0];
  const w = document.createElement('div'); w.className = 'bilan-print';
  w.innerHTML = `<header><b>${esc(CLUB.name)}</b><span>${monthLabel(mk)}</span></header><h1>Bilan de ${esc(fullName(u))}</h1>
    <p>Score du mois : <b>${fmtP(sR.score)}</b>${rk ? ` · rang ${rk.rank}` : ''} · mois précédent ${fmtP(prev)} · moyenne des 3 mois ${fmtP(a3)}</p>
    <table><thead><tr><th>KPI</th><th>Réalisé</th><th>Objectif</th><th>%</th><th>Écart</th></tr></thead><tbody>${st.rows.filter(x => x.target > 0 || x.real > 0).map(x => `<tr><td>${esc(x.k.label)}</td><td>${fmtV(x.real, x.k.unit)}</td><td>${fmtV(x.target, x.k.unit)}</td><td>${fmtP(x.pct)}</td><td>${x.target ? fmtV(x.real - x.target, x.k.unit) : ''}</td></tr>`).join('')}</tbody></table>
    <div class="bilan-note"><b>Commentaire du manager</b><p>${note ? esc(note.text) : ''}</p></div>`;
  document.body.appendChild(w); document.body.classList.add('printing-bilan');
  setTimeout(() => { window.print(); document.body.classList.remove('printing-bilan'); w.remove(); }, 100);
};

// Revue mensuelle : cinq phrases en tête du récapitulatif.
function recapSynthese(mk) {
  const F = monthFigures(CLUB.id, mk), P = monthFigures(CLUB.id, addMonths(mk, -1)); const r = rangeOf('month', mk); const L = [];
  const v = (a, b) => (b ? `${a - b >= 0 ? 'en hausse' : 'en baisse'} de ${Math.abs(Math.round((a - b) / b * 100))} %` : 'sans comparaison');
  L.push(`${fmtN(F.contrats)} contrats signés, ${v(F.contrats, P.contrats)} par rapport au mois précédent.`);
  const rk = ranking(CLUB.id, r).filter(x => x.score != null); if (rk[0]) L.push(`${fullName(rk[0].u)} termine en tête avec un score de ${fmtP(rk[0].score)}.`);
  const team = clubMembers(CLUB.id); const ups = team.map(u => ({ u, d: (statsFor(CLUB.id, u.id, r, { requiredOnly: true }).score || 0) - (statsFor(CLUB.id, u.id, rangeOf('month', addMonths(mk, -1)), { requiredOnly: true }).score || 0) })).sort((a, b) => b.d - a.d);
  if (ups[0] && ups[0].d > 0) L.push(`Plus belle progression : ${fullName(ups[0].u)}, +${Math.round(ups[0].d * 100)} points de score.`);
  L.push(`${plur(F.resiliees, 'résiliation effective', 'résiliations effectives')} et ${plur(F.sauvees, 'client sauvé', 'clients sauvés')} sur ${plur(F.demandes, 'demande', 'demandes')}.`);
  L.push(`Impayés : ${fmtE(F.impayesEquipe)} récupérés par l’équipe${F.du != null ? `, ${fmtE(F.du)} encore dus en fin de mois` : ''}.`);
  return `<div class="card recap-syn"><h3>En bref</h3>${L.slice(0, 5).map(s => `<p>${esc(s)}</p>`).join('')}</div>`;
}
