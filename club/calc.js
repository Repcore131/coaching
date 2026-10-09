/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion (Fitness Park Niort). Tous droits réservés. Logiciel protégé (CPI art. L111-1, L112-2, L335-2) : toute reproduction, même partielle, est interdite. */
'use strict';
// ══ FIT PULSE — calculs ══════════════════════════════════════════════════
//
// REGLES (affichees telles quelles dans l'aide de l'app) :
//  - % d'un KPI = realise / objectif de la periode.
//  - Points d'un KPI = points du KPI x palier atteint (25, 50, 75 ou 100 %).
//  - Score = moyenne des % des KPI ponderee par leurs points, chaque % etant
//    plafonne a 150 % (un KPI explose ne masque pas trois KPI a zero).
//  - Rythme attendu = jours ecoules / jours de la periode. Le statut compare
//    le % au rythme : >= 105 % du rythme en avance, >= 95 % a l'heure,
//    >= 75 % leger retard, sinon tres en retard.
//  - Egalites au classement : score, puis points, puis ordre alphabetique.
//  - Objectif du club = somme des objectifs des membres ACTIFS : une
//    invitation en attente ou un membre archive ne pese pas dans le total.
//  - Une saisie issue d'un import annule ne compte plus nulle part.

const SCORE_CAP = 1.5;
const TIERS = [0.25, 0.5, 0.75, 1];

// ── Quelle saisie compte ───────────────────────────────────────────────────
// - une saisie importee compte si AU MOINS UN des imports qui la portent est
//   actif (annuler le dernier import ne retire pas une vente du precedent) ;
// - retiree par un import de gestion plus recent (vente annulee) : non comptee,
//   tant que cet import est actif ;
// - pour un KPI alimente par Resamania (source 'import'), une saisie manuelle
//   datee dans la periode deja couverte par l'import du mois est remplacee par
//   l'import (pas de double comptage). Les corrections de manager (adjust)
//   comptent toujours.
const impActive = id => !id || !S.imports[id] || S.imports[id].active !== false;
function entryCounts(e) {
  if (!e || e.suppressed) return false;
  if (e.removedBy && S.imports[e.removedBy] && impActive(e.removedBy)) return false;
  const ids = e.importIds ? Object.keys(e.importIds) : [];
  if (ids.length) return ids.some(impActive);
  return impActive(e.importId);
}
const IMPORT_KPIS = ['contrats', 'nutrition', 'accessoires', 'b2b', 'prospects'];
const kpiSource = k => (S.kpis[k] && S.kpis[k].source) || (IMPORT_KPIS.includes(k) ? 'import' : 'mixte');
const isImported = e => e.source === 'import' || !!e.importId;
// Saisie manuelle remplacee par un import (affichee « remplacée par l'import »).
function replacedByImport(e, cover) {
  if (isImported(e) || e.adjust || kpiSource(e.kpiId) !== 'import') return false;
  const c = (cover || idx().cover).get(`${e.clubId}|${e.kpiId}|${e.date.slice(0, 7)}`);
  return !!c && e.date <= c;
}

// ── Index des saisies, reconstruit a chaque changement ─────────────────────
// Les valeurs sont additionnees en CENTIMES entiers (3 x 29,90 + 10,30 = 100 pile).
let IDX = null, IDX_REV = -1;
function idx() {
  if (IDX_REV === REV && IDX) return IDX;
  const day = new Map(); // `${club}|${user}|${kpi}` -> Map(date -> centimes) ; user '*' = tout le club
  const add = (key, date, v) => { let m = day.get(key); if (!m) day.set(key, m = new Map()); m.set(date, (m.get(date) || 0) + v); };
  const months = new Set();
  const live = Object.values(S.entries).filter(e => e && e.date && entryCounts(e));
  const cover = new Map(); // `${club}|${kpi}|${mois}` -> derniere date couverte par un import
  for (const e of live) if (isImported(e)) { const k = `${e.clubId}|${e.kpiId}|${e.date.slice(0, 7)}`; if (!cover.has(k) || cover.get(k) < e.date) cover.set(k, e.date); }
  for (const e of live) {
    if (replacedByImport(e, cover)) continue;
    const v = Math.round((Number(e.value) || 0) * 100);
    add(`${e.clubId}|${e.userId || '_'}|${e.kpiId}`, e.date, v);
    add(`${e.clubId}|*|${e.kpiId}`, e.date, v);
    months.add(e.date.slice(0, 7));
  }
  Object.keys(S.targets).forEach(m => months.add(m));
  IDX = { day, cover, months: [...months].sort(), memo: new Map() };
  IDX_REV = REV;
  return IDX;
}
function memo(key, fn) { const I = idx(); if (I.memo.has(key)) return I.memo.get(key); const v = fn(); I.memo.set(key, v); return v; }

