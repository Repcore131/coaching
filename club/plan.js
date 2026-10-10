/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion (Fitness Park Niort). Tous droits réservés. Logiciel protégé (CPI art. L111-1, L112-2, L335-2) : toute reproduction, même partielle, est interdite. */
'use strict';
// ══ FIT PULSE — Plan T4 : objectifs du directeur, suivi automatique ══════
// Un plan = une période (le trimestre), des cibles, la comparaison N-1, les
// missions du mois et les primes. Tout se calcule depuis les imports
// Resamania et les relances : rien à ressaisir, sauf les avis Google.
// Le rapport du lundi (15 h) part au directeur par le serveur
// (club/outils/fitpulse-rapport.mjs) ; la page en montre l'aperçu.

const PLAN_DEFAULT = {
  id: '2026-Q4', label: 'T4 2026', from: '2026-10-01', to: '2026-12-31',
  targets: { ca: 180000, ventes: 200, engagementPct: 75, optionsPct: 20, boutique: 13400, avis: 1200, transfoEquipe: 35, transfoMin: 30, finsAppelees: 100, finsConservees: 60, impayeH: 48, leadWebH: 1 },
  n1: { ca: 135500, caMois: { 10: 41600, 11: 42500, 12: 51300 }, ventes: 321, optionsPct: 17, boutique: 11200, transfoWeb: 20, optionsJourJ: 40 },
  mois: { '2026-10': { ventes: 125, ca: 60000, fins: 94, finsSuivant: 121, rdvB2B: 4 }, '2026-11': { finsListe: 121 }, '2026-12': {} },
  partenariats: 2, cibles: ['MAIF', 'MACIF', 'MAAF', 'IMA'], blackFriday: '2026-11-15',
  avisDepart: 920, avisDepartDate: '2026-10-06',
  primes: { palier: 150, avis: [[50, 50], [75, 80]], equipeMoisVentes: 60 },
  directeur: '', copie: null, rapport: 'lundi 15 h',
};
const planStore = (club = CLUB.id) => deepGet(S, ['plans', club, PLAN_DEFAULT.id]) || {};
function planOf(club = CLUB.id) {
  const s = planStore(club);
  return { ...PLAN_DEFAULT, ...s, targets: { ...PLAN_DEFAULT.targets, ...(s.targets || {}) }, primes: { ...PLAN_DEFAULT.primes, ...(s.primes || {}) }, mois: { ...PLAN_DEFAULT.mois, ...(s.mois || {}) } };
}
const planEnd = P => (today() < P.to ? today() : P.to);
const daysBetween = (a, b) => Math.round((dateOf(b) - dateOf(a)) / 864e5) + 1;
const planElapsed = P => Math.max(0, Math.min(1, daysBetween(P.from, planEnd(P)) / daysBetween(P.from, P.to)));
const htBoutique = (club, from, to) => Math.round((sumRange(club, null, 'nutrition', from, to) / 1.055 + sumRange(club, null, 'accessoires', from, to) / 1.2) * 100) / 100;
// Index des échanges par client (appels, SMS) pour les campagnes.
const touchByClient = () => memo('touchCli', () => { const m = new Map(); for (const t of Object.values(S.touches || {})) { if (!t || !t.clientId) continue; let l = m.get(t.clientId); if (!l) m.set(t.clientId, l = []); l.push(t); } return m; });
function avisNow(P, club = CLUB.id) { const log = planStore(club).avis || {}; const d = Object.keys(log).sort().pop(); return d ? { n: Number(log[d]), date: d } : { n: P.avisDepart, date: P.avisDepartDate }; }
function avisAt(P, date, club = CLUB.id) { const log = planStore(club).avis || {}; const d = Object.keys(log).filter(x => x <= date).sort().pop(); return d ? Number(log[d]) : P.avisDepart; }

