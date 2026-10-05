'use strict';
// ══ PARK PULSE — calculs ══════════════════════════════════════════════════
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

// ── Index des saisies, reconstruit a chaque changement ─────────────────────
let IDX = null, IDX_REV = -1;
function idx() {
  if (IDX_REV === REV && IDX) return IDX;
  const day = new Map(); // `${club}|${user}|${kpi}` -> Map(date -> somme) ; user '*' = tout le club
  const add = (key, date, v) => { let m = day.get(key); if (!m) day.set(key, m = new Map()); m.set(date, (m.get(date) || 0) + v); };
  const months = new Set();
  for (const e of Object.values(S.entries)) {
    if (e.importId && S.imports[e.importId] && S.imports[e.importId].active === false) continue;
    const v = Number(e.value) || 0;
    add(`${e.clubId}|${e.userId || '_'}|${e.kpiId}`, e.date, v);
    add(`${e.clubId}|*|${e.kpiId}`, e.date, v);
    months.add(e.date.slice(0, 7));
  }
  Object.keys(S.targets).forEach(m => months.add(m));
  IDX = { day, months: [...months].sort(), memo: new Map() };
  IDX_REV = REV;
  return IDX;
}
function memo(key, fn) { const I = idx(); if (I.memo.has(key)) return I.memo.get(key); const v = fn(); I.memo.set(key, v); return v; }