// ── Jours ouvrés : du lundi au samedi, hors jours fériés (France métropolitaine) ──
function paquesDe(y) { const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451), mo = Math.floor((h + l - 7 * m + 114) / 31), da = ((h + l - 7 * m + 114) % 31) + 1; return `${y}-${pad(mo)}-${pad(da)}`; }
const FERIES = new Map();
const feriesDe = y => { if (!FERIES.has(y)) { const p = paquesDe(y); FERIES.set(y, new Set([`${y}-01-01`, addDays(p, 1), `${y}-05-01`, `${y}-05-08`, addDays(p, 39), addDays(p, 50), `${y}-07-14`, `${y}-08-15`, `${y}-11-01`, `${y}-11-11`, `${y}-12-25`])); } return FERIES.get(y); };
const estFerie = iso => feriesDe(Number(iso.slice(0, 4))).has(iso);
const estOuvre = iso => dateOf(iso).getDay() !== 0 && !estFerie(iso);
function joursOuvres(from, to) { let n = 0; for (let d = from; d <= to; d = addDays(d, 1)) if (estOuvre(d)) n++; return n; }
// Dernier jour ouvré avant une date (la « veille » d'un lundi est le samedi).
function veilleOuvree(iso = today()) { let d = addDays(iso, -1); while (!estOuvre(d)) d = addDays(d, -1); return d; }

// ── Impayés récupérés : UN seul calcul ────────────────────────────────────
// Utilisé par l'accueil, le tableau de bord, le classement, le récap et la page Impayés.
//  equipe : saisies du KPI « Impayés récupérés » (Réglé à la main + régularisations
//           importées au canal équipe) : la valeur des primes et du classement ;
//  autres canaux (client en ligne, prélèvement, automatismes, tiers) : régularisations
//           importées ; equipe_na : régularisation de l'équipe sans commercial reconnu ;
//  all    : la somme de tout cela, sans double compte.
function recoveredParts(clubId, range) {
  const { from, to } = range; const parts = { equipe: sumRange(clubId, null, 'impayes', from, to) };
  const rec = typeof recovList === 'function' ? recovList(clubId, from, to) : [];
  for (const x of rec) { const k = x.canal === 'equipe' ? (x.userId ? null : 'equipe_na') : x.canal || 'autre'; if (k) parts[k] = (parts[k] || 0) + Number(x.amount || 0); }
  for (const k of Object.keys(parts)) parts[k] = Math.round(parts[k] * 100) / 100;
  return parts;
}
function recoveredFor(clubId, range, canal = 'all', userId = null) {
  if (userId || canal === 'equipe') return Math.round(sumRange(clubId, userId, 'impayes', range.from, range.to) * 100) / 100;
  const p = recoveredParts(clubId, range);
  return canal === 'all' ? Math.round(Object.values(p).reduce((s, v) => s + v, 0) * 100) / 100 : p[canal] || 0;
}
function sumRange(clubId, userId, kpiId, from, to) {
  const m = idx().day.get(`${clubId}|${userId || '*'}|${kpiId}`);
  if (!m) return 0;
  let s = 0;
  for (const [d, v] of m) if (d >= from && d <= to) s += v;
  return s / 100;
}

// ── Periodes ───────────────────────────────────────────────────────────────
function rangeOf(period, anchor) {
  // anchor : 'YYYY-MM' (mois / trimestre) ou 'YYYY-MM-DD' (semaine)
  if (period === 'week') {
    const from = weekStart(anchor.length === 7 ? anchor + '-01' : anchor);
    const to = addDays(from, 6);
    return { period, from, to, label: `Semaine du ${dm(from)} au ${dm(to)}` };
  }
  if (period === 'quarter') {
    const mk = anchor.slice(0, 7); const [y, m] = mk.split('-').map(Number);
    const q = Math.floor((m - 1) / 3); const first = `${y}-${pad(q * 3 + 1)}`; const last = addMonths(first, 2);
    return { period, from: first + '-01', to: `${last}-${daysIn(last)}`, label: `T${q + 1} ${y}`, months: [first, addMonths(first, 1), last] };
  }
  const mk = anchor.slice(0, 7);
  return { period: 'month', from: mk + '-01', to: `${mk}-${daysIn(mk)}`, label: monthLabel(mk), months: [mk] };
}
function shiftRange(r, n) {
  if (r.period === 'week') return rangeOf('week', addDays(r.from, 7 * n));
  if (r.period === 'quarter') return rangeOf('quarter', addMonths(r.from.slice(0, 7), 3 * n));
  return rangeOf('month', addMonths(r.from.slice(0, 7), n));
}
// ── Rythme : jours ouvres du club, absences, journee entamee ──────────────
// Jours ouverts du club (0 = dimanche) : du lundi au samedi par defaut.
// Absences : S.absences[userId][date] = 'conge' | 'maladie' | 'formation'.
// Les jours sont comptes en iterant les dates AAAA-MM-JJ (jamais par
// difference de millisecondes : le changement d'heure ne fausse rien).
const openDaysOf = clubId => { const c = S.clubs && S.clubs[clubId]; return (c && Array.isArray(c.openDays) && c.openDays.length) ? c.openDays : [1, 2, 3, 4, 5, 6]; };
const isWorkday = (d, clubId, userId) => openDaysOf(clubId).includes(dateOf(d).getDay()) && !(userId && deepGet(S, ['absences', userId, d]));
function workdays(userId, clubId, from, to) { let n = 0; for (let d = from; d <= to; d = addDays(d, 1)) if (isWorkday(d, clubId, userId)) n++; return n; }
function workdaysLeft(userId, clubId, mk) { const t = today(), from = t > mk + '-01' ? t : mk + '-01', to = `${mk}-${daysIn(mk)}`; return from > to ? 0 : workdays(userId, clubId, from, to); }
// Part de la periode ecoulee. Sans club : jours calendaires (ancien calcul).
// Aujourd'hui compte au prorata de l'heure (ouverture 9 h, fermeture 21 h).
function elapsed(r, clubId = null, userId = null) {
  const t = today();
  if (t < r.from) return 0;
  if (t > r.to) return 1;
  const h = new Date(); const frac = Math.max(0, Math.min(1, (h.getHours() + h.getMinutes() / 60 - 9) / 12));
  if (!clubId) {
    const total = Math.round((dateOf(r.to) - dateOf(r.from)) / 86400000) + 1;
    const done = Math.round((dateOf(t) - dateOf(r.from)) / 86400000) + 1;
    return done / total;
  }
  const total = workdays(userId, clubId, r.from, r.to);
  if (!total) return 1;
  const before = t > r.from ? workdays(userId, clubId, r.from, addDays(t, -1)) : 0;
  return Math.min(1, (before + (isWorkday(t, clubId, userId) ? frac : 0)) / total);
}
// Mois clos : a partir du jour lockDay (5 par defaut) du mois M, le mois M-1
// est fige. Un membre saisit pour aujourd'hui et la veille seulement ; un
// manager peut corriger un mois clos, avec un motif.
function lockStart(clubId) { const c = (S.clubs || {})[clubId] || {}; const day = Number(c.lockDay) || 5; const t = today(); const cm = t.slice(0, 7); return Number(t.slice(8)) >= day ? cm + '-01' : addMonths(cm, -1) + '-01'; }
function minEntryDate(clubId) { if (isManager()) return null; const y = addDays(today(), -1); const l = lockStart(clubId); return y > l ? y : l; }
// Objectif atteint, avec tolerance d'arrondi (99,999999 % = 100 %).
const isReached = p => p != null && p >= 1 - 1e-9;