// ── Les chiffres du plan ──────────────────────────────────────────────────
function planStats(club = CLUB.id) {
  return memo(`plan|${club}|${today()}`, () => {
    const P = planOf(club); const end = planEnd(P); const C = deepGet(S, ['rsm', 'controls', club, 'ca']) || {};
    const months = []; for (let m = P.from.slice(0, 7); m <= P.to.slice(0, 7); m = addMonths(m, 1)) months.push(m);
    const man = planStore(club).caManuel || {};
    const caMois = months.map(m => { const c = C[m]; return { m, v: c ? Number(c.total) : man[m] != null ? Number(man[m]) : null, src: c ? 'import' : man[m] != null ? 'saisie' : null, c }; });
    const caKnown = caMois.filter(x => x.v != null);
    const ca = caKnown.length ? caKnown.reduce((s, x) => s + x.v, 0) : null;
    const live = Object.values(S.entries).filter(e => e && e.clubId === club && e.kpiId === 'contrats' && e.date >= P.from && e.date <= end && entryCounts(e));
    const ventes = sumRange(club, null, 'contrats', P.from, end);
    const eng = live.filter(e => e.engaged != null); const engagementPct = eng.length ? eng.filter(e => e.engaged).length / eng.length * 100 : null;
    const ab = caMois.reduce((s, x) => s + (x.c ? Number(x.c.abo) || 0 : 0), 0), op = caMois.reduce((s, x) => s + (x.c ? Number(x.c.options) || 0 : 0), 0);
    let optionsPct = ab > 0 ? op / ab * 100 : null; let optSrc = 'factures';
    if (optionsPct == null) { const withP = live.filter(e => Number(e.priceHT) > 0); const o = withP.filter(e => e.option).reduce((s, e) => s + Number(e.priceHT), 0), a = withP.filter(e => !e.option).reduce((s, e) => s + Number(e.priceHT), 0); optionsPct = a > 0 ? o / a * 100 : null; optSrc = 'ventes'; }
    const btq = caMois.some(x => x.c) ? caMois.reduce((s, x) => s + (x.c ? Number(x.c.boutique) || 0 : htBoutique(club, x.m + '-01', `${x.m}-${daysIn(x.m)}`)), 0) : htBoutique(club, P.from, end);
    const av = avisNow(P, club);
    return { P, end, elapsed: planElapsed(P), months, caMois, ca, ventes, engagementPct, engKnown: eng.length, optionsPct, optSrc, boutique: btq, avis: av };
  });
}
// Campagne fins d'engagement : appelés avant la date de fin, conservés, inactifs.
function finsCampagne(club, mk) {
  const T = touchByClient(); const L = Object.values(S.clients || {}).filter(c => c && c.clubId === club && c.end && c.end.slice(0, 7) === mk);
  const rows = L.map(c => { const t = (T.get(c.id) || []).filter(x => x.at < dateOf(c.end).getTime() + 864e5 && (x.channel === 'call' || x.checks)); const inactif = c.lastVisit ? dayDiff(c.lastVisit, today()) > 30 : null;
    return { c, appele: t.length > 0, conserve: !!(c.maintienAt || c.renewedAt), inactif }; });
  return { rows, total: rows.length, appeles: rows.filter(r => r.appele).length, conserves: rows.filter(r => r.conserve).length, inactifs: rows.filter(r => r.inactif).length, sansPassage: rows.filter(r => r.inactif == null).length };
}
function churnStats(club = CLUB.id) {
  return memo(`churn|${club}|${today()}`, () => {
    const P = planOf(club); const end = planEnd(P); const T = touchByClient();
    const actifs = Object.values(S.clients || {}).filter(c => c && c.clubId === club && (!c.end || c.end >= today()) && !/ancien|perdu|prospect/.test(norm(c.status || '')));
    const in21 = actifs.filter(c => c.lastVisit && dayDiff(c.lastVisit, today()) >= 21);
    const in21Contact = in21.filter(c => (T.get(c.id) || []).some(t => t.at >= Date.now() - 14 * 864e5));
    const res = Object.values(S.resiliations || {}).filter(r => r && r.clubId === club && !r.hidden && r.date >= P.from && r.date <= end);
    const resAbo = res.filter(r => r.nature !== 'option'), resOpt = res.filter(r => r.nature === 'option');
    const jourJ = resOpt.filter(r => r.sameDay); const jourJsans = jourJ.filter(r => !r.justif);
    const dettes = Object.values(S.clients || {}).filter(c => c && c.clubId === club && Number(c.balance) > 0);
    const neuf = dettes.filter(c => c.balanceAt && dayDiff(c.balanceAt, today()) >= 0 && dayDiff(c.balanceAt, today()) <= 30);
    const sla = neuf.map(c => { const lim = dateOf(c.balanceAt).getTime() + (P.targets.impayeH + 24) * 3600000; const t = (T.get(c.id) || []).filter(x => x.at <= lim); return { c, ok: t.some(x => x.channel === 'call' || x.checks) && t.some(x => x.channel === 'sms' || (x.checks && x.checks.sms)), retard: Date.now() > lim }; });
    const vieux = dettes.filter(c => (c.oldestIncident || c.balanceAt) && dayDiff(c.oldestIncident || c.balanceAt, today()) >= 180);
    const weeks = []; for (let w = weekStart(P.from); w <= end; w = addDays(w, 7)) { const we = addDays(w, 6); weeks.push({ w, v: recoveredFor(club, { from: w, to: we }) }); }
    return { in21, in21Contact, resAbo, resOpt, jourJ, jourJsans, sla, slaOk: sla.filter(x => x.ok).length, slaRetard: sla.filter(x => !x.ok && x.retard).length, vieux, vieuxTotal: vieux.reduce((s, c) => s + Number(c.balance), 0), weeks };
  });
}
function transfoStats(club = CLUB.id) {
  return memo(`transfo|${club}|${today()}`, () => {
    const P = planOf(club); const end = planEnd(P);
    const L = prospectsOf(club).filter(p => p.creeLe >= P.from && p.creeLe <= end);
    const by = {}; L.forEach(p => { const k = p.commercialId || '_'; const o = by[k] = by[k] || { n: 0, conv: 0 }; o.n++; if (prospectConv(p)) o.conv++; });
    const team = L.length ? L.filter(p => prospectConv(p)).length / L.length * 100 : null;
    const web = L.filter(p => KM_ONLINE.test(p.provenance || ''));
    const webRows = web.map(p => { const key = relKey('prospect', p.id, p.creeLe); const first = touchesOf(key).filter(t => t.channel === 'call' || t.checks).sort((a, b) => a.at - b.at)[0]; const created = p.manual && p.at ? p.at : (p.at || dateOf(p.creeLe).getTime() + 9 * 3600000); return { p, delai: first ? (first.at - created) / 3600000 : null }; });
    const essais = Object.values(S.touches || {}).filter(t => t && t.clubId === club && t.essaiAt && t.at >= dateOf(P.from).getTime());
    return { by, team, web: web.length, webConv: web.filter(p => prospectConv(p)).length, webVite: webRows.filter(x => x.delai != null && x.delai <= P.targets.leadWebH).length, essais: essais.length };
  });
}

