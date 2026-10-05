'use strict';
// ══ FIT PULSE — saisonnalité, prévision de fin de mois, « ce qu'il manque » ══

// ── Coefficients saisonniers (moyenne 1) ──────────────────────────────────
const SAISON_DEFAUT = [1.5, 1.1, 1.0, 0.95, 0.9, 0.8, 0.6, 0.7, 1.4, 1.1, 0.95, 0.8];
const MONTHLY_KEY = { contrats: 'contrats', nutrition: 'complements', accessoires: 'goodies', impayes: 'impayes' };
const normCoefs = a => { const m = a.reduce((s, x) => s + x, 0) / a.length; return a.map(x => (m ? x / m : 1)); };
function monthValue(clubId, kpiId, mk) {
  const v = sumRange(clubId, null, kpiId, mk + '-01', `${mk}-${daysIn(mk)}`);
  if (v) return v;
  const man = deepGet(S, ['monthly', clubId, mk, MONTHLY_KEY[kpiId] || kpiId]); return Number(man) || 0;
}
function coefSaison(clubId, kpiId) {
  return memo(`coef|${clubId}|${kpiId}`, () => {
    const by = Array.from({ length: 12 }, () => []); let filled = 0;
    for (let i = 1; i <= 24; i++) { const mk = addMonths(curMonth(), -i); const v = monthValue(clubId, kpiId, mk); if (v > 0) { by[Number(mk.slice(5)) - 1].push(v); filled++; } }
    if (filled < 12 || by.some(L => !L.length)) return { coefs: normCoefs(SAISON_DEFAUT), source: 'défaut' };
    return { coefs: normCoefs(by.map(L => L.reduce((s, x) => s + x, 0) / L.length)), source: 'historique' };
  });
}
// Répartit un total entier sur des poids, sans perdre d'unité (plus forts restes).
function splitRound(total, weights, decimals = 0) {
  const f = 10 ** decimals; const T = Math.round(total * f); const sw = weights.reduce((s, x) => s + x, 0) || 1;
  const raw = weights.map(w => T * w / sw); const base = raw.map(Math.floor); let rest = T - base.reduce((s, x) => s + x, 0);
  raw.map((x, i) => [x - Math.floor(x), i]).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (rest > 0) { base[i]++; rest--; } });
  return base.map(x => x / f);
}
const SAISON_KPIS = () => kpiList().filter(k => k.points > 0 || ['contrats', 'nutrition', 'accessoires'].includes(k.id));
ACTIONS.yearPlan = () => {
  const y = Number(today().slice(0, 4)) + (today().slice(5, 7) >= '09' ? 1 : 0);
  openModal({ title: `Objectifs de l’année ${y}`, wide: true, body: `<p class="muted small" style="margin-top:0">Saisissez l’objectif annuel du club : il est réparti par mois selon la saisonnalité (janvier et septembre plus forts), puis par commercial selon sa part des 3 derniers mois. Rien n’est enregistré avant « Valider ».</p>
    <form id="ypf" class="form-grid">${SAISON_KPIS().map(k => { const cur = Array.from({ length: 12 }, (_, i) => clubMonthTarget(`${y - 1}-${pad(i + 1)}`, CLUB.id, k.id)).reduce((s, x) => s + x, 0); return `<label class="field"><span>${esc(k.label)} (${k.unit === 'eur' ? '€' : 'quantité'})</span><input class="input" name="${k.id}" inputmode="decimal" placeholder="${cur ? 'année passée : ' + fmtN(cur) : ''}"></label>`; }).join('')}</form><div id="yp-prev"></div>`,
    foot: `<button class="btn" data-close>Annuler</button><button class="btn" data-act="yearPreview" data-y="${y}">Aperçu</button><button class="btn primary" data-act="yearSave" data-y="${y}">Valider</button>` });
};
function yearPlanCompute(y) {
  const f = formData($('#ypf')); const members = clubMembers(CLUB.id); const plan = {};
  SAISON_KPIS().forEach(k => {
    const annual = parseMontant(f[k.id] || ''); if (Number.isNaN(annual) || annual <= 0) return;
    const { coefs, source } = coefSaison(CLUB.id, k.id); const dec = k.unit === 'eur' ? 0 : 0;
    const months = splitRound(annual, coefs, dec);
    const from3 = addMonths(curMonth(), -3) + '-01', to3 = addDays(curMonth() + '-01', -1);
    const shares = members.map(u => sumRange(CLUB.id, u.id, k.id, from3, to3)); const tot = shares.reduce((s, x) => s + x, 0);
    const w = members.map((u, i) => (tot ? shares[i] || tot / members.length / 2 : 1));
    plan[k.id] = { k, source, months, users: months.map(v => splitRound(v, w, 0)) };
  });
  return { plan, members };
}
ACTIONS.yearPreview = el => {
  const y = Number(el.dataset.y); const { plan } = yearPlanCompute(y); const ks = Object.values(plan);
  $('#yp-prev').innerHTML = ks.length ? `<div class="table-wrap" style="margin-top:12px"><table class="t"><thead><tr><th>Mois</th>${ks.map(p => `<th class="num">${esc(p.k.label)}</th>`).join('')}</tr></thead><tbody>
    ${MOIS.map((m, i) => `<tr><td>${m}</td>${ks.map(p => `<td class="num"><input class="cell" data-yp="${p.k.id}" data-m="${i}" value="${p.months[i]}"></td>`).join('')}</tr>`).join('')}
    <tr class="total"><td>Total</td>${ks.map(p => `<td class="num">${fmtN(p.months.reduce((s, x) => s + x, 0))}</td>`).join('')}</tr></tbody></table></div><p class="muted small">Coefficients : ${ks.map(p => `${esc(p.k.label)} ${p.source}`).join(' · ')}. Les mois passés ne sont pas modifiés.</p>` : '<p class="muted small">Saisissez au moins un objectif annuel.</p>';
};
ACTIONS.yearSave = async el => {
  const y = Number(el.dataset.y); const { plan, members } = yearPlanCompute(y); if (!Object.keys(plan).length) { toast('Saisissez au moins un objectif annuel.'); return; }
  // valeurs retouchées dans l'aperçu
  $$('#yp-prev [data-yp]').forEach(i => { const p = plan[i.dataset.yp]; const v = parseMontant(i.value); if (p && !Number.isNaN(v)) { const m = Number(i.dataset.m); p.months[m] = v; const w = p.users[m].map(x => x || 0.0001); p.users[m] = splitRound(v, w, 0); } });
  if (!await confirmDlg(`Enregistrer les objectifs mensuels de ${y} (mois à venir uniquement) ?`, { ok: 'Valider' })) return;
  const ops = [];
  Object.values(plan).forEach(p => p.months.forEach((v, i) => { const mk = `${y}-${pad(i + 1)}`; if (mk < curMonth()) return; members.forEach((u, j) => ops.push([['targets', mk, u.id, p.k.id], p.users[i][j] || 0])); }));
  ops.push([['audit', newId()], { at: Date.now(), by: ME.id, action: 'objectifs_annee', club: CLUB.id, annee: y }]);
  db.batch(ops); closeModal(); toast('Objectifs de l’année enregistrés');
};
// Paliers proposés : 90 %, 100 % et 115 % de l'objectif du mois.
ACTIONS.palPropose = async () => {
  const mk = UI.palMonth || curMonth(); const cur = paliersFor(CLUB.id, mk); const out = {};
  Object.keys(cur).forEach(k => { const t = clubMonthTarget(mk, CLUB.id, k); if (!(t > 0)) { out[k] = cur[k]; return; } out[k] = [0.9, 1, 1.15].map((f, i) => ({ target: Math.round(t * f), reward: ((cur[k] || [])[i] || {}).reward || '' })); });
  if (!await confirmDlg(`Paliers proposés pour ${monthLabel(mk).toLowerCase()} : ${Object.entries(out).map(([k, L]) => `${(S.kpis[k] || {}).label || k} ${L.map(t => fmtN(t.target)).join(' / ')}`).join(', ')}.`, { ok: 'Appliquer' })) return;
  db.set(['paliers', CLUB.id, mk], out); toast('Paliers proposés appliqués');
};
// Bandeau d'accueil trois semaines avant janvier et septembre.
function saisonBanner() {
  const t = today(); const y = Number(t.slice(0, 4));
  const peaks = [`${y}-09-01`, `${y + 1}-01-01`, `${y}-01-01`]; const p = peaks.map(d => [d, dayDiff(t, d)]).find(([, n]) => n > 0 && n <= 21);
  return p ? `<a class="recap-ready" href="#/dashboard" data-act="goFunnel">${ico('flag')}<div><b>Pic de saison dans ${plur(p[1], 'jour', 'jours')}</b><span>Préparez prospects et invités : ${p[0].slice(5, 7) === '01' ? 'janvier' : 'septembre'} pèse souvent 1,4 à 1,6 fois un mois moyen.</span></div>${ico('chevR')}</a>` : '';
}
ACTIONS.goFunnel = () => { UI.dashTab = 'entonnoir'; };