// ── Objectifs ──────────────────────────────────────────────────────────────
const isActive = u => u && u.status === 'active';
const inClub = (u, clubId) => u && (u.clubs || []).includes(clubId);
function clubMembers(clubId, { all = false, gestion = false } = {}) {
  // le compte Createur administre : il n'est ni classe ni objective.
  // PSO (membre virtuel des ventes web) figure dans les chiffres et le
  // classement ; la gestion (objectifs, présence, codes, fiche) l'exclut.
  return Object.values(S.users).filter(u => u.role !== 'createur' && (!gestion || !u.virtual) && inClub(u, clubId) && (all || isActive(u))).sort((a, b) => fullName(a).localeCompare(fullName(b)));
}
const humanMembers = (clubId, o = {}) => clubMembers(clubId, { ...o, gestion: true });
function monthTarget(mk, userId, kpiId) { return Number(deepGet(S.targets, [mk, userId, kpiId])) || 0; }
// Perimetre d'un club sur une periode : membres actifs, plus ceux archives
// pendant la periode (leurs saisies du mois comptent, leur objectif aussi).
// Le meme perimetre sert au total club, a l'objectif club et au classement.
function perimeterMembers(clubId, from, to) {
  return Object.values(S.users).filter(u => u.role !== 'createur' && inClub(u, clubId) && (isActive(u) || (u.status === 'archived' && u.archivedAt && u.archivedAt >= from))).sort((a, b) => fullName(a).localeCompare(fullName(b)));
}
function clubMonthTarget(mk, clubId, kpiId) { return perimeterMembers(clubId, mk + '-01', `${mk}-${daysIn(mk)}`).reduce((s, u) => s + monthTarget(mk, u.id, kpiId), 0); }
// Saisies du club hors perimetre (createur, membre d'un autre club, archive avant).
function unassigned(clubId, kpiId, from, to) { const inP = perimeterMembers(clubId, from, to).reduce((s, u) => s + sumRange(clubId, u.id, kpiId, from, to), 0); return Math.round((sumRange(clubId, null, kpiId, from, to) - inP) * 100) / 100; }
function targetRange(r, clubId, userId, kpiId) {
  const tg = mk => userId ? monthTarget(mk, userId, kpiId) : clubMonthTarget(mk, clubId, kpiId);
  if (r.period === 'week') {
    let s = 0; for (let d = r.from; d <= r.to; d = addDays(d, 1)) { const mk = d.slice(0, 7); s += tg(mk) / daysIn(mk); } return s;
  }
  return r.months.reduce((s, mk) => s + tg(mk), 0);
}

// ── Statistiques ───────────────────────────────────────────────────────────
const kpiList = (onlyEnabled = true) => Object.values(S.kpis).filter(k => !onlyEnabled || k.enabled).sort((a, b) => a.order - b.order);
const tierOf = p => { let t = 0; for (const x of TIERS) if (p >= x - 1e-9) t = x; return t; };
// Objectif moyen d'un KPI sur un mois (objectifs individuels > 0).
function kpiAvgTarget(kpiId, mk) {
  return memo(`avgT|${kpiId}|${mk}`, () => { const v = []; Object.values((S.targets || {})[mk] || {}).forEach(t => { const x = Number((t || {})[kpiId]); if (x > 0) v.push(x); }); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0; });
}
// Calcul continu des points : réglage du KPI, sinon automatique pour les petits objectifs (moyenne < 5).
function kpiLinear(k, mk) { if (typeof k.linear === 'boolean') return k.linear; const a = kpiAvgTarget(k.id, mk || curMonth()); return a > 0 && a < 5; }