// ── Jauges ────────────────────────────────────────────────────────────────
function planGauge({ label, real, target, unit = 'qty', elapsed = null, n1 = null, note = '', reverse = false, pctMode = false }) {
  const pct = real != null && target ? real / target : null;
  const pace = elapsed != null && !pctMode ? elapsed : null;
  const st = pct == null ? '' : pctMode ? (reverse ? (real <= target ? 'ok' : 'bad') : (real >= target ? 'ok' : real >= target * 0.85 ? 'warn' : 'bad')) : (pct >= (pace ?? 1) * 0.98 ? 'ok' : pct >= (pace ?? 1) * 0.85 ? 'warn' : 'bad');
  const fmt = v => (v == null ? 'n.d.' : unit === 'eur' ? fmtE(v) : unit === 'pct' ? `${Math.round(v)} %` : fmtN(Math.round(v)));
  const proj = !pctMode && elapsed && elapsed > 0.03 && real != null ? real / elapsed : null;
  return `<div class="plan-g st-${st}"><div class="row"><b>${esc(label)}</b><span class="spacer"></span><span class="plan-v">${fmt(real)}</span><span class="muted small">/ ${fmt(target)}</span></div>
    ${progressBar(pct == null ? 0 : Math.min(pct, 1.2), { pace, ticks: false })}
    <div class="muted small">${pace != null && pct != null ? `${fmtP(pct)} · rythme attendu ${fmtP(pace)}` : pct != null ? fmtP(pct) + ' de la cible' : 'en attente des données'}${proj != null ? ` · projection ${fmt(proj)}` : ''}${n1 != null ? ` · N-1 ${fmt(n1)}` : ''}${note ? ' · ' + note : ''}</div></div>`;
}
function svgBars(items, { fmt = fmtN, height = 140, target = null } = {}) {
  const W = 560, H = height, B = 22; const max = Math.max(1, target || 0, ...items.map(i => i.v || 0)) * 1.12; const bw = Math.min(56, (W - 20) / items.length - 10);
  const x0 = i => 10 + i * ((W - 20) / items.length) + ((W - 20) / items.length - bw) / 2;
  return `<svg viewBox="0 0 ${W} ${H}" class="plan-svg" role="img">${target ? `<line x1="0" x2="${W}" y1="${H - B - (target / max) * (H - B - 8)}" y2="${H - B - (target / max) * (H - B - 8)}" class="plan-target"/>` : ''}${items.map((it, i) => { const h = ((it.v || 0) / max) * (H - B - 8); return `<rect x="${x0(i)}" y="${H - B - h}" width="${bw}" height="${h}" rx="4" class="${it.cls || 'plan-bar'}"/><text x="${x0(i) + bw / 2}" y="${H - B - h - 4}" text-anchor="middle" class="plan-lbl">${it.v == null ? '' : fmt(it.v)}</text><text x="${x0(i) + bw / 2}" y="${H - 6}" text-anchor="middle" class="plan-ax">${esc(it.l)}</text>`; }).join('')}</svg>`;
}