// ── Prévision de fin de mois ──────────────────────────────────────────────
function dayVals(clubId, kpiId, mk, userId = null) { const n = daysIn(mk); return Array.from({ length: n }, (_, i) => sumRange(clubId, userId, kpiId, `${mk}-${pad(i + 1)}`, `${mk}-${pad(i + 1)}`)); }
function forecastModel(clubId, kpiId) {
  return memo(`fcm|${clubId}|${kpiId}`, () => {
    const w = Array(7).fill(0), wn = Array(7).fill(0); const bonus = []; const months = [1, 2, 3].map(i => addMonths(curMonth(), -i));
    months.forEach(mk => {
      const v = dayVals(clubId, kpiId, mk); const tot = v.reduce((s, x) => s + x, 0); if (!tot) return; const n = v.length;
      const cnt = Array(7).fill(0), sum = Array(7).fill(0); v.forEach((x, i) => { const d = dateOf(`${mk}-${pad(i + 1)}`).getDay(); cnt[d]++; sum[d] += x; });
      for (let d = 0; d < 7; d++) if (cnt[d]) { w[d] += (sum[d] / tot) / (cnt[d] / n); wn[d]++; }
      const work = v.map((x, i) => [x, `${mk}-${pad(i + 1)}`]).filter(([, d]) => isWorkday(d, clubId)); const last5 = work.slice(-5); const avg = work.reduce((s, [x]) => s + x, 0) / Math.max(1, work.length);
      if (avg > 0 && last5.length) bonus.push(last5.reduce((s, [x]) => s + x, 0) / last5.length / avg);
    });
    return { weights: w.map((x, d) => (wn[d] ? x / wn[d] : 1)), bonus: bonus.length ? bonus.reduce((s, x) => s + x, 0) / bonus.length : 1, ok: wn.some(Boolean) };
  });
}
// Prévision au jour « dayNow » (inclus) du mois mk à partir du modèle.
function forecastAt(clubId, kpiId, mk, dayNow, userId = null) {
  const v = dayVals(clubId, kpiId, mk, userId); const n = v.length; const real = v.slice(0, dayNow).reduce((s, x) => s + x, 0);
  if (dayNow >= n) return real;
  const M = forecastModel(clubId, kpiId); const avg = real / Math.max(1, dayNow);
  const workLeft = []; for (let d = dayNow + 1; d <= n; d++) workLeft.push(`${mk}-${pad(d)}`);
  const lastWork = workLeft.filter(d => isWorkday(d, clubId)).slice(-5);
  return real + workLeft.reduce((s, d) => s + avg * M.weights[dateOf(d).getDay()] * (lastWork.includes(d) ? M.bonus : 1), 0);
}
function forecast(clubId, kpiId, mk = curMonth(), userId = null) {
  return memo(`fc|${clubId}|${kpiId}|${mk}|${userId}|${today()}`, () => {
    const n = daysIn(mk); const isCur = mk === curMonth(); const dayNow = isCur ? Number(today().slice(8)) : mk < curMonth() ? n : 0;
    const value = forecastAt(clubId, kpiId, mk, dayNow, userId);
    if (!isCur) return { value, low: value, high: value };
    // fourchette : écart type des erreurs des 3 mois précédents, au même jour
    const errs = [1, 2, 3].map(i => addMonths(mk, -i)).map(m => { const fin = dayVals(clubId, kpiId, m, userId).reduce((s, x) => s + x, 0); if (!fin) return null; return forecastAt(clubId, kpiId, m, Math.min(dayNow, daysIn(m)), userId) / fin - 1; }).filter(x => x != null && Number.isFinite(x));
    const sd = errs.length >= 2 ? Math.sqrt(errs.reduce((s, x) => s + x * x, 0) / errs.length) : 0.15;
    return { value, low: Math.max(0, value * (1 - sd)), high: value * (1 + sd) };
  });
}