function statsFor(clubId, userId, r, { kpiIds = null, requiredOnly = false } = {}) {
  return memo(`st|${clubId}|${userId}|${r.from}|${r.to}|${r.period}|${kpiIds}|${requiredOnly}|${new Date().getHours()}`, () => {
    const exp = elapsed(r, clubId, userId);
    const members = userId ? null : perimeterMembers(clubId, r.from, r.to);
    const rows = [];
    for (const k of kpiList()) {
      if (kpiIds && !kpiIds.includes(k.id)) continue;
      if (requiredOnly && !k.required && !(k.id === 'sauvetage' && (S.clubs[clubId] || {}).sauvRank !== false)) continue;
      // Vue club : la somme des membres du perimetre (= somme du classement).
      const real = userId ? sumRange(clubId, userId, k.id, r.from, r.to) : Math.round(members.reduce((s, u) => s + sumRange(clubId, u.id, k.id, r.from, r.to), 0) * 100) / 100;
      const target = targetRange(r, clubId, userId, k.id);
      const pct = target > 0 ? real / target : null;
      const earned = pct == null ? 0 : (kpiLinear(k, r.to.slice(0, 7)) ? Math.min(pct, 1) : tierOf(pct)) * k.points;
      rows.push({ k, real, target, pct, earned, max: target > 0 ? k.points : 0, status: statusOf(pct, exp) });
    }
    const scored = rows.filter(x => x.target > 0 && x.k.points > 0);
    const wsum = scored.reduce((s, x) => s + x.k.points, 0);
    const score = wsum ? scored.reduce((s, x) => s + Math.min(x.pct, SCORE_CAP) * x.k.points, 0) / wsum : null;
    const earned = rows.reduce((s, x) => s + x.earned, 0);
    const max = rows.reduce((s, x) => s + x.max, 0);
    // progress : avancement continu (sans les marches de 25 %), seul comparable au rythme.
    const progress = wsum ? scored.reduce((s, x) => s + Math.min(x.pct, 1) * x.k.points, 0) / wsum : null;
    return { rows, score, progress, earned, max, expected: exp, reached: scored.filter(x => isReached(x.pct)).length, count: scored.length };
  });
}

function statusOf(pct, exp) {
  if (pct == null) return { key: 'none', label: 'Sans objectif', cls: '' };
  if (isReached(pct)) return { key: 'done', label: 'Objectif atteint', cls: 'status-ok' };
  if (exp <= 0) return { key: 'wait', label: 'Pas commencé', cls: '' };
  const ratio = pct / exp;
  if (ratio >= 1.05) return { key: 'ahead', label: 'Dans le rythme', cls: 'status-ok' };
  if (ratio >= 0.95) return { key: 'ontime', label: 'Dans le rythme', cls: 'status-ok' };
  if (ratio >= 0.75) return { key: 'late', label: 'À surveiller', cls: 'status-warn' };
  return { key: 'verylate', label: 'En retard', cls: 'status-bad' };
}

// Phrase de rythme sous chaque carte KPI.
function paceMessage(row, exp) {
  const { k, real, target, pct } = row;
  if (!target) return 'Pas d’objectif ce mois-ci';
  if (isReached(pct)) return real - target > 0.004 ? `Objectif atteint, ${fmtV(real - target, k.unit)} au-delà` : 'Objectif atteint';
  const due = target * exp - real;
  if (due > 0.0001) return `Plus que ${fmtV(k.unit === 'qty' ? Math.ceil(due) : due, k.unit)} pour être dans le temps`;
  const next = TIERS.find(t => pct < t);
  const need = next * target - real;
  return `Dans le rythme. Plus que ${fmtV(k.unit === 'qty' ? Math.ceil(need) : need, k.unit)} avant l’étape des ${next * 100} %`;
}

// ── Classements ────────────────────────────────────────────────────────────
function ranking(clubId, r, kpiId = null) {
  return memo(`rk|${clubId}|${r.from}|${r.to}|${kpiId}`, () => {
    const list = perimeterMembers(clubId, r.from, r.to).map(u => {
      const st = statsFor(clubId, u.id, r, kpiId ? { kpiIds: [kpiId] } : { requiredOnly: true });
      const row = kpiId ? st.rows[0] : null;
      return { u, st, score: kpiId ? (row && row.pct) : st.score, earned: st.earned, real: row ? row.real : null };
    });
    list.sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || b.earned - a.earned || fullName(a.u).localeCompare(fullName(b.u)));
    list.forEach((x, i) => { x.rank = i + 1; });
    return list;
  });
}
// Clubs entre eux : moyenne des scores des membres actifs (un grand club
// n'est pas avantage par son effectif).
function clubRanking(r) {
  return memo(`crk|${r.from}|${r.to}`, () => {
    const list = Object.values(S.clubs).map(c => {
      const rk = ranking(c.id, r).filter(x => x.score != null);
      const score = rk.length ? rk.reduce((s, x) => s + x.score, 0) / rk.length : null;
      return { c, score, members: clubMembers(c.id).length };
    });
    list.sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || a.c.name.localeCompare(b.c.name));
    list.forEach((x, i) => { x.rank = i + 1; });
    return list;
  });
}

