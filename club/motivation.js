'use strict';
// ══ FIT PULSE — classement bienveillant, bravo, défis, bilan du mois ══════
const lbPeriodLabel = p => (p === 'week' ? 'cette semaine' : p === 'quarter' ? 'ce trimestre' : 'ce mois-ci');
// Écart au rang du dessus, dans l'unité la plus parlante (KPI où il manque le moins).
function lbGap(me, above, k) {
  if (!above || me.score == null || above.score == null) return '';
  const d = above.score - me.score; if (d <= 0) return '';
  const place = `pour passer ${above.rank}${above.rank === 1 ? 'er' : 'e'}`;
  if (k) { const row = me.st.rows[0]; if (!row || !row.target) return ''; const u = d * row.target; return `Il vous manque ${k.unit === 'eur' ? fmtE(Math.ceil(u)) : Math.max(1, Math.ceil(u))} en ${k.label} ${place}`; }
  const rows = me.st.rows.filter(x => x.target > 0 && x.k.points > 0 && x.pct < SCORE_CAP); const wsum = rows.reduce((s, x) => s + x.k.points, 0); if (!wsum) return '';
  const best = rows.map(x => ({ x, u: d * wsum / (x.k.points / x.target) })).sort((a, b) => (a.x.k.unit === 'eur') - (b.x.k.unit === 'eur') || a.u - b.u)[0];
  return best ? `Il vous manque ${best.x.k.unit === 'eur' ? fmtE(Math.ceil(best.u)) : Math.max(1, Math.ceil(best.u))} en ${best.x.k.label} ${place}` : '';
}
function lbBanner(meRow, rk, r, period, k) {
  let trend = '';
  if (!k && r.to >= today() && addDays(today(), -7) >= r.from) { const old = ranking(CLUB.id, { ...r, to: addDays(today(), -7) }).find(x => x.u.id === ME.id); if (old) { const n = old.rank - meRow.rank; trend = n > 0 ? ` · en hausse de ${plur(n, 'place', 'places')}` : n < 0 ? ` · en baisse de ${plur(-n, 'place', 'places')}` : ' · stable sur la semaine'; } }
  const gap = lbGap(meRow, rk[meRow.rank - 2], k);
  return `<div class="banner-me">Vous êtes #${meRow.rank} ${lbPeriodLabel(period)} · ${k ? `${fmtV(meRow.real, k.unit)} · ${fmtP(meRow.score)}` : `${fmtP(meRow.score)} · ${fmtN(meRow.earned)} pts`}${trend}${gap ? `<br><b>${esc(gap)}</b>` : ''}</div>`;
}
function lbRow(x, val, mine) {
  const me = x.u.id === ME.id; const showDot = isManager() || me;
  return `<div class="rank-row ${me ? 'me-row' : ''}"><div class="rank-n">${x.rank}</div><div class="row">${avatar(x.u)}<div><b>${esc(fullName(x.u))}</b> ${levelBadge(levelOf(allTime(x.u.id)), 18)}<div class="small">${trophies(x.u.id).slice(-4).map(t => `<span title="${esc(t.label)}">${trophyIcon(t, 'ico ico-xs')}</span>`).join('')}</div></div></div><div>${progressBar(x.score)}</div><b class="num pts">${showDot ? `<i class="hdot ${healthOf(x.score != null && x.st.expected ? x.score / Math.max(x.st.expected, 0.01) : null).cls}"></i> ` : ''}${val(x)}</b></div>`;
}
// Membre : podium, sa ligne et ses voisins, le reste replié. Manager : liste complète.
function lbList(rk, r, k, val) {
  const rest = rk.slice(3); if (!rest.length) return rk.length ? '' : '<div class="empty">Aucun membre actif.</div>';
  if (isManager() || UI.lbAll) return rest.map(x => lbRow(x, val)).join('');
  const me = rk.find(x => x.u.id === ME.id); if (!me) return `<button class="btn sm" data-act="ui" data-key="lbAll" data-val="1">Voir tout le classement</button>`;
  const near = rk.filter(x => x.rank > 3 && Math.abs(x.rank - me.rank) <= 1);
  return `${near.length && near[0].rank > 4 ? '<div class="lb-gap">…</div>' : ''}${near.map(x => lbRow(x, val)).join('')}<button class="btn sm ghost" style="margin-top:8px" data-act="ui" data-key="lbAll" data-val="1">Voir tout le classement</button>`;
}
// Progression : hausse du score par rapport à la même date du mois précédent.
function lbProgression(r) {
  const prev = { from: addMonths(r.from.slice(0, 7), -1) + '-01' }; const day = Math.min(Number((r.to >= today() ? today() : r.to).slice(8)), 28); prev.to = `${prev.from.slice(0, 7)}-${pad(day)}`; prev.period = 'custom';
  const cur = ranking(CLUB.id, r); const old = ranking(CLUB.id, { ...r, ...prev });
  const L = cur.map(x => { const o = old.find(y => y.u.id === x.u.id); return { ...x, d: x.score != null && o && o.score != null ? x.score - o.score : null }; }).sort((a, b) => (b.d ?? -9) - (a.d ?? -9));
  return `<div class="card"><p class="muted small" style="margin-top:0">Hausse du score par rapport au ${dm(prev.to)} du mois précédent.</p>${L.map((x, i) => `<div class="rank-row ${x.u.id === ME.id ? 'me-row' : ''}"><div class="rank-n">${i + 1}</div><div class="row">${avatar(x.u)}<b>${esc(fullName(x.u))}</b></div><div>${progressBar(x.score)}</div><b class="num ${x.d > 0 ? 'ok' : ''}">${x.d == null ? 'n.d.' : (x.d >= 0 ? '+' : '') + Math.round(x.d * 100) + ' pts'}</b></div>`).join('')}</div>`;
}
// Bravo : une fois par jour et par personne, visible dans le fil d'équipe.
function kudosRow(top) {
  const L = top.filter(x => x && x.u.id !== ME.id); if (!L.length) return '';
  return `<div class="kudos">${L.map(x => { const done = !!deepGet(S, ['kudos', today(), ME.id, x.u.id]); return `<button class="btn sm ${done ? 'ghost' : ''}" data-act="kudo" data-u="${x.u.id}" ${done ? 'disabled' : ''}>${ico('sparkle')} Bravo ${esc(x.u.first)}</button>`; }).join('')}</div>`;
}
ACTIONS.kudo = el => {
  const u = S.users[el.dataset.u]; if (!u || deepGet(S, ['kudos', today(), ME.id, u.id])) return;
  db.batch([[['kudos', today(), ME.id, u.id], Date.now()]]); sendChat({ text: `Bravo ${u.first} pour ton classement !`, kind: 'kudos', to: u.id });
  toast(`Bravo envoyé à ${u.first}`);
};
ACTIONS.lbHelp = () => openModal({ title: 'Comment gagner des points', body: `<div class="small" style="display:grid;gap:8px">
  <p style="margin:0"><b>Score du classement.</b> Moyenne de vos % d’objectif sur les KPI obligatoires, pondérée par leurs points, plafonnée à 150 %. Les sauvetages comptent quand ils ont un objectif (réglable par le manager).</p>
  <p style="margin:0"><b>Points d’étape.</b> 25, 50, 75 puis 100 % des points d’un KPI, ou en continu pour les petits objectifs. Au-delà de 100 %, +10 % par tranche de 10 %, jusqu’à 150 % (niveaux uniquement).</p>
  <p style="margin:0"><b>Points d’action.</b> Joint ou RDV pris : 10 pts. Réglé : 20 pts. Appel noté sur une résiliation : 10 pts. Pas de réponse ou message laissé : 2 pts. Une fiche rapporte une fois par jour, 300 pts par semaine au plus. Ils comptent pour les niveaux, pas pour le classement.</p>
  <p style="margin:0"><b>Trophées.</b> N°1 du mois, de la semaine, par KPI, Sauveur et Relanceur de la semaine, record personnel, plus belle progression, régularité (5 jours de saisie de suite).</p></div>`, foot: '<button class="btn primary" data-close>Compris</button>' });

// Bilan du mois : bandeau d'accueil du 1er au 5, pour chacun.
function wrapBanner() {
  if (Number(today().slice(8)) > 5) return ''; const pm = addMonths(curMonth(), -1);
  const st = statsFor(CLUB.id, ME.id, rangeOf('month', pm)); if (!st.rows.some(x => x.target > 0)) return '';
  return `<a class="recap-ready" href="#/wrap/${pm}/${ME.id}">${ico('sparkle')}<div><b>Votre bilan de ${MOIS[Number(pm.slice(5)) - 1].toLowerCase()} est prêt</b><span>Vos chiffres, vos progrès et vos trophées du mois, en une minute.</span></div>${ico('chevR')}</a>`;
}