// ── « Ce qu'il manque », traduit en gestes ────────────────────────────────
const deL = l => (/^[aeiouyhéèêàâîôû]/i.test(l) ? 'd’' : 'de ') + l;
function tauxInvites(clubId) { return memo(`tinv|${clubId}`, () => { const L = guestsOf(clubId).filter(g => ageDays(g.date) >= 30 && ageDays(g.date) <= 120); return L.length >= 5 ? L.filter(guestConv).length / L.length : null; }); }
function manqueActions(clubId, mk, kpiId) {
  const s = palierState(clubId, mk, kpiId); if (!s || !s.next) return '';
  const k = S.kpis[kpiId]; const manque = Math.max(0, Number(s.next.target) - s.real); if (!manque) return '';
  if (k.unit === 'eur') { const pan = kpiId === 'nutrition' ? panierNutrition(clubId) : null; return `<div class="palier-act">Il manque ${fmtE(manque)} ${esc(deL(k.label.toLowerCase()))} pour le palier ${s.reached + 1}${pan ? `, soit ${Math.ceil(manque / pan)} paniers moyens de ${fmtE(pan)}` : ''}.</div>`; }
  if (kpiId !== 'contrats') return '';
  const tp = tauxCohorte(clubId), ti = tauxInvites(clubId);
  if (tp == null) return `<div class="palier-act">Il manque ${plur(Math.ceil(manque), 'contrat', 'contrats')} pour le palier ${s.reached + 1}. Importez l’export Prospects pour savoir combien de prospects rappeler.</div>`;
  const np = Math.ceil(manque / tp), ni = ti ? Math.ceil(manque / ti) : null;
  return `<div class="palier-act">Il manque ${plur(Math.ceil(manque), 'contrat', 'contrats')} pour le palier ${s.reached + 1}. Concrètement : rappeler ${np} prospects chauds (taux ${fmtP(tp)})${ni ? ` ou convertir ${ni} invités (taux ${fmtP(ti)})` : ''}. <a href="#/opportunites" data-act="ui" data-key="oppType" data-val="prospect">Voir les prospects</a></div>`;
}
// Équivalence entre KPI pour revenir dans le rythme (points réels des KPI).
function rattrapage(st) {
  if (!st || st.progress == null || st.expected == null || st.progress >= st.expected) return '';
  const rows = st.rows.filter(x => x.target > 0 && x.k.points > 0 && x.k.required);
  const wsum = rows.reduce((s, x) => s + x.k.points, 0); const deficit = wsum * (st.expected - st.progress); if (deficit <= 0) return '';
  const opts = rows.filter(x => x.real < x.target).map(x => { const perUnit = x.k.points / x.target; const u = deficit / perUnit; return { x, u: x.k.unit === 'eur' ? Math.ceil(u / 10) * 10 : Math.ceil(u) }; }).filter(o => o.x.real + o.u <= o.x.target).sort((a, b) => (a.x.k.unit === 'eur') - (b.x.k.unit === 'eur') || a.u - b.u).slice(0, 3);
  return opts.length ? `<div class="small" style="margin-top:8px">Pour revenir dans le rythme : ${opts.map(o => o.x.k.unit === 'eur' ? `${fmtE(o.u)} ${esc(deL(o.x.k.label.toLowerCase()))}` : `${o.u} ${esc(o.x.k.label.toLowerCase())}`).join(' ou ')}.</div>` : '';
}