// ── Points cumules, niveaux, trophees ──────────────────────────────────────
function pastMonths() { const cm = curMonth(); return idx().months.filter(m => m <= cm); }
function allTime(userId) {
  return memo(`at|${userId}`, () => {
    const u = S.users[userId]; if (!u) return 0;
    let pts = 0;
    for (const mk of pastMonths()) for (const c of u.clubs || []) { const st = statsFor(c, userId, rangeOf('month', mk)); pts += st.earned + overBonus(st); }
    pts += trophies(userId).filter(t => t.kind === 'flash').length * 200;
    pts += actionPoints(userId, '2000-01-01', today());
    return Math.round(pts);
  });
}
// Rythme de points par semaine (mois en cours, a defaut le mois dernier) : estimation du temps avant le niveau suivant.
function weeklyPace(uid) { const u = S.users[uid]; if (!u) return 0; const cm = curMonth(); const d = Number(today().slice(8)); const pts = mk => (u.clubs || []).reduce((s, c) => s + statsFor(c, uid, rangeOf('month', mk)).earned, 0); const cur = pts(cm); if (d >= 7 && cur > 0) return cur / (d / 7); const pm = addMonths(cm, -1); return pts(pm) / (daysIn(pm) / 7); }
// Jours où un membre a fait au moins une saisie manuelle (index, une seule lecture des saisies).
function manualDays(uid) { return memo('mdays', () => { const by = {}; Object.values(S.entries).forEach(e => { if (e.source === 'manual' && e.userId) (by[e.userId] = by[e.userId] || new Set()).add(e.date); }); return by; })[uid] || new Set(); }
// Bonus de dépassement (niveaux seulement) : +10 % des points du KPI par tranche de 10 % au-delà de 100 %, plafonné à 150 %.
const overBonus = st => st.rows.reduce((s, x) => s + (x.pct > 1 && x.k.points > 0 ? Math.floor((Math.min(x.pct, 1.5) - 1) * 10 + 1e-9) * 0.1 * x.k.points : 0), 0);
// Points d'action : relances notées via les boutons d'issue. Une fiche rapporte une fois par jour, 300 points par semaine au plus.
const ACT_PTS = { ok: 10, rdv: 10, paid: 20, noanswer: 2, message: 2, propose: 10, accepte: 20, appele: 2, offre: 10, revenu: 20 };
function actionEvents(userId) {
  return memo(`actev|${userId}`, () => {
    const ev = [];
    Object.values(S.loyalty || {}).forEach(a => { if (a.userId === userId && ACT_PTS[a.outcome]) ev.push({ at: a.at, key: 'c' + a.clientId, pts: ACT_PTS[a.outcome], good: (OUTCOMES[a.outcome] || {}).done && !(OUTCOMES[a.outcome] || {}).lost }); });
    Object.values(S.resiliations || {}).forEach(r => Object.values(r.log || {}).forEach(a => { if (a.by === userId && (a.out || /^(Pas de réponse|Message laissé|RDV pris|Offre proposée|Refus)/.test(a.label || ''))) ev.push({ at: a.at, key: 'r' + r.id, pts: /Pas de réponse|Message laissé/.test(a.label || '') ? 2 : 10, good: /RDV|Offre/.test(a.label || '') }); }));
    Object.values(S.touches || {}).forEach(t => { if (t.by === userId && t.channel !== 'note' && typeof TOUCH_OUTCOMES !== 'undefined' && TOUCH_OUTCOMES[t.outcome]) ev.push({ at: t.at, key: 't' + (t.clientId || t.prospectId || t.relKey || t.id), pts: TOUCH_OUTCOMES[t.outcome].reached ? 10 : 2, good: !!TOUCH_OUTCOMES[t.outcome].reached }); });
    return ev.filter(e => e.at).sort((a, b) => a.at - b.at);
  });
}
function actionPoints(userId, from, to) {
  return memo(`actp|${userId}|${from}|${to}`, () => {
    const seen = new Set(), week = {}; let tot = 0;
    for (const e of actionEvents(userId)) {
      const d = isoOf(new Date(e.at)); if (d < from || d > to) continue;
      const k = e.key + '|' + d; if (seen.has(k)) continue; seen.add(k);
      const w = weekStart(d); const room = 300 - (week[w] || 0); if (room <= 0) continue;
      const p = Math.min(room, e.pts); week[w] = (week[w] || 0) + p; tot += p;
    }
    return tot;
  });
}
// Points cumulés depuis un mois donné (classement « 12 derniers mois »).
function pointsSince(userId, sinceMk) {
  return memo(`ps|${userId}|${sinceMk}`, () => { const u = S.users[userId]; if (!u) return 0; let pts = 0; for (const mk of pastMonths().filter(m => m >= sinceMk)) for (const c of u.clubs || []) { const st = statsFor(c, userId, rangeOf('month', mk)); pts += st.earned + overBonus(st); } pts += trophies(userId).filter(t => t.kind === 'flash' && (t.mk || '') >= sinceMk).length * 200; pts += actionPoints(userId, sinceMk + '-01', today()); return Math.round(pts); });
}
function levelOf(pts) { let l = LEVELS[0]; for (const x of LEVELS) if (pts >= x.min) l = x; const next = LEVELS[LEVELS.indexOf(l) + 1]; return { ...l, next }; }