function sumRange(clubId, userId, kpiId, from, to) {
  const m = idx().day.get(`${clubId}|${userId || '*'}|${kpiId}`);
  if (!m) return 0;
  let s = 0;
  for (const [d, v] of m) if (d >= from && d <= to) s += v;
  return s;
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
// part de la periode deja ecoulee (aujourd'hui compte comme un jour entame)
function elapsed(r) {
  const t = today();
  if (t < r.from) return 0;
  if (t > r.to) return 1;
  const total = (dateOf(r.to) - dateOf(r.from)) / 86400000 + 1;
  const done = (dateOf(t) - dateOf(r.from)) / 86400000 + 1;
  return done / total;
}

// ── Objectifs ──────────────────────────────────────────────────────────────
const isActive = u => u && u.status === 'active';
const inClub = (u, clubId) => u && (u.clubs || []).includes(clubId);
function clubMembers(clubId, { all = false } = {}) {
  // le compte Createur administre : il n'est ni classe ni objective
  return Object.values(S.users).filter(u => u.role !== 'createur' && inClub(u, clubId) && (all || isActive(u))).sort((a, b) => fullName(a).localeCompare(fullName(b)));
}
function monthTarget(mk, userId, kpiId) { return Number(deepGet(S.targets, [mk, userId, kpiId])) || 0; }
function clubMonthTarget(mk, clubId, kpiId) { return clubMembers(clubId).reduce((s, u) => s + monthTarget(mk, u.id, kpiId), 0); }
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

function statsFor(clubId, userId, r, { kpiIds = null, requiredOnly = false } = {}) {
  return memo(`st|${clubId}|${userId}|${r.from}|${r.to}|${r.period}|${kpiIds}|${requiredOnly}`, () => {
    const exp = elapsed(r);
    const rows = [];
    for (const k of kpiList()) {
      if (kpiIds && !kpiIds.includes(k.id)) continue;
      if (requiredOnly && !k.required) continue;
      const real = sumRange(clubId, userId, k.id, r.from, r.to);
      const target = targetRange(r, clubId, userId, k.id);
      const pct = target > 0 ? real / target : null;
      const earned = pct == null ? 0 : tierOf(pct) * k.points;
      rows.push({ k, real, target, pct, earned, max: target > 0 ? k.points : 0, status: statusOf(pct, exp) });
    }
    const scored = rows.filter(x => x.target > 0 && x.k.points > 0);
    const wsum = scored.reduce((s, x) => s + x.k.points, 0);
    const score = wsum ? scored.reduce((s, x) => s + Math.min(x.pct, SCORE_CAP) * x.k.points, 0) / wsum : null;
    const earned = rows.reduce((s, x) => s + x.earned, 0);
    const max = rows.reduce((s, x) => s + x.max, 0);
    return { rows, score, earned, max, expected: exp, reached: scored.filter(x => x.pct >= 1).length, count: scored.length };
  });
}

function statusOf(pct, exp) {
  if (pct == null) return { key: 'none', label: 'Sans objectif', cls: '' };
  if (pct >= 1) return { key: 'done', label: 'Objectif atteint', cls: 'status-ok' };
  if (exp <= 0) return { key: 'wait', label: 'Pas commencé', cls: '' };
  const ratio = pct / exp;
  if (ratio >= 1.05) return { key: 'ahead', label: 'En avance', cls: 'status-ok' };
  if (ratio >= 0.95) return { key: 'ontime', label: 'À l’heure', cls: 'status-ok' };
  if (ratio >= 0.75) return { key: 'late', label: 'En léger retard', cls: 'status-warn' };
  return { key: 'verylate', label: 'Très en retard', cls: 'status-bad' };
}

// Phrase de rythme sous chaque carte KPI.
function paceMessage(row, exp) {
  const { k, real, target, pct } = row;
  if (!target) return 'Pas d’objectif ce mois-ci';
  if (pct >= 1) return `Objectif atteint, +${fmtV(real - target, k.unit)} au-delà 🎉`;
  const due = target * exp - real;
  if (due > 0.0001) return `Plus que ${fmtV(k.unit === 'qty' ? Math.ceil(due) : due, k.unit)} pour être dans le temps`;
  const next = TIERS.find(t => pct < t);
  const need = next * target - real;
  return `Dans le rythme. Plus que ${fmtV(k.unit === 'qty' ? Math.ceil(need) : need, k.unit)} avant l’étape des ${next * 100} %`;
}

// ── Classements ────────────────────────────────────────────────────────────
function ranking(clubId, r, kpiId = null) {
  return memo(`rk|${clubId}|${r.from}|${r.to}|${kpiId}`, () => {
    const list = clubMembers(clubId).map(u => {
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
    for (const mk of pastMonths()) for (const c of u.clubs || []) pts += statsFor(c, userId, rangeOf('month', mk)).earned;
    pts += trophies(userId).filter(t => t.kind === 'flash').length * 200;
    return Math.round(pts);
  });
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
        if (rk[0] && rk[0].score > 0) out.push({ userId: rk[0].u.id, kind: 'month', icon: '🏆', label: `Meilleur·e commercial·e ${MOIS[Number(mk.slice(5)) - 1].toLowerCase()}`, mk, clubId: c.id });
        for (const k of kpiList()) {
          if (!k.points) continue;
          const kr = ranking(c.id, r, k.id).filter(x => x.score != null && x.real > 0);
          if (kr[0] && kr[0].score >= 0.5) out.push({ userId: kr[0].u.id, kind: 'month', icon: k.emoji || '🎖️', label: `${k.label} ${MOIS_C[Number(mk.slice(5)) - 1]}`, mk, clubId: c.id });
        }
      }
      // trimestres termines
      const qs = new Set(idx().months.filter(m => m < cm).map(m => rangeOf('quarter', m).from));
      for (const qf of qs) {
        const r = rangeOf('quarter', qf);
        if (r.to >= t) continue;
        const rk = ranking(c.id, r);
        if (rk[0] && rk[0].score > 0) out.push({ userId: rk[0].u.id, kind: 'season', icon: '👑', label: `Champion·ne de la saison ${r.label}`, mk: r.to.slice(0, 7), clubId: c.id });
      }
      // semaines terminees (12 dernieres)
      let w = weekStart(addDays(t, -7));
      for (let i = 0; i < 12; i++, w = addDays(w, -7)) {
        const r = rangeOf('week', w);
        const rk = ranking(c.id, r).filter(x => x.score > 0);
        rk.slice(0, 3).forEach((x, j) => out.push({ userId: x.u.id, kind: 'week', icon: ['🥇', '🥈', '🥉'][j], label: j ? `Podium semaine du ${dm(w)}` : `Champion·ne de la semaine du ${dm(w)}`, mk: w.slice(0, 7), clubId: c.id }));
      }
    }
    // defis flash termines
    for (const ch of Object.values(S.challenges)) {
      if (ch.end > Date.now()) continue;
      const w = challengeRanking(ch)[0];
      if (w && w.value > 0) out.push({ userId: w.u.id, kind: 'flash', icon: '⚡', label: `Défi flash : ${ch.title}`, mk: isoOf(new Date(ch.end)).slice(0, 7), clubId: ch.clubId });
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
  const from = isoOf(new Date(ch.start)), to = isoOf(new Date(Math.min(ch.end, Date.now())));
  const hours = (ch.end - ch.start) / 3600000;
  const list = clubMembers(ch.clubId).map(u => {
    let value = 0;
    for (const e of Object.values(S.entries)) {
      if (e.userId !== u.id || e.kpiId !== ch.kpiId || e.clubId !== ch.clubId) continue;
      if (e.importId && S.imports[e.importId] && S.imports[e.importId].active === false) continue;
      const ts = e.source === 'manual' ? e.at : dateOf(e.date).getTime() + 12 * 3600000;
      if (ts >= ch.start && ts <= ch.end) value += Number(e.value) || 0;
    }
    const mk = from.slice(0, 7);
    const share = monthTarget(mk, u.id, ch.kpiId) / (daysIn(mk) * 24) * hours;
    return { u, value, norm: share > 0 ? value / share : (value > 0 ? 1 : 0) };
  });
  list.sort((a, b) => b.norm - a.norm || b.value - a.value || fullName(a.u).localeCompare(fullName(b.u)));
  return list;
}

// ── Retention : taches generees depuis la base clients ─────────────────────
const LOYALTY_TYPES = {
  suivi: { label: 'Appel de suivi', icon: '📞', hint: 'Nouvel adhérent : appel à J+15 / J+30' },
  renouvellement: { label: 'Renouvellement', icon: '🔁', hint: 'Fin de contrat dans les 30 jours' },
  anniversaire: { label: 'Anniversaire', icon: '🎂', hint: 'Anniversaire dans les 7 jours' },
  impaye: { label: 'Impayé', icon: '💶', hint: 'Solde débiteur' },
  mandat: { label: 'Sans mandat', icon: '🏦', hint: 'Abonné sans mandat de prélèvement' },
};
const OUTCOMES = {
  ok: { label: 'Joint — OK', cls: 'ok', done: true },
  rdv: { label: 'RDV pris', cls: 'ok', done: true },
  paid: { label: 'Réglé', cls: 'ok', done: true },
  noanswer: { label: 'Pas de réponse', cls: 'warn', done: false },
  message: { label: 'Message laissé', cls: 'warn', done: false },
  lost: { label: 'Refus / perdu', cls: 'bad', done: true, lost: true },
};
const MAX_ATTEMPTS = 3;

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
      if (c.start) { const age = (dateOf(t) - dateOf(c.start)) / 86400000; if (age >= 13 && age <= 45) cand.push({ type: 'suivi', due: addDays(c.start, age < 30 ? 15 : 30), since: c.start }); }
      if (c.end && c.end >= t && c.end <= addDays(t, 30)) cand.push({ type: 'renouvellement', due: c.end, since: addDays(c.end, -30) });
      if (c.birth) {
        const y = t.slice(0, 4); let bd = `${y}-${c.birth.slice(5)}`; if (bd < t) bd = `${Number(y) + 1}-${c.birth.slice(5)}`;
        if (bd <= addDays(t, 7)) cand.push({ type: 'anniversaire', due: bd, since: addDays(bd, -7) });
      }
      if (Number(c.balance) > 0) cand.push({ type: 'impaye', due: t, since: c.balanceAt || '2000-01-01', amount: Number(c.balance) });
      if (c.noMandate) cand.push({ type: 'mandat', due: t, since: c.noMandateAt || '2000-01-01' });
      for (const x of cand) {
        const sinceTs = dateOf(x.since).getTime();
        let acts = actions.filter(a => a.clientId === c.id && a.type === x.type && a.at >= sinceTs).sort((a, b) => b.at - a.at);
        // « Relancer » depuis l'onglet Perdus repart de zero
        const re = acts.findIndex(a => a.outcome === 'reopen'); if (re >= 0) acts = acts.slice(0, re);
        const closed = acts.find(a => OUTCOMES[a.outcome] && OUTCOMES[a.outcome].done);
        const failed = acts.filter(a => !(OUTCOMES[a.outcome] || {}).done).length;
        let state = 'todo';
        if (closed) state = OUTCOMES[closed.outcome].lost ? 'lost' : 'done';
        else if (failed >= MAX_ATTEMPTS) state = 'lost';
        out.push({ client: c, ...x, acts, failed, state, key: `${c.id}|${x.type}` });
      }
    }
    return out;
  });
}

// CA d'un mois : somme des KPI en euros saisis/importes (base de la courbe).
function caMonth(clubId, mk, userId = null) {
  return kpiList().filter(k => k.unit === 'eur').reduce((s, k) => s + sumRange(clubId, userId, k.id, mk + '-01', `${mk}-${daysIn(mk)}`), 0);
}
