'use strict';
// ══ FIT PULSE — graphiques et codes couleur ═══════════════════════════════
//
// Un seul code couleur dans toute l'app, lu au premier coup d'œil :
//  vert  = dans le rythme ou au-dessus, orange = à surveiller, rouge = alerte.
// Il compare toujours le réalisé au RYTHME attendu à ce jour du mois.

const HEALTH = {
  good: { label: 'Dans le rythme', cls: 'h-good', color: 'var(--ok)' },
  watch: { label: 'À surveiller', cls: 'h-watch', color: 'var(--warn)' },
  alert: { label: 'En retard', cls: 'h-alert', color: 'var(--bad)' },
  none: { label: 'Sans donnée', cls: 'h-none', color: 'var(--muted)' },
};
// ratio = réalisé / attendu à date
function healthOf(ratio) { if (ratio == null || !isFinite(ratio)) return HEALTH.none; return ratio >= 0.95 ? HEALTH.good : ratio >= 0.75 ? HEALTH.watch : HEALTH.alert; }
const healthChip = h => `<span class="hchip ${h.cls}"><i></i>${h.label}</span>`;

// Course au palier : cumul jour par jour, rythme à tenir, projection fin de mois.
function palierRace(clubId, mk, kpiId, { height = 250 } = {}) {
  const s = palierState(clubId, mk, kpiId); if (!s) return '';
  const n = daysIn(mk); const isCur = mk === curMonth(); const dayNow = isCur ? Number(today().slice(8)) : n;
  const cum = []; let acc = 0;
  for (let d = 1; d <= n; d++) { if (d > dayNow) break; acc += sumRange(clubId, null, kpiId, `${mk}-${pad(d)}`, `${mk}-${pad(d)}`); cum.push(acc); }
  const fc = isCur && typeof forecast === 'function' ? forecast(clubId, kpiId, mk) : null;
  const proj = fc ? fc.value : dayNow ? acc / dayNow * n : 0;
  const top = Math.max(s.max * 1.12, proj * 1.05, acc * 1.1, 1);
  const W = 720, H = height, L = 44, R = 92, T = 16, B = 28;
  const X = d => L + (W - L - R) * (d - 1) / Math.max(1, n - 1), Y = v => T + (H - T - B) * (1 - v / top);
  const goalTier = s.tiers.at(-1); const target = Number(goalTier.target);
  const projTier = s.tiers.filter(t => proj >= t.target).length;
  const h = projTier === s.tiers.length ? HEALTH.good : projTier > 0 ? HEALTH.watch : HEALTH.alert;
  let g = '';
  // grille légère
  for (let i = 0; i <= 4; i++) { const v = top * i / 4; g += `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" class="c-grid"/><text x="${L - 8}" y="${Y(v) + 4}" text-anchor="end" class="c-tick">${fmtN(v)}</text>`; }
  [1, 8, 15, 22, n].forEach(d => { g += `<text x="${X(d)}" y="${H - 8}" text-anchor="middle" class="c-tick">${d}</text>`; });
  // paliers : lignes horizontales nommées
  s.tiers.forEach((t, i) => { const got = s.real >= t.target; g += `<line x1="${L}" x2="${W - R}" y1="${Y(t.target)}" y2="${Y(t.target)}" class="c-tier ${got ? 'got' : ''}"/><text x="${W - R + 8}" y="${Y(t.target) + 4}" class="c-tier-l ${got ? 'got' : ''}">P${i + 1} · ${fmtN(t.target)}${got ? ' (atteint)' : ''}</text>`; });
  // rythme à tenir pour le dernier palier
  g += `<line x1="${X(1)}" y1="${Y(target / n)}" x2="${X(n)}" y2="${Y(target)}" class="c-pace"/>`;
  // réalisé
  if (cum.length) {
    const pts = cum.map((v, i) => `${X(i + 1)},${Y(v)}`);
    g += `<path d="M${X(1)},${Y(0)} L${pts.join(' L')} L${X(cum.length)},${Y(0)}Z" class="c-area"/>`;
    g += `<polyline points="${pts.join(' ')}" class="c-line"/>`;
    // projection
    if (isCur && dayNow < n) g += `<line x1="${X(dayNow)}" y1="${Y(acc)}" x2="${X(n)}" y2="${Y(proj)}" class="c-proj" style="stroke:${h.color}"/><circle cx="${X(n)}" cy="${Y(proj)}" r="5" style="fill:${h.color}"/>`;
    g += `<circle cx="${X(cum.length)}" cy="${Y(acc)}" r="6" class="c-dot"/><text x="${X(cum.length)}" y="${Y(acc) - 12}" text-anchor="middle" class="c-now">${fmtN(acc)}</text>`;
  }
  const k = S.kpis[kpiId];
  return `<div class="race">
    <div class="race-h"><div><div class="eyebrow">Course au palier</div><h3>${esc(k.label)} · équipe</h3></div><span class="spacer"></span>${healthChip(h)}</div>
    <div class="chart race-chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(k.label)} : ${fmtN(acc)} réalisés, projection ${fmtN(proj)}">${g}</svg></div>
    <div class="race-f"><span><i class="lg-line"></i>Réalisé</span><span><i class="lg-pace"></i>Rythme pour le P${s.tiers.length}</span>${isCur ? `<span><i class="lg-proj" style="border-color:${h.color}"></i>Projection fin de mois : <b style="color:${h.color}">${fmtN(proj)}</b>${fc && fc.high > fc.low ? ` <span class="muted">(${fmtN(fc.low)} à ${fmtN(fc.high)})</span>` : ''} ${projTier ? `→ Palier ${projTier}` : '→ aucun palier'}</span>` : ''}</div></div>`;
}