function allTrophies() {
  return memo('trophies', () => {
    const out = [];
    const cm = curMonth();
    const t = today();
    for (const c of Object.values(S.clubs)) {
      // mois termines
      for (const mk of idx().months.filter(m => m < cm)) {
        const r = rangeOf('month', mk);
        const rk = ranking(c.id, r);
        if (rk[0] && rk[0].score > 0) out.push({ userId: rk[0].u.id, kind: 'month', icon: 'trophy', label: `N°1 du mois ${MOIS[Number(mk.slice(5)) - 1].toLowerCase()}`, mk, clubId: c.id });
        for (const k of kpiList()) {
          if (!k.points) continue;
          const kr = ranking(c.id, r, k.id).filter(x => x.score != null && x.real > 0);
          if (kr[0] && kr[0].score >= 0.5) out.push({ userId: kr[0].u.id, kind: 'month', icon: kpiIconName(k), label: `${k.label} ${MOIS_C[Number(mk.slice(5)) - 1]}`, mk, clubId: c.id });
        }
      }
      // trimestres termines
      const qs = new Set(idx().months.filter(m => m < cm).map(m => rangeOf('quarter', m).from));
      for (const qf of qs) {
        const r = rangeOf('quarter', qf);
        if (r.to >= t) continue;
        const rk = ranking(c.id, r);
        if (rk[0] && rk[0].score > 0) out.push({ userId: rk[0].u.id, kind: 'season', icon: 'crown', label: `N°1 de la saison ${r.label}`, mk: r.to.slice(0, 7), clubId: c.id });
      }
      // semaines terminees (12 dernieres)
      let w = weekStart(addDays(t, -7));
      for (let i = 0; i < 12; i++, w = addDays(w, -7)) {
        const r = rangeOf('week', w);
        const rk = ranking(c.id, r).filter(x => x.score > 0);
        rk.slice(0, 3).forEach((x, j) => out.push({ userId: x.u.id, kind: 'week', icon: 'medal', tone: ['gold', 'silver', 'bronze'][j], label: j ? `Podium semaine du ${dm(w)}` : `N°1 de la semaine du ${dm(w)}`, mk: w.slice(0, 7), clubId: c.id }));
      }
    }
    // trophees de comportement et trophees personnels
    for (const c of Object.values(S.clubs)) {
      const team = clubMembers(c.id, { all: true }).filter(u => u.status !== 'pending');
      let w = weekStart(addDays(t, -7));
      for (let i = 0; i < 12; i++, w = addDays(w, -7)) {
        const we = addDays(w, 6);
        const sv = team.map(u => ({ u, n: sumRange(c.id, u.id, 'sauvetage', w, we) })).sort((a, b) => b.n - a.n)[0];
        if (sv && sv.n >= 1) out.push({ userId: sv.u.id, kind: 'week', icon: 'lifebuoy', label: `Sauveur de la semaine du ${dm(w)}`, mk: w.slice(0, 7), clubId: c.id });
        const rl = team.map(u => ({ u, n: actionEvents(u.id).filter(e => e.good && isoOf(new Date(e.at)) >= w && isoOf(new Date(e.at)) <= we).length })).sort((a, b) => b.n - a.n)[0];
        if (rl && rl.n >= 3) out.push({ userId: rl.u.id, kind: 'week', icon: 'phone', label: `Relanceur de la semaine du ${dm(w)}`, mk: w.slice(0, 7), clubId: c.id });
      }
      const months = idx().months.filter(m => m < cm).sort();
      const best = {}; let prevScores = null;
      for (const mk of months) {
        const sc = {}; team.forEach(u => { if ((u.clubs || []).includes(c.id)) sc[u.id] = statsFor(c.id, u.id, rangeOf('month', mk), { requiredOnly: true }).score; });
        Object.entries(sc).forEach(([uid, s]) => { if (s == null) return; if (best[uid] != null && s > best[uid] + 1e-9) out.push({ userId: uid, kind: 'perso', icon: 'flag', label: `Record personnel ${MOIS_C[Number(mk.slice(5)) - 1]}`, mk, clubId: c.id }); best[uid] = Math.max(best[uid] ?? -1, s); });
        if (prevScores) { const up = Object.entries(sc).filter(([uid, s]) => s != null && prevScores[uid] != null).map(([uid, s]) => [uid, s - prevScores[uid]]).sort((a, b) => b[1] - a[1])[0]; if (up && up[1] > 0.005) out.push({ userId: up[0], kind: 'perso', icon: 'sparkle', label: `Plus belle progression ${MOIS_C[Number(mk.slice(5)) - 1]}`, mk, clubId: c.id }); }
        prevScores = sc;
        const r0 = dateOf(mk + '-01').getTime(), r1 = dateOf(addMonths(mk, 1) + '-01').getTime();
        const pil = team.map(u => ({ u, n: Object.values(S.loyalty || {}).filter(a => a.userId === u.id && a.at >= r0 && a.at < r1 && (OUTCOMES[a.outcome] || {}).done && !(OUTCOMES[a.outcome] || {}).lost).length })).sort((a, b) => b.n - a.n)[0];
        if (pil && pil.n >= 15) out.push({ userId: pil.u.id, kind: 'perso', icon: 'heart', label: `Pilier rétention ${MOIS_C[Number(mk.slice(5)) - 1]}`, mk, clubId: c.id });
        team.forEach(u => { if (!(u.clubs || []).includes(c.id)) return; const days = manualDays(u.id); let run = 0, top = 0; for (let d = 1; d <= daysIn(mk); d++) { if (days.has(`${mk}-${pad(d)}`)) { run++; top = Math.max(top, run); } else run = 0; } if (top >= 5) out.push({ userId: u.id, kind: 'perso', icon: 'calcheck', label: `Régularité ${MOIS_C[Number(mk.slice(5)) - 1]}`, mk, clubId: c.id }); });
      }
    }
    // defis flash termines
    for (const ch of Object.values(S.challenges)) {
      if (ch.end > Date.now()) continue;
      const w = challengeRanking(ch)[0];
      if (w && w.value > 0) out.push({ userId: w.u.id, kind: 'flash', icon: 'bolt', label: `Défi flash : ${ch.title}`, mk: isoOf(new Date(ch.end)).slice(0, 7), clubId: ch.clubId });
    }
    return out;
  });
}
const trophies = userId => allTrophies().filter(t => t.userId === userId);