// ── Page ──────────────────────────────────────────────────────────────────
function planPage() {
  const st = planStats(); const P = st.P; const mgr = isManager(); const tab = UI.planTab || 'objectifs';
  const T = [['objectifs', 'Objectifs'], ['churn', 'Churn'], ['transfo', 'Transformation'], ['missions', 'Missions du mois'], ['primes', 'Primes'], ...(mgr ? [['rapport', 'Rapport du lundi'], ['reglages', 'Réglages']] : [])];
  const body = { objectifs: planObjectifs, churn: planChurn, transfo: planTransfo, missions: planMissions, primes: planPrimes, rapport: planRapport, reglages: planReglages }[tab] || planObjectifs;
  return `<div class="plan-head row wrap"><div class="spacer"><b class="title t-20">Plan ${esc(P.label)}</b><div class="muted small">du ${dmy(P.from)} au ${dmy(P.to)} · ${fmtP(st.elapsed)} du trimestre écoulé</div></div>${mgr ? `<span class="muted small">Rapport au directeur chaque ${esc(P.rapport)}</span>` : ''}</div>
    ${tabs('planTab', T, tab)}${body(st)}`;
}
function planObjectifs(st) {
  const P = st.P; const t = P.targets; const mk = curMonth(); const mo = P.mois[mk] || {};
  const r = rangeOf('month', mk); const vm = sumRange(CLUB.id, null, 'contrats', r.from, r.to); const cam = (st.caMois.find(x => x.m === mk) || {}).v;
  const mElapsed = Math.min(1, daysBetween(r.from, today()) / daysIn(mk));
  return `<div class="grid plan-grid">
    <div class="card"><h3>Trimestre</h3>
      ${planGauge({ label: 'Chiffre d’affaires HT', real: st.ca, target: t.ca, unit: 'eur', elapsed: st.elapsed, n1: P.n1.ca, note: st.caMois.some(x => x.v != null) ? '' : 'déposez l’export Factures & avoirs' })}
      ${planGauge({ label: 'Nouveaux abonnements', real: st.ventes, target: t.ventes, elapsed: st.elapsed, n1: P.n1.ventes })}
      ${planGauge({ label: 'Ventes avec engagement', real: st.engagementPct, target: t.engagementPct, unit: 'pct', pctMode: true, note: st.engKnown ? `sur ${st.engKnown} ventes lues` : 'offre lue dans la vente d’abonnements' })}
      ${planGauge({ label: 'CA options / CA abonnements', real: st.optionsPct, target: t.optionsPct, unit: 'pct', pctMode: true, n1: P.n1.optionsPct, note: st.optionsPct == null ? '' : st.optSrc === 'ventes' ? 'estimé sur les ventes' : '' })}
      ${planGauge({ label: 'Boutique (nutrition + accessoires) HT', real: st.boutique, target: t.boutique, unit: 'eur', elapsed: st.elapsed, n1: P.n1.boutique })}
      ${planGauge({ label: `Avis Google : ${fmtN(st.avis.n)} (objectif ${fmtN(t.avis)})`, real: st.avis.n - P.avisDepart, target: Math.max(1, t.avis - P.avisDepart), elapsed: Math.max(0.01, Math.min(1, daysBetween(P.avisDepartDate, planEnd(P)) / daysBetween(P.avisDepartDate, P.to))), note: `avis gagnés depuis le ${dm(P.avisDepartDate)} · relevé du ${dm(st.avis.date)}` })}
      ${isManager() ? `<form id="avf" class="row wrap" style="gap:8px;margin-top:8px"><input class="input sm" style="max-width:140px" name="n" inputmode="numeric" placeholder="Avis aujourd’hui"><button class="btn sm" type="button" data-act="planAvis">Noter le nombre d’avis</button></form>` : ''}</div>
    <div class="card"><h3>${monthLabel(mk)}</h3>
      ${mo.ventes ? planGauge({ label: 'Ventes du mois', real: vm, target: mo.ventes, elapsed: mElapsed }) : ''}
      ${mo.ca ? planGauge({ label: 'CA HT du mois', real: cam, target: mo.ca, unit: 'eur', elapsed: mElapsed, n1: P.n1.caMois[Number(mk.slice(5))] }) : ''}
      <h3 style="margin-top:16px">CA HT par mois</h3>${svgBars(st.caMois.map(x => ({ l: MOIS_C[Number(x.m.slice(5)) - 1], v: x.v })), { fmt: v => Math.round(v / 100) / 10 + ' k', target: t.ca / 3 })}
      <p class="muted small" style="margin:0">Trait : rythme nécessaire (${fmtE(t.ca / 3)} par mois). N-1 : ${Object.values(P.n1.caMois).map(v => fmtE(v)).join(' / ')}.</p></div></div>`;
}
function planChurn() {
  const ch = churnStats(); const P = planOf(); const t = P.targets; const mk = curMonth();
  const camp = [mk, addMonths(mk, 1)].map(m => ({ m, f: finsCampagne(CLUB.id, m) }));
  return `<div class="grid plan-grid">
    <div class="card"><h3>Fins d’engagement</h3><p class="muted small" style="margin-top:-4px">Objectif : ${t.finsAppelees} % appelés avant leur date de fin, offre de maintien 8 semaines, ${t.finsConservees} % conservés.</p>
      ${camp.map(({ m, f }) => `<div class="plan-camp"><b>${monthLabel(m)} · ${f.total} adhérent${f.total > 1 ? 's' : ''}</b>${f.total ? `${planGauge({ label: 'Appelés avant la fin', real: f.total ? f.appeles / f.total * 100 : null, target: t.finsAppelees, unit: 'pct', pctMode: true, note: `${f.appeles} sur ${f.total}` })}${planGauge({ label: 'Conservés', real: f.total ? f.conserves / f.total * 100 : null, target: t.finsConservees, unit: 'pct', pctMode: true, note: `${f.conserves} sur ${f.total}` })}<div class="muted small">${f.inactifs} sans passage depuis plus de 30 jours${f.sansPassage ? ` · ${f.sansPassage} sans date de passage connue` : ''}</div>` : '<p class="muted small">Déposez l’export Abonnements (fins d’engagement) dans Imports.</p>'}</div>`).join('')}
      <a class="btn sm" href="#/relances" data-act="planGoRel" data-k="fincontrat">${ico('phone')} Ouvrir les relances fins de contrat</a></div>
    <div class="card"><h3>Inactifs depuis 21 jours</h3><div class="plan-big">${ch.in21.length}</div><p class="muted small">adhérents sans passage depuis 21 jours ou plus · ${ch.in21Contact.length} contactés ces 14 derniers jours. Une relance « Inactif 21 j » avec SMS de séance de reprise est créée pour chacun.</p><a class="btn sm" href="#/relances" data-act="planGoRel" data-k="inactif">${ico('phone')} Relancer les inactifs</a></div>
    <div class="card"><h3>Résiliations du trimestre</h3><div class="row wrap" style="gap:18px"><div><span class="muted small">Abonnements</span><div class="plan-big">${ch.resAbo.length}</div></div><div><span class="muted small">Options</span><div class="plan-big">${ch.resOpt.length}</div></div><div><span class="muted small">Options le jour de la vente</span><div class="plan-big ${ch.jourJ.length ? 'bad' : 'ok'}">${ch.jourJ.length}</div></div></div>
      <p class="muted small">Règle : zéro résiliation d’option le jour de la vente (N-1 : près de ${P.n1.optionsJourJ} %). ${ch.jourJsans.length ? `<b class="bad">${ch.jourJsans.length} sans justification.</b>` : 'Toutes justifiées.'}</p>
      ${ch.jourJ.length ? `<div class="table-wrap"><table class="t"><thead><tr><th>Client</th><th>Date</th><th>Justification</th></tr></thead><tbody>${ch.jourJ.map(r => `<tr><td>${esc(r.client || '')}</td><td>${dm(r.date)}</td><td>${r.justif ? esc(r.justif) : `<button class="btn sm" data-act="resDetail" data-id="${r.id}">Justifier</button>`}</td></tr>`).join('')}</tbody></table></div>` : ''}</div>
    <div class="card"><h3>Impayés</h3><div class="row wrap" style="gap:18px"><div><span class="muted small">Relancés sous ${t.impayeH} h (appel + SMS)</span><div class="plan-big">${ch.sla.length ? fmtP(ch.slaOk / ch.sla.length) : 'n.d.'}</div></div><div><span class="muted small">En retard</span><div class="plan-big ${ch.slaRetard ? 'bad' : ''}">${ch.slaRetard}</div></div><div><span class="muted small">Impayés de 6 mois et plus</span><div class="plan-big">${fmtE(ch.vieuxTotal)}</div><span class="muted small">${ch.vieux.length} adhérents</span></div></div>
      <h3 style="margin-top:12px">Dette récupérée par semaine</h3>${svgBars(ch.weeks.map(x => ({ l: dm(x.w), v: x.v })), { fmt: v => Math.round(v) + ' €' })}
      <div class="row wrap" style="gap:8px"><a class="btn sm" href="#/impayes">${ico('euro')} Voir les impayés</a>${isManager() ? '<button class="btn sm" data-act="planVieuxCsv">Exporter les impayés de 6 mois et plus</button>' : ''}</div></div></div>`;
}
function planTransfo() {
  const tr = transfoStats(); const P = planOf(); const t = P.targets;
  const rows = Object.entries(tr.by).filter(([k]) => k !== '_' && S.users[k]).map(([k, o]) => ({ u: S.users[k], ...o, taux: o.n ? o.conv / o.n * 100 : null })).sort((a, b) => (b.taux ?? -1) - (a.taux ?? -1));
  return `<div class="grid plan-grid"><div class="card"><h3>Taux de transformation</h3>${planGauge({ label: 'Équipe', real: tr.team, target: t.transfoEquipe, unit: 'pct', pctMode: true })}
    <div class="table-wrap"><table class="t"><thead><tr><th>Commercial</th><th class="num">Prospects</th><th class="num">Inscrits</th><th class="num">Taux</th></tr></thead><tbody>${rows.map(x => `<tr><td style="white-space:nowrap">${avatar(x.u, 'xs')} ${esc(fullName(x.u))}</td><td class="num">${x.n}</td><td class="num">${x.conv}</td><td class="num"><b class="${x.taux != null && x.taux < t.transfoMin ? 'bad' : x.taux >= t.transfoEquipe ? 'ok' : ''}">${x.taux == null ? 'n.d.' : Math.round(x.taux) + ' %'}</b></td></tr>`).join('') || '<tr><td colspan="4" class="muted">Déposez l’export Prospects.</td></tr>'}</tbody></table></div>
    <p class="muted small">Cible équipe ${t.transfoEquipe} %, personne sous ${t.transfoMin} % (en rouge : à voir en individuel).</p></div>
    <div class="card"><h3>Leads web</h3><div class="row wrap" style="gap:18px"><div><span class="muted small">Leads du site</span><div class="plan-big">${tr.web}</div></div><div><span class="muted small">Rappelés sous ${t.leadWebH} h</span><div class="plan-big">${tr.web ? fmtP(tr.webVite / tr.web) : 'n.d.'}</div></div><div><span class="muted small">Transformés</span><div class="plan-big">${tr.web ? fmtP(tr.webConv / tr.web) : 'n.d.'}</div><span class="muted small">N-1 : ${P.n1.transfoWeb} %</span></div></div>
      <p class="muted small">Chaque lead web arrive en tête de l’onglet Prospects (chaud) : à rappeler dans l’heure ouvrée.</p>
      <h3 style="margin-top:12px">Visites non transformées</h3><p class="small">${tr.essais} séance${tr.essais > 1 ? 's' : ''} d’essai réservée${tr.essais > 1 ? 's' : ''} ce trimestre. Dans « Effectuer ma relance », la suite « Essai réservé » programme seule la relance J+2.</p>
      <a class="btn sm" href="#/relances" data-act="planGoProsp">${ico('magnet')} Ouvrir les prospects</a></div></div>`;
}
// Missions du mois en cours (octobre : celles du directeur).
function planMissions() {
  const P = planOf(); const mk = curMonth(); const mo = P.mois[mk] || {}; const done = planStore().missions || {};
  const fin = finsCampagne(CLUB.id, mk), finN = finsCampagne(CLUB.id, addMonths(mk, 1));
  const cos = companiesOf(CLUB.id); const rdv = cos.filter(c => c.rdvLe && c.rdvLe.slice(0, 7) === mk).length; const signes = cos.filter(c => c.statut === 'signe' && c.signeLe && c.signeLe >= P.from && c.signeLe <= P.to).length;
  const ciblesOk = P.cibles.filter(n => cos.some(c => norm(c.nom) === norm(n))).length;
  const r = rangeOf('month', mk); const vm = sumRange(CLUB.id, null, 'contrats', r.from, r.to); const cam = (planStats().caMois.find(x => x.m === mk) || {}).v;
  const bf = done.blackFriday; const vid = done.videos || 'a_faire';
  const item = (label, real, target, extra = '') => `<div class="plan-mission ${target && real >= target ? 'ok' : ''}"><div class="row"><b class="spacer">${label}</b>${target ? `<span>${fmtN(real)} / ${fmtN(target)}</span>` : ''}</div>${target ? progressBar(Math.min(1, real / target), { ticks: false }) : ''}${extra}</div>`;
  return `<div class="card"><h3>Missions de ${monthLabel(mk).toLowerCase()}</h3>
    ${mo.ventes ? item(`${mo.ventes} ventes`, vm, mo.ventes) : ''}
    ${mo.ca ? item(`${fmtE(mo.ca)} de CA HT`, cam || 0, mo.ca, cam == null ? '<span class="muted small">CA lu dans l’export Factures & avoirs</span>' : '') : ''}
    ${item(`Appeler les fins d’engagement de ${monthLabel(mk).toLowerCase()}`, fin.appeles, mo.fins || fin.total, `<span class="muted small">${fin.total} dans Fit Pulse${mo.fins ? `, ${mo.fins} annoncées par le directeur` : ''}</span>`)}
    ${item(`Commencer la liste de ${monthLabel(addMonths(mk, 1)).toLowerCase()}`, finN.appeles, mo.finsSuivant || finN.total)}
    ${item('Black Friday : relancer les non transformés des 3 derniers mois', bf ? 1 : 0, 1, `<div class="row wrap" style="gap:8px;margin-top:6px"><span class="muted small">${bf ? `Liste préparée le ${dm(isoOf(new Date(bf.at)))} : ${bf.n} prospects, relances posées avant le ${dm(P.blackFriday)}` : `Liste à prêter au ${dm(P.blackFriday)}`}</span>${isManager() ? `<button class="btn sm" data-act="planBlackFriday">${bf ? 'Refaire la liste' : 'Préparer la liste'}</button>` : ''}</div>`)}
    ${item(`Entreprises CSE / QVT (${P.cibles.join(', ')}) : rendez-vous ce mois`, rdv, mo.rdvB2B || 4, `<div class="row wrap" style="gap:8px;margin-top:6px"><span class="muted small">${signes} / ${P.partenariats} partenariats signés d’ici fin décembre · ${ciblesOk} / ${P.cibles.length} cibles dans Entreprise</span>${isManager() && ciblesOk < P.cibles.length ? '<button class="btn sm" data-act="planCibles">Ajouter les cibles</button>' : ''}<a class="btn sm ghost" href="#/b2b">Ouvrir Entreprise</a></div>`)}
    ${item('Vidéos de ciblage clientèle (priorité)', vid === 'publiee' ? 1 : 0, 1, `<div class="row" style="gap:6px;margin-top:6px">${[['a_faire', 'À faire'], ['en_cours', 'En cours'], ['publiee', 'Publiées']].map(([k, l]) => `<button class="btn sm ${vid === k ? 'primary' : ''}" data-act="planVideo" data-v="${k}" ${isManager() ? '' : 'disabled'}>${l}</button>`).join('')}</div>`)}</div>`;
}
// Primes : 150 € par palier ; avis 50 € (50 avis) et 80 € (75 avis) dans le mois.
function primesStats(club = CLUB.id) {
  const P = planOf(club); const mk = curMonth(); const r = rangeOf('month', mk); const st = planStats(club); const tr = transfoStats(club); const ch = churnStats(club);
  const vm = sumRange(club, null, 'contrats', r.from, r.to);
  const avisMois = avisNow(P, club).n - avisAt(P, addDays(r.from, -1), club);
  const avisPrime = P.primes.avis.filter(([n]) => avisMois >= n).map(([, e]) => e).pop() || 0;
  const members = clubMembers(club).filter(u => u.role === 'membre' && !u.virtual);
  const recov = typeof recovList === 'function' ? recovList(club, r.from, r.to) : [];
  const rank = members.map(u => ({ u, imp: recov.filter(x => x.userId === u.id).length, res: sumRange(club, u.id, 'sauvetage', r.from, r.to) })).map(x => ({ ...x, score: x.imp + x.res })).sort((a, b) => b.score - a.score);
  const mystere = deepGet(S, ['plans', club, P.id, 'mystere', mk]) || {};
  const ind = members.map(u => {
    const tgt = [0, 1, 2].map(i => addMonths(P.from.slice(0, 7), i)).reduce((s, m) => s + (monthTarget(m, u.id, 'contrats') || 0), 0);
    const v = sumRange(club, u.id, 'contrats', P.from, st.end); const o = tr.by[u.id]; const taux = o && o.n ? o.conv / o.n * 100 : null;
    const jj = ch.jourJ.filter(x => x.ownerId === u.id || x.userId === u.id).length;
    const p1 = tgt > 0 && v >= tgt, p2 = p1 && taux != null && taux >= P.targets.transfoMin, p3 = p2 && jj === 0;
    return { u, tgt, v, taux, jj, paliers: [p1, p2, p3].filter(Boolean).length, mystere: mystere[u.id] || null };
  });
  const eq1 = st.ca != null && st.ca >= P.targets.ca, eq2 = eq1 && st.ventes >= P.targets.ventes && (st.optionsPct ?? 0) >= P.targets.optionsPct && st.boutique >= P.targets.boutique;
  return { P, mk, vm, avisMois, avisPrime, rank, ind, eq: [eq1, eq2].filter(Boolean).length, mystere };
}
function planPrimes() {
  const X = primesStats(); const P = X.P; const eur = P.primes.palier; const mgr = isManager();
  const meI = X.ind.find(x => x.u.id === ME.id);
  return `<div class="grid plan-grid">
    <div class="card"><h3>Ce mois-ci · ${monthLabel(X.mk)}</h3>
      ${planGauge({ label: `Palier équipe : ${P.primes.equipeMoisVentes} ventes (${fmtE(eur)})`, real: X.vm, target: P.primes.equipeMoisVentes })}
      ${planGauge({ label: `Avis Google du mois (${P.primes.avis.map(([n, e]) => `${n} avis = ${fmtE(e)}`).join(', ')})`, real: X.avisMois, target: P.primes.avis[P.primes.avis.length - 1][0], note: X.avisPrime ? `prime ${fmtE(X.avisPrime)}` : '' })}
      <h3 style="margin-top:12px">Meilleur récupérateur (impayés + résiliations sauvées)</h3><p class="muted small" style="margin-top:-4px">${fmtE(eur)} pour le premier, à valider en individuel en fin de mois.</p>
      ${X.rank.slice(0, 5).map((x, i) => `<div class="row small" style="padding:4px 0">${i === 0 && x.score ? ico('trophy', 'ico ico-xs') : `<span style="width:16px">${i + 1}</span>`} ${avatar(x.u, 'xs')} <span class="spacer">${esc(fullName(x.u))}</span><span>${x.imp} impayé${x.imp > 1 ? 's' : ''} · ${x.res} sauvetage${x.res > 1 ? 's' : ''}</span></div>`).join('') || '<p class="muted small">Pas encore de commercial.</p>'}</div>
    <div class="card"><h3>Trimestre : ${fmtE(eur)} par palier</h3><p class="muted small" style="margin-top:-4px">3 paliers individuels et 2 paliers d’équipe, versés si les objectifs sont validés.</p>
      <div class="plan-eq">Équipe : <b>${X.eq} / 2</b> paliers <span class="muted small">(1 : CA ${fmtE(P.targets.ca)} · 2 : + ${P.targets.ventes} ventes, options ${P.targets.optionsPct} %, boutique ${fmtE(P.targets.boutique)})</span></div>
      <div class="table-wrap"><table class="t"><thead><tr><th>Commercial</th><th class="num">Ventes / objectif</th><th class="num">Transfo</th><th class="num">Options jour J</th><th class="num">Paliers</th><th>Appel mystère</th></tr></thead><tbody>
      ${(mgr ? X.ind : X.ind.filter(x => x.u.id === ME.id)).map(x => `<tr><td style="white-space:nowrap">${avatar(x.u, 'xs')} ${esc(fullName(x.u))}</td><td class="num">${x.v} / ${x.tgt || 'n.d.'}</td><td class="num">${x.taux == null ? 'n.d.' : Math.round(x.taux) + ' %'}</td><td class="num">${x.jj}</td><td class="num"><b>${x.paliers} / 3</b> · ${fmtE(x.paliers * eur)}</td>
        <td>${mgr ? `<select class="input sm" data-change="planMystere" data-u="${x.u.id}"><option value="">Pas testé</option><option value="ok" ${x.mystere === 'ok' ? 'selected' : ''}>Coordonnées prises</option><option value="ko" ${x.mystere === 'ko' ? 'selected' : ''}>Coordonnées non prises</option></select>` : x.mystere === 'ko' ? '<span class="bad">Non prises</span>' : x.mystere === 'ok' ? '<span class="ok">Prises</span>' : 'Pas testé'}</td></tr>${x.mystere === 'ko' ? `<tr><td colspan="6" class="bad small">Appel mystère sans prise de coordonnées : pas de prime ce mois-ci.</td></tr>` : ''}`).join('')}</tbody></table></div>
      <p class="muted small">Palier 1 : objectif de ventes individuel du trimestre · 2 : + transformation ≥ ${P.targets.transfoMin} % · 3 : + aucune option résiliée le jour de la vente.${meI && meI.mystere === 'ko' ? ' <b class="bad">Votre prime du mois est bloquée (appel mystère).</b>' : ''}</p></div></div>`;
}
// Aperçu du rapport du lundi (même contenu que l'e-mail du serveur).
function planRapport() {
  const P = planOf(); const wEnd = addDays(weekStart(today()), -1), wStart = addDays(wEnd, -6); const st = planStats(); const ch = churnStats(); const tr = transfoStats();
  const vs = sumRange(CLUB.id, null, 'contrats', wStart, wEnd); const res = Object.values(S.resiliations || {}).filter(r => r && r.clubId === CLUB.id && !r.hidden && r.date >= wStart && r.date <= wEnd);
  const fins = finsCampagne(CLUB.id, curMonth()); const btq = htBoutique(CLUB.id, wStart, wEnd); const rec = recoveredFor(CLUB.id, { from: wStart, to: wEnd });
  const sent = deepGet(S, ['serveur', 'rapport']) || {};
  return `<div class="card"><div class="card-head">${ico('mail')}<h3>Rapport du lundi</h3></div>
    <p class="muted small" style="margin-top:-6px">Envoyé automatiquement chaque ${esc(P.rapport)} à ${esc(P.directeur)}${P.copie ? ` (copie ${esc(P.copie)})` : ''}, avec graphiques. Pensez à déposer les exports Resamania le lundi matin.${sent.at ? ` Dernier envoi : ${dmy(isoOf(new Date(sent.at)))} ${new Date(sent.at).toTimeString().slice(0, 5)}.` : ''}</p>
    <div class="plan-rapport"><b>Semaine du ${dm(wStart)} au ${dm(wEnd)}</b>
      <div class="plan-kpis"><div><span>Ventes</span><b>${fmtN(vs)}</b></div><div><span>Résiliations abonnements</span><b>${res.filter(r => r.nature !== 'option').length}</b></div><div><span>Résiliations options</span><b>${res.filter(r => r.nature === 'option').length}</b></div><div><span>Fins d’engagement traitées</span><b>${fins.appeles} / ${fins.total}</b></div><div><span>CA boutique HT</span><b>${fmtE(btq)}</b></div><div><span>Dette récupérée</span><b>${fmtE(rec)}</b></div></div>
      <b>Trimestre</b><div class="plan-kpis"><div><span>CA HT</span><b>${st.ca == null ? 'n.d.' : fmtE(st.ca)}</b><small>/ ${fmtE(P.targets.ca)}</small></div><div><span>Abonnements</span><b>${st.ventes}</b><small>/ ${P.targets.ventes}</small></div><div><span>Engagement</span><b>${st.engagementPct == null ? 'n.d.' : Math.round(st.engagementPct) + ' %'}</b><small>/ ${P.targets.engagementPct} %</small></div><div><span>Options</span><b>${st.optionsPct == null ? 'n.d.' : Math.round(st.optionsPct) + ' %'}</b><small>/ ${P.targets.optionsPct} %</small></div><div><span>Boutique HT</span><b>${fmtE(st.boutique)}</b><small>/ ${fmtE(P.targets.boutique)}</small></div><div><span>Transformation</span><b>${tr.team == null ? 'n.d.' : Math.round(tr.team) + ' %'}</b><small>/ ${P.targets.transfoEquipe} %</small></div><div><span>Avis Google</span><b>${st.avis.n}</b><small>/ ${P.targets.avis}</small></div><div><span>Options résiliées jour J</span><b>${ch.jourJ.length}</b><small>objectif 0</small></div></div></div>
    <div class="row wrap" style="gap:8px;margin-top:12px"><button class="btn" data-act="planSendNow" data-to="apercu">${ico('mail')} M’envoyer un aperçu</button><button class="btn primary" data-act="planSendNow" data-to="directeur">${ico('send')} Envoyer le rapport maintenant</button><span class="muted small">Le rapport part à ${esc(P.directeur)}. Envoi au prochain passage du serveur (quelques minutes).</span></div></div>`;
}
function planReglages() {
  const P = planOf(); const t = P.targets; const mo = P.mois[curMonth()] || {};
  const f = (k, l, v) => `<label class="field"><span>${l}</span><input class="input" name="${k}" inputmode="decimal" value="${esc(String(v ?? ''))}"></label>`;
  return `<div class="card"><h3>Cibles du plan</h3><form id="plf" class="form-grid">
    ${f('ca', 'CA HT du trimestre (€)', t.ca)}${f('ventes', 'Nouveaux abonnements', t.ventes)}${f('engagementPct', 'Ventes avec engagement (%)', t.engagementPct)}${f('optionsPct', 'CA options / abonnements (%)', t.optionsPct)}${f('boutique', 'Boutique HT (€)', t.boutique)}${f('avis', 'Avis Google fin d’année', t.avis)}
    ${f('transfoEquipe', 'Transformation équipe (%)', t.transfoEquipe)}${f('transfoMin', 'Transformation minimum par commercial (%)', t.transfoMin)}${f('moisVentes', `Ventes de ${monthLabel(curMonth()).toLowerCase()}`, mo.ventes)}${f('moisCa', `CA HT de ${monthLabel(curMonth()).toLowerCase()} (€)`, mo.ca)}
    ${f('palier', 'Prime par palier (€)', P.primes.palier)}${f('equipeMoisVentes', 'Palier équipe du mois (ventes)', P.primes.equipeMoisVentes)}
    <label class="field full"><span>E-mail du directeur (rapport du lundi 15 h)</span><input class="input" name="directeur" type="email" value="${esc(P.directeur)}"></label>
    <label class="field full"><span>Copie</span><input class="input" name="copie" type="email" value="${esc(P.copie)}"></label>
    <label class="field"><span>CA HT saisi à la main pour ${monthLabel(curMonth()).toLowerCase()} (si pas d’export)</span><input class="input" name="caManuel" inputmode="decimal" value="${esc(String((planStore().caManuel || {})[curMonth()] ?? ''))}"></label></form>
    <button class="btn primary" style="margin-top:10px" data-act="planSave">Enregistrer</button></div>`;
}