// Anneau de progression (objectifs perso, palier…)
function ring(pct, { size = 120, stroke = 12, color = 'var(--fp)', label = '', sub = '' } = {}) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, p = clamp(pct || 0, 0, 1);
  return `<div class="ring" style="width:${size}px;height:${size}px"><svg viewBox="0 0 ${size} ${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ring-bg" stroke-width="${stroke}"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" stroke="${color}" stroke-width="${stroke}" fill="none" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - p)}" transform="rotate(-90 ${size / 2} ${size / 2})"/></svg><div class="ring-in"><b>${label}</b><small>${sub}</small></div></div>`;
}

// Barres empilées horizontales par mois (impayés par canal)
function stackRows(rows, series, fmt = fmtE) {
  const max = Math.max(1, ...rows.map(r => r.total));
  return `<div class="stack">${rows.map(r => `<div class="stack-r"><span class="stack-l">${esc(r.label)}</span><div class="stack-b">${series.map(s => r.parts[s.key] ? `<i style="width:${r.parts[s.key] / max * 100}%;background:${s.color}" title="${esc(s.label)} : ${fmt(r.parts[s.key])}"></i>` : '').join('')}</div><b>${fmt(r.total)}</b></div>`).join('')}</div>
    <div class="legend" style="margin-top:10px">${series.map(s => `<span><i style="background:${s.color}"></i>${esc(s.label)}</span>`).join('')}</div>`;
}

// Entonnoir des résiliations du mois : demandes → prises en charge → sauvées
function resFunnel(clubId, mk) {
  const L = resList(clubId).filter(r => r.date.slice(0, 7) === mk);
  const taken = L.filter(r => r.ownerId || resActions(r).length > 1).length;
  const saved = L.filter(r => resStatus(r) === 'sauvee').length;
  const steps = [['Demandes', L.length, 'var(--text)'], ['Prises en charge', taken, 'var(--fp)'], ['Sauvées', saved, 'var(--ok)']];
  const max = Math.max(1, L.length);
  const rate = L.length ? taken / L.length : null;
  const h = rate == null ? HEALTH.none : rate >= 0.9 ? HEALTH.good : rate >= 0.6 ? HEALTH.watch : HEALTH.alert;
  return `<div class="funnel">${steps.map(([l, v, c], i) => `<div class="fn-r"><span class="fn-l">${l}</span><div class="fn-b"><i style="width:${Math.max(v / max * 100, v ? 6 : 0)}%;background:${c}"></i></div><b>${v}</b>${i ? `<small>${L.length ? fmtP(v / L.length) : 'n.d.'}</small>` : '<small></small>'}</div>`).join('')}</div>
    <div class="row" style="margin-top:8px">${healthChip(h)}<span class="muted small">${L.length ? `${plur(L.length - taken, 'demande jamais prise', 'demandes jamais prises')} en charge` : 'Aucune demande ce mois-ci'}</span></div>`;
}