function accomplishments(userId) {
  // serie de jours consecutifs avec au moins une saisie
  const days = new Set(Object.values(S.entries).filter(e => e.userId === userId && e.source === 'manual').map(e => e.date));
  let streak = 0; let d = today(); if (!days.has(d)) d = addDays(d, -1);
  while (days.has(d)) { streak++; d = addDays(d, -1); }
  let first100 = false, all100 = false;
  const u = S.users[userId];
  for (const mk of pastMonths()) for (const c of (u && u.clubs) || []) {
    const st = statsFor(c, userId, rangeOf('month', mk));
    if (st.rows.some(x => x.pct >= 1)) first100 = true;
    if (st.count && st.reached === st.count) all100 = true;
  }
  return { streak, first100, all100 };
}

// ── Defis flash ────────────────────────────────────────────────────────────
// Classement normalise par l'objectif mensuel : 3 contrats pour un objectif de
// 10 valent mieux que 4 pour un objectif de 20.
function challengeRanking(ch) {
  const from = isoOf(new Date(ch.start));
  const hours = (ch.end - ch.start) / 3600000;
  const list = clubMembers(ch.clubId).map(u => {
    let value = 0;
    // Défi relances : points d'action gagnés pendant le défi (même plafond, même règle d'une fiche par jour).
    if (ch.kpiId === '_actions') { const seen = new Set(); actionEvents(u.id).forEach(e => { if (e.at < ch.start || e.at > ch.end) return; const k = e.key + '|' + isoOf(new Date(e.at)); if (!seen.has(k)) { seen.add(k); value += e.pts; } }); return { u, value, norm: value / 100 }; }
    for (const e of Object.values(S.entries)) {
      if (e.userId !== u.id || e.kpiId !== ch.kpiId || e.clubId !== ch.clubId) continue;
      if (!entryCounts(e) || e.adjust || replacedByImport(e)) continue; // une correction de manager ne compte pas dans un defi
      const ts = e.source === 'manual' ? e.at : dateOf(e.date).getTime() + 12 * 3600000;
      if (ts >= ch.start && ts <= ch.end) value += Number(e.value) || 0;
    }
    const mk = from.slice(0, 7);
    // Sans objectif personnel sur ce KPI : la moyenne des objectifs de l'équipe sert de référence.
    let tgt = monthTarget(mk, u.id, ch.kpiId);
    if (!(tgt > 0)) { const L = clubMembers(ch.clubId).map(o => monthTarget(mk, o.id, ch.kpiId)).filter(x => x > 0); tgt = L.length ? L.reduce((s, x) => s + x, 0) / L.length : 0; }
    const share = tgt / (daysIn(mk) * 24) * hours;
    return { u, value, norm: share > 0 ? value / share : 0 };
  });
  list.sort((a, b) => b.norm - a.norm || b.value - a.value || fullName(a.u).localeCompare(fullName(b.u)));
  return list;
}

// ── Retention : taches generees depuis la base clients ─────────────────────
// Icone d'un trophee (nom d'icone controle, teinte or/argent/bronze pour le podium).
const trophyIcon = (t, cls = 'ico') => `<span class="tro ${t.tone || ''}" title="${esc(t.label || '')}">${typeof trophyArt === 'function' ? trophyArt(t, /ico-xs/.test(cls) ? 18 : /ico-xl/.test(cls) ? 56 : 32) : ico(ICONS[t.icon] ? t.icon : 'trophy', cls)}</span>`;
const LOYALTY_TYPES = {
  suivi: { label: 'Appel de suivi', icon: 'phone', hint: 'Nouvel adhérent : appel à J+15 / J+30' },
  renouvellement: { label: 'Fin d’engagement', icon: 'clock', hint: 'Arrive en fin d’engagement : relancer pour le renouvellement' },
  anniversaire: { label: 'Anniversaire', icon: 'cake', hint: 'Anniversaire dans les 7 jours' },
  impaye: { label: 'Impayé', icon: 'coins', hint: 'Solde débiteur' },
  mandat: { label: 'Sans mandat', icon: 'bank', hint: 'Abonné sans mandat de prélèvement' },
};
const OUTCOMES = {
  ok: { label: 'Joint, renouvelle', cls: 'ok', done: true },
  maintien: { label: 'Maintien 8 sem.', cls: 'ok', done: true },
  rdv: { label: 'RDV pris', cls: 'ok', done: true },
  paid: { label: 'Réglé', cls: 'ok', done: true },
  noanswer: { label: 'Pas de réponse', cls: 'warn', done: false },
  message: { label: 'Message laissé', cls: 'warn', done: false },
  lost: { label: 'Ne renouvelle pas', cls: 'bad', done: true, lost: true },
};
const MAX_ATTEMPTS = 3;
const SUIVI_COUPURE = 22; // jours après l'inscription : avant = appel J+15, après = appel J+30