// ── Actions ───────────────────────────────────────────────────────────────
const planPath = (...k) => ['plans', CLUB.id, PLAN_DEFAULT.id, ...k];
ACTIONS.planAvis = () => { const n = parseInt(($('#avf [name=n]') || {}).value, 10); if (!(n > 0)) { toast('Indiquez le nombre d’avis Google affiché aujourd’hui.'); return; } db.set(planPath('avis', today()), n); toast('1 relevé d’avis noté'); };
ACTIONS.planSave = () => {
  const f = formData($('#plf')); const num = k => { const v = parseMontant(f[k]); return Number.isNaN(v) ? null : v; }; const mk = curMonth();
  const t = {}; ['ca', 'ventes', 'engagementPct', 'optionsPct', 'boutique', 'avis', 'transfoEquipe', 'transfoMin'].forEach(k => { const v = num(k); if (v != null) t[k] = v; });
  const ops = [[planPath('targets'), t], [planPath('primes', 'palier'), num('palier') || 150], [planPath('primes', 'equipeMoisVentes'), num('equipeMoisVentes') || 60], [planPath('directeur'), (f.directeur || '').trim()], [planPath('copie'), (f.copie || '').trim() || null], [planPath('mois', mk, 'ventes'), num('moisVentes')], [planPath('mois', mk, 'ca'), num('moisCa')], [planPath('caManuel', mk), num('caManuel')]];
  db.batch(ops); toast('1 plan enregistré');
};
ACTIONS.planMystere = el => db.set(planPath('mystere', curMonth(), el.dataset.u), el.value || null);
ACTIONS.planVideo = el => db.set(planPath('missions', 'videos'), el.dataset.v);
ACTIONS.planGoRel = el => { UI.relSeg = 'file'; UI.relKind = el.dataset.k; UI.relScope = 'all'; };
ACTIONS.planGoProsp = () => { UI.relSeg = 'prospects'; };
ACTIONS.planCibles = () => {
  const P = planOf(); const cos = companiesOf(CLUB.id); const ops = [];
  P.cibles.filter(n => !cos.some(c => norm(c.nom) === norm(n))).forEach(n => { const id = newId(); ops.push([['companies', id], { id, clubId: CLUB.id, nom: n, secteur: 'Assurance / mutuelle (CSE, QVT)', statut: 'a_contacter', ownerId: ME.id, at: Date.now() }]); });
  if (ops.length) { db.batch(ops); toast(`${ops.length} entreprises ajoutées dans Entreprise`); }
};
ACTIONS.planBlackFriday = async () => {
  const P = planOf(); const since = addDays(today(), -90);
  const L = prospectsOf(CLUB.id).filter(p => p.creeLe >= since && !prospectConv(p) && !(p.statut && /ne pas rappeler|perdu definitif/.test(norm(p.statut))));
  if (!L.length) { toast('Aucun prospect non transformé sur les 3 derniers mois.'); return; }
  if (!await confirmDlg(`Poser une relance « Black Friday » sur ${L.length} prospects non transformés des 3 derniers mois, répartie entre les commerciaux, à faire avant le ${dm(P.blackFriday)} ?`, { ok: 'Placer les relances' })) return;
  const team = clubMembers(CLUB.id).filter(u => u.role === 'membre' && !u.virtual); const pool = team.length ? team : clubMembers(CLUB.id).filter(u => !u.virtual);
  const due = dateOf(addDays(P.blackFriday, -5)).getTime() + 10 * 3600000; const ops = [];
  L.forEach((p, i) => { const rl = typeof prospRel === 'function' ? prospRel(p) : null; if (!rl) return; ops.push(...relPatch(rl, { ownerId: rl.ownerId || pool[i % pool.length].id, nextAt: Math.min(due, Math.max(Date.now(), rl.nextAt || 0) || due), status: 'todo', campagne: 'blackfriday', plannedBy: ME.id, plannedAt: Date.now() })); });
  ops.push([planPath('missions', 'blackFriday'), { at: Date.now(), n: L.length, by: ME.id }]);
  db.batch(ops); toast(`${L.length} relances Black Friday placées`);
};
ACTIONS.planVieuxCsv = () => {
  const ch = churnStats(); const rows = [['Client', 'N° client', 'Téléphone', 'Solde (€)', 'Premier impayé']].concat(ch.vieux.map(c => [c.name || '', c.num || '', c.phone || '', String(c.balance).replace('.', ','), c.oldestIncident || c.balanceAt || '']));
  const csv = '﻿' + rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\r\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = `impayes-6-mois-${today()}.csv`; a.click();
};
ACTIONS.planSendNow = async el => {
  const to = el.dataset.to === 'directeur' ? 'directeur' : 'apercu'; const P = planOf();
  if (to === 'directeur' && !await confirmDlg(`Envoyer le rapport maintenant à ${P.directeur} ? Le rapport automatique du lundi 15 h part quand même.`, { ok: 'Envoyer' })) return;
  db.set(['rapport', 'demande'], { at: Date.now(), by: ME.id, club: CLUB.id, to }); toast(to === 'directeur' ? 'Le rapport part au directeur dans quelques minutes' : `Aperçu envoyé à ${P.copie || P.directeur} dans quelques minutes`);
};

// Carte d'accueil : les trois chiffres du plan.
function planHomeCard() {
  const st = planStats(); const P = st.P; if (today() < P.from || today() > P.to) return '';
  const pct = (v, t) => (v == null ? 'n.d.' : fmtP(v / t));
  return `<a class="card plan-home" href="#/dashboard" data-act="ui" data-key="dashTab" data-val="plan"><div class="row"><b class="spacer">Plan ${esc(P.label)}</b><span class="muted small">${fmtP(st.elapsed)} écoulé</span></div>
    <div class="plan-kpis"><div><span>CA HT</span><b>${pct(st.ca, P.targets.ca)}</b></div><div><span>Abonnements</span><b>${st.ventes} sur ${plur(P.targets.ventes, 'contrat', 'contrats')}</b></div><div><span>Boutique</span><b>${pct(st.boutique, P.targets.boutique)}</b></div><div><span>Avis</span><b>${plur(st.avis.n, 'avis', 'avis')}</b></div></div></a>`;
}