// Valeur en jeu d'une tâche de rétention : montant dû pour un impayé, sinon
// prix mensuel x mois d'engagement restants (3 mois si la fin est inconnue).
function moisRestants(end, from = today()) {
  if (!end || end <= from) return null;
  const [y1, m1, d1] = from.split('-').map(Number), [y2, m2, d2] = end.split('-').map(Number);
  return Math.max(1, (y2 - y1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0));
}
function valueAtStake(task) {
  if (!task || !task.client) return 0;
  if (task.type === 'impaye') return Math.round((Number(task.amount != null ? task.amount : task.client.balance) || 0) * 100) / 100;
  const prix = typeof mensualite === 'function' ? mensualite(task.client) : Number(task.client.price) || 0;
  const mois = moisRestants(task.client.end) || 3;
  return Math.round(prix * mois * 100) / 100;
}

function loyaltyTasks(clubId) {
  return memo(`loy|${clubId}`, () => {
    const t = today();
    const out = [];
    const actions = Object.values(S.loyalty);
    for (const c of Object.values(S.clients)) {
      if (c.clubId !== clubId) continue;
      // anciens clients, perdus, prospects : pas de relance de fidelisation
      if (c.status && /ancien|perdu|prospect|exclu|temporaire/.test(norm(c.status))) continue;
      const cand = [];
      // Suivi J+15 puis J+30 : deux appels distincts. Un J+15 réussi ne ferme plus le J+30 (audit 3.6) :
      // chaque action porte son étape (step) ; les anciennes, sans étape, sont classées par leur date.
      if (c.start) { const age = Math.round((dateOf(t) - dateOf(c.start)) / 86400000); if (age >= 13 && age < 28) cand.push({ type: 'suivi', step: 15, due: addDays(c.start, 15), since: c.start }); else if (age >= 28 && age <= 45) cand.push({ type: 'suivi', step: 30, due: addDays(c.start, 30), since: c.start }); }
      if (c.end && c.end >= t && c.end <= addDays(t, 45)) cand.push({ type: 'renouvellement', due: c.end, since: addDays(c.end, -45), amount: typeof mensualite === 'function' ? Math.round(mensualite(c) * dureeVieMois(clubId)) : 0 });
      if (c.birth) {
        const y = t.slice(0, 4); let bd = `${y}-${c.birth.slice(-5)}`; if (bd < t) bd = `${Number(y) + 1}-${c.birth.slice(-5)}`;
        if (bd <= addDays(t, 7)) cand.push({ type: 'anniversaire', due: bd, since: addDays(bd, -7) });
      }
      if (Number(c.balance) > 0) cand.push({ type: 'impaye', due: t, since: c.balanceAt || '2000-01-01', amount: Number(c.balance) });
      if (c.noMandate) cand.push({ type: 'mandat', due: t, since: c.noMandateAt || '2000-01-01' });
      for (const x of cand) {
        const sinceTs = dateOf(x.since).getTime();
        const cut = x.step ? dateOf(addDays(c.start, SUIVI_COUPURE)).getTime() : 0;
        let acts = actions.filter(a => a.clientId === c.id && a.type === x.type && a.at >= sinceTs && (!x.step || (a.step ? a.step === x.step : x.step === 15 ? a.at < cut : a.at >= cut))).sort((a, b) => b.at - a.at);
        // « Relancer » depuis l'onglet Perdus repart de zero
        const re = acts.findIndex(a => a.outcome === 'reopen'); if (re >= 0) acts = acts.slice(0, re);
        const closed = acts.find(a => OUTCOMES[a.outcome] && OUTCOMES[a.outcome].done);
        const failed = acts.filter(a => !(OUTCOMES[a.outcome] || {}).done).length;
        let state = 'todo';
        if (closed) state = OUTCOMES[closed.outcome].lost ? 'lost' : 'done';
        else if (failed >= MAX_ATTEMPTS) state = 'lost';
        // Prochaine action datée (session d'appels) : la tâche revient à cette date.
        const nextDate = state === 'todo' && acts[0] && acts[0].next && acts[0].next > t ? acts[0].next : null;
        const task = { client: c, ...x, acts, failed, state, nextDate, key: `${c.id}|${x.type}${x.step ? x.step : ''}` };
        task.valeurEnJeu = valueAtStake(task);
        out.push(task);
      }
    }
    return out;
  });
}

// CA boutique d'un mois : les KPI qui sont du chiffre d'affaires (nutrition,
// accessoires, ou k.revenue). Un impaye recupere n'est pas un nouveau CA.
const REVENUE_KPIS = ['nutrition', 'accessoires'];
const isRevenue = k => k.revenue === true || (k.revenue !== false && REVENUE_KPIS.includes(k.id));
function caMonth(clubId, mk, userId = null) {
  return kpiList().filter(k => k.unit === 'eur' && isRevenue(k)).reduce((s, k) => s + sumRange(clubId, userId, k.id, mk + '-01', `${mk}-${daysIn(mk)}`), 0);
}
